// Standard guitar tuning, as the music school counts the strings: the first
// is the thinnest. A guitar sounds an octave lower than written, so the first
// string is Mi of the first octave and the sixth is Mi of the great octave.
//
// freq — the exact pitch the string is tuned to (A4 = 440 Hz).

export const GUITAR_STRINGS = [
  { number: 1, ru: 'Ми',   octave: 'первой октавы', freq: 329.628 },
  { number: 2, ru: 'Си',   octave: 'малой октавы',  freq: 246.942 },
  { number: 3, ru: 'Соль', octave: 'малой октавы',  freq: 195.998 },
  { number: 4, ru: 'Ре',   octave: 'малой октавы',  freq: 146.832 },
  { number: 5, ru: 'Ля',   octave: 'большой октавы', freq: 110.000 },
  { number: 6, ru: 'Ми',   octave: 'большой октавы', freq: 82.407 },
];
