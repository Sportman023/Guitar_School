// "Pick the berries": a game after a music-school worksheet. Strawberries with
// a note on the staff grow on the field, and under them stands a basket with
// a note name on it. Only the berries with that note go into the basket: tap a
// berry and it hops in, or carry it there with a finger. A wrong berry stays
// where it grew. A round is three baskets in turn, each for a note of its own
// picked at random, with a fresh field of nine berries, three or four of
// which are the right ones: ten in a round, as in every game of the topic.
//
// As in "Pumpkins and leaves", the basket carries the name only: that note in
// any of the octaves picked on the chips goes in. The note heads follow the
// shared "coloured notes" toggle.
//
// Every right berry is a star, but a wrong one takes the star of the next
// right berry: the stars on display never go down, and only a round without a
// mistake gets them all.
//
// A finger carrying a berry can't scroll the page, so the berries and the
// basket fit the screen below the controls, as in the pumpkin game.

import { el, clear, mount, shuffle, svgEl, delay } from '../core/ui.js';
import { renderStaff, tightStaffBox } from '../core/staff.js';
import { colorToggle, octaveChips, drilledNotes } from '../core/controls.js';
import { praise, renderRoundResult, buildQueue } from '../core/quiz.js';
import { store } from '../core/store.js';
import { playFail } from '../core/audio.js';
import { loadPiano, playPiano } from '../core/piano.js';
import { NOTES, isMixed, octaveName } from '../data/notes.js';

const ID = 'berries';
const GROUP = 'note-games';
const ACCENT = '#D81B60';
const BASKETS = 3;
const BERRIES = 9;
// how many of the nine berries are the right ones, for the baskets of a
// round in random order: ten in all
const RIGHT = [3, 3, 4];
// berries stand in rows of three, or of five and four as on the sheet;
// the one with the bigger berries is taken
const COLUMNS = [3, 5];
// the gap between the berries and above the basket, as in styles.css
const GAP = 6;
// a berry is never lower than this, even on a short screen (then the page
// scrolls), and never higher than that, so it doesn't swell on a big one
const MIN_BERRY = 70;
const MAX_BERRY = 230;
// the basket is as tall as this many berries
const BASKET_ROWS = 0.85;

// The berry is drawn 80 × 100 and shown from y = 6, where its stem begins,
// so there is no empty strip over it; the basket is drawn 160 × 120. The
// points below are in the same units.
const BERRY = { top: 6, width: 80, height: 94 };
const BASKET = { width: 160, height: 120 };
// where a berry drops into the basket
const OPENING = { x: 80, y: 52 };
// small berries peeking out of the basket, one for every berry put in
const PILE = [[42, 30], [68, 27], [94, 30], [56, 17]];

const BODY = 'M40 99 C18 93 3 70 3 47 C3 30 17 22 40 23 C63 22 77 30 77 47 C77 70 62 93 40 99 Z';
// seeds on the rim the white face leaves
const SEEDS = [[9, 40], [8, 55], [12, 70], [20, 83], [33, 91], [47, 91], [60, 83], [68, 70], [72, 55], [71, 40], [16, 30], [64, 30]];

const fixed = (n) => Number(n.toFixed(1));

const calm = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** The flesh and the green star of sepals on top, without the seeds — also for the small berries in the basket. */
function berryShape() {
  const sepals = Array.from({ length: 14 }, (_, i) => {
    const angle = (Math.PI / 7) * i + Math.PI / 14;
    const [rx, ry] = i % 2 ? [6, 4] : [23, 12];
    return `${fixed(40 + rx * Math.cos(angle))},${fixed(22 + ry * Math.sin(angle))}`;
  });
  return [
    svgEl('path', { d: BODY, class: 'berry__flesh' }),
    svgEl('path', { d: 'M40 20 C40 15 42 11 46 8', class: 'berry__stem' }),
    svgEl('polygon', { points: sepals.join(' '), class: 'berry__sepals' }),
  ];
}

function berryArt() {
  const [flesh, ...top] = berryShape();
  return svgEl('svg', { viewBox: `0 ${BERRY.top} ${BERRY.width} ${BERRY.height}`, class: 'berry__art', 'aria-hidden': 'true' },
    flesh,
    ...SEEDS.map(([cx, cy]) => svgEl('ellipse', { cx, cy, rx: 1.4, ry: 2.2, class: 'berry__seed' })),
    ...top);
}

