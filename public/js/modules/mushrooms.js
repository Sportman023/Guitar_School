// "Pick the mushrooms": a sorting game after an autumn worksheet from the
// music school. Mushrooms grow on a glade, each with a short rhythm on its cap
// — one bar of two, three or four beats — and under them stand three baskets
// marked 2/4, 3/4 and 4/4. Count the beats of a mushroom and put it into the
// basket of its time signature: tap the mushroom and then the basket (or the
// basket first), or carry the mushroom there with a finger. A mushroom in the
// right basket plays its rhythm on the piano, the strong first beat louder,
// and peeks out of the basket. A round is two glades of five mushrooms, ten in
// all, with mushrooms for every basket on each glade; the baskets stay and
// fill up.
//
// The "count under the notes" switch puts "1 и 2 и…" under the notes on the
// caps, as in the games of the "Rhythm" topic. A finger carrying a mushroom
// can't scroll the page, so the glade and the baskets fit the screen below
// the controls, as in "Pick the berries".
//
// A point is a mushroom put into the right basket at the first try. After a
// wrong basket the child is told how many beats the mushroom has and finds its
// basket, without the point.

import { el, clear, mount, svgEl, delay } from '../core/ui.js';
import { renderRhythm, playRhythm, stopRhythm } from '../core/rhythm.js';
import { countToggle, showsCount } from '../core/controls.js';
import { praise, renderRoundResult, buildQueue } from '../core/quiz.js';
import { store } from '../core/store.js';
import { playFail } from '../core/audio.js';
import { loadPiano } from '../core/piano.js';
import { METERS, beatsWord, randomBar } from '../data/rhythm.js';

const ID = 'mushrooms';
const GROUP = 'rhythm-play';
const ACCENT = '#8D6E63';
const GLADES = 2;
const MUSHROOMS = 5;
// mushrooms stand in rows of two or three on a phone, of five on a wide
// screen; the one with the bigger mushrooms is taken
const COLUMNS = [2, 3, 5];
// the gap between the mushrooms and above the baskets, as in styles.css
const GAP = 6;
// a mushroom is never narrower than this, even on a short screen (then the
// page scrolls), and never wider than that, so it doesn't swell on a big one
const MIN_MUSHROOM = 96;
const MAX_MUSHROOM = 240;
// the baskets are as tall as this many mushrooms
const BASKET_ROWS = 0.8;

// The mushroom is drawn 140 × 104, a wide cap for a bar of four beats; the
// basket is drawn 160 × 120. The points below are in the same units.
const MUSHROOM = { width: 140, height: 104 };
const BASKET = { width: 160, height: 120 };
// where a mushroom drops into the basket
const OPENING = { x: 80, y: 52 };
// small mushrooms peeking out of the basket, one for every mushroom put in
const PILE = [[46, 30], [82, 24], [112, 31], [64, 15]];

const fixed = (n) => Number(n.toFixed(1));

/** The notes of a cap: one bar on its own, without a staff. */
const capRhythm = (bar, counts) => renderRhythm([bar], {
  staff: false,
  barlines: false,
  final: false,
  counts,
  label: 'Ритм на шляпке',
});

const pictureWidth = (picture) => Number(picture.getAttribute('viewBox').split(' ')[2]);
// the longest bar on a cap fills it; the notes of every cap are drawn as big
// as those, so a shorter bar is a narrower picture
const LONGEST = pictureWidth(capRhythm(['q', 'q', 'q', 'q'], false));

const calm = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * A field mushroom: a round, wide pale cap on a white stem, with room for a
 * bar of four beats across its lower part — also small, for the baskets.
 */
function mushroomShape() {
  return [
    svgEl('path', { d: 'M54 62 C52 76 49 90 53 99 C60 104 80 104 87 99 C91 90 88 76 86 62 Z', class: 'shroom__stem' }),
    svgEl('path', { d: 'M18 66 C40 60 100 60 122 66 C110 72 30 72 18 66 Z', class: 'shroom__gills' }),
    svgEl('path', {
      d: 'M4 60 C4 22 28 5 70 5 C112 5 136 22 136 60 C136 67 129 69 119 67 C97 62 43 62 21 67 C11 69 4 67 4 60 Z',
      class: 'shroom__cap',
    }),
  ];
}

