// Christmas decorations: snow behind the menus with drifts growing at the
// bottom of the screen, a string of lights under the top bar, a little tree
// beside the guitar and a greeting banner on the home screen. None of it
// reaches the lessons and games — there the screen stays as it always is,
// so nothing moves beside the task.
//
// A tap on the lights (the string or the tree) switches them: twinkle →
// running → off. That choice and the depth of the snow are kept in
// localStorage, so a reload does not undo them.
//
// The decorations put themselves up on SEASON_START and take themselves down
// after SEASON_END, so nothing has to be done in January. Everything lives in
// this file, the "Christmas" section at the end of styles.css and the banner
// font in fonts/, so it is easy to take out for good.

import { el, svgEl } from './ui.js';
import { IS_BETA } from './env.js';

// [month, day], both days included; the season wraps around the new year
const SEASON_START = [11, 25];
const SEASON_END = [1, 14];
const CHRISTMAS = [12, 25];

const FLAKES = 18;
// the drifts: from SNOW_MIN px at the start of the season up to SNOW_MAX,
// a little deeper with every flake that reaches the ground
const SNOW_MIN = 12;
const SNOW_MAX = 48;
const SNOW_PER_FLAKE = 0.06;
// where the drifts lie: left edge and width in % of the screen, share of the depth
const DRIFTS = [[-6, 42, 1], [22, 36, 0.7], [48, 44, 1.1], [78, 34, 0.85], [10, 26, 0.55]];

// soft bulb colours, in the order they hang on the wire
const BULBS = ['#ff8a80', '#ffd54f', '#aed581', '#82b1ff', '#f8bbd0'];
// px between the bulbs of the string: as many as fit the screen
const BULB_STEP = 44;
// what a tap on the lights cycles through
const MODES = ['twinkle', 'chase', 'off'];

const code = ([month, day]) => month * 100 + day;
const dayCode = (date) => code([date.getMonth() + 1, date.getDate()]);

/** Whether the decorations are up on `date`. */
export function isSeason(date = new Date()) {
  const today = dayCode(date);
  return today >= code(SEASON_START) || today <= code(SEASON_END);
}

// ---------- What is remembered ----------

// the same prefix as the other keys of the app, see store.js
const KEY = `gitar-school-winter${IS_BETA ? '-beta' : ''}`;

/** A season is named after the year of its December. */
const seasonOf = (date) => (date.getMonth() + 1 >= SEASON_START[0] ? date.getFullYear() : date.getFullYear() - 1);

function load() {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) || 'null');
    // a new season starts with fresh snow and the lights on
    if (data && data.season === seasonOf(new Date())) return data;
  } catch {
    /* unreadable: start afresh */
  }
  return { season: seasonOf(new Date()) };
}

const saved = load();

function remember(patch) {
  Object.assign(saved, patch);
  try {
    localStorage.setItem(KEY, JSON.stringify(saved));
  } catch {
    /* private mode: the choice lasts until the page is closed */
  }
}

// ---------- Lights ----------

/**
 * `node` wears its lights mode as data-lights, which the styles turn into the
 * twinkle, the running lights or darkness. Returns the function a tap calls
 * to move on to the next mode; the mode is remembered under `name`.
 */
function lights(node, name) {
  const apply = (mode) => {
    node.dataset.lights = mode;
  };
  apply(MODES.includes(saved[name]) ? saved[name] : MODES[0]);
  return () => {
    const next = MODES[(MODES.indexOf(node.dataset.lights) + 1) % MODES.length];
    apply(next);
    remember({ [name]: next });
  };
}

/** One bulb's variables: its colour, its place in the row and its own twinkle phase. */
const bulbStyle = (i, stride) => `--bulb:${BULBS[i % BULBS.length]};--i:${i};--delay:${(-((i * stride) % 3.6)).toFixed(1)}s`;

/** A string of lights across the top bar; a tap switches them. */
function garland() {
  const string = el('button', {
    class: 'garland',
    type: 'button',
    'aria-label': 'Гирлянда: переключить огоньки',
  });
  string.addEventListener('click', lights(string, 'garland'));

  function hang() {
    const count = Math.max(8, Math.round(window.innerWidth / BULB_STEP));
    string.replaceChildren(...Array.from({ length: count }, (_, i) => el('i', { style: bulbStyle(i, 1.3) })));
  }
  hang();
  window.addEventListener('resize', hang);
  return string;
}

// ---------- The tree ----------

/** A five-pointed star around (cx, cy). */
function starPath(cx, cy, outer, inner) {
  const points = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? inner : outer;
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    points.push(`${(cx + r * Math.cos(angle)).toFixed(1)} ${(cy + r * Math.sin(angle)).toFixed(1)}`);
  }
  return `M${points.join(' L')} Z`;
}

// where the bulbs hang on the tree's strings, in its 60×84 drawing
const TREE_BULBS = [
  [25, 30.3], [35, 30.3],
  [20.4, 47.2], [30, 48.5], [39.6, 47.2],
  [14.6, 65], [24.7, 66.8], [35.3, 66.8], [45.4, 65],
];