/** A wicker basket with the note name on a plate, and the berries put in it peeking out. */
function basketArt(name) {
  // the sides lean in towards the bottom
  const edge = (y) => fixed(16 + ((y - 58) * 12) / 55);
  return svgEl('svg', { viewBox: `0 0 ${BASKET.width} ${BASKET.height}`, class: 'basket__art', 'aria-hidden': 'true' },
    svgEl('path', { d: 'M30 60 C30 2 130 2 130 60', class: 'basket__handle' }),
    // the berry is scaled from the outside, so its own transform is free for popping in
    PILE.map(([x, y]) => svgEl('g', { transform: `translate(${x} ${y}) scale(.3)` },
      svgEl('g', { class: 'basket__berry' }, berryShape()))),
    svgEl('path', { d: 'M16 58 H144 L132 113 Q131 118 125 118 H35 Q29 118 28 113 Z', class: 'basket__wicker' }),
    [72, 86, 100].map((y) => svgEl('line', { x1: edge(y), x2: BASKET.width - edge(y), y1: y, y2: y, class: 'basket__weave' })),
    [40, 56, 72, 88, 104, 120].map((x) => svgEl('line', { x1: x, x2: x, y1: 64, y2: 114, class: 'basket__weave' })),
    svgEl('rect', { x: 10, y: 52, width: 140, height: 12, rx: 6, class: 'basket__rim' }),
    svgEl('rect', { x: 50, y: 76, width: 60, height: 30, rx: 6, class: 'basket__plate' }),
    // "Соль" is twice as long as the other names
    svgEl('text', { x: 80, y: 92, class: `basket__name ${name.length > 2 ? 'basket__name--long' : ''}` }, name));
}

