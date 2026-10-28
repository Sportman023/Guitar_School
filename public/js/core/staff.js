// Drawing a treble clef staff.
//
// Coordinates (one unit = half the distance between staff lines):
//   lines          y = 24, 34, 44, 54, 64  (top to bottom)
//   first (E)      y = 64
//   second (G)     y = 54  — the curl of the treble clef wraps around it
// A note's position comes from its `staff` field in js/data/notes.js. Notes
// outside the five lines hang on ledger lines of their own, above (the top of
// the second octave) and below (middle C and the whole small octave), so how
// big a picture has to be depends on the notes in it — see staffBox.
//
// Two pictures live here:
//   renderStaff    — a staff with a single note (cards and quizzes);
//   renderStaffRow — a long staff with notes in a row, like a ladder.

import { svgEl } from "./ui.js";
import { octaveName, octaveShort } from "../data/notes.js";

const TOP_LINE = 24;
const SPACING = 10;
const BOTTOM_LINE = TOP_LINE + SPACING * 4; // 64 — first line, note E
const G_LINE = TOP_LINE + SPACING * 3; // 54 — second line, note G
const MIDDLE_STEP = 4; // middle line, note B
const MIDDLE_Y = TOP_LINE + SPACING * 2; // 44 — the same line in coordinates
const HEIGHT = 94; // picture with nothing below middle C
const NOTE_ROOM = 13; // room beyond the outermost note head
const NOTE_X = 88;
// the narrow picture (see renderStaff): the note right after the clef, and
// staff lines running on past the edges until a frame around it cuts them
const NARROW = { width: 100, noteX: 68, bleed: 60 };
const HEAD_RX = 6.3;
const HEAD_RY = 4.7;

const ROW_FIRST_X = 64;
const ROW_STEP = 25;

// Classic treble clef, drawn as one filled outline. The outline is the
// public-domain https://commons.wikimedia.org/wiki/File:GClef.svg
// (its own units: 15.186 wide, 40.768 tall).
const CLEF_PATH =
  "m12.049 3.5296c0.305 3.1263-2.019 5.6563-4.0772 7.7014-0.9349 0.897-0.155 0.148-0.6437 0.594-0.1022-0.479-0.2986-1.731-0.2802-2.11 0.1304-2.6939 2.3198-6.5875 4.2381-8.0236 0.309 0.5767 0.563 0.6231 0.763 1.8382zm0.651 16.142c-1.232-0.906-2.85-1.144-4.3336-0.885-0.1913-1.255-0.3827-2.51-0.574-3.764 2.3506-2.329 4.9066-5.0322 5.0406-8.5394 0.059-2.232-0.276-4.6714-1.678-6.4836-1.7004 0.12823-2.8995 2.156-3.8019 3.4165-1.4889 2.6705-1.1414 5.9169-0.57 8.7965-0.8094 0.952-1.9296 1.743-2.7274 2.734-2.3561 2.308-4.4085 5.43-4.0046 8.878 0.18332 3.334 2.5894 6.434 5.8702 7.227 1.2457 0.315 2.5639 0.346 3.8241 0.099 0.2199 2.25 1.0266 4.629 0.0925 6.813-0.7007 1.598-2.7875 3.004-4.3325 2.192-0.5994-0.316-0.1137-0.051-0.478-0.252 1.0698-0.257 1.9996-1.036 2.26-1.565 0.8378-1.464-0.3998-3.639-2.1554-3.358-2.262 0.046-3.1904 3.14-1.7356 4.685 1.3468 1.52 3.833 1.312 5.4301 0.318 1.8125-1.18 2.0395-3.544 1.8325-5.562-0.07-0.678-0.403-2.67-0.444-3.387 0.697-0.249 0.209-0.059 1.193-0.449 2.66-1.053 4.357-4.259 3.594-7.122-0.318-1.469-1.044-2.914-2.302-3.792zm0.561 5.757c0.214 1.991-1.053 4.321-3.079 4.96-0.136-0.795-0.172-1.011-0.2626-1.475-0.4822-2.46-0.744-4.987-1.116-7.481 1.6246-0.168 3.4576 0.543 4.0226 2.184 0.244 0.577 0.343 1.197 0.435 1.812zm-5.1486 5.196c-2.5441 0.141-4.9995-1.595-5.6343-4.081-0.749-2.153-0.5283-4.63 0.8207-6.504 1.1151-1.702 2.6065-3.105 4.0286-4.543 0.183 1.127 0.366 2.254 0.549 3.382-2.9906 0.782-5.0046 4.725-3.215 7.451 0.5324 0.764 1.9765 2.223 2.7655 1.634-1.102-0.683-2.0033-1.859-1.8095-3.227-0.0821-1.282 1.3699-2.911 2.6513-3.198 0.4384 2.869 0.9413 6.073 1.3797 8.943-0.5054 0.1-1.0211 0.143-1.536 0.143z";

