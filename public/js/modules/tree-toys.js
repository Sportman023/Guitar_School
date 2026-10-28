// "Christmas toys": a colouring game after a music-school worksheet. Paints
// with the note names stand on top, as on the sheet (До — red, Ре — orange …),
// and below hang glass balls and stars, each with a note on the staff. Tap a
// paint and then a toy with that note: the toy takes the paint and its note
// sounds on the piano. A toy can be tapped first too, and then its paint.
// After every painted toy the brush is washed: children often tap the toy
// first, and a paint left on the brush would land on it at once.
//
// The note heads are always black: a coloured head would show which paint to
// take, and the staff wouldn't have to be read. The names under the paints
// lead from the note to its colour, as on the worksheet. The same name in
// another octave takes the same paint, so the octave chips of the staff games
// only add notes.
//
// A point is a toy painted right at the first try. After a wrong paint the
// child is told which note it is and finds its paint, without the point.

import { el, clear, mount, svgEl, delay } from '../core/ui.js';
import { renderStaff, staffBox } from '../core/staff.js';
import { octaveChips, drilledNotes } from '../core/controls.js';
import { praise, renderRoundResult, buildQueue } from '../core/quiz.js';
import { store } from '../core/store.js';
import { playFail } from '../core/audio.js';
import { loadPiano, playPiano } from '../core/piano.js';
import { NOTES, isMixed, octaveName } from '../data/notes.js';

const ID = 'tree-toys';
const GROUP = 'note-games';
const ACCENT = '#43A047';
const TOYS = 10;

const fixed = (n) => Number(n.toFixed(1));

/** A five-pointed star; a fat one, so there is room for a staff inside. */
function starPoints(cx, cy, outer, inner) {
  return Array.from({ length: 10 }, (_, i) => {
    const r = i % 2 ? inner : outer;
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    return `${fixed(cx + r * Math.cos(angle))},${fixed(cy + r * Math.sin(angle))}`;
  }).join(' ');
}

// The two kinds of toys, drawn 100 wide. `staff` is where the staff sits, in %
// of the picture: its centre and its width. It is as big as the glass allows,
// so the notes stay readable on a phone.
const SHAPES = {
  ball: {
    height: 130,
    staff: { x: 50, y: 63, width: 80 },
    art: () => [
      svgEl('path', { d: 'M50 0 C46 5 54 9 50 14', class: 'toy__string' }),
      svgEl('circle', { cx: 50, cy: 18, r: 4, class: 'toy__string' }),
      svgEl('path', { d: 'M41 22 H59 V31 L56 35 L53 31 L50 35 L47 31 L44 35 L41 31 Z', class: 'toy__cap' }),
      svgEl('circle', { cx: 50, cy: 82, r: 46, class: 'toy__glass' }),
      svgEl('path', { d: 'M18.9 60.2 A38 38 0 0 1 37 46.3', class: 'toy__shine' }),
    ],
  },
  star: {
    height: 95,
    staff: { x: 50, y: 59.5, width: 63 },
    art: () => [
      svgEl('polygon', { points: starPoints(50, 52, 47, 29), class: 'toy__glass' }),
      svgEl('path', { d: 'M46.5 15 L42 22', class: 'toy__shine' }),
    ],
  },
};

// balls and stars take turns in pairs: rows of two (a phone) make a
// chessboard, and rows of four (a tablet) go ball, star, star, ball, as on
// the worksheet
const kindAt = (i) => (i % 4 === 0 || i % 4 === 3 ? 'ball' : 'star');

