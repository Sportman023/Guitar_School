// Lessons of the topic "Диез, бемоль, бекар": what the three signs do, the
// rhyme about the cat on a taxi (the order of the sharps and the flats), and
// the friendly notes Mi–Fa and Si–Do. The games of the topic are in
// signs-match.js and cat-poem.js.
//
// A half step is shown on a piano keyboard (js/core/keys.js) in the lesson about
// the signs, and on the stickered guitar neck (js/core/neck.js) in the lesson
// about the friendly notes; every key and sticker plays when tapped.

import { el, noteStyle } from '../core/ui.js';
import { loadPiano, playPiano, playPianoScale } from '../core/piano.js';
import { renderKeyboard, keyArrow, arrowHead, playKey } from '../core/keys.js';
import { renderNeck, playFret } from '../core/neck.js';
import { NOTE_BY_ID } from '../data/notes.js';
import { SIGNS, POEM } from '../data/accidentals.js';

export const GROUP = 'accidentals';
const ACCENT = '#26A69A';

/** Plays keys one after another, each held until the next one. */
function playKeys(ids, step = 0.9) {
  ids.forEach((id, i) => playKey(id, { delay: i * step, duration: step + 0.4 }));
}

/** A note of the rhyme: a small circle with its name, in its colour or plain. */
export function poemNote(note, { colored = true, extra = '', onclick = null } = {}) {
  return el(onclick ? 'button' : 'span', {
    class: `poem-note ${colored ? 'poem-note--color' : ''} ${extra}`.trim(),
    style: noteStyle(note),
    type: onclick ? 'button' : null,
    onclick,
  }, note.ru);
}

// ---------- The three signs ----------

// what each sign does, shown on the keyboard: a note, and where the sign takes it
const EXAMPLES = {
  sharp: { from: 'fa', to: 'fa#', text: 'Фа → Фа-диез: на соседнюю клавишу вправо, выше' },
  flat: { from: 'si', to: 'lya#', text: 'Си → Си-бемоль: на соседнюю клавишу влево, ниже' },
  natural: { from: 'fa#', to: 'fa', text: 'Фа-диез → Фа: бекар возвращает обычную ноту' },
};

function signCard(sign) {
  const example = EXAMPLES[sign.id];
  return el('div', { class: 'sign-card', style: `--sign:${sign.color}` },
    el('div', { class: 'sign-card__head' },
      el('span', { class: 'sign-card__glyph' }, sign.glyph),
      el('span', { class: 'sign-card__words' },
        el('span', { class: 'sign-card__name' }, sign.name),
        el('span', { class: 'sign-card__does' }, sign.does))),
    el('div', { class: 'keyboard-paper' },
      renderKeyboard({
        lit: { [example.from]: 'from', [example.to]: 'to' },
        over: [arrowHead(), keyArrow(example.from, example.to)],
        label: example.text,
      })),
    el('div', { class: 'caption' }, example.text),
    el('div', { class: 'row row--center' },
      el('button', {
        class: 'btn',
        type: 'button',
        onclick: () => playKeys([example.from, example.to]),
      }, '🔊 Послушать')));
}

export const signsLearn = {
  id: 'signs-learn',
  title: 'Диез, бемоль, бекар',
  subtitle: 'Три знака и что они делают',
  emoji: '♯',
  accent: ACCENT,
  group: GROUP,
  kind: 'learn',

  mount(root) {
    loadPiano();
    root.append(el('div', { class: 'screen signs-learn', style: `--accent:${ACCENT}` },
      el('p', { class: 'lead' },
        'Есть знаки, которые меняют ноту. Они двигают её на полтона. '
        + 'Полтона — это самый маленький шаг: на соседнюю клавишу, белую или чёрную.'),
      SIGNS.map(signCard),
      el('p', { class: 'caption' },
        'Знак пишут перед нотой — на той же линейке или между теми же линейками, где сама нота. '
        + 'Нажимай на клавиши — они звучат.'),
      el('div', { class: 'memo' },
        el('div', { class: 'memo__title' }, 'Запомни!'),
        el('ul', { class: 'memo__list memo__list--signs' },
          SIGNS.map((sign) => el('li', null,
            el('b', { class: 'memo__glyph' }, sign.glyph), ' ', el('b', null, sign.name), ' — ', sign.does))))));
  },
};

// ---------- The cat on a taxi ----------

/** A line of the rhyme: its notes, then its words. */
function poemLine(line, { onNote }) {
  const notes = line.notes.map((id) => NOTE_BY_ID[id]);
  return el('div', { class: 'poem__line' },
    el('div', { class: 'poem__order' }, line.order),
    el('div', { class: 'poem__notes' },
      notes.map((note) => poemNote(note, { onclick: () => onNote(note) }))),
    el('div', { class: 'poem__words' }, `${line.words[0].toUpperCase()}${line.words.slice(1)}`));
}

