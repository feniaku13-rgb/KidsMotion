/* =============================================================
   TRACING.JS - Latihan Menjiplak Garis / Huruf / Angka
   Deteksi progres jalur dengan toleransi radius besar (motorik halus)
   ============================================================= */

const TracingGame = {
  maxPointers: 1,
  helpers: null,
  canvasW: 0,
  canvasH: 0,
  tolerance: 55,          // radius toleransi sentuhan (px)
  lookaheadPoints: 45,    // jendela pencarian titik ke depan

  points: [],             // titik jalur yang sudah di-sample rapat
  progressIndex: 0,
  isDrawing: false,
  activePointerId: null,
  cursor: null,

  shapeDefs: [
    { name: 'Garis Lurus', waypoints: [[0.15, 0.5], [0.85, 0.5]] },
    { name: 'Garis Gelombang', wave: true },
    { name: 'Huruf A', waypoints: [[0.20, 0.85], [0.5, 0.15], [0.80, 0.85], [0.65, 0.5], [0.35, 0.5]] },
    { name: 'Angka 1', waypoints: [[0.38, 0.28], [0.5, 0.15], [0.5, 0.85]] },
    { name: 'Bentuk O', circle: true }
  ],
  shapeIndex: 0,

  init(helpers) {
    this.helpers = helpers;
    this.shapeIndex = 0;
    this.cursor = null;
  },

  resize(w, h) {
    this.canvasW = w;
    this.canvasH = h;
    this._loadShape();
  },

  nextShape() {
    if (typeof AudioFX !== 'undefined') AudioFX.playClick();
    this.shapeIndex = (this.shapeIndex + 1) % this.shapeDefs.length;
    this._loadShape();
  },

  _loadShape() {
    if (!this.canvasW || !this.canvasH) return;
    const def = this.shapeDefs[this.shapeIndex];
    const marginX = this.canvasW * 0.12;
    const marginTop = this.canvasH * 0.22;
    const marginBottom = this.canvasH * 0.12;
    const w = this.canvasW - marginX * 2;
    const h = this.canvasH - marginTop - marginBottom;

    let raw = [];
    if (def.wave) {
      const steps = 60;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const nx = 0.1 + t * 0.8;
        const ny = 0.5 + Math.sin(t * Math.PI * 3) * 0.28;
        raw.push([nx, ny]);
      }
    } else if (def.circle) {
      const steps = 72;
      for (let i = 0; i <= steps; i++) {
        const a = (i / steps) * Math.PI * 2 - Math.PI / 2;
        const nx = 0.5 + Math.cos(a) * 0.36;
        const ny = 0.5 + Math.sin(a) * 0.36;
        raw.push([nx, ny]);
      }
    } else {
      raw = def.waypoints;
    }

    const scaled = raw.map(([nx, ny]) => [marginX + nx * w, marginTop + ny * h]);
    this.points = this._densify(scaled, 10);
    this.progressIndex = 0;
    this.isDrawing = false;
    this.activePointerId = null;
    this.cursor = null;
    if (typeof AudioFX !== 'undefined') AudioFX.playScratchStop();
    if (this.helpers) this.helpers.setInfo(`Jiplak: ${def.name}`);
  },

  _densify(waypoints, spacing) {
    const out = [waypoints[0]];
    for (let i = 0; i < waypoints.length - 1; i++) {
      const [x1, y1] = waypoints[i];
      const [x2, y2] = waypoints[i + 1];
      const dist = Math.hypot(x2 - x1, y2 - y1);
      const steps = Math.max(1, Math.floor(dist / spacing));
      for (let s = 1; s <= steps; s++) {
        const t = s / steps;
        out.push([x1 + (x2 - x1) * t, y1 + (y2 - y1) * t]);
      }
    }
    return out.map(([x, y]) => ({ x, y }));
  },

  onPointerDown(id, x, y) {
    if (this.activePointerId !== null) return;
    if (!this.points.length) return;
    const start = this.points[0];
    const d = Math.hypot(start.x - x, start.y - y);
    if (d <= this.tolerance * 1.6) {
      this.activePointerId = id;
      this.isDrawing = true;
      this.cursor = { x, y };
      if (typeof AudioFX !== 'undefined') AudioFX.playScratchStart();
    } else {
      // Beri umpan balik lembut: kedipkan titik mulai (ditangani di draw via flashStart)
      this.flashStart = 18;
    }
  },

  onPointerMove(id, x, y) {
    if (id !== this.activePointerId) return;
    this.cursor = { x, y };

    const start = Math.max(0, this.progressIndex);
    const end = Math.min(this.points.length - 1, this.progressIndex + this.lookaheadPoints);
    let bestIdx = -1;
    for (let i = start; i <= end; i++) {
      const p = this.points[i];
      const d = Math.hypot(p.x - x, p.y - y);
      if (d <= this.tolerance) bestIdx = i;
    }
    if (bestIdx > this.progressIndex) {
      this.progressIndex = bestIdx;
      const t = this.progressIndex / (this.points.length - 1);
      if (typeof AudioFX !== 'undefined') AudioFX.setScratchIntensity(t);
    }

    if (this.progressIndex >= this.points.length - 1) {
      this._complete();
    }
  },

  onPointerUp(id) {
    if (id !== this.activePointerId) return;
    this.isDrawing = false;
    this.activePointerId = null;
    this.cursor = null;
    if (typeof AudioFX !== 'undefined') AudioFX.playScratchStop();
  },

  _complete() {
    this.isDrawing = false;
    this.activePointerId = null;
    if (typeof AudioFX !== 'undefined') AudioFX.playScratchStop();
    const last = this.points[this.points.length - 1];
    if (this.helpers) {
      this.helpers.spawnParticles(last.x, last.y, '#FFD166', 30, { shape: 'star' });
      this.helpers.celebrate('Jiplakan Selesai! 🎉', () => this.nextShape());
    }
  },

  update(dt) {
    if (this.flashStart > 0) this.flashStart -= 1;
  },

  draw(ctx) {
    // latar
    ctx.fillStyle = '#EAFBFF';
    ctx.fillRect(0, 0, this.canvasW, this.canvasH);
    if (!this.points.length) return;

    // jalur panduan putus-putus
    ctx.save();
    ctx.strokeStyle = 'rgba(150,170,190,0.55)';
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.setLineDash([2, 22]);
    ctx.beginPath();
    ctx.moveTo(this.points[0].x, this.points[0].y);
    for (let i = 1; i < this.points.length; i++) ctx.lineTo(this.points[i].x, this.points[i].y);
    ctx.stroke();
    ctx.restore();

    // jalur yang sudah selesai (warna-warni)
    if (this.progressIndex > 0) {
      const grad = ctx.createLinearGradient(this.points[0].x, this.points[0].y,
        this.points[this.progressIndex].x, this.points[this.progressIndex].y);
      grad.addColorStop(0, '#FF6F91');
      grad.addColorStop(0.5, '#FFD166');
      grad.addColorStop(1, '#4FC3F7');
      ctx.save();
      ctx.strokeStyle = grad;
      ctx.lineWidth = 16;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(this.points[0].x, this.points[0].y);
      for (let i = 1; i <= this.progressIndex; i++) ctx.lineTo(this.points[i].x, this.points[i].y);
      ctx.stroke();
      ctx.restore();
    }

    // titik mulai
    const start = this.points[0];
    const pulse = this.flashStart > 0 ? 10 : 4 * Math.sin(Date.now() / 250);
    ctx.beginPath();
    ctx.fillStyle = this.flashStart > 0 ? '#FF6F91' : '#4CAF50';
    ctx.arc(start.x, start.y, 26 + pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('MULAI', start.x, start.y);

    // titik selesai
    const end = this.points[this.points.length - 1];
    ctx.beginPath();
    ctx.fillStyle = '#FF9800';
    ctx.arc(end.x, end.y, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = '22px sans-serif';
    ctx.fillText('🏁', end.x, end.y + 1);

    // penunjuk jari
    if (this.cursor) {
      ctx.beginPath();
      ctx.strokeStyle = '#FF6F91';
      ctx.lineWidth = 4;
      ctx.arc(this.cursor.x, this.cursor.y, 22, 0, Math.PI * 2);
      ctx.stroke();
    }
  },

  destroy() {
    if (typeof AudioFX !== 'undefined') AudioFX.playScratchStop();
    this.activePointerId = null;
  }
};
