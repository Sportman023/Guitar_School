// "Note detective": a game after a music-school worksheet. Somebody has hidden
// all the notes of one name, and the child finds them on a map: eight things
// along a dotted path — a house, a tower, a mill, a boat … — each with a
// window that shows a note on the staff. Tap a thing with the note that is
// being looked for, and the thing is painted in that note's colour (Ре
// orange, Ля blue …), as in a colouring book, and the note sounds. A wrong
// one shakes, and the child is told which note it is. A round is three cases
// in turn, each for a note of its own picked at random, with a fresh map; two
// or three things of the eight hide the note.
//
// The note heads are always black: a coloured head would show where the note
// hides, and the staff wouldn't have to be read. As in "Pick the berries",
// the case names the note only, so the note in any of the octaves picked on
// the chips counts, and the stars work the same: every note found is a star,
// but a wrong tap takes the star of the next note found.
//
// The notes have to be big enough to be read on a phone, so the map is not
// squeezed into the screen: there are two things in a row on a phone, and the
// map scrolls under the case bar, which stays in sight.

import { el, clear, mount, sample, shuffle, svgEl, delay, noteStyle } from '../core/ui.js';
import { renderStaff, tightStaffBox } from '../core/staff.js';
import { octaveChips, drilledNotes } from '../core/controls.js';
import { praise, renderRoundResult, buildQueue } from '../core/quiz.js';
import { store } from '../core/store.js';
import { playFail } from '../core/audio.js';
import { loadPiano, playPiano } from '../core/piano.js';
import { NOTES, isMixed, octaveName } from '../data/notes.js';

const ID = 'detective';
const GROUP = 'note-games';
const ACCENT = '#5E35B1';
const CASES = 3;
const PLACES = 8;
// how many of the eight things may hide the note
const HIDDEN = [2, 3];
// things in a row: as many as fit at this width, but at least two and at most four
const MIN_PLACE = 150;
const COLUMNS = [2, 4];
// the gap between the things in a row, as in styles.css
const GAP = 16;

const fixed = (n) => Number(n.toFixed(1));

const calm = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Every thing is drawn 120 × 130 around the same window, x 20…100 and y 40…112
// (see .place__window in styles.css). Parts of class `body` take the paint
// once the note is found; the `detail` parts stay as they are. `inside` is
// what the window hides — a door, little windows, a lock …: it shows once the
// note is found and the window goes, so the thing is a whole picture then.
const BODY = 'thing__body';
const DETAIL = 'thing__detail';
const LINE = 'thing__line';
const THIN = 'thing__line thing__line--thin';

/** A little window with a cross of bars. */
const pane = (x, y, width, height) => [
  svgEl('rect', { x, y, width, height, rx: 2, class: DETAIL }),
  svgEl('line', { x1: x + width / 2, y1: y, x2: x + width / 2, y2: y + height, class: THIN }),
  svgEl('line', { x1: x, y1: y + height / 2, x2: x + width, y2: y + height / 2, class: THIN }),
];

/** A round window with a cross of bars. */
const porthole = (cx, cy, r) => [
  svgEl('circle', { cx, cy, r, class: DETAIL }),
  svgEl('line', { x1: cx, y1: cy - r, x2: cx, y2: cy + r, class: THIN }),
  svgEl('line', { x1: cx - r, y1: cy, x2: cx + r, y2: cy, class: THIN }),
];

/** An arched door from y `top` down to `bottom`, with a knob. */
const door = (cx, top, bottom, halfWidth) => [
  svgEl('path', {
    d: `M${cx - halfWidth} ${bottom} V${top + halfWidth} Q${cx - halfWidth} ${top} ${cx} ${top} Q${cx + halfWidth} ${top} ${cx + halfWidth} ${top + halfWidth} V${bottom} Z`,
    class: DETAIL,
  }),
  svgEl('circle', { cx: cx + halfWidth * 0.55, cy: (top + bottom) / 2 + 6, r: 1.8, class: 'thing__knob' }),
];

