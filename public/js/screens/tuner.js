// Guitar tuner in the workshop, meant for a grown-up tuning the child's
// guitar: pick a string, pluck it, and the screen says whether to tighten or
// loosen it. Only the microphone is used, nothing is played.
//
// Pitch detection and smoothing live in core/pitch.js and are checked by
// tools/test-pitch.mjs; this file is the microphone and the screen.

import { el, clear, mount } from '../core/ui.js';
import { detectAround, rms, bandFor, PitchTracker, HUM, HUM_Q } from '../core/pitch.js';
import { GUITAR_STRINGS } from '../data/tuning.js';

/** Closer than this, in cents, the string is in tune. */
const IN_TUNE = 5;
/** Closer than this it needs just a little turn of the peg. */
const NEAR = 25;
/** Higher than this it is too tight: a warning before it snaps. */
const TOO_TIGHT = 100;
/** How long the string has to stay in tune to get its tick, ms. */
const HOLD_IN_TUNE = 1000;
/** How often a frame is analysed, ms (tools/test-pitch.mjs checks the same step). */
const STEP = 50;

const ERRORS = {
  NotAllowedError: 'Нет доступа к микрофону. Разреши его для этого сайта в настройках браузера и нажми «Включить микрофон» ещё раз.',
  SecurityError: 'Нет доступа к микрофону. Разреши его для этого сайта в настройках браузера и нажми «Включить микрофон» ещё раз.',
  NotFoundError: 'Микрофон не найден.',
  OverconstrainedError: 'Микрофон не найден.',
  NotReadableError: 'Микрофон занят другим приложением. Закрой его и попробуй ещё раз.',
  AudioStartError: 'Браузер не дал включить звук. Нажми «Включить микрофон» ещё раз.',
};

/** "+3 цента", "−12 центов", "+301 цент". */
function centsLabel(cents) {
  const value = Math.abs(Math.round(cents));
  const sign = value === 0 ? '' : cents > 0 ? '+' : '−';
  const last = value % 10;
  const teen = value % 100 >= 11 && value % 100 <= 14;
  const word = !teen && last === 1 ? 'цент' : !teen && last >= 2 && last <= 4 ? 'цента' : 'центов';
  return `${sign}${value} ${word}`;
}

/** Resolves true once the context runs, false if it hasn't within the time. */
function running(ctx, ms = 1500) {
  return Promise.race([
    ctx.resume().then(() => ctx.state === 'running', () => false),
    new Promise((resolve) => setTimeout(() => resolve(ctx.state === 'running'), ms)),
  ]);
}

/**
 * The microphone through the band filter of one string. Resolves to an object
 * with read() for the latest frame, retune() and stop().
 */
async function openMicrophone(target, ctxFromTap) {
  let ctx = ctxFromTap;
  let stream = null;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      // the voice processing phones apply for calls distorts a musical note
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });

    // A context at another sample rate than the microphone distorts the pitch
    // on some iPhones and refuses to connect in Firefox, so it is made again
    // at the microphone's rate.
    // If the new one won't start, the one made in the tap stays.
    const micRate = stream.getAudioTracks()[0].getSettings().sampleRate;
    if (micRate && micRate !== ctx.sampleRate) {
      let matching = null;
      try {
        matching = new AudioContext({ sampleRate: micRate });
      } catch {
        // the browser can't: stay with the context there is
      }
      if (matching && (await running(matching))) {
        ctx.close().catch(() => {});
        ctx = matching;
      } else if (matching) {
        matching.close().catch(() => {});
      }
    }
    if (!(await running(ctx))) throw Object.assign(new Error('Audio does not start'), { name: 'AudioStartError' });

    const source = ctx.createMediaStreamSource(stream);
    const band = bandFor(target);
    const highpass = new BiquadFilterNode(ctx, { type: 'highpass', frequency: band.highpass, Q: -3.01 });
    const lowpass = new BiquadFilterNode(ctx, { type: 'lowpass', frequency: band.lowpass, Q: -3.01 });
    const notches = HUM.map((frequency) => new BiquadFilterNode(ctx, { type: 'notch', frequency, Q: HUM_Q }));
    // two periods of the lowest note have to fit in a frame: 4096 samples at
    // 44.1 and 48 kHz, more at higher rates
    const analyser = new AnalyserNode(ctx, { fftSize: ctx.sampleRate > 50000 ? 8192 : 4096 });
    // some browsers only run a graph that ends at the speakers; it stays silent
    const mute = new GainNode(ctx, { gain: 0 });
    [source, highpass, lowpass, ...notches, analyser, mute, ctx.destination]
      .reduce((from, to) => from.connect(to));

    const frame = new Float32Array(analyser.fftSize);
    return {
      ctx,
      track: stream.getAudioTracks()[0],
      read() {
        analyser.getFloatTimeDomainData(frame);
        return frame;
      },
      retune(freq) {
        const next = bandFor(freq);
        highpass.frequency.value = next.highpass;
        lowpass.frequency.value = next.lowpass;
      },
      stop() {
        stream.getTracks().forEach((track) => track.stop());
        ctx.close().catch(() => {});
      },
    };
  } catch (error) {
    if (stream) stream.getTracks().forEach((track) => track.stop());
    ctx.close().catch(() => {});
    throw error;
  }
}

