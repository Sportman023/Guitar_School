// Registry of the app's sections.
//
// The menu has two levels: the home screen shows the topics of GROUPS, and
// tapping one opens the sections of that topic. To add a section, create a
// module with { id, title, subtitle, emoji, accent, group, mount(root) } and
// list it in MODULES; `group` is the id of a topic below. A section that only
// explains something, without a game, also sets kind: 'learn' — then the menu
// shows a tag instead of a score. A section added to an existing topic gets
// "Новое!" on the topic tile and on its own card until the topic is opened.

import learn from './learn.js';
import rainbow from './rainbow.js';
import fingers from './fingers.js';
import { fingerToMark, markToFinger } from './finger-games.js';
import octave1 from './octave1.js';
import octave2 from './octave2.js';
import octaveSmall from './octave-small.js';
import octaves from './octaves.js';
import orangeSlices from './orange-slices.js';
import treeToys from './tree-toys.js';
import pumpkins from './pumpkins.js';
import berries from './berries.js';
import detective from './detective.js';
import { colorToggle, octaveChips, drilledNotes } from '../core/controls.js';
import { renderStaff, staffBox } from '../core/staff.js';
import { store } from '../core/store.js';
import { createQuiz, pickWithTwin } from '../core/quiz.js';
import { el, noteBubble, colorBubble, noteStyle } from '../core/ui.js';
import { playPiano } from '../core/piano.js';
import { NOTE_BY_ID, isMixed, octaveName } from '../data/notes.js';

// Topics of the home screen, in the order they are taught at school.
// A new topic goes to the end of the list, so what is being learned now
// is always the last tile.
export const GROUPS = [
  {
    id: 'hands',
    title: 'Пальцы',
    subtitle: 'Как зовут пальцы левой и правой руки',
    emoji: '🖐️',
    accent: '#00ACC1',
  },
  {
    id: 'colors',
    title: 'Ноты и цвета',
    subtitle: 'Семь нот — семь цветов радуги',
    emoji: '🎨',
    accent: '#FF7043',
  },
  {
    id: 'staff',
    title: 'Нотный стан',
    subtitle: 'Ноты малой, первой и второй октавы',
    emoji: '🎼',
    accent: '#5C6BC0',
  },
  {
    id: 'note-games',
    title: 'Игры по ноткам',
    subtitle: 'Играем с нотами на стане',
    emoji: '🎶',
    accent: '#FB8C00',
  },
];

// Play a reference C first, then the hidden note: the child compares
// pitches instead of needing perfect pitch. Both are piano keys of the
// first octave, C4–B4, so the hidden note is always at or above the C.
function playWithReference(note) {
  playPiano(NOTE_BY_ID.do.freq, { duration: 0.8, volume: 1.1 });
  playPiano(note.freq, { delay: 1.1, duration: 1.6 });
}

const noteToColor = createQuiz({
  id: 'note-to-color',
  title: 'Нота → Цвет',
  subtitle: 'Показываем ноту, выбираешь цвет',
  emoji: '🖍️',
  accent: '#7E57C2',
  group: 'colors',
  optionsClass: 'options options--colors',
  renderPrompt: (note) => el('div', { class: 'prompt' },
    el('div', { class: 'prompt__label' }, 'Какого цвета нота'),
    el('div', { class: 'prompt__big' }, note.ru),
    el('div', { class: 'prompt__label' }, `(${note.en})`),
  ),
  renderOption: (note) => colorBubble(note),
});

const colorToNote = createQuiz({
  id: 'color-to-note',
  title: 'Цвет → Нота',
  subtitle: 'Показываем цвет, выбираешь ноту',
  emoji: '🎵',
  accent: '#EC407A',
  group: 'colors',
  optionsClass: 'options options--names',
  renderPrompt: (note) => el('div', { class: 'prompt' },
    el('div', { class: 'prompt__label' }, 'Какая нота этого цвета?'),
    el('div', { class: 'prompt__swatch', style: noteStyle(note) }),
  ),
  renderOption: (note) => el('span', { class: 'option__name' }, note.ru),
});

