// Web Audio API ile Hafif Bildirim Sesleri
class SoundService {
  constructor() {
    this.ctx = null;
  }

  init() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
  }

  playTone(freq, type = 'sine', duration = 0.15, gainVal = 0.1) {
    try {
      this.init();
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

      gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {
      console.warn('Audio play error:', e);
    }
  }

  // Kitap ödünç verildiğinde çalan pozitif çift ton (ding-dong)
  playSuccess() {
    this.playTone(587.33, 'triangle', 0.12, 0.12); // D5
    setTimeout(() => {
      this.playTone(880, 'triangle', 0.25, 0.12); // A5
    }, 100);
  }

  // İade alındığında çalan tok onay tonu
  playReturn() {
    this.playTone(523.25, 'sine', 0.1, 0.12); // C5
    setTimeout(() => {
      this.playTone(659.25, 'sine', 0.2, 0.12); // E5
    }, 80);
  }

  // Hata, yetersiz stok veya gecikme uyarısı tonu (düşük frekans buzzer)
  playError() {
    this.playTone(220, 'sawtooth', 0.25, 0.15); // A3
  }
}

export const sound = new SoundService();