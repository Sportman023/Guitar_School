// Drawing and playing rhythms (see js/data/rhythm.js for how they are written).
//
// Every note stands on the same line — Ля, between the 2nd and the 3rd staff
// lines — because only the length of a note matters here. Notes are spaced by
// their length: a quarter takes one slot of `beat` units, a whole note four, so
// the eye sees how long each note is, and the levels of the duration tree line
// up. Units are those of js/core/staff.js.
//
// Three pictures live here:
//   renderRhythm — bars on a staff (or without one, for the duration tree),
//                  with an optional time signature, count and bar numbers;
//   renderSum    — notes with signs between them, "♩ + ♩", for sums of durations;
//   noteGlyph    — a single note on its own, for cards and answer buttons.
//
// playRhythm plays any picture on the piano, one key for every note, the first
// beat of a bar louder; whatever stands for a moment of the music (a note, a
// number of the count, a clap) lights up while it lasts.

import { svgEl } from './ui.js';
import {
  staffBase, TOP_LINE, SPACING, BOTTOM_LINE, CLEF_TOP, CLEF_BOTTOM, HEAD_RX, HEAD_RY,
} from './staff.js';
import { loadPiano, playPiano } from './piano.js';
import { TOKEN_LENGTH, SYLLABLES, barLength } from '../data/rhythm.js';
import { NOTE_BY_ID } from '../data/notes.js';

const NOTE_Y = BOTTOM_LINE - (3 * SPACING) / 2; // 49 — Ля, between the 2nd and 3rd lines
const STEM_TOP = NOTE_Y - 32;
const STEM_DX = HEAD_RX - 0.8; // the stem goes up on the right of the head
const BEAM = 4.5;
const BAR_PAD = 4; // room between a bar line and the first slot of the bar
// and after the last slot: the stem and beam of a last eighth stick out of it
const BAR_END = 7;
const HEADER = { meter: 62, clef: 44, none: 4 }; // where the first bar starts
const METER_X = 50;
const PITCH = NOTE_BY_ID.lya.freq;
// pictures never grow beyond this many pixels per unit: a short rhythm stays
// the size of a long one instead of filling the whole screen
const MAX_SCALE = 1.7;

const round = (value) => Math.round(value * 100) / 100;

/**
 * An ellipse as a path, turned by `deg`. Two of them in one path with the
 * even-odd rule make a ring: a white note head has a real hole in it, so it
 * looks right on any background.
 */
function ellipse(cx, cy, rx, ry, deg) {
  const t = (deg * Math.PI) / 180;
  const dx = rx * Math.cos(t);
  const dy = rx * Math.sin(t);
  const a = `${round(cx - dx)} ${round(cy - dy)}`;
  const b = `${round(cx + dx)} ${round(cy + dy)}`;
  return `M${a}A${rx} ${ry} ${deg} 1 0 ${b}A${rx} ${ry} ${deg} 1 0 ${a}Z`;
}

/** The head of a note of this token: white with a hole, or black. */
function head(token, x) {
  const d = token === 'w'
    ? ellipse(x, NOTE_Y, 7.6, 5, 0) + ellipse(x, NOTE_Y, 3.5, 2.3, 60)
    : token === 'h'
      ? ellipse(x, NOTE_Y, HEAD_RX, HEAD_RY, -20) + ellipse(x, NOTE_Y, 4.6, 2, -32)
      : ellipse(x, NOTE_Y, HEAD_RX, HEAD_RY, -20);
  return svgEl('path', { d, class: 'rhythm__head', 'fill-rule': 'evenodd' });
}

/**
 * Head, stem and flags of one note: one flag for an eighth, two for a
 * sixteenth; a beamed note leaves its flags to the beams.
 */