const THINGS = [
  {
    name: 'Домик',
    art: () => [
      svgEl('rect', { x: 80, y: 10, width: 13, height: 26, class: DETAIL }),
      svgEl('rect', { x: 12, y: 38, width: 96, height: 86, rx: 3, class: BODY }),
      svgEl('polygon', { points: '4,44 60,4 116,44', class: BODY }),
    ],
    inside: () => [...pane(24, 52, 22, 22), ...pane(74, 52, 22, 22), ...door(60, 82, 124, 12)],
  },
  {
    name: 'Башня',
    art: () => [
      svgEl('line', { x1: 60, y1: 18, x2: 60, y2: 1, class: LINE }),
      svgEl('polygon', { points: '60,1 78,6 60,11', class: BODY }),
      svgEl('path', { d: 'M12 124 V30 H26 V18 H40 V30 H53 V18 H67 V30 H80 V18 H94 V30 H108 V124 Z', class: BODY }),
    ],
    inside: () => [
      svgEl('rect', { x: 28, y: 48, width: 10, height: 22, rx: 5, class: DETAIL }),
      svgEl('rect', { x: 82, y: 48, width: 10, height: 22, rx: 5, class: DETAIL }),
      ...door(60, 84, 124, 15),
      svgEl('line', { x1: 60, y1: 84, x2: 60, y2: 124, class: THIN }),
    ],
  },
  {
    name: 'Мельница',
    art: () => [
      svgEl('polygon', { points: '20,30 100,30 112,124 8,124', class: BODY }),
      svgEl('path', { d: 'M16 32 Q60 -4 104 32 Z', class: BODY }),
      // the sails turn in front of the roof, round a hub over it; the one
      // pointing down goes behind the window until the note is found
      ...[15, 105, 195, 285].map((deg) => svgEl('rect', {
        x: 55, y: -30, width: 10, height: 46, rx: 2, transform: `rotate(${deg} 60 16)`, class: DETAIL,
      })),
      svgEl('circle', { cx: 60, cy: 16, r: 5, class: DETAIL }),
    ],
    inside: () => [...porthole(60, 78, 9), ...door(60, 96, 124, 11)],
  },
  {
    name: 'Грибок',
    art: () => [
      svgEl('rect', { x: 14, y: 34, width: 92, height: 94, rx: 18, class: DETAIL }),
      svgEl('path', { d: 'M2 32 C2 6 30 -6 60 -6 C90 -6 118 6 118 32 C118 38 112 40 104 38 L16 38 C8 40 2 38 2 32 Z', class: BODY }),
      ...[[30, 16, 6], [60, 6, 5], [90, 16, 6]].map(([cx, cy, r]) => svgEl('circle', { cx, cy, r, class: 'thing__spot' })),
    ],
    // a gnome lives in it
    inside: () => [...porthole(60, 64, 11), ...door(60, 94, 128, 12)],
  },
  {
    name: 'Кораблик',
    art: () => [
      svgEl('line', { x1: 60, y1: 2, x2: 60, y2: 30, class: LINE }),
      svgEl('polygon', { points: '60,2 80,8 60,14', class: BODY }),
      // a sail filled with wind, its sides bulging out
      svgEl('path', { d: 'M16 30 Q60 22 104 30 Q114 72 104 114 L16 114 Q6 72 16 30 Z', class: BODY }),
      svgEl('path', { d: 'M-4 110 H124 Q114 134 94 134 H26 Q6 134 -4 110 Z', class: BODY }),
      svgEl('circle', { cx: 34, cy: 122, r: 4, class: 'thing__spot' }),
      svgEl('circle', { cx: 86, cy: 122, r: 4, class: 'thing__spot' }),
    ],
    inside: () => [
      svgEl('path', { d: 'M15 54 Q60 48 105 54', class: THIN }),
      svgEl('path', { d: 'M15 92 Q60 86 105 92', class: THIN }),
      svgEl('circle', { cx: 60, cy: 72, r: 12, class: DETAIL }),
      svgEl('circle', { cx: 60, cy: 72, r: 5, class: 'thing__knob' }),
    ],
  },
  {
    name: 'Сундук',
    art: () => [
      svgEl('path', { d: 'M8 46 V36 Q8 10 60 10 Q112 10 112 36 V46 Z', class: BODY }),
      svgEl('rect', { x: 8, y: 44, width: 104, height: 82, rx: 4, class: BODY }),
      svgEl('rect', { x: 6, y: 40, width: 108, height: 8, rx: 2, class: DETAIL }),
      svgEl('rect', { x: 10, y: 50, width: 8, height: 74, class: DETAIL }),
      svgEl('rect', { x: 102, y: 50, width: 8, height: 74, class: DETAIL }),
    ],
    // planks, and the lock with its keyhole
    inside: () => [
      svgEl('line', { x1: 18, y1: 80, x2: 102, y2: 80, class: THIN }),
      svgEl('line', { x1: 18, y1: 104, x2: 102, y2: 104, class: THIN }),
      svgEl('rect', { x: 49, y: 50, width: 22, height: 24, rx: 3, class: DETAIL }),
      svgEl('circle', { cx: 60, cy: 59, r: 3, class: 'thing__knob' }),
      svgEl('rect', { x: 58.8, y: 59, width: 2.4, height: 8, class: 'thing__knob' }),
    ],
  },
  {
    name: 'Дерево',
    art: () => [
      svgEl('path', { d: 'M44 108 H76 L80 130 H40 Z', class: DETAIL }),
      svgEl('path', {
        d: 'M16 44 C4 36 10 14 28 18 C30 2 52 -2 60 10 C68 -2 90 2 92 18 C110 14 116 36 104 44 '
          + 'C118 54 118 76 106 82 C120 96 108 120 88 114 C80 126 40 126 32 114 C12 120 0 96 14 82 C2 76 2 54 16 44 Z',
        class: BODY,
      }),
    ],
    // blossoms all over the crown
    inside: () => [[36, 58], [80, 52], [58, 78], [88, 92], [30, 94], [62, 104], [56, 32], [24, 34], [94, 32]]
      .map(([cx, cy]) => svgEl('circle', { cx, cy, r: 5, class: DETAIL })),
  },
  {
    name: 'Вагончик',
    art: () => [
      svgEl('rect', { x: 10, y: 34, width: 100, height: 86, rx: 6, class: BODY }),
      svgEl('rect', { x: 4, y: 26, width: 112, height: 12, rx: 6, class: BODY }),
      svgEl('circle', { cx: 30, cy: 121, r: 9, class: 'thing__wheel' }),
      svgEl('circle', { cx: 90, cy: 121, r: 9, class: 'thing__wheel' }),
    ],
    inside: () => [
      ...pane(20, 48, 34, 28),
      ...pane(66, 48, 34, 28),
      svgEl('line', { x1: 12, y1: 94, x2: 108, y2: 94, class: LINE }),
    ],
  },
  {
    name: 'Лавка',
    art: () => [
      svgEl('rect', { x: 12, y: 28, width: 96, height: 98, rx: 2, class: DETAIL }),
      // a scalloped awning over the counter, striped once it's painted
      svgEl('path', {
        d: `M4 14 H116 V30 ${Array.from({ length: 8 }, (_, i) => `Q${109 - 14 * i} 40 ${102 - 14 * i} 30`).join(' ')} Z`,
        class: BODY,
      }),
      ...Array.from({ length: 4 }, (_, i) => svgEl('rect', { x: 18 + 28 * i, y: 15, width: 14, height: 15, class: 'thing__stripe' })),
    ],
    // a shelf with jars, and a counter with fruit
    inside: () => [
      svgEl('line', { x1: 16, y1: 64, x2: 104, y2: 64, class: LINE }),
      ...[26, 44, 62, 80].map((x) => svgEl('rect', { x, y: 48, width: 12, height: 16, rx: 3, class: DETAIL })),
      svgEl('rect', { x: 12, y: 92, width: 96, height: 14, class: BODY }),
      ...[28, 42, 56, 74, 88].map((cx) => svgEl('circle', { cx, cy: 85, r: 6, class: DETAIL })),
    ],
  },
];

