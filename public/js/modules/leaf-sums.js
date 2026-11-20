// "Count and colour": a colouring game after an autumn worksheet from the
// music school. Four paints stand on top, each under its note, as on the sheet:
// brown for the whole, orange for the half, red for the quarter, yellow for
// the eighth. Below lie maple leaves, each with a sum of durations — "♩ + ♩",
// "𝅗𝅥 − ♪ − ♪". Count what comes out, tap the paint of that note and then the
// leaf (or the leaf first): the leaf takes the paint and the note that came
// out sounds on the piano, lighting up on its paint. A round is ten leaves.
//
// A sum adds two or three notes, or takes them away from the first one, and
// always comes out as one of the four notes. The "count under the notes"
// switch puts a strip under every note of a sum, a cell for every quarter it
// lasts, so the cells can be counted; the paints keep their notes plain, so
// which note lasts that long still has to be known.
//
// After every painted leaf the brush is washed, as in "Christmas toys". A
// point is a leaf painted right at the first try. After a wrong paint the
// child is told which note comes out and finds its paint, without the point.

import { el, clear, mount, svgEl, delay } from '../core/ui.js';
import { renderSum, noteGlyph, playRhythm, stopRhythm } from '../core/rhythm.js';
import { countToggle, showsCount } from '../core/controls.js';
import { praise, renderRoundResult, buildQueue } from '../core/quiz.js';
import { store } from '../core/store.js';
import { playFail } from '../core/audio.js';
import { loadPiano } from '../core/piano.js';
import { DURATIONS, DURATION_BY_ID, TOKEN_LENGTH } from '../data/rhythm.js';

const ID = 'leaf-sums';
const GROUP = 'rhythm-play';
const ACCENT = '#E65100';
const LEAVES = 10;

// the colours of the sheet, from the longest note to the shortest
const PAINTS = [
  { duration: DURATION_BY_ID.whole, color: '#7B4A2E', ink: '#ffffff', name: 'коричневая' },
  { duration: DURATION_BY_ID.half, color: '#F57C00', ink: '#ffffff', name: 'оранжевая' },
  { duration: DURATION_BY_ID.quarter, color: '#D32F2F', ink: '#ffffff', name: 'красная' },
  { duration: DURATION_BY_ID.eighth, color: '#FDD835', ink: '#4a3a00', name: 'жёлтая' },
];
const PAINT_BY_TOKEN = Object.fromEntries(PAINTS.map((paint) => [paint.duration.token, paint]));
const TOKEN_BY_LENGTH = Object.fromEntries(DURATIONS.map((duration) => [duration.beats, duration.token]));

/**
 * Every sum of two or three notes that comes out as a single note, adding them
 * up or taking the others away from the first: { tokens, sign, result }.
 */
function allSums() {
  const tokens = DURATIONS.map((duration) => duration.token);
  const rows = (size) => (size === 1
    ? tokens.map((token) => [token])
    : rows(size - 1).flatMap((row) => tokens.map((token) => [...row, token])));
  const sums = [];
  for (const row of [...rows(2), ...rows(3)]) {
    const [first, ...rest] = row.map((token) => TOKEN_LENGTH[token]);
    const others = rest.reduce((sum, length) => sum + length, 0);
    const plus = TOKEN_BY_LENGTH[first + others];
    const minus = first > others ? TOKEN_BY_LENGTH[first - others] : null;
    if (plus) sums.push({ tokens: row, sign: '+', result: plus });
    if (minus) sums.push({ tokens: row, sign: '−', result: minus });
  }
  return sums;
}

const SUMS = allSums();

const fixed = (n) => Number(n.toFixed(1));

// The lobes of a maple leaf: where each one points, clockwise from straight
// up, and how far it reaches beyond the middle of the leaf. The side lobes
// stand almost level, so the leaf is widest across its middle, where the sum
// lies; the two lower ones are small, with a notch between them for the stem.
// Every lobe has a smaller point on either side of it, as a maple leaf does.
const LOBES = [[0, 21], [78, 19], [146, 12], [214, 12], [282, 19]].flatMap(([deg, reach]) => {
  const angle = (deg * Math.PI) / 180;
  return [
    { angle, reach, width: 0.3 },
    { angle: angle - 0.45, reach: reach * 0.42, width: 0.13 },
    { angle: angle + 0.45, reach: reach * 0.42, width: 0.13 },
  ];
});

/** How far the edge of the leaf is from its middle at this angle. */
function leafRadius(angle) {
  return 27 + LOBES.reduce((sum, lobe) => {
    const off = Math.abs(angle - lobe.angle);
    const d = Math.min(off, 2 * Math.PI - off) / lobe.width;
    return sum + lobe.reach * Math.exp(-d * d);
  }, 0);
}

const pictureWidth = (picture) => Number(picture.getAttribute('viewBox').split(' ')[2]);
// The widest sum fills the middle of its leaf, with strips and without; the
// notes of every sum are drawn as big as its notes, so a short sum is a
// narrower picture and the notes of all the leaves are the same size.
const WIDEST = Object.fromEntries([false, true].map((cells) => [
  cells,
  Math.max(...SUMS.map((sum) => pictureWidth(renderSum(sum.tokens, { sign: sum.sign, cells })))),
]));