function noteShape(token, x, { beamed = false } = {}) {
  const parts = [head(token, x)];
  if (token === 'w') return parts;
  const sx = x + STEM_DX;
  parts.push(svgEl('line', { x1: sx, x2: sx, y1: NOTE_Y - 1, y2: STEM_TOP, class: 'rhythm__stem' }));
  const flags = beamed ? 0 : { e: 1, s: 2 }[token] || 0;
  for (let k = 0; k < flags; k++) {
    const y = STEM_TOP + k * 7;
    parts.push(svgEl('path', {
      d: `M${sx - 0.9} ${y}c0.8 5.5 9 8 7.6 17.5c-0.6-5.2-4-8.4-7.6-9.6Z`,
      class: 'rhythm__flag',
    }));
  }
  return parts;
}

// notes that come joined by beams: the note of a group, how many, how many beams
const GROUPS = { ee: { token: 'e', count: 2, beams: 1 }, ssss: { token: 's', count: 4, beams: 2 } };

// How much wider than its length a piece is drawn. Four sixteenths get the
// room of almost two quarters, as printed music gives them: four heads in one
// beat, and room under them for ТУ-ТИ-ФРУ-ТИ.
const STRETCH = { ssss: 1.8 };
// a word of a syllable module never runs out of its module: a long one is
// pressed together to fit (see renderRhythm)
const MODULE_INSET = 2.5;
const LONG_WORD = 6;

/**
 * The notes of a bar with their start and length, in quarters from the start
 * of the bar, and the piece of the bar each one belongs to.
 */
function barNotes(bar) {
  if (typeof bar === 'number') return [];
  const notes = [];
  let at = 0;
  bar.forEach((token, piece) => {
    const group = GROUPS[token];
    if (group) {
      const length = TOKEN_LENGTH[token] / group.count;
      for (let k = 0; k < group.count; k++) {
        const beam = k === 0 ? 'first' : k === group.count - 1 ? 'last' : 'middle';
        notes.push({ token: group.token, start: at + k * length, length, piece, beam, beams: group.beams });
      }
    } else {
      notes.push({ token, start: at, length: TOKEN_LENGTH[token], piece });
    }
    at += TOKEN_LENGTH[token];
  });
  return notes;
}

const lit = (start, length) => `${start},${length}`;

// a dashed line of `gaps` is tapped with a finger, so it can be hit this much
// of a quarter beyond the room between the pieces — unless a neighbour is closer
const GAP_REACH = 0.4;

/**
 * Bars of a rhythm, left to right.
 *   meter     — { top, bottom } of the time signature;
 *   meterMark — 'show' the time signature, 'ask' a "?" in its place, or 'none';
 *   staff     — staff lines and the treble clef (off for the duration tree);
 *   barlines  — bar lines between the bars: all of them, none (false), or a
 *               list of the bars that have one after them;
 *   final     — the double bar line at the end;
 *   marked    — bar lines drawn in colour, to point at them;
 *   counts    — the count under the notes: 1 2 3 for the beats, "и" for the
 *               second eighth, the beats a long note holds through greyed;
 *               'full' counts "1 и 2 и…" under every beat, as the duration
 *               tree does: "1 и" of a quarter share its one strip, and every
 *               note stands right above the word it starts on;
 *   words     — the rhythm syllables under the notes in place of the count:
 *               every piece of a bar says its word in a module of its own
 *               colour, as long as the piece — ТА under a quarter, ТИ-ТИ under
 *               two eighths, ТУ-ТИ-ФРУ-ТИ under four sixteenths (js/data/rhythm.js);
 *   pulse     — a dot under every beat in place of the count, the beats a long
 *               note holds through greyed: the beats can be counted without
 *               being told which of them starts a bar;
 *   rowRoom   — the room of that row under the notes, kept even when nothing
 *               is written in it, so the picture is already the size it will
 *               be once the row fills in;
 *   cells     — a strip under every note as long as the note lasts;
 *   numbers   — a bracket with the number of the bar under every bar;
 *   even      — every piece of a bar (a note, two beamed eighths) gets the room
 *               around it that a whole bar gets, so a gap between two bars
 *               looks like any other: bar lines can come and go without moving
 *               a single note;
 *   gaps      — a dashed line in every gap between two pieces, to be tapped:
 *               data-at is where it is in quarters, counted as data-start of
 *               the notes; a gap that has a bar line has no dashed line;
 *   beat      — how wide a quarter is;
 *   fit       — the width the picture must have: quarters are made as wide as
 *               it takes, the way lines of printed music are justified;
 *   startBeat — where this picture starts in a longer piece (in quarters), so
 *               that several pictures can be played as one (see playRhythm).
 */
