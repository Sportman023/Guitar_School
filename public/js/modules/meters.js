// "Time signature" section, after the cards from school: 2/4, 3/4 and 4/4,
// the beats of each with the clap "ТА та та" — the strong first beat louder —
// and "Весёлая прогулка" in 3/4, the card's example of a piece with a time
// signature.

import { el } from '../core/ui.js';
import { renderRhythm, playRhythm, stopRhythm } from '../core/rhythm.js';
import { loadPiano } from '../core/piano.js';
import { METERS, WALK } from '../data/rhythm.js';

const ACCENT = '#8E24AA';
// bars of quarters on every card: two, so the strong beat is heard coming back
const CARD_BARS = 2;
// every line of the piece is this wide, so the three lines line up
const WALK_WIDTH = 260;
// the three cards are as wide as two bars of 4/4, so all notes are one size
const CARD_WIDTH = 310;

/**
 * The claps of one bar, "ТА та та". A clap lights up on its beat in every
 * bar, so it keeps time with the notes above it.
 */
function claps(meter) {
  return el('div', { class: 'claps' },
    meter.count.map((_, b) => el('div', {
      class: `clap ${b === 0 ? 'clap--strong' : ''}`.trim(),
      'data-lit': Array.from({ length: CARD_BARS }, (__, bar) => `${bar * meter.beats + b},1`).join(';'),
    },
      el('span', { class: 'clap__hands', 'aria-hidden': 'true' }, '👏'),
      el('span', { class: 'clap__word' }, b === 0 ? 'ТА' : 'та'))));
}

function meterCard(meter) {
  const bars = Array.from({ length: CARD_BARS }, () => Array(meter.beats).fill('q'));
  const card = el('div', { class: 'meter-card' },
    el('div', { class: 'meter-card__title' }, `Размер ${meter.label}`),
    el('div', { class: 'rhythm-paper' },
      renderRhythm(bars, { meter, counts: true, fit: CARD_WIDTH, label: `Два такта в размере ${meter.label}` })),
    claps(meter),
    el('div', { class: 'meter-card__text' },
      `В каждом такте ${meter.words} — `, el('b', null, `${meter.count.join(', ')}.`)));
  card.append(el('div', { class: 'row row--center' },
    el('button', {
      class: 'btn btn--primary',
      type: 'button',
      onclick: () => playRhythm(card),
    }, '▶ Послушать и похлопать')));
  return card;
}

/** "Весёлая прогулка": three lines of the book, the time signature on the first only. */
function walk() {
  const piece = el('div', { class: 'walk' },
    el('div', { class: 'walk__title' }, 'Весёлая прогулка'),
    WALK.map((line, i) => renderRhythm(line, {
      meter: METERS[1],
      meterMark: i === 0 ? 'show' : 'none',
      final: i === WALK.length - 1,
      fit: WALK_WIDTH,
      startBeat: i * 6,
      label: `Весёлая прогулка, строчка ${i + 1}`,
    })));
  return el('div', null,
    piece,
    el('div', { class: 'row row--center' },
      el('button', { class: 'btn btn--primary', type: 'button', onclick: () => playRhythm(piece) },
        '▶ Сыграть прогулку')));
}

export default {
  id: 'meters',
  title: 'Размер 2/4, 3/4, 4/4',
  subtitle: 'Сколько долей в каждом такте',
  emoji: '🔢',
  accent: ACCENT,
  group: 'rhythm',
  kind: 'learn',

  mount(root) {
    // start downloading the piano now, so the first tap isn't silent
    loadPiano();

    root.append(el('div', { class: 'screen rhythm-learn', style: `--accent:${ACCENT}` },
      el('p', { class: 'lead' },
        'Размер пишут в начале музыки, сразу после скрипичного ключа: две цифры одна над другой. '
        + 'Верхняя цифра говорит, сколько долей в каждом такте. Нижняя четвёрка — что доля равна четвертной ноте.'),

      el('div', { class: 'fact' },
        el('div', { class: 'fact__title' }, 'Сильная доля'),
        el('div', { class: 'fact__text' },
          'Первая доля каждого такта — сильная: на неё хлопаем громче, ТА. Остальные доли слабые — та.')),

      METERS.map((meter) => [
        el('h3', { class: 'block-title' }, `Размер ${meter.label}`),
        meterCard(meter),
      ]),

      el('h3', { class: 'block-title' }, 'Где встречается размер?'),
      el('p', { class: 'caption caption--top' },
        'Размер есть почти в каждой музыкальной пьесе. Он помогает музыкантам играть вместе. '
        + 'Размер пишут один раз — в самом начале, на первой строчке.'),
      walk(),
      el('p', { class: 'caption' },
        'Нажми ▶ и считай вслух: раз-два-три, раз-два-три. Две восьмые, соединённые чертой, '
        + 'занимают одну долю — считаем «раз-и».'),

      el('div', { class: 'memo' },
        el('div', { class: 'memo__title' }, 'Запомним!'),
        el('div', { class: 'memo__phrase' }, 'Такт и размер помогают музыкантам играть слаженно!'),
        el('ul', { class: 'memo__list' },
          el('li', null, 'Такт — часть музыки'),
          el('li', null, 'Тактовая черта разделяет такты'),
          METERS.map((meter) => el('li', null, `${meter.label} — ${meter.words}: ${meter.count.join(', ')}`)),
          el('li', null, 'Первая доля такта — сильная: ТА, остальные слабые: та'),
        )),
    ));

    return stopRhythm;
  },
};
