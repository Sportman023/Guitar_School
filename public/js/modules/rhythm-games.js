// Games of the "Rhythm" topic. All of them are quizzes with options; the
// rhythm of every question plays on the piano by the 🔊 button.
//
// The "count under the notes" switch above the question is the scaffolding of
// this topic, as colour is for the notes: the beats 1 2 3 under the staff, and
// a strip under a note as long as the note lasts. It never shows the answer
// itself — the child still counts the bars, the beats or the strips — and it
// is shared by all the games of the topic.
//
// A question that needs a picture of its own (a random rhythm) is made fresh
// for every round: it is the right answer with the picture attached, so the
// quiz engine compares ids as usual (see the `notes` functions below).

import { createQuiz, buildQueue } from "../core/quiz.js";
import { countToggle, showsCount } from "../core/controls.js";
import {
  renderRhythm,
  noteGlyph,
  playRhythm,
  stopRhythm,
} from "../core/rhythm.js";
import { el } from "../core/ui.js";
import { loadPiano } from "../core/piano.js";
import {
  DURATIONS,
  METERS,
  METER_BY_BEATS,
  countOf,
  randomBars,
} from "../data/rhythm.js";

const GROUP = "rhythm";
const QUESTIONS = 10;

/** The 🔊 button that plays the picture of a question. */
function listenButton(picture) {
  return el(
    "button",
    {
      class: "listen",
      type: "button",
      onclick: () => playRhythm(picture),
    },
    "🔊 Послушать",
  );
}

/** A rhythm question: the picture on paper and the button under it. */
function rhythmPrompt(label, picture) {
  return el(
    "div",
    { class: "prompt prompt--wide" },
    el("div", { class: "prompt__label" }, label),
    el("div", { class: "rhythm-paper rhythm-paper--prompt" }, picture),
    listenButton(picture),
  );
}

// every new question starts quiet: the one before may still be playing
const quietly = {
  onAsk: () => {
    loadPiano();
    stopRhythm();
  },
  onLeave: stopRhythm,
};

// ---------- What is this note called ----------

const byLength = (a, b) => b.beats - a.beats;

export const durationName = createQuiz({
  id: "duration-name",
  title: "Какая длительность?",
  subtitle: "Нота → её название",
  emoji: "⏱️",
  accent: "#7CB342",
  group: GROUP,
  notes: DURATIONS,
  sortOptions: byLength,
  optionsClass: "options options--rhythm",
  ...quietly,
  renderControls: ({ redraw }) => countToggle(redraw),
  renderPrompt: (duration) => {
    const glyph = noteGlyph(duration.token, {
      cells: showsCount(),
      label: "Нота",
    });
    return el(
      "div",
      { class: "prompt" },
      el("div", { class: "prompt__label" }, "Как называется эта длительность?"),
      el("div", { class: "rhythm-paper rhythm-paper--glyph" }, glyph),
      listenButton(glyph),
    );
  },
  renderOption: (duration) =>
    el("span", { class: "option__name option__name--long" }, duration.ru),
  explainAnswer: (duration) => `Это ${duration.one} нота. ${duration.lasts}`,
});

// ---------- Splitting durations ----------

// "How many eighths in a half?": the answer is a number. Six never is, but a
// child who counts wrong may well think so.
const NUMBERS = [2, 4, 6, 8].map((value) => ({
  id: `n${value}`,
  value,
  rank: value,
}));
const NUMBER_BY_VALUE = Object.fromEntries(
  NUMBERS.map((item) => [item.value, item]),
);
const DURATION_ANSWERS = DURATIONS.map((duration) => ({
  ...duration,
  rank: -duration.beats,
}));

// every pair of a longer and a shorter duration, asked both ways
const PAIRS = DURATIONS.flatMap((big, i) =>
  DURATIONS.slice(i + 1).map((small) => ({
    big,
    small,
    times: big.beats / small.beats,
  })),
);

const TREE_QUESTIONS = [
  // one long note = how many short ones?
  ...PAIRS.map(({ big, small, times }) => ({
    ...NUMBER_BY_VALUE[times],
    ask: "count",
    big,
    small,
    times,
  })),
  // so many short notes = which one long note?
  ...PAIRS.map(({ big, small, times }) => ({
    ...DURATION_ANSWERS.find((item) => item.id === big.id),
    ask: "sum",
    big,
    small,
    times,
  })),
];

/** A note in the question, with its length strip when the hint is on. */
function treeGlyph(duration) {
  return el(
    "div",
    { class: "tree-glyph" },
    noteGlyph(duration.token, {
      cells: showsCount(),
      label: `${duration.ru} нота`,
    }),
  );
}