/** A blot of paint, like on the worksheet; `seed` gives every paint a shape of its own. */
function blotArt(color, seed) {
  let state = seed;
  const random = () => {
    state = (state * 16807) % 2147483647;
    return state / 2147483647;
  };
  const spikes = 9;
  const points = Array.from({ length: spikes * 2 }, (_, i) => {
    const angle = (Math.PI / spikes) * i + random() * 0.3;
    const r = i % 2 ? 13 + random() * 3 : 19 + random() * 7;
    return [30 + r * Math.cos(angle), 30 + r * Math.sin(angle)];
  });
  // a smooth outline through the middles of the sides, bent by the points
  const mid = (a, b) => `${fixed((a[0] + b[0]) / 2)} ${fixed((a[1] + b[1]) / 2)}`;
  const at = (i) => points[i % points.length];
  let d = `M${mid(at(0), at(1))}`;
  for (let i = 1; i <= points.length; i++) d += ` Q${fixed(at(i)[0])} ${fixed(at(i)[1])} ${mid(at(i), at(i + 1))}`;
  const drops = Array.from({ length: 3 }, () => {
    const angle = random() * Math.PI * 2;
    const r = 25 + random() * 3;
    return svgEl('circle', { cx: fixed(30 + r * Math.cos(angle)), cy: fixed(30 + r * Math.sin(angle)), r: fixed(1.5 + random() * 1.5) });
  });
  return svgEl('svg', { viewBox: '-3 -3 66 66', class: 'paint__blot', 'aria-hidden': 'true', style: `fill:${color}` },
    svgEl('path', { d: `${d} Z` }),
    ...drops);
}

