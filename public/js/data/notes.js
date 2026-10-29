// Seven notes = the seven colours of the rainbow, in order:
//   C — red        G — light blue
//   D — orange     A — blue
//   E — yellow     B — violet
//   F — green
// Russian children learn the colour order with a mnemonic rhyme whose words
// start with the same letters as the colours. The app shows solfège names
// (the `ru` field), because that's what the music school uses.
//
// staff — the note's position on a treble clef staff, counted in half-steps
// from the first (bottom) line: 0 — on the first line, +1 — the space above
// it, -1 — below it. All seven notes here are the first octave (octave: 1);
// the octaves around it are described below: NOTES_0 under the staff and
// NOTES_2 above it.
//
// pc (pitch class) — semitones above C within the octave: C 0, D 2, E 4, F 5,
// G 7, A 9, B 11. The same note name in another octave has the same pc.
//
// To change a colour, a hint or add information, edit this file —
// the rest of the app picks the changes up by itself.

export const NOTES = [
  { id: 'do',   ru: 'До',  en: 'C', pc: 0,  color: '#E53935', ink: '#ffffff', colorName: 'Красный', octave: 1, freq: 261.63, staff: -2, staffPlace: 'на первой добавочной линеечке под станом' },
  { id: 're',   ru: 'Ре',  en: 'D', pc: 2,  color: '#FB8C00', ink: '#ffffff', colorName: 'Оранжевый', octave: 1, freq: 293.66, staff: -1, staffPlace: 'под первой линейкой' },
  { id: 'mi',   ru: 'Ми',  en: 'E', pc: 4,  color: '#FDD835', ink: '#5a4600', colorName: 'Жёлтый', octave: 1, freq: 329.63, staff: 0, staffPlace: 'на первой линейке' },
  { id: 'fa',   ru: 'Фа',  en: 'F', pc: 5,  color: '#43A047', ink: '#ffffff', colorName: 'Зелёный', octave: 1, freq: 349.23, staff: 1, staffPlace: 'между 1-й и 2-й линейками' },
  { id: 'sol',  ru: 'Соль',en: 'G', pc: 7,  color: '#29B6F6', ink: '#073b57', colorName: 'Голубой', octave: 1, freq: 392.00, staff: 2, staffPlace: 'на второй линейке' },
  { id: 'lya',  ru: 'Ля',  en: 'A', pc: 9,  color: '#3949AB', ink: '#ffffff', colorName: 'Синий', octave: 1, freq: 440.00, staff: 3, staffPlace: 'между 2-й и 3-й линейками' },
  { id: 'si',   ru: 'Си',  en: 'B', pc: 11, color: '#8E24AA', ink: '#ffffff', colorName: 'Фиолетовый', octave: 1, freq: 493.88, staff: 4, staffPlace: 'на третьей линейке' },
];

export const NOTE_BY_ID = Object.fromEntries(NOTES.map((n) => [n.id, n]));

// ---------- The other octaves ----------
//
// Name, colour and pc are the same in every octave, so they are taken from the
// first one (the `base` field). Only the place on the staff differs, and the
// pitch: an octave higher sounds twice as fast, an octave lower — half as fast.
// The id carries the octave number ("do2"), the first octave keeps the bare
// name ("do").

const transposed = (places, { octave, ratio }) => places.map(({ base, ...place }) => {
  const first = NOTE_BY_ID[base];
  return { ...first, ...place, id: `${base}${octave}`, octave, freq: Math.round(first.freq * ratio * 100) / 100 };
});

// ---------- Small octave ----------
//
// The octave below the first one — number 0 in the app, because the octaves
// under it (большая, контроктава) would carry on into the minus. It hangs
// below the staff on ledger lines: the first ledger line is the one C4 sits
// on, the second belongs to A3, the third to F3.
//
// Only E–B for now: that's the part of the octave the school starts with.

const SMALL_OCTAVE = [
  { base: 'mi',  staff: -7, staffPlace: 'под третьей добавочной линеечкой' },
  { base: 'fa',  staff: -6, staffPlace: 'на третьей добавочной линеечке' },
  { base: 'sol', staff: -5, staffPlace: 'под второй добавочной линеечкой' },
  { base: 'lya', staff: -4, staffPlace: 'на второй добавочной линеечке' },
  { base: 'si',  staff: -3, staffPlace: 'под первой добавочной линеечкой' },
];

export const NOTES_0 = transposed(SMALL_OCTAVE, { octave: 0, ratio: 0.5 });

// ---------- Second octave ----------
//
// All seven notes, C5–B5. The last two climb above the staff, onto a ledger
// line of their own — the mirror image of the small octave below it.

const SECOND_OCTAVE = [
  { base: 'do',  staff: 5,  staffPlace: 'между 3-й и 4-й линейками' },
  { base: 're',  staff: 6,  staffPlace: 'на четвёртой линейке' },
  { base: 'mi',  staff: 7,  staffPlace: 'между 4-й и 5-й линейками' },
  { base: 'fa',  staff: 8,  staffPlace: 'на пятой линейке' },
  { base: 'sol', staff: 9,  staffPlace: 'над пятой линейкой' },
  { base: 'lya', staff: 10, staffPlace: 'на добавочной линеечке над станом' },
  { base: 'si',  staff: 11, staffPlace: 'над добавочной линеечкой' },
];

export const NOTES_2 = transposed(SECOND_OCTAVE, { octave: 2, ratio: 2 });

// ---------- Octaves ----------
//
// Every octave the app teaches, low to high. `name` follows a note name as
// said in class ("До 2 октавы"); `short` is the octave on its own, e.g. on the
// chips that pick octaves for the staff games. A new octave is one more entry
// here: the octave ladder and the staff games pick it up by themselves.

export const OCTAVES = [
  { octave: 0, name: 'малой октавы', short: 'малая', notes: NOTES_0 },
  { octave: 1, name: '1 октавы', short: '1-я', notes: NOTES },
  { octave: 2, name: '2 октавы', short: '2-я', notes: NOTES_2 },
];

// All the notes in a row, low to high: E3 … B3, C4 … B4, C5 … B5.
export const ALL_NOTES = OCTAVES.flatMap((octave) => octave.notes);

const octaveOf = (octave) => OCTAVES.find((item) => item.octave === octave);

/** Octave label as used after a note name in class, e.g. "C of the 2nd octave". */
export const octaveName = (note) => octaveOf(note.octave).name;

/** The octave on its own, for the brackets under the octave ladder. */
export const octaveShort = (octave) => octaveOf(octave).short;

/** Notes from more than one octave: then a name alone doesn't say which note it is. */
export const isMixed = (notes) => new Set(notes.map((note) => note.octave)).size > 1;
