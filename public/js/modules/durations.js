// "Duration tree" section, after the card from school: a whole note splits
// into 2 halves, 4 quarters and 8 eighths. The levels are drawn to scale, so
// the notes of every level fill the same width, and each level plays on tap
// with the count running underneath.

import { el } from '../core/ui.js';
import { renderRhythm, noteGlyph, playRhythm, stopRhythm } from '../core/rhythm.js';
import { loadPiano } from '../core/piano.js';
import { DURATIONS, DURATION_BY_ID, TREE } from '../data/rhythm.js';

const ACCENT = '#7CB342';
// a quarter of rest between the levels when the whole tree plays
const LEVEL_GAP = 1;

/** One level of the tree: its name, the notes to scale, and what to notice. */
function treeLevel(level, index) {
  const duration = DURATION_BY_ID[level.duration];
  const bar = Array(level.count).fill(duration.token);
  const picture = renderRhythm([bar], {
    staff: false,
    cells: true,
    counts: true,
    beat: 40,
    startBeat: index * (4 + LEVEL_GAP),
    label: level.title,
  });

  return el('div', { class: 'tree__level' },
    index ? el('div', { class: 'tree__arrow', 'aria-hidden': 'true' }, '↓') : null,
    el('button', {
      class: 'tree__card',
      type: 'button',
      onclick: () => playRhythm(picture),
    },
      el('div', { class: 'tree__title' }, level.title),
      picture,
      el('div', { class: 'tree__note' }, level.note)));
}

/** A card per duration: how it looks and how long it lasts. */
function durationCard(duration) {
  const glyph = noteGlyph(duration.token, { cells: true, label: `${duration.ru} нота` });
  return el('button', {
    class: 'duration-card',
    type: 'button',
    onclick: () => playRhythm(glyph),
  },
    el('div', { class: 'duration-card__glyph' }, glyph),
    el('div', { class: 'duration-card__name' }, `${duration.ru} нота`),
    el('div', { class: 'duration-card__looks' }, duration.looks),
    el('div', { class: 'duration-card__lasts' }, duration.lasts));
}

export default {
  id: 'durations',
  title: 'Дерево длительностей',
  subtitle: 'Целая, половинная, четвертная, восьмая',
  emoji: '🌳',
  accent: ACCENT,
  group: 'rhythm',
  kind: 'learn',

  mount(root) {
    // start downloading the piano now, so the first tap isn't silent
    loadPiano();

    const tree = el('div', { class: 'tree' }, TREE.map(treeLevel));

    root.append(el('div', { class: 'screen rhythm-learn', style: `--accent:${ACCENT}` },
      el('p', { class: 'lead' },
        'Длительность — это сколько звучит нота. Все длительности связаны между собой. '
        + 'Посмотри, как они делятся: от долгой к короткой.'),

      el('h3', { class: 'block-title' }, 'Дерево длительностей'),
      tree,
      el('p', { class: 'caption' },
        'Нажми на любой этаж дерева — ноты зазвучат, а под ними побежит счёт. '
        + 'Полоска под нотой показывает, сколько она длится: '
        + 'одна целая звучит столько же, сколько две половинные, четыре четвертные или восемь восьмых.'),
      el('div', { class: 'row row--center' },
        el('button', {
          class: 'btn btn--primary',
          type: 'button',
          onclick: () => playRhythm(tree),
        }, '▶ Сыграть всё дерево')),

      el('h3', { class: 'block-title' }, 'Как выглядят длительности'),
      el('div', { class: 'duration-grid' }, DURATIONS.map(durationCard)),

      el('div', { class: 'memo' },
        el('div', { class: 'memo__title' }, 'Запомни!'),
        el('div', { class: 'memo__phrase' }, 'Чем ниже нота на дереве, тем она короче'),
        el('ul', { class: 'memo__list' },
          el('li', null, 'На каждом этаже длительности делятся пополам'),
          el('li', null, 'Целая = 2 половинные = 4 четвертные = 8 восьмых'),
          el('li', null, 'Белая нота длинная, чёрная — короче, а с флажком — ещё короче'),
          el('li', null, 'Попробуй сам: прохлопай ритм, начиная с целой ноты и деля её до восьмых'),
        )),
    ));

    return stopRhythm;
  },
};
