// A piano keyboard of one octave, C4 to C5, for the lesson about sharps,
// flats and naturals: there the black keys are the whole point, so
// it is drawn as a real keyboard. Every key plays on the piano when tapped.
//
// Keys are named by the note ids of js/data/notes.js; a black key is named
// after the white key on its left with '#' ('fa#' is F sharp, which is also
// G flat). The upper C is 'do2', as in the second octave.

import { svgEl } from './ui.js';
import { playPiano } from './piano.js';
import { NOTES, NOTE_BY_ID } from '../data/notes.js';

const WHITE = 40;
const HEIGHT = 150;
const BLACK = 24;
const BLACK_HEIGHT = 92;
// room above the keys for the arrows drawn over them
const TOP = 44;

const HALF_STEP = 2 ** (1 / 12);

const whites = [...NOTES, { ...NOTE_BY_ID.do, id: 'do2', freq: 523.25 }]
  .map((note, i) => ({ id: note.id, note, white: true, x: i * WHITE, freq: note.freq }));

// a black key after every white one but Mi and Si (and the last Do)
const blacks = whites
  .filter((key, i) => i < whites.length - 1 && !['mi', 'si'].includes(key.id))
  .map((key) => ({ id: `${key.id}#`, white: false, x: key.x + WHITE - BLACK / 2, freq: key.freq * HALF_STEP }));

export const KEYS = Object.fromEntries([...whites, ...blacks].map((key) => [key.id, key]));

/** The middle of a key across, and the height its arrows and marks sit at. */
export function keyCenter(id) {
  const key = KEYS[id];
  return { x: key.x + (key.white ? WHITE : BLACK) / 2, y: key.white ? TOP + HEIGHT - 50 : TOP + BLACK_HEIGHT - 20 };
}

/** Plays a key on the piano. */
export function playKey(id, options) {
  return playPiano(KEYS[id].freq, options);
}

/**
 * The keyboard. `lit` maps key ids to a mark: 'from' and 'to' for a note and
 * where a sign moves it. `colored` paints the
 * names on the white keys in their rainbow colours. `over` gets the SVG group
 * drawn above the keys, to add arrows at keyCenter() points.
 */
export function renderKeyboard({ lit = {}, colored = true, over = null, label = 'Клавиатура фортепиано' } = {}) {
  const width = whites.length * WHITE;
  const press = (key) => (event) => {
    const node = event.currentTarget;
    node.classList.remove('is-pressed');
    // restart the flash even on a second quick tap
    void node.getBoundingClientRect();
    node.classList.add('is-pressed');
    playPiano(key.freq);
  };
  const keyClass = (key) => `key ${key.white ? 'key--white' : 'key--black'} ${lit[key.id] ? `key--${lit[key.id]}` : ''}`;

  const whiteKeys = whites.map((key) => svgEl('g', { class: keyClass(key) },
    svgEl('rect', { x: key.x + 1, y: TOP, width: WHITE - 2, height: HEIGHT, rx: 5 }),
    svgEl('circle', {
      cx: key.x + WHITE / 2,
      cy: TOP + HEIGHT - 18,
      r: 14,
      class: 'key__dot',
      style: colored ? `fill:${key.note.color}` : null,
    }),
    svgEl('text', {
      x: key.x + WHITE / 2,
      y: TOP + HEIGHT - 18,
      class: 'key__name',
      style: colored ? `fill:${key.note.ink}` : null,
    }, key.note.ru)));
  const blackKeys = blacks.map((key) => svgEl('g', { class: keyClass(key) },
    svgEl('rect', { x: key.x, y: TOP, width: BLACK, height: BLACK_HEIGHT, rx: 3 })));

  const svg = svgEl('svg', {
    viewBox: `0 0 ${width} ${TOP + HEIGHT + 2}`,
    class: 'keyboard',
    role: 'img',
    'aria-label': label,
  }, whiteKeys, blackKeys, svgEl('g', { class: 'keyboard__over' }, over));

  // svgEl doesn't attach listeners, so the taps are wired here
  [...whites, ...blacks].forEach((key, i) => {
    const node = (i < whites.length ? whiteKeys[i] : blackKeys[i - whites.length]);
    node.addEventListener('click', press(key));
  });
  return svg;
}

/** A curved arrow over the keys, from one key to the next one. */
export function keyArrow(from, to) {
  const a = keyCenter(from);
  const b = keyCenter(to);
  // a high arch, so even an arrow to the very next key is easy to see
  const d = `M${a.x} ${TOP - 4} C${a.x} ${-4} ${b.x} ${-4} ${b.x} ${TOP - 6}`;
  return svgEl('path', { d, class: 'keyboard__arrow', 'marker-end': 'url(#key-arrowhead)' });
}

/** The arrowhead the arrows use; put it once inside `over`. */
export function arrowHead() {
  return svgEl('defs', null,
    svgEl('marker', {
      id: 'key-arrowhead', viewBox: '0 0 10 10', refX: 6, refY: 5, markerWidth: 5, markerHeight: 5, orient: 'auto-start-reverse',
    }, svgEl('path', { d: 'M0 0 L10 5 L0 10 Z', class: 'keyboard__arrowhead' })));
}