function treePrompt(question) {
  const { big, small, times } = question;
  if (question.ask === "count") {
    return el(
      "div",
      { class: "prompt prompt--wide" },
      el(
        "div",
        { class: "prompt__label" },
        `Сколько ${small.many} нот в одной ${big.in}?`,
      ),
      el(
        "div",
        { class: "equation" },
        treeGlyph(big),
        el("span", { class: "equation__sign" }, "="),
        el("span", { class: "equation__ask" }, "?"),
        treeGlyph(small),
      ),
    );
  }
  return el(
    "div",
    { class: "prompt prompt--wide" },
    el(
      "div",
      { class: "prompt__label" },
      `Какая одна нота звучит столько же, сколько ${countOf(times, small)}?`,
    ),
    el(
      "div",
      { class: "equation" },
      el(
        "div",
        {
          class:
            `equation__group ${times > 4 ? "equation__group--many" : ""}`.trim(),
        },
        Array.from({ length: times }, () => treeGlyph(small)),
      ),
      el("span", { class: "equation__sign" }, "="),
      el("span", { class: "equation__ask" }, "?"),
    ),
  );
}

export const durationTree = createQuiz({
  id: "duration-tree",
  title: "Делим длительности",
  subtitle: "Сколько коротких нот в одной длинной",
  emoji: "🌿",
  accent: "#43A047",
  group: GROUP,
  notes: TREE_QUESTIONS,
  pickOthers: (question) =>
    (question.ask === "count" ? NUMBERS : DURATION_ANSWERS).filter(
      (item) => item.id !== question.id,
    ),
  sortOptions: (a, b) => a.rank - b.rank,
  optionsClass: "options options--rhythm",
  ...quietly,
  renderControls: ({ redraw }) => countToggle(redraw),
  renderPrompt: treePrompt,
  renderOption: (option) =>
    option.value
      ? el("span", { class: "option__name" }, String(option.value))
      : el(
          "span",
          { class: "option__stack" },
          el(
            "span",
            { class: "option__glyph" },
            noteGlyph(option.token, { label: option.ru }),
          ),
          el("span", { class: "option__octave" }, option.ru),
        ),
  explainAnswer: ({ big, small, times }) =>
    `Одна ${big.one} = ${countOf(times, small)}`,
});

// ---------- How many bars ----------

const BAR_COUNTS = [1, 2, 3, 4].map((value) => ({ id: `b${value}`, value }));
// the longest line that still reads on a phone, in quarters
const MAX_QUARTERS = 9;

/** A round of 10 lines, about as many of each answer; the time signature fits the length. */
function barQuestions() {
  return buildQueue(BAR_COUNTS, QUESTIONS).map((answer) => {
    const meters = METERS.filter(
      (meter) => meter.beats * answer.value <= MAX_QUARTERS,
    );
    const meter = meters[Math.floor(Math.random() * meters.length)];
    return { ...answer, meter, bars: randomBars(meter.beats, answer.value) };
  });
}

const barsWord = (count) =>
  count === 1 ? "такт" : count < 5 ? "такта" : "тактов";

export const countBars = createQuiz({
  id: "count-bars",
  title: "Сколько тактов?",
  subtitle: "Считаем такты между тактовыми чертами",
  emoji: "🧮",
  accent: "#00897B",
  group: GROUP,
  notes: barQuestions,
  pickOthers: (question) =>
    BAR_COUNTS.filter((item) => item.id !== question.id),
  sortOptions: (a, b) => a.value - b.value,
  optionsClass: "options options--rhythm options--numbers",
  ...quietly,
  renderControls: ({ redraw }) => countToggle(redraw),
  renderPrompt: (question) =>
    rhythmPrompt(
      "Сколько здесь тактов?",
      renderRhythm(question.bars, {
        meter: question.meter,
        // "1 и 2 и…" with every beat, as in the duration tree
        counts: showsCount() && "full",
      }),
    ),
  renderOption: (option) =>
    el("span", { class: "option__name" }, String(option.value)),
  explainAnswer: ({ value }) =>
    `Здесь ${value} ${barsWord(value)}: считаем «комнатки» между тактовыми чертами`,
});

// ---------- Which time signature ----------

/** A round of 10 rhythms of two bars, about as many in each time signature. */
function meterQuestions() {
  return buildQueue(METERS, QUESTIONS).map((meter) => ({
    ...meter,
    bars: randomBars(meter.beats, 2),
  }));
}

export const guessMeter = createQuiz({
  id: "guess-meter",
  title: "Какой размер?",
  subtitle: "Считаем доли в такте",
  emoji: "🎯",
  accent: "#8E24AA",
  group: GROUP,
  notes: meterQuestions,
  pickOthers: (question) => METERS.filter((meter) => meter.id !== question.id),
  optionsCount: METERS.length,
  sortOptions: (a, b) => a.beats - b.beats,
  optionsClass: "options options--rhythm options--meters",
  ...quietly,
  renderControls: ({ redraw }) => countToggle(redraw),
  renderPrompt: (question) =>
    rhythmPrompt(
      "Какой здесь размер?",
      renderRhythm(question.bars, {
        meter: question,
        meterMark: "ask",
        counts: showsCount(),
      }),
    ),
  renderOption: (meter) =>
    el(
      "span",
      { class: "meter-mark", "aria-label": meter.label },
      el("span", null, String(meter.top)),
      el("span", null, String(meter.bottom)),
    ),
  explainAnswer: ({ beats }) => {
    const meter = METER_BY_BEATS[beats];
    return `В каждом такте ${meter.words} — это размер ${meter.label}`;
  },
});
