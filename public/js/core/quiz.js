// Generic quiz engine: ask a question about a note and offer several
// answers. What the question and the answers look like is up to each
// module (see js/modules/index.js). renderPrompt, renderOption and
// explainAnswer get the notes of the current round as a second argument.
//
// The quiz works the same with anything that has an `id` in place of notes,
// e.g. the fingers of js/data/fingers.js. Instead of option buttons, a module
// can give a picture to tap on (renderBoard): its tappable parts carry the id
// they stand for in data-answer, and get the same option--right and
// option--wrong classes as the buttons once the question is answered.

import { el, clear, shuffle, sample, delay, mount, topicHref } from './ui.js';
import { NOTES } from '../data/notes.js';
import { store } from './store.js';
import { playSuccess, playFail, playFanfare } from './audio.js';

const PRAISE = ['Молодец! 🎉', 'Точно! ✨', 'Верно! 👏', 'Здорово! 🌟', 'Супер! 🎸'];

/** A random word of praise for a right answer. */
export function praise() {
  return PRAISE[Math.floor(Math.random() * PRAISE.length)];
}

/**
 * The end of a round: keeps the score and the stars, plays a fanfare for a
 * perfect round, and returns the card with the score, "Ещё раз" and "В меню".
 */
export function renderRoundResult({ id, group, score, total, onRestart }) {
  const best = store.moduleBest(id);
  store.finishRound(id, { score, total });
  const isPerfect = score === total;
  if (isPerfect) playFanfare();
  else playSuccess();

  return el('div', { class: 'result' },
    el('div', { class: 'result__emoji' }, isPerfect ? '🏆' : score >= total * 0.7 ? '🌟' : '🎸'),
    el('div', { class: 'result__score' }, `${score} из ${total}`),
    el('div', { class: 'result__text' },
      isPerfect ? 'Идеально! Все ответы верные!'
        : score >= total * 0.7 ? 'Отличная работа!'
          : 'Хорошо, давай ещё разок!'),
    best && best.best > score ? el('div', { class: 'result__best' }, `Лучший результат: ${best.best}`) : null,
    el('div', { class: 'result__stars' }, '⭐'.repeat(Math.max(1, Math.round(score / 2)))),
    el('div', { class: 'row' },
      el('button', { class: 'btn btn--primary', type: 'button', onclick: onRestart }, 'Ещё раз'),
      el('a', { class: 'btn', href: topicHref(group) }, 'В меню'),
    ),
  );
}

/**
 * Wrong options that always include the answer's "twin" — another item with
 * the same `key`: the same note name in another octave, the same finger on
 * the other hand. Then the set that is being told apart really matters.
 */
export function pickWithTwin(key) {
  return (item, pool, count) => {
    const twins = pool.filter((other) => other[key] === item[key] && other.id !== item.id);
    if (!twins.length) return sample(pool, count, [item]);
    const [twin] = sample(twins, 1);
    return [twin, ...sample(pool, count - 1, [item, twin])];
  };
}

function buildQueue(notes, count) {
  const queue = [];
  while (queue.length < count) queue.push(...shuffle(notes));
  return queue.slice(0, count);
}

