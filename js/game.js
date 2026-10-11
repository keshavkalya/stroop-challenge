// game.js — game state, question generation, timer, scoring and screens.
// Depends on (loaded first): GSAP (optional), data.js, audio.js (Sound), effects.js (Effects).

// ---------------------------------------------------------------
// 1. STATE — one object holds everything that changes during a round
// ---------------------------------------------------------------
const state = {
  level: 'medium',
  questions: [],      // [{ word, ink, options }]
  index: 0,           // current question number (0-based)
  score: 0,
  streak: 0,
  bestStreak: 0,
  answers: [],        // [{ word, ink, chosen, correct, reactionMs }]
  endTime: 0,         // timestamp (performance.now) when time runs out
  questionShownAt: 0, // timestamp, used to measure reaction time
  timerId: null,      // requestAnimationFrame id
  locked: false,      // true while answers are ignored
  roundId: 0,         // increases every round, so old timeouts can be ignored
  playing: false,     // true only between the countdown and endGame()
};

// ---------------------------------------------------------------
// 2. DOM REFERENCES — looked up once, reused everywhere
// ---------------------------------------------------------------
const $ = (id) => document.getElementById(id);

const screens = document.querySelectorAll('.screen');
const els = {
  levelPicker: $('level-picker'),
  startBest: $('start-best'),
  demoWord: $('demo-word'),
  demoAnswer: $('demo-answer'),
  countdownNumber: $('countdown-number'),
  hudQuestion: $('hud-question'),
  hudScore: $('hud-score'),
  hudStreak: $('hud-streak'),
  hudTime: $('hud-time'),
  timerBar: $('timer-bar'),
  word: $('word'),
  answers: $('answers'),
  resultScore: $('result-score'),
  resultRating: $('result-rating'),
  resultNewBest: $('result-new-best'),
  statAccuracy: $('stat-accuracy'),
  statReaction: $('stat-reaction'),
  statStreak: $('stat-streak'),
  statBest: $('stat-best'),
  reviewList: $('review-list'),
  shareFeedback: $('share-feedback'),
  resultTotal: $('result-total'),
  ringFill: $('ring-fill'),
  ratingIcon: $('rating-icon'),
  muteButton: $('btn-mute'),
  muteIcon: $('mute-icon'),
  card: $('app'),
  resultBrain: $('result-brain'),
  toast: $('toast'),
  review: $('review'),
  timerTrack: document.querySelector('.timer-track'),
};

// ---------------------------------------------------------------
// 3. SMALL HELPERS
// ---------------------------------------------------------------

// Returns the first N colours for the level (easy/medium: 4, hard: 6).
function getPalette(level) {
  return COLORS.slice(0, LEVELS[level].colors);
}

