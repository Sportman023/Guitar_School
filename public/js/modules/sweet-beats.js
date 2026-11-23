// "Sweet beats": a colouring game after a music-school worksheet. A note
// stands on a card — a whole, a half or a quarter — and next to it four treats
// wait to be coloured: ice creams, apples or ice lollies. Colour as many as the
// beats the note lasts (the whole note four, the half two, the quarter one) and
// press "Готово!". Then the coloured treats run to the front of the row, the
// plain ones step back behind them, and the note sounds on the piano while the
// treats the child coloured light up one by one, a beat each, with the count
// under them: раз, два, три, четыре. A round is ten notes.
//
// The treats of a note are picked at random, so they never tell how many to
// colour, as the rows of the sheet would. There is no "count under the notes"
// switch here: that count would be the answer itself. As on the sheet there
// are no eighths, which would need half a treat.
//
// A point is a note coloured right. After a mistake the game puts the number
// right itself — the extra treats lose their paint, the missing ones next to
// the coloured ones get it — and plays the note with them, and then the next
// note comes, as in the quizzes.

import { el, clear, mount, svgEl, delay } from '../core/ui.js';
import { noteGlyph, playRhythm, stopRhythm } from '../core/rhythm.js';
import { praise, renderRoundResult, buildQueue } from '../core/quiz.js';
import { store } from '../core/store.js';
import { playFail } from '../core/audio.js';
import { loadPiano } from '../core/piano.js';
import { DURATIONS, METER_BY_BEATS, beatsWord } from '../data/rhythm.js';

const ID = 'sweet-beats';
const GROUP = 'rhythm-play';
const ACCENT = '#EC407A';
const NOTES_IN_ROUND = 10;
const TREATS = 4;
// the notes of the sheet: the whole, the half and the quarter
const ASKED = DURATIONS.filter((duration) => duration.beats >= 1);
// раз, два, три, четыре — the count said in class
const COUNT = METER_BY_BEATS[4].count;

// Every treat is drawn 60 × 80 as a page of a colouring book: cream with dark
// outlines until it is coloured. Parts of class `paint` take the main colour,
// those of class `paint2` the second one (the cone, the leaf, the glaze).
const PAINT = 'treat__paint';
const PAINT2 = 'treat__paint2';
const LINE = 'treat__line';

const KINDS = [
  {
    name: 'Мороженое',
    colors: ['#F48FB1', '#E8B66B'],
    art: () => [
      svgEl('path', { d: 'M15 40 L45 40 L30 77 Z', class: PAINT2 }),
      // the waffle of the cone
      svgEl('path', { d: 'M21 47 L38 64 M28 43 L42 57 M39 47 L25 64 M32 43 L21 54', class: LINE }),
      // a scoop with three drips over the rim
      svgEl('path', {
        d: 'M11 39 C6 20 19 7 30 7 C41 7 54 20 49 39 Q48 45 44 42 Q43 51 38 47 Q36 41 32 44 '
          + 'Q30 54 25 47 Q23 41 19 44 Q14 47 11 39 Z',
        class: PAINT,
      }),
      svgEl('circle', { cx: 30, cy: 8, r: 4.5, class: 'treat__cherry' }),
    ],
  },
  {
    name: 'Яблоко',
    colors: ['#E53935', '#7CB342'],
    art: () => [
      svgEl('path', {
        d: 'M30 27 C23 19 6 20 6 40 C6 60 18 77 30 74 C42 77 54 60 54 40 C54 20 37 19 30 27 Z',
        class: PAINT,
      }),
      svgEl('path', { d: 'M30 27 C30 20 31 15 35 10', class: 'treat__stem' }),
      svgEl('path', { d: 'M33 16 C37 8 46 6 51 10 C47 17 39 19 33 16 Z', class: PAINT2 }),
      svgEl('path', { d: 'M14 42 C14 34 18 30 23 29', class: 'treat__shine' }),
    ],
  },
  {
    name: 'Эскимо',
    // an apricot one: a vanilla one would hardly differ from an uncoloured one
    colors: ['#FFB74D', '#8D5B3C'],
    art: () => [
      svgEl('rect', { x: 26, y: 58, width: 8, height: 20, rx: 4, class: 'treat__stick' }),
      svgEl('path', { d: 'M14 60 V26 C14 15 21 8 30 8 C39 8 46 15 46 26 V60 Q46 63 43 63 H17 Q14 63 14 60 Z', class: PAINT }),
      // chocolate glaze dripping down from the top
      svgEl('path', {
        d: 'M14 34 V26 C14 15 21 8 30 8 C39 8 46 15 46 26 V36 Q46 42 42 39 Q40 47 36 42 Q34 37 31 41 '
          + 'Q28 50 25 42 Q23 36 20 40 Q15 43 14 34 Z',
        class: PAINT2,
      }),
    ],
  },
];