export default {
  id: ID,
  title: 'Собери ягодки',
  subtitle: 'Только ягодки с нужной нотой',
  emoji: '🍓',
  accent: ACCENT,
  group: GROUP,

  mount(root) {
    // start downloading the piano now, so the first berry in the basket isn't silent
    loadPiano();

    const screen = el('div', { class: 'screen berry-game', style: `--accent:${ACCENT}` });
    root.append(screen);

    let pool;
    // { target, berries: [{ note, picked }] } for every basket of the round;
    // `target` is the first-octave note of the name on the basket
    let baskets;
    // the basket on display
    let current;
    // one box for every berry of the round, so the staves don't change size
    let box;
    let score;
    // stars that wrong berries have taken from the right berries still to come
    let owed;
    let message;
    // a berry being carried: which, the pointer carrying it, where it went
    // down and how far it has been taken
    let drag = null;
    // a carried berry can end with a click on it; that click isn't a tap
    let skipClick = false;
    let locked;
    let cancelled = false;
    // bumped on every new round, so an animation still running doesn't move
    // a round that has been restarted
    let round = 0;
    // nodes on display, so a tap changes them without redrawing the screen
    let view = {};

    const label = (note) => (isMixed(pool) ? `${note.ru} ${octaveName(note)}` : note.ru);
    const basket = () => baskets[current];
    const fits = (item, berry) => berry.note.pc === item.target.pc;
    const isRight = (berry) => fits(basket(), berry);
    // right berries of the whole round, and how many of them are in baskets
    const total = () => baskets.reduce((sum, item) => sum + item.berries.filter((berry) => fits(item, berry)).length, 0);
    const picked = () => baskets.reduce((sum, item) => sum + item.berries.filter((berry) => berry.picked).length, 0);

    function say(text, kind) {
      message = text ? { text, kind } : null;
      view.feedback.textContent = text || ' ';
      view.feedback.className = `feedback feedback--${kind}`;
    }

    function renderProgress() {
      const done = picked();
      return el('div', { class: 'progress' },
        el('div', { class: 'progress__dots' },
          Array.from({ length: total() }, (_, i) => el('span', { class: `dot ${i < done ? 'dot--done' : ''}` }))),
        el('div', { class: 'progress__score' }, `⭐ ${score}`),
      );
    }

    function updateProgress() {
      const progress = renderProgress();
      view.progress.replaceWith(progress);
      view.progress = progress;
    }

    /** Shows a small berry in the basket for every berry put in. */
    function showPile() {
      const count = basket().berries.filter((berry) => berry.picked).length;
      view.pile.forEach((node, i) => node.classList.toggle('is-in', i < count));
    }

    function renderBerry(berry, i, colored, fresh) {
      return el('button', {
        class: `berry ${berry.picked ? 'is-picked' : ''} ${fresh ? 'is-new' : ''}`,
        type: 'button',
        'data-berry': i,
        'aria-label': 'Ягодка',
        onclick: () => tap(i),
      },
        el('span', { class: 'berry__body' },
          berryArt(),
          el('span', { class: 'berry__face' }, renderStaff(berry.note, { colored, box, narrow: true }))));
    }

    /** Draws the basket on display; `fresh` — its berries have just grown and pop in. */
    function render(fresh = false) {
      clear(screen);
      const colored = store.setting('coloredHeads', true);
      const { target, berries } = basket();
      view = {
        progress: renderProgress(),
        feedback: el('div', { class: `feedback ${message ? `feedback--${message.kind}` : ''}` }, message ? message.text : ' '),
        berries: berries.map((berry, i) => renderBerry(berry, i, colored, fresh)),
        basket: el('div', { class: 'basket', role: 'img', 'aria-label': `Корзинка для ноты ${target.ru}` }, basketArt(target.ru)),
      };
      view.pile = [...view.basket.querySelectorAll('.basket__berry')];
      view.board = el('div', {
        class: 'orchard',
        onpointerdown: onDown,
        onpointermove: onMove,
        onpointerup: onUp,
        onpointercancel: onCancel,
      }, el('div', { class: 'berries' }, view.berries), view.basket);
      showPile();

      mount(screen,
        view.progress,
        octaveChips(restart),
        colorToggle(redraw),
        el('div', { class: 'orchard__task' }, 'Собери в корзинку только ягодки с нотой ', el('b', null, target.ru)),
        view.feedback,
        view.board,
      );
      fit();
    }

    /** Sizes the berries and the basket to the screen below the controls. */
    function fit() {
      const { board } = view;
      if (!board || !board.isConnected) return;
      const width = board.clientWidth;
      const room = window.innerHeight - (board.getBoundingClientRect().top + window.scrollY) - 24;
      const ratio = BERRY.width / BERRY.height;
      // how tall a berry can be with that many in a row
      const heightOf = (cols) => {
        const rows = Math.ceil(BERRIES / cols);
        const byWidth = (width - GAP * (cols - 1)) / cols / ratio;
        const byRoom = (room - GAP * rows) / (rows + BASKET_ROWS);
        return Math.min(byWidth, Math.max(MIN_BERRY, Math.min(MAX_BERRY, byRoom)));
      };
      const cols = COLUMNS.reduce((best, item) => (heightOf(item) > heightOf(best) ? item : best));
      const height = heightOf(cols);
      board.style.setProperty('--cols', cols);
      board.style.setProperty('--berry', `${fixed(height * ratio)}px`);
      board.style.setProperty('--basket', `${fixed(height * BASKET_ROWS)}px`);
    }

    /**
     * A screen too short for the berries and the basket (berries don't get
     * lower than MIN_BERRY) is scrolled so that they are in sight; the
     * controls above them can be scrolled back to.
     */
    function reveal() {
      if (!view.board.isConnected) return;
      const bar = document.querySelector('.topbar');
      const rect = view.board.getBoundingClientRect();
      const over = Math.min(rect.bottom + 12 - window.innerHeight, rect.top - (bar ? bar.offsetHeight : 0));
      if (over > 0) window.scrollBy({ top: over, behavior: calm() ? 'auto' : 'smooth' });
    }

    /** Redraws the basket as it is — for the colour toggle. */
    function redraw() {
      if (!locked && !drag) render();
    }

    /** A fresh round — "Ещё раз", or octave chips that changed the set of notes. */
    function restart() {
      pool = drilledNotes();
      // only names that the picked octaves have: the small octave starts at Ми
      const names = shuffle(NOTES.filter((name) => pool.some((note) => note.pc === name.pc))).slice(0, BASKETS);
      const counts = shuffle(RIGHT);
      baskets = names.map((target, i) => {
        const right = pool.filter((note) => note.pc === target.pc);
        const wrong = pool.filter((note) => note.pc !== target.pc);
        const count = counts[i];
        const notes = shuffle([...buildQueue(right, count), ...buildQueue(wrong, BERRIES - count)]);
        return { target, berries: notes.map((note) => ({ note, picked: false })) };
      });
      box = tightStaffBox(baskets.flatMap((item) => item.berries.map((berry) => berry.note)));
      current = 0;
      score = 0;
      owed = 0;
      message = null;
      drag = null;
      locked = false;
      round += 1;
      render(true);
      // after the app has scrolled a fresh section to the top
      requestAnimationFrame(reveal);
    }

    function berryOf(node) {
      const button = node && node.closest ? node.closest('[data-berry]') : null;
      return button && view.board.contains(button) ? Number(button.dataset.berry) : null;
    }

    function isOverBasket(event) {
      const rect = view.basket.getBoundingClientRect();
      return event.clientX >= rect.left && event.clientX <= rect.right
        && event.clientY >= rect.top && event.clientY <= rect.bottom;
    }

    /** A berry carried and let go short of the basket goes back where it grew. */
    function putBack(node, dx, dy) {
      node.style.transform = '';
      node.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 250, easing: 'ease-out' });
    }

    function onDown(event) {
      skipClick = false;
      if (locked || drag || !event.isPrimary || event.button > 0) return;
      const index = berryOf(event.target);
      if (index === null || basket().berries[index].picked) return;
      drag = { index, pointer: event.pointerId, x: event.clientX, y: event.clientY, dx: 0, dy: 0, moved: false };
    }

    function onMove(event) {
      if (!drag || event.pointerId !== drag.pointer) return;
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      if (!drag.moved) {
        // a tapping finger wobbles a little; that isn't carrying yet
        if (Math.hypot(dx, dy) < 10) return;
        drag.moved = true;
        // a mouse that leaves the board keeps carrying
        view.board.setPointerCapture(event.pointerId);
        view.berries[drag.index].classList.add('is-carried');
      }
      drag.dx = dx;
      drag.dy = dy;
      view.berries[drag.index].style.transform = `translate(${dx}px, ${dy}px)`;
      view.basket.classList.toggle('is-over', isOverBasket(event));
    }

    function onUp(event) {
      if (!drag || event.pointerId !== drag.pointer) return;
      const { index, moved, dx, dy } = drag;
      const isIn = moved && isOverBasket(event);
      drag = null;
      view.basket.classList.remove('is-over');
      // not moved: it was a tap, and the click that follows handles it
      if (!moved) return;
      skipClick = true;
      view.berries[index].classList.remove('is-carried');
      if (isIn) {
        pick(index, dx, dy);
        return;
      }
      putBack(view.berries[index], dx, dy);
      say('Донеси ягодку до корзинки', 'hint');
    }

    function onCancel(event) {
      if (!drag || event.pointerId !== drag.pointer) return;
      const node = view.berries[drag.index];
      node.classList.remove('is-carried');
      putBack(node, drag.dx, drag.dy);
      view.basket.classList.remove('is-over');
      drag = null;
    }

    function tap(index) {
      if (skipClick) {
        skipClick = false;
        return;
      }
      if (locked || basket().berries[index].picked) return;
      pick(index, 0, 0);
    }

    /** A berry for the basket — tapped, or carried there and dx, dy away from where it grew. */
    function pick(index, dx, dy) {
      const berry = basket().berries[index];
      const node = view.berries[index];
      const right = isRight(berry);
      store.recordAnswer(berry.note.id, right);
      if (right) {
        collect(index, dx, dy);
        return;
      }
      owed += 1;
      playFail();
      // short enough for one line on a phone, so the berries don't jump down
      say(`Нет, это ${label(berry.note)}, а нужна ${basket().target.ru}`, 'bad');
      if (dx || dy) putBack(node, dx, dy);
      node.classList.add('is-shaking');
      node.addEventListener('animationend', () => node.classList.remove('is-shaking'), { once: true });
    }

    async function collect(index, dx, dy) {
      locked = true;
      const now = round;
      const { berries } = basket();
      berries[index].picked = true;
      if (owed) owed -= 1;
      else score += 1;
      playPiano(berries[index].note.freq);
      const left = berries.filter((berry) => !berry.picked && isRight(berry)).length;
      const isLast = current === baskets.length - 1;
      if (left) say(praise(), 'good');
      else say(isLast ? 'Все корзинки полные! 🍓' : 'Корзинка полная! 🍓', 'good');

      await fly(index, dx, dy);
      if (cancelled || now !== round) return;
      showPile();
      updateProgress();
      if (left) {
        locked = false;
        return;
      }

      view.basket.classList.add('is-full');
      await delay(1400);
      if (cancelled || now !== round) return;
      if (isLast) {
        locked = false;
        clear(screen);
        screen.append(renderRoundResult({ id: ID, group: GROUP, score, total: total(), onRestart: restart }));
        return;
      }
      // the next basket, with berries of its own
      current += 1;
      message = null;
      render(true);
      locked = false;
    }

    /** The berry hops from where it is into the basket. */
    async function fly(index, dx, dy) {
      const node = view.berries[index];
      if (calm() || !node.isConnected) {
        node.style.transform = '';
        node.classList.add('is-picked');
        return;
      }
      const from = node.getBoundingClientRect();
      const to = view.basket.getBoundingClientRect();
      const tx = to.left + to.width * (OPENING.x / BASKET.width) - (from.left + from.width / 2);
      const ty = to.top + to.height * (OPENING.y / BASKET.height) - (from.top + from.height / 2);
      node.classList.add('is-flying');
      const flight = node.animate([
        { transform: `translate(${dx}px, ${dy}px)`, opacity: 1 },
        { transform: `translate(${fixed(dx + tx / 2)}px, ${fixed(dy + ty / 2 - 40)}px) scale(.7)`, opacity: 1, offset: 0.5 },
        { transform: `translate(${fixed(dx + tx)}px, ${fixed(dy + ty)}px) scale(.3)`, opacity: 0.6 },
      ], { duration: 550, easing: 'ease-in', fill: 'forwards' });
      await flight.finished.catch(() => {});
      node.style.transform = '';
      node.classList.add('is-picked');
      node.classList.remove('is-flying');
      flight.cancel();
    }

    window.addEventListener('resize', fit);
    restart();
    return () => {
      cancelled = true;
      window.removeEventListener('resize', fit);
    };
  },
};