// The clef is scaled to about seven staff spaces and placed so that the centre
// of its spiral sits on the second line — the G line, which gives the clef its name.
const CLEF_SCALE = 1.77;
const CLEF_EYE_Y = 25.3; // spiral centre in the outline's own units
const CLEF_LEFT = 10;
const CLEF_TRANSFORM = `translate(${CLEF_LEFT} ${G_LINE - CLEF_EYE_Y * CLEF_SCALE}) scale(${CLEF_SCALE})`;
// how far the clef reaches up and down, and the room a note head needs around
// its centre — for pictures with no room to spare (see tightStaffBox)
const CLEF_TOP = G_LINE - CLEF_EYE_Y * CLEF_SCALE;
const CLEF_BOTTOM = CLEF_TOP + 40.768 * CLEF_SCALE;
const HEAD_ROOM = 6;

export function noteY(note) {
  return BOTTOM_LINE - note.staff * (SPACING / 2);
}

/**
 * The box a picture needs so that these notes fit with their ledger lines:
 * where its top edge is (above the staff the notes go into the minus) and how
 * tall it is. The box is counted for a whole set of notes at once, so that
 * cards or answers standing side by side are all the same size and the staff
 * doesn't jump from one question to the next.
 */
export function staffBox(notes) {
  const top = Math.min(0, ...notes.map((note) => noteY(note) - NOTE_ROOM));
  const bottom = Math.max(
    HEIGHT,
    ...notes.map((note) => noteY(note) + NOTE_ROOM),
  );
  return { top: Math.round(top), height: Math.round(bottom - top) };
}

/**
 * staffBox cut to the bone: just the clef and the note heads with their
 * ledger lines, for small pictures where every pixel counts (the pumpkins of
 * the pumpkin game).
 */
export function tightStaffBox(notes) {
  const top = Math.floor(
    Math.min(CLEF_TOP, ...notes.map((note) => noteY(note) - HEAD_ROOM)) - 1,
  );
  const bottom = Math.ceil(
    Math.max(CLEF_BOTTOM, ...notes.map((note) => noteY(note) + HEAD_ROOM)) + 1,
  );
  return { top, height: bottom - top };
}

/** Five staff lines from x1 to x2 plus the treble clef. */
function staffBase(x1, x2) {
  const parts = [];
  for (let i = 0; i < 5; i++) {
    const y = TOP_LINE + i * SPACING;
    parts.push(svgEl("line", { x1, x2, y1: y, y2: y, class: "staff__line" }));
  }
  parts.push(
    svgEl("path", {
      d: CLEF_PATH,
      transform: CLEF_TRANSFORM,
      class: "staff__clef",
    }),
  );
  return parts;
}

/** One note at x: ledger lines, stem and head. */
function noteParts(note, x, colored) {
  const y = noteY(note);
  const parts = [];
  const ledger = (ly) =>
    svgEl("line", {
      x1: x - 11,
      x2: x + 11,
      y1: ly,
      y2: ly,
      class: "staff__ledger",
    });

  // ledger lines: below the staff (middle C) and above it
  for (let ly = BOTTOM_LINE + SPACING; ly <= y; ly += SPACING)
    parts.push(ledger(ly));
  for (let ly = TOP_LINE - SPACING; ly >= y; ly -= SPACING)
    parts.push(ledger(ly));

  // stem: below the middle line it goes up on the right, from the middle line up it goes down on the left
  const stemUp = note.staff < MIDDLE_STEP;
  const stemX = stemUp ? x + HEAD_RX - 0.8 : x - HEAD_RX + 0.8;
  // a note that hangs on ledger lines keeps its stem as far as the middle
  // line — that's how it is engraved in real music, and the stem ties the
  // note back to the staff
  const stemEnd = stemUp
    ? Math.min(y - 32, MIDDLE_Y)
    : Math.max(y + 32, MIDDLE_Y);
  parts.push(
    svgEl("line", {
      x1: stemX,
      x2: stemX,
      y1: stemUp ? y - 1 : y + 1,
      y2: stemEnd,
      class: "staff__stem",
    }),
  );

  parts.push(
    svgEl("ellipse", {
      cx: x,
      cy: y,
      rx: HEAD_RX,
      ry: HEAD_RY,
      transform: `rotate(-20 ${x} ${y})`,
      class: "staff__head",
      style: colored ? `fill:${note.color}` : "",
    }),
  );

  return parts;
}

