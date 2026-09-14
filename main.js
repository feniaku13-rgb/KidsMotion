/* =============================================================
   MAIN.JS - Pengontrol Utama Aplikasi
   Game loop, resize, sistem partikel selebrasi, multi-touch guard
   ============================================================= */

(function () {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');

  const menuScreen = document.getElementById('menuScreen');
  const gameScreen = document.getElementById('gameScreen');
  const homeBtn = document.getElementById('homeBtn');
  const gameActions = document.getElementById('gameActions');
  const gameInfo = document.getElementById('gameInfo');

  const celebrationModal = document.getElementById('celebrationModal');
  const celebrationText = document.getElementById('celebrationText');
  const celebrationEmoji = document.getElementById('celebrationEmoji');
  const celebrationContinueBtn = document.getElementById('celebrationContinueBtn');

  const settingsModal = document.getElementById('settingsModal');
  const settingsBtn = document.getElementById('settingsBtn');
  const toggleSoundBtn = document.getElementById('toggleSoundBtn');
  const closeSettingsBtn = document.getElementById('closeSettingsBtn');

  const modules = {
    tracing: TracingGame,
    dragdrop: DragDropGame,
    pop: PopGame,
    tilt: TiltGame
  };

  let currentModule = null;
  let currentModuleName = null;
  let dpr = Math.max(1, window.devicePixelRatio || 1);
  let fireworkInterval = null;

  /* ================= SISTEM PARTIKEL SELEBRASI ================= */
  let particles = [];

  function spawnParticles(x, y, color, count = 24, opts = {}) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 220;
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 80,
        life: 1,
        maxLife: 0.7 + Math.random() * 0.6,
        color,
        size: 3 + Math.random() * 5,
        shape: opts.shape || 'circle',
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 8
      });
    }
  }

  function updateParticles(dt) {
    for (const p of particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 260 * dt; // gravitasi ringan
      p.vx *= 0.99;
      p.life -= dt / p.maxLife;
      p.rotation += p.rotSpeed * dt;
    }
    particles = particles.filter(p => p.life > 0);
  }

  function drawStarShape(c, x, y, outerR, innerR, spikes) {
    let rot = -Math.PI / 2;
    const step = Math.PI / spikes;
    c.beginPath();
    c.moveTo(x + Math.cos(rot) * outerR, y + Math.sin(rot) * outerR);
    for (let i = 0; i < spikes; i++) {
      rot += step;
      c.lineTo(x + Math.cos(rot) * innerR, y + Math.sin(rot) * innerR);
      rot += step;
      c.lineTo(x + Math.cos(rot) * outerR, y + Math.sin(rot) * outerR);
    }
    c.closePath();
  }

  function drawParticles(c) {
    for (const p of particles) {
      c.save();
      c.globalAlpha = Math.max(0, p.life);
      c.translate(p.x, p.y);
      c.rotate(p.rotation);
      c.fillStyle = p.color;
      if (p.shape === 'star') {
        drawStarShape(c, 0, 0, p.size, p.size * 0.5, 5);
        c.fill();
      } else {
        c.beginPath();
        c.arc(0, 0, p.size, 0, Math.PI * 2);
        c.fill();
      }
      c.restore();
    }
  }

  /* ================= HELPERS UNTUK SETIAP MODUL ================= */
  const helpers = {
    spawnParticles,
    setInfo(text) { gameInfo.textContent = text; },
    playSound(name) {
      if (typeof AudioFX === 'undefined') return;
      if (typeof AudioFX[name] === 'function') AudioFX[name]();
    },
    celebrate(message, onContinue) {
      celebrationText.textContent = message || 'Hebat Sekali!';
      const emojis = ['🌟', '🎉', '🏆', '✨', '🎈'];
      celebrationEmoji.textContent = emojis[Math.floor(Math.random() * emojis.length)];
      celebrationModal.classList.remove('hidden');
      if (typeof AudioFX !== 'undefined') AudioFX.playWinJingle();

      const rect = canvas.getBoundingClientRect();
      fireworkInterval = setInterval(() => {
        const fx = Math.random() * rect.width;
        const fy = rect.height * (0.2 + Math.random() * 0.5);
        const colors = ['#FF6F91', '#4FC3F7', '#FFD166', '#81C784', '#B39DDB'];
        spawnParticles(fx, fy, colors[Math.floor(Math.random() * colors.length)], 18, { shape: 'star' });
      }, 260);

      celebrationContinueBtn.onclick = () => {
        celebrationModal.classList.add('hidden');
        clearInterval(fireworkInterval);
        fireworkInterval = null;
        if (onContinue) onContinue();
      };
    },
    addAction(label, onClick) {
      const btn = document.createElement('button');
      btn.className = 'action-btn';
      btn.textContent = label;
      btn.addEventListener('click', () => {
        if (typeof AudioFX !== 'undefined') AudioFX.playClick();
        onClick();
      });
      gameActions.appendChild(btn);
      return btn;
    }
  };

  /* ================= TOOLBAR DINAMIS PER GAME ================= */
  function buildToolbar(name) {
    gameActions.innerHTML = '';
    if (name === 'tracing') {
      helpers.addAction('🔄 Ganti Bentuk', () => TracingGame.nextShape());
    } else if (name === 'dragdrop') {
      const btn = helpers.addAction('🔍 Putar & Perbesar', () => {
        DragDropGame.nextMode();
        btn.textContent = DragDropGame.mode === 'match' ? '🔍 Putar & Perbesar' : '🧩 Cocokkan Bentuk';
      });
    } else if (name === 'pop') {
      // tidak perlu tombol tambahan
    } else if (name === 'tilt') {
      helpers.addAction('🎯 Aktifkan Sensor', () => TiltGame.enableSensor());
      helpers.addAction('🔄 Kalibrasi', () => TiltGame.calibrate());
    }
  }

  /* ================= NAVIGASI LAYAR ================= */
  function startGame(name) {
    currentModuleName = name;
    currentModule = modules[name];
    menuScreen.classList.remove('active');
    gameScreen.classList.add('active');
    buildToolbar(name);
    currentModule.init(helpers);
    resizeCanvas();
  }

  function goHome() {
    if (currentModule && currentModule.destroy) currentModule.destroy();
    currentModule = null;
    currentModuleName = null;
    gameScreen.classList.remove('active');
    menuScreen.classList.add('active');
    gameActions.innerHTML = '';
    gameInfo.textContent = '';
    particles = [];
  }

  document.querySelectorAll('.menu-icon-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      AudioFX.init();
      AudioFX.playClick();
      startGame(btn.dataset.game);
    });
  });

  homeBtn.addEventListener('click', () => {
    if (typeof AudioFX !== 'undefined') AudioFX.playClick();
    goHome();
  });

  /* ================= PENGATURAN & PARENTAL GATE ================= */
  settingsBtn.addEventListener('click', () => {
    AudioFX.init();
    ParentalGate.open(() => {
      settingsModal.classList.remove('hidden');
    });
  });

  toggleSoundBtn.addEventListener('click', () => {
    const newState = !AudioFX.enabled;
    AudioFX.setEnabled(newState);
    toggleSoundBtn.textContent = newState ? '🔊 Suara: Nyala' : '🔇 Suara: Mati';
    if (newState) AudioFX.playClick();
  });

  closeSettingsBtn.addEventListener('click', () => {
    settingsModal.classList.add('hidden');
  });

  /* ================= RESIZE CANVAS ================= */
  function resizeCanvas() {
    if (!gameScreen.classList.contains('active')) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (currentModule && currentModule.resize) currentModule.resize(rect.width, rect.height);
  }
  window.addEventListener('resize', resizeCanvas);
  window.addEventListener('orientationchange', () => setTimeout(resizeCanvas, 300));

  /* ================= MULTI-TOUCH PROTECTION (Anti Telapak Tangan) ================= */
  const activePointers = new Map();

  function getCanvasPos(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function isLikelyPalm(e) {
    if (e.pointerType !== 'touch') return false;
    const w = e.width || 0, h = e.height || 0;
    // sentuhan dengan area kontak sangat besar dianggap telapak tangan / lengan
    return (w > 75 || h > 75);
  }

  function onPointerDown(e) {
    if (typeof AudioFX !== 'undefined') AudioFX.init();
    if (!gameScreen.classList.contains('active') || !currentModule) return;
    if (isLikelyPalm(e)) return;

    const maxP = currentModule.maxPointers || 1;
    if (activePointers.size >= maxP && !activePointers.has(e.pointerId)) return;

    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    const pos = getCanvasPos(e);
    activePointers.set(e.pointerId, pos);
    if (currentModule.onPointerDown) currentModule.onPointerDown(e.pointerId, pos.x, pos.y);
  }

  function onPointerMove(e) {
    if (!activePointers.has(e.pointerId) || !currentModule) return;
    const pos = getCanvasPos(e);
    activePointers.set(e.pointerId, pos);
    if (currentModule.onPointerMove) currentModule.onPointerMove(e.pointerId, pos.x, pos.y);
  }

  function onPointerUp(e) {
    if (!activePointers.has(e.pointerId)) return;
    const pos = getCanvasPos(e);
    activePointers.delete(e.pointerId);
    if (currentModule && currentModule.onPointerUp) currentModule.onPointerUp(e.pointerId, pos.x, pos.y);
  }

  canvas.addEventListener('pointerdown', (e) => { e.preventDefault(); onPointerDown(e); }, { passive: false });
  canvas.addEventListener('pointermove', (e) => { e.preventDefault(); onPointerMove(e); }, { passive: false });
  canvas.addEventListener('pointerup', (e) => { e.preventDefault(); onPointerUp(e); }, { passive: false });
  canvas.addEventListener('pointercancel', (e) => { onPointerUp(e); }, { passive: false });

  // Cegah gestur zoom bawaan browser (pinch harus ditangani sendiri oleh game)
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('touchmove', (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
  document.addEventListener('dblclick', (e) => e.preventDefault());

  /* ================= GAME LOOP ================= */
  let lastTime = performance.now();

  function loop(now) {
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;

    if (currentModule && gameScreen.classList.contains('active')) {
      const rect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);
      if (currentModule.update) currentModule.update(dt);
      if (currentModule.draw) currentModule.draw(ctx);
    }

    updateParticles(dt);
    if (currentModule && gameScreen.classList.contains('active')) {
      drawParticles(ctx);
    }

    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
})();
