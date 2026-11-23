// "Bar lines": after a music-school worksheet, "help your friend split the
// rhythm into bars and clap them". A line of music has its time signature at
// the start but no bar lines; a dashed line stands in every gap between two
// notes. Tap the dashed line where a bar ends, and it turns into a bar line:
// every bar has as many beats as the top number says — two in 2/4, three in
// 3/4, four in 4/4. Once all the bar lines are in, the bars get their numbers
// and the line plays on the piano, the first beat of every bar louder, for the
// child to clap along; it can be played again before going on.
//
// A round is three lines in random order — 2/4 of five bars, 3/4 and 4/4 of
// four — so 4 + 3 + 3 = ten bar lines. Every gap between two notes is as wide
// as a gap between two bars (`even` in js/core/rhythm.js), so the spacing
// never shows where a bar ends. The "count under the notes" switch puts a dot
// under every beat, the beats a long note holds through greyed: the beats can
// be counted, but which of them starts a bar is up to the child. A long line
// keeps its notes big and scrolls sideways on a phone.
//
// Every bar line found is a star, but a wrong tap takes the star of the next
// one, as in "Pick the berries": the stars on display never go down, and only
// a round without a mistake gets them all.

import { el, clear, mount, shuffle } from '../core/ui.js';
import { renderRhythm, playRhythm, stopRhythm } from '../core/rhythm.js';
import { countToggle, showsCount } from '../core/controls.js';
import { praise, renderRoundResult } from '../core/quiz.js';
import { store } from '../core/store.js';
import { playFail } from '../core/audio.js';
import { loadPiano } from '../core/piano.js';
import { METER_BY_BEATS, randomBars } from '../data/rhythm.js';

const ID = 'barlines';
const GROUP = 'rhythm-play';
const ACCENT = '#3949AB';
// the lines of a round: as on the sheet, 2/4, 3/4 and 4/4
const LINES = [
  { meter: METER_BY_BEATS[2], bars: 5 },
  { meter: METER_BY_BEATS[3], bars: 4 },
  { meter: METER_BY_BEATS[4], bars: 4 },
];
// the notes are never drawn smaller than this many pixels per unit: a line
// that doesn't fit the screen at that size scrolls sideways
const MIN_SCALE = 0.8;

const linesWord = (count) => (count === 1 ? 'черта' : count < 5 ? 'черты' : 'черт');

