# Stroop Challenge

> **The rule:** a colour word (e.g. **RED**) is shown in a *different* ink colour (e.g. blue).
> Tap the **ink colour**, not the word you read.

*Source: Quantum Brain Gym → Gym 1: Prefrontal Cortex → Video Puzzle 3.*

<!-- Screenshot placeholder: add screenshots/start.png, screenshots/game.png, screenshots/result.png -->
`[ screenshot: start screen ]`  `[ screenshot: game screen ]`  `[ screenshot: result screen ]`

## How to run

```bash
python3 -m http.server 5500
```

Then open **http://localhost:5500**.

On a phone (same Wi-Fi): find your Mac's IP with `ipconfig getifaddr en0` and open `http://<that-ip>:5500`.

The game works offline. Only the Google Fonts need internet, and system fonts are the fallback.
GSAP is saved locally in `lib/`.

## Design: "Neural Lab"

A dark neuroscience-lab look with one brand colour, so nothing competes with the game colours.

| Part | Choice |
|---|---|
| Palette | Deep teal-black surfaces, one brand colour (neural cyan `#22D3EE`), mint for correct, amber for streaks |
| Game inks | RED, BLUE, GREEN, YELLOW, PINK, ORANGE (the only loud colours on screen) |
| Fonts | Exo 2 (headings and the big word), Nunito (text), Roboto Mono (HUD numbers and labels) |
| Brain | Line-art SVG drawn from `BRAIN` in `data.js`; 10 neurons light up, one per point scored |
| Background | Canvas neural network: drifting neurons joined by faint synapse lines |

## Layouts

| Screen | Layout |
|---|---|
| Phone (< 900px wide) | One 9:16 "Reel" card; full-screen below 480px |
| Laptop (≥ 900px wide) | Wide landscape card: two columns on Start and Result, answers in one row |

## Tech used

- **HTML5**: semantic `<main>`, `<section>`, `<header>`, `<button>`, `<details>`; Canvas for visual effects
- **CSS3**: custom properties (design tokens), grid, flexbox, keyframes, `aspect-ratio`, `clamp()`,
  media queries (`prefers-reduced-motion`, `hover`, width/height)
- **JavaScript ES6**: files as modules (plain globals), event delegation, `requestAnimationFrame`,
  Web Audio API, `localStorage`, `async/await` (share button)
- **GSAP 3** for animations, with a CSS fallback if it fails to load

## Files

```
index.html        all screens as <section> elements
css/style.css     design tokens, layout (phone + laptop), CSS animations
js/data.js        COLORS, LEVELS, ICONS — pure data, no logic
js/audio.js       Sound: Web Audio beeps + mute (no audio files)
js/effects.js     Effects: background dots, particle burst, confetti (canvas)
js/game.js        state, questions, timer, scoring, animations, screens
lib/gsap.min.js   GSAP 3.12.5 (local copy)
```

## How it works

### Flow

```
START  →  COUNTDOWN (3-2-1-GO)  →  GAME (10 questions)  →  RESULT
  ↑                                                          │
  └──────────────── Change level ←──── Play again ───────────┘
```

### The state object

One object holds everything that changes during a round:

```js
const state = {
  level, questions, index, score, streak, bestStreak,
  answers, endTime, questionShownAt, timerId, locked, playing, roundId
};
```

### Key functions (`game.js`)

| Function | What it does |
|---|---|
| `getPalette(level)` | The first N colours for the level (4 or 6) |
| `randomItem(arr)` / `shuffle(arr)` | Helpers; `shuffle` is Fisher–Yates |
| `createQuestion(palette, previous)` | Picks a word, then an ink that is **never** the same; avoids repeating the previous pair |
| `buildQuestions(level)` | Creates all 10 questions up front |
| `startGame()` | Resets state, runs the countdown |
| `beginPlaying()` | After the countdown: shows the game screen, then renders question 1 and starts the timer |
| `startTimer()` | `requestAnimationFrame` loop; remaining time = `endTime - now`, so it stays accurate in background tabs |
| `renderQuestion()` | Shows the word in its ink colour, builds the answer buttons for the level style |
| `handleAnswer(color, btn)` | Ignored if locked. Checks `color === question.ink.name`, updates score/streak, plays feedback, moves on after 350 ms |
| `nextQuestion()` | `index++`, then next question or `endGame()` |
| `endGame()` | Stops the timer, marks unanswered as "time up", saves best score, shows results |
| `getBest` / `saveBest` | `localStorage` wrapped in `try/catch` |
| `showScreen(id, onShown)` | Fade/slide transition between screens |

### Edge cases handled

- Timer reaches 0 mid-question → game ends immediately, the rest count as "Time up".
- Double taps / key mashing → ignored while `state.locked`.
- Switching tabs → timer uses timestamps, so it stays correct.
- `localStorage` blocked (private mode) → the game still works and the best score shows "–".
- GSAP missing → CSS keyframe animations take over (`.no-gsap` class).
- `prefers-reduced-motion` → no drift, bursts, confetti or movement; short fades only.

## Brain science

Reading is automatic: the brain reads the word faster and without effort than it names the ink colour.
When the word and the ink disagree, you have to **inhibit** the automatic response and answer with the
slower, controlled one. That conflict is the **Stroop effect**. The prefrontal cortex (the "CEO" of the
brain) handles this impulse control, attention and cognitive flexibility, so practising it is a mini
workout for those skills.

## Future ideas

- More "gyms" using the same engine (memory, focus, speed)
- A leaderboard
- Multiplayer / head-to-head challenge
- Progress tracking over days and weeks
