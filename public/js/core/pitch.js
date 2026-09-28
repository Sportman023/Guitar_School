// Pitch detection for the tuner: the YIN algorithm (de Cheveigné & Kawahara,
// 2002). It looks for the period at which the sound repeats itself, so it
// works even when a phone microphone barely picks up the fundamental of a low
// string and the overtones are louder — the case where simple spectrum-peak
// tuners jump an octave.
//
// The search is limited to a range around the string being tuned, narrower
// than an octave from end to end, so a period and its double never both fit:
// an octave error inside the range is impossible, and a guitar string is
// hardly ever that far out of tune anyway. A sound an octave or more above
// repeats itself within the range too, so it is caught separately and ignored
// — that is also how a string tightened far too much stays silent instead of
// passing for a slack one.
//
// Before the analysis the sound goes through a band filter around the string
// (bandFor): it removes rumble and hiss, and the high overtones, which on a
// real string are slightly sharp and would pull the reading up. Two narrow
// notches cut mains hum (50 Hz, or 60 Hz in some countries), which sits right
// next to the notes of the two lowest strings.
//
// Pure functions without the DOM or Web Audio, so they can be tested in Node
// (tools/test-pitch.mjs).

/** How far the tuner listens around the target note: 5.5 semitones either way. */
export const RANGE = 2 ** (5.5 / 12);

/** Quieter than this is silence or room noise, not a plucked string. */
export const MIN_RMS = 0.004;

/** YIN threshold: a dip below it counts as a period. */
const THRESHOLD = 0.15;
/** With no dip that clear, the best one found still has to be at least this good. */
const MAX_APERIODICITY = 0.35;

/** Mains hum frequencies cut out of the signal, and how narrow the cut is (Q). */
export const HUM = [50, 60];
export const HUM_Q = 4;

/** The band the microphone signal is filtered to before tuning the target note. */
export function bandFor(target) {
  return { highpass: target / 2, lowpass: target * 4 };
}

export function rms(buf) {
  let sum = 0;
  for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
  return Math.sqrt(sum / buf.length);
}

/**
 * The pitch of a frame of sound, searched between minFreq and maxFreq.
 * Returns { freq, clarity } (clarity 0…1, 1 — a perfectly periodic sound),
 * or null when the frame is too quiet or not a clear note.
 */
export function detectPitch(buf, sampleRate, minFreq, maxFreq) {
  if (rms(buf) < MIN_RMS) return null;

  const tauMin = Math.max(2, Math.floor(sampleRate / maxFreq));
  const tauMax = Math.ceil(sampleRate / minFreq);
  const size = buf.length - tauMax - 1;
  // the window must hold at least two periods of the lowest note
  if (size < tauMax * 2) throw new Error('Pitch buffer is too short for the lowest frequency');

  // difference function and its cumulative mean normalisation (steps 2 and 3 of YIN)
  const cmnd = new Float32Array(tauMax + 2);
  cmnd[0] = 1;
  let running = 0;
  for (let tau = 1; tau <= tauMax + 1; tau++) {
    let sum = 0;
    for (let j = 0; j < size; j++) {
      const delta = buf[j] - buf[j + tau];
      sum += delta * delta;
    }
    running += sum;
    cmnd[tau] = running > 0 ? (sum * tau) / running : 1;
  }

  // step 4: the first dip under the threshold, followed to its bottom
  let best = -1;
  for (let tau = tauMin; tau <= tauMax; tau++) {
    if (cmnd[tau] < THRESHOLD) {
      while (tau + 1 <= tauMax && cmnd[tau + 1] < cmnd[tau]) tau++;
      best = tau;
      break;
    }
  }
  // no clear dip: take the deepest one, if it is good enough — or rather the
  // first dip nearly as deep, since twice the period is a dip as well
  if (best < 0) {
    let deepest = tauMin;
    for (let tau = tauMin + 1; tau <= tauMax; tau++) if (cmnd[tau] < cmnd[deepest]) deepest = tau;
    if (cmnd[deepest] > MAX_APERIODICITY) return null;
    for (let tau = tauMin + 1; tau < tauMax; tau++) {
      const isDip = cmnd[tau] <= cmnd[tau - 1] && cmnd[tau] <= cmnd[tau + 1];
      if (isDip && cmnd[tau] <= cmnd[deepest] + 0.05) {
        best = tau;
        break;
      }
    }
    if (best < 0) best = deepest;
  }
  // a minimum on the edge of the range means the real one lies outside it
  if (best === tauMin || best === tauMax) return null;
  // the sound repeats itself a half or a third of the way too: it is a note an
  // octave or more above, not the string being tuned
  for (const part of [2, 3]) {
    const center = Math.round(best / part);
    for (let tau = center - 1; tau <= center + 1; tau++) {
      if (cmnd[tau] < Math.max(THRESHOLD, cmnd[best] + 0.1)) return null;
    }
  }

  // step 5: parabolic interpolation between samples — at 48 kHz one sample
  // is about 12 cents for the first string, far too coarse for tuning
  const a = cmnd[best - 1];
  const b = cmnd[best];
  const c = cmnd[best + 1];
  const bend = a - 2 * b + c;
  const shift = bend > 0 ? (a - c) / (2 * bend) : 0;
  const period = best + Math.max(-0.5, Math.min(0.5, shift));

  return { freq: sampleRate / period, clarity: 1 - b };
}

/** How far freq is from target, in cents (100 cents = a semitone). */
export function centsOff(freq, target) {
  return 1200 * Math.log2(freq / target);
}

/** Pitch of a frame, looked for only around the target note. */
export function detectAround(buf, sampleRate, target) {
  return detectPitch(buf, sampleRate, target / RANGE, target * RANGE);
}

export function median(list) {
  const sorted = [...list].sort((x, y) => x - y);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Readings less clear than this are skipped. */
const MIN_CLARITY = 0.9;
/** A string that faded below this share of its pluck is no longer trusted. */
const FADED = 0.2;
/** A jump in loudness this big is a new pluck. */
const ONSET = 1.8;
/** How many recent readings the shown value is the median of. */
const HISTORY = 7;
/** How long the last value stays on screen once the string is quiet, ms. */
const HOLD = 1500;

/**
 * Turns a stream of single-frame readings into a steady value to show.
 * Every frame has its loudness and, maybe, a reading; the tracker notices a
 * new pluck, ignores the faded tail of the string (where the hum and the
 * overtones win), and shows the median of the last readings, so one wrong
 * frame can't move the needle.
 */
export class PitchTracker {
  constructor(target) {
    this.target = target;
    this.reset();
  }

  reset() {
    this.cents = [];
    this.peak = 0;
    this.level = 0;
    this.lastHeard = -Infinity;
    this.shown = null;
  }

  /** One frame: its time in ms, its loudness (rms) and its reading or null. Returns cents off or null. */
  push(time, level, reading) {
    if (level > MIN_RMS && level > this.level * ONSET) {
      // a new pluck: the old readings belong to another sound
      this.cents = [];
      this.peak = level;
    }
    this.level = level;
    this.peak = Math.max(this.peak, level);

    if (reading && reading.clarity >= MIN_CLARITY && level >= this.peak * FADED) {
      this.cents.push(centsOff(reading.freq, this.target));
      if (this.cents.length > HISTORY) this.cents.shift();
      this.lastHeard = time;
    }

    if (time - this.lastHeard > HOLD) this.shown = null;
    // a lone reading is not enough to go by: until there are three, the
    // previous value stays
    else if (this.cents.length >= 3) this.shown = median(this.cents);
    return this.shown;
  }
}