const fixed = (n) => Number(n.toFixed(1));

const calm = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export default {
  id: ID,
  title: 'Сладкие доли',
  subtitle: 'Раскрась столько, сколько долей звучит нота',
  emoji: '🍦',
  accent: ACCENT,
  group: GROUP,

  mount(root) {
    // start downloading the piano now, so the first answer isn't silent
    loadPiano();

    const screen = el('div', { class: 'screen beats-game', style: `--accent:${ACCENT}` });
    root.append(screen);

    // { duration, kind } for every note of the round
    let queue;
    let index;
    // which treats of the note on display are coloured
    let painted;
    let score;
    let locked;
    let cancelled = false;
    // bumped on every new round, so a note still playing doesn't move a round
    // that has been restarted
    let round = 0;
    let view = {};

    const task = () => queue[index];

    function say(text, kind) {
      view.feedback.textContent = text || ' ';
      view.feedback.className = `feedback feedback--${kind}`;
    }

    function renderProgress() {
      return el('div', { class: 'progress' },
        el('div', { class: 'progress__dots' },
          queue.map((_, i) => el('span', {
            class: `dot ${i < index ? 'dot--done' : ''} ${i === index ? 'dot--now' : ''}`,
          }))),
        el('div', { class: 'progress__score' }, `⭐ ${score}`),
      );
    }

    function renderTreat(kind, i) {
      const [paint, paint2] = KINDS[kind].colors;
      return el('button', {
        class: 'treat',
        type: 'button',
        style: `--paint:${paint};--paint2:${paint2}`,
        'aria-pressed': 'false',
        'aria-label': `${KINDS[kind].name} ${i + 1}`,
        onclick: () => tap(i),
      },
        svgEl('svg', { viewBox: '0 0 60 80', class: 'treat__art', 'aria-hidden': 'true' }, KINDS[kind].art()),
        el('span', { class: 'treat__count' }, COUNT[i]));
    }

    function render() {
      clear(screen);
      const { duration, kind } = task();
      const glyph = noteGlyph(duration.token, { label: 'Нота' });
      view = {
        feedback: el('div', { class: 'feedback' }, ' '),
        treats: Array.from({ length: TREATS }, (_, i) => renderTreat(kind, i)),
        done: el('button', {
          class: 'btn btn--primary beats__done',
          type: 'button',
          disabled: true,
          onclick: check,
        }, 'Готово!'),
      };
      // the note and the treats light up together, so they play as one
      view.stage = el('div', { class: 'beats__stage' },
        el('div', { class: 'rhythm-paper beats__note' }, glyph),
        el('div', { class: 'treats' }, view.treats));

      mount(screen,
        renderProgress(),
        el('div', { class: 'beats__task' }, 'Сколько долей звучит нота? Раскрась столько же угощений.'),
        view.stage,
        view.feedback,
        el('div', { class: 'row row--center' }, view.done),
      );
    }

    function showPaint() {
      view.treats.forEach((node, i) => {
        node.classList.toggle('is-painted', painted[i]);
        node.setAttribute('aria-pressed', painted[i] ? 'true' : 'false');
      });
      // nothing to check yet, or the note is being checked already
      view.done.disabled = locked || !painted.some(Boolean);
    }

    function next() {
      painted = Array(TREATS).fill(false);
      locked = false;
      render();
    }

    /** A fresh round — "Ещё раз". */
    function restart() {
      stopRhythm();
      // never the same treats twice in a row
      let kind = -1;
      queue = buildQueue(ASKED, NOTES_IN_ROUND).map((duration) => {
        const others = KINDS.map((_, i) => i).filter((i) => i !== kind);
        kind = others[Math.floor(Math.random() * others.length)];
        return { duration, kind };
      });
      index = 0;
      score = 0;
      round += 1;
      next();
    }

    function tap(i) {
      if (locked) return;
      painted[i] = !painted[i];
      showPaint();
      say(null, 'hint');
    }

    /**
     * The coloured treats run to the front of the row, keeping their order,
     * and the plain ones step back behind them: the count goes from the left,
     * so the treats that light up are the ones the child coloured.
     */
    async function lineUp() {
      const order = painted.map((_, i) => i).sort((a, b) => Number(painted[b]) - Number(painted[a]) || a - b);
      if (order.every((i, k) => i === k)) return;
      const before = view.treats.map((node) => node.getBoundingClientRect().left);
      view.treats = order.map((i) => view.treats[i]);
      painted = order.map((i) => painted[i]);
      view.treats[0].parentNode.append(...view.treats);
      // every treat takes the number of its new place
      view.treats.forEach((node, k) => {
        node.querySelector('.treat__count').textContent = COUNT[k];
        node.setAttribute('aria-label', `${KINDS[task().kind].name} ${k + 1}`);
      });
      if (calm()) return;
      await Promise.all(view.treats.map((node, k) => {
        const dx = before[order[k]] - node.getBoundingClientRect().left;
        if (!dx) return null;
        // a coloured treat hops over the plain ones on its way
        const hop = painted[k] ? -18 : 0;
        if (hop) node.classList.add('is-hopping');
        return node.animate([
          { transform: `translate(${fixed(dx)}px, 0)` },
          { transform: `translate(${fixed(dx / 2)}px, ${hop}px)`, offset: 0.5 },
          { transform: 'none' },
        ], { duration: 600, easing: 'ease-in-out' }).finished.catch(() => {})
          .then(() => node.classList.remove('is-hopping'));
      }));
    }

    async function check() {
      if (locked || !painted.some(Boolean)) return;
      locked = true;
      const current = round;
      const { duration } = task();
      const beats = duration.beats;
      const isRight = painted.filter(Boolean).length === beats;
      store.recordAnswer(duration.id, isRight);
      view.done.disabled = true;
      const lasts = `${duration.ru} нота — ${beats} ${beatsWord(beats)}`;

      await lineUp();
      if (cancelled || current !== round) return;
      if (isRight) {
        score += 1;
        say(`${praise()} ${lasts}`, 'good');
      } else {
        playFail();
        say(`Нет: ${lasts.toLowerCase()}`, 'bad');
        await delay(700);
        if (cancelled || current !== round) return;
        // as many as the note lasts: the extra treats lose their paint, the
        // missing ones next to the coloured ones get it
        painted = painted.map((_, i) => i < beats);
        showPaint();
        await delay(500);
        if (cancelled || current !== round) return;
      }

      // the coloured treats, at the front of the row now, light up on their beats
      view.treats.forEach((node, i) => {
        if (i < beats) node.setAttribute('data-lit', `${i},1`);
      });
      view.stage.classList.add('is-counted');
      await new Promise((resolve) => {
        playRhythm(view.stage, { onEnd: resolve });
      });
      await delay(calm() ? 400 : 700);
      if (cancelled || current !== round) return;

      index += 1;
      if (index < queue.length) {
        next();
        return;
      }
      clear(screen);
      screen.append(renderRoundResult({ id: ID, group: GROUP, score, total: queue.length, onRestart: restart }));
    }

    restart();
    return () => {
      cancelled = true;
      stopRhythm();
    };
  },
};
