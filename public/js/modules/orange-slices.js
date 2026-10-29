// "Orange slices": a pairs game after a music-school worksheet. Notes on the
// staff stand in one column, orange slices with note names in the other, and
// a hamster on top wants every slice. Tap a staff and then its slice (or the
// slice first): a right pair sounds the note on the piano, the slice goes into
// the hamster's cheeks and the next note takes the staff's place. A round is
// ten notes of the picked octaves, and by its end the cheeks are as round as
// they get. The notes are all different when the octaves have ten or more;
// with fewer some come twice, but a note never stands on the board twice at
// once — pairs are told by the note.
//
// There is always one slice too many, so the last notes still have to be
// read instead of taking whatever is left. The extra slice belongs to the
// note that comes next: when that note takes a free place, its slice is on
// the board already, and the slice that appears then is for a later note.
// So a slice that has just appeared is never the one for the staff that has
// just appeared. Once no notes are left to come, the extra slice is just one
// more note of the octaves.
//
// The notes and how they look are shared with the staff games: the octave
// chips and the "coloured notes" toggle. With several octaves the slices name
// the octave too.
//
// A point is a note paired right at the first try. After a wrong slice the
// child is told which note it is and finds its slice, without the point.

import { el, clear, mount, sample, shuffle, svgEl, delay } from '../core/ui.js';
import { renderStaff, staffBox } from '../core/staff.js';
import { colorToggle, octaveChips, drilledNotes } from '../core/controls.js';
import { praise, renderRoundResult } from '../core/quiz.js';
import { store } from '../core/store.js';
import { playFail } from '../core/audio.js';
import { loadPiano, playPiano } from '../core/piano.js';
import { isMixed, octaveName } from '../data/notes.js';

const ID = 'orange-slices';
const GROUP = 'note-games';
const ACCENT = '#FB8C00';
// staves on the board at a time; the slices are one more, so the board takes
// five different notes — as many as the smallest octave has
const PLACES = 4;
// notes in a round: as in the other games, so "8 of 10" means the same everywhere
const ROUND_NOTES = 10;

const sliceOf = (note) => ({ note, tilt: Math.round(Math.random() * 20 - 10) });

/** An orange slice seen from the side: rind, pith and flesh cut into segments. */
function sliceArt() {
  const cx = 60;
  const cy = 4;
  const half = (r) => `M${cx - r} ${cy} A${r} ${r} 0 0 0 ${cx + r} ${cy} Z`;
  const segments = [30, 60, 90, 120, 150].map((deg) => {
    const rad = (deg * Math.PI) / 180;
    return svgEl('line', {
      x1: cx, y1: cy, x2: cx + 46 * Math.cos(rad), y2: cy + 46 * Math.sin(rad), class: 'slice__segment',
    });
  });
  return svgEl('svg', { viewBox: '0 0 120 64', class: 'slice__art', 'aria-hidden': 'true' },
    svgEl('path', { d: half(56), class: 'slice__rind' }),
    svgEl('path', { d: half(50), class: 'slice__pith' }),
    svgEl('path', { d: half(46), class: 'slice__flesh' }),
    ...segments,
    // drawn on top of everything, seen only around a picked slice
    svgEl('path', { d: half(56), class: 'slice__outline' }));
}

/**
 * The hamster that gets the slices, sitting with one in its paws. How big its
 * cheek pouches are is set from outside (see cheeks), so they can swell
 * smoothly when a slice arrives.
 */
