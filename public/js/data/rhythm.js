// Rhythm: note durations, bars and time signatures.
//
// A rhythm is written as a list of bars, every bar a list of tokens:
//   'w'  — whole note       4 quarters
//   'h'  — half note        2 quarters
//   'q'  — quarter note     1 quarter
//   'e'  — eighth note      half a quarter, with its own flag
//   'ee' — two eighths joined by a beam, one quarter together
// A bare number in place of a bar is an empty bar that many quarters wide
// (a staff with bar lines only). Lengths are counted in quarters, which are
// also the beats of 2/4, 3/4 and 4/4 — the only time signatures taught so far.
//
// Russian needs several forms of every name: "целая нота", "2 половинные",
// "8 восьмых", "в одной четвертной".

export const TOKEN_LENGTH = { w: 4, h: 2, q: 1, e: 0.5, ee: 1 };

export const DURATIONS = [
  {
    id: 'whole',
    token: 'w',
    beats: 4,
    ru: 'Целая',
    one: 'целая',
    in: 'целой',
    few: 'целые',
    many: 'целых',
    looks: 'Белая овальная головка без штиля',
    lasts: 'Самая длинная: считаем раз-два-три-четыре',
  },
  {
    id: 'half',
    token: 'h',
    beats: 2,
    ru: 'Половинная',
    one: 'половинная',
    in: 'половинной',
    few: 'половинные',
    many: 'половинных',
    looks: 'Белая головка со штилем — палочкой',
    lasts: 'Вдвое короче целой: считаем раз-два',
  },
  {
    id: 'quarter',
    token: 'q',
    beats: 1,
    ru: 'Четвертная',
    one: 'четвертная',
    in: 'четвертной',
    few: 'четвертные',
    many: 'четвертных',
    looks: 'Чёрная головка со штилем',
    lasts: 'Вдвое короче половинной: на один счёт — раз',
  },
  {
    id: 'eighth',
    token: 'e',
    beats: 0.5,
    ru: 'Восьмая',
    one: 'восьмая',
    in: 'восьмой',
    few: 'восьмые',
    many: 'восьмых',
    looks: 'Чёрная головка, штиль и флажок. Две восьмые часто соединяют одной чертой',
    lasts: 'Вдвое короче четвертной: две восьмые на один счёт — раз-и',
  },
];

export const DURATION_BY_ID = Object.fromEntries(DURATIONS.map((item) => [item.id, item]));

/** "2 половинные", "8 восьмых": a count with the right form of the name. */
export function countOf(count, duration) {
  if (count === 1) return `1 ${duration.one}`;
  return `${count} ${count < 5 ? duration.few : duration.many}`;
}

// The duration tree: each level splits the one above it in two.
// `note` is said beside the level, as on the card from school.
export const TREE = [
  { duration: 'whole', count: 1, title: 'Целая нота', note: 'Самая длинная нота.' },
  { duration: 'half', count: 2, title: '2 половинные ноты', note: 'Каждая половинная длится в 2 раза короче целой.' },
  { duration: 'quarter', count: 4, title: '4 четвертные ноты', note: 'Каждая четвертная длится в 2 раза короче половинной.' },
  { duration: 'eighth', count: 8, title: '8 восьмых нот', note: 'Каждая восьмая длится в 2 раза короче четвертной.' },
];

export const METERS = [
  { id: 'm2', beats: 2, top: 2, bottom: 4, label: '2/4', words: 'две доли', count: ['раз', 'два'] },
  { id: 'm3', beats: 3, top: 3, bottom: 4, label: '3/4', words: 'три доли', count: ['раз', 'два', 'три'] },
  { id: 'm4', beats: 4, top: 4, bottom: 4, label: '4/4', words: 'четыре доли', count: ['раз', 'два', 'три', 'четыре'] },
];

export const METER_BY_BEATS = Object.fromEntries(METERS.map((meter) => [meter.beats, meter]));

/** How long a bar is, in quarters. */
export const barLength = (bar) => (typeof bar === 'number'
  ? bar
  : bar.reduce((sum, token) => sum + TOKEN_LENGTH[token], 0));

// "Весёлая прогулка" from the card about where time signatures are met:
// three lines of two bars in 3/4.
export const WALK = [
  [['q', 'q', 'q'], ['ee', 'q', 'q']],
  [['q', 'q', 'q'], ['ee', 'q', 'q']],
  [['q', 'q', 'q'], ['q', 'q', 'q']],
];

// ---------- Random bars for the games ----------

// how often each piece turns up in a random bar
const WEIGHTS = { q: 4, ee: 2, h: 2, w: 1 };

const pickWeighted = (tokens) => {
  let roll = Math.random() * tokens.reduce((sum, token) => sum + WEIGHTS[token], 0);
  for (const token of tokens) {
    roll -= WEIGHTS[token];
    if (roll < 0) return token;
  }
  return tokens[tokens.length - 1];
};

/**
 * A random bar of `beats` quarters made of quarters, beamed eighths, halves
 * and (in 4/4 only) a whole note. In 4/4 a half note starts only on the first
 * or the third beat, the way it is written in beginners' music.
 */
export function randomBar(beats) {
  const bar = [];
  let at = 0;
  while (at < beats) {
    const fits = ['q', 'ee'];
    if (at + 2 <= beats && (beats !== 4 || at % 2 === 0)) fits.push('h');
    if (beats === 4 && at === 0) fits.push('w');
    const token = pickWeighted(fits);
    bar.push(token);
    at += TOKEN_LENGTH[token];
  }
  return bar;
}

/** Several random bars, never two identical ones in a row. */
export function randomBars(beats, count) {
  const bars = [];
  while (bars.length < count) {
    const bar = randomBar(beats);
    const last = bars[bars.length - 1];
    // a one-piece bar (a whole, or a half in 2/4) has nothing else to be
    if (last && last.join() === bar.join() && bar.length > 1) continue;
    bars.push(bar);
  }
  return bars;
}
