// "Pumpkins and leaves": a matching game after an autumn worksheet from the
// music school. Pumpkins with a note on the staff and leaves with note names
// lie on one field, mixed up as on the sheet. Draw a line with a finger from a
// pumpkin to the leaf with its name (or from the leaf to the pumpkin), or tap
// one and then the other. A right pair sounds the note on the piano, the leaf
// flies along the line onto the pumpkin's stalk and the note on the pumpkin
// goes, so the field gets emptier as the round goes on. One pumpkin of the
// round, unknown until then, turns out to be a jack-o'-lantern: once paired it
// shows a friendly carved face, lit by a candle inside.
//
// As on the sheet with its two "ДО", a leaf carries the name only: any leaf
// with the right name fits a pumpkin, whatever its octave. There is one leaf
// too many, so the last pumpkin still has to be read. The extra leaf takes a
// name no pumpkin of the round has, when there is one left.
//
// A finger drawing a line can't scroll the page, so the whole field has to be
// in sight: it takes the screen below the controls, and of a few grids the one
// with the biggest pumpkins is used. Pumpkins stand on the black squares of a
// chessboard and leaves on the white ones, so no two pumpkins touch, as on the
// sheet.
//
// The notes and how they look are shared with the staff games: the octave
// chips and the "coloured notes" toggle.
//
// A point is a pumpkin paired right at the first try. After a wrong leaf the
// child is told which note it is and finds its leaf, without the point.

import { el, clear, mount, sample, svgEl, delay } from '../core/ui.js';
import { renderStaff, tightStaffBox } from '../core/staff.js';
import { colorToggle, octaveChips, drilledNotes } from '../core/controls.js';
import { praise, renderRoundResult, buildQueue } from '../core/quiz.js';
import { store } from '../core/store.js';
import { playFail } from '../core/audio.js';
import { loadPiano, playPiano } from '../core/piano.js';
import { NOTES, isMixed, octaveName } from '../data/notes.js';

const ID = 'pumpkins';
const GROUP = 'note-games';
const ACCENT = '#F4511E';
// pumpkins of a round: ten, as in every game of the topic; the leaves are one more
const PUMPKINS = 10;
// columns × rows: every grid has at least 10 black squares and 11 white ones
const GRIDS = [[3, 8], [4, 6], [5, 5], [6, 4], [8, 3]];
// the gap between the squares, as in styles.css
const GAP = 6;
// a row is never lower than this, even on a short screen (then the page
// scrolls), and never higher than that, so the pumpkins don't swell on a big one
const MIN_ROW = 64;
const MAX_ROW = 170;
// Leaves are smaller than their squares, so a pumpkin, which only has leaves
// next to it on the chessboard, may reach a little out of its own square into
// the room they leave; its corners are round and stay clear of the pumpkins
// on the diagonals.
const LEAF = 0.85;
const REACH = 1.15;

// The pumpkin is drawn 96 × 90, almost round, as on the sheet; the points
// below are in the same units.
const PUMPKIN = { width: 96, height: 90 };
// where a line to its leaf starts
const STALK_TOP = { x: 51, y: 2 };
// where its leaf lands, and how wide the leaf is there
const STALK_LEAF = { x: 68, y: 7, width: 31 };

const fixed = (n) => Number(n.toFixed(1));

const calm = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * The face of a jack-o'-lantern, a smiling one, cut in at the angles of a
 * knife: eyes, a nose and a grin with one tooth at the top and one at the
 * bottom. It lights up once the pumpkin is paired (see styles.css).
 */
function carving() {
  return svgEl('g', { class: 'pumpkin__carving' },
    svgEl('path', { d: 'M28 44 L42 44 L35 32 Z' }),
    svgEl('path', { d: 'M54 44 L68 44 L61 32 Z' }),
    svgEl('path', { d: 'M44 54 L52 54 L48 48 Z' }),
    svgEl('path', { d: 'M20 55 L33 62 L33 68 L40 68 L40 63.5 L56 63.5 L63 62 L76 55 L72 67 L63 76 L63 70 L56 70 L56 79 L48 80 L40 79 L33 76 L24 67 Z' }));
}

