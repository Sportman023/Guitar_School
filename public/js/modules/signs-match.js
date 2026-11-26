// "Sign and what it does": a matching game of two columns, after the lesson
// about the sharp, the flat and the natural. Every screen of the round is a
// task of its own: join the signs (♯ ♭ ♮) with their names, the signs with
// what they do, or the names with what they do. Which column is on the left
// changes too, so sometimes the child starts from the name or from what the
// sign does, and the cards of a column are mixed up every time.
//
// Draw a line with a finger from a card to its pair in the other column, or
// tap one and then the other, as in "Pumpkins and leaves". A right line stays,
// a wrong one flashes red and goes.
//
// The round is ten right pairs, not ten screens: two screens of three pairs
// and two of two (two of the three signs). A point is a pair joined with no
// wrong line drawn from its cards before.
//
// The scaffolding is colour: the sign, its name and what it does share a
// colour, until the "Цветные подсказки" toggle is switched off.

import { el, clear, mount, shuffle, svgEl, delay } from '../core/ui.js';
import { praise, renderRoundResult } from '../core/quiz.js';
import { signColorToggle } from '../core/controls.js';
import { store } from '../core/store.js';
import { playFail, playSuccess } from '../core/audio.js';
import { SIGNS } from '../data/accidentals.js';
import { GROUP } from './accidentals.js';

const ID = 'signs-match';
const ACCENT = '#26A69A';
// pairs on each screen of a round: ten in all
const SIZES = [3, 3, 2, 2];
const TOTAL = SIZES.reduce((sum, size) => sum + size, 0);
const TASKS = [['glyph', 'name'], ['glyph', 'does'], ['name', 'does']];

/** The screens of a round: every task at least once, each with its columns in any order. */
function plan() {
  const tasks = [...shuffle(TASKS), ...shuffle(TASKS)].slice(0, SIZES.length);
  return SIZES.map((size, i) => ({ size, kinds: shuffle(tasks[i]) }));
}

/** The two columns of a screen: the same signs in each, mixed up separately. */
function columnsOf({ size, kinds }) {
  const signs = shuffle(SIGNS).slice(0, size);
  return kinds.map((kind) => ({ kind, signs: shuffle(signs) }));
}

const TASK_TEXT = {
  'glyph name': 'Соедини знак с его названием',
  'glyph does': 'Соедини знак с тем, что он делает',
  'name does': 'Соедини название знака с тем, что он делает',
};
const taskText = (kinds) => TASK_TEXT[kinds.join(' ')] || TASK_TEXT[[...kinds].reverse().join(' ')];

const fixed = (n) => Number(n.toFixed(1));

