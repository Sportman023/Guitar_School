// "ТА и ТИ-ТИ": a matching game after a music-school worksheet. Bars of four
// beats stand on the staff on the left — quarters, pairs of eighths and fours
// of sixteenths — and cards with rhythm syllables on the right: ТА for a
// quarter, ТИ-ТИ for two eighths, ТУ-ТИ-ФРУ-ТИ for four sixteenths. A card is
// a row of modules, one for every beat, each kind of syllable in a colour of
// its own, so the words of a bar never run together. Draw a line with a finger
// from a bar to the card that says it (or from the card to the bar), or tap
// one and then the other. A right pair puts the same modules under the beats
// of the bar, and the bar plays on the piano, every note and the module of
// its beat lighting up in time.
//
// A round is two boards of five bars, ten bars in all, every one different;
// two bars of every board have ТУ-ТИ-ФРУ-ТИ on one of their beats. There is
// one card too many, so the last bar still has to be read; it says a bar that
// differs from one of the board by a single beat. A bar doesn't sound before
// it has found its card, or it could be matched by ear without being read; a
// bar with its syllables plays again on a tap. The colours of the cards are
// no hint: the bars themselves have none, so they still have to be read.
//
// The "count under the notes" switch puts "1 и 2 и…" under the bars, as in the
// games of the "Rhythm" topic; the syllables take its place once a bar is
// paired. A finger drawing a line can't scroll the page, so the board takes
// the screen below the controls, as in "Pumpkins and leaves".
//
// A point is a bar paired right at the first try. After a wrong card the child
// is told the syllables of the bar and finds its card, without the point.

import { el, clear, mount, sample, shuffle, svgEl, delay } from '../core/ui.js';
import { renderRhythm, playRhythm, stopRhythm } from '../core/rhythm.js';
import { countToggle, showsCount } from '../core/controls.js';
import { praise, renderRoundResult } from '../core/quiz.js';
import { store } from '../core/store.js';
import { playFail } from '../core/audio.js';
import { loadPiano } from '../core/piano.js';
import { SYLLABLES, syllablesOf } from '../data/rhythm.js';

const ID = 'ta-ti';
const GROUP = 'rhythm-play';
const ACCENT = '#1E88E5';
const BOARDS = 2;
const BARS = 5;
// a quarter is wider than in the other rhythm pictures: ТИ-ТИ needs room under
// its beat; every bar is drawn as wide as one with four sixteenths, the widest
const BEAT = 38;
// the gap between the bars, as in styles.css
const GAP = 8;
// a bar is never lower than this, even on a short screen (then the page
// scrolls), and never higher than that, so it doesn't swell on a big one
const MIN_ROW = 56;
const MAX_ROW = 120;
// the paper around a bar: its padding and border on both sides, as in styles.css
const PAPER_X = 18;
const PAPER_Y = 10;

/** Every row of `size` beats, each a quarter or a pair of eighths. */
const rows = (size) => (size ? rows(size - 1).flatMap((row) => ['q', 'ee'].map((token) => [...row, token])) : [[]]);
// the bars of four beats made of quarters and pairs of eighths: sixteen
const PLAIN = rows(4);
// and those with four sixteenths on one of the beats: thirty-two
const TUTTI = [0, 1, 2, 3].flatMap((beat) => rows(3).map((row) => [...row.slice(0, beat), 'ssss', ...row.slice(beat)]));
const PATTERNS = [...PLAIN, ...TUTTI];
// bars with ТУ-ТИ-ФРУ-ТИ on a board of five
const TUTTI_BARS = 2;

// how wide every bar is drawn: as wide as the widest, so that all of them line up
const BAR_WIDTH = Number(renderRhythm([TUTTI[0]], { beat: BEAT }).getAttribute('viewBox').split(' ')[2]);

const saying = (bar) => syllablesOf(bar).join(' ');
const differsByOne = (a, b) => a.filter((token, i) => token !== b[i]).length === 1;

const fixed = (n) => Number(n.toFixed(1));

const calm = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** A line from a to b that bends a little, like one drawn by hand. */
function linePath(a, b) {
  const bend = 0.12;
  const cx = (a.x + b.x) / 2 - (b.y - a.y) * bend;
  const cy = (a.y + b.y) / 2 + (b.x - a.x) * bend;
  return `M${fixed(a.x)} ${fixed(a.y)} Q${fixed(cx)} ${fixed(cy)} ${fixed(b.x)} ${fixed(b.y)}`;
}

