// Web Audio helpers: the audio context and short feedback sounds (right,
// wrong, fanfare).
//
// Notes are never synthesised — every note in the app sounds on the recorded
// piano of piano.js, so a note sounds the same wherever the child meets it.
// The only synthesised instrument is the workshop guitar (strings.js), where
// it is the child's own guitar that sounds, not a note to learn.

let ctx = null;

export function ensureAudio() {
  if (!ctx) {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    // iOS treats Web Audio as background sound and mutes it with the silent
    // switch; 'playback' makes it sound like a music app (Safari 16.4+).
    if (navigator.audioSession) navigator.audioSession.type = 'playback';
    ctx = new Ctor();
  }
  // iOS also leaves the context 'interrupted' after a call or a trip to
  // another app
  if (ctx.state !== 'running') ctx.resume();
  return ctx;
}

function blip(freq, startOffset, duration, type = 'sine', volume = 0.25) {
  const ac = ensureAudio();
  if (!ac) return;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  const start = ac.currentTime + startOffset;
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain).connect(ac.destination);
  osc.start(start);
  osc.stop(start + duration + 0.05);
}

export function playSuccess() {
  [523.25, 659.25, 783.99].forEach((f, i) => blip(f, i * 0.09, 0.22, 'triangle', 0.22));
}

export function playFail() {
  blip(196, 0, 0.25, 'sawtooth', 0.12);
  blip(155, 0.1, 0.3, 'sawtooth', 0.12);
}

export function playFanfare() {
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => blip(f, i * 0.12, 0.35, 'triangle', 0.2));
}
