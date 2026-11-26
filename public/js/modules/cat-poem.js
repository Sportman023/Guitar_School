// "Put the notes back into the rhyme": the rhyme about the cat on a taxi with
// some of its notes missing. The child fills the empty boxes one by one, in
// reading order, with the note buttons under the rhyme.
//
// Every round is ten screens, and the gaps grow: one or two at first, then
// three or four, then five, and the last two screens hide a whole line — the
// other line is still there, and it is the same notes backwards.
//
// The only hint is the notes' rainbow colours, under the shared "coloured
// notes" switch; there is no other help, the rhyme has to come from memory.
//
// A point is a screen filled without a wrong note.

import { el, clear, mount, shuffle, delay } from '../core/ui.js';
import { praise, renderRoundResult } from '../core/quiz.js';
import { store } from '../core/store.js';
import { colorToggle } from '../core/controls.js';
import { playFail, playSuccess } from '../core/audio.js';
import { loadPiano, playPiano } from '../core/piano.js';
import { NOTES, NOTE_BY_ID } from '../data/notes.js';
import { POEM } from '../data/accidentals.js';
import { GROUP, poemNote } from './accidentals.js';

const ID = 'cat-poem';
const ACCENT = '#FFB300';
// how many notes each screen of the round hides; 7 is a whole line
const GAPS = [1, 2, 2, 3, 3, 4, 4, 5, 7, 7];
const LENGTH = POEM[0].notes.length;

/** The boxes to empty on a screen: `count` random ones, or a whole line. */
function gapsOf(count, line) {
  if (count === LENGTH) return POEM[line].notes.map((_, pos) => `${line}:${pos}`);
  const all = POEM.flatMap((_, l) => POEM[l].notes.map((__, pos) => `${l}:${pos}`));
  return shuffle(all).slice(0, count);
}

export default {
  id: ID,
  title: 'Вставь нотки в стишок',
  subtitle: 'Кошка на такси: каких нот не хватает?',
  emoji: '🐱',
  accent: ACCENT,
  group: GROUP,

  mount(root) {
    loadPiano();
    const screen = el('div', { class: 'screen poem-game', style: `--accent:${ACCENT}` });
    root.append(screen);

    let index;
    let score;
    // keys "line:pos" of the boxes still empty, and of all the boxes emptied on this screen
    let empty;
    let hidden;
    let mistake;
    let locked = false;
    let cancelled = false;
    let round = 0;
    // which line goes blank on each of the two whole-line screens
    let wholeLines;
    let message = null;

    const keyOf = (line, pos) => `${line}:${pos}`;
    // the first empty box in reading order
    const active = () => POEM.flatMap((_, l) => POEM[l].notes.map((__, pos) => keyOf(l, pos)))
      .find((key) => empty.has(key)) || null;
    const noteAt = (key) => {
      const [line, pos] = key.split(':').map(Number);
      return NOTE_BY_ID[POEM[line].notes[pos]];
    };

    function renderProgress() {
      return el('div', { class: 'progress' },
        el('div', { class: 'progress__dots' },
          GAPS.map((_, i) => el('span', { class: `dot ${i < index ? 'dot--done' : ''} ${i === index ? 'dot--now' : ''}` }))),
        el('div', { class: 'progress__score' }, `⭐ ${score}`));
    }

    function render() {
      clear(screen);
      const colored = store.setting('coloredHeads', true);
      const now = active();

      const lines = POEM.map((line, l) => el('div', { class: 'poem__line' },
        el('div', { class: 'poem__notes' },
          line.notes.map((_, pos) => {
            const key = keyOf(l, pos);
            if (empty.has(key)) {
              return el('span', { class: `poem-gap ${key === now ? 'poem-gap--now' : ''}`, 'aria-label': 'пропущенная нота' }, '?');
            }
            const fresh = hidden.has(key) ? 'poem-note--found' : '';
            return poemNote(noteAt(key), { colored, extra: fresh });
          })),
        el('div', { class: 'poem__words' }, `${line.words[0].toUpperCase()}${line.words.slice(1)}`)));

      const options = el('div', { class: 'poem-options' },
        NOTES.map((note) => el('button', {
          class: 'poem-option',
          type: 'button',
          'data-note': note.id,
          onclick: (event) => pick(note, event.currentTarget),
        }, poemNote(note, { colored }))));

      mount(screen,
        renderProgress(),
        colorToggle(redraw),
        el('div', { class: 'poem poem--game' },
          lines[0],
          el('div', { class: 'poem__turn' }, '↩ задом наперёд'),
          lines[1]),
        el('div', { class: `feedback ${message ? `feedback--${message.kind}` : ''}` }, message ? message.text : ' '),
        options);
    }

    function redraw() {
      if (!locked) render();
    }

    function say(text, kind) {
      message = text ? { text, kind } : null;
      const node = screen.querySelector('.feedback');
      if (!node) return;
      node.textContent = text || ' ';
      node.className = `feedback feedback--${kind}`;
    }

    async function pick(note, button) {
      if (locked) return;
      const key = active();
      if (!key) return;
      const right = noteAt(key);
      const isRight = note.id === right.id;
      store.recordAnswer(right.id, isRight);
      if (!isRight) {
        mistake = true;
        playFail();
        say(`Нет, здесь не ${note.ru}. Вспомни стишок!`, 'bad');
        button.classList.add('is-shaking');
        button.addEventListener('animationend', () => button.classList.remove('is-shaking'), { once: true });
        return;
      }
      empty.delete(key);
      playPiano(right.freq);
      if (empty.size) {
        message = { text: praise(), kind: 'good' };
        render();
        return;
      }
      locked = true;
      const current = round;
      if (!mistake) score += 1;
      message = { text: mistake ? 'Стишок собран! 🐱🚕' : `${praise()} Без единой ошибки!`, kind: 'good' };
      render();
      playSuccess();
      await delay(1400);
      if (cancelled || current !== round) return;
      index += 1;
      locked = false;
      if (index >= GAPS.length) {
        clear(screen);
        screen.append(renderRoundResult({ id: ID, group: GROUP, score, total: GAPS.length, onRestart: restart }));
        return;
      }
      start();
    }

    function start() {
      const count = GAPS[index];
      const whole = GAPS.slice(0, index).filter((gaps) => gaps === LENGTH).length;
      hidden = new Set(gapsOf(count, wholeLines[whole] ?? 0));
      empty = new Set(hidden);
      mistake = false;
      message = null;
      render();
    }

    function restart() {
      index = 0;
      score = 0;
      locked = false;
      round += 1;
      wholeLines = shuffle([0, 1]);
      start();
    }

    restart();
    return () => {
      cancelled = true;
    };
  },
};
