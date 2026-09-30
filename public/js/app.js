import { MODULES, GROUPS } from './modules/index.js';
import { store } from './core/store.js';
import { el, clear, noteStyle, mount, topicHref } from './core/ui.js';
import { NOTES } from './data/notes.js';
import { ITEMS, nextUnlock, isUnlocked } from './data/guitar.js';
import { ensureAudio, playFanfare } from './core/audio.js';
import { loadPiano, playPiano } from './core/piano.js';
import { renderGuitar } from './core/guitar.js';
import { mountPlayers } from './screens/players.js';
import workshop, { itemPreview, itemTitle } from './screens/workshop.js';
import { IS_BETA } from './core/env.js';

// a "БЕТА" badge, so the test copy is never mistaken for the real one
document.body.classList.toggle('is-beta', IS_BETA);

const appEl = document.getElementById('app');
const titleEl = document.getElementById('title');
const backBtn = document.getElementById('backBtn');
const starEl = document.getElementById('starCounter');
const playerBtn = document.getElementById('playerBtn');

// Screens that are reachable by address but are not menu sections.
const SCREENS = [workshop];

let cleanup = null;
// where the back arrow leads from the screen on display
let parentRoute = '';
// how far each menu screen was scrolled, so it comes back the way it was left
const scrollMemory = new Map();
let currentRoute = location.hash;

store.subscribe((state) => {
  const player = store.player;
  starEl.hidden = !player;
  playerBtn.hidden = !player;
  starEl.textContent = `⭐ ${state.stars || 0}`;
  if (player) {
    clear(playerBtn);
    mount(playerBtn,
      el('span', { class: 'topbar__avatar' }, player.avatar),
      el('span', { class: 'topbar__name' }, player.name));
  }
});

/** Topics with their sections; anything whose group is unknown goes last. */
function topics() {
  const list = GROUPS.map((group) => ({ ...group, items: [] }));
  for (const module of MODULES) {
    const id = module.group || 'other';
    let topic = list.find((item) => item.id === id);
    if (!topic) list.push((topic = { id, title: 'Разное', subtitle: 'Новая тема', emoji: '🎵', items: [] }));
    topic.items.push(module);
  }
  return list.filter((topic) => topic.items.length);
}

// ---------- What's new ----------

/**
 * Sections the player has already come across in a topic menu. A topic with
 * any section missing here gets "Новое!" on its tile, and so does that
 * section's card once inside — this is how a section added to an existing
 * topic gets noticed.
 */
function seenSections() {
  const { settings, stars } = store.state;
  if (settings.sectionsSeen) return settings.sectionsSeen;

  // Before sections were counted one by one, opening a topic marked the whole
  // topic seen; its sections count as seen. A player from before the topics
  // existed has in fact seen everything.
  const { topicsSeen } = settings;
  const wasSeen = (module) => (topicsSeen ? Boolean(topicsSeen[module.group]) : stars > 0);
  const seen = Object.fromEntries(MODULES.filter(wasSeen).map((module) => [module.id, true]));
  store.setSetting('sectionsSeen', seen);
  return seen;
}

// a brand new player has seen nothing yet — there the badge would be on everything
const showsNew = () => store.state.stars > 0;

// ---------- Home screen ----------

/** The rainbow of notes, each one playable: a reminder that is also a toy. */
function renderRainbowStrip() {
  return el('div', { class: 'rainbow-strip' },
    NOTES.map((note) => el('button', {
      class: 'rainbow-strip__item',
      type: 'button',
      style: noteStyle(note),
      'aria-label': `Послушать ноту ${note.ru}`,
      onclick: () => playPiano(note.freq),
    }, note.ru)));
}