export function renderRhythm(bars, {
  meter = null,
  meterMark = meter ? 'show' : 'none',
  staff = true,
  barlines = true,
  final = true,
  marked = false,
  counts = false,
  words = false,
  pulse = false,
  rowRoom = false,
  cells = false,
  numbers = false,
  even = false,
  gaps = false,
  beat: quarter = 28,
  fit = null,
  startBeat = 0,
  label = 'Ритм на нотном стане',
} = {}) {
  const front = !staff ? HEADER.none : meterMark === 'none' ? HEADER.clef : HEADER.meter;
  const tail = final ? 6 : 3;
  const room = BAR_PAD + BAR_END;
  // the pieces of every bar, by their lengths and how much wider than that
  // they are drawn; an empty bar is one piece
  const pieces = bars.map((bar) => (typeof bar === 'number'
    ? [{ length: bar, stretch: 1 }]
    : bar.map((token) => ({ length: TOKEN_LENGTH[token], stretch: STRETCH[token] || 1 }))));
  // how many quarters wide a piece is drawn
  const span = (piece) => piece.length * piece.stretch;
  // the room goes around every bar or, with `even`, around every piece
  const roomOf = (list) => (even ? list.length : 1) * room;
  const quarters = pieces.flat().reduce((sum, piece) => sum + span(piece), 0);
  const rooms = pieces.reduce((sum, list) => sum + roomOf(list), 0);
  const beat = fit ? (fit - front - tail - rooms) / quarters : quarter;
  const row = Boolean(counts || words || pulse || rowRoom);
  const notesBottom = cells ? NOTE_Y + 21 : NOTE_Y + 8;
  const staffBottom = staff ? Math.max(CLEF_BOTTOM, BOTTOM_LINE) + 3 : notesBottom;
  const countY = Math.max(staff ? BOTTOM_LINE + 20 : 0, notesBottom + 12);
  // the modules of the syllables are taller than a count
  const rowBottom = countY + (words || rowRoom ? 9 : 5);
  const numberY = (row ? rowBottom + 1 : staffBottom + 2);
  const bottom = numbers ? numberY + 22 : row ? rowBottom : staffBottom;
  const top = (staff ? Math.min(CLEF_TOP, STEM_TOP) : STEM_TOP) - 3;

  const widths = pieces.map((list) => list.reduce((sum, piece) => sum + span(piece) * beat, 0) + roomOf(list));
  const end = front + widths.reduce((sum, width) => sum + width, 0);
  const width = end + tail;
  const hasLine = (index) => (Array.isArray(barlines) ? barlines.includes(index) : Boolean(barlines));

  const parts = staff ? staffBase(8, end) : [];
  const layer = { lines: [], notes: [], marks: [], gaps: [] };
  // the gaps between the pieces: where each one is, when, and which bar it ends
  const between = [];

  if (staff && meterMark === 'show' && meter) {
    layer.marks.push(
      svgEl('text', { x: METER_X, y: TOP_LINE + SPACING, class: 'rhythm__meter' }, String(meter.top)),
      svgEl('text', { x: METER_X, y: TOP_LINE + SPACING * 3, class: 'rhythm__meter' }, String(meter.bottom)),
    );
  } else if (staff && meterMark === 'ask') {
    layer.marks.push(
      svgEl('rect', { x: METER_X - 8, y: TOP_LINE - 2, width: 16, height: SPACING * 4 + 4, rx: 4, class: 'rhythm__ask' }),
      svgEl('text', { x: METER_X, y: TOP_LINE + SPACING * 2, class: 'rhythm__ask-text' }, '?'),
    );
  }

  let x = front;
  let at = startBeat;
  bars.forEach((bar, index) => {
    const length = barLength(bar);
    const notes = barNotes(bar);
    const isLast = index === bars.length - 1;
    // where every piece of the bar starts: in quarters from the start of the
    // bar, and on the page, where its first quarter begins; `scale` is how
    // wide a quarter of the piece is
    const slots = [];
    let left = x + BAR_PAD;
    let time = 0;
    pieces[index].forEach((piece, k) => {
      if (k && even) left += room;
      slots.push({ start: time, length: piece.length, x: left, scale: beat * piece.stretch });
      left += span(piece) * beat;
      time += piece.length;
    });
    // Where a moment of the bar is. The moment one piece ends is the moment
    // the next one starts: `ends` takes it as the end of the first, for a
    // strip that runs to the end of its note.
    const xAt = (moment, ends = false) => {
      const slot = slots.find((item) => (ends
        ? moment > item.start && moment <= item.start + item.length
        : moment >= item.start && moment < item.start + item.length)) || slots[slots.length - 1];
      return slot.x + (moment - slot.start) * slot.scale;
    };
    // A note stands in the middle of its slot, a note shorter than a beat in
    // the middle of its own part of one. With the full count every note
    // stands right above its own word ("1", "и"…), so a quarter sits on the
    // first half of its slot.
    const xOf = (note) => xAt(note.length < 1
      ? note.start + note.length / 2
      : counts === 'full' ? note.start + 0.25 : Math.floor(note.start) + 0.5);
    // where a word of the full count goes: under the note that starts on it,
    // or where such a note would stand
    const countX = (start) => {
      const note = notes.find((item) => item.start === start);
      return note ? xOf(note) : xAt(start + 0.25);
    };

    notes.forEach((note, i) => {
      const nx = xOf(note);
      const group = svgEl('g', {
        class: 'rhythm__note',
        'data-start': at + note.start,
        'data-length': note.length,
        'data-strong': note.start === 0 ? '' : null,
      }, noteShape(note.token, nx, { beamed: Boolean(note.beam) }));
      if (cells) {
        const x1 = xAt(note.start);
        group.append(svgEl('rect', {
          x: x1 + 1.5,
          y: NOTE_Y + 11,
          width: xAt(note.start + note.length, true) - x1 - 3,
          height: 7,
          rx: 3,
          class: 'rhythm__cell',
        }));
      }
      layer.notes.push(group);

      // the beams of a group, from its first note to its last; sixteenths
      // have a second one under the first
      if (note.beam === 'first') {
        const last = notes.slice(i + 1).find((other) => other.beam === 'last');
        const x1 = nx + STEM_DX - 0.9;
        const x2 = xOf(last) + STEM_DX + 0.9;
        for (let k = 0; k < note.beams; k++) {
          const y = STEM_TOP + k * (BEAM + 2.5);
          layer.notes.push(svgEl('path', {
            d: `M${x1} ${y}H${x2}V${y + BEAM}H${x1}Z`,
            class: 'rhythm__beam',
          }));
        }
      }
    });

    if (words && typeof bar !== 'number') {
      // every piece says its word in a module as long as the piece, in the
      // colour of its kind (see .syllable in styles.css); the module lights
      // up while its piece sounds
      bar.forEach((token, piece) => {
        const word = SYLLABLES[token];
        if (!word) return;
        const slot = slots[piece];
        const x1 = slot.x + MODULE_INSET;
        const x2 = slot.x + slot.length * slot.scale - MODULE_INSET;
        layer.marks.push(svgEl('g', {
          class: `rhythm__module syllable--${token}`,
          'data-lit': lit(at + slot.start, slot.length),
        },
          svgEl('rect', { x: round(x1), y: countY - 8, width: round(x2 - x1), height: 16, rx: 5 }),
          svgEl('text', {
            x: round((x1 + x2) / 2),
            y: countY,
            class: 'rhythm__word',
            textLength: word.length > LONG_WORD ? round(x2 - x1 - 5) : null,
            lengthAdjust: word.length > LONG_WORD ? 'spacingAndGlyphs' : null,
          }, word)));
      });
    } else if (pulse) {
      for (let b = 0; b < length; b++) {
        const sounds = notes.some((note) => note.start >= b && note.start < b + 1);
        layer.marks.push(svgEl('circle', {
          cx: xAt(b + 0.5),
          cy: countY,
          r: 2.6,
          class: `rhythm__pulse ${sounds ? '' : 'rhythm__pulse--held'}`.trim(),
          'data-lit': lit(at + b, 1),
        }));
      }
    } else if (counts === 'full') {
      // every half of a beat gets its word, in the same places on every
      // level of the tree; what a longer note holds through is greyed
      for (let b = 0; b < length; b++) {
        [[b, String(b + 1)], [b + 0.5, 'и']].forEach(([start, word]) => {
          const kind = [
            word === 'и' ? 'rhythm__count--and' : start === 0 ? 'rhythm__count--strong' : '',
            notes.some((note) => note.start === start) ? '' : 'rhythm__count--held',
          ].filter(Boolean).join(' ');
          layer.marks.push(svgEl('text', {
            x: countX(start),
            y: countY,
            class: `rhythm__count ${kind}`.trim(),
            'data-lit': lit(at + start, 0.5),
          }, word));
        });
      }
    } else if (counts) {
      for (let b = 0; b < length; b++) {
        const starts = notes.find((note) => note.start === b);
        const kind = b === 0 ? 'rhythm__count--strong' : starts ? '' : 'rhythm__count--held';
        layer.marks.push(svgEl('text', {
          x: starts ? xOf(starts) : xAt(b + 0.5),
          y: countY,
          class: `rhythm__count ${kind}`.trim(),
          'data-lit': lit(at + b, 1),
        }, String(b + 1)));
        const and = notes.find((note) => note.start === b + 0.5);
        if (and) {
          layer.marks.push(svgEl('text', {
            x: xOf(and),
            y: countY,
            class: 'rhythm__count rhythm__count--and',
            'data-lit': lit(at + b + 0.5, 0.5),
          }, 'и'));
        }
      }
    }

    if (numbers) {
      const x1 = x + 6;
      const x2 = x + widths[index] - 6;
      const cx = (x1 + x2) / 2;
      layer.marks.push(
        svgEl('path', {
          d: `M${x1} ${numberY}Q${x1} ${numberY + 4} ${x1 + 5} ${numberY + 4}H${cx - 4}L${cx} ${numberY + 8}`
            + `L${cx + 4} ${numberY + 4}H${x2 - 5}Q${x2} ${numberY + 4} ${x2} ${numberY}`,
          class: 'rhythm__brace',
        }),
        svgEl('circle', { cx, cy: numberY + 15, r: 6.5, class: 'rhythm__number-dot' }),
        svgEl('text', { x: cx, y: numberY + 15, class: 'rhythm__number' }, String(index + 1)),
      );
    }

    slots.forEach((slot, i) => {
      const endsBar = i === slots.length - 1;
      // the pieces of a bar stand close together unless `even` parts them
      if ((isLast && endsBar) || (!even && !endsBar)) return;
      between.push({
        x: slot.x + slot.length * slot.scale + BAR_END,
        at: at + slot.start + slot.length,
        bar: endsBar ? index : null,
      });
    });

    x += widths[index];
    at += length;
    if (staff && isLast && final) {
      layer.lines.push(
        svgEl('line', { x1: x - 2, x2: x - 2, y1: TOP_LINE, y2: BOTTOM_LINE, class: `rhythm__bar ${marked ? 'rhythm__bar--marked' : ''}`.trim() }),
        svgEl('rect', { x: x + 0.5, y: TOP_LINE - 0.65, width: 3.5, height: SPACING * 4 + 1.3, class: `rhythm__final ${marked ? 'rhythm__final--marked' : ''}`.trim() }),
      );
    } else if (staff && !isLast && hasLine(index)) {
      layer.lines.push(svgEl('line', {
        x1: x, x2: x, y1: TOP_LINE, y2: BOTTOM_LINE, class: `rhythm__bar ${marked ? 'rhythm__bar--marked' : ''}`.trim(), 'data-bar': index,
      }));
    }
  });

  if (staff && gaps) {
    between.forEach((gap, i) => {
      if (gap.bar !== null && hasLine(gap.bar)) return;
      const before = i ? between[i - 1].x : front;
      const after = i < between.length - 1 ? between[i + 1].x : end;
      const reach = Math.min(room / 2 + GAP_REACH * beat, (gap.x - before) / 2, (after - gap.x) / 2);
      layer.gaps.push(svgEl('g', { class: 'rhythm__gap', 'data-at': gap.at },
        svgEl('rect', { x: round(gap.x - reach), y: round(top), width: round(reach * 2), height: round(bottom - top), class: 'rhythm__gap-hit' }),
        svgEl('line', { x1: gap.x, x2: gap.x, y1: TOP_LINE - 4, y2: BOTTOM_LINE + 4, class: 'rhythm__gap-line' })));
    });
  }

  return svgEl('svg', {
    viewBox: `0 ${round(top)} ${round(width)} ${round(bottom - top)}`,
    class: 'rhythm',
    style: `max-width:${Math.round(width * MAX_SCALE)}px`,
    role: 'img',
    'aria-label': label,
  }, ...parts, ...layer.lines, ...layer.marks, ...layer.notes, ...layer.gaps);
}

