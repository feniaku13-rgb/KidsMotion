/* =============================================================
   PARENTAL.JS - Gerbang Keamanan Orang Tua
   Kuis matematika sederhana sebelum masuk Pengaturan.
   No-Penalty: salah jawab hanya diminta mencoba lagi, tanpa hukuman.
   ============================================================= */

const ParentalGate = {
  correctAnswer: null,
  onSuccessCb: null,
  onCancelCb: null,

  open(onSuccess, onCancel) {
    this.onSuccessCb = onSuccess || null;
    this.onCancelCb = onCancel || null;
    this._generateQuestion();
    document.getElementById('parentalModal').classList.remove('hidden');
  },

  close() {
    document.getElementById('parentalModal').classList.add('hidden');
  },

  cancel() {
    this.close();
    if (this.onCancelCb) this.onCancelCb();
  },

  _rand(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  },

  _generateQuestion() {
    const a = this._rand(2, 10);
    const b = this._rand(1, 9);
    this.correctAnswer = a + b;

    document.getElementById('parentalQuestion').textContent = `Berapa hasil dari ${a} + ${b} ?`;

    // Buat 2 jawaban pengecoh yang berbeda dari jawaban benar
    const options = new Set([this.correctAnswer]);
    while (options.size < 3) {
      const delta = this._rand(-4, 4);
      const candidate = this.correctAnswer + delta;
      if (candidate > 0 && !options.has(candidate)) options.add(candidate);
    }

    const optionArr = Array.from(options);
    // Kocok urutan
    for (let i = optionArr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [optionArr[i], optionArr[j]] = [optionArr[j], optionArr[i]];
    }

    const container = document.getElementById('parentalAnswers');
    container.innerHTML = '';
    optionArr.forEach(val => {
      const btn = document.createElement('button');
      btn.className = 'answer-btn';
      btn.textContent = String(val);
      btn.addEventListener('click', () => this._checkAnswer(val));
      container.appendChild(btn);
    });
  },

  _checkAnswer(val) {
    if (typeof AudioFX !== 'undefined') AudioFX.playClick();
    if (val === this.correctAnswer) {
      this.close();
      if (this.onSuccessCb) this.onSuccessCb();
    } else {
      const box = document.getElementById('parentalBox');
      box.classList.remove('shake');
      // paksa reflow agar animasi bisa diulang
      void box.offsetWidth;
      box.classList.add('shake');
      // Tanpa penalti: cukup buat soal baru agar tidak terjebak menebak jawaban lama
      this._generateQuestion();
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  const cancelBtn = document.getElementById('parentalCancelBtn');
  if (cancelBtn) cancelBtn.addEventListener('click', () => ParentalGate.cancel());
});