export function createQuiz(config) {
  const {
    id,
    title,
    subtitle,
    emoji,
    accent,
    group,
    questions = 10,
    optionsCount = 4,
    optionsClass = 'options',
    renderPrompt,
    renderOption,
    // a picture to answer on, in place of the option buttons; gets
    // (note, notes, pick), where pick(id) answers with that id
    renderBoard = null,
    onAsk = null,
    // controls above the question; gets { redraw, restart }
    renderControls = null,
    // which notes to ask about: the first octave by default. A function is
    // called at the start of every round, for sets the child can change.
    notes = NOTES,
    // wrong answer options; random notes from the same set by default
    pickOthers = (note, pool, count) => sample(pool, count, [note]),
    // what to say after a wrong answer
    explainAnswer = (note) => `Это ${note.ru} — ${note.colorName.toLowerCase()}`,
  } = config;

  return {
    id,
    title,
    subtitle,
    emoji,
    accent,
    group,

    mount(root) {
      const roundNotes = () => (typeof notes === 'function' ? notes() : notes);
      let pool = roundNotes();
      let queue = buildQueue(pool, questions);
      let index = 0;
      let score = 0;
      let locked = false;
      let cancelled = false;
      // bumped on every new round, so an answer still waiting for its
      // feedback to finish doesn't move a round that has been restarted
      let round = 0;
      // answers of the current question. They are kept, so that redrawing the
      // screen (the "coloured notes" toggle) neither reshuffles them nor
      // replays the sound — the question stays exactly the same one.
      let options = null;

      const screen = el('div', { class: 'screen quiz', style: `--accent:${accent}` });
      root.append(screen);

      function renderProgress() {
        return el('div', { class: 'progress' },
          el('div', { class: 'progress__dots' },
            queue.map((_, i) => el('span', {
              class: `dot ${i < index ? 'dot--done' : ''} ${i === index ? 'dot--now' : ''}`,
            }))),
          el('div', { class: 'progress__score' }, `⭐ ${score}`),
        );
      }

      function renderQuestion() {
        clear(screen);
        if (index >= queue.length) return renderResult();

        const note = queue[index];
        const fresh = !options;
        if (fresh) options = renderBoard ? [] : shuffle([note, ...pickOthers(note, pool, optionsCount - 1)]);
        const feedback = el('div', { class: 'feedback' }, ' ');

        let answers;
        const pick = (id) => answer(id, note, answers, feedback);
        if (renderBoard) {
          answers = el('div', { class: 'board' }, renderBoard(note, pool, pick));
        } else {
          answers = el('div', { class: optionsClass }, options.map((option) =>
            el('button', {
              class: 'option',
              type: 'button',
              'data-answer': option.id,
              onclick: () => pick(option.id),
            }, renderOption(option, pool))));
        }

        mount(screen,
          renderProgress(),
          renderControls ? renderControls({ redraw, restart }) : null,
          el('div', { class: 'question' }, renderPrompt(note, pool)),
          feedback,
          answers,
        );

        if (fresh && onAsk) onAsk(note);
      }

      /** Redraws the current question — for controls such as the colour toggle. */
      function redraw() {
        if (!locked) renderQuestion();
      }

      /** A fresh round — "Ещё раз", or a control that changed the set of notes. */
      function restart() {
        pool = roundNotes();
        queue = buildQueue(pool, questions);
        index = 0;
        score = 0;
        options = null;
        locked = false;
        round += 1;
        renderQuestion();
      }

      async function answer(pickedId, correctNote, answers, feedback) {
        if (locked) return;
        locked = true;
        const current = round;

        const isCorrect = pickedId === correctNote.id;
        store.recordAnswer(correctNote.id, isCorrect);

        answers.classList.add('is-answered');
        answers.querySelectorAll('[data-answer]').forEach((node) => {
          if (node instanceof HTMLButtonElement) node.disabled = true;
          const id = node.getAttribute('data-answer');
          if (id === correctNote.id) node.classList.add('option--right');
          else if (id === pickedId) node.classList.add('option--wrong');
        });

        if (isCorrect) {
          score += 1;
          feedback.textContent = praise();
          feedback.className = 'feedback feedback--good';
          playSuccess();
        } else {
          feedback.textContent = explainAnswer(correctNote, pool);
          feedback.className = 'feedback feedback--bad';
          playFail();
        }

        await delay(isCorrect ? 850 : 1600);
        if (cancelled || current !== round) return;
        index += 1;
        options = null;
        locked = false;
        renderQuestion();
      }

      function renderResult() {
        clear(screen);
        screen.append(renderRoundResult({ id, group, score, total: queue.length, onRestart: restart }));
      }

      renderQuestion();
      return () => { cancelled = true; };
    },
  };
}