export default {
  id: 'tuner',
  title: 'Настройка гитары',
  // the back arrow leads to the workshop
  parent: 'guitar',

  mount(root) {
    const screen = el('div', { class: 'screen tuner' });
    root.append(screen);

    let string = GUITAR_STRINGS[GUITAR_STRINGS.length - 1];
    let tracker = new PitchTracker(string.freq);
    let mic = null;
    let starting = false;
    let timer = null;
    let wakeLock = null;
    let message = '';
    let cents = null;
    let inTuneSince = null;
    const tuned = new Set();

    const stage = el('div', { class: 'tuner__stage' });
    const strings = el('div', { class: 'tuner__strings', role: 'radiogroup', 'aria-label': 'Струна' });
    const controls = el('div', { class: 'tuner__controls' });

    function verdict() {
      if (!mic) return { text: 'Выбери струну и включи микрофон', tone: 'idle' };
      if (cents === null) return { text: `Дёрни ${string.number}-ю струну`, tone: 'idle' };
      if (Math.abs(cents) <= IN_TUNE) return { text: 'Точно! ✓', tone: 'ok' };
      if (cents > TOO_TIGHT) return { text: 'Слишком туго — ослабь, а то порвётся!', tone: 'danger' };
      if (cents > 0) return { text: cents <= NEAR ? 'Чуть-чуть ослабь ↓' : 'Ослабь струну ↓', tone: 'adjust' };
      return { text: cents >= -NEAR ? 'Чуть-чуть натяни ↑' : 'Натяни струну ↑', tone: 'adjust' };
    }

    function renderStage() {
      const { text, tone } = verdict();
      // the needle stops at the edge of the scale, the words still say how far
      const shown = cents === null ? 0 : Math.max(-50, Math.min(50, cents));
      clear(stage);
      mount(stage,
        el('div', { class: 'tuner__target' },
          el('span', { class: 'tuner__number' }, string.number),
          el('span', null, `${string.ru} ${string.octave}`)),
        el('div', { class: `tuner__verdict tuner__verdict--${tone}`, role: 'status', 'aria-live': 'polite' }, text),
        el('div', { class: `tuner__meter ${cents === null ? 'tuner__meter--idle' : ''}` },
          el('div', { class: 'tuner__zone' }),
          el('div', { class: 'tuner__mark' }),
          el('div', { class: `tuner__needle tuner__needle--${tone}`, style: `left:${50 + shown}%` })),
        el('div', { class: 'tuner__scale' },
          el('span', null, 'ниже'),
          el('span', null, cents === null ? ' ' : centsLabel(cents)),
          el('span', null, 'выше')),
      );
    }

    function renderStrings() {
      clear(strings);
      // as the strings lie on the fretboard seen by the one tuning: the thick one first
      mount(strings, [...GUITAR_STRINGS].reverse().map((item) => el('button', {
        class: [
          'tuner__string',
          item === string ? 'tuner__string--on' : '',
          tuned.has(item.number) ? 'tuner__string--done' : '',
        ].join(' ').trim(),
        type: 'button',
        role: 'radio',
        'aria-checked': String(item === string),
        'aria-label': `${item.number}-я струна, ${item.ru}${tuned.has(item.number) ? ', настроена' : ''}`,
        onclick: () => pick(item),
      },
        el('span', { class: 'tuner__string-number' }, item.number),
        el('span', { class: 'tuner__string-name' }, item.ru),
        tuned.has(item.number) ? el('span', { class: 'tuner__tick' }, '✓') : null,
      )));
    }

    function renderControls() {
      clear(controls);
      mount(controls,
        el('button', {
          class: `btn ${mic ? '' : 'btn--primary'}`,
          type: 'button',
          disabled: starting,
          onclick: () => (mic ? stop() : start()),
        }, mic ? '⏹ Выключить микрофон' : starting ? 'Включаю…' : '🎤 Включить микрофон'),
        message ? el('p', { class: 'tuner__message' }, message) : null,
        el('p', { class: 'tuner__hint' },
          'Положи телефон рядом с гитарой, в тихой комнате. Дёрни выбранную струну и поворачивай её колок, пока не загорится «Точно!». Потом — следующую струну.'),
      );
    }

    function pick(item) {
      if (item === string) return;
      string = item;
      tracker = new PitchTracker(string.freq);
      cents = null;
      inTuneSince = null;
      if (mic) mic.retune(string.freq);
      renderStrings();
      renderStage();
    }

    function listen() {
      // after a call or another app iOS pauses the audio: frames would be silence
      if (mic.ctx.state !== 'running') {
        stop();
        message = 'Тюнер остановился. Нажми «Включить микрофон», чтобы продолжить.';
        renderControls();
        return;
      }
      const frame = mic.read();
      const now = performance.now();
      cents = tracker.push(now, rms(frame), detectAround(frame, mic.ctx.sampleRate, string.freq));

      if (cents !== null && Math.abs(cents) <= IN_TUNE) {
        if (inTuneSince === null) inTuneSince = now;
        if (now - inTuneSince >= HOLD_IN_TUNE && !tuned.has(string.number)) {
          tuned.add(string.number);
          renderStrings();
        }
      } else {
        inTuneSince = null;
      }
      renderStage();
    }

    async function start() {
      if (mic || starting) return;
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.AudioContext) {
        message = 'Этот браузер не даёт приложению слушать микрофон. Открой приложение в Safari или Chrome.';
        renderControls();
        return;
      }
      // the context is made right in the tap: later on, iOS would not let it sound
      const ctx = new AudioContext();
      starting = true;
      message = '';
      renderControls();
      // iOS turns the microphone off in the "playback" session the rest of the app uses
      if (navigator.audioSession) navigator.audioSession.type = 'play-and-record';
      try {
        mic = await openMicrophone(string.freq, ctx);
      } catch (error) {
        if (navigator.audioSession) navigator.audioSession.type = 'playback';
        message = ERRORS[error && error.name] || 'Не получилось включить микрофон. Попробуй ещё раз.';
      }
      starting = false;
      // the screen was left while the browser was asking about the microphone
      if (mic && !screen.isConnected) {
        stop();
        return;
      }
      if (mic) {
        mic.track.addEventListener('ended', () => {
          stop();
          message = 'Микрофон выключился. Нажми «Включить микрофон», чтобы продолжить.';
          renderControls();
        });
        tracker = new PitchTracker(string.freq);
        timer = setInterval(listen, STEP);
        // the screen must not go dark while both hands are on the pegs
        if (navigator.wakeLock) navigator.wakeLock.request('screen').then((lock) => { wakeLock = lock; }).catch(() => {});
      }
      renderControls();
      renderStage();
    }

    function stop() {
      clearInterval(timer);
      timer = null;
      if (mic) mic.stop();
      mic = null;
      cents = null;
      inTuneSince = null;
      if (wakeLock) wakeLock.release().catch(() => {});
      wakeLock = null;
      if (navigator.audioSession) navigator.audioSession.type = 'playback';
      renderControls();
      renderStage();
    }

    // a phone that is put away stops listening; the button brings it back
    function onVisibility() {
      if (document.hidden && mic) stop();
    }
    document.addEventListener('visibilitychange', onVisibility);

    mount(screen, stage, strings, controls);
    renderStage();
    renderStrings();
    renderControls();

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      stop();
    };
  },
};