// ---------- Sums of durations ----------

// a quarter's strip under a note of a sum, and the room a sign takes
const SUM_CELL = 10;
const SIGN_WIDTH = 13;
// how far a note reaches to the left and to the right of the middle of its
// head: the stem stands on the right, the flag of an eighth sticks out further
const REACH = { w: [7.6, 7.6], h: [HEAD_RX, HEAD_RX], q: [HEAD_RX, HEAD_RX], e: [HEAD_RX, 13.2] };

/**
 * Single notes in a row with a sign between every two, "♩ + ♩" or
 * "𝅗𝅥 − ♪ − ♪", for sums of durations. With `cells`, a strip under every note
 * as long as it lasts, a cell for a quarter, so that a sum can be counted.
 * It is a picture only: the notes of a sum don't play.
 */
export function renderSum(tokens, { sign = '+', cells = false, label = 'Сумма длительностей' } = {}) {
  const parts = [];
  let x = 0;
  tokens.forEach((token, i) => {
    if (i) {
      parts.push(svgEl('text', { x: x + SIGN_WIDTH / 2, y: NOTE_Y - 3, class: 'rhythm__sign' }, sign));
      x += SIGN_WIDTH;
    }
    const length = TOKEN_LENGTH[token];
    const [toLeft, toRight] = REACH[token];
    const strips = Math.max(1, length);
    const strip = Math.min(1, length) * SUM_CELL;
    const slot = Math.max(toLeft + toRight, cells ? strips * strip : 0) + 4;
    const middle = x + slot / 2;
    parts.push(...noteShape(token, middle - (toRight - toLeft) / 2));
    if (cells) {
      const left = middle - (strips * strip) / 2;
      for (let b = 0; b < strips; b++) {
        parts.push(svgEl('rect', {
          x: round(left + b * strip + 1), y: NOTE_Y + 12, width: strip - 2, height: 7, rx: 2.5, class: 'rhythm__cell',
        }));
      }
    }
    x += slot;
  });
  const bottom = cells ? NOTE_Y + 23 : NOTE_Y + 8;
  return svgEl('svg', {
    viewBox: `0 ${STEM_TOP - 3} ${round(x)} ${bottom - STEM_TOP + 3}`,
    class: 'rhythm rhythm--sum',
    role: 'img',
    'aria-label': label,
  }, ...parts);
}