// Picks one random element from an array.
function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Fisher–Yates shuffle: returns a NEW shuffled array (original is untouched).
function shuffle(arr) {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Best score is stored per level. localStorage can throw in private mode,
// so every access is wrapped in try/catch and the game still works without it.
function getBest(level) {
  try {
    const value = localStorage.getItem('stroop-best-' + level);
    return value === null ? null : Number(value);
  } catch (error) {
    return null;
  }
}

function saveBest(level, score) {
  try {
    localStorage.setItem('stroop-best-' + level, String(score));
  } catch (error) {
    // Ignore: the game works, the best score just isn't remembered.
  }
}

// Shows a best score, or "–" when there is none yet.
function formatBest(level) {
  const best = getBest(level);
  return best === null ? '–' : best + '/' + LEVELS[level].questions;
}

// ---------------------------------------------------------------
// 3b. ICONS, TITLE, MUTE BUTTON
// ---------------------------------------------------------------

// Returns an <svg> string for an icon name from ICONS (data.js).
function iconSvg(name) {
  return '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">' + ICONS[name] + '</svg>';
}

// Fills every <span data-icon="..."> in the HTML with its SVG.
function renderStaticIcons() {
  document.querySelectorAll('[data-icon]').forEach((el) => {
    el.innerHTML = iconSvg(el.dataset.icon);
  });
}

// Wraps every letter of the title in its own <span>, so GSAP can animate
// the letters one by one. (The colours come from CSS.)
function buildTitle() {
  let colorIndex = 0;
  document.querySelectorAll('.title-line').forEach((line) => {
    line.textContent = '';
    line.dataset.text.split('').forEach((char) => {
      const span = document.createElement('span');
      span.className = 'title-letter';
      span.textContent = char;
      span.style.animationDelay = (colorIndex * 50) + 'ms'; // used by the no-GSAP fallback
      colorIndex++;
      line.appendChild(span);
    });
  });
}

// Returns the brain illustration as an <svg> string (shape data is in BRAIN, data.js).
// `litCount` = how many of the 10 neurons are lit.
function brainSvg(litCount) {
  const hemisphere =
    '<path class="brain-outline" d="' + BRAIN.outline + '"/>' +
    BRAIN.folds.map((d) => '<path class="brain-fold" d="' + d + '"/>').join('');

  const nodes = BRAIN.nodes.map((point, i) => {
    const lit = i < litCount ? ' lit' : '';
    // Each neuron pulses a little later than the one before it.
    return '<circle class="brain-node' + lit + '" cx="' + point[0] + '" cy="' + point[1] +
      '" r="5" style="animation-delay:' + (i * 0.25) + 's"/>';
  }).join('');

  // The right hemisphere is the left one flipped around the middle (x = 100).
  return '<svg class="brain" viewBox="' + BRAIN.viewBox + '" aria-hidden="true">' +
    '<g>' + hemisphere + '</g>' +
    '<g transform="translate(200 0) scale(-1 1)">' + hemisphere + '</g>' +
    nodes + '</svg>';
}

// Draws a fully lit, gently pulsing brain into every [data-brain] element.
function renderBrains() {
  document.querySelectorAll('[data-brain]').forEach((el) => {
    el.innerHTML = brainSvg(BRAIN.nodes.length);
    el.firstElementChild.classList.add('alive');
  });
}

// The mute state itself lives in audio.js (Sound). Here we only draw the icon.
function renderMuteButton() {
  const muted = Sound.isMuted();
  els.muteIcon.innerHTML = iconSvg(muted ? 'volume-off' : 'volume-on');
  els.muteButton.setAttribute('aria-pressed', String(muted));
  els.muteButton.setAttribute('aria-label', muted ? 'Unmute sound' : 'Mute sound');
}

function toggleMute() {
  Sound.toggleMute();
  renderMuteButton();
}

// ---------------------------------------------------------------
// 4. ANIMATION HELPERS (GSAP, with CSS fallback + reduced motion)
// ---------------------------------------------------------------
// Rule used everywhere below:
//   1. GSAP missing         -> add a CSS class that plays a CSS keyframe animation
//   2. reduced motion is on -> plain, short fades only (no movement)
//   3. otherwise            -> the full GSAP animation
const hasGsap = typeof window.gsap !== 'undefined';
const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
if (!hasGsap) document.documentElement.classList.add('no-gsap');

function motionAllowed() {
  return !reducedMotionQuery.matches;
}

// Restarts a CSS animation class (used by the no-GSAP fallback).
function replayClass(el, className) {
  el.classList.remove(className);
  void el.offsetWidth; // reading offsetWidth forces a reflow, so the animation can restart
  el.classList.add(className);
}

// New word pops in: scale 0.6 -> 1 with a little overshoot, ~220 ms.
function animateWordIn() {
  if (hasGsap) {
    gsap.killTweensOf(els.word);
    if (motionAllowed()) {
      gsap.fromTo(els.word,
        { scale: 0.6, opacity: 0, x: 0 },
        { scale: 1, opacity: 1, duration: 0.22, ease: 'back.out(1.7)', clearProps: 'transform,opacity' });
    } else {
      gsap.fromTo(els.word, { opacity: 0 }, { opacity: 1, duration: 0.15, clearProps: 'opacity' });
    }
  } else if (motionAllowed()) {
    replayClass(els.word, 'fb-pop');
  }
}

// Answer buttons slide up one after another.
function animateAnswersIn() {
  if (!hasGsap) return; // the CSS fallback animates .answer by itself
  const buttons = els.answers.children;
  if (motionAllowed()) {
    gsap.from(buttons, {
      y: 24, opacity: 0, duration: 0.3,
      stagger: { each: 0.04, grid: 'auto' },
      ease: 'back.out(1.4)',
      clearProps: 'transform,opacity',
    });
  } else {
    gsap.from(buttons, { opacity: 0, duration: 0.15, clearProps: 'opacity' });
  }
}

// Wrong answer: the word shakes left and right (~350 ms).
function shakeWord() {
  if (!motionAllowed()) return;
  if (hasGsap) {
    gsap.killTweensOf(els.word);
    gsap.fromTo(els.word, { x: 0 }, {
      keyframes: [
        { x: -14, duration: 0.07 }, { x: 14, duration: 0.07 },
        { x: -10, duration: 0.07 }, { x: 10, duration: 0.07 },
        { x: 0, duration: 0.07 },
      ],
      clearProps: 'transform',
    });
  } else {
    replayClass(els.word, 'fb-shake');
  }
}

// Correct answer: "+1" floats up from the button, the button pops,
// and a particle burst flies out of it.
function celebrateCorrect(buttonEl, inkHex) {
  const buttonRect = buttonEl.getBoundingClientRect();
  Effects.burst(buttonRect.left + buttonRect.width / 2, buttonRect.top + buttonRect.height / 2, inkHex);

  const cardRect = els.card.getBoundingClientRect();
  const plusOne = document.createElement('div');
  plusOne.className = 'plus-one';
  plusOne.textContent = '+1';
  plusOne.style.left = (buttonRect.left + buttonRect.width / 2 - cardRect.left) + 'px';
  plusOne.style.top = (buttonRect.top - cardRect.top) + 'px';
  els.card.appendChild(plusOne);

  if (hasGsap && motionAllowed()) {
    gsap.to(plusOne, { y: -70, opacity: 0, duration: 0.8, ease: 'power1.out', onComplete: () => plusOne.remove() });
    gsap.fromTo(buttonEl, { scale: 1.1 }, { scale: 1, duration: 0.4, ease: 'back.out(2)', clearProps: 'transform' });
  } else {
    setTimeout(() => plusOne.remove(), 500);
  }
}

// Streak toast: shown at 3, 5 and 7 correct answers in a row.
const STREAK_TOASTS = {
  3: { text: 'On fire!', icon: 'flame' },
  5: { text: 'Unstoppable!', icon: 'bolt' },
  7: { text: 'Legendary!', icon: 'star' },
};
let toastTimeoutId = null;

function showStreakToast(streak) {
  const info = STREAK_TOASTS[streak];
  if (!info) return;

  els.toast.innerHTML = iconSvg(info.icon) + '<span>' + info.text + '</span>';
  els.toast.classList.add('show');
  clearTimeout(toastTimeoutId);

  if (hasGsap && motionAllowed()) {
    gsap.killTweensOf(els.toast);
    gsap.fromTo(els.toast,
      { y: 16, scale: 0.8, opacity: 0 },
      { y: 0, scale: 1, opacity: 1, duration: 0.3, ease: 'back.out(1.7)' });
    gsap.to(els.toast, { opacity: 0, duration: 0.25, delay: 1.2 });
  }
  toastTimeoutId = setTimeout(hideToast, 1600);
}

function hideToast() {
  clearTimeout(toastTimeoutId);
  if (hasGsap) gsap.killTweensOf(els.toast);
  els.toast.classList.remove('show');
  if (hasGsap) gsap.set(els.toast, { clearProps: 'transform,opacity' });
}

// Title letters drop in with a stagger, then float gently forever.
function startTitleAnimation() {
  if (!hasGsap || !motionAllowed()) return;
  const letters = document.querySelectorAll('.title-letter');
  gsap.killTweensOf(letters);
  gsap.from(letters, {
    y: -80, opacity: 0, duration: 0.6, stagger: 0.05, ease: 'back.out(1.7)',
    onComplete: () => {
      gsap.to(letters, {
        y: -6, duration: 1.4, ease: 'sine.inOut', yoyo: true, repeat: -1,
        stagger: 0.08, // each letter starts slightly later, so they float in a wave
      });
    },
  });
}

function stopTitleAnimation() {
  if (!hasGsap) return;
  const letters = document.querySelectorAll('.title-letter');
  gsap.killTweensOf(letters);
  gsap.set(letters, { clearProps: 'transform,opacity' });
}

// Countdown number scales in from 2x and fades in.
function animateCountdownNumber() {
  if (hasGsap) {
    gsap.killTweensOf(els.countdownNumber);
    if (motionAllowed()) {
      gsap.fromTo(els.countdownNumber,
        { scale: 2, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.45, ease: 'power2.out', clearProps: 'transform,opacity' });
    } else {
      gsap.fromTo(els.countdownNumber, { opacity: 0 }, { opacity: 1, duration: 0.15, clearProps: 'opacity' });
    }
  } else if (motionAllowed()) {
    replayClass(els.countdownNumber, 'fb-pop');
  }
}

// ---------------------------------------------------------------
// 4b. SCREENS
// ---------------------------------------------------------------

// Switches screens: old one fades out and moves up 10px (250 ms),
// new one fades in from below (350 ms). `onShown` runs when the new
// screen is visible — used so the timer never starts on a hidden screen.
function showScreen(id, onShown) {
  const next = $(id);
  const current = document.querySelector('.screen.active');

  if (id !== 'screen-start') stopTitleAnimation();

  // No GSAP, first screen, or same screen: switch instantly (CSS may animate it).
  if (!hasGsap || !current || current === next) {
    screens.forEach((screen) => screen.classList.remove('active'));
    next.classList.add('active');
    if (id === 'screen-start') startTitleAnimation();
    if (onShown) onShown();
    return;
  }

  const distance = motionAllowed() ? 10 : 0; // reduced motion: fade only
  gsap.killTweensOf(screens);
  gsap.set(screens, { clearProps: 'transform,opacity' });

  gsap.to(current, {
    opacity: 0, y: -distance, duration: 0.25, ease: 'power2.out',
    onComplete: () => {
      current.classList.remove('active');
      gsap.set(current, { clearProps: 'transform,opacity' });
      next.classList.add('active');
      if (id === 'screen-start') startTitleAnimation();
      gsap.fromTo(next,
        { opacity: 0, y: distance },
        { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out', clearProps: 'transform,opacity' });
      if (onShown) onShown();
    },
  });
}

// ---------------------------------------------------------------
// 5. QUESTION GENERATION
// ---------------------------------------------------------------

// Builds one question. The ink colour is NEVER the same as the word
// (that is what creates the Stroop conflict), and we avoid repeating
// the exact word/ink pair of the previous question.
function createQuestion(palette, previous) {
  let word;
  let ink;
  do {
    word = randomItem(palette);
    ink = randomItem(palette);
  } while (
    ink.name === word.name ||
    (previous && previous.word.name === word.name && previous.ink.name === ink.name)
  );

  return { word, ink, options: shuffle(palette) };
}

// Creates every question of the round up front.
function buildQuestions(level) {
  const palette = getPalette(level);
  const questions = [];
  for (let i = 0; i < LEVELS[level].questions; i++) {
    const previous = questions[questions.length - 1] || null;
    questions.push(createQuestion(palette, previous));
  }
  return questions;
}

// ---------------------------------------------------------------
// 6. GAME FLOW
// ---------------------------------------------------------------

// Resets the state, runs the 3-2-1-GO countdown, then starts playing.
function startGame() {
  state.roundId++;
  hideToast();
  state.questions = buildQuestions(state.level);
  state.index = 0;
  state.score = 0;
  state.streak = 0;
  state.bestStreak = 0;
  state.answers = [];
  state.locked = true;
  state.playing = false;

  updateHud();
  showScreen('screen-countdown');
  runCountdown(['3', '2', '1', 'GO!'], beginPlaying);
}

// Shows "3, 2, 1, GO!" with a beep for each. 1 s per number, 0.6 s for GO.
function runCountdown(steps, onDone) {
  let step = 0;

  function showStep() {
    const label = steps[step];
    els.countdownNumber.textContent = label;
    animateCountdownNumber();
    if (label === 'GO!') Sound.goBeep(); else Sound.countdownBeep();

    setTimeout(() => {
      step++;
      if (step >= steps.length) onDone();
      else showStep();
    }, label === 'GO!' ? 600 : 1000);
  }
  showStep();
}

// Called when the countdown ends. The clock only starts once the game
// screen is really visible, so no time is lost during the fade.
function beginPlaying() {
  showScreen('screen-game', () => {
    state.playing = true;
    renderQuestion();
    startTimer();
  });
}

// Timestamp-based timer: the remaining time is computed from endTime,
// so it stays accurate even if the tab is in the background.
function startTimer() {
  const totalMs = LEVELS[state.level].time * 1000;
  state.endTime = performance.now() + totalMs;
  els.timerBar.style.transform = 'scaleX(1)';
  els.timerTrack.classList.remove('urgent');
  els.hudTime.classList.remove('hud-time-urgent');

  function tick() {
    const remainingMs = Math.max(0, state.endTime - performance.now());
    const fraction = remainingMs / totalMs;

    els.timerBar.style.transform = 'scaleX(' + fraction + ')';
    els.timerBar.style.background = timerColor(fraction);
    els.hudTime.textContent = (remainingMs / 1000).toFixed(1) + 's';

    // Last 5 seconds: the bar pulses and the time turns red (CSS does the pulsing).
    const urgent = remainingMs <= 5000;
    els.timerTrack.classList.toggle('urgent', urgent);
    els.hudTime.classList.toggle('hud-time-urgent', urgent);

    if (remainingMs <= 0) {
      endGame();
      return;
    }
    state.timerId = requestAnimationFrame(tick);
  }
  state.timerId = requestAnimationFrame(tick);
}

// Green while there is plenty of time, yellow at 50%, red at 25%.
function timerColor(fraction) {
  if (fraction > 0.5) return 'var(--brand)';
  if (fraction > 0.25) return 'var(--warning)';
  return 'var(--danger)';
}

// Draws the current question: the word, and the answer buttons.
function renderQuestion() {
  const question = state.questions[state.index];
  const style = LEVELS[state.level].buttonStyle;

  // The word's TEXT is `word`, but its INK colour is `ink`. That's the trick.
  els.word.textContent = question.word.name;
  els.word.style.color = question.ink.hex;

  els.answers.innerHTML = '';
  question.options.forEach((option, position) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'answer';
    button.dataset.color = option.name; // read by the click handler

    // Small key hint in the corner (keys 1–6)
    const key = document.createElement('span');
    key.className = 'key';
    key.textContent = position + 1;
    button.appendChild(key);

    if (style === 'swatch') {
      // Easy: colour dot + name. Colour is never the only cue (colour-blind friendly).
      const dot = document.createElement('span');
      dot.className = 'dot';
      dot.style.background = option.hex;
      button.appendChild(dot);
      button.append(option.name);
    } else if (style === 'tricky') {
      // Hard: name written in a different random ink, so buttons lie too.
      const fakeInk = randomItem(COLORS.filter((c) => c.name !== option.name));
      const label = document.createElement('span');
      label.textContent = option.name;
      label.style.color = fakeInk.hex;
      button.appendChild(label);
    } else {
      // Medium: plain white name.
      button.append(option.name);
    }

    els.answers.appendChild(button);
  });

  animateWordIn();
  animateAnswersIn();

  state.locked = false;
  state.questionShownAt = performance.now();
  updateHud();
}

// Handles one answer (from a click or a number key).
function handleAnswer(colorName, buttonEl) {
  if (state.locked || !state.playing) return; // ignore double taps / mashing
  state.locked = true;

  const question = state.questions[state.index];
  const correct = colorName === question.ink.name;
  const reactionMs = performance.now() - state.questionShownAt;

  if (correct) {
    state.score++;
    state.streak++;
    state.bestStreak = Math.max(state.bestStreak, state.streak);
    Sound.correct();
    if (buttonEl) celebrateCorrect(buttonEl, question.ink.hex);
    showStreakToast(state.streak);
  } else {
    state.streak = 0;
    Sound.wrong();
    shakeWord();
  }

  state.answers.push({
    word: question.word.name,
    ink: question.ink.name,
    chosen: colorName,
    correct,
    reactionMs,
  });

  // Visual feedback: chosen button green/red; on a miss, also reveal the right one.
  if (buttonEl) buttonEl.classList.add(correct ? 'correct' : 'wrong');
  if (!correct) {
    const rightButton = els.answers.querySelector('[data-color="' + question.ink.name + '"]');
    if (rightButton) rightButton.classList.add('correct');
  }
  updateHud();

  // Wait a moment, then move on. The roundId check makes sure a leftover
  // timeout from an old round can never skip a question in a new one.
  const roundId = state.roundId;
  setTimeout(() => {
    if (roundId === state.roundId) nextQuestion();
  }, ANSWER_LOCK_MS);
}

// Moves on to the next question, or ends the round after the last one.
function nextQuestion() {
  if (!state.playing) return; // the timer may have ended the game during the pause
  state.index++;
  if (state.index >= state.questions.length) {
    endGame();
  } else {
    renderQuestion();
  }
}

// Updates the numbers in the top bar.
function updateHud() {
  const total = state.questions.length || LEVELS[state.level].questions;
  const shown = Math.min(state.index + 1, total);
  els.hudQuestion.textContent = shown + '/' + total;
  els.hudScore.textContent = state.score;
  els.hudStreak.textContent = state.streak;
}

// Ends the round (timer ran out OR last question answered).
function endGame() {
  if (!state.playing) return; // already ended
  state.playing = false;
  state.locked = true;
  cancelAnimationFrame(state.timerId);

  // Every question without an answer counts as "time up".
  for (let i = state.answers.length; i < state.questions.length; i++) {
    const question = state.questions[i];
    state.answers.push({
      word: question.word.name,
      ink: question.ink.name,
      chosen: null,
      correct: false,
      reactionMs: null,
    });
  }

  // Compare with the old best BEFORE saving the new one.
  const previousBest = getBest(state.level);
  const isNewBest = state.score > 0 && (previousBest === null || state.score > previousBest);
  if (isNewBest) saveBest(state.level, state.score);

  els.timerTrack.classList.remove('urgent');
  hideToast();

  renderResult(isNewBest);
  showScreen('screen-result', () => {
    Sound.fanfare();
    animateResult();
    if (isNewBest) Effects.confetti();
  });
}

// Score ring fills and the number counts up (1.2 s, power3.out).
function animateResult() {
  const total = state.questions.length;
  const target = state.score;

  // One neuron lights up for every point, one after another.
  els.resultBrain.querySelectorAll('.brain-node').forEach((node, i) => {
    if (i >= target) return;
    node.style.transitionDelay = (motionAllowed() ? 200 + i * 110 : 0) + 'ms';
    node.classList.add('lit');
  });
  els.resultBrain.firstElementChild.classList.add('alive');

  if (hasGsap && motionAllowed() && target > 0) {
    const counter = { value: 0 };
    setRing(0);
    els.resultScore.textContent = '0';
    gsap.to(counter, {
      value: target, duration: 1.2, ease: 'power3.out',
      onUpdate: () => {
        setRing(counter.value / total);
        els.resultScore.textContent = Math.round(counter.value);
      },
    });
  } else {
    setRing(target / total);
    els.resultScore.textContent = target;
  }
}

// ---------------------------------------------------------------
// 7. RESULT SCREEN
// ---------------------------------------------------------------

// Text rating based on the score (out of 10).
function getRating(score) {
  if (score >= 10) return { text: 'Brain CEO!', icon: 'crown' };
  if (score >= 8) return { text: 'Sharp focus!', icon: 'bolt' };
  if (score >= 5) return { text: 'Good, keep training!', icon: 'trend' };
  return { text: 'Your brain is warming up!', icon: 'spark' };
}

// Score ring: the circle's stroke is "dashed" with one dash as long as the
// whole circle. Shifting the dash with stroke-dashoffset reveals only part of it.
// offset = full length  -> nothing visible;  offset = 0 -> full ring.
const RING_LENGTH = 2 * Math.PI * 52; // circumference of the r=52 circle

function setRing(fraction) {
  els.ringFill.style.strokeDasharray = RING_LENGTH;
  els.ringFill.style.strokeDashoffset = RING_LENGTH * (1 - fraction);
}

function renderResult(isNewBest) {
  const total = state.questions.length;
  const answered = state.answers.filter((a) => a.chosen !== null);

  // Accuracy = correct answers out of ALL questions (unanswered count as wrong).
  const accuracy = Math.round((state.score / total) * 100);

  // Average reaction only over the questions that were actually answered.
  let averageText = '–';
  if (answered.length > 0) {
    const sum = answered.reduce((acc, a) => acc + a.reactionMs, 0);
    averageText = (sum / answered.length / 1000).toFixed(2) + 's';
  }

  const rating = getRating(state.score);
  els.resultScore.textContent = '0'; // animateResult() counts up to the real score
  els.resultTotal.textContent = '/' + total;
  els.resultRating.textContent = rating.text;
  els.ratingIcon.innerHTML = iconSvg(rating.icon);
  setRing(0);
  els.resultBrain.innerHTML = brainSvg(0); // neurons light up in animateResult()
  els.resultNewBest.hidden = !isNewBest;
  els.statAccuracy.textContent = accuracy + '%';
  els.statReaction.textContent = averageText;
  els.statStreak.textContent = state.bestStreak;
  els.statBest.textContent = formatBest(state.level);
  els.shareFeedback.textContent = '';
  // On a laptop there is room, so the review list starts open.
  els.review.open = window.matchMedia('(min-width: 900px) and (min-height: 600px)').matches;

  // Review list: one row per question.
  els.reviewList.innerHTML = '';
  state.answers.forEach((answer) => {
    const item = document.createElement('li');
    const inkHex = COLORS.find((c) => c.name === answer.ink).hex;

    const wordSpan = document.createElement('span');
    wordSpan.className = 'review-word';
    wordSpan.textContent = answer.word;
    wordSpan.style.color = inkHex; // shown in its ink colour, like in the game

    const detail = document.createElement('span');
    detail.className = 'review-detail';
    if (answer.chosen === null) {
      detail.classList.add('review-timeup');
      detail.innerHTML = iconSvg('clock') + '<span>Time up · ' + answer.ink + '</span>';
    } else if (answer.correct) {
      detail.classList.add('review-ok');
      detail.innerHTML = iconSvg('check') + '<span>' + answer.chosen + '</span>';
    } else {
      detail.classList.add('review-bad');
      detail.innerHTML = iconSvg('cross') + '<span>' + answer.chosen + ' · was ' + answer.ink + '</span>';
    }

    item.append(wordSpan, detail);
    els.reviewList.appendChild(item);
  });
}

// "Challenge a friend": native share sheet if available, else copy to clipboard.
async function shareScore() {
  const total = state.questions.length;
  const text = 'I scored ' + state.score + '/' + total +
    ' on the Stroop Challenge 🧠 Can you beat me? #QuantumBrainGym';

  try {
    if (navigator.share) {
      await navigator.share({ text });
    } else {
      await navigator.clipboard.writeText(text);
      els.shareFeedback.textContent = 'Copied!';
    }
  } catch (error) {
    // User cancelled the share sheet, or clipboard is blocked. Nothing to do.
  }
}

// ---------------------------------------------------------------
// 8. START SCREEN: level picker, best score, live demo
// ---------------------------------------------------------------

// Builds the three level buttons from LEVELS.
function renderLevelPicker() {
  els.levelPicker.innerHTML = '';
  Object.keys(LEVELS).forEach((key) => {
    const level = LEVELS[key];
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'level';
    button.dataset.level = key;
    // Signal bars show the difficulty: 1, 2 or 3 bars lit.
    const barsLit = Object.keys(LEVELS).indexOf(key) + 1;
    let bars = '';
    for (let n = 1; n <= 3; n++) bars += '<i class="' + (n <= barsLit ? 'on' : '') + '"></i>';

    button.innerHTML = '<span class="bars" aria-hidden="true">' + bars + '</span>' +
      level.label +
      '<small>' + level.time + 's · ' + level.colors + ' colours</small>' +
      '<small>Ages ' + level.ages + '</small>';
    els.levelPicker.appendChild(button);
  });
  markSelectedLevel();
}

// Highlights the chosen level and refreshes the best score under it.
function markSelectedLevel() {
  els.levelPicker.querySelectorAll('.level').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.level === state.level));
  });
  els.startBest.textContent = formatBest(state.level);
}

