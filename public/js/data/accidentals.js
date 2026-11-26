// Accidentals: the signs that move a note half a step, as the music school
// teaches them in the first year. Only the sharp, the flat and the natural for
// now; the double sharp and the double flat come later.
//
// `color` is the hint colour of the "sign and what it does" game (see
// js/modules/signs-match.js): the sign, its name and what it does share it
// while the hint is on.

export const SIGNS = [
  { id: 'sharp', glyph: '♯', name: 'диез', does: 'повышает на полтона', color: '#EF5350' },
  { id: 'flat', glyph: '♭', name: 'бемоль', does: 'понижает на полтона', color: '#42A5F5' },
  { id: 'natural', glyph: '♮', name: 'бекар', does: 'отменяет диез и бемоль', color: '#66BB6A' },
];

// The rhyme the school uses for the order of the sharps; the second line is the
// first one backwards, the order of the flats:
//   Фа, до, соль, ре, ля, ми, си — села кошка на такси.
//   Си, ми, ля, ре, соль, до, фа — в ресторан пришла она.
const SHARPS = ['fa', 'do', 'sol', 're', 'lya', 'mi', 'si'];

export const POEM = [
  { notes: SHARPS, words: 'села кошка на такси', order: 'Порядок диезов' },
  { notes: [...SHARPS].reverse(), words: 'в ресторан пришла она', order: 'Порядок бемолей' },
];
