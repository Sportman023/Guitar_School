// The guitar neck of the first position with the coloured stickers that the
// music school glues onto the children's guitars: every natural note of the
// first three frets on strings 1–5 gets a sticker of its rainbow colour, the
// sixth string has none. Frets with a sharp or a flat stay bare.
//
// It is drawn as on the photo of a stickered guitar from school: the nut on the
// right and the frets going left, the sixth (thickest) string on top, the first
// one at the bottom. The layout below is worked out with the nut on the left
// and turned over by `flip`, so the names on the stickers still read normally.
// Every sticker and every open string plays its note on the piano when tapped,
// at the pitch it is written in the notes (an octave above the real sound of a
// guitar), which keeps it within the piano recordings.

import { svgEl } from './ui.js';
import { playPiano } from './piano.js';
import { NOTE_BY_ID } from '../data/notes.js';

// open strings from the first to the sixth: the note and its written pitch
const STRINGS = [
  { note: 'mi', freq: 659.26 },
  { note: 'si', freq: 493.88 },
  { note: 'sol', freq: 392.0 },
  { note: 're', freq: 293.66 },
  { note: 'lya', freq: 220.0 },
  { note: 'mi', freq: 164.81 },
];
const STICKERED = 5;
const FRETS = 4;
// semitones above C of every natural note
const NATURAL = { 0: 'do', 2: 're', 4: 'mi', 5: 'fa', 7: 'sol', 9: 'lya', 11: 'si' };

const OPEN = 50;
const NUT = 7;
const FRET = 78;
const GAP = 30;
const TOP = 26;
const width = OPEN + NUT + FRET * FRETS + 6;
const height = TOP + GAP * (STRINGS.length - 1) + 34;

const stringY = (string) => TOP + GAP * (STRINGS.length - string);
const fretX = (fret) => OPEN + NUT + FRET * (fret - 1);
// the neck runs right to left: x of the picture for an x worked out left to right
const flip = (x) => width - x;

/** The note on a string (1–6) at a fret (0 is the open string), or null for a sharp or a flat. */
export function noteAt(string, fret) {
  const open = NOTE_BY_ID[STRINGS[string - 1].note];
  const id = NATURAL[(open.pc + fret) % 12];
  return id ? NOTE_BY_ID[id] : null;
}

/** Plays a string at a fret. */
export function playFret(string, fret, options) {
  return playPiano(STRINGS[string - 1].freq * 2 ** (fret / 12), options);
}

/**
 * The neck. `pairs` lists the friendly notes to mark: [string, fret] of the
 * lower note; the note a fret higher is its friend. They get a heart between
 * them, and every other sticker fades a little.
 */
export function renderNeck({ pairs = [], label = 'Гриф гитары с цветными наклейками' } = {}) {
  const marked = new Set(pairs.flatMap(([string, fret]) => [`${string}:${fret}`, `${string}:${fret + 1}`]));
  const tappable = (node, string, fret) => {
    node.addEventListener('click', () => playFret(string, fret));
    return node;
  };

  const frets = Array.from({ length: FRETS }, (_, i) => svgEl('g', null,
    svgEl('line', { x1: flip(fretX(i + 2)), y1: TOP - 12, x2: flip(fretX(i + 2)), y2: stringY(1) + 12, class: 'neck__fret' }),
    svgEl('text', { x: flip(fretX(i + 1) + FRET / 2), y: height - 4, class: 'neck__number' }, `${i + 1}`)));

  const stickers = [];
  for (let string = 1; string <= STICKERED; string++) {
    for (let fret = 1; fret <= FRETS - 1; fret++) {
      const note = noteAt(string, fret);
      if (!note) continue;
      const faded = marked.size && !marked.has(`${string}:${fret}`);
      stickers.push(tappable(svgEl('g', { class: `neck__sticker ${faded ? 'is-faded' : ''}` },
        svgEl('rect', {
          x: flip(fretX(fret) + FRET - 5), y: stringY(string) - 11, width: FRET - 10, height: 22, rx: 6,
          style: `fill:${note.color}`,
        }),
        svgEl('text', { x: flip(fretX(fret) + FRET / 2), y: stringY(string), class: 'neck__name', style: `fill:${note.ink}` }, note.ru)),
      string, fret));
    }
  }

  // the open strings: a circle with the note beyond the nut
  const opens = STRINGS.map((open, i) => {
    const string = i + 1;
    const note = NOTE_BY_ID[open.note];
    const faded = marked.size && !marked.has(`${string}:0`);
    return tappable(svgEl('g', { class: `neck__open ${faded ? 'is-faded' : ''}` },
      svgEl('circle', { cx: flip(OPEN / 2), cy: stringY(string), r: 14, style: `fill:${note.color}` }),
      svgEl('text', { x: flip(OPEN / 2), y: stringY(string), class: 'neck__name neck__name--open', style: `fill:${note.ink}` }, note.ru)),
    string, 0);
  });

  const strings = STRINGS.map((_, i) => svgEl('line', {
    x1: flip(OPEN + NUT), y1: stringY(i + 1), x2: 0, y2: stringY(i + 1),
    class: 'neck__string',
    style: `stroke-width:${1 + i * 0.45}`,
  }));

  // a heart between the two friends; at the nut it sits on the nut itself
  const hearts = pairs.map(([string, fret]) => svgEl('text', {
    x: flip(fret === 0 ? OPEN + NUT / 2 : fretX(fret + 1)),
    y: stringY(string),
    class: 'neck__heart',
  }, '💛'));

  return svgEl('svg', { viewBox: `0 0 ${width} ${height}`, class: 'neck', role: 'img', 'aria-label': label },
    svgEl('rect', { x: 0, y: TOP - 14, width: width - OPEN - NUT, height: stringY(1) - TOP + 28, rx: 4, class: 'neck__board' }),
    svgEl('rect', { x: flip(OPEN + NUT), y: TOP - 16, width: NUT, height: stringY(1) - TOP + 32, rx: 2, class: 'neck__nut' }),
    // stickers over the strings, so the names on them stay readable
    frets, strings, stickers, opens, hearts);
}
