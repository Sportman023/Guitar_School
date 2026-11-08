// Acoustic piano made of real recordings, not synthesis:
// Salamander Grand Piano (a Yamaha C5 grand) by Alexander Holm,
// licensed CC BY 3.0 — http://creativecommons.org/licenses/by/3.0/
//
// The piano was recorded every minor third, so only twelve keys — D#3 to C6 —
// are stored in audio/piano/. A note in between is the nearest recording
// played a semitone faster or slower, which is inaudible on a piano.
// The range covers every octave the app teaches: E3-B3, C4-B4 and C5-B5.
// The recordings differ in loudness (the higher, the quieter). They are
// levelled on load, so volume never hints at which note it is.

import { ensureAudio } from './audio.js';

const SAMPLES = [
  { file: 'Ds3.mp3', freq: 155.56 },
  { file: 'Fs3.mp3', freq: 185.00 },
  { file: 'A3.mp3', freq: 220.00 },
  { file: 'C4.mp3', freq: 261.63 },
  { file: 'Ds4.mp3', freq: 311.13 },
  { file: 'Fs4.mp3', freq: 369.99 },
  { file: 'A4.mp3', freq: 440.00 },
  { file: 'C5.mp3', freq: 523.25 },
  { file: 'Ds5.mp3', freq: 622.25 },
  { file: 'Fs5.mp3', freq: 739.99 },
  { file: 'A5.mp3', freq: 880.00 },
  { file: 'C6.mp3', freq: 1046.50 },
];

const BASE = new URL('../../audio/piano/', import.meta.url);
// every recording is scaled to this loudness (RMS of its first second)
const TARGET_RMS = 0.06;
// how long the string keeps sounding after the key is released, seconds
const RELEASE = 0.3;

let loading = null;

async function loadSample(ac, { file, freq }) {
  const response = await fetch(new URL(file, BASE));
  if (!response.ok) throw new Error(`${file}: ${response.status}`);
  const buffer = await ac.decodeAudioData(await response.arrayBuffer());
  return { freq, buffer, level: TARGET_RMS / loudness(buffer) };
}

// Both channels count: the recordings are stereo and the balance between
// the channels differs from key to key.
function loudness(buffer) {
  const length = Math.min(buffer.length, buffer.sampleRate);
  let sum = 0;
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < length; i++) sum += data[i] * data[i];
  }
  return Math.sqrt(sum / (length * buffer.numberOfChannels)) || TARGET_RMS;
}

/**
 * Downloads and decodes the recordings once; safe to call many times.
 * Resolves to null when they can't be loaded — then the piano stays silent
 * rather than falling back to a different sound.
 */
export function loadPiano() {
  const ac = ensureAudio();
  if (!ac) return Promise.resolve(null);
  if (!loading) {
    loading = Promise.all(SAMPLES.map((sample) => loadSample(ac, sample)))
      .catch(() => {
        // e.g. no internet on the very first run: try again next time
        loading = null;
        return null;
      });
  }
  return loading;
}

const distance = (freq, sample) => Math.abs(Math.log(freq / sample.freq));

/**
 * Presses a key. `delay` is in seconds: notes started together keep their
 * rhythm even if the recordings are still downloading. Resolves to a function
 * that lets the key go early (a rhythm stopped halfway, see core/rhythm.js).
 */
export async function playPiano(freq, { duration = 1.8, volume = 1.5, delay = 0 } = {}) {
  const samples = await loadPiano();
  const ac = ensureAudio();
  if (!samples || !ac) return () => {};

  const sample = samples.reduce((best, item) => (distance(freq, item) < distance(freq, best) ? item : best));
  const source = ac.createBufferSource();
  source.buffer = sample.buffer;
  source.playbackRate.value = freq / sample.freq;

  const start = ac.currentTime + delay;
  const end = start + duration;
  const level = volume * sample.level;
  const gain = ac.createGain();
  gain.gain.setValueAtTime(level, start);
  gain.gain.setValueAtTime(level, end);
  gain.gain.exponentialRampToValueAtTime(0.0001, end + RELEASE);

  source.connect(gain).connect(ac.destination);
  source.start(start);
  source.stop(end + RELEASE);

  return () => {
    const now = ac.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(Math.max(gain.gain.value, 0.0001), now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
    try {
      source.stop(now + 0.1);
    } catch {
      // already stopped
    }
  };
}

/** Plays the notes one by one, each key held until the next one. `step` is in seconds. */
export function playPianoScale(notes, { step = 0.4 } = {}) {
  notes.forEach((note, i) => {
    const last = i === notes.length - 1;
    playPiano(note.freq, { delay: i * step, duration: last ? 1.6 : step });
  });
}
