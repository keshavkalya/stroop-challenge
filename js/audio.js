// audio.js — all sound effects, made with the Web Audio API.
// No audio files: every sound is a short oscillator "beep" built in code.
// Exposes one global object, `Sound`, used by game.js.

const Sound = (function () {
  const STORAGE_KEY = 'stroop-muted';

  let context = null;   // the AudioContext, created lazily (see unlock)
  let muted = false;

  // Load the saved mute choice. localStorage can throw in private mode.
  try {
    muted = localStorage.getItem(STORAGE_KEY) === '1';
  } catch (error) {
    muted = false;
  }

  // Browsers block audio until the user interacts with the page, so the
  // AudioContext is created on the first click / key press (not at load).
  function unlock() {
    if (!context) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return; // very old browser: the game stays silent
      context = new AudioContextClass();
    }
    // Some browsers create the context in a "suspended" state.
    if (context.state === 'suspended') context.resume();
  }

  // Plays one tone.
  //   freq     — pitch in Hz
  //   duration — seconds
  //   type     — 'sine' | 'square' | 'triangle' | 'sawtooth'
  //   volume   — 0 to 1
  //   delay    — seconds from now (lets us chain notes without timers)
  function playTone(freq, duration, type, volume, delay) {
    if (muted || !context) return;
    const start = context.currentTime + (delay || 0);

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type || 'sine';
    oscillator.frequency.value = freq;

    // Fade the volume out quickly. Cutting a tone abruptly makes a "click".
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  return {
    unlock,
    isMuted() { return muted; },

    // Flips the mute state, saves it, and returns the new value.
    toggleMute() {
      muted = !muted;
      try {
        localStorage.setItem(STORAGE_KEY, muted ? '1' : '0');
      } catch (error) {
        // Ignore: the toggle still works for this visit.
      }
      return muted;
    },

    countdownBeep() { playTone(440, 0.15, 'sine', 0.25); },
    goBeep()        { playTone(880, 0.3, 'sine', 0.3); },

    // Two quick rising notes: 660 Hz then 990 Hz.
    correct() {
      playTone(660, 0.1, 'triangle', 0.3, 0);
      playTone(990, 0.16, 'triangle', 0.3, 0.09);
    },

    // Low square-wave buzz.
    wrong() { playTone(160, 0.3, 'square', 0.2); },

    // 4-note arpeggio (C major) for the result screen.
    fanfare() {
      [523, 659, 784, 1047].forEach((freq, i) => {
        playTone(freq, 0.25, 'triangle', 0.28, i * 0.12);
      });
    },
  };
})();