export default {
  id: ID,
  title: 'Ёлочные игрушки',
  subtitle: 'Раскрась игрушки красками нот',
  emoji: '🎄',
  accent: ACCENT,
  group: GROUP,

  mount(root) {
    // start downloading the piano now, so the first painted toy isn't silent
    loadPiano();

    const screen = el('div', { class: 'screen toys-game', style: `--accent:${ACCENT}` });
    root.append(screen);

    // the paints stick right under the top bar, and how tall the bar is
    // depends on whether the title fits on one line
    const bar = document.querySelector('.topbar');
    const barWatch = new ResizeObserver(() => screen.style.setProperty('--bar', `${bar.offsetHeight}px`));
    if (bar) barWatch.observe(bar);

    let pool;
    // { note, kind, painted } for every toy of the round
    let toys;
    // the paint on the brush, one of the first-octave notes, or null
    let brush;
    // the toy tapped before its paint (or painted wrong), waiting for a paint
    let waiting;
    let score;
    // toys painted at least once: only the first try scores
    let tried;
    let locked;
    let cancelled = false;
    // bumped on every new round, so the end of a round that has been
    // restarted doesn't show its result over the new one
    let round = 0;
    // nodes on display, so a tap changes them without redrawing the screen
    let view = {};

    const label = (note) => (isMixed(pool) ? `${note.ru} ${octaveName(note)}` : note.ru);

    function say(text, kind) {
      view.feedback.textContent = text || ' ';
      view.feedback.className = `feedback feedback--${kind}`;
    }

    /** Lights up the paint on the brush and the toy waiting for its paint. */
    function showPicks() {
      view.paints.forEach((node, i) => {
        node.classList.toggle('is-selected', brush === NOTES[i]);
        node.setAttribute('aria-pressed', brush === NOTES[i] ? 'true' : 'false');
      });
      view.toys.forEach((node, i) => node.classList.toggle('is-selected', i === waiting));
    }

    function renderProgress() {
      return el('div', { class: 'progress' },
        el('div', { class: 'progress__dots' },
          toys.map((toy) => el('span', { class: `dot ${toy.painted ? 'dot--done' : ''}` }))),
        el('div', { class: 'progress__score' }, `⭐ ${score}`),
      );
    }

    function renderPaint(paint, i) {
      return el('button', {
        class: 'paint',
        type: 'button',
        'aria-pressed': 'false',
        'aria-label': `Краска ${paint.ru}`,
        onclick: () => tapPaint(paint),
      },
        blotArt(paint.color, (i + 1) * 7919),
        el('span', { class: 'paint__name' }, paint.ru));
    }

    function renderToy(toy, i, box) {
      const { height, staff, art } = SHAPES[toy.kind];
      return el('button', {
        class: `toy toy--${toy.kind}`,
        type: 'button',
        'aria-label': 'Ёлочная игрушка',
        onclick: () => tapToy(i),
      },
        svgEl('svg', { viewBox: `0 0 100 ${height}`, class: 'toy__art', 'aria-hidden': 'true' }, art()),
        el('span', { class: 'toy__staff', style: `left:${staff.x}%;top:${staff.y}%;width:${staff.width}%` },
          renderStaff(toy.note, { colored: false, box })));
    }

    function render() {
      clear(screen);
      // one box for every toy, so all the staves are the same size
      const box = staffBox(pool);
      view = {
        progress: renderProgress(),
        feedback: el('div', { class: 'feedback' }, ' '),
        paints: NOTES.map(renderPaint),
        toys: toys.map((toy, i) => renderToy(toy, i, box)),
      };
      view.board = el('div', { class: 'toys' }, view.toys);

      mount(screen,
        view.progress,
        octaveChips(restart),
        el('div', { class: 'toys__task' },
          'Нарядим ёлочку! Нажми на краску, потом на игрушку с этой нотой — и раскрась её.'),
        // the paints stay on screen while the toys are scrolled
        el('div', { class: 'paints' }, el('div', { class: 'paints__row' }, view.paints), view.feedback),
        view.board,
      );
    }

    /** A fresh round — "Ещё раз", or octave chips that changed the set of notes. */
    function restart() {
      pool = drilledNotes();
      toys = buildQueue(pool, TOYS).map((note, i) => ({ note, kind: kindAt(i), painted: false }));
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
        paintToy(waiting);
        return;
      }
      // tapping the paint on the brush again washes the brush
      brush = brush === paint ? null : paint;
      showPicks();
      say(brush ? `Теперь нажми на игрушку с нотой ${brush.ru}` : null, 'hint');
    }

    function tapToy(i) {
      if (locked) return;
      const toy = toys[i];
      // a painted toy only sounds its note again
      if (toy.painted) {
        playPiano(toy.note.freq);
        return;
      }
      if (brush) {
        paintToy(i);
        return;
      }
      waiting = waiting === i ? null : i;
      showPicks();
      say(waiting === null ? null : 'Какой краской её раскрасить? Выбери краску наверху', 'hint');
    }

    /** Puts the paint on the brush on toy i. */
    function paintToy(i) {
      const toy = toys[i];
      const node = view.toys[i];
      const isRight = brush.pc === toy.note.pc;
      const isFirstTry = !tried.has(i);
      tried.add(i);
      if (isFirstTry) store.recordAnswer(toy.note.id, isRight);

      if (!isRight) {
        // the toy waits for its real paint, and the wrong one comes off the brush
        playFail();
        brush = null;
        waiting = i;
        showPicks();
        say(`Нет, это ${label(toy.note)}. Найди её краску`, 'bad');
        node.classList.add('is-shaking');
        node.addEventListener('animationend', () => node.classList.remove('is-shaking'), { once: true });
        return;
      }

      if (isFirstTry) score += 1;
      toy.painted = true;
      // the next pair starts from scratch, whichever is tapped first
      brush = null;
      waiting = null;
      showPicks();
      node.style.setProperty('--paint', toy.note.color);
      node.style.setProperty('--paint-ink', toy.note.ink);
      node.classList.add('is-painted');
      node.setAttribute('aria-label', `Ёлочная игрушка ${label(toy.note)}`);
      playPiano(toy.note.freq);
      const progress = renderProgress();
      view.progress.replaceWith(progress);
      view.progress = progress;

      if (toys.every((item) => item.painted)) finish();
      else say(praise(), 'good');
    }

    async function finish() {
      locked = true;
      const current = round;
      say('Ёлочка нарядная! 🎄', 'good');
      view.board.classList.add('toys--done');
      await delay(2000);
      if (cancelled || current !== round) return;
      locked = false;
      clear(screen);
      screen.append(renderRoundResult({ id: ID, group: GROUP, score, total: toys.length, onRestart: restart }));
    }

    restart();
    return () => {
      cancelled = true;
      barWatch.disconnect();
    };
  },
};
