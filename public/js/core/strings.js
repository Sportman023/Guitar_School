// The workshop guitars: a plucked-string synth and a little player for tunes.
//
// This is the only synthesised instrument in the app. Notes to learn always
// sound on the recorded piano (piano.js); here it is the child's own guitar
// that plays, and every body shape has its own voice (see data/tunes.js).
//
// A string is the Karplus–Strong algorithm: a short burst of noise that loops
// on itself and slowly decays. On top of it a timbre can add an amp (drive),
// an echo and a slightly detuned second string for a chorus-like shimmer.
//
// Tunes are written as text, one string per voice:
//   'C4:1 D4 E4:.5'   note and length in beats; a missing length repeats the last one
//   'C3+E3+G3:2'      a chord, strummed from the lowest note up
//   '-:1'             a rest
//   '@140'            a new tempo from here on
//   'A2+E3!:.5'       '!' — palm mute: a short, dull chug
//   'D5^:1'           '^' — bend: starts a whole tone low and slides up to the note

import { ensureAudio } from './audio.js';

const STEPS = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

function midi(name) {
  const match = /^([A-G])(#|b)?(\d)$/.exec(name);
  if (!match) throw new Error(`Unknown note: ${name}`);
  const [, letter, accidental, octave] = match;
  return 12 * (Number(octave) + 1) + STEPS[letter] + (accidental === '#' ? 1 : accidental === 'b' ? -1 : 0);
}

const frequency = (note) => 440 * 2 ** ((note - 69) / 12);

/** Turns one voice into timed events: { time, len } in seconds plus the notes. */
function parseVoice(text, bpm) {
  const events = [];
  let beat = 60 / bpm;
  let len = 1;
  let time = 0;
  for (const token of text.trim().split(/\s+/)) {
    if (token.startsWith('@')) {
      beat = 60 / Number(token.slice(1));
      continue;
    }
    const [head, size] = token.split(':');
    if (size) len = Number(size);
    const flags = head.match(/[!^]*$/)[0];
    const body = head.slice(0, head.length - flags.length);
    if (body !== '-') {
      events.push({
        time,
        len: len * beat,
        notes: body.split('+').map(midi),
        mute: flags.includes('!'),
        bend: flags.includes('^'),
      });
    }
    time += len * beat;
  }
  return { events, end: time };
}

// Rendered strings are reused: a tune plays the same note many times
const buffers = new Map();

function pluck(ac, note, seconds, { sustain, smooth }) {
  const freq = frequency(note);
  // high strings ring shorter than low ones, as on a real guitar
  const ring = sustain * Math.min(1.5, (196 / freq) ** 0.35);
  const length = Math.round(Math.min(seconds, ring) * 20) / 20 + 0.05;
  const key = `${note}|${length}|${ring.toFixed(2)}|${smooth}`;
  if (buffers.has(key)) return buffers.get(key);

  const rate = ac.sampleRate;
  const total = Math.floor(rate * length);
  // the averaging below delays the loop by half a sample
  const period = Math.max(2, Math.round(rate / freq - 0.5));
  // loses 60 dB over `ring` seconds
  const damping = 0.001 ** (1 / (ring * freq));

  const buffer = ac.createBuffer(1, total, rate);
  const out = buffer.getChannelData(0);
  const loop = new Float32Array(period);
  for (let i = 0; i < period; i++) loop[i] = Math.random() * 2 - 1;
  // smoothing the first burst makes the pluck softer (nylon) or keeps it bright (steel)
  for (let pass = 0; pass < smooth; pass++) {
    for (let i = 0; i < period; i++) loop[i] = (loop[i] + loop[(i + 1) % period]) / 2;
  }
  let idx = 0;
  for (let i = 0; i < total; i++) {
    const current = loop[idx];
    out[i] = current;
    loop[idx] = (current + loop[(idx + 1) % period]) * 0.5 * damping;
    idx = (idx + 1) % period;
  }
  const fade = Math.min(total, Math.floor(rate * 0.06));
  for (let i = total - fade; i < total; i++) out[i] *= (total - i) / fade;

  buffers.set(key, buffer);
  return buffer;
}

function driveCurve(amount) {
  const curve = new Float32Array(1024);
  for (let i = 0; i < curve.length; i++) {
    const x = (i / (curve.length - 1)) * 2 - 1;
    curve[i] = Math.tanh(amount * x) / Math.tanh(amount);
  }
  return curve;
}

/** Signal chain of one guitar: strings → amp → tone → limiter → speaker (+ echo). */
function buildRig(ac, timbre) {
  const input = ac.createGain();
  const output = ac.createGain();
  let echo = null;
  output.gain.value = timbre.volume;
  let last = input;

  // a gentle limiter keeps chords and echoes from clipping
  const limiter = ac.createDynamicsCompressor();
  limiter.threshold.value = -8;
  limiter.knee.value = 6;
  limiter.ratio.value = 12;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.2;
  limiter.connect(ac.destination);

  if (timbre.drive) {
    const amp = ac.createWaveShaper();
    amp.curve = driveCurve(timbre.drive);
    amp.oversample = '4x';
    last.connect(amp);
    last = amp;
  }
  const tone = ac.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = timbre.lowpass;
  last.connect(tone).connect(output).connect(limiter);

  if (timbre.echo) {
    const delay = ac.createDelay(1);
    const feedback = ac.createGain();
    const wet = ac.createGain();
    delay.delayTime.value = timbre.echo.time;
    feedback.gain.value = timbre.echo.feedback;
    wet.gain.value = timbre.echo.mix;
    output.connect(delay);
    delay.connect(feedback).connect(delay);
    delay.connect(wet).connect(limiter);
    echo = wet;
  }
  return { input, output, echo };
}

let current = null;

/** Stops whatever the guitar is playing right now. */
export function stopGuitar() {
  if (!current) return;
  const { ac, rig, sources, timer } = current;
  current = null;
  clearTimeout(timer);
  const now = ac.currentTime;
  const outs = [rig.output, rig.echo].filter(Boolean);
  for (const { gain } of outs) {
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(gain.value, now);
    gain.linearRampToValueAtTime(0, now + 0.08);
  }
  for (const source of sources) {
    try { source.stop(now + 0.1); } catch { /* already finished */ }
  }
  setTimeout(() => outs.forEach((node) => node.disconnect()), 400);
}

// Recordings are decoded once; a missing file is remembered as null so the
// tune falls back to the synth without asking the server again
const recordings = new Map();

function loadRecording(ac, url) {
  if (!recordings.has(url)) {
    recordings.set(url, fetch(url)
      .then((res) => (res.ok ? res.arrayBuffer() : null))
      .then((data) => (data ? ac.decodeAudioData(data) : null))
      .catch(() => null));
  }
  return recordings.get(url);
}

/** Plays a recorded clip, at most `clip` seconds long, fading out at the end. */
function playRecording(ac, buffer, clip, onEnd) {
  const length = Math.min(buffer.duration, clip || Infinity);
  const output = ac.createGain();
  output.connect(ac.destination);
  const now = ac.currentTime;
  output.gain.setValueAtTime(1, now + Math.max(0, length - 1.5));
  output.gain.linearRampToValueAtTime(0, now + length);
  const source = ac.createBufferSource();
  source.buffer = buffer;
  source.connect(output);
  source.start(now);
  source.stop(now + length + 0.05);
  const player = { ac, rig: { output }, sources: [source] };
  player.timer = setTimeout(() => {
    if (current !== player) return;
    stopGuitar();
    onEnd?.();
  }, length * 1000 + 80);
  current = player;
}

/**
 * Plays a tune ({ bpm, voices, ring?, audio?, clip? }) on a guitar timbre.
 * A tune with `audio` plays that recording instead when the file is there,
 * otherwise its voices. Anything already playing stops first. `onEnd` is
 * called when the tune finishes by itself.
 */
export function playTune(tune, timbre, onEnd) {
  stopGuitar();
  const ac = ensureAudio();
  if (!ac) return;

  if (tune.audio) {
    // hold the slot so a tap on another tune while loading wins
    const pending = { ac, rig: {}, sources: [] };
    current = pending;
    loadRecording(ac, tune.audio).then((buffer) => {
      if (current !== pending) return;
      current = null;
      if (buffer) playRecording(ac, buffer, tune.clip, onEnd);
      else playTune({ ...tune, audio: null }, timbre, onEnd);
    });
    return;
  }

  const voices = tune.voices.map((text) => parseVoice(text, tune.bpm || 100));
  const rig = buildRig(ac, timbre);
  const sources = [];
  const start = ac.currentTime + 0.08;

  for (const { events } of voices) {
    for (const event of events) {
      const seconds = event.mute ? 0.15 : Math.max(event.len, tune.ring || 0);
      const sound = event.mute ? { ...timbre, sustain: 0.18, smooth: timbre.smooth + 1 } : timbre;
      event.notes.forEach((note, i) => {
        const at = start + event.time + i * timbre.strum;
        const buffer = pluck(ac, note, seconds, sound);
        const detunes = timbre.double ? [1, timbre.double] : [1];
        for (const detune of detunes) {
          const source = ac.createBufferSource();
          source.buffer = buffer;
          if (event.bend) {
            source.playbackRate.setValueAtTime(detune * 2 ** (-2 / 12), at);
            source.playbackRate.setValueAtTime(detune * 2 ** (-2 / 12), at + 0.06);
            source.playbackRate.linearRampToValueAtTime(detune, at + 0.22);
          } else {
            source.playbackRate.value = detune;
          }
          const gain = ac.createGain();
          gain.gain.value = (detunes.length > 1 ? 0.6 : 1) / Math.sqrt(event.notes.length);
          source.connect(gain).connect(rig.input);
          source.start(at);
          sources.push(source);
        }
      });
    }
  }

  const end = Math.max(...voices.map((voice) => voice.end));
  const tail = timbre.echo ? 1.2 : 0.4;
  const player = { ac, rig, sources };
  player.timer = setTimeout(() => {
    if (current !== player) return;
    stopGuitar();
    onEnd?.();
  }, (end + tail) * 1000 + 80);
  current = player;
}