/** A pumpkin of five ribs with its stalk, and the leaf it gets once paired; a lantern has a face cut in it too. */
function pumpkinArt(lantern) {
  const rib = (cx, rx, ry, kind) => svgEl('ellipse', { cx, cy: 51, rx, ry, class: `pumpkin__rib pumpkin__rib--${kind}` });
  return svgEl('svg', { viewBox: `0 0 ${PUMPKIN.width} ${PUMPKIN.height}`, class: 'pumpkin__art', 'aria-hidden': 'true' },
    svgEl('path', { d: 'M44 16 C43 10 45 5 51 1 L56 4 C52 7 50 11 51 16 Z', class: 'pumpkin__stalk' }),
    // a curl of a tendril on the other side of the stalk
    svgEl('path', { d: 'M45 12 C38 11 34 5 38 2 C41 0 44 3 41 5', class: 'pumpkin__tendril' }),
    svgEl('g', { class: 'pumpkin__leaf' },
      svgEl('path', { d: 'M52 11 C58 2 72 -1 83 4 C76 13 63 16 52 11 Z', class: 'leaf__blade' }),
      svgEl('path', { d: 'M52 11 Q68 6 83 4', class: 'leaf__vein' })),
    rib(22, 21, 36, 'outer'),
    rib(74, 21, 36, 'outer'),
    rib(33, 24, 38, 'mid'),
    rib(63, 24, 38, 'mid'),
    rib(48, 22, 39, 'middle'),
    lantern ? carving() : null);
}

/**
 * A maple leaf with a white round label, like on the sheet. `seed` gives every
 * leaf teeth of its own; the leaf is turned by `tilt`, the label stays upright.
 */
function leafArt(name, seed, tilt) {
  let state = seed;
  const random = () => {
    state = (state * 16807) % 2147483647;
    return state / 2147483647;
  };
  // five lobes, the top one the biggest, a notch at the bottom where the stem
  // goes in, and small teeth all round; angles go clockwise from straight up
  const teeth = 56;
  const lobe = (angle) => (36 + 6 * Math.cos(angle)) * (1 + 0.16 * Math.cos(5 * angle));
  const at = (angle, r) => [fixed(50 + r * Math.sin(angle)), fixed(50 - r * Math.cos(angle))];
  const outline = Array.from({ length: teeth }, (_, i) => {
    const angle = (2 * Math.PI * i) / teeth;
    return at(angle, lobe(angle) * (i % 2 ? 0.93 : 1) + random() * 1.5).join(' ');
  });
  // a vein from the middle into every lobe; the label hides where they meet
  const veins = [0, 1, 2, 3, 4].map((k) => {
    const angle = (2 * Math.PI * k) / 5;
    const [x2, y2] = at(angle, lobe(angle) * 0.8);
    return svgEl('line', { x1: 50, y1: 50, x2, y2, class: 'leaf__vein' });
  });

  return svgEl('svg', { viewBox: '0 0 100 100', class: 'leaf__art', 'aria-hidden': 'true' },
    svgEl('g', { transform: `rotate(${tilt} 50 50)` },
      svgEl('path', { d: 'M50 70 Q50 88 55 99', class: 'leaf__stem' }),
      svgEl('path', { d: `M${outline.join(' L')} Z`, class: 'leaf__blade' }),
      ...veins),
    svgEl('circle', { cx: 50, cy: 50, r: 24, class: 'leaf__label' }),
    // "Соль" is twice as long as the other names
    svgEl('text', { x: 50, y: 51, class: `leaf__name ${name.length > 2 ? 'leaf__name--long' : ''}` }, name));
}

/** A line from a to b that bends a little, like a stalk. */
function vinePath(a, b) {
  const bend = 0.15;
  const cx = (a.x + b.x) / 2 - (b.y - a.y) * bend;
  const cy = (a.y + b.y) / 2 + (b.x - a.x) * bend;
  return `M${fixed(a.x)} ${fixed(a.y)} Q${fixed(cx)} ${fixed(cy)} ${fixed(b.x)} ${fixed(b.y)}`;
}

