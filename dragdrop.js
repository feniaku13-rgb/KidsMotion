/* =============================================================
   DRAGDROP.JS - Mencocokkan Bentuk (drag & drop) + Pinch/Zoom
   ============================================================= */

const DragDropGame = {
  maxPointers: 2,
  helpers: null,
  canvasW: 0,
  canvasH: 0,
  mode: 'match', // 'match' | 'pinch'

  shapeTypes: ['circle', 'square', 'triangle', 'star', 'heart'],
  colors: ['#FF6F91', '#4FC3F7', '#FFD166', '#81C784', '#B39DDB', '#FF9F5A'],

  pieces: [],
  targets: [],
  dragging: null, // {piece, pointerId, offsetX, offsetY}
  snapDistance: 90,
  tolerance: 34,

  // untuk pinch/zoom
  pinchObj: { scale: 1, rotation: 0, color: '#FF9F5A', type: 'star' },
  pinchPointers: new Map(),
  pinchBaseline: null,

  init(helpers) {
    this.helpers = helpers;
    this.mode = 'match';
    this.pieces = [];
    this.targets = [];
    this.dragging = null;
    this.pinchPointers = new Map();
    this.pinchBaseline = null;
  },

  resize(w, h) {
    this.canvasW = w;
    this.canvasH = h;
    if (!this.targets.length) this._generateRound();
    else this._layout();
    this.pinchObj.x = w / 2;
    this.pinchObj.y = h / 2;
  },

  setMode(mode) {
    this.mode = mode;
    this.pinchPointers.clear();
    this.pinchBaseline = null;
    if (this.helpers) {
      this.helpers.setInfo(mode === 'match' ? 'Tarik bentuk ke tempatnya!' : 'Pakai 2 jari untuk putar & perbesar!');
    }
  },

  _rand(min, max) { return Math.random() * (max - min) + min; },
  _pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; },

  _generateRound() {
    const count = 4;
    const shuffledShapes = [...this.shapeTypes].sort(() => Math.random() - 0.5).slice(0, count);
    const shuffledColors = [...this.colors].sort(() => Math.random() - 0.5);

    this.targets = shuffledShapes.map((type, i) => ({
      type, nx: 0, ny: 0, radius: 55, filled: false, index: i
    }));
    this.pieces = shuffledShapes.map((type, i) => ({
      type,
      color: shuffledColors[i % shuffledColors.length],
      radius: 46,
      placed: false,
      snapping: false,
      returning: false,
      animT: 0,
      nx: 0, ny: 0, // posisi rumah (normalisasi)
      x: 0, y: 0
    }));
    this._layout();
    if (this.helpers) this.helpers.setInfo('Tarik bentuk ke tempat yang cocok!');
  },

  _layout() {
    const w = this.canvasW, h = this.canvasH;
    const n = this.targets.length;
    // Target tersebar di area kanan-atas dalam grid dengan sedikit acak
    this.targets.forEach((t, i) => {
      const col = i % 2, row = Math.floor(i / 2);
      t.x = w * (0.60 + col * 0.20) + this._jitter(t, 'tx', 14);
      t.y = h * (0.22 + row * 0.28) + this._jitter(t, 'ty', 14);
    });
    // Tray piece di sisi kiri/bawah
    this.pieces.forEach((p, i) => {
      const col = i % 2, row = Math.floor(i / 2);
      const homeX = w * (0.16 + col * 0.16);
      const homeY = h * (0.62 + row * 0.24);
      p.homeX = homeX; p.homeY = homeY;
      if (!p.placed && !p.dragged) { p.x = homeX; p.y = homeY; }
    });
  },

  _jitter(obj, key, amt) {
    if (obj['_' + key] === undefined) obj['_' + key] = this._rand(-amt, amt);
    return obj['_' + key];
  },

  nextMode() {
    this.setMode(this.mode === 'match' ? 'pinch' : 'match');
  },

  /* ---------------- POINTER HANDLING ---------------- */
  onPointerDown(id, x, y) {
    if (this.mode === 'pinch') {
      this.pinchPointers.set(id, { x, y });
      if (this.pinchPointers.size === 2) this._pinchRecalibrate();
      return;
    }
    // mode match: cari piece teratas yang belum ditempatkan
    for (let i = this.pieces.length - 1; i >= 0; i--) {
      const p = this.pieces[i];
      if (p.placed) continue;
      const d = Math.hypot(p.x - x, p.y - y);
      if (d <= p.radius + this.tolerance) {
        this.dragging = { piece: p, pointerId: id, offsetX: p.x - x, offsetY: p.y - y };
        p.returning = false;
        // pindahkan ke akhir array supaya tergambar paling atas
        this.pieces.splice(i, 1);
        this.pieces.push(p);
        return;
      }
    }
  },

  onPointerMove(id, x, y) {
    if (this.mode === 'pinch') {
      if (this.pinchPointers.has(id)) {
        this.pinchPointers.set(id, { x, y });
        if (this.pinchPointers.size === 2) this._pinchUpdate();
      }
      return;
    }
    if (this.dragging && this.dragging.pointerId === id) {
      const p = this.dragging.piece;
      p.x = x + this.dragging.offsetX;
      p.y = y + this.dragging.offsetY;
    }
  },

  onPointerUp(id) {
    if (this.mode === 'pinch') {
      this.pinchPointers.delete(id);
      this.pinchBaseline = null; // baseline dihitung ulang saat 2 jari bersentuhan lagi
      return;
    }
    if (this.dragging && this.dragging.pointerId === id) {
      const p = this.dragging.piece;
      this.dragging = null;

      let matchedTarget = null;
      let bestDist = Infinity;
      for (const t of this.targets) {
        if (t.filled) continue;
        if (t.type !== p.type) continue;
        const d = Math.hypot(t.x - p.x, t.y - p.y);
        if (d <= this.snapDistance && d < bestDist) { bestDist = d; matchedTarget = t; }
      }

      if (matchedTarget) {
        matchedTarget.filled = true;
        p.placed = true;
        p.snapping = true;
        p.animT = 0;
        p.snapFrom = { x: p.x, y: p.y };
        p.snapTo = { x: matchedTarget.x, y: matchedTarget.y };
        if (typeof AudioFX !== 'undefined') AudioFX.playSnap();
        if (this.helpers) this.helpers.spawnParticles(matchedTarget.x, matchedTarget.y, p.color, 22, { shape: 'star' });

        if (this.targets.every(t => t.filled)) {
          if (this.helpers) {
            setTimeout(() => {
              this.helpers.celebrate('Semua Cocok! 🎉', () => this._generateRound());
            }, 260);
          }
        }
      } else {
        p.returning = true;
        p.animT = 0;
        p.snapFrom = { x: p.x, y: p.y };
        p.snapTo = { x: p.homeX, y: p.homeY };
      }
    }
  },

  _pinchRecalibrate() {
    const pts = Array.from(this.pinchPointers.values());
    const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    const angle = Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x);
    this.pinchBaseline = { dist, angle, scale: this.pinchObj.scale, rotation: this.pinchObj.rotation };
  },

  _pinchUpdate() {
    if (!this.pinchBaseline) { this._pinchRecalibrate(); return; }
    const pts = Array.from(this.pinchPointers.values());
    const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    const angle = Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x);
    const ratio = dist / Math.max(1, this.pinchBaseline.dist);
    this.pinchObj.scale = Math.min(3, Math.max(0.5, this.pinchBaseline.scale * ratio));
    this.pinchObj.rotation = this.pinchBaseline.rotation + (angle - this.pinchBaseline.angle);
  },

  resetPinch() {
    this.pinchObj.scale = 1;
    this.pinchObj.rotation = 0;
    this.pinchBaseline = null;
    if (typeof AudioFX !== 'undefined') AudioFX.playClick();
  },

  /* ---------------- UPDATE / DRAW ---------------- */
  update(dt) {
    for (const p of this.pieces) {
      if ((p.snapping || p.returning) && p.snapFrom && p.snapTo) {
        p.animT = Math.min(1, p.animT + dt * 4.5);
        const e = 1 - Math.pow(1 - p.animT, 3); // ease-out cubic
        p.x = p.snapFrom.x + (p.snapTo.x - p.snapFrom.x) * e;
        p.y = p.snapFrom.y + (p.snapTo.y - p.snapFrom.y) * e;
        if (p.animT >= 1) { p.snapping = false; p.returning = false; }
      }
    }
  },

  draw(ctx) {
    ctx.fillStyle = '#F3FBFF';
    ctx.fillRect(0, 0, this.canvasW, this.canvasH);

    if (this.mode === 'match') {
      // gambar target (garis putus-putus)
      for (const t of this.targets) {
        ctx.save();
        ctx.strokeStyle = t.filled ? 'rgba(129,199,132,0.9)' : 'rgba(150,160,180,0.7)';
        ctx.fillStyle = t.filled ? 'rgba(129,199,132,0.15)' : 'rgba(150,160,180,0.08)';
        ctx.lineWidth = 5;
        if (!t.filled) ctx.setLineDash([10, 10]);
        this._drawShapePath(ctx, t.type, t.x, t.y, t.radius);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
      // gambar piece
      for (const p of this.pieces) {
        ctx.save();
        ctx.fillStyle = p.color;
        ctx.shadowColor = 'rgba(0,0,0,0.25)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetY = 4;
        this._drawShapePath(ctx, p.type, p.x, p.y, p.radius);
        ctx.fill();
        ctx.restore();
      }
    } else {
      // mode pinch/zoom
      ctx.save();
      ctx.translate(this.pinchObj.x, this.pinchObj.y);
      ctx.rotate(this.pinchObj.rotation);
      ctx.scale(this.pinchObj.scale, this.pinchObj.scale);
      ctx.fillStyle = '#FF9F5A';
      ctx.shadowColor = 'rgba(0,0,0,0.3)';
      ctx.shadowBlur = 16;
      this._drawShapePath(ctx, 'star', 0, 0, 90);
      ctx.fill();
      ctx.restore();

      if (this.pinchPointers.size < 2) {
        ctx.fillStyle = '#5C7A99';
        ctx.font = 'bold 18px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Gunakan 2 jari untuk memutar & memperbesar', this.canvasW / 2, this.canvasH - 60);
      }
    }
  },

  _drawShapePath(ctx, type, cx, cy, r) {
    ctx.beginPath();
    switch (type) {
      case 'circle':
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        break;
      case 'square':
        ctx.rect(cx - r * 0.85, cy - r * 0.85, r * 1.7, r * 1.7);
        break;
      case 'triangle':
        ctx.moveTo(cx, cy - r);
        ctx.lineTo(cx + r * 0.9, cy + r * 0.75);
        ctx.lineTo(cx - r * 0.9, cy + r * 0.75);
        ctx.closePath();
        break;
      case 'star': {
        const spikes = 5, outer = r, inner = r * 0.5;
        let rot = -Math.PI / 2;
        const step = Math.PI / spikes;
        ctx.moveTo(cx + Math.cos(rot) * outer, cy + Math.sin(rot) * outer);
        for (let i = 0; i < spikes; i++) {
          rot += step;
          ctx.lineTo(cx + Math.cos(rot) * inner, cy + Math.sin(rot) * inner);
          rot += step;
          ctx.lineTo(cx + Math.cos(rot) * outer, cy + Math.sin(rot) * outer);
        }
        ctx.closePath();
        break;
      }
      case 'heart': {
        const s = r / 16;
        ctx.moveTo(cx, cy + 10 * s);
        ctx.bezierCurveTo(cx - 16 * s, cy - 8 * s, cx - 8 * s, cy - 18 * s, cx, cy - 6 * s);
        ctx.bezierCurveTo(cx + 8 * s, cy - 18 * s, cx + 16 * s, cy - 8 * s, cx, cy + 10 * s);
        ctx.closePath();
        break;
      }
    }
  },

  destroy() {
    this.pinchPointers.clear();
    this.dragging = null;
  }
};