export default {
  id: ID,
  title: 'Тактовые черты',
  subtitle: 'Подели ритм на такты и прохлопай',
  emoji: '📏',
  accent: ACCENT,
  group: GROUP,

  mount(root) {
    // start downloading the piano now, so the first line that is done isn't silent
    loadPiano();

    const screen = el('div', { class: 'screen barlines-game', style: `--accent:${ACCENT}` });
    root.append(screen);

    // { meter, bars, found } for every line of the round; `found` are the
    // bars that have their bar line after them
    let lines;
    // the line on display
    let current;
    let score;
    // stars that wrong taps have taken from the bar lines still to be found
    let owed;
    // nodes on display, so a tap changes them without redrawing the screen
    let view = {};

    const line = () => lines[current];
    const total = () => lines.reduce((sum, item) => sum + item.bars.length - 1, 0);
    const foundCount = () => lines.reduce((sum, item) => sum + item.found.size, 0);
    const isDone = (item) => item.found.size === item.bars.length - 1;

    function say(text, kind) {
      view.feedback.textContent = text || ' ';
      view.feedback.className = `feedback feedback--${kind}`;
    }

    function renderProgress() {
      const done = foundCount();
      return el('div', { class: 'progress' },
        el('div', { class: 'progress__dots' },
          Array.from({ length: total() }, (_, i) => el('span', { class: `dot ${i < done ? 'dot--done' : ''}` }))),
        el('div', { class: 'progress__score' }, `⭐ ${score}`),
      );
    }

    function updateProgress() {
      const progress = renderProgress();
      view.progress.replaceWith(progress);
      view.progress = progress;
    }

    /** The line as it is now: the bar lines found so far, or all of them with the bar numbers. */
    function drawLine() {
      const { meter, bars, found } = line();
      const done = isDone(line());
      const picture = renderRhythm(bars, {
        meter,
        even: true,
        gaps: !done,
        barlines: done ? true : [...found],
        numbers: done,
        pulse: showsCount(),
        label: `Ритм в размере ${meter.label}`,
      });
      const width = Number(picture.getAttribute('viewBox').split(' ')[2]);
      picture.style.minWidth = `${Math.round(width * MIN_SCALE)}px`;
      // the same paper keeps its place, so a line scrolled sideways stays where it was
      view.paper.replaceChildren(picture);
      view.picture = picture;
      requestAnimationFrame(() => {
        if (view.hint) view.hint.hidden = view.paper.scrollWidth <= view.paper.clientWidth + 2;
      });
      return picture;
    }

    function renderButtons() {
      const isLast = current === lines.length - 1;
      return el('div', { class: 'row row--center' },
        el('button', { class: 'btn', type: 'button', onclick: () => playRhythm(view.picture) }, '👏 Сыграть ещё'),
        el('button', { class: 'btn btn--primary', type: 'button', onclick: isLast ? finish : () => show(current + 1) },
          isLast ? 'Готово!' : 'Дальше →'));
    }

    function render() {
      clear(screen);
      const left = line().bars.length - 1 - line().found.size;
      view = {
        progress: renderProgress(),
        feedback: el('div', { class: 'feedback' }, ' '),
        paper: el('div', { class: 'rhythm-paper barline-paper', onclick: onTap }),
        hint: el('div', { class: 'barlines__hint', hidden: true }, 'Строчка длинная — листай её вбок ↔'),
        actions: el('div', { class: 'barlines__actions' }),
      };
      mount(screen,
        view.progress,
        countToggle(redraw),
        el('div', { class: 'barlines__task' }, 'Подели ритм на такты: нажми на пунктир там, где кончается такт.'),
        el('div', { class: 'barlines__case' },
          el('span', null, `Строчка ${current + 1} из ${lines.length}`),
          el('span', { class: 'barlines__left' }, isDone(line()) ? 'Все такты на месте!' : `Осталось ${left} ${linesWord(left)}`)),
        view.feedback,
        view.paper,
        view.hint,
        view.actions,
      );
      drawLine();
      if (isDone(line())) view.actions.append(renderButtons());
    }

    function updateLeft() {
      const node = screen.querySelector('.barlines__left');
      const left = line().bars.length - 1 - line().found.size;
      if (node) node.textContent = left ? `Осталось ${left} ${linesWord(left)}` : 'Все такты на месте!';
    }

    /** Redraws the line as it is — for the count switch. */
    function redraw() {
      stopRhythm();
      render();
    }

    /** A line of the round on display, from its beginning. */
    function show(index) {
      stopRhythm();
      current = index;
      render();
      window.scrollTo({ top: 0 });
    }

    /** A fresh round — "Ещё раз". */
    function restart() {
      stopRhythm();
      lines = shuffle(LINES).map(({ meter, bars }) => ({ meter, bars: randomBars(meter.beats, bars), found: new Set() }));
      score = 0;
      owed = 0;
      show(0);
    }

    function onTap(event) {
      const gap = event.target.closest ? event.target.closest('[data-at]') : null;
      if (!gap || isDone(line())) return;
      const at = Number(gap.dataset.at);
      const { meter, found } = line();
      if (at % meter.beats !== 0) {
        miss(gap);
        return;
      }
      const bar = at / meter.beats - 1;
      if (found.has(bar)) return;
      store.recordAnswer(meter.id, true);
      found.add(bar);
      if (owed) owed -= 1;
      else score += 1;
      updateProgress();
      updateLeft();
      const picture = drawLine();
      picture.querySelector(`[data-bar="${bar}"]`)?.classList.add('rhythm__bar--new');
      if (isDone(line())) complete();
      else say(praise(), 'good');
    }

    function miss(gap) {
      const { meter } = line();
      store.recordAnswer(meter.id, false);
      owed += 1;
      playFail();
      say(`Нет: в размере ${meter.label} в каждом такте ${meter.words} — ${meter.count.join(', ')}`, 'bad');
      gap.classList.remove('is-wrong');
      // restart the animation of a gap tapped wrong twice in a row
      gap.getBoundingClientRect();
      gap.classList.add('is-wrong');
    }

    /** All the bar lines of the line are in: the bars get their numbers and the line plays. */
    function complete() {
      drawLine();
      say(`${praise()} Теперь прохлопай ритм вместе с фортепиано`, 'good');
      view.actions.replaceChildren(renderButtons());
      playRhythm(view.picture);
    }

    function finish() {
      stopRhythm();
      clear(screen);
      screen.append(renderRoundResult({ id: ID, group: GROUP, score, total: total(), onRestart: restart }));
    }

    restart();
    return stopRhythm;
  },
};
