// effects.js — canvas visuals: a drifting neural-network background, particle bursts
// and confetti. Exposes one global object, `Effects`.
// Two full-screen canvases are used:
//   #bg-canvas — the background dots (behind the game card)
//   #fx-canvas — bursts and confetti (on top of everything, ignores clicks)

const Effects = (function () {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const dpr = Math.min(window.devicePixelRatio || 1, 2); // cap to keep it light

  const bgCanvas = document.getElementById('bg-canvas');
  const fxCanvas = document.getElementById('fx-canvas');
  const bgCtx = bgCanvas.getContext('2d');
  const fxCtx = fxCanvas.getContext('2d');

  let width = 0;
  let height = 0;
  let dots = [];
  let particles = [];
  let confettiUntil = 0;   // timestamp until which new confetti is spawned
  let fxRunning = false;

  // ---------- sizing (sharp on retina screens) ----------
  function resize() {
    const oldWidth = width;
    const oldHeight = height;
    width = window.innerWidth;
    height = window.innerHeight;

    // Keep the dots spread over the new size (also fixes the case where
    // the page loaded while the window had no size yet).
    dots.forEach((dot) => {
      if (oldWidth > 0 && oldHeight > 0) {
        dot.x *= width / oldWidth;
        dot.y *= height / oldHeight;
      } else {
        dot.x = Math.random() * width;
        dot.y = Math.random() * height;
      }
    });

    [bgCanvas, fxCanvas].forEach((canvas) => {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
    });
    // Draw in CSS pixels; the transform scales up to device pixels.
    bgCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    fxCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawBackground(); // redraw straight away (also needed when motion is off)
  }

  // ---------- background: a slow-drifting neural network ----------
  // Dots ("neurons") drift around, and any two that get close are joined
  // by a faint line ("synapse"). Cheap: ~45 dots, so ~1000 distance checks per frame.
  const LINK_DISTANCE = 150;

  function createDots() {
    dots = [];
    for (let i = 0; i < 45; i++) {
      dots.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        radius: 1.5 + Math.random() * 2.5,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        // Mostly cyan; a few take a game colour so the network feels alive.
        color: i % 9 === 0 ? COLORS[(i / 9) % COLORS.length].hex : '#22D3EE',
      });
    }
  }

  function drawBackground() {
    bgCtx.clearRect(0, 0, width, height);

    // 1) lines between close neurons (fainter the further apart they are)
    bgCtx.strokeStyle = '#22D3EE';
    bgCtx.lineWidth = 1;
    for (let i = 0; i < dots.length; i++) {
      for (let j = i + 1; j < dots.length; j++) {
        const dx = dots[i].x - dots[j].x;
        const dy = dots[i].y - dots[j].y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < LINK_DISTANCE) {
          bgCtx.globalAlpha = 0.16 * (1 - distance / LINK_DISTANCE);
          bgCtx.beginPath();
          bgCtx.moveTo(dots[i].x, dots[i].y);
          bgCtx.lineTo(dots[j].x, dots[j].y);
          bgCtx.stroke();
        }
      }
    }

    // 2) the neurons themselves
    dots.forEach((dot) => {
      bgCtx.fillStyle = dot.color;
      bgCtx.globalAlpha = 0.5;
      bgCtx.beginPath();
      bgCtx.arc(dot.x, dot.y, dot.radius, 0, Math.PI * 2);
      bgCtx.fill();
    });
    bgCtx.globalAlpha = 1;
  }

  function moveDots() {
    dots.forEach((dot) => {
      dot.x += dot.vx;
      dot.y += dot.vy;
      // Wrap around the edges so dots never leave the screen for good.
      if (dot.x < -20) dot.x = width + 20;
      if (dot.x > width + 20) dot.x = -20;
      if (dot.y < -20) dot.y = height + 20;
      if (dot.y > height + 20) dot.y = -20;
    });
  }

  function backgroundLoop() {
    if (!reducedMotion.matches) moveDots();
    drawBackground();
    // requestAnimationFrame pauses by itself in background tabs.
    requestAnimationFrame(backgroundLoop);
  }

  // ---------- particles (bursts + confetti) ----------
  function burst(x, y, color) {
    if (reducedMotion.matches) return;
    const count = 14;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
      const speed = 2 + Math.random() * 3;
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 3 + Math.random() * 3,
        life: 1,          // goes 1 -> 0, also used as opacity
        fade: 0.035,      // life lost per frame
        gravity: 0.08,
        color,
        shape: 'circle',
        rotation: 0, spin: 0,
      });
    }
    startFxLoop();
  }

  function confetti() {
    if (reducedMotion.matches) return;
    confettiUntil = performance.now() + 2500; // spawn for ~2.5 s
    startFxLoop();
  }

  function spawnConfettiPiece() {
    particles.push({
      x: Math.random() * width,
      y: -10,
      vx: (Math.random() - 0.5) * 3,
      vy: 2 + Math.random() * 3,
      size: 6 + Math.random() * 6,
      life: 1,
      fade: 0.004,
      gravity: 0.05,
      color: COLORS[Math.floor(Math.random() * COLORS.length)].hex,
      shape: 'rect',
      rotation: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 0.3,
    });
  }

  function startFxLoop() {
    if (fxRunning) return;
    fxRunning = true;
    requestAnimationFrame(fxLoop);
  }

  function fxLoop() {
    fxCtx.clearRect(0, 0, width, height);

    // While confetti is "on", add a few pieces every frame.
    if (performance.now() < confettiUntil) {
      for (let i = 0; i < 4; i++) spawnConfettiPiece();
    }

    particles.forEach((p) => {
      p.vy += p.gravity;
      p.x += p.vx;
      p.y += p.vy;
      p.rotation += p.spin;
      p.life -= p.fade;

      fxCtx.globalAlpha = Math.max(p.life, 0);
      fxCtx.fillStyle = p.color;
      if (p.shape === 'circle') {
        fxCtx.beginPath();
        fxCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        fxCtx.fill();
      } else {
        fxCtx.save();
        fxCtx.translate(p.x, p.y);
        fxCtx.rotate(p.rotation);
        fxCtx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        fxCtx.restore();
      }
    });
    fxCtx.globalAlpha = 1;

    // Drop dead or off-screen particles.
    particles = particles.filter((p) => p.life > 0 && p.y < height + 20);

    // Stop the loop completely when nothing is left (saves battery).
    if (particles.length > 0 || performance.now() < confettiUntil) {
      requestAnimationFrame(fxLoop);
    } else {
      fxRunning = false;
      fxCtx.clearRect(0, 0, width, height);
    }
  }

  // ---------- setup ----------
  function init() {
    createDots();
    resize();
    window.addEventListener('resize', resize);
    backgroundLoop();
  }

  init();

  return { burst, confetti };
})();
