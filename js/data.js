// data.js — pure configuration data. No logic lives here.
// Other files read COLORS and LEVELS; they never change them.

// The six game colours. `name` is the word shown on screen,
// `hex` is the ink colour (bright enough to read on the dark background).
// Order matters: an easier level uses only the first N colours.
const COLORS = [
  { name: 'RED',    hex: '#FF4D5E' },
  { name: 'BLUE',   hex: '#4C8DFF' },
  { name: 'GREEN',  hex: '#3DDC84' },
  { name: 'YELLOW', hex: '#FFD43B' },
  { name: 'PINK',   hex: '#FF7AC6' },
  { name: 'ORANGE', hex: '#FF8A2B' },
];

// Difficulty settings.
//   colors      — how many colours are in play
//   time        — seconds for the whole round
//   questions   — words per round
//   buttonStyle — how answer buttons look (see game.js, renderQuestion)
//       swatch : colour dot + name (easiest, you can match by sight)
//       text   : name only, in white (reading triggers the Stroop conflict)
//       tricky : name written in a *different* random ink (double conflict)
const LEVELS = {
  easy:   { label: 'Easy',   ages: '9–12',  colors: 4, time: 30, questions: 10, buttonStyle: 'swatch' },
  medium: { label: 'Medium', ages: '13–15', colors: 4, time: 20, questions: 10, buttonStyle: 'text'   },
  hard:   { label: 'Hard',   ages: '16–19', colors: 6, time: 15, questions: 10, buttonStyle: 'tricky' },
};

// Fixed pause (ms) after every answer: stops double taps, and lets
// the player see whether they were right before the next word.
const ANSWER_LOCK_MS = 350;

// Inline SVG icons (24x24, drawn with strokes so they take the text colour).
// Only the inner shapes are stored here; game.js wraps them in an <svg>.
// Using SVG instead of emoji keeps the look identical on every device.
const ICONS = {
  'volume-on':  '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a10 10 0 0 1 0 14"/>',
  'volume-off': '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>',
  'play':       '<polygon points="6 4 20 12 6 20 6 4"/>',
  'replay':     '<path d="M1 4v6h6"/><path d="M3.5 15a9 9 0 1 0 2.1-9.4L1 10"/>',
  'share':      '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4"/><path d="M15.4 6.5l-6.8 4"/>',
  'levels':     '<path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/><circle cx="9" cy="6" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="7" cy="18" r="2"/>',
  'flame':      '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1.1-2.1-.2-4 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.2.4-2.3 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  'star':       '<polygon points="12 2 15 9 22 9.5 17 14.5 18.5 22 12 18 5.5 22 7 14.5 2 9.5 9 9 12 2"/>',
  'check':      '<path d="M20 6 9 17l-5-5"/>',
  'cross':      '<path d="M18 6 6 18"/><path d="M6 6l12 12"/>',
  'clock':      '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  'crown':      '<path d="M2 18h20"/><path d="M4 18 2 7l6 5 4-8 4 8 6-5-2 11"/>',
  'bolt':       '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>',
  'trend':      '<path d="M22 7 13.5 15.5 8.5 10.5 2 17"/><path d="M16 7h6v6"/>',
  'spark':      '<path d="M12 3v4"/><path d="M12 17v4"/><path d="M3 12h4"/><path d="M17 12h4"/><path d="M5.6 5.6l2.8 2.8"/><path d="M15.6 15.6l2.8 2.8"/><path d="M18.4 5.6l-2.8 2.8"/><path d="M8.4 15.6l-2.8 2.8"/>',
};

// The brain illustration, drawn as line art. One hemisphere is described
// here and mirrored for the other, so both sides always match.
//   outline — the shape of one hemisphere
//   folds   — the wrinkles (gyri) inside it
//   nodes   — 10 "neurons" [x, y]; they are ordered left/right/left/right
//             so that when only some are lit the brain still looks balanced
const BRAIN = {
  viewBox: '0 0 200 150',
  outline: 'M96 18 C80 10 58 12 44 24 C30 36 26 52 30 64 C20 72 18 90 26 102 C30 114 42 122 54 122 C60 134 76 140 88 134 C94 131 96 126 96 120 Z',
  folds: [
    'M44 24 C54 30 58 40 52 50 C46 58 36 58 30 64',
    'M96 40 C84 38 74 44 72 54 C70 66 80 70 78 82',
    'M52 50 C62 52 68 60 64 70 C60 80 48 82 42 78',
    'M26 102 C38 98 48 104 54 114',
    'M78 82 C88 84 94 90 94 100',
    'M54 122 C58 110 68 106 76 112 C84 118 90 116 96 112',
  ],
  nodes: [
    [52, 50], [148, 50], [72, 54], [128, 54], [64, 70],
    [136, 70], [78, 82], [122, 82], [54, 114], [146, 114],
  ],
};