/** A little tree with a string of lights wound round it. */
function tree() {
  const picture = svgEl('svg', { viewBox: '0 0 60 84', class: 'tree__svg' },
    svgEl('rect', { x: 26, y: 71, width: 8, height: 12, rx: 2, class: 'tree__trunk' }),
    // three tiers, the lowest first so the upper ones lie over it
    svgEl('path', { d: 'M30 38 L56 72 L4 72 Z', class: 'tree__tier' }),
    svgEl('path', { d: 'M30 24 L50 54 L10 54 Z', class: 'tree__tier' }),
    svgEl('path', { d: 'M30 12 L44 34 L16 34 Z', class: 'tree__tier' }),
    // snow on the branches
    svgEl('path', { d: 'M7 71 Q30 67 53 71', class: 'tree__snow' }),
    svgEl('path', { d: 'M13 53 Q30 49.5 47 53', class: 'tree__snow' }),
    svgEl('path', { d: 'M19 33 Q30 30 41 33', class: 'tree__snow' }),
    // the string the bulbs hang on
    svgEl('path', { d: 'M8 63 Q30 71 52 63', class: 'tree__string' }),
    svgEl('path', { d: 'M14 45 Q30 52 46 45', class: 'tree__string' }),
    svgEl('path', { d: 'M20 28 Q30 34 40 28', class: 'tree__string' }),
    svgEl('path', { d: starPath(30, 7, 6, 2.5), class: 'tree__star' }),
    TREE_BULBS.map(([x, y], i) => svgEl('g', { class: 'tree__bulb', transform: `translate(${x} ${y})`, style: bulbStyle(i, 1.7) },
      svgEl('circle', { r: 5, class: 'tree__halo' }),
      svgEl('circle', { r: 2.4, class: 'tree__dot' }))),
  );
  return el('span', { class: 'tree', 'aria-hidden': 'true' }, picture);
}

/**
 * Puts the tree beside the guitar on the home card. The card is a link to
 * the workshop, so a tap on the tree is caught there and switches the
 * lights instead.
 */
export function withTree(card) {
  if (!isSeason()) return card;
  const node = tree();
  const next = lights(node, 'tree');
  card.classList.add('guitar-card--winter');
  card.querySelector('.guitar-card__stage').append(node);
  card.addEventListener('click', (event) => {
    if (!event.target.closest('.tree')) return;
    event.preventDefault();
    next();
  });
  return card;
}

// ---------- Snow ----------

/** Snow over the whole screen and the drifts it settles into at the bottom. */
function snowfall() {
  const flakes = Array.from({ length: FLAKES }, () => el('i', {
    style: [
      `left:${(Math.random() * 100).toFixed(1)}%`,
      `--size:${(4 + Math.random() * 5).toFixed(1)}px`,
      `--fall:${(10 + Math.random() * 8).toFixed(1)}s`,
      `--sway:${(3 + Math.random() * 3).toFixed(1)}s`,
      // negative delays: the sky is already full when the screen opens
      `--delay:${(-Math.random() * 18).toFixed(1)}s`,
      `--glow:${(0.45 + Math.random() * 0.45).toFixed(2)}`,
    ].join(';'),
  }));
  const sky = el('div', { class: 'snow', 'aria-hidden': 'true' }, flakes);
  const ground = el('div', { class: 'drifts', 'aria-hidden': 'true' },
    DRIFTS.map(([x, w, h]) => el('i', { style: `--x:${x}%;--w:${w}%;--h:${h}` })));

  let depth = Math.min(SNOW_MAX, Math.max(SNOW_MIN, Number(saved.snow) || SNOW_MIN));
  let landed = 0;
  const settle = () => ground.style.setProperty('--depth', `${depth.toFixed(2)}px`);
  settle();

  // every flake that reaches the ground makes the drifts a little deeper
  sky.addEventListener('animationiteration', (event) => {
    if (event.animationName !== 'snow-fall' || depth >= SNOW_MAX) return;
    depth = Math.min(SNOW_MAX, depth + SNOW_PER_FLAKE);
    settle();
    if (++landed % 20 === 0) remember({ snow: depth });
  });

  return [sky, ground];
}

// ---------- Putting it all up ----------

/** Puts the decorations up — once, and only in season. */
export function mountWinter() {
  if (!isSeason()) return;
  document.body.append(...snowfall());
  document.querySelector('.topbar').append(garland());
}

/** The router tells whether a menu is on the screen: that is where the decorations show. */
export function showWinter(onMenu) {
  document.body.classList.toggle('is-winter', onMenu);
}

/** The banner under the hello on the home screen; nothing outside the season. */
export function winterGreeting() {
  if (!isSeason()) return null;
  const today = dayCode(new Date());
  const wish = today >= code(CHRISTMAS) || today <= code(SEASON_END) ? 'С Рождеством!' : 'Скоро Рождество!';
  return el('div', { class: 'banner' },
    el('div', { class: 'banner__cloth' },
      el('div', { class: 'banner__wish' }, wish),
      el('div', { class: 'banner__line' }, 'Пусть каждая нотка греет, как огонёк на ёлке')));
}
