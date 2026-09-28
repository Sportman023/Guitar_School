// Guitar workshop: the player decorates their guitar with what their stars
// have unlocked. Locked items stay visible with their price in stars, so there
// is always something to look forward to.

import { el, svgEl, clear, mount } from '../core/ui.js';
import { store } from '../core/store.js';
import { renderGuitar, renderSticker, renderSwatch } from '../core/guitar.js';
import { playTune, stopGuitar } from '../core/strings.js';
import { KINDS, ITEMS, MAX_STICKERS, itemsOfKind, isUnlocked } from '../data/guitar.js';
import { soundOf } from '../data/tunes.js';

const EFFECT_ICONS = { none: '🚫', sparkles: '✨', glow: '🌟', fire: '🔥' };

/** Small picture of an item for buttons: a guitar shape, a paint, a sticker or an effect. */
export function itemPreview(item, guitar) {
  switch (item.kind) {
    case 'shape':
      return renderGuitar({ ...guitar, shape: item.id, stickers: [], effect: 'none' }, { extraClass: 'guitar--mini' });
    case 'color':
      return renderSwatch(item.id);
    case 'sticker':
      return renderSticker(item.id);
    default:
      return el('span', { class: 'part__emoji' }, EFFECT_ICONS[item.id] || '✨');
  }
}

/** Item title with its kind, e.g. a sticker called "Flower". */
export function itemTitle(item) {
  const label = KINDS.find((kind) => kind.id === item.kind).label;
  return `${label[0].toUpperCase()}${label.slice(1)} «${item.name}»`;
}

/** A tuner dial: a scale with a green middle and a needle, as on the tuner screen. */
function tunerIcon() {
  return svgEl('svg', { class: 'workshop__tool-icon', viewBox: '1 5.5 22 13.5', 'aria-hidden': 'true' },
    svgEl('path', { d: 'M3 17 A9 9 0 0 1 21 17', fill: 'none', stroke: '#FFB74D', 'stroke-width': 2.5, 'stroke-linecap': 'round' }),
    svgEl('path', { d: 'M9.7 8.3 A9 9 0 0 1 14.3 8.3', fill: 'none', stroke: '#69F0AE', 'stroke-width': 2.5 }),
    svgEl('line', { x1: 12, y1: 17, x2: 14.2, y2: 9.5, stroke: '#fff', 'stroke-width': 2, 'stroke-linecap': 'round' }),
    svgEl('circle', { cx: 12, cy: 17, r: 2, fill: '#fff' }));
}

const isNew = (item, state) => item.need > state.workshopSeen && isUnlocked(item, state.stars);

