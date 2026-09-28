// How each guitar shape sounds and what it can play in the workshop.
//
// Every shape has its own timbre (see core/strings.js for the fields and the
// notation of tunes), a short `hello` chord that sounds when the shape is put
// on, and three tunes. Only public-domain melodies (folk and classical) and
// riffs written for this app.

const third = 1 / 3;

/** Arpeggio in triplets: each melody note is followed by two inner strings. */
const triplets = (bars) => bars
  .map(([melody, ...inner]) => melody.split(' ').map((note) => `${note}:${third} ${inner.join(' ')}`).join(' '))
  .join(' ');

const repeat = (text, times) => Array(times).fill(text).join(' ');

// Blues shuffle on a power chord: root with the fifth, sixth, seventh, sixth
const shuffle = (root, fifth, sixth, seventh) =>
  [fifth, fifth, sixth, sixth, seventh, seventh, sixth, sixth]
    .map((top, i) => `${root}+${top}!:${i % 2 ? third : 2 * third}`)
    .join(' ');

const gallop = (note) => `${note}!:.5 ${note}!:.25 ${note}!:.25`;

// Mozart, Rondo alla turca: the opening phrase (8 beats)
const TURCA = 'B4:.25 A4 G#4 A4 C5:1 D5:.25 C5 B4 C5 E5:1 '
  + 'F5:.25 E5 D#5 E5 B5 A5 G#5 A5 B5 A5 G#5 A5 C6:1';

// Grieg, In the Hall of the Mountain King: both halves of the theme (16 beats)
const MOUNTAIN_KING = 'B2:.5 C#3 D3 E3 F#3 D3 F#3:1 F3:.5 C#3 F3:1 E3:.5 C3 E3:1 '
  + 'B2:.5 C#3 D3 E3 F#3 D3 F#3 B3 A3 F#3 D3 F#3 A3:2';

// Rimsky-Korsakov, Flight of the Bumblebee: the opening buzz (4 beats)
const BUMBLEBEE = 'E5:.25 D#5 D5 C#5 D5 C#5 C5 B4 C5 C#5 D5 C#5 C5 B4 A#4 A4';