/** "My guitar" card on the home screen: the guitar and how far the next unlock is. */
function renderGuitarCard() {
  const { guitar, stars, workshopSeen } = store.state;
  const next = nextUnlock(stars);
  const hasNew = ITEMS.some((item) => item.need > workshopSeen && isUnlocked(item, stars));

  let progress;
  if (next) {
    const prev = Math.max(0, ...ITEMS.filter((item) => item.need <= stars).map((item) => item.need));
    const share = Math.round(((stars - prev) / (next.need - prev)) * 100);
    progress = el('div', { class: 'guitar-card__next' },
      el('div', { class: 'guitar-card__next-row' },
        el('div', { class: 'guitar-card__next-icon' }, itemPreview(next, guitar)),
        el('div', null,
          el('div', { class: 'guitar-card__next-text' }, `Ещё ${next.need - stars} ⭐ — и откроется`),
          el('div', { class: 'guitar-card__next-name' }, itemTitle(next)))),
      el('div', { class: 'bar' }, el('div', { class: 'bar__fill', style: `width:${share}%` })));
  } else {
    progress = el('div', { class: 'guitar-card__next-text' }, 'Открыто всё! Ты — рок-звезда 🤘');
  }

  return el('a', { class: 'guitar-card', href: '#guitar' },
    el('div', { class: 'guitar-card__stage' }, renderGuitar(guitar, { label: 'Моя гитара' })),
    el('div', { class: 'guitar-card__body' },
      el('div', { class: 'guitar-card__title' },
        'Моя гитара',
        hasNew ? el('span', { class: 'badge' }, 'Новое!') : null),
      progress,
      el('div', { class: 'guitar-card__cta' }, 'Украсить гитару →')));
}

const isPlayed = (module) => {
  const best = store.moduleBest(module.id);
  return Boolean(best && best.rounds);
};

/** One dot per game of a topic: filled once played, ringed for a perfect round. */
function renderTopicDots(games) {
  const played = games.filter(isPlayed).length;
  return el('div', {
    class: 'topic-card__dots',
    'aria-label': `Сыграно ${played} из ${games.length}`,
    title: `Сыграно ${played} из ${games.length}`,
  }, games.map((module) => {
    const best = store.moduleBest(module.id);
    const done = isPlayed(module);
    const perfect = done && best.total && best.best >= best.total;
    return el('span', { class: `dot ${done ? 'dot--done' : ''} ${perfect ? 'dot--perfect' : ''}` });
  }));
}

/** A topic tile: emoji, name and how the games inside are going. */
function renderTopicCard(topic, seen) {
  const games = topic.items.filter((module) => module.kind !== 'learn');
  const isNew = showsNew() && topic.items.some((module) => !seen[module.id]);

  return el('a', {
    class: 'topic-card',
    href: topicHref(topic.id),
    style: `--accent:${topic.accent || '#7E57C2'}`,
  },
    el('div', { class: 'topic-card__emoji' }, topic.emoji),
    el('div', { class: 'topic-card__title' },
      topic.title,
      isNew ? el('span', { class: 'badge' }, 'Новое!') : null),
    el('div', { class: 'topic-card__sub' }, topic.subtitle),
    games.length ? renderTopicDots(games) : el('div', { class: 'tag' }, 'Подсказка'),
  );
}

function renderHome() {
  titleEl.textContent = 'Гитарная школа';
  backBtn.hidden = true;
  // the rainbow strip sounds on the very first tap
  loadPiano();

  const seen = seenSections();
  mount(appEl,
    el('p', { class: 'hello' }, `Привет, ${store.player.name}! Выбери, чем сегодня займёмся 🎸`),
    renderGuitarCard(),
    renderRainbowStrip(),
    el('div', { class: 'topics' }, topics().map((topic) => renderTopicCard(topic, seen))),
  );
}

// ---------- One topic ----------

/** How a section has gone: stars for a game, a tag for a reference one. */
function renderResult(module) {
  if (module.kind === 'learn') return el('div', { class: 'tag' }, 'Учим');
  const best = store.moduleBest(module.id);
  if (!best || !best.rounds) return el('div', { class: 'tag' }, 'Ещё не играли');

  // one star for playing, two for a good round, three for a perfect one —
  // the same thresholds the result screen praises with
  const total = best.total || 0;
  const count = total && best.best >= total ? 3 : total && best.best >= total * 0.7 ? 2 : 1;
  const label = total ? `Лучший результат: ${best.best} из ${total}` : `Лучший результат: ${best.best}`;

  return el('div', { class: 'stars', 'aria-label': label, title: label },
    [1, 2, 3].map((i) => el('span', { class: `stars__one ${i <= count ? '' : 'stars__one--off'}` }, '⭐')));
}

function renderMenuCard(module, isNew) {
  return el('a', {
    class: 'menu-card',
    href: `#${module.id}`,
    style: `--accent:${module.accent}`,
  },
    el('div', { class: 'menu-card__emoji' }, module.emoji),
    el('div', { class: 'menu-card__text' },
      el('div', { class: 'menu-card__title' },
        module.title,
        isNew ? el('span', { class: 'badge' }, 'Новое!') : null),
      el('div', { class: 'menu-card__sub' }, module.subtitle),
      renderResult(module)),
  );
}

