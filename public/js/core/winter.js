// Christmas decorations: snow behind the menus, a string of lights under the
// top bar and a greeting on the home screen. None of it reaches the lessons
// and games — there the screen stays as it always is, so nothing moves
// beside the task.
//
// The decorations put themselves up on SEASON_START and take themselves down
// after SEASON_END, so nothing has to be done in January. Everything lives in
// this file and the "Christmas" section at the end of styles.css, so it is
// easy to take out for good.

import { el } from './ui.js';

// [month, day], both days included; the season wraps around the new year
const SEASON_START = [11, 25];
const SEASON_END = [1, 14];
const CHRISTMAS = [12, 25];

const FLAKES = 18;
// soft bulb colours, in the order they hang on the wire
const BULBS = ['#ff8a80', '#ffd54f', '#aed581', '#82b1ff', '#f8bbd0'];
// px between bulbs: as many bulbs as fit the screen
const BULB_STEP = 44;

const code = ([month, day]) => month * 100 + day;
const dayCode = (date) => code([date.getMonth() + 1, date.getDate()]);

/** Whether the decorations are up on `date`. */
export function isSeason(date = new Date()) {
  const today = dayCode(date);
  return today >= code(SEASON_START) || today <= code(SEASON_END);
}

/** Snow over the whole screen: each flake its own size, speed, sway and start. */
function snow() {
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
  return el('div', { class: 'snow', 'aria-hidden': 'true' }, flakes);
}

/** A string of lights across the top bar; the bulbs twinkle out of step. */
function garland() {
  const wire = el('div', { class: 'garland', 'aria-hidden': 'true' });
  function hang() {
    const count = Math.max(8, Math.round(window.innerWidth / BULB_STEP));
    wire.replaceChildren(...Array.from({ length: count }, (_, i) => el('i', {
      style: `--bulb:${BULBS[i % BULBS.length]};--delay:${(-((i * 1.3) % 3.6)).toFixed(1)}s`,
    })));
  }
  hang();
  window.addEventListener('resize', hang);
  return wire;
}

/** Puts the decorations up — once, and only in season. */
export function mountWinter() {
  if (!isSeason()) return;
  document.body.append(snow());
  document.querySelector('.topbar').append(garland());
}

/** The router tells whether a menu is on the screen: that is where the decorations show. */
export function showWinter(onMenu) {
  document.body.classList.toggle('is-winter', onMenu);
}

/** The line under the hello on the home screen; nothing outside the season. */
export function winterGreeting() {
  if (!isSeason()) return null;
  const today = dayCode(new Date());
  const wish = today >= code(CHRISTMAS) || today <= code(SEASON_END) ? 'С Рождеством!' : 'Скоро Рождество!';
  return el('p', { class: 'winter-note' }, `${wish} 🎄 Пусть каждая нотка греет, как огонёк на ёлке ✨`);
}