function renderHamster() {
  const cheek = (side, cx) => svgEl('g', { class: `hamster__cheek hamster__cheek--${side}` },
    svgEl('ellipse', { cx, cy: 57, rx: 11, ry: 10, class: 'hamster__pouch' }),
    svgEl('ellipse', { cx, cy: 59, rx: 5, ry: 3, class: 'hamster__blush' }));
  const twice = (make) => [make(1), make(-1)];

  return svgEl('svg', { viewBox: '0 0 100 94', class: 'hamster', role: 'img', 'aria-label': 'Хомячок' },
    ...twice((s) => svgEl('circle', { cx: 50 - 26 * s, cy: 22, r: 11, class: 'hamster__fur' })),
    ...twice((s) => svgEl('circle', { cx: 50 - 26 * s, cy: 22, r: 6, class: 'hamster__ear' })),
    ...twice((s) => svgEl('ellipse', { cx: 50 - 14 * s, cy: 88, rx: 8, ry: 4.5, class: 'hamster__foot' })),
    // head and body are one round lump
    svgEl('ellipse', { cx: 50, cy: 53, rx: 36, ry: 35, class: 'hamster__fur' }),
    svgEl('ellipse', { cx: 50, cy: 68, rx: 22, ry: 19, class: 'hamster__belly' }),
    cheek('left', 29),
    cheek('right', 71),
    ...twice((s) => svgEl('circle', { cx: 50 - 12 * s, cy: 41, r: 4.6, class: 'hamster__eye' })),
    ...twice((s) => svgEl('circle', { cx: 51.6 - 12 * s, cy: 39.4, r: 1.6, class: 'hamster__glint' })),
    svgEl('ellipse', { cx: 50, cy: 50, rx: 3.6, ry: 2.6, class: 'hamster__nose' }),
    svgEl('path', { d: 'M44.5 54.5 Q47 57.5 50 54.5 Q53 57.5 55.5 54.5', class: 'hamster__mouth' }),
    // a slice of its own, held in both paws
    svgEl('path', { d: 'M40 70 A10 10 0 0 0 60 70 Z', class: 'slice__rind' }),
    svgEl('path', { d: 'M42.5 70 A7.5 7.5 0 0 0 57.5 70 Z', class: 'slice__flesh' }),
    ...twice((s) => svgEl('ellipse', { cx: 50 - 10 * s, cy: 73, rx: 5, ry: 4, class: 'hamster__paw' })));
}

/** Cheeks for `full` — the share of the round's slices the hamster has got, 0 to 1. */
const cheeks = (full) => `--puff:${1 + full * 1.6};--puff-y:${1 + full * 0.8}`;