const listenAndGuess = createQuiz({
  id: 'sound-to-note',
  title: 'Угадай на слух',
  subtitle: 'Фортепиано, первая октава',
  emoji: '👂',
  accent: '#FFA726',
  group: 'colors',
  onAsk: playWithReference,
  optionsClass: 'options options--names',
  renderPrompt: (note) => el('div', { class: 'prompt' },
    el('div', { class: 'prompt__label' }, 'Послушай и выбери ноту 1 октавы'),
    el('button', {
      class: 'prompt__play',
      type: 'button',
      onclick: () => playWithReference(note),
    }, '🔊'),
    el('div', { class: 'prompt__label' }, 'сначала прозвучит До, потом загадка'),
  ),
  renderOption: (note) => noteBubble(note, { colored: true }),
});

/** The note name in large type with its octave underneath. */
function namePrompt(label, note) {
  return el('div', { class: 'prompt' },
    el('div', { class: 'prompt__label' }, label),
    el('div', { class: 'prompt__big' }, note.ru),
    el('div', { class: 'prompt__label' }, octaveName(note)),
  );
}

// Staff games ask about the octaves picked on the chips above the question.
// With several octaves one name repeats, so the options always include the
// same note from another octave. Colour only hints the name (C4 and C5 are
// both red): which of the two it is has to be read from the staff.
// Every picture of a round is as big as the picked octaves need, so the staff
// stays put while the questions go by.

// Reading notes on the staff. Note heads follow the shared "coloured notes"
// setting: colour is a hint here (red head → C), and the answers are words,
// otherwise the child could match colour to colour without reading the staff.
// With several octaves the answer carries the octave too.
const staffToNote = createQuiz({
  id: 'staff-to-note',
  title: 'Читаем ноты',
  subtitle: 'Нота на стане → название',
  emoji: '👀',
  accent: '#5C6BC0',
  group: 'staff',
  notes: drilledNotes,
  pickOthers: pickWithTwin('pc'),
  optionsClass: 'options options--names',
  renderControls: ({ redraw, restart }) => [octaveChips(restart), colorToggle(redraw)],
  renderPrompt: (note, notes) => el('div', { class: 'prompt' },
    el('div', { class: 'prompt__label' }, 'Какая это нота?'),
    el('div', { class: 'prompt__paper' },
      renderStaff(note, { colored: store.setting('coloredHeads', true), box: staffBox(notes) })),
  ),
  renderOption: (note, notes) => (isMixed(notes)
    ? el('span', { class: 'option__stack' },
      el('span', { class: 'option__name' }, note.ru),
      el('span', { class: 'option__octave' }, octaveName(note)))
    : el('span', { class: 'option__name' }, note.ru)),
  explainAnswer: (note, notes) => (isMixed(notes)
    ? `Это ${note.ru} ${octaveName(note)}`
    : `Это ${note.ru} — ${note.colorName.toLowerCase()}`),
});

// The reverse task: given a name, find where the note sits.
// Heads are always black here, otherwise colour would give the answer away.
const noteToStaff = createQuiz({
  id: 'note-to-staff',
  title: 'Ставим ноты',
  subtitle: 'Название → место на стане',
  emoji: '✍️',
  accent: '#00897B',
  group: 'staff',
  notes: drilledNotes,
  pickOthers: pickWithTwin('pc'),
  optionsClass: 'options options--staves',
  renderControls: ({ restart }) => octaveChips(restart),
  renderPrompt: (note) => namePrompt('Где на стане живёт нота', note),
  renderOption: (note, notes) => el('div', { class: 'prompt__paper prompt__paper--small' },
    renderStaff(note, { colored: false, box: staffBox(notes) })),
  explainAnswer: (note) => `${note.ru} ${octaveName(note)} — ${note.staffPlace}`,
});

export const MODULES = [
  fingers,
  fingerToMark,
  markToFinger,

  learn,
  noteToColor,
  colorToNote,
  rainbow,
  listenAndGuess,

  octave1,
  octave2,
  octaveSmall,
  octaves,
  staffToNote,
  noteToStaff,

  orangeSlices,
  treeToys,
  pumpkins,
  berries,
  detective,
];