// The demo card cycles through random word/ink pairs every 1.2 s.
let demoPrevious = null;
function updateDemo() {
  const question = createQuestion(COLORS.slice(0, 4), demoPrevious);
  demoPrevious = question;
  els.demoWord.textContent = question.word.name;
  els.demoWord.style.color = question.ink.hex;
  els.demoAnswer.textContent = question.ink.name;
}

// ---------------------------------------------------------------
// 9. EVENT LISTENERS
// ---------------------------------------------------------------
function setupEvents() {
  // Event delegation: ONE listener on the container handles every answer button.
  els.answers.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-color]');
    if (button) handleAnswer(button.dataset.color, button);
  });

  // Level picker (also delegated).
  els.levelPicker.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-level]');
    if (!button) return;
    state.level = button.dataset.level;
    markSelectedLevel();
  });

  $('btn-play').addEventListener('click', startGame);
  $('btn-again').addEventListener('click', startGame);
  $('btn-change').addEventListener('click', () => {
    markSelectedLevel();
    showScreen('screen-start');
  });
  $('btn-share').addEventListener('click', shareScore);
  els.muteButton.addEventListener('click', toggleMute);

  // Browsers only allow audio after a user gesture, so the AudioContext
  // is created on the first press or key (once each).
  document.addEventListener('pointerdown', Sound.unlock, { once: true });
  document.addEventListener('keydown', Sound.unlock, { once: true });

  // Keyboard: keys 1–6 press the answer button at that position.
  document.addEventListener('keydown', (event) => {
    if (!state.playing || state.locked) return;
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
    const position = Number(event.key) - 1;
    const buttons = els.answers.querySelectorAll('button[data-color]');
    if (Number.isInteger(position) && position >= 0 && position < buttons.length) {
      handleAnswer(buttons[position].dataset.color, buttons[position]);
    }
  });
}

// ---------------------------------------------------------------
// 10. INIT
// ---------------------------------------------------------------
renderStaticIcons();
renderBrains();
buildTitle();
renderMuteButton();
renderLevelPicker();
setupEvents();
startTitleAnimation();
updateDemo();
setInterval(updateDemo, 1200);