function mushroomArt() {
  return svgEl('svg', { viewBox: `0 0 ${MUSHROOM.width} ${MUSHROOM.height}`, class: 'shroom__art', 'aria-hidden': 'true' },
    mushroomShape(),
    svgEl('path', { d: 'M14 36 C18 22 30 13 44 10', class: 'shroom__shine' }));
}

/** A wicker basket with the time signature on a plate, and the mushrooms put in it peeking out. */
function basketArt(meter) {
  // the sides lean in towards the bottom
  const edge = (y) => fixed(16 + ((y - 58) * 12) / 55);
  return svgEl('svg', { viewBox: `0 0 ${BASKET.width} ${BASKET.height}`, class: 'shroom-basket__art', 'aria-hidden': 'true' },
    svgEl('path', { d: 'M30 60 C30 2 130 2 130 60', class: 'shroom-basket__handle' }),
    // the mushroom is scaled from the outside, so its own transform is free for popping in
    PILE.map(([x, y]) => svgEl('g', { transform: `translate(${x - 21} ${y - 6}) scale(.3)` },
      svgEl('g', { class: 'shroom-basket__mushroom' }, mushroomShape()))),
    svgEl('path', { d: 'M16 58 H144 L132 113 Q131 118 125 118 H35 Q29 118 28 113 Z', class: 'shroom-basket__wicker' }),
    [72, 86, 100].map((y) => svgEl('line', { x1: edge(y), x2: BASKET.width - edge(y), y1: y, y2: y, class: 'shroom-basket__weave' })),
    [40, 56, 72, 88, 104, 120].map((x) => svgEl('line', { x1: x, x2: x, y1: 64, y2: 114, class: 'shroom-basket__weave' })),
    svgEl('rect', { x: 10, y: 52, width: 140, height: 12, rx: 6, class: 'shroom-basket__rim' }),
    svgEl('rect', { x: 57, y: 67, width: 46, height: 46, rx: 8, class: 'shroom-basket__plate' }),
    svgEl('text', { x: 80, y: 80, class: 'shroom-basket__meter' }, String(meter.top)),
    svgEl('text', { x: 80, y: 101, class: 'shroom-basket__meter' }, String(meter.bottom)));
}

/** Five mushrooms of a glade: every basket gets at least one, and no two caps are alike. */
function glade() {
  const meters = buildQueue(METERS, MUSHROOMS);
  const seen = new Set();
  return meters.map((meter) => {
    let bar;
    // a bar of two beats has only a few kinds, so it may come twice after all
    for (let tries = 0; tries < 20; tries++) {
      bar = randomBar(meter.beats);
      if (!seen.has(bar.join())) break;
    }
    seen.add(bar.join());
    return { meter, bar, picked: false };
  });
}