/**
 * One note on its own, centred in a box of the same size for every duration,
 * so that answer buttons line up. With `cells`, a strip under it as long as
 * the note lasts, split into quarters (the whole note gets four).
 */
export function noteGlyph(token, { cells = false, label = null } = {}) {
  const width = 64;
  const x = width / 2 - (token === 'w' ? 0 : STEM_DX / 2);
  const parts = noteShape(token, x);
  const group = svgEl('g', { class: 'rhythm__note', 'data-start': 0, 'data-length': TOKEN_LENGTH[token], 'data-strong': '' }, parts);
  const extras = [];
  if (cells) {
    const unit = 14;
    const length = TOKEN_LENGTH[token];
    const total = length * unit;
    const left = width / 2 - total / 2;
    for (let b = 0; b < Math.max(1, length); b++) {
      const w = Math.min(1, length) * unit;
      extras.push(svgEl('rect', {
        x: left + b * unit + 1,
        y: NOTE_Y + 12,
        width: w - 2,
        height: 7,
        rx: 2.5,
        class: 'rhythm__cell',
        'data-lit': lit(b, Math.min(1, length)),
      }));
    }
  }
  const bottom = cells ? NOTE_Y + 23 : NOTE_Y + 8;
  return svgEl('svg', {
    viewBox: `0 ${STEM_TOP - 3} ${width} ${bottom - STEM_TOP + 3}`,
    class: 'rhythm rhythm--glyph',
    role: 'img',
    'aria-label': label || 'Нота',
  }, group, ...extras);
}