export const GUITAR_SOUNDS = {
  classic: {
    timbre: { sustain: 2.4, smooth: 2, lowpass: 2600, volume: 0.55, strum: 0.025 },
    hello: 'C3+E3+G3+C4+E4:2',
    tunes: [
      {
        id: 'arpeggio',
        name: 'Перебор',
        emoji: '🌙',
        audio: './audio/tunes/arpeggio.m4a',
        clip: 30,
        bpm: 110,
        ring: 1.6,
        voices: [
          repeat('C3:.5 G3 C4 E4 C4 G3 A2 E3 A3 C4 A3 E3 F2 C3 F3 A3 F3 C3 G2 D3 G3 B3 G3 D3', 2)
          + ' C3+G3+C4+E4:3',
        ],
      },
      {
        id: 'romance',
        name: 'Романс',
        emoji: '🌹',
        audio: './audio/tunes/romance.m4a',
        clip: 30,
        bpm: 66,
        ring: 1.2,
        voices: [
          triplets([
            ['B4 B4 B4', 'B3', 'G3'], ['B4 A4 G4', 'B3', 'G3'], ['G4 F#4 E4', 'B3', 'G3'], ['E4 G4 B4', 'B3', 'G3'],
            ['E5 E5 E5', 'C4', 'A3'], ['E5 D5 C5', 'C4', 'A3'], ['C5 B4 A4', 'B3', 'G3'], ['A4 B4 C5', 'B3', 'A3'],
          ]) + ' E2+G3+B3+B4:3',
          'E2:3 E2 E2 E2 A2 A2 E2 B2',
        ],
      },
      {
        id: 'greensleeves',
        name: 'Зелёные рукава',
        emoji: '🍀',
        audio: './audio/tunes/greensleeves.m4a',
        clip: 30,
        bpm: 150,
        ring: 1,
        voices: [
          'A4:1 C5:2 D5:1 E5:1.5 F5:.5 E5:1 D5:2 B4:1 G4:1.5 A4:.5 B4:1 C5:2 A4:1 A4:1.5 G#4:.5 A4:1 '
          + 'B4:2 G#4:1 E4:2 A4:1 C5:2 D5:1 E5:1.5 F5:.5 E5:1 D5:2 B4:1 G4:1.5 A4:.5 B4:1 '
          + 'C5:1.5 B4:.5 A4:1 G#4:1.5 F#4:.5 G#4:1 A4:3',
          '-:1 ' + ['A2 E3 A3', 'C3 G3 C4', 'G2 D3 G3', 'E2 B2 E3', 'A2 E3 A3', 'A2 E3 A3', 'E2 B2 G#3', 'E2 B2 G#3',
            'A2 E3 A3', 'C3 G3 C4', 'G2 D3 G3', 'E2 B2 E3', 'A2 E3 A3', 'E2 B2 G#3', 'A2 E3 A3']
            .map((chord) => chord.replace(' ', ':1 ')).join(' '),
        ],
      },
    ],
  },

  heart: {
    timbre: { sustain: 1.1, smooth: 1, lowpass: 5200, volume: 0.45, strum: 0.02, double: 1.004 },
    hello: 'C4+E4+G4+C5:2',
    tunes: [
      {
        id: 'lullaby',
        name: 'Колыбельная',
        emoji: '💤',
        audio: './audio/tunes/lullaby.m4a',
        clip: 30,
        bpm: 92,
        voices: [
          'E4:.5 E4 G4:2 E4:.5 E4 G4:2 E4:.5 G4 C5:1 B4:1.5 A4:.5 A4:1 G4 D4:.5 E4 '
          + 'F4:1 D4 D4:.5 E4 F4:2 D4:.5 F4 B4:.5 A4 G4:1 B4 C5:3',
          '-:1 C3:3 C3 F3 G2 G2 G2 G2 C3',
        ],
      },
      {
        id: 'geese',
        name: 'Два весёлых гуся',
        emoji: '🪿🪿',
        audio: './audio/tunes/geese.m4a',
        clip: 15,
        bpm: 120,
        voices: [
          'C4:1 D4 E4 C4 C4 D4 E4 C4 E4 F4 G4:2 E4:1 F4 G4:2 '
          + 'G4:.5 A4 G4 F4 E4:1 C4 G4:.5 A4 G4 F4 E4:1 C4 C4 G3 C4:2 C4:1 G3 C4:2',
          '-:8 C3:1 D3 E3 C3 C3 D3 E3 C3 E3 F3 G3:2 E3:1 F3 G3:2 '
          + 'G3:.5 A3 G3 F3 E3:1 C3 G3:.5 A3 G3 F3 E3:1 C3 C3 G2 C3:2 C3:1 G2 C3:2',
        ],
      },
      {
        id: 'joy',
        name: 'Ода к радости',
        emoji: '🎉',
        audio: './audio/tunes/joy.m4a',
        clip: 30,
        bpm: 120,
        voices: [
          'E4:1 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4 E4 E4:1.5 D4:.5 D4:2 '
          + 'E4:1 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4 E4 D4:1.5 C4:.5 C4:2',
          'C3:4 G2 C3 G2 C3 G2 C3 G2:2 C3',
        ],
      },
    ],
  },

  electric: {
    timbre: {
      sustain: 4, smooth: 1, lowpass: 4200, volume: 0.3, strum: 0.012, drive: 4,
      echo: { time: 0.28, feedback: 0.25, mix: 0.18 },
    },
    hello: 'A2+E3+A3+C#4+E4:2',
    tunes: [
      {
        id: 'bachsjoke',
        name: 'Шутка Баха',
        emoji: '🕺',
        clip: 30,
        audio: './audio/tunes/bachsjoke.m4a',
        bpm: 130,
        voices: [
          [
            shuffle('A2', 'E3', 'F#3', 'G3'), shuffle('A2', 'E3', 'F#3', 'G3'),
            shuffle('D3', 'A3', 'B3', 'C4'), shuffle('A2', 'E3', 'F#3', 'G3'),
            shuffle('E2', 'B2', 'C#3', 'D3'), shuffle('D3', 'A3', 'B3', 'C4'),
            shuffle('A2', 'E3', 'F#3', 'G3'),
          ].join(' ') + ' A2+E3+G3+C#4+E4:4',
        ],
      },
      {
        id: 'turca',
        name: 'Турецкий марш',
        emoji: '🥁',
        clip: 30,
        audio: './audio/tunes/turca.m4a',
        bpm: 116,
        voices: [
          `${TURCA} ${TURCA} A2+E3+A3+C4+E4:3`,
          repeat(`-:1 ${repeat('A2+E3!:.5', 14)}`, 2),
        ],
      },
      {
        id: 'solo',
        name: 'Рок-соло',
        emoji: '🤘',
        clip: 30,
        audio: './audio/tunes/solo.m4a',
        bpm: 100,
        voices: [
          'A4:.5 C5 D5 E5 D5^:1 C5:.5 A4 G4 A4 C5 A4 G4 E4 G4:1 '
          + 'E5:.5 G5 A5^:1.5 G5:.5 E5 D5 C5:.25 D5 C5 A4 C5 D5 C5 A4 G4:.5 A4:1.5 '
          + 'A5^:2 G5:.5 E5 D5 C5 A4^:4',
          [
            repeat('A2+E3!:.5', 8), repeat('G2+D3!:.5', 8), repeat('A2+E3!:.5', 8),
            repeat('D3+A3!:.5', 8), repeat('A2+E3!:.5', 8),
          ].join(' ') + ' A2+E3+A3:4',
        ],
      },
    ],
  },

  star: {
    timbre: {
      sustain: 3, smooth: 1, lowpass: 6500, volume: 0.36, strum: 0.03, double: 1.003,
      echo: { time: 0.36, feedback: 0.45, mix: 0.5 },
    },
    hello: 'C4+G4+B4+E5:3',
    tunes: [
      {
        id: 'furelise',
        name: 'К Элизе',
        emoji: '⭐',
        bpm: 132,
        clip: 30,
        audio: './audio/tunes/furelise.m4a',
        ring: 1.2,
        voices: [
          'C5:1 C5 G5 G5 A5 A5 G5:2 F5:1 F5 E5 E5 D5 D5 C5:2 '
          + 'G5:1 G5 F5 F5 E5 E5 D5:2 G5:1 G5 F5 F5 E5 E5 D5:2 '
          + 'C5:1 C5 G5 G5 A5 A5 G5:2 F5:1 F5 E5 E5 D5 D5 C4+E4+G4+C5:4',
        ],
      },
      {
        id: 'moonlight',
        name: 'Лунная соната',
        emoji: '🌕',
        bpm: 56,
        clip: 30,
        audio: './audio/tunes/moonlight.m4a',
        ring: 1.2,
        voices: [
          triplets([
            ['G#3 G#3 G#3 G#3', 'C#4', 'E4'], ['G#3 G#3 G#3 G#3', 'C#4', 'E4'],
            ['A3 A3', 'C#4', 'E4'], ['A3 A3', 'D4', 'F#4'],
            ['G#3', 'C4', 'F#4'], ['G#3', 'C#4', 'E4'], ['G#3', 'C#4', 'D#4'], ['F#3', 'C4', 'D#4'],
          ]) + ' C#3+G#3+C#4+E4:4',
          'C#3:4 B2 A2:2 F#2 G#2:4',
        ],
      },
      {
        id: 'vivaldistorm',
        name: 'Шторм Вивальди',
        emoji: '🌠',
        bpm: 112,
        clip: 30,
        audio: './audio/tunes/vivaldistorm.m4a',
        ring: 0.8,
        voices: [
          'C4:.25 E4 G4 C5 E5 G5 C6:1 '
          + repeat('G5:.25 E5 C5 G4 A5 E5 C5 A4 F5 C5 A4 F4 G5 D5 B4 G4', 2)
          + ' C6:.25 G5 E5 C5 G4 E4 C4:.5 C3+G3+C4+E4+G4+C5:3',
        ],
      },
    ],
  },

  arrow: {
    timbre: { sustain: 4, smooth: 0, lowpass: 3200, volume: 0.22, strum: 0.006, drive: 18 },
    hello: 'E2+B2+E3:2',
    tunes: [
      {
        id: 'mountain',
        name: 'Пещера горного короля',
        emoji: '⛰️',
        clip: 30,
        audio: './audio/tunes/mountain.m4a',
        bpm: 110,
        voices: [`${MOUNTAIN_KING} @150 ${MOUNTAIN_KING} @200 ${MOUNTAIN_KING} B2+F#3+B3:3`],
      },
      {
        id: 'bumblebee',
        name: 'Полёт шмеля',
        emoji: '🐝',
        clip: 15,
        audio: './audio/tunes/bumblebee.m4a',
        bpm: 150,
        voices: [
          `${BUMBLEBEE} ${BUMBLEBEE} A4:.25 A#4 B4 C5 C#5 D5 D#5 E5 F5 E5 D#5 E5 F5 E5 D#5 E5 E5^:1 A2+E3+A3:2`,
        ],
      },
      {
        id: 'romeo_and_julietta',
        name: 'Рамео и Джульетта',
        emoji: '💔',
        bpm: 150,
        clip: 30,
        audio: './audio/tunes/romeo_and_julietta.m4a',
        voices: [
          repeat(
            `${repeat(gallop('E2'), 3)} G2+D3:.5 A2+E3 `
            + `${repeat(gallop('E2'), 3)} A2+E3:.5 G2+D3 `
            + `${repeat(gallop('E2'), 3)} C3+G3:.5 D3+A3 `
            + 'E3+B3:1 D3+A3 C3+G3 B2+F#3',
            2,
          ) + ' E4:.25 G4 A4 B4^:.75 A4:.25 G4 E4 D4 E4:1 E2+B2+E3:3',
        ],
      },
    ],
  },
};

/** Sound of a guitar shape; unknown shapes sound like the classical guitar. */
export const soundOf = (shape) => GUITAR_SOUNDS[shape] || GUITAR_SOUNDS.classic;