export const catTaxi = {
  id: 'cat-taxi',
  title: 'Кошка на такси',
  subtitle: 'Стишок про порядок диезов и бемолей',
  emoji: '🚕',
  accent: '#FFB300',
  group: GROUP,
  kind: 'learn',

  mount(root) {
    loadPiano();
    const playLine = (line) => playPianoScale(line.notes.map((id) => NOTE_BY_ID[id]), { step: 0.45 });
    root.append(el('div', { class: 'screen cat-taxi', style: '--accent:#FFB300' },
      el('p', { class: 'lead' }, 'Этот стишок помогает запомнить, в каком порядке пишут диезы и бемоли.'),
      el('div', { class: 'poem' },
        el('div', { class: 'poem__cat', 'aria-hidden': 'true' }, '🐱🚕'),
        poemLine(POEM[0], { onNote: (note) => playPiano(note.freq) }),
        el('div', { class: 'poem__turn' }, '↩ а теперь задом наперёд'),
        poemLine(POEM[1], { onNote: (note) => playPiano(note.freq) }),
        el('div', { class: 'poem__cat', 'aria-hidden': 'true' }, '🍽️🐱')),
      el('div', { class: 'row row--center' },
        POEM.map((line, i) => el('button', {
          class: 'btn',
          type: 'button',
          onclick: () => playLine(line),
        }, `▶ ${i + 1}-я строчка`))),
      el('div', { class: 'memo' },
        el('div', { class: 'memo__title' }, 'Запомни!'),
        el('ul', { class: 'memo__list' },
          el('li', null, 'Первая строчка — порядок диезов: Фа, до, соль, ре, ля, ми, си'),
          el('li', null, 'Вторая строчка — порядок бемолей: Си, ми, ля, ре, соль, до, фа'),
          el('li', null, 'Вторая строчка — это первая, прочитанная задом наперёд. '
            + 'Помнишь одну — помнишь и другую!')))));
  },
};

// ---------- Friendly notes ----------

// the friends on the stickered strings: the lower note's string and fret
const NECK_FRIENDS = [
  { string: 1, fret: 0, text: 'Ми — Фа', where: '1-я струна' },
  { string: 2, fret: 0, text: 'Си — До', where: '2-я струна' },
  { string: 4, fret: 2, text: 'Ми — Фа', where: '4-я струна' },
  { string: 5, fret: 2, text: 'Си — До', where: '5-я струна' },
];

export const noteFriends = {
  id: 'note-friends',
  title: 'Ноты-друзья',
  subtitle: 'Ми — Фа и Си — До стоят рядом',
  emoji: '💛',
  accent: '#EC407A',
  group: GROUP,
  kind: 'learn',

  mount(root) {
    loadPiano();
    root.append(el('div', { class: 'screen note-friends', style: '--accent:#EC407A' },
      el('p', { class: 'lead' },
        'Есть ноты, которые ДРУЖАТ: Ми и Фа, Си и До. От одной до другой всего полтона.'),
      el('p', { class: 'caption caption--top' },
        'На грифе одна клеточка — это полтона. Между До и Ре на 2-й струне есть пустая клеточка '
        + 'без наклейки, там живёт До-диез. А друзья Ми и Фа, Си и До стоят в соседних клеточках — '
        + 'пустой между ними нет.'),
      el('div', { class: 'neck-paper' }, renderNeck({
        pairs: NECK_FRIENDS.map(({ string, fret }) => [string, fret]),
        label: 'Гриф с наклейками: Ми и Фа, Си и До стоят в соседних клеточках',
      })),
      el('p', { class: 'caption' }, 'Нажимай на наклейки и открытые струны — они звучат.'),
      el('div', { class: 'neck-buttons' },
        NECK_FRIENDS.map(({ string, fret, text, where }) => el('button', {
          class: 'btn',
          type: 'button',
          onclick: () => [0, 1].forEach((step) => playFret(string, fret + step, { delay: step * 0.9, duration: 1.3 })),
        }, el('span', { class: 'neck-buttons__pair' }, `🔊 ${text}`), el('span', { class: 'neck-buttons__where' }, where)))),
      el('div', { class: 'memo' },
        el('div', { class: 'memo__title' }, 'Запомни!'),
        el('div', { class: 'memo__phrase' }, 'Ноты-друзья: МИ — ФА и СИ — ДО'),
        el('ul', { class: 'memo__list' },
          el('li', null, 'На грифе они стоят в соседних клеточках, без пустой между ними'),
          el('li', null, 'От одной до другой — полтона, а не целый тон')))));
  },
};