export default {
  id: 'guitar',
  title: 'Моя гитара',

  mount(root) {
    const screen = el('div', { class: 'screen workshop' });
    root.append(screen);

    // open the first tab that has something new, otherwise the first one
    let tab = (KINDS.find((kind) => itemsOfKind(kind.id).some((item) => isNew(item, store.state))) || KINDS[0]).id;
    let hint = '';
    let playing = null; // id of the tune that is playing now

    const stage = el('div', { class: 'workshop__stage' });
    const tabs = el('div', { class: 'workshop__tabs', role: 'tablist' });
    const hintEl = el('p', { class: 'workshop__hint' });
    const grid = el('div', { class: 'workshop__grid' });

    // every body shape has its own voice and its own three tunes
    function renderStage() {
      const { guitar, stars } = store.state;
      const open = ITEMS.filter((item) => isUnlocked(item, stars)).length;
      const sound = soundOf(guitar.shape);
      clear(stage);
      mount(stage,
        el('div', { class: 'workshop__guitar' }, renderGuitar(guitar, { label: 'Моя гитара' })),
        el('div', { class: 'workshop__stats' }, `⭐ ${stars} · открыто ${open} из ${ITEMS.length}`),
        el('div', { class: 'workshop__tunes' }, sound.tunes.map((tune) => el('button', {
          class: `tune ${tune.id === playing ? 'tune--on' : ''}`,
          type: 'button',
          'aria-pressed': String(tune.id === playing),
          onclick: () => toggleTune(tune),
        }, el('span', null, tune.id === playing ? '⏹' : tune.emoji), el('span', null, tune.name)))),
      );
    }

    function toggleTune(tune) {
      if (playing === tune.id) {
        stopGuitar();
        playing = null;
      } else {
        playing = tune.id;
        playTune(tune, soundOf(store.state.guitar.shape).timbre, () => {
          playing = null;
          renderStage();
        });
      }
      renderStage();
    }

    function renderTabs() {
      clear(tabs);
      mount(tabs, KINDS.map((kind) => el('button', {
        class: `workshop__tab ${kind.id === tab ? 'workshop__tab--on' : ''}`,
        type: 'button',
        role: 'tab',
        'aria-selected': String(kind.id === tab),
        onclick: () => {
          tab = kind.id;
          hint = '';
          renderAll();
        },
      },
        el('span', null, kind.emoji),
        el('span', null, kind.title),
        itemsOfKind(kind.id).some((item) => isNew(item, store.state)) ? el('span', { class: 'workshop__dot' }) : null,
      )),
      // not a kind of decoration but a tool, so it looks different and opens its own screen
      el('a', { class: 'workshop__tab workshop__tab--tool', href: '#tuner' },
        el('span', null, tunerIcon()),
        el('span', null, 'Настроить гитару')));
    }

    function renderGrid() {
      const state = store.state;
      const { guitar, stars } = state;
      clear(grid);

      hintEl.textContent = hint || (tab === 'sticker' ? `Можно наклеить до ${MAX_STICKERS} наклеек сразу` : ' ');

      mount(grid, itemsOfKind(tab).map((item) => {
        const unlocked = isUnlocked(item, stars);
        const selected = item.kind === 'sticker' ? guitar.stickers.includes(item.id) : guitar[item.kind] === item.id;
        return el('button', {
          class: [
            'part',
            unlocked ? '' : 'part--locked',
            selected ? 'part--on' : '',
            isNew(item, state) ? 'part--new' : '',
          ].join(' ').trim(),
          type: 'button',
          'aria-pressed': String(selected),
          onclick: (event) => choose(item, event.currentTarget),
        },
          el('div', { class: 'part__preview' }, itemPreview(item, guitar)),
          el('div', { class: 'part__name' }, item.name),
          unlocked ? null : el('div', { class: 'part__lock' }, `🔒 ${item.need} ⭐`),
        );
      }));
    }

    function renderAll() {
      renderStage();
      renderTabs();
      renderGrid();
    }

    function choose(item, button) {
      const { guitar, stars } = store.state;

      if (!isUnlocked(item, stars)) {
        hint = `Ещё ${item.need - stars} ⭐ — и «${item.name}» откроется!`;
        hintEl.textContent = hint;
        button.classList.remove('part--shake');
        void button.offsetWidth; // restart the animation
        button.classList.add('part--shake');
        return;
      }

      hint = '';
      if (item.kind === 'sticker') {
        let stickers = guitar.stickers.includes(item.id)
          ? guitar.stickers.filter((id) => id !== item.id)
          : [...guitar.stickers, item.id];
        // too many: the oldest sticker makes room for the new one
        if (stickers.length > MAX_STICKERS) stickers = stickers.slice(-MAX_STICKERS);
        store.setGuitar({ stickers });
      } else {
        const reshaped = item.kind === 'shape' && guitar.shape !== item.id;
        store.setGuitar({ [item.kind]: item.id });
        // a new body says hello in its own voice
        if (reshaped) {
          const sound = soundOf(item.id);
          playing = null;
          playTune({ bpm: 60, voices: [sound.hello] }, sound.timbre);
        }
      }
      renderStage();
      renderGrid();
    }

    mount(screen,
      stage,
      el('div', { class: 'workshop__panel' }, tabs, hintEl, grid),
    );
    renderAll();

    // "new" badges stay for the whole visit and disappear next time
    return () => {
      stopGuitar();
      store.markWorkshopSeen();
    };
  },
};
