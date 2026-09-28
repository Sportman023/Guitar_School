// Standard guitar tuning, as the music school counts the strings: the first
// is the thinnest.
//
// octave — the octave the way the school names it, i.e. as the note is
// written in guitar music. A guitar sounds an octave lower than written, so
// the first string is written as Mi of the second octave but sounds as Mi of
// the first octave.
//
// freq — the pitch the string actually sounds at (A4 = 440 Hz); this is what
// the microphone hears.

export const GUITAR_STRINGS = [
  { number: 1, ru: 'Ми',   octave: 'второй октавы', freq: 329.628 },
  { number: 2, ru: 'Си',   octave: 'первой октавы', freq: 246.942 },
  { number: 3, ru: 'Соль', octave: 'первой октавы', freq: 195.998 },
  { number: 4, ru: 'Ре',   octave: 'первой октавы', freq: 146.832 },
  { number: 5, ru: 'Ля',   octave: 'малой октавы',  freq: 110.000 },
  { number: 6, ru: 'Ми',   octave: 'малой октавы',  freq: 82.407 },
];