/**
 * A maple leaf of five pointed lobes with small teeth, white with a dark
 * outline like a page of a colouring book. `seed` gives every leaf an edge of
 * its own; the leaf is turned by `tilt`.
 */
function leafArt(seed, tilt) {
  let state = seed;
  const random = () => {
    state = (state * 16807) % 2147483647;
    return state / 2147483647;
  };
  const at = (angle, r) => [fixed(50 + r * Math.sin(angle)), fixed(50 - r * Math.cos(angle))];
  const points = 80;
  const outline = Array.from({ length: points }, (_, i) => {
    const angle = (2 * Math.PI * i) / points;
    return at(angle, leafRadius(angle) * (i % 2 ? 0.93 : 1) + random() * 1.4).join(' ');
  });
  // as on the sheet, only the outline: veins would run through the notes
  return svgEl('svg', { viewBox: '0 0 100 100', class: 'sum-leaf__art', 'aria-hidden': 'true' },
    svgEl('g', { transform: `rotate(${tilt} 50 50)` },
      svgEl('path', { d: 'M50 72 Q50 88 56 99', class: 'sum-leaf__stem' }),
      svgEl('path', { d: `M${outline.join(' L')} Z`, class: 'sum-leaf__blade' })));
}

/** "♩ + ♩" in words, for a screen reader. */
const sumLabel = ({ tokens, sign }) => tokens
  .map((token) => PAINT_BY_TOKEN[token].duration.one)
  .join(sign === '+' ? ' плюс ' : ' минус ');

