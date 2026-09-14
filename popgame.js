/* =============================================================
   POPGAME.JS - Tap & Pop: Meletuskan Balon Bergerak
   Hitbox besar, tanpa batas waktu, tanpa "game over"
   ============================================================= */

const PopGame = {
  maxPointers: 5, // izinkan beberapa jari sekaligus (bilateral motor skill)
  helpers: null,
  canvasW: 0,
  canvasH: 0,

  balloons: [],
  spawnTimer: 0,
  spawnInterval: 0.85,
  poppedCount: 0,
  tolerance: 40,

  colors: ['#FF6F91', '#4FC3F7', '#FFD166', '#81C784', '#B39DDB', '#FF9F5A', '#4DD0E1'],

  init(helpers) {
    this.helpers = helpers;
    this.balloons = [];
    this.spawnTimer = 0;
    this.poppedCount = 0;
    if (this.helpers) this.helpers.setInfo('Balon meletus: 0');
  },

  resize(w, h) {
    this.canvasW = w;
    this.canvasH = h;
    if (!this.balloons.length) {
      for (let i = 0; i < 5; i++) this._spawnBalloon(true);
    }
  },

  _rand(min, max) { return Math.random() * (max - min) + min; },

  _spawnBalloon(randomHeight = false) {
    const radius = this._rand(55, 78);
    const baseX = this._rand(radius + 10, Math.max(radius + 10, this.canvasW - radius - 10));
    this.balloons.push({
      baseX,
      x: baseX,
      y: randomHeight ? this._rand(this.canvasH * 0.1, this.canvasH * 0.9) : this.canvasH + radius + 20,
      radius,
      vy: -this._rand(38, 68),
      swayAmp: this._rand(18, 46),
      swayFreq: this._rand(0.5, 1.3),
      phase: this._rand(0, Math.PI * 2),
      color: this.colors[Math.floor(Math.random() * this.colors.length)]
    });
  },

  update(dt) {
    this.spawnTimer += dt;
    if (this.spawnTimer >= this.spawnInterval && this.balloons.length < 9) {
      this.spawnTimer = 0;
      this._spawnBalloon();
    }
    for (const b of this.balloons) {
      b.phase += dt * b.swayFreq;
      b.y += b.vy * dt;
      b.x = b.baseX + Math.sin(b.phase) * b.swayAmp;
      if (b.y < -b.radius - 40) {
        // daur ulang balon ke bawah, tanpa penalti
        b.y = this.canvasH + b.radius + this._rand(0, 200);
        b.baseX = this._rand(b.radius + 10, Math.max(b.radius + 10, this.canvasW - b.radius - 10));
        b.color = this.colors[Math.floor(Math.random() * this.colors.length)];
      }
    }
  },

  onPointerDown(id, x, y) {
    for (let i = this.balloons.length - 1; i >= 0; i--) {
      const b = this.balloons[i];
      const d = Math.hypot(b.x - x, b.y - y);
      if (d <= b.radius + this.tolerance) {
        this.balloons.splice(i, 1);
        this.poppedCount++;
        if (typeof AudioFX !== 'undefined') AudioFX.playPop(this._rand(0.85, 1.3));
        if (this.helpers) {
          this.helpers.spawnParticles(b.x, b.y, b.color, 26, { shape: 'circle' });
          this.helpers.spawnParticles(b.x, b.y, '#FFD166', 10, { shape: 'star' });
          this.helpers.setInfo(`Balon meletus: ${this.poppedCount}`);
        }
        // munculkan balon pengganti sedikit lambat agar layar tak terlalu penuh
        setTimeout(() => this._spawnBalloon(), 200);
        break; // satu jari meletuskan satu balon per sentuhan
      }
    }
  },

  onPointerMove() {},
  onPointerUp() {},

  draw(ctx) {
    // langit sore ceria
    const grad = ctx.createLinearGradient(0, 0, 0, this.canvasH);
    grad.addColorStop(0, '#BFEFFF');
    grad.addColorStop(1, '#EAFBFF');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.canvasW, this.canvasH);

    for (const b of this.balloons) {
      ctx.save();
      // tali
      ctx.strokeStyle = 'rgba(90,90,90,0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y + b.radius * 0.9);
      ctx.quadraticCurveTo(b.x - 10, b.y + b.radius * 1.3, b.x, b.y + b.radius * 1.7);
      ctx.stroke();

      // badan balon
      ctx.beginPath();
      ctx.ellipse(b.x, b.y, b.radius * 0.86, b.radius, 0, 0, Math.PI * 2);
      ctx.fillStyle = b.color;
      ctx.shadowColor = 'rgba(0,0,0,0.2)';
      ctx.shadowBlur = 12;
      ctx.shadowOffsetY = 6;
      ctx.fill();

      // kilau
      ctx.beginPath();
      ctx.ellipse(b.x - b.radius * 0.32, b.y - b.radius * 0.4, b.radius * 0.22, b.radius * 0.32, -0.4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.shadowBlur = 0;
      ctx.fill();

      // simpul
      ctx.beginPath();
      ctx.moveTo(b.x - 6, b.y + b.radius * 0.92);
      ctx.lineTo(b.x + 6, b.y + b.radius * 0.92);
      ctx.lineTo(b.x, b.y + b.radius * 1.05);
      ctx.closePath();
      ctx.fillStyle = b.color;
      ctx.fill();

      ctx.restore();
    }
  },

  destroy() {
    this.balloons = [];
  }
};