export default {
  id: ID,
  title: 'Знак и что он делает',
  subtitle: 'Соедини знак с названием и с тем, что он делает',
  emoji: '🔗',
  accent: ACCENT,
  group: GROUP,

  mount(root) {
    const screen = el('div', { class: 'screen match-game', style: `--accent:${ACCENT}` });
    root.append(screen);

    let screens;
    let index;
    let score;
    // right pairs of the round so far, for the progress dots
    let found;
    let columns;
    // joined pairs of the screen: { a: [col, row], b: [col, row] }, a in the left column of the two
    let links;
    // signs of the screen that had a wrong line: their pair scores no point
    let tried;
    // { col, row } tapped first, waiting for its pair
    let selected;
    let drag = null;
    let skipClick = false;
    let locked = false;
    let cancelled = false;
    let round = 0;
    let view = {};

    const signAt = (col, row) => columns[col].signs[row];
    const isJoined = (col, row, other) => links.some(({ a, b }) => (a[0] === col && a[1] === row && b[0] === other)
      || (b[0] === col && b[1] === row && a[0] === other));
    // a card that still needs a line to a neighbouring column
    const isOpen = ({ col, row }) => [col - 1, col + 1]
      .some((other) => other >= 0 && other < columns.length && !isJoined(col, row, other));

    function say(text, kind) {
      view.feedback.textContent = text || ' ';
      view.feedback.className = `feedback feedback--${kind}`;
    }

    function select(next) {
      selected = next;
      view.cards.forEach((column, col) => column.forEach((node, row) => node.classList
        .toggle('is-selected', Boolean(next && next.col === col && next.row === row))));
    }

    function renderProgress() {
      return el('div', { class: 'progress' },
        el('div', { class: 'progress__dots' },
          Array.from({ length: TOTAL }, (_, i) => el('span', { class: `dot ${i < found ? 'dot--done' : ''}` }))),
        el('div', { class: 'progress__score' }, `⭐ ${score}`));
    }

    function cardText(kind, sign) {
      if (kind === 'glyph') return el('span', { class: 'match-card__glyph' }, sign.glyph);
      if (kind === 'name') return el('span', { class: 'match-card__name' }, sign.name);
      return el('span', { class: 'match-card__does' }, sign.does);
    }

    function render() {
      clear(screen);
      const colored = store.setting('signColors', true);
      view = {
        progress: renderProgress(),
        feedback: el('div', { class: 'feedback' }, ' '),
        lines: svgEl('svg', { class: 'match__lines', 'aria-hidden': 'true' }),
      };
      view.cards = columns.map(({ kind, signs }, col) => signs.map((sign, row) => el('button', {
        class: `match-card match-card--${kind} ${colored ? 'match-card--color' : ''}`,
        type: 'button',
        style: `--sign:${sign.color};grid-column:${col + 1};grid-row:${row + 1}`,
        'data-col': col,
        'data-row': row,
        onclick: () => tap({ col, row }),
      }, cardText(kind, sign))));
      view.board = el('div', {
        class: 'match',
        onpointerdown: onDown,
        onpointermove: onMove,
        onpointerup: onUp,
        onpointercancel: onCancel,
      }, view.cards, view.lines);

      mount(screen,
        view.progress,
        signColorToggle(redraw),
        el('div', { class: 'patch__task' }, taskText(columns.map((column) => column.kind))),
        view.feedback,
        view.board);
      requestAnimationFrame(drawLinks);
    }

    function redraw() {
      if (!locked && !drag) render();
    }

    /** Where a line meets a card: the middle of its side that faces the other card. */
    function anchor({ col, row }, toward) {
      const origin = view.board.getBoundingClientRect();
      const box = view.cards[col][row].getBoundingClientRect();
      const x = toward > col ? box.right : toward < col ? box.left : box.left + box.width / 2;
      return { x: x - origin.left, y: box.top + box.height / 2 - origin.top };
    }

    const linePath = (p, q) => `M${fixed(p.x)} ${fixed(p.y)} L${fixed(q.x)} ${fixed(q.y)}`;

    function joinPath(a, b) {
      return linePath(anchor(a, b.col), anchor(b, a.col));
    }

    /** Draws the lines of the screen again, after a redraw or a turned screen. */
    function drawLinks() {
      if (!view.board || !view.board.isConnected) return;
      view.lines.querySelectorAll('.match__line--kept').forEach((line) => line.remove());
      links.forEach(({ a, b }) => {
        view.lines.append(svgEl('path', {
          class: 'match__line match__line--kept',
          d: joinPath({ col: a[0], row: a[1] }, { col: b[0], row: b[1] }),
          style: store.setting('signColors', true) ? `--sign:${signAt(...a).color}` : null,
        }));
      });
    }

    function cardOf(node) {
      const button = node && node.closest ? node.closest('[data-col]') : null;
      if (!button || !view.board.contains(button)) return null;
      return { col: Number(button.dataset.col), row: Number(button.dataset.row) };
    }

    function onDown(event) {
      skipClick = false;
      if (locked || drag || !event.isPrimary || event.button > 0) return;
      const from = cardOf(event.target);
      if (!from || !isOpen(from)) return;
      drag = { from, pointer: event.pointerId, x: event.clientX, y: event.clientY, line: null };
    }

    function onMove(event) {
      if (!drag || event.pointerId !== drag.pointer) return;
      if (!drag.line) {
        if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 12) return;
        view.board.setPointerCapture(event.pointerId);
        select(drag.from);
        drag.line = svgEl('path', { class: 'match__line' });
        view.lines.append(drag.line);
      }
      const origin = view.board.getBoundingClientRect();
      const end = { x: event.clientX - origin.left, y: event.clientY - origin.top };
      const toward = end.x > anchor(drag.from, drag.from.col).x ? drag.from.col + 1 : drag.from.col - 1;
      drag.line.setAttribute('d', linePath(anchor(drag.from, toward), end));
    }

    function onUp(event) {
      if (!drag || event.pointerId !== drag.pointer) return;
      const { from, line } = drag;
      drag = null;
      if (!line) return;
      skipClick = true;
      line.remove();
      const to = cardOf(document.elementFromPoint(event.clientX, event.clientY));
      if (to) join(from, to);
      else say('Доведи линию до карточки в соседнем столбике', 'hint');
    }

    function onCancel(event) {
      if (!drag || event.pointerId !== drag.pointer) return;
      if (drag.line) drag.line.remove();
      drag = null;
    }

    function tap(card) {
      if (skipClick) {
        skipClick = false;
        return;
      }
      if (locked || !isOpen(card)) return;
      if (!selected || selected.col === card.col) {
        const same = selected && selected.row === card.row && selected.col === card.col;
        select(same ? null : card);
        say(same ? null : 'Теперь нажми на её пару в соседнем столбике', 'hint');
        return;
      }
      join(selected, card);
    }

    /** Two cards put together, by a drawn line or by two taps. */
    function join(p, q) {
      if (p.col === q.col) {
        select(q);
        return;
      }
      if (isJoined(p.col, p.row, q.col) || isJoined(q.col, q.row, p.col)) {
        select(null);
        say('У этой карточки уже есть пара', 'hint');
        return;
      }
      const sign = signAt(p.col, p.row);
      const other = signAt(q.col, q.row);
      const isRight = sign.id === other.id;
      if (!tried.has(sign.id)) store.recordAnswer(sign.id, isRight);
      const [a, b] = p.col < q.col ? [p, q] : [q, p];
      const path = joinPath(a, b);
      select(null);

      if (!isRight) {
        // one wrong line costs one point: that of the card it was drawn from
        tried.add(sign.id);
        playFail();
        say('Не пара. Попробуй ещё!', 'bad');
        const line = svgEl('path', { class: 'match__line match__line--wrong', d: path });
        view.lines.append(line);
        line.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 400, delay: 400, fill: 'forwards' })
          .finished.catch(() => {}).then(() => line.remove());
        const node = view.cards[q.col][q.row];
        node.classList.add('is-shaking');
        node.addEventListener('animationend', () => node.classList.remove('is-shaking'), { once: true });
        return;
      }

      links.push({ a: [a.col, a.row], b: [b.col, b.row] });
      if (!tried.has(sign.id)) score += 1;
      found += 1;
      const progress = renderProgress();
      view.progress.replaceWith(progress);
      view.progress = progress;
      drawLinks();
      [p, q].forEach(({ col, row }) => view.cards[col][row].classList.add('is-done'));
      if (links.length < columns[0].signs.length) {
        say(praise(), 'good');
        return;
      }
      next();
    }

    async function next() {
      locked = true;
      const current = round;
      say(tried.size ? 'Всё соединено! 👍' : `${praise()} Без единой ошибки!`, 'good');
      playSuccess();
      await delay(1300);
      if (cancelled || current !== round) return;
      index += 1;
      locked = false;
      if (index >= screens.length) {
        clear(screen);
        screen.append(renderRoundResult({ id: ID, group: GROUP, score, total: TOTAL, onRestart: restart }));
        return;
      }
      start();
    }

    /** The next screen of the round. */
    function start() {
      columns = columnsOf(screens[index]);
      links = [];
      tried = new Set();
      selected = null;
      render();
    }

    function restart() {
      screens = plan();
      index = 0;
      score = 0;
      found = 0;
      locked = false;
      round += 1;
      start();
    }

    window.addEventListener('resize', drawLinks);
    restart();
    return () => {
      cancelled = true;
      window.removeEventListener('resize', drawLinks);
    };
  },
};