/** Squares of a cols × rows chessboard in random order: black ones for the pumpkins, white ones for the leaves. */
function squares(cols, rows) {
  const all = Array.from({ length: cols * rows }, (_, k) => ({ row: Math.floor(k / cols) + 1, col: (k % cols) + 1 }));
  return {
    pumpkins: sample(all.filter(({ row, col }) => (row + col) % 2 === 0), PUMPKINS),
    leaves: sample(all.filter(({ row, col }) => (row + col) % 2 === 1), PUMPKINS + 1),
  };
}

/** Fades a line out and takes it off the board. */
function fade(line, options = {}) {
  line.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: 'forwards', ...options })
    .finished.catch(() => {}).then(() => line.remove());
}

export default {
  id: ID,
  title: 'Тыквы и листочки',
  subtitle: 'Соедини тыкву с её листочком',
  emoji: '🍂',
  accent: ACCENT,
  group: GROUP,

  mount(root) {
    // start downloading the piano now, so the first right pair isn't silent
    loadPiano();

    const screen = el('div', { class: 'screen patch-game', style: `--accent:${ACCENT}` });
    root.append(screen);

    let pool;
    // { note, done, lantern } for every pumpkin of the round; one of them is a lantern
    let pumpkins;
    // { note, gone, seed, tilt } for every leaf; `note` is the first-octave note of its name
    let leaves;
    let score;
    // pumpkins paired at least once: only the first try scores
    let tried;
    // { type: 'pumpkin' | 'leaf', index } — what was tapped first, waiting for its pair
    let selected;
    let message;
    // the grid on display, how wide it was picked for, and the squares of the round on it
    let layout;
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

    const label = (note) => (isMixed(pool) ? `${note.ru} ${octaveName(note)}` : note.ru);
    const pairedLabel = (item) => `${item.lantern ? 'Тыква-фонарик' : 'Тыква'} ${label(item.note)}`;
    const isPicked = (type, index) => Boolean(selected && selected.type === type && selected.index === index);
    const nodeOf = ({ type, index }) => (type === 'pumpkin' ? view.pumpkins : view.leaves)[index];
    const isOpen = ({ type, index }) => (type === 'pumpkin' ? !pumpkins[index].done : !leaves[index].gone);

    function say(text, kind) {
      message = text ? { text, kind } : null;
      view.feedback.textContent = text || ' ';
      view.feedback.className = `feedback feedback--${kind}`;
    }

    /** Lights up what was tapped first, without redrawing the board. */
    function select(next) {
      selected = next;
      view.pumpkins.forEach((node, i) => node.classList.toggle('is-selected', isPicked('pumpkin', i)));
      view.leaves.forEach((node, i) => node.classList.toggle('is-selected', isPicked('leaf', i)));
    }

    function renderProgress() {
      const done = pumpkins.filter((item) => item.done).length;
      return el('div', { class: 'progress' },
        el('div', { class: 'progress__dots' },
          pumpkins.map((_, i) => el('span', { class: `dot ${i < done ? 'dot--done' : ''}` }))),
        el('div', { class: 'progress__score' }, `⭐ ${score}`),
      );
    }

    function renderPumpkin(item, i, colored, box) {
      return el('button', {
        class: `pumpkin ${item.lantern ? 'pumpkin--lantern' : ''} ${item.done ? 'is-done' : ''} ${isPicked('pumpkin', i) ? 'is-selected' : ''}`,
        type: 'button',
        'data-pumpkin': i,
        'aria-label': item.done ? pairedLabel(item) : 'Тыква',
        onclick: () => tap({ type: 'pumpkin', index: i }),
      },
        el('span', { class: 'pumpkin__body' },
          pumpkinArt(item.lantern),
          el('span', { class: 'pumpkin__face' }, renderStaff(item.note, { colored, box, narrow: true }))));
    }

    function renderLeaf(item, i) {
      return el('button', {
        class: `leaf ${item.gone ? 'is-gone' : ''} ${isPicked('leaf', i) ? 'is-selected' : ''}`,
        type: 'button',
        'data-leaf': i,
        'aria-label': `Листочек ${item.note.ru}`,
        onclick: () => tap({ type: 'leaf', index: i }),
      }, leafArt(item.note.ru, item.seed, item.tilt));
    }

    function render() {
      clear(screen);
      const colored = store.setting('coloredHeads', true);
      // one box for every pumpkin, so all the staves are the same size
      const box = tightStaffBox(pumpkins.map((item) => item.note));
      view = {
        progress: renderProgress(),
        feedback: el('div', { class: `feedback ${message ? `feedback--${message.kind}` : ''}` }, message ? message.text : ' '),
        lines: svgEl('svg', { class: 'patch__lines', 'aria-hidden': 'true' }),
        pumpkins: pumpkins.map((item, i) => renderPumpkin(item, i, colored, box)),
        leaves: leaves.map(renderLeaf),
      };
      view.board = el('div', {
        class: 'patch',
        onpointerdown: onDown,
        onpointermove: onMove,
        onpointerup: onUp,
        onpointercancel: onCancel,
      }, view.pumpkins, view.leaves, view.lines);

      mount(screen,
        view.progress,
        octaveChips(restart),
        colorToggle(redraw),
        el('div', { class: 'patch__task' }, 'Веди пальцем от тыквы к листочку с её нотой. Один листочек лишний!'),
        view.feedback,
        view.board,
      );
      fit();
    }

    /**
     * Sizes the board to the screen below the controls. The grid is picked
     * again only when the width changes (a tablet turned over), not when the
     * address bar of a phone hides and the screen gets a little taller.
     */
    function fit() {
      const { board } = view;
      if (!board || !board.isConnected) return;
      const width = board.clientWidth;
      const room = window.innerHeight - (board.getBoundingClientRect().top + window.scrollY) - 24;
      const rowOf = (rows) => Math.min(MAX_ROW, Math.max(MIN_ROW, (room - GAP * (rows - 1)) / rows));
      const columnOf = (cols) => (width - GAP * (cols - 1)) / cols;
      const pumpkinOf = (cols, rows) => REACH * Math.min(columnOf(cols), (rowOf(rows) * PUMPKIN.width) / PUMPKIN.height);

      if (!layout || layout.width !== width) {
        const [cols, rows] = GRIDS.reduce((best, grid) => (pumpkinOf(...grid) > pumpkinOf(...best) ? grid : best));
        if (!layout || layout.cols !== cols) layout = { cols, rows, ...squares(cols, rows) };
        layout.width = width;
      }

      const { cols, rows } = layout;
      const row = rowOf(rows);
      const pumpkin = pumpkinOf(cols, rows);
      // pumpkins of the top and the bottom rows reach out of the board, so it
      // keeps that much room above and below for them
      const reach = Math.max(0, ((pumpkin * PUMPKIN.height) / PUMPKIN.width - row) / 2);
      board.style.padding = `${fixed(reach)}px 0`;
      board.style.setProperty('--cols', cols);
      board.style.setProperty('--rows', rows);
      board.style.setProperty('--row', `${row}px`);
      board.style.setProperty('--pumpkin', `${pumpkin}px`);
      board.style.setProperty('--leaf', `${LEAF * Math.min(columnOf(cols), row)}px`);
      const put = (node, { row: r, col }) => { node.style.gridArea = `${r} / ${col}`; };
      view.pumpkins.forEach((node, i) => put(node, layout.pumpkins[i]));
      view.leaves.forEach((node, i) => put(node, layout.leaves[i]));
    }

    /** Redraws the board as it is — for the colour toggle. */
    function redraw() {
      if (!locked && !drag) render();
    }

    /** A fresh round — "Ещё раз", or octave chips that changed the set of notes. */
    function restart() {
      pool = drilledNotes();
      const lantern = Math.floor(Math.random() * PUMPKINS);
      pumpkins = buildQueue(pool, PUMPKINS).map((note, i) => ({ note, done: false, lantern: i === lantern }));
      const names = pumpkins.map(({ note }) => NOTES.find((name) => name.pc === note.pc));
      const unused = NOTES.filter((name) => !names.includes(name));
      const [extra] = sample(unused.length ? unused : NOTES, 1);
      leaves = [...names, extra].map((note) => ({
        note,
        gone: false,
        seed: 1 + Math.floor(Math.random() * 2147483645),
        tilt: Math.round(Math.random() * 60 - 30),
      }));
      score = 0;
      tried = new Set();
      selected = null;
      message = null;
      layout = null;
      drag = null;
      locked = false;
      round += 1;
      render();
      // after the app has scrolled a fresh section to the top
      requestAnimationFrame(reveal);
    }

    /**
     * A screen too short for the whole field (its rows don't get lower than
     * MIN_ROW) is scrolled so that the field is in sight; the controls above
     * it can be scrolled back to.
     */
    function reveal() {
      if (!view.board.isConnected) return;
      const bar = document.querySelector('.topbar');
      const box = view.board.getBoundingClientRect();
      const over = Math.min(box.bottom + 12 - window.innerHeight, box.top - (bar ? bar.offsetHeight : 0));
      if (over > 0) window.scrollBy({ top: over, behavior: calm() ? 'auto' : 'smooth' });
    }

    /** Where a line meets a pumpkin (its stalk) or a leaf (its middle), on the board. */
    function anchor(item) {
      const origin = view.board.getBoundingClientRect();
      const box = nodeOf(item).getBoundingClientRect();
      const at = item.type === 'pumpkin'
        ? { x: STALK_TOP.x / PUMPKIN.width, y: STALK_TOP.y / PUMPKIN.height }
        : { x: 0.5, y: 0.5 };
      return { x: box.left + box.width * at.x - origin.left, y: box.top + box.height * at.y - origin.top };
    }

    /** The pumpkin or leaf a node belongs to. */
    function itemOf(node) {
      const button = node && node.closest ? node.closest('[data-pumpkin], [data-leaf]') : null;
      if (!button || !view.board.contains(button)) return null;
      return button.dataset.pumpkin !== undefined
        ? { type: 'pumpkin', index: Number(button.dataset.pumpkin) }
        : { type: 'leaf', index: Number(button.dataset.leaf) };
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
        drag.line = svgEl('path', { class: 'vine' });
        view.lines.append(drag.line);
      }
      const origin = view.board.getBoundingClientRect();
      drag.line.setAttribute('d', vinePath(anchor(drag.from), { x: event.clientX - origin.left, y: event.clientY - origin.top }));
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
      say(from.type === 'pumpkin' ? 'Доведи линию до листочка' : 'Доведи линию до тыквы', 'hint');
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
      // a pumpkin with its leaf only sounds its note again
      if (item.type === 'pumpkin' && pumpkins[item.index].done) {
        playPiano(pumpkins[item.index].note.freq);
        return;
      }
      if (!isOpen(item)) return;
      if (!selected || selected.type === item.type) {
        // the first half of a pair; tapping it again lets it go
        const next = isPicked(item.type, item.index) ? null : item;
        select(next);
        if (next) say(item.type === 'pumpkin' ? 'Теперь найди её листочек' : 'Теперь найди его тыкву', 'hint');
        else say(null, 'hint');
        return;
      }
      pair(selected, item, null);
    }

    /** A pumpkin and a leaf put together, by a drawn `line` or by two taps. */
    function pair(a, b, line) {
      const p = a.type === 'pumpkin' ? a.index : b.index;
      const l = a.type === 'leaf' ? a.index : b.index;
      const { note } = pumpkins[p];
      const isRight = note.pc === leaves[l].note.pc;
      const isFirstTry = !tried.has(p);
      tried.add(p);
      if (isFirstTry) store.recordAnswer(note.id, isRight);

      // a drawn line snaps onto the pair; two taps get a line that grows by itself
      const vine = line || svgEl('path', { class: 'vine' });
      vine.setAttribute('d', vinePath(anchor({ type: 'pumpkin', index: p }), anchor({ type: 'leaf', index: l })));
      if (!line) {
        view.lines.append(vine);
        const length = vine.getTotalLength();
        vine.animate(
          [{ strokeDasharray: `${length}px`, strokeDashoffset: `${length}px` }, { strokeDasharray: `${length}px`, strokeDashoffset: '0px' }],
          { duration: 300, easing: 'ease-out' },
        );
      }

      if (isRight) {
        if (isFirstTry) score += 1;
        match(p, l, vine);
      } else {
        miss(p, l, vine);
      }
    }

    /** A wrong leaf: say which note this is and keep the pumpkin picked for its real leaf. */
    function miss(p, l, vine) {
      playFail();
      select({ type: 'pumpkin', index: p });
      say(`Нет, это ${label(pumpkins[p].note)}. Найди её листочек`, 'bad');
      vine.classList.add('vine--wrong');
      fade(vine, { duration: 400, delay: 400 });
      const leaf = view.leaves[l];
      leaf.classList.add('is-shaking');
      leaf.addEventListener('animationend', () => leaf.classList.remove('is-shaking'), { once: true });
    }

    async function match(p, l, vine) {
      locked = true;
      const current = round;
      pumpkins[p].done = true;
      leaves[l].gone = true;
      select(null);
      playPiano(pumpkins[p].note.freq);
      say(praise(), 'good');

      await fly(p, l, vine);
      if (cancelled || current !== round) return;
      const progress = renderProgress();
      view.progress.replaceWith(progress);
      view.progress = progress;
      if (pumpkins[p].lantern) say('Ух ты, тыква-фонарик! 🎃', 'good');
      if (pumpkins.every((item) => item.done)) finish();
      else locked = false;
    }

    /** The leaf flies along the line onto the pumpkin's stalk. */
    async function fly(p, l, vine) {
      const leaf = view.leaves[l];
      const pumpkin = view.pumpkins[p];
      await delay(350);
      if (!calm() && leaf.isConnected) {
        const from = leaf.getBoundingClientRect();
        const to = pumpkin.getBoundingClientRect();
        const dx = to.left + to.width * (STALK_LEAF.x / PUMPKIN.width) - (from.left + from.width / 2);
        const dy = to.top + to.height * (STALK_LEAF.y / PUMPKIN.height) - (from.top + from.height / 2);
        // as big as the leaf drawn on the stalk; the blade is about 0.8 of its picture
        const scale = (to.width * (STALK_LEAF.width / PUMPKIN.width)) / (from.width * 0.8);
        leaf.classList.add('is-flying');
        fade(vine, { duration: 450 });
        const flight = leaf.animate(
          [{ transform: 'none' }, { transform: `translate(${dx}px, ${dy}px) rotate(-40deg) scale(${fixed(scale)})` }],
          { duration: 600, easing: 'ease-in-out', fill: 'forwards' },
        );
        await flight.finished.catch(() => {});
        leaf.classList.add('is-gone');
        leaf.classList.remove('is-flying');
        flight.cancel();
      } else {
        vine.remove();
        leaf.classList.add('is-gone');
      }
      pumpkin.classList.add('is-done');
      pumpkin.setAttribute('aria-label', pairedLabel(pumpkins[p]));
    }

    async function finish() {
      const current = round;
      const extra = view.leaves.find((_, i) => !leaves[i].gone);
      if (extra) extra.classList.add('leaf--extra');
      say('Все тыквы с листочками! Этот — лишний', 'good');
      view.board.classList.add('patch--done');
      await delay(2200);
      if (cancelled || current !== round) return;
      locked = false;
      clear(screen);
      screen.append(renderRoundResult({ id: ID, group: GROUP, score, total: pumpkins.length, onRestart: restart }));
    }

    window.addEventListener('resize', fit);
    restart();
    return () => {
      cancelled = true;
      window.removeEventListener('resize', fit);
    };
  },
};
