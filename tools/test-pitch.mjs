// Checks the tuner's pitch detection (public/js/core/pitch.js) on synthetic
// plucked strings: every string of the guitar, out of tune up to half an
// octave either way, at the moment of the pluck and while it rings out, with
// a weak fundamental (a phone microphone and a low string), stretched
// overtones of a real string, room noise and mains hum.
//
// Part one checks single frames, part two plays whole plucks frame by frame
// through PitchTracker, the way the tuner screen sees them, re-plucking the
// string after the peg has been turned.
// Run: npm run test:pitch
import { detectAround, centsOff, bandFor, PitchTracker, RANGE, HUM, HUM_Q } from '../public/js/core/pitch.js';
import { GUITAR_STRINGS } from '../public/js/data/tuning.js';

const RATES = [44100, 48000];
const SIZE = 4096;

// repeatable random numbers, so a failure can be reproduced
let seed = 12345;
function random() {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 2 ** 32;
}
const gauss = () => Math.sqrt(-2 * Math.log(random() || 1e-9)) * Math.cos(2 * Math.PI * random());

/**
 * A Butterworth biquad by the formulas Web Audio's BiquadFilterNode uses, run
 * over the whole sound from its start, as the browser does.
 */
function biquad(buf, type, freq, rate, q = Math.SQRT1_2) {
  const w0 = (2 * Math.PI * freq) / rate;
  const alpha = Math.sin(w0) / (2 * q);
  const cos = Math.cos(w0);
  const [b0, b1, b2] = {
    lowpass: [(1 - cos) / 2, 1 - cos, (1 - cos) / 2],
    highpass: [(1 + cos) / 2, -(1 + cos), (1 + cos) / 2],
    notch: [1, -2 * cos, 1],
  }[type];
  const [a0, a1, a2] = [1 + alpha, -2 * cos, 1 - alpha];
  const out = new Float32Array(buf.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < buf.length; i++) {
    const y = (b0 * buf[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = buf[i]; y2 = y1; y1 = y;
    out[i] = y;
  }
  return out;
}

/** The microphone signal through the tuner's band filter. */
function filtered(signal, rate, target) {
  const band = bandFor(target);
  let out = biquad(biquad(signal, 'highpass', band.highpass, rate), 'lowpass', band.lowpass, rate);
  for (const freq of HUM) out = biquad(out, 'notch', freq, rate, HUM_Q);
  return out;
}

/**
 * A plucked string heard from a phone lying next to the guitar, `seconds`
 * long: decaying overtones with random phases, peaking at 0.2.
 */
function pluck(freq, rate, seconds, { fundamental = 1, stretch = 0 }) {
  const length = Math.round(seconds * rate);
  const buf = new Float32Array(length);
  const partials = [];
  for (let n = 1; n <= 16; n++) {
    const f = n * freq * Math.sqrt(1 + stretch * n * n);
    if (f > rate / 2.2) break;
    const amp = (n === 1 ? fundamental : 1 / n ** 0.9) * (0.7 + 0.6 * random());
    partials.push({ f, amp, phase: random() * 2 * Math.PI, decay: 0.6 + n * 0.5 });
  }
  let peak = 0;
  for (let i = 0; i < length; i++) {
    const t = i / rate;
    // a few milliseconds of attack at the very start
    const attack = Math.min(1, t / 0.004);
    let s = 0;
    for (const p of partials) s += p.amp * Math.exp(-p.decay * t) * Math.sin(2 * Math.PI * p.f * t + p.phase);
    buf[i] = s * attack;
    peak = Math.max(peak, Math.abs(buf[i]));
  }
  for (let i = 0; i < length; i++) buf[i] *= 0.2 / (peak || 1);
  return buf;
}

/** Room noise and mains hum on top of the sound; they don't fade with the string. */
function room(buf, rate, { noise = 0, hum = 0 }) {
  for (let i = 0; i < buf.length; i++) buf[i] += noise * gauss() + hum * Math.sin((2 * Math.PI * 50 * i) / rate);
  return buf;
}

const CASES = [
  { name: 'чистая струна', opts: {}, limit: 1 },
  { name: 'слабый основной тон', opts: { fundamental: 0.05 }, limit: 1 },
  { name: 'растянутые обертоны', opts: { stretch: 0.0001 }, limit: 3 },
  { name: 'шум в комнате', opts: { noise: 0.005 }, limit: 3 },
  { name: 'сильный гул сети 50 Гц', opts: { hum: 0.02 }, limit: 3 },
  { name: 'всё сразу', opts: { fundamental: 0.1, stretch: 0.0001, noise: 0.005, hum: 0.01 }, limit: 5 },
];

let failures = 0;
const fail = (text) => {
  failures++;
  console.log(`  ✗ ${text}`);
};

// ---------- Single frames while the string rings ----------

console.log('Отдельные кадры:');
const MOMENTS = [0.02, 0.3, 0.8];
const ATTACK = 1.5;
const DETUNES = [-500, -300, -120, -40, -8, 0, 3, 15, 60, 200, 450, 500];
let frames = 0;

for (const { name, opts, limit } of CASES) {
  let worst = 0;
  let missed = 0;
  let faded = 0;
  for (const rate of RATES) {
    for (const string of GUITAR_STRINGS) {
      for (const detune of DETUNES) {
        const freq = string.freq * 2 ** (detune / 1200);
        const sound = filtered(room(pluck(freq, rate, 0.8 + SIZE / rate, opts), rate, opts), rate, string.freq);
        for (const at of MOMENTS) {
          const start = Math.round(at * rate);
          const result = detectAround(sound.subarray(start, start + SIZE), rate, string.freq);
          frames++;
          if (!result) {
            // a fading string may drop a frame (the tracker holds the value),
            // a fresh pluck may not
            if (at < 0.5) missed++;
            else faded++;
            continue;
          }
          const error = Math.abs(centsOff(result.freq, freq));
          worst = Math.max(worst, error);
          // in the first frame the filters have not settled after the pluck yet
          if (error > limit + (at < 0.1 ? ATTACK : 0)) fail(`${name}: струна ${string.number}, ${detune} ц, ${rate} Гц, ${at} с — ошибка ${error.toFixed(1)} ц`);
        }
      }
    }
  }
  if (missed) fail(`${name}: не услышано ${missed} кадров сразу после щипка`);
  console.log(`${missed || worst > limit + ATTACK ? '✗' : '✓'} ${name}: худшая ошибка ${worst.toFixed(2)} ц (допуск ${limit}, в первом кадре ${limit + ATTACK})${faded ? `, пропущено затухающих кадров: ${faded}` : ''}`);
}

// Sounds that are not the string being tuned must not pass for it.
let falses = 0;
let checks = 0;
for (const rate of RATES) {
  for (const string of GUITAR_STRINGS) {
    // silence with room noise only
    const hiss = filtered(room(new Float32Array(SIZE * 2), rate, { noise: 0.01 }), rate, string.freq);
    const result = detectAround(hiss.subarray(SIZE), rate, string.freq);
    checks++;
    if (result) {
      falses++;
      fail(`шум принят за ноту ${result.freq.toFixed(1)} Гц (струна ${string.number})`);
    }
    // a string an octave away: must be silent or clearly far off, never "in tune"
    for (const factor of [0.5, 2, 4]) {
      const sound = filtered(pluck(string.freq * factor, rate, 0.3 + SIZE / rate, {}), rate, string.freq);
      const other = detectAround(sound.subarray(sound.length - SIZE), rate, string.freq);
      checks++;
      if (other && Math.abs(centsOff(other.freq, string.freq)) < 100) {
        falses++;
        fail(`струна ${string.number}: звук ×${factor} показан как ${centsOff(other.freq, string.freq).toFixed(0)} ц`);
      }
    }
  }
}
console.log(`${falses ? '✗' : '✓'} посторонние звуки: ложных срабатываний ${falses} из ${checks}`);

// A string tightened past the range must never read as a slack one: the
// tuner would then say "tighten" and the string could snap.
let wrongWay = 0;
for (const { name, opts } of CASES) {
  for (const rate of RATES) {
    for (const string of GUITAR_STRINGS) {
      for (const detune of [600, 700, 900, 1100]) {
        const sound = filtered(room(pluck(string.freq * 2 ** (detune / 1200), rate, 0.8 + SIZE / rate, opts), rate, opts), rate, string.freq);
        for (const at of MOMENTS) {
          const start = Math.round(at * rate);
          const result = detectAround(sound.subarray(start, start + SIZE), rate, string.freq);
          checks++;
          if (result && centsOff(result.freq, string.freq) < 0) {
            wrongWay++;
            fail(`${name}: струна ${string.number} перетянута на ${detune} ц, а показано ${centsOff(result.freq, string.freq).toFixed(0)} ц`);
          }
        }
      }
    }
  }
}
console.log(`${wrongWay ? '✗' : '✓'} перетянутая струна ни разу не показана слабой`);

// ---------- Whole plucks, as the tuner screen sees them ----------

console.log('\nЩипок целиком, кадр за кадром:');
// how often the screen analyses a frame, s
const STEP = 0.05;
// the string is plucked, rings out, the peg is turned and it is plucked again
const FIRST = 2.5;
const SECOND = 2.5;
// the value on screen may lag behind a new pluck this long, s
const LAG = 0.3;
const PAIRS = [[-500, -150], [-150, -20], [-20, 4], [0, 0], [30, 8], [300, 60], [500, 120]];
let sequences = 0;

for (const { name, opts, limit } of CASES) {
  let worst = 0;
  let slow = 0;
  let blank = 0;
  for (const string of GUITAR_STRINGS) {
    PAIRS.forEach(([one, two], index) => {
      const rate = RATES[index % RATES.length];
      const freqs = [one, two].map((detune) => string.freq * 2 ** (detune / 1200));
      const signal = new Float32Array(Math.round((FIRST + SECOND) * rate));
      signal.set(pluck(freqs[0], rate, FIRST, opts));
      signal.set(pluck(freqs[1], rate, SECOND, opts), Math.round(FIRST * rate));
      const sound = filtered(room(signal, rate, opts), rate, string.freq);

      const tracker = new PitchTracker(string.freq);
      let firstShown = [null, null];
      sequences++;
      for (let t = STEP; t * rate + SIZE <= sound.length; t += STEP) {
        const end = Math.round(t * rate);
        const frame = sound.subarray(Math.max(0, end - SIZE), end);
        if (frame.length < SIZE) continue;
        const level = Math.sqrt(frame.reduce((sum, x) => sum + x * x, 0) / SIZE);
        const shown = tracker.push(t * 1000, level, detectAround(frame, rate, string.freq));

        const part = t < FIRST ? 0 : 1;
        const since = t - (part ? FIRST : 0);
        if (shown === null) {
          // silence on screen is fine only while the string is fading out
          if (since > LAG && since < 1.5) blank++;
          continue;
        }
        if (firstShown[part] === null && (part === 0 || since > LAG || Math.abs(shown - [one, two][1]) <= limit)) {
          firstShown[part] = since;
        }
        // right after the second pluck the screen may still show the first one
        const allowed = part && since <= LAG ? [one, two] : [[one, two][part]];
        const error = Math.min(...allowed.map((detune) => Math.abs(shown - detune)));
        worst = Math.max(worst, error);
        if (error > limit) {
          fail(`${name}: струна ${string.number}, ${[one, two][part]} ц, ${since.toFixed(2)} с после щипка — на экране ${shown.toFixed(1)} ц`);
        }
      }
      if (firstShown.some((since) => since === null || since > LAG)) slow++;
    });
  }
  if (slow) fail(`${name}: ${slow} раз показание появилось позже ${LAG} с`);
  if (blank) fail(`${name}: ${blank} кадров без показаний, пока струна звучит`);
  console.log(`${slow || blank || worst > limit ? '✗' : '✓'} ${name}: худшая ошибка на экране ${worst.toFixed(2)} ц (допуск ${limit})`);
}

console.log(`\nДиапазон поиска: ±${(1200 * Math.log2(RANGE)).toFixed(0)} центов. Кадров: ${frames + checks}, щипков: ${sequences * 2}.`);
if (failures) {
  console.log(`\nПровалено: ${failures}`);
  process.exit(1);
}
console.log('\nВсё верно.');