/**
 * A staff with one note (or an empty staff when no note is given).
 * colored — paint the note head in its rainbow colour;
 * box — one box for a whole set of pictures (see staffBox);
 * narrow — the note right after the clef, for a small round frame that cuts
 *   the staff lines off at its edge (the pumpkins of the pumpkin game).
 */
export function renderStaff(
  note,
  {
    colored = true,
    extraClass = "",
    box = staffBox(note ? [note] : []),
    narrow = false,
  } = {},
) {
  const width = narrow ? NARROW.width : 126;
  const parts = narrow
    ? staffBase(-NARROW.bleed, width + NARROW.bleed)
    : staffBase(8, width - 8);
  if (note)
    parts.push(...noteParts(note, narrow ? NARROW.noteX : NOTE_X, colored));

  return svgEl(
    "svg",
    {
      viewBox: `0 ${box.top} ${width} ${box.height}`,
      class: `staff ${extraClass}`.trim(),
      role: "img",
      "aria-label": note
        ? `Нота ${note.ru} на нотном стане`
        : "Пустой нотный стан",
    },
    ...parts,
  );
}

/**
 * A long staff with notes in a row, left to right. Notes of the same octave
 * get a labelled bracket underneath. Every note carries data-freq so it can
 * be played on tap (see playableMap).
 */
export function renderStaffRow(
  notes,
  { colored = true, extraClass = "" } = {},
) {
  const xAt = (i) => ROW_FIRST_X + i * ROW_STEP;
  const width = xAt(notes.length - 1) + 22;
  const box = staffBox(notes);
  const bracketY = box.top + box.height - 2; // the brackets pass under the lowest note
  const height = bracketY + 16 - box.top; // and their labels under the brackets
  const parts = staffBase(8, width - 8);

  notes.forEach((note, i) => {
    parts.push(
      svgEl(
        "g",
        {
          class: "staff__note",
          "data-freq": note.freq,
          role: "button",
          "aria-label": `Нота ${note.ru} ${octaveName(note)}`,
        },
        // a transparent full-height strip: a tiny note head is hard to hit with a finger
        svgEl("rect", {
          x: xAt(i) - ROW_STEP / 2,
          y: box.top,
          width: ROW_STEP,
          height,
          class: "staff__hit",
        }),
        ...noteParts(note, xAt(i), colored),
      ),
    );
  });

  for (const octave of new Set(notes.map((n) => n.octave))) {
    const indexes = notes.flatMap((n, i) => (n.octave === octave ? [i] : []));
    const x1 = xAt(indexes[0]) - 9;
    const x2 = xAt(indexes[indexes.length - 1]) + 9;
    parts.push(
      svgEl("path", {
        d: `M${x1} ${bracketY - 5} V${bracketY} H${x2} V${bracketY - 5}`,
        class: "staff__bracket",
      }),
      svgEl(
        "text",
        { x: (x1 + x2) / 2, y: bracketY + 13, class: "staff__bracket-text" },
        `${octaveShort(octave)} октава`,
      ),
    );
  }

  return svgEl(
    "svg",
    {
      viewBox: `0 ${box.top} ${width} ${height}`,
      // never squeeze the notes below their own size: a row that doesn't fit
      // the screen is scrolled sideways instead (see .staff-row in styles.css)
      style: `min-width:${width}px`,
      class: `staff ${extraClass}`.trim(),
      role: "img",
      "aria-label": "Ноты подряд на нотном стане",
    },
    ...parts,
  );
}

/** Tap a note in the row to hear it. One listener for the whole picture. */
export function playableMap(svg, play) {
  svg.addEventListener("click", (event) => {
    const note = event.target.closest("[data-freq]");
    if (note) play(Number(note.dataset.freq));
  });
  return svg;
}
