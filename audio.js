/* =============================================================
   AUDIO.JS - Sound Synthesizer (Web Audio API murni, tanpa MP3)
   ============================================================= */

const AudioFX = {
  ctx: null,
  enabled: true,
  noiseBuffer: null,
  scratchNode: null,
  scratchGain: null,

  /* Harus dipanggil dari dalam event sentuhan pengguna pertama
     agar browser mobile mengizinkan audio (autoplay policy). */
  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this._buildNoiseBuffer();
    } catch (e) {
      console.warn('Web Audio tidak tersedia:', e);
    }
  },

  setEnabled(v) { this.enabled = v; },

  _buildNoiseBuffer() {
    const ctx = this.ctx;
    const duration = 1.0;
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    this.noiseBuffer = buffer;
  },

  _now() { return this.ctx ? this.ctx.currentTime : 0; },

  /* ---------- Nada dasar (oscillator) ---------- */
  playTone(freq, duration, type = 'sine', volume = 0.22, delay = 0) {
    if (!this.ctx || !this.enabled) return;
    const t0 = this._now() + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(volume, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
  },

  /* ---------- Klik tombol ---------- */
  playClick() {
    if (!this.ctx || !this.enabled) return;
    this.playTone(520, 0.08, 'triangle', 0.18);
  },

  /* ---------- Balon meletus / pop ---------- */
  playPop(pitch = 1) {
    if (!this.ctx || !this.enabled || !this.noiseBuffer) return;
    const ctx = this.ctx;
    const t0 = this._now();

    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1800 * pitch, t0);
    filter.frequency.exponentialRampToValueAtTime(220 * pitch, t0 + 0.18);
    filter.Q.value = 1.1;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.5, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.2);

    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start(t0);
    src.stop(t0 + 0.22);

    // "boing" kecil di atasnya biar ceria
    this.playTone(880 * pitch, 0.12, 'sine', 0.15, 0.02);
  },

  /* ---------- Bentuk berhasil dipasang (snap) ---------- */
  playSnap() {
    if (!this.ctx || !this.enabled) return;
    this.playTone(660, 0.1, 'square', 0.15);
    this.playTone(990, 0.14, 'sine', 0.18, 0.05);
  },

  /* ---------- Efek coretan tracing (loop selama menggambar) ---------- */
  playScratchStart() {
    if (!this.ctx || !this.enabled || !this.noiseBuffer) return;
    if (this.scratchNode) this.playScratchStop();
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, this._now());
    gain.gain.exponentialRampToValueAtTime(0.09, this._now() + 0.08);

    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start(0);

    this.scratchNode = src;
    this.scratchFilter = filter;
    this.scratchGain = gain;
  },

  setScratchIntensity(t) {
    // t: 0..1 => makin besar progres, nada makin ceria/tinggi
    if (!this.scratchFilter) return;
    const freq = 500 + t * 2200;
    this.scratchFilter.frequency.setTargetAtTime(freq, this._now(), 0.05);
  },

  playScratchStop() {
    if (!this.scratchNode) return;
    const t0 = this._now();
    try {
      this.scratchGain.gain.cancelScheduledValues(t0);
      this.scratchGain.gain.setValueAtTime(this.scratchGain.gain.value, t0);
      this.scratchGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12);
      this.scratchNode.stop(t0 + 0.15);
    } catch (e) { /* ignore */ }
    this.scratchNode = null;
    this.scratchGain = null;
    this.scratchFilter = null;
  },

  /* ---------- Jingle kemenangan / selebrasi ---------- */
  playWinJingle() {
    if (!this.ctx || !this.enabled) return;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
    notes.forEach((f, i) => this.playTone(f, 0.28, 'triangle', 0.2, i * 0.14));
    // taburan bintang kecil di akhir
    for (let i = 0; i < 5; i++) {
      this.playTone(1200 + i * 90, 0.15, 'sine', 0.08, 0.56 + i * 0.05);
    }
  },

  /* ---------- Sorak-sorai kecil (mengumpulkan bintang, dsb) ---------- */
  playCheer() {
    if (!this.ctx || !this.enabled) return;
    this.playTone(784, 0.12, 'sine', 0.18);
    this.playTone(988, 0.16, 'sine', 0.2, 0.08);
  }
};
