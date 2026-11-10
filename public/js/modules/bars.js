// "Bar and bar line" section, after the cards from school: music is split
// into bars, bar lines show where one ends and the next begins, and a double
// line ends the piece. Closes with the card's puzzle "how many bars are here?",
// whose answer opens on a tap.

import { el, clear } from '../core/ui.js';
import { renderRhythm, playRhythm, stopRhythm } from '../core/rhythm.js';
import { loadPiano } from '../core/piano.js';

const ACCENT = '#00897B';

const SIX_BARS = Array.from({ length: 6 }, () => ['q', 'q']);
const TWO_BARS = [['q', 'q'], ['q', 'q']];

/** A staff on paper that plays on tap; wide ones scroll sideways on a phone. */
function playable(picture, { scroll = false } = {}) {
  return el('button', {
    class: `rhythm-paper ${scroll ? 'rhythm-paper--scroll' : ''}`.trim(),
    type: 'button',
    onclick: () => playRhythm(picture),
  }, picture);
}

/** The card's puzzle: two bars, the question, and the answer behind a button. */
function puzzle() {
  const box = el('div', { class: 'puzzle' });

  function render(open) {
    clear(box);
    box.append(
      playable(renderRhythm(TWO_BARS, { numbers: open, label: 'Два такта по две четвертные' })),
      el('div', { class: 'puzzle__question' }, 'Сколько здесь тактов?'),
      open
        ? el('div', { class: 'puzzle__answer' }, 'Ответ: два. Такты — это «комнатки» между тактовыми чертами.')
        : el('div', { class: 'row row--center' },
          el('button', { class: 'btn btn--primary', type: 'button', onclick: () => render(true) }, '👀 Показать ответ')),
    );
  }

  render(false);
  return box;
}

export default {
  id: 'bars',
  title: 'Такт и тактовая черта',
  subtitle: 'На какие части делится музыка',
  emoji: '📏',
  accent: ACCENT,
  group: 'rhythm',
  kind: 'learn',

  mount(root) {
    // start downloading the piano now, so the first tap isn't silent
    loadPiano();

    root.append(el('div', { class: 'screen rhythm-learn', style: `--accent:${ACCENT}` },
      el('p', { class: 'lead' },
        'Музыка делится на небольшие части. Каждая такая часть называется такт.'),

      el('h3', { class: 'block-title' }, 'Что такое такт'),
      playable(renderRhythm(SIX_BARS, { numbers: true, label: 'Шесть тактов по две четвертные' }), { scroll: true }),
      el('p', { class: 'caption' },
        'Здесь шесть тактов, в каждом по две нотки. Нажми на ноты, чтобы послушать: '
        + 'первая нотка каждого такта звучит чуть громче.'),

      el('h3', { class: 'block-title' }, 'Что разделяет такты'),
      el('div', { class: 'rhythm-paper' },
        renderRhythm([4, 3, 3, 3], { marked: true, label: 'Нотный стан, разделённый тактовыми чертами' })),
      el('div', { class: 'fact' },
        el('div', { class: 'fact__title' }, 'Тактовая черта'),
        el('div', { class: 'fact__text' },
          'Эта вертикальная линия показывает, где заканчивается один такт и начинается следующий.')),
      el('p', { class: 'caption' },
        'В самом конце музыки ставят двойную черту: тонкую и толстую. Она значит: музыка закончилась.'),

      el('h3', { class: 'block-title' }, 'Посмотри внимательно'),
      puzzle(),

      el('div', { class: 'memo' },
        el('div', { class: 'memo__title' }, 'Запомни!'),
        el('div', { class: 'memo__phrase' }, 'Такт — часть музыки, тактовая черта разделяет такты'),
        el('ul', { class: 'memo__list' },
          el('li', null, 'Первый такт начинается сразу после ключа'),
          el('li', null, 'Каждый следующий — после тактовой черты'),
          el('li', null, 'Двойная черта в конце не начинает новый такт: она закрывает последний'),
          el('li', null, 'Чтобы сосчитать такты, считай «комнатки» между чертами, а не сами черты'),
        )),
    ));

    return stopRhythm;
  },
};