/** A smooth line through the points, like a path drawn on a map. */
function trail(points) {
  if (points.length < 2) return '';
  const at = (i) => points[Math.max(0, Math.min(points.length - 1, i))];
  let d = `M${fixed(points[0].x)} ${fixed(points[0].y)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C${fixed(c1.x)} ${fixed(c1.y)} ${fixed(c2.x)} ${fixed(c2.y)} ${fixed(p2.x)} ${fixed(p2.y)}`;
  }
  return d;
}

export default {
  id: ID,
  title: 'Нотный детектив',
  subtitle: 'Найди спрятанные ноты и раскрась',
  emoji: '🔍',
  accent: ACCENT,
  group: GROUP,

  mount(root) {
    // start downloading the piano now, so the first note found isn't silent
    loadPiano();

    const screen = el('div', { class: 'screen detective', style: `--accent:${ACCENT}` });
    root.append(screen);

    // the case bar sticks right under the top bar, and how tall the bar is
    // depends on whether the title fits on one line
    const bar = document.querySelector('.topbar');
    const barWatch = new ResizeObserver(() => screen.style.setProperty('--bar', `${bar.offsetHeight}px`));
    if (bar) barWatch.observe(bar);
    // the path is drawn through the things where they stand, so it is drawn
    // again whenever the map changes its size
    const mapWatch = new ResizeObserver(() => drawTrail());

    let pool;
    // { target, places: [{ note, thing, found }] } for every case of the round;
    // `target` is the first-octave note of the name being looked for
    let cases;
    // the case on display
    let current;
    // one box for every staff of the round, so the notes don't change size
    let box;
    let score;
    // stars that wrong taps have taken from the notes still to be found
    let owed;
    let locked;
    let cancelled = false;
    // bumped on every new round, so a case still closing doesn't move a
    // round that has been restarted
    let round = 0;
    // nodes on display, so a tap changes them without redrawing the screen
    let view = {};

    const label = (note) => (isMixed(pool) ? `${note.ru} ${octaveName(note)}` : note.ru);
    const theCase = () => cases[current];
    const hides = (item, place) => place.note.pc === item.target.pc;
    // notes hidden in the whole round, and how many of them are found
    const total = () => cases.reduce((sum, item) => sum + item.places.filter((place) => hides(item, place)).length, 0);
    const found = () => cases.reduce((sum, item) => sum + item.places.filter((place) => place.found).length, 0);

    // messages float under the case bar for a while, so the map never moves under a finger
    let toastTimer = null;
    function say(text, kind) {
      clearTimeout(toastTimer);
      view.toast.textContent = text || '';
      view.toast.className = `case__toast feedback--${kind} ${text ? 'is-shown' : ''}`;
      if (text) toastTimer = setTimeout(() => view.toast.classList.remove('is-shown'), 2400);
    }

    function renderProgress() {
      const done = found();
      return el('div', { class: 'progress' },
        el('div', { class: 'progress__dots' },
          Array.from({ length: total() }, (_, i) => el('span', { class: `dot ${i < done ? 'dot--done' : ''}` }))),
        el('div', { class: 'progress__score' }, `⭐ ${score}`),
      );
    }

    /** How many notes of the case on display are found, out of how many. */
    function renderCount() {
      const { places } = theCase();
      const hidden = places.filter((place) => hides(theCase(), place)).length;
      return el('div', { class: 'case__count' }, `Найдено ${places.filter((place) => place.found).length} из ${hidden}`);
    }

    function refreshCounts() {
      const progress = renderProgress();
      view.progress.replaceWith(progress);
      view.progress = progress;
      const count = renderCount();
      view.count.replaceWith(count);
      view.count = count;
    }

    function renderPlace(place, i, fresh) {
      const { name, art, inside } = THINGS[place.thing];
      return el('button', {
        class: `place ${place.found ? 'is-found' : ''} ${fresh ? 'is-new' : ''}`,
        type: 'button',
        style: `--paint:${place.note.color}`,
        'aria-label': place.found ? `${name}, нота ${label(place.note)}` : name,
        onclick: () => tap(i),
      },
        el('span', { class: 'place__body' },
          svgEl('svg', { viewBox: '0 0 120 130', class: 'place__art', 'aria-hidden': 'true' },
            art(),
            svgEl('g', { class: 'thing__inside' }, inside())),
          el('span', { class: 'place__window' }, renderStaff(place.note, { colored: false, box, narrow: true }))));
    }

    /** Draws the case on display; `fresh` — its things have just appeared and pop in. */
    function render(fresh = false) {
      clear(screen);
      const { target, places } = theCase();
      view = {
        progress: renderProgress(),
        count: renderCount(),
        toast: el('div', { class: 'case__toast', role: 'status' }),
        places: places.map((place, i) => renderPlace(place, i, fresh)),
        trail: svgEl('path', { class: 'map__trail' }),
      };
      view.map = el('div', { class: 'map' },
        svgEl('svg', { class: 'map__path', 'aria-hidden': 'true' }, view.trail),
        view.places);

      mount(screen,
        view.progress,
        octaveChips(restart),
        // the case stays in sight while the map is scrolled
        el('div', { class: 'case' },
          el('div', { class: 'case__task' },
            `Дело №${current + 1}: найди все ноты `,
            el('b', { class: 'case__note', style: noteStyle(target) }, target.ru)),
          view.count,
          view.toast),
        view.map,
      );
      fit();
      mapWatch.disconnect();
      mapWatch.observe(view.map);
    }

    /** As many things in a row as fit, two at least, so that the notes stay big. */
    function fit() {
      const width = view.map.clientWidth;
      const cols = Math.max(COLUMNS[0], Math.min(COLUMNS[1], Math.floor((width + GAP) / (MIN_PLACE + GAP))));
      view.map.style.setProperty('--cols', cols);
      // every other thing of a row stands a little lower, so the path winds
      view.places.forEach((node, i) => node.classList.toggle('is-low', (i % cols) % 2 === 1));
      view.cols = cols;
    }

    /** The dotted path through the things, row after row, turning back at the end of each. */
    function drawTrail() {
      if (!view.map || !view.map.isConnected) return;
      const origin = view.map.getBoundingClientRect();
      const centres = view.places.map((node) => {
        const rect = node.querySelector('.place__body').getBoundingClientRect();
        return { x: rect.left + rect.width / 2 - origin.left, y: rect.top + rect.height / 2 - origin.top };
      });
      const rows = [];
      for (let i = 0; i < centres.length; i += view.cols) rows.push(centres.slice(i, i + view.cols));
      view.trail.setAttribute('d', trail(rows.flatMap((row, r) => (r % 2 ? [...row].reverse() : row))));
    }

    /** A fresh round — "Ещё раз", or octave chips that changed the set of notes. */
    function restart() {
      pool = drilledNotes();
      // only names that the picked octaves have: the small octave starts at Ми
      const names = shuffle(NOTES.filter((name) => pool.some((note) => note.pc === name.pc))).slice(0, CASES);
      cases = names.map((target) => {
        const right = pool.filter((note) => note.pc === target.pc);
        const wrong = pool.filter((note) => note.pc !== target.pc);
        const [count] = sample(HIDDEN, 1);
        const notes = shuffle([...buildQueue(right, count), ...buildQueue(wrong, PLACES - count)]);
        const things = shuffle(THINGS.map((_, i) => i));
        return { target, places: notes.map((note, i) => ({ note, thing: things[i], found: false })) };
      });
      box = tightStaffBox(cases.flatMap((item) => item.places.map((place) => place.note)));
      current = 0;
      score = 0;
      owed = 0;
      locked = false;
      round += 1;
      render(true);
    }

    function tap(index) {
      if (locked) return;
      const place = theCase().places[index];
      const node = view.places[index];
      // a thing already painted only sounds its note again
      if (place.found) {
        playPiano(place.note.freq);
        return;
      }
      const isRight = hides(theCase(), place);
      store.recordAnswer(place.note.id, isRight);
      if (isRight) {
        paint(index);
        return;
      }
      owed += 1;
      playFail();
      say(`Нет, это ${label(place.note)}, а ищем ${theCase().target.ru}`, 'bad');
      node.classList.add('is-shaking');
      node.addEventListener('animationend', () => node.classList.remove('is-shaking'), { once: true });
    }

    async function paint(index) {
      const now = round;
      const { places } = theCase();
      const place = places[index];
      const node = view.places[index];
      place.found = true;
      if (owed) owed -= 1;
      else score += 1;
      playPiano(place.note.freq);
      node.classList.add('is-found');
      node.setAttribute('aria-label', `${THINGS[place.thing].name}, нота ${label(place.note)}`);
      refreshCounts();

      const left = places.filter((item) => !item.found && hides(theCase(), item)).length;
      if (left) {
        say(praise(), 'good');
        return;
      }
      const isLast = current === cases.length - 1;
      say(isLast ? 'Все дела раскрыты! 🔍' : `Дело №${current + 1} раскрыто! 🔍`, 'good');
      locked = true;
      await delay(1800);
      if (cancelled || now !== round) return;
      locked = false;
      if (isLast) {
        clear(screen);
        screen.append(renderRoundResult({ id: ID, group: GROUP, score, total: total(), onRestart: restart }));
        return;
      }
      // the next case, on a fresh map, from its beginning
      current += 1;
      render(true);
      window.scrollTo({ top: 0, behavior: calm() ? 'auto' : 'smooth' });
    }

    const onResize = () => {
      if (view.map && view.map.isConnected) fit();
    };
    window.addEventListener('resize', onResize);
    restart();
    return () => {
      cancelled = true;
      clearTimeout(toastTimer);
      barWatch.disconnect();
      mapWatch.disconnect();
      window.removeEventListener('resize', onResize);
    };
  },
};
