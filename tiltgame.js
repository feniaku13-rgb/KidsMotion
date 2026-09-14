/* =============================================================
   TILTGAME.JS - Motorik Kasar: Miringkan HP untuk Menggerakkan Bola
   Menggunakan DeviceOrientation API + fallback sentuh/geser
   ============================================================= */

const TiltGame = {
  maxPointers: 1,
  helpers: null,
  canvasW: 0,
  canvasH: 0,

  supported: false,
  calibrated: false,
  needsPermissionButton: false,
  lastBeta: 0,
  lastGamma: 0,
  baseline: { beta: 0, gamma: 0 },

  ball: { x: 0, y: 0, vx: 0, vy: 0, r: 42 },
  stars: [],
  collected: 0,

  draggingBall: false,
  dragId: null,

  _orientationHandler: null,

  init(helpers) {
    this.helpers = helpers;
    this.collected = 0;
    this.stars = [];
    this.calibrated = false;
    this.supported = false;
    this.needsPermissionButton = false;
    if (this.helpers) this.helpers.setInfo('Bintang dikumpulkan: 0');
    this._detectSensor();
  },

  resize(w, h) {
    this.canvasW = w;
    this.canvasH = h;
    if (this.ball.x === 0 && this.ball.y === 0) {
      this.ball.x = w / 2;
      this.ball.y = h / 2;
    }
    if (!this.stars.length) {
      for (let i = 0; i < 3; i++) this._spawnStar();
    }
  },

  _rand(min, max) { return Math.random() * (max - min) + min; },

  _spawnStar() {
    const r = 30;
    this.stars.push({
      x: this._rand(r + 20, Math.max(r + 20, this.canvasW - r - 20)),
      y: this._rand(r + 20, Math.max(r + 20, this.canvasH - r - 20)),
      r
    });
  },

  _detectSensor() {
    if (typeof DeviceOrientationEvent === 'undefined') {
      this.supported = false;
      this.needsPermissionButton = false;
      if (this.helpers) this.helpers.setInfo('Sensor tidak tersedia, geser bola dengan jari!');
      return;
    }
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      // iOS 13+ : butuh tombol & gesture pengguna untuk minta izin
      this.needsPermissionButton = true;
    } else {
      // Android / browser lain: langsung bisa dipakai
      this._attachListener();
      this.supported = true;
    }
  },

  enableSensor() {
    if (typeof DeviceOrientationEvent !== 'undefined' &&
      typeof DeviceOrientationEvent.requestPermission === 'function') {
      DeviceOrientationEvent.requestPermission().then(state => {
        if (state === 'granted') {
          this._attachListener();
          this.supported = true;
          this.needsPermissionButton = false;
          if (this.helpers) this.helpers.setInfo('Sensor aktif! Miringkan HP-mu 🎯');
        } else {
          if (this.helpers) this.helpers.setInfo('Izin ditolak, geser bola dengan jari saja ya!');
        }
      }).catch(() => {
        if (this.helpers) this.helpers.setInfo('Sensor tidak dapat diaktifkan, geser bola dengan jari!');
      });
    }
  },

  _attachListener() {
    if (this._orientationHandler) return;
    this._orientationHandler = (e) => {
      this.lastBeta = e.beta || 0;
      this.lastGamma = e.gamma || 0;
      if (!this.calibrated) this.calibrate();
    };
    window.addEventListener('deviceorientation', this._orientationHandler);
  },

  calibrate() {
    this.baseline.beta = this.lastBeta;
    this.baseline.gamma = this.lastGamma;
    this.calibrated = true;
    if (typeof AudioFX !== 'undefined') AudioFX.playClick();
  },

  onPointerDown(id, x, y) {
    const d = Math.hypot(this.ball.x - x, this.ball.y - y);
    if (d <= this.ball.r + 55) {
      this.draggingBall = true;
      this.dragId = id;
      this.ball.vx = 0;
      this.ball.vy = 0;
    }
  },

  onPointerMove(id, x, y) {
    if (this.draggingBall && id === this.dragId) {
      this.ball.x = x;
      this.ball.y = y;
    }
  },

  onPointerUp(id) {
    if (id === this.dragId) {
      this.draggingBall = false;
      this.dragId = null;
    }
  },

  _clamp(v, min, max) { return Math.max(min, Math.min(max, v)); },

  update(dt) {
    if (!this.draggingBall && this.supported && this.calibrated) {
      const dGamma = this._clamp(this.lastGamma - this.baseline.gamma, -30, 30) / 30;
      const dBeta = this._clamp(this.lastBeta - this.baseline.beta, -30, 30) / 30;
      const accel = 620;
      this.ball.vx += dGamma * accel * dt;
      this.ball.vy += dBeta * accel * dt;
      this.ball.vx *= 0.965;
      this.ball.vy *= 0.965;
      this.ball.x += this.ball.vx * dt;
      this.ball.y += this.ball.vy * dt;
    }

    // batas dinding dengan pantulan lembut
    const r = this.ball.r;
    if (this.ball.x < r) { this.ball.x = r; this.ball.vx *= -0.4; }
    if (this.ball.x > this.canvasW - r) { this.ball.x = this.canvasW - r; this.ball.vx *= -0.4; }
    if (this.ball.y < r) { this.ball.y = r; this.ball.vy *= -0.4; }
    if (this.ball.y > this.canvasH - r) { this.ball.y = this.canvasH - r; this.ball.vy *= -0.4; }

    // tabrakan dengan bintang
    for (let i = this.stars.length - 1; i >= 0; i--) {
      const s = this.stars[i];
      const d = Math.hypot(this.ball.x - s.x, this.ball.y - s.y);
      if (d <= this.ball.r + s.r) {
        this.stars.splice(i, 1);
        this.collected++;
        if (typeof AudioFX !== 'undefined') AudioFX.playCheer();
        if (this.helpers) {
          this.helpers.spawnParticles(s.x, s.y, '#FFD166', 24, { shape: 'star' });
          this.helpers.setInfo(`Bintang dikumpulkan: ${this.collected}`);
        }
        setTimeout(() => this._spawnStar(), 300);
      }
    }
  },

  draw(ctx) {
    const grad = ctx.createLinearGradient(0, 0, 0, this.canvasH);
    grad.addColorStop(0, '#C8F7C5');
    grad.addColorStop(1, '#EAFBFF');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.canvasW, this.canvasH);

    // bintang target
    for (const s of this.stars) {
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.fillStyle = '#FFD166';
      ctx.shadowColor = 'rgba(0,0,0,0.2)';
      ctx.shadowBlur = 8;
      this._drawStar(ctx, 0, 0, s.r, s.r * 0.5, 5);
      ctx.fill();
      ctx.restore();
    }

    // bola karakter
    ctx.save();
    ctx.beginPath();
    ctx.arc(this.ball.x, this.ball.y, this.ball.r, 0, Math.PI * 2);
    ctx.fillStyle = '#FF6F91';
    ctx.shadowColor = 'rgba(0,0,0,0.25)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 4;
    ctx.fill();
    ctx.shadowBlur = 0;
    // wajah senyum
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(this.ball.x - 12, this.ball.y - 8, 6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(this.ball.x + 12, this.ball.y - 8, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#33475B';
    ctx.beginPath(); ctx.arc(this.ball.x - 12, this.ball.y - 8, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(this.ball.x + 12, this.ball.y - 8, 3, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#33475B';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(this.ball.x, this.ball.y + 4, 12, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
    ctx.restore();

    // indikator arah kemiringan
    if (this.supported && this.calibrated && !this.draggingBall) {
      const dGamma = this._clamp(this.lastGamma - this.baseline.gamma, -30, 30) / 30;
      const dBeta = this._clamp(this.lastBeta - this.baseline.beta, -30, 30) / 30;
      const ix = this.canvasW - 70, iy = 70;
      ctx.save();
      ctx.strokeStyle = 'rgba(51,71,91,0.35)';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(ix, iy, 40, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(ix, iy);
      ctx.lineTo(ix + dGamma * 34, iy + dBeta * 34);
      ctx.strokeStyle = '#FF6F91';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.restore();
    } else if (!this.supported) {
      ctx.fillStyle = '#5C7A99';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Geser bola dengan jari untuk mengambil bintang ⭐', this.canvasW / 2, this.canvasH - 30);
    }
  },

  _drawStar(ctx, cx, cy, outerR, innerR, spikes) {
    let rot = -Math.PI / 2;
    const step = Math.PI / spikes;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(rot) * outerR, cy + Math.sin(rot) * outerR);
    for (let i = 0; i < spikes; i++) {
      rot += step;
      ctx.lineTo(cx + Math.cos(rot) * innerR, cy + Math.sin(rot) * innerR);
      rot += step;
      ctx.lineTo(cx + Math.cos(rot) * outerR, cy + Math.sin(rot) * outerR);
    }
    ctx.closePath();
  },

  destroy() {
    if (this._orientationHandler) {
      window.removeEventListener('deviceorientation', this._orientationHandler);
      this._orientationHandler = null;
    }
    this.ball.x = 0; this.ball.y = 0;
    this.calibrated = false;
    this.stars = [];
  }
};