const calm = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export default {
  id: ID,
  title: 'Апельсиновые дольки',
  subtitle: 'Найди к каждой ноте её дольку',
  emoji: '🍊',
  accent: ACCENT,
  group: GROUP,

  mount(root) {
    // start downloading the piano now, so the first right pair isn't silent
    loadPiano();

    const screen = el('div', { class: 'screen pairs', style: `--accent:${ACCENT}` });
    root.append(screen);

    let pool;
    // the notes of the round in the order they come onto the board, drawn
    // one by one when they are needed (see drawNote)
    let queue;
    // the next note of the queue to take a free place
    let cursor;
    // places on the board: a note (a slice) or null once the notes ran out
    let staves;
    let slices;
    let matched;
    let score;
    // notes answered at least once: only the first try scores
    let tried;
    // { type: 'staff' | 'slice', id } — what was tapped first, waiting for its pair
    let selected;
    let message;
    // 'staff:<id>' / 'slice:<id>' that have just come onto the board and pop in
    let fresh = new Set();
    let locked;
    let cancelled = false;
    // bumped on every new round, so an animation still running doesn't move
    // a round that has been restarted
    let round = 0;
    // nodes of the board on display, for the animations
    let view = {};

    const label = (note) => (isMixed(pool) ? `${note.ru} ${octaveName(note)}` : note.ru);
    const isPicked = (type, id) => Boolean(selected && selected.type === type && selected.id === id);
    const isFresh = (type, id) => fresh.has(`${type}:${id}`);

    function say(text, kind) {
      message = text ? { text, kind } : null;
      if (!view.feedback) return;
      view.feedback.textContent = text || ' ';
      view.feedback.className = `feedback feedback--${kind}`;
    }

    /** Lights up what was tapped first, without redrawing the board. */
    function select(next) {
      selected = next;
      for (const node of screen.querySelectorAll('.is-selected')) node.classList.remove('is-selected');
      if (next) screen.querySelector(`[data-${next.type}="${next.id}"]`)?.classList.add('is-selected');
    }

    /** Notes of the octaves that are not on the board, as a staff or as a slice. */
    function offBoard() {
      const onBoard = [...staves, ...slices.map((slot) => slot && slot.note)];
      return pool.filter((note) => !onBoard.includes(note));
    }

    /**
     * The next note of the round: one that is not on the board, and of those
     * one that has come the fewest times, so the ten are all different when
     * the octaves have that many notes, and otherwise repeat about evenly.
     */
    function drawNote() {
      const free = offBoard();
      const times = (note) => queue.filter((item) => item === note).length;
      const fewest = Math.min(...free.map(times));
      const [note] = sample(free.filter((item) => times(item) === fewest), 1);
      queue.push(note);
      return note;
    }

    /**
     * The extra slice once no notes are left to come: a note that is not on
     * the board, if possible not the one the animal has just got, and the twin
     * of a staff on the board when there is one.
     */
    function decoy(skip) {
      const free = offBoard();
      const others = free.filter((note) => note !== skip);
      const candidates = others.length ? others : free;
      const twins = candidates.filter((note) => staves.some((staff) => staff && staff.pc === note.pc));
      const [note] = sample(twins.length ? twins : candidates, 1);
      return note || null;
    }

    function renderProgress() {
      return el('div', { class: 'progress' },
        el('div', { class: 'progress__dots' },
          Array.from({ length: ROUND_NOTES }, (_, i) => el('span', { class: `dot ${i < matched ? 'dot--done' : ''}` }))),
        el('div', { class: 'progress__score' }, `⭐ ${score}`),
      );
    }

    function renderStaffPlace(note, colored, box) {
      // an empty place keeps its size, so the staves below it stay put
      if (!note) {
        return el('div', { class: 'pairs__staff pairs__staff--empty', 'aria-hidden': 'true' }, renderStaff(null, { box }));
      }
      return el('button', {
        class: `pairs__staff ${isPicked('staff', note.id) ? 'is-selected' : ''} ${isFresh('staff', note.id) ? 'is-new' : ''}`,
        type: 'button',
        'data-staff': note.id,
        onclick: () => tap('staff', note.id),
      }, renderStaff(note, { colored, box }));
    }

    function renderSlicePlace(slot, isOver) {
      if (!slot) {
        return el('div', { class: 'slice slice--empty', 'aria-hidden': 'true' }, el('span', { class: 'slice__body' }, sliceArt()));
      }
      const { note, tilt } = slot;
      return el('button', {
        class: `slice ${isOver ? 'slice--extra' : ''} ${isPicked('slice', note.id) ? 'is-selected' : ''} ${isFresh('slice', note.id) ? 'is-new' : ''}`,
        type: 'button',
        disabled: isOver,
        'data-slice': note.id,
        'aria-label': `Долька ${label(note)}`,
        onclick: () => tap('slice', note.id),
      },
        el('span', { class: 'slice__body', style: `--tilt:${tilt}deg` },
          sliceArt(),
          el('span', { class: 'slice__label' },
            el('span', { class: 'slice__name' }, note.ru),
            isMixed(pool) ? el('span', { class: 'slice__octave' }, octaveName(note)) : null)));
    }

    function render() {
      clear(screen);
      const colored = store.setting('coloredHeads', true);
      const box = staffBox(pool);
      const isOver = matched === ROUND_NOTES;

      view = {
        animal: el('div', { class: 'pairs__animal', style: cheeks(matched / ROUND_NOTES) }, renderHamster()),
        feedback: el('div', { class: `feedback ${message ? `feedback--${message.kind}` : ''}` }, message ? message.text : ' '),
        lines: svgEl('svg', { class: 'pairs__lines', 'aria-hidden': 'true' }),
      };
      view.board = el('div', { class: 'pairs__board' },
        view.lines,
        el('div', { class: 'pairs__col' }, staves.map((note) => renderStaffPlace(note, colored, box))),
        el('div', { class: 'pairs__col' }, slices.map((slot) => renderSlicePlace(slot, isOver))));

      mount(screen,
        renderProgress(),
        octaveChips(restart),
        colorToggle(redraw),
        el('div', { class: 'pairs__head' },
          el('div', { class: 'pairs__who' },
            view.animal,
            el('div', { class: 'pairs__basket', 'aria-label': `Собрано ${matched} долек из ${ROUND_NOTES}` },
              `🍊 ${matched} из ${ROUND_NOTES}`)),
          el('div', { class: 'pairs__task' },
            'Помоги хомячку собрать все дольки: нажми на ноту, потом на её дольку. Одна долька лишняя!')),
        view.feedback,
        view.board,
      );
      // they have popped in once; a redraw shows them as they are
      fresh = new Set();
    }

    /** Redraws the board as it is — for the colour toggle. */
    function redraw() {
      if (!locked) render();
    }

    /** A fresh round — "Ещё раз", or octave chips that changed the set of notes. */
    function restart() {
      pool = drilledNotes();
      queue = [];
      staves = [];
      slices = [];
      while (staves.length < PLACES) staves.push(drawNote());
      cursor = staves.length;
      // the extra slice: the note that comes next
      const extra = drawNote();
      slices = shuffle([...staves, extra]).map(sliceOf);
      matched = 0;
      score = 0;
      tried = new Set();
      selected = null;
      message = null;
      fresh = new Set();
      locked = false;
      round += 1;
      render();
    }

    function tap(type, id) {
      if (locked) return;
      if (!selected || selected.type === type) {
        // the first half of a pair; tapping it again lets it go
        const next = isPicked(type, id) ? null : { type, id };
        select(next);
        if (next) say(type === 'staff' ? 'Теперь нажми на её дольку' : 'Теперь нажми на её ноту', 'hint');
        else say(null, 'hint');
        return;
      }
      const staffId = type === 'staff' ? id : selected.id;
      const sliceId = type === 'slice' ? id : selected.id;
      const note = staves.find((item) => item && item.id === staffId);
      const isFirstTry = !tried.has(staffId);
      tried.add(staffId);
      if (isFirstTry) store.recordAnswer(staffId, staffId === sliceId);

      if (staffId === sliceId) {
        if (isFirstTry) score += 1;
        match(note);
      } else {
        miss(note, sliceId);
      }
    }

    /** A wrong slice: say which note this is and keep the staff picked for its real slice. */
    function miss(note, sliceId) {
      playFail();
      select({ type: 'staff', id: note.id });
      say(`Нет, это ${label(note)}. Найди её дольку`, 'bad');
      const slice = screen.querySelector(`[data-slice="${sliceId}"]`);
      slice.classList.add('is-shaking');
      slice.addEventListener('animationend', () => slice.classList.remove('is-shaking'), { once: true });
    }

    async function match(note) {
      locked = true;
      const current = round;
      matched += 1;
      // the same note may come again later, and then it is a new try
      tried.delete(note.id);
      select(null);
      playPiano(note.freq);
      say(praise(), 'good');

      await feed(note.id);
      if (cancelled || current !== round) return;

      // the pair leaves the board and the next note takes the free place
      const place = staves.indexOf(note);
      const slicePlace = slices.findIndex((slot) => slot && slot.note === note);
      slices[slicePlace] = null;
      if (cursor < ROUND_NOTES) {
        // its slice is on the board already: it was the extra one
        staves[place] = queue[cursor];
        cursor += 1;
        const extra = cursor < ROUND_NOTES ? drawNote() : decoy(note);
        if (extra) slices[slicePlace] = sliceOf(extra);
        fresh = new Set([`staff:${staves[place].id}`, extra && `slice:${extra.id}`]);
      } else {
        staves[place] = null;
      }

      const isOver = matched === ROUND_NOTES;
      if (isOver) say(slices.some(Boolean) ? 'Ням-ням! А эта долька — лишняя' : 'Ням-ням! Все дольки у хомячка', 'good');
      render();
      if (!isOver) {
        locked = false;
        return;
      }

      await delay(1400);
      if (cancelled || current !== round) return;
      locked = false;
      clear(screen);
      screen.append(renderRoundResult({ id: ID, group: GROUP, score, total: ROUND_NOTES, onRestart: restart }));
    }

    /** A line joins the pair, then the slice flies to the hamster and the staff fades. */
    async function feed(id) {
      const staff = screen.querySelector(`[data-staff="${id}"]`);
      const slice = screen.querySelector(`[data-slice="${id}"]`);
      const { board: boardEl, lines, animal } = view;
      const origin = boardEl.getBoundingClientRect();
      const from = staff.getBoundingClientRect();
      const to = slice.getBoundingClientRect();
      lines.append(svgEl('line', {
        x1: from.right - origin.left,
        y1: from.top + from.height / 2 - origin.top,
        x2: to.left + to.width * 0.15 - origin.left,
        y2: to.top + to.height / 2 - origin.top,
        class: 'pairs__line',
      }));
      staff.classList.add('is-done');
      slice.classList.add('is-selected');

      await delay(450);
      if (calm() || !slice.isConnected) return;
      const start = slice.getBoundingClientRect();
      const end = animal.getBoundingClientRect();
      const dx = end.left + end.width / 2 - (start.left + start.width / 2);
      const dy = end.top + end.height / 2 - (start.top + start.height / 2);
      staff.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 450, fill: 'forwards' });
      await slice.animate(
        [{ transform: 'none', opacity: 1 }, { transform: `translate(${dx}px, ${dy}px) scale(.3)`, opacity: 0.2 }],
        { duration: 550, easing: 'ease-in', fill: 'forwards' },
      ).finished.catch(() => {});
      // the slice is in: the cheeks swell on the hamster on display, so the
      // board drawn next has them as big already
      animal.setAttribute('style', cheeks(matched / ROUND_NOTES));
      animal.animate(
        [{ transform: 'scale(1)' }, { transform: 'scale(1.3)' }, { transform: 'scale(1)' }],
        { duration: 300, easing: 'ease-out' },
      );
    }

    restart();
    return () => { cancelled = true; };
  },
};