function renderTopic(topic) {
  titleEl.textContent = topic.title;
  backBtn.hidden = false;
  parentRoute = '';

  // the badges stay on the cards for this visit and are gone the next time
  const seen = seenSections();
  const isNew = (module) => showsNew() && !seen[module.id];
  if (topic.items.some((module) => !seen[module.id])) {
    store.setSetting('sectionsSeen', { ...seen, ...Object.fromEntries(topic.items.map((module) => [module.id, true])) });
  }

  mount(appEl,
    el('p', { class: 'lead' }, topic.subtitle),
    el('div', { class: 'menu' }, topic.items.map((module) => renderMenuCard(module, isNew(module)))),
  );
}

// ---------- Routing ----------

function renderPlayers() {
  titleEl.textContent = 'Гитарная школа';
  backBtn.hidden = true;
  mountPlayers(appEl, { onPick: goHome });
}

function renderSection(screen) {
  titleEl.textContent = screen.title;
  backBtn.hidden = false;
  parentRoute = screen.group ? `t/${screen.group}` : '';
  cleanup = screen.mount(appEl) || null;
}

/** Draws whatever the address points at; returns the route it settled on. */
function render() {
  if (!store.player) {
    renderPlayers();
    return '#players';
  }

  const hash = location.hash.replace(/^#/, '');
  if (hash.startsWith('t/')) {
    const topic = topics().find((item) => item.id === hash.slice(2));
    if (topic) {
      renderTopic(topic);
      return topicHref(topic.id);
    }
  } else {
    const screen = MODULES.find((m) => m.id === hash) || SCREENS.find((s) => s.id === hash);
    if (screen) {
      renderSection(screen);
      return `#${screen.id}`;
    }
  }

  renderHome();
  return '#';
}

const isMenuRoute = (route) => route === '#' || route.startsWith('#t/');

function navigate() {
  if (cleanup) {
    cleanup();
    cleanup = null;
  }
  scrollMemory.set(currentRoute, window.scrollY);
  clear(appEl);
  parentRoute = '';

  currentRoute = render();
  // a menu comes back where the child left it; a section always starts at the top
  window.scrollTo(0, isMenuRoute(currentRoute) ? scrollMemory.get(currentRoute) || 0 : 0);
}

function goHome() {
  if (location.hash) location.hash = '';
  else navigate();
}

// ---------- Celebrating unlocks ----------

function showUnlock(items) {
  const { guitar } = store.state;

  function close() {
    overlay.remove();
    document.removeEventListener('keydown', onKey);
  }
  function onKey(event) {
    if (event.key === 'Escape') close();
  }

  const overlay = el('div', {
    class: 'overlay',
    onclick: (event) => {
      if (event.target === overlay) close();
    },
  },
    el('div', { class: 'unlock', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Открылось новое для гитары' },
      el('div', { class: 'unlock__emoji' }, '🎁'),
      el('div', { class: 'unlock__title' }, 'Открылось новое для гитары!'),
      el('div', { class: 'unlock__items' },
        items.map((item) => el('div', { class: 'unlock__item' },
          el('div', { class: 'unlock__preview' }, itemPreview(item, guitar)),
          el('div', { class: 'unlock__name' }, itemTitle(item))))),
      el('div', { class: 'row row--center' },
        el('button', {
          class: 'btn btn--primary',
          type: 'button',
          onclick: () => {
            close();
            location.hash = 'guitar';
          },
        }, 'Украсить гитару'),
        el('button', { class: 'btn', type: 'button', onclick: close }, 'Потом'))));

  document.addEventListener('keydown', onKey);
  document.body.append(overlay);
  playFanfare();
}

// let the round result and its sound play first, then celebrate
store.onUnlock((items) => setTimeout(() => showUnlock(items), 1100));

// ---------- Start ----------

backBtn.addEventListener('click', () => {
  location.hash = parentRoute;
});

playerBtn.addEventListener('click', () => {
  store.signOut();
  goHome();
});

window.addEventListener('hashchange', navigate);

// Browsers only allow sound after the first touch of the screen.
document.addEventListener('pointerdown', () => ensureAudio(), { once: true });

navigate();

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => { /* not critical */ });
}