// ---------- Playing ----------

// a quarter lasts this long, seconds: a calm walking pace
const BEAT_SECONDS = 0.6;
// The first beat of a bar against the others: about four times louder
// (+12 dB), so "ТА та та" is heard at once. The recordings are a single
// velocity, so loudness is all there is to an accent; 2.6 still leaves the
// loudest key below clipping.
const STRONG_VOLUME = 2.6;
const WEAK_VOLUME = 0.6;
const LEAD = 0.12;
let stopCurrent = null;

/** Stops the rhythm that is playing, if any: sound and lights. */
export function stopRhythm() {
  if (stopCurrent) stopCurrent();
  stopCurrent = null;
}

/**
 * Plays every note inside `root` (a picture or a block of them) on one piano
 * key, louder on the first beat of a bar, and lights up each note and each
 * element with data-lit="start,length[;start,length…]" while it lasts.
 * The music starts at the earliest note inside `root`, so one row of a longer
 * piece plays from its own beginning. Only one rhythm plays at a time.
 */
export async function playRhythm(root, { beat = BEAT_SECONDS, onEnd = null } = {}) {
  stopRhythm();
  const timers = [];
  const keys = [];
  const litNow = new Set();
  let stopped = false;

  const finish = () => {
    timers.forEach(clearTimeout);
    litNow.forEach((node) => node.classList.remove('is-on'));
    root.classList.remove('is-playing');
  };
  const stop = () => {
    stopped = true;
    finish();
    keys.forEach((key) => key.then((release) => release()));
  };
  stopCurrent = stop;

  // the first tap may still be downloading the piano: start the lights
  // together with the sound, not before it
  await loadPiano();
  if (stopped) return;

  const notes = [...root.querySelectorAll('.rhythm__note')];
  if (!notes.length) return;
  const from = Math.min(...notes.map((node) => Number(node.dataset.start)));
  let last = 0;

  const light = (node, start, length) => {
    const on = (LEAD + (start - from) * beat) * 1000;
    const off = on + length * beat * 1000 - 40;
    timers.push(setTimeout(() => {
      node.classList.add('is-on');
      litNow.add(node);
    }, on));
    timers.push(setTimeout(() => {
      node.classList.remove('is-on');
      litNow.delete(node);
    }, off));
  };

  root.classList.add('is-playing');
  for (const node of notes) {
    const start = Number(node.dataset.start);
    const length = Number(node.dataset.length);
    keys.push(playPiano(PITCH, {
      delay: LEAD + (start - from) * beat,
      // a short gap before the next note, so repeated notes don't merge
      duration: Math.max(0.12, length * beat - 0.07),
      volume: node.hasAttribute('data-strong') ? STRONG_VOLUME : WEAK_VOLUME,
    }));
    light(node, start, length);
    last = Math.max(last, start + length);
  }
  for (const node of root.querySelectorAll('[data-lit]')) {
    for (const span of node.dataset.lit.split(';')) {
      const [start, length] = span.split(',').map(Number);
      light(node, start, length);
    }
  }

  timers.push(setTimeout(() => {
    if (stopCurrent === stop) stopCurrent = null;
    finish();
    if (onEnd) onEnd();
  }, (LEAD + (last - from) * beat) * 1000 + 200));
}