/**
 * A module of a card: the word of one beat, in the colour of its kind (see
 * .syllable in styles.css). ТУ-ТИ-ФРУ-ТИ breaks in its middle on a narrow card.
 */
function syllableModule(token) {
  const parts = SYLLABLES[token].split('-');
  const half = Math.ceil(parts.length / 2);
  const lines = parts.length > 2 ? [`${parts.slice(0, half).join('-')}-`, parts.slice(half).join('-')] : [parts.join('-')];
  return el('span', { class: `tati-module syllable--${token}` },
    lines.map((line) => el('span', { class: 'tati-module__line' }, line)));
}

/** Fades a line out and takes it off the board. */
function fade(line, options = {}) {
  line.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: 'forwards', ...options })
    .finished.catch(() => {}).then(() => line.remove());
}

export default {
  id: ID,
  title: 'ТА и ТИ-ТИ',
  subtitle: 'Соедини ритм с его слогами',
  emoji: '💬',
  accent: ACCENT,
  group: GROUP,

  mount(root) {
    // start downloading the piano now, so the first right pair isn't silent
    loadPiano();

    const screen = el('div', { class: 'screen tati-game', style: `--accent:${ACCENT}` });
    root.append(screen);

    // { bars: [{ bar, done }], cards: [{ bar, gone }] } for every board of the round
    let boards;
    // the board on display
    let current;
    let score;
    // bars paired at least once: only the first try scores
    let tried;
    // { type: 'bar' | 'card', index } — what was tapped first, waiting for its pair
    let selected;
    let message;
    // a line being drawn: what it starts from, the pointer drawing it, the
    // point it went down at, and the pair under the finger
    let drag = null;
    // a drawn line can end with a click on the button it started from; that click isn't a tap
    let skipClick = false;
    let locked;
    let cancelled = false;
    // bumped on every new round, so an animation still running doesn't move
    // a round that has been restarted
    let round = 0;
    // nodes on display, so a tap changes them without redrawing the screen
    let view = {};

    const board = () => boards[current];
    const isPicked = (type, index) => Boolean(selected && selected.type === type && selected.index === index);
    const nodeOf = ({ type, index }) => (type === 'bar' ? view.bars : view.cards)[index];
    const isOpen = ({ type, index }) => (type === 'bar' ? !board().bars[index].done : !board().cards[index].gone);
    const doneCount = () => boards.reduce((sum, item) => sum + item.bars.filter((bar) => bar.done).length, 0);

    function say(text, kind) {
      message = text ? { text, kind } : null;
      view.feedback.textContent = text || ' ';
      view.feedback.className = `feedback feedback--${kind}`;
    }

    /** Lights up what was tapped first, without redrawing the board. */
    function select(next) {
      selected = next;
      view.bars.forEach((node, i) => node.classList.toggle('is-selected', isPicked('bar', i)));
      view.cards.forEach((node, i) => node.classList.toggle('is-selected', isPicked('card', i)));
    }

    function renderProgress() {
      const done = doneCount();
      return el('div', { class: 'progress' },
        el('div', { class: 'progress__dots' },
          Array.from({ length: BOARDS * BARS }, (_, i) => el('span', { class: `dot ${i < done ? 'dot--done' : ''}` }))),
        el('div', { class: 'progress__score' }, `⭐ ${score}`),
      );
    }

    function updateProgress() {
      const progress = renderProgress();
      view.progress.replaceWith(progress);
      view.progress = progress;
    }

    function renderBar(item, i) {
      return el('button', {
        class: `tati-bar ${item.done ? 'is-done' : ''} ${isPicked('bar', i) ? 'is-selected' : ''}`,
        type: 'button',
        'data-rhythm': i,
        'aria-label': item.done ? `Ритм ${saying(item.bar)}` : 'Ритм',
        onclick: () => tap({ type: 'bar', index: i }),
      }, renderRhythm([item.bar], {
        fit: BAR_WIDTH,
        // The full count stands every note over a word of its own, so the
        // notes are evenly spaced; the syllables want the eighths of a pair
        // close together and apart from their neighbours, as notes are
        // printed — so a paired bar is drawn that way, without the count.
        counts: !item.done && showsCount() && 'full',
        words: item.done,
        // the bar keeps its size when its syllables come
        rowRoom: true,
        label: item.done ? `Ритм ${saying(item.bar)}` : 'Ритм на нотном стане',
      }));
    }

    function renderCard(item, i) {
      return el('button', {
        class: `tati-card ${item.gone ? 'is-gone' : ''} ${isPicked('card', i) ? 'is-selected' : ''}`,
        type: 'button',
        'data-card': i,
        'aria-label': `Карточка ${saying(item.bar)}`,
        onclick: () => tap({ type: 'card', index: i }),
      },
        // the halves of the bar: a narrow card breaks in the middle of the bar
        el('span', { class: 'tati-card__half' }, item.bar.slice(0, 2).map(syllableModule)),
        el('span', { class: 'tati-card__half' }, item.bar.slice(2).map(syllableModule)));
    }

    function render() {
      clear(screen);
      const { bars, cards } = board();
      view = {
        progress: renderProgress(),
        feedback: el('div', { class: `feedback ${message ? `feedback--${message.kind}` : ''}` }, message ? message.text : ' '),
        lines: svgEl('svg', { class: 'tati__lines', 'aria-hidden': 'true' }),
        bars: bars.map(renderBar),
        cards: cards.map(renderCard),
      };
      view.barsColumn = el('div', { class: 'tati__col tati__col--bars' }, view.bars);
      view.board = el('div', {
        class: 'tati',
        onpointerdown: onDown,
        onpointermove: onMove,
        onpointerup: onUp,
        onpointercancel: onCancel,
      }, view.barsColumn, el('div', { class: 'tati__col tati__col--cards' }, view.cards), view.lines);

      mount(screen,
        view.progress,
        countToggle(redraw),
        el('div', { class: 'tati__task' }, 'Веди пальцем от ритма к карточке с его слогами. Одна карточка лишняя!'),
        view.feedback,
        view.board,
      );
      fit();
    }

    /**
     * Sizes the bars to the screen below the controls: as big as the room
     * for five of them allows, and no wider than their column.
     */
    function fit() {
      const { board: field, barsColumn } = view;
      if (!field || !field.isConnected) return;
      const room = window.innerHeight - (field.getBoundingClientRect().top + window.scrollY) - 24;
      const row = Math.min(MAX_ROW, Math.max(MIN_ROW, (room - GAP * (BARS - 1)) / BARS));
      const { width, height } = view.bars[0].querySelector('svg').viewBox.baseVal;
      const ratio = width / height;
      const inner = Math.min((row - PAPER_Y) * ratio, barsColumn.clientWidth - PAPER_X);
      field.style.setProperty('--bar-w', `${fixed(inner + PAPER_X)}px`);
      field.style.setProperty('--bar-h', `${fixed(inner / ratio + PAPER_Y)}px`);
    }

    /** Redraws the board as it is — for the count switch. */
    function redraw() {
      if (!locked && !drag) render();
    }

    /**
     * A screen too short for the whole board (bars don't get lower than
     * MIN_ROW) is scrolled so that the board is in sight; the controls above
     * it can be scrolled back to.
     */
    function reveal() {
      if (!view.board.isConnected) return;
      const bar = document.querySelector('.topbar');
      const box = view.board.getBoundingClientRect();
      const over = Math.min(box.bottom + 12 - window.innerHeight, box.top - (bar ? bar.offsetHeight : 0));
      if (over > 0) window.scrollBy({ top: over, behavior: calm() ? 'auto' : 'smooth' });
    }

    /** A board of the round on display, from its beginning. */
    function show(index) {
      current = index;
      selected = null;
      message = null;
      drag = null;
      locked = false;
      render();
      // after the app has scrolled a fresh section to the top
      requestAnimationFrame(reveal);
    }

    /** A fresh round — "Ещё раз". */
    function restart() {
      stopRhythm();
      const plain = shuffle(PLAIN);
      const tutti = shuffle(TUTTI);
      boards = Array.from({ length: BOARDS }, (_, b) => {
        const plainBars = BARS - TUTTI_BARS;
        const bars = shuffle([
          ...plain.slice(b * plainBars, (b + 1) * plainBars),
          ...tutti.slice(b * TUTTI_BARS, (b + 1) * TUTTI_BARS),
        ]);
        // the extra card says a bar that differs from one of the board by a single beat
        const twins = PATTERNS.filter((pattern) => !bars.includes(pattern) && bars.some((bar) => differsByOne(bar, pattern)));
        const [extra] = sample(twins, 1);
        return {
          bars: bars.map((bar) => ({ bar, done: false })),
          cards: shuffle([...bars, extra]).map((bar) => ({ bar, gone: false })),
        };
      });
      score = 0;
      tried = new Set();
      round += 1;
      show(0);
    }

    /** Where a line meets a bar (its right edge) or a card (its left edge), on the board. */
    function anchor(item) {
      const origin = view.board.getBoundingClientRect();
      const box = nodeOf(item).getBoundingClientRect();
      const x = item.type === 'bar' ? box.right - 2 : box.left + 2;
      return { x: x - origin.left, y: box.top + box.height / 2 - origin.top };
    }

    /** The bar or card a node belongs to. */
    function itemOf(node) {
      const button = node && node.closest ? node.closest('[data-rhythm], [data-card]') : null;
      if (!button || !view.board.contains(button)) return null;
      return button.dataset.rhythm !== undefined
        ? { type: 'bar', index: Number(button.dataset.rhythm) }
        : { type: 'card', index: Number(button.dataset.card) };
    }

    /** The other half of a pair under the pointer, if there is one. */
    function pairUnder(event) {
      const item = itemOf(document.elementFromPoint(event.clientX, event.clientY));
      return item && item.type !== drag.from.type && isOpen(item) ? item : null;
    }

    function hover(item) {
      if (drag.over) nodeOf(drag.over).classList.remove('is-over');
      drag.over = item;
      if (item) nodeOf(item).classList.add('is-over');
    }

    function onDown(event) {
      skipClick = false;
      if (locked || drag || !event.isPrimary || event.button > 0) return;
      const from = itemOf(event.target);
      if (!from || !isOpen(from)) return;
      drag = { from, pointer: event.pointerId, x: event.clientX, y: event.clientY, line: null, over: null };
    }

    function onMove(event) {
      if (!drag || event.pointerId !== drag.pointer) return;
      if (!drag.line) {
        // a tapping finger wobbles a little; that isn't a line yet
        if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 12) return;
        // a mouse that leaves the board keeps drawing
        view.board.setPointerCapture(event.pointerId);
        select(drag.from);
        drag.line = svgEl('path', { class: 'tati__line' });
        view.lines.append(drag.line);
      }
      const origin = view.board.getBoundingClientRect();
      drag.line.setAttribute('d', linePath(anchor(drag.from), { x: event.clientX - origin.left, y: event.clientY - origin.top }));
      const over = pairUnder(event);
      if (over?.type !== drag.over?.type || over?.index !== drag.over?.index) hover(over);
    }

    function onUp(event) {
      if (!drag || event.pointerId !== drag.pointer) return;
      const { from, line } = drag;
      const to = line ? pairUnder(event) : null;
      hover(null);
      drag = null;
      // no line: it was a tap, and the click that follows handles it
      if (!line) return;
      skipClick = true;
      if (to) {
        pair(from, to, line);
        return;
      }
      // let go short of a pair: the line goes, and its start stays picked for a tap on the pair
      fade(line);
      say(from.type === 'bar' ? 'Доведи линию до карточки' : 'Доведи линию до ритма', 'hint');
    }

    function onCancel(event) {
      if (!drag || event.pointerId !== drag.pointer) return;
      hover(null);
      if (drag.line) drag.line.remove();
      drag = null;
    }

    function tap(item) {
      if (skipClick) {
        skipClick = false;
        return;
      }
      if (locked) return;
      // a bar with its syllables only plays again
      if (item.type === 'bar' && board().bars[item.index].done) {
        playRhythm(view.bars[item.index]);
        return;
      }
      if (!isOpen(item)) return;
      if (!selected || selected.type === item.type) {
        // the first half of a pair; tapping it again lets it go
        const next = isPicked(item.type, item.index) ? null : item;
        select(next);
        if (next) say(item.type === 'bar' ? 'Теперь найди карточку с его слогами' : 'Теперь найди ритм с этими слогами', 'hint');
        else say(null, 'hint');
        return;
      }
      pair(selected, item, null);
    }

    /** A bar and a card put together, by a drawn `line` or by two taps. */
    function pair(a, b, line) {
      const r = a.type === 'bar' ? a.index : b.index;
      const c = a.type === 'card' ? a.index : b.index;
      const { bar } = board().bars[r];
      const isRight = saying(bar) === saying(board().cards[c].bar);
      const key = `${current}:${r}`;
      const isFirstTry = !tried.has(key);
      tried.add(key);
      if (isFirstTry) store.recordAnswer(saying(bar), isRight);

      // a drawn line snaps onto the pair; two taps get a line that grows by itself
      const drawn = line || svgEl('path', { class: 'tati__line' });
      drawn.setAttribute('d', linePath(anchor({ type: 'bar', index: r }), anchor({ type: 'card', index: c })));
      if (!line) {
        view.lines.append(drawn);
        const length = drawn.getTotalLength();
        drawn.animate(
          [{ strokeDasharray: `${length}px`, strokeDashoffset: `${length}px` }, { strokeDasharray: `${length}px`, strokeDashoffset: '0px' }],
          { duration: 300, easing: 'ease-out' },
        );
      }

      if (isRight) {
        if (isFirstTry) score += 1;
        match(r, c, drawn);
      } else {
        miss(r, c, drawn);
      }
    }

    /** A wrong card: say what the bar says and keep the bar picked for its real card. */
    function miss(r, c, line) {
      playFail();
      select({ type: 'bar', index: r });
      say(`Нет, здесь ${saying(board().bars[r].bar)}. Найди эту карточку`, 'bad');
      line.classList.add('tati__line--wrong');
      fade(line, { duration: 400, delay: 400 });
      const card = view.cards[c];
      card.classList.add('is-shaking');
      card.addEventListener('animationend', () => card.classList.remove('is-shaking'), { once: true });
    }

    async function match(r, c, line) {
      locked = true;
      const now = round;
      const { bars } = board();
      bars[r].done = true;
      board().cards[c].gone = true;
      select(null);
      say(praise(), 'good');

      await fly(r, c, line);
      if (cancelled || now !== round) return;
      // the bar says its syllables now and plays with them
      const node = renderBar(bars[r], r);
      node.classList.add('is-new');
      view.bars[r].replaceWith(node);
      view.bars[r] = node;
      updateProgress();
      const played = new Promise((resolve) => {
        playRhythm(node, { onEnd: resolve });
      });
      if (bars.some((item) => !item.done)) {
        locked = false;
        return;
      }
      // the last bar of the board is heard to the end before the board goes
      await played;
      if (cancelled || now !== round) return;
      finish();
    }

    /** The card flies along the line under its bar, and goes. */
    async function fly(r, c, line) {
      const card = view.cards[c];
      const target = view.bars[r];
      await delay(250);
      fade(line, { duration: 450 });
      if (!calm() && card.isConnected) {
        const from = card.getBoundingClientRect();
        const to = target.getBoundingClientRect();
        const dx = to.left + to.width / 2 - (from.left + from.width / 2);
        const dy = to.bottom - to.height * 0.2 - (from.top + from.height / 2);
        card.classList.add('is-flying');
        const flight = card.animate(
          [{ transform: 'none', opacity: 1 }, { transform: `translate(${fixed(dx)}px, ${fixed(dy)}px) scale(.4)`, opacity: 0.15 }],
          { duration: 500, easing: 'ease-in', fill: 'forwards' },
        );
        await flight.finished.catch(() => {});
        card.classList.add('is-gone');
        card.classList.remove('is-flying');
        flight.cancel();
      } else {
        card.classList.add('is-gone');
      }
    }

    async function finish() {
      const now = round;
      const extra = view.cards.find((_, i) => !board().cards[i].gone);
      if (extra) extra.classList.add('tati-card--extra');
      const isLast = current === boards.length - 1;
      say(isLast ? 'Все ритмы нашли свои слоги! А эта карточка — лишняя' : 'Все ритмы со слогами! А эта карточка — лишняя', 'good');
      view.board.classList.add('tati--done');
      await delay(2200);
      if (cancelled || now !== round) return;
      if (!isLast) {
        show(current + 1);
        return;
      }
      locked = false;
      clear(screen);
      screen.append(renderRoundResult({ id: ID, group: GROUP, score, total: BOARDS * BARS, onRestart: restart }));
    }

    window.addEventListener('resize', fit);
    restart();
    return () => {
      cancelled = true;
      stopRhythm();
      window.removeEventListener('resize', fit);
    };
  },
};