export default {
  id: ID,
  title: 'Собери грибочки',
  subtitle: 'Разложи грибочки по корзинкам 2/4, 3/4, 4/4',
  emoji: '🍄',
  accent: ACCENT,
  group: GROUP,

  mount(root) {
    // start downloading the piano now, so the first mushroom in a basket isn't silent
    loadPiano();

    const screen = el('div', { class: 'screen shrooms-game', style: `--accent:${ACCENT}` });
    root.append(screen);

    // [{ meter, bar, picked }] for every glade of the round
    let glades;
    // the glade on display
    let current;
    // how many mushrooms every basket has got this round, by meter id
    let filled;
    let score;
    // mushrooms put into a basket at least once: only the first try scores
    let tried;
    // { type: 'mushroom' | 'basket', index } — what was tapped first, waiting for its pair
    let selected;
    let message;
    // a mushroom being carried: which, the pointer carrying it, where it went
    // down and how far it has been taken
    let drag = null;
    // a carried mushroom can end with a click on it; that click isn't a tap
    let skipClick = false;
    let locked;
    let cancelled = false;
    // bumped on every new round, so an animation still running doesn't move
    // a round that has been restarted
    let round = 0;
    // nodes on display, so a tap changes them without redrawing the screen
    let view = {};

    const mushrooms = () => glades[current];
    const isPicked = (type, index) => Boolean(selected && selected.type === type && selected.index === index);
    const pickedCount = () => glades.reduce((sum, list) => sum + list.filter((item) => item.picked).length, 0);

    function say(text, kind) {
      message = text ? { text, kind } : null;
      view.feedback.textContent = text || ' ';
      view.feedback.className = `feedback feedback--${kind}`;
    }

    /** Lights up what was tapped first, without redrawing the glade. */
    function select(next) {
      selected = next;
      view.mushrooms.forEach((node, i) => node.classList.toggle('is-selected', isPicked('mushroom', i)));
      view.baskets.forEach((node, i) => node.classList.toggle('is-selected', isPicked('basket', i)));
    }

    function renderProgress() {
      const done = pickedCount();
      return el('div', { class: 'progress' },
        el('div', { class: 'progress__dots' },
          Array.from({ length: GLADES * MUSHROOMS }, (_, i) => el('span', { class: `dot ${i < done ? 'dot--done' : ''}` }))),
        el('div', { class: 'progress__score' }, `⭐ ${score}`),
      );
    }

    function updateProgress() {
      const progress = renderProgress();
      view.progress.replaceWith(progress);
      view.progress = progress;
    }

    /** Shows a small mushroom in every basket for every mushroom put in. */
    function showPiles() {
      view.baskets.forEach((node, i) => {
        const count = filled[METERS[i].id];
        node.querySelectorAll('.shroom-basket__mushroom').forEach((small, k) => small.classList.toggle('is-in', k < count));
      });
    }

    function renderMushroom(item, i, fresh) {
      const picture = capRhythm(item.bar, showsCount() && 'full');
      // a shorter bar is a narrower picture with notes of the same size
      picture.style.width = `${fixed((pictureWidth(picture) / LONGEST) * 100)}%`;
      return el('button', {
        class: `shroom ${item.picked ? 'is-picked' : ''} ${fresh ? 'is-new' : ''} ${isPicked('mushroom', i) ? 'is-selected' : ''}`,
        type: 'button',
        'data-mushroom': i,
        'aria-label': 'Грибочек',
        onclick: () => tap({ type: 'mushroom', index: i }),
      },
        el('span', { class: 'shroom__body' },
          mushroomArt(),
          el('span', { class: 'shroom__face' }, picture)));
    }

    function renderBasket(meter, i) {
      return el('button', {
        class: `shroom-basket ${isPicked('basket', i) ? 'is-selected' : ''}`,
        type: 'button',
        'data-basket': i,
        'aria-label': `Корзинка ${meter.label}`,
        onclick: () => tap({ type: 'basket', index: i }),
      }, basketArt(meter));
    }

    /** Draws the glade on display; `fresh` — its mushrooms have just grown and pop in. */
    function render(fresh = false) {
      clear(screen);
      view = {
        progress: renderProgress(),
        feedback: el('div', { class: `feedback ${message ? `feedback--${message.kind}` : ''}` }, message ? message.text : ' '),
        mushrooms: mushrooms().map((item, i) => renderMushroom(item, i, fresh)),
        baskets: METERS.map(renderBasket),
      };
      view.board = el('div', {
        class: 'glade',
        onpointerdown: onDown,
        onpointermove: onMove,
        onpointerup: onUp,
        onpointercancel: onCancel,
      },
        el('div', { class: 'glade__mushrooms' }, view.mushrooms),
        el('div', { class: 'glade__baskets' }, view.baskets));
      showPiles();

      mount(screen,
        view.progress,
        countToggle(redraw),
        el('div', { class: 'glade__task' }, 'Сосчитай доли в грибочке и положи его в корзинку с таким размером.'),
        view.feedback,
        view.board,
      );
      fit();
    }

    /** Sizes the mushrooms and the baskets to the screen below the controls. */
    function fit() {
      const { board } = view;
      if (!board || !board.isConnected) return;
      const width = board.clientWidth;
      const room = window.innerHeight - (board.getBoundingClientRect().top + window.scrollY) - 24;
      const ratio = MUSHROOM.height / MUSHROOM.width;
      // how wide a mushroom can be with that many in a row
      const widthOf = (cols) => {
        const rows = Math.ceil(MUSHROOMS / cols);
        const byWidth = (width - GAP * (cols - 1)) / cols;
        const byRoom = (room - GAP * rows) / (rows + BASKET_ROWS) / ratio;
        return Math.min(byWidth, Math.max(MIN_MUSHROOM, Math.min(MAX_MUSHROOM, byRoom)));
      };
      const cols = COLUMNS.reduce((best, item) => (widthOf(item) > widthOf(best) ? item : best));
      const size = widthOf(cols);
      const basket = Math.min(size * ratio * BASKET_ROWS, ((width - GAP * 2) / 3) * (BASKET.height / BASKET.width));
      board.style.setProperty('--cols', cols);
      board.style.setProperty('--mushroom', `${fixed(size)}px`);
      board.style.setProperty('--basket', `${fixed(basket)}px`);
    }

    /**
     * A screen too short for the glade and the baskets (mushrooms don't get
     * smaller than MIN_MUSHROOM) is scrolled so that they are in sight; the
     * controls above them can be scrolled back to.
     */
    function reveal() {
      if (!view.board.isConnected) return;
      const bar = document.querySelector('.topbar');
      const rect = view.board.getBoundingClientRect();
      const over = Math.min(rect.bottom + 12 - window.innerHeight, rect.top - (bar ? bar.offsetHeight : 0));
      if (over > 0) window.scrollBy({ top: over, behavior: calm() ? 'auto' : 'smooth' });
    }

    /** Redraws the glade as it is — for the count switch. */
    function redraw() {
      if (!locked && !drag) render();
    }

    /** A glade of the round on display, with its mushrooms popping in. */
    function show(index) {
      current = index;
      selected = null;
      message = null;
      drag = null;
      locked = false;
      render(true);
      // after the app has scrolled a fresh section to the top
      requestAnimationFrame(reveal);
    }

    /** A fresh round — "Ещё раз". */
    function restart() {
      stopRhythm();
      glades = Array.from({ length: GLADES }, glade);
      filled = Object.fromEntries(METERS.map((meter) => [meter.id, 0]));
      score = 0;
      tried = new Set();
      round += 1;
      show(0);
    }

    function itemOf(node) {
      const button = node && node.closest ? node.closest('[data-mushroom], [data-basket]') : null;
      if (!button || !view.board.contains(button)) return null;
      return button.dataset.mushroom !== undefined
        ? { type: 'mushroom', index: Number(button.dataset.mushroom) }
        : { type: 'basket', index: Number(button.dataset.basket) };
    }

    /** The basket under the pointer, if any. */
    function basketUnder(event) {
      return view.baskets.findIndex((node) => {
        const rect = node.getBoundingClientRect();
        return event.clientX >= rect.left && event.clientX <= rect.right
          && event.clientY >= rect.top && event.clientY <= rect.bottom;
      });
    }

    /** A mushroom carried and let go short of a basket goes back where it grew. */
    function putBack(node, dx, dy) {
      node.style.transform = '';
      node.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 250, easing: 'ease-out' });
    }

    function hover(index) {
      view.baskets.forEach((node, i) => node.classList.toggle('is-over', i === index));
    }

    function onDown(event) {
      skipClick = false;
      if (locked || drag || !event.isPrimary || event.button > 0) return;
      const item = itemOf(event.target);
      if (!item || item.type !== 'mushroom' || mushrooms()[item.index].picked) return;
      drag = { index: item.index, pointer: event.pointerId, x: event.clientX, y: event.clientY, dx: 0, dy: 0, moved: false };
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
        select({ type: 'mushroom', index: drag.index });
        view.mushrooms[drag.index].classList.add('is-carried');
      }
      drag.dx = dx;
      drag.dy = dy;
      view.mushrooms[drag.index].style.transform = `translate(${dx}px, ${dy}px)`;
      hover(basketUnder(event));
    }

    function onUp(event) {
      if (!drag || event.pointerId !== drag.pointer) return;
      const { index, moved, dx, dy } = drag;
      const basket = moved ? basketUnder(event) : -1;
      drag = null;
      hover(-1);
      // not moved: it was a tap, and the click that follows handles it
      if (!moved) return;
      skipClick = true;
      view.mushrooms[index].classList.remove('is-carried');
      if (basket >= 0) {
        put(index, basket, dx, dy);
        return;
      }
      putBack(view.mushrooms[index], dx, dy);
      say('Донеси грибочек до корзинки', 'hint');
    }

    function onCancel(event) {
      if (!drag || event.pointerId !== drag.pointer) return;
      const node = view.mushrooms[drag.index];
      node.classList.remove('is-carried');
      putBack(node, drag.dx, drag.dy);
      hover(-1);
      drag = null;
    }

    function tap(item) {
      if (skipClick) {
        skipClick = false;
        return;
      }
      if (locked) return;
      if (item.type === 'mushroom' && mushrooms()[item.index].picked) return;
      if (!selected || selected.type === item.type) {
        // the first half of a pair; tapping it again lets it go
        const next = isPicked(item.type, item.index) ? null : item;
        select(next);
        if (next) say(item.type === 'mushroom' ? 'В какую корзинку его положить?' : 'Какой грибочек сюда подходит?', 'hint');
        else say(null, 'hint');
        return;
      }
      const mushroom = item.type === 'mushroom' ? item.index : selected.index;
      const basket = item.type === 'basket' ? item.index : selected.index;
      put(mushroom, basket, 0, 0);
    }

    /** A mushroom for a basket — by two taps, or carried there and dx, dy away from where it grew. */
    function put(index, basket, dx, dy) {
      const item = mushrooms()[index];
      const node = view.mushrooms[index];
      const isRight = METERS[basket] === item.meter;
      const key = `${current}:${index}`;
      const isFirstTry = !tried.has(key);
      tried.add(key);
      if (isFirstTry) store.recordAnswer(item.meter.id, isRight);
      if (isRight) {
        if (isFirstTry) score += 1;
        collect(index, basket, dx, dy);
        return;
      }
      playFail();
      // the mushroom stays picked for its real basket
      select({ type: 'mushroom', index });
      say(`Нет, в этом грибочке ${item.meter.beats} ${beatsWord(item.meter.beats)}`, 'bad');
      if (dx || dy) putBack(node, dx, dy);
      node.classList.add('is-shaking');
      node.addEventListener('animationend', () => node.classList.remove('is-shaking'), { once: true });
    }

    async function collect(index, basket, dx, dy) {
      locked = true;
      const now = round;
      const item = mushrooms()[index];
      item.picked = true;
      select(null);
      playRhythm(view.mushrooms[index]);
      const left = mushrooms().filter((mushroom) => !mushroom.picked).length;
      const isLast = current === glades.length - 1;
      if (left) say(praise(), 'good');
      else say(isLast ? 'Все грибочки в корзинках! 🍄' : 'Поляна пустая — все грибочки в корзинках! 🍄', 'good');

      await fly(index, basket, dx, dy);
      if (cancelled || now !== round) return;
      filled[item.meter.id] += 1;
      showPiles();
      view.baskets[basket].classList.add('is-full');
      view.baskets[basket].addEventListener('animationend', () => view.baskets[basket].classList.remove('is-full'), { once: true });
      updateProgress();
      if (left) {
        locked = false;
        return;
      }

      await delay(1600);
      if (cancelled || now !== round) return;
      if (!isLast) {
        show(current + 1);
        return;
      }
      locked = false;
      clear(screen);
      screen.append(renderRoundResult({ id: ID, group: GROUP, score, total: GLADES * MUSHROOMS, onRestart: restart }));
    }

    /** The mushroom hops from where it is into the basket. */
    async function fly(index, basket, dx, dy) {
      const node = view.mushrooms[index];
      if (calm() || !node.isConnected) {
        node.style.transform = '';
        node.classList.add('is-picked');
        return;
      }
      const from = node.getBoundingClientRect();
      const to = view.baskets[basket].getBoundingClientRect();
      const tx = to.left + to.width * (OPENING.x / BASKET.width) - (from.left + from.width / 2);
      const ty = to.top + to.height * (OPENING.y / BASKET.height) - (from.top + from.height / 2);
      node.classList.add('is-flying');
      const flight = node.animate([
        { transform: `translate(${dx}px, ${dy}px)`, opacity: 1 },
        { transform: `translate(${fixed(dx + tx / 2)}px, ${fixed(dy + ty / 2 - 40)}px) scale(.7)`, opacity: 1, offset: 0.5 },
        { transform: `translate(${fixed(dx + tx)}px, ${fixed(dy + ty)}px) scale(.25)`, opacity: 0.6 },
      ], { duration: 600, easing: 'ease-in', fill: 'forwards' });
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
      stopRhythm();
      window.removeEventListener('resize', fit);
    };
  },
};