export default {
  id: ID,
  title: 'Посчитай и раскрась',
  subtitle: 'Сложи длительности и раскрась листочек',
  emoji: '🍁',
  accent: ACCENT,
  group: GROUP,

  mount(root) {
    // start downloading the piano now, so the first painted leaf isn't silent
    loadPiano();

    const screen = el('div', { class: 'screen sums-game', style: `--accent:${ACCENT}` });
    root.append(screen);

    // the paints stick right under the top bar, and how tall the bar is
    // depends on whether the title fits on one line
    const bar = document.querySelector('.topbar');
    const barWatch = new ResizeObserver(() => screen.style.setProperty('--bar', `${bar.offsetHeight}px`));
    if (bar) barWatch.observe(bar);

    // { sum, seed, tilt, painted } for every leaf of the round
    let leaves;
    // the paint on the brush, or null
    let brush;
    // the leaf tapped before its paint (or painted wrong), waiting for a paint
    let waiting;
    let score;
    // leaves painted at least once: only the first try scores
    let tried;
    let locked;
    let cancelled = false;
    // bumped on every new round, so the end of a round that has been
    // restarted doesn't show its result over the new one
    let round = 0;
    // nodes on display, so a tap changes them without redrawing the screen
    let view = {};

    const resultOf = (leaf) => PAINT_BY_TOKEN[leaf.sum.result];

    function say(text, kind) {
      view.feedback.textContent = text || ' ';
      view.feedback.className = `feedback feedback--${kind}`;
    }

    /** Lights up the paint on the brush and the leaf waiting for its paint. */
    function showPicks() {
      view.paints.forEach((node, i) => {
        node.classList.toggle('is-selected', brush === PAINTS[i]);
        node.setAttribute('aria-pressed', brush === PAINTS[i] ? 'true' : 'false');
      });
      view.leaves.forEach((node, i) => node.classList.toggle('is-selected', i === waiting));
    }

    function renderProgress() {
      return el('div', { class: 'progress' },
        el('div', { class: 'progress__dots' },
          leaves.map((leaf) => el('span', { class: `dot ${leaf.painted ? 'dot--done' : ''}` }))),
        el('div', { class: 'progress__score' }, `⭐ ${score}`),
      );
    }

    function renderPaint(paint) {
      return el('button', {
        class: 'sum-paint',
        type: 'button',
        style: `--paint:${paint.color}`,
        'aria-pressed': 'false',
        'aria-label': `Краска для ноты: ${paint.duration.one}, ${paint.name}`,
        onclick: () => tapPaint(paint),
      },
        el('span', { class: 'sum-paint__pot', 'aria-hidden': 'true' }),
        el('span', { class: 'sum-paint__note' }, noteGlyph(paint.duration.token, { label: paint.duration.ru })));
    }

    function renderLeaf(leaf, i, cells) {
      const paint = resultOf(leaf);
      const sum = renderSum(leaf.sum.tokens, { sign: leaf.sum.sign, cells, label: sumLabel(leaf.sum) });
      sum.style.width = `${fixed((pictureWidth(sum) / WIDEST[cells]) * 100)}%`;
      return el('button', {
        class: `sum-leaf ${leaf.painted ? 'is-painted' : ''} ${i === waiting ? 'is-selected' : ''}`,
        type: 'button',
        style: `--paint:${paint.color};--paint-ink:${paint.ink}`,
        'aria-label': leaf.painted ? `Листочек: ${sumLabel(leaf.sum)}, получается ${paint.duration.one}` : `Листочек: ${sumLabel(leaf.sum)}`,
        onclick: () => tapLeaf(i),
      },
        leafArt(leaf.seed, leaf.tilt),
        el('span', { class: 'sum-leaf__sum' }, sum));
    }

    function render() {
      clear(screen);
      const cells = showsCount();
      view = {
        progress: renderProgress(),
        feedback: el('div', { class: 'feedback' }, ' '),
        paints: PAINTS.map(renderPaint),
        leaves: leaves.map((leaf, i) => renderLeaf(leaf, i, cells)),
      };
      view.board = el('div', { class: 'sum-leaves' }, view.leaves);

      mount(screen,
        view.progress,
        countToggle(redraw),
        el('div', { class: 'sums__task' },
          'Посчитай, какая нота получится, и раскрась листочек краской этой ноты.'),
        // the paints stay on screen while the leaves are scrolled
        el('div', { class: 'sum-paints' }, el('div', { class: 'sum-paints__row' }, view.paints), view.feedback),
        view.board,
      );
      showPicks();
    }

    /** Redraws the leaves as they are — for the count switch. */
    function redraw() {
      if (!locked) render();
    }

    /** A fresh round — "Ещё раз". */
    function restart() {
      stopRhythm();
      // about as many leaves of every paint, each with a sum of its own
      const used = new Set();
      leaves = buildQueue(PAINTS, LEAVES).map((paint) => {
        const fits = SUMS.filter((sum) => sum.result === paint.duration.token);
        const fresh = fits.filter((sum) => !used.has(sum));
        const pool = fresh.length ? fresh : fits;
        const sum = pool[Math.floor(Math.random() * pool.length)];
        used.add(sum);
        return {
          sum,
          seed: 1 + Math.floor(Math.random() * 2147483645),
          // a little only: the sum stays level across the widest part of the leaf
          tilt: Math.round(Math.random() * 20 - 10),
          painted: false,
        };
      });
      brush = null;
      waiting = null;
      score = 0;
      tried = new Set();
      locked = false;
      round += 1;
      render();
    }

    function tapPaint(paint) {
      if (locked) return;
      if (waiting !== null) {
        brush = paint;
        paintLeaf(waiting);
        return;
      }
      // tapping the paint on the brush again washes the brush
      brush = brush === paint ? null : paint;
      showPicks();
      say(brush ? `Теперь нажми на листочек, где получается ${brush.duration.one}` : null, 'hint');
    }

    function tapLeaf(i) {
      if (locked) return;
      const leaf = leaves[i];
      // a painted leaf only sounds its note again
      if (leaf.painted) {
        playRhythm(view.paints[PAINTS.indexOf(resultOf(leaf))]);
        return;
      }
      if (brush) {
        paintLeaf(i);
        return;
      }
      waiting = waiting === i ? null : i;
      showPicks();
      say(waiting === null ? null : 'Какая нота получится? Выбери её краску наверху', 'hint');
    }

    /** Puts the paint on the brush on leaf i. */
    function paintLeaf(i) {
      const leaf = leaves[i];
      const node = view.leaves[i];
      const paint = resultOf(leaf);
      const isRight = brush === paint;
      const isFirstTry = !tried.has(i);
      tried.add(i);
      if (isFirstTry) store.recordAnswer(paint.duration.id, isRight);

      if (!isRight) {
        // the leaf waits for its real paint, and the wrong one comes off the brush
        playFail();
        brush = null;
        waiting = i;
        showPicks();
        say(`Нет, получается ${paint.duration.one} нота. Найди её краску`, 'bad');
        node.classList.add('is-shaking');
        node.addEventListener('animationend', () => node.classList.remove('is-shaking'), { once: true });
        return;
      }

      if (isFirstTry) score += 1;
      leaf.painted = true;
      // the next pair starts from scratch, whichever is tapped first
      brush = null;
      waiting = null;
      showPicks();
      node.classList.add('is-painted');
      node.setAttribute('aria-label', `Листочек: ${sumLabel(leaf.sum)}, получается ${paint.duration.one}`);
      playRhythm(view.paints[PAINTS.indexOf(paint)]);
      const progress = renderProgress();
      view.progress.replaceWith(progress);
      view.progress = progress;

      if (leaves.every((item) => item.painted)) finish();
      else say(praise(), 'good');
    }

    async function finish() {
      locked = true;
      const current = round;
      say('Все листочки раскрашены! 🍁', 'good');
      view.board.classList.add('sum-leaves--done');
      await delay(2200);
      if (cancelled || current !== round) return;
      locked = false;
      clear(screen);
      screen.append(renderRoundResult({ id: ID, group: GROUP, score, total: leaves.length, onRestart: restart }));
    }

    restart();
    return () => {
      cancelled = true;
      stopRhythm();
      barWatch.disconnect();
    };
  },
};
