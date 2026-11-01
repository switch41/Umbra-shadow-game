export class Sfx {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.padNodes = null;
  }

  _ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return true;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    return true;
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  }

  _blip({ f0, f1, t, type = 'sine', gain = 0.2 }) {
    if (!this._ensure() || this.muted) return;
    const now = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, now);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), now + t);
    g.gain.setValueAtTime(gain, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + t);
    o.connect(g).connect(this.master);
    o.start(now);
    o.stop(now + t + 0.02);
  }

  jump() { this._blip({ f0: 340, f1: 620, t: 0.12, type: 'triangle', gain: 0.16 }); }
  land() { this._blip({ f0: 160, f1: 70, t: 0.09, type: 'sine', gain: 0.14 }); }
  step() { this._blip({ f0: 900, f1: 700, t: 0.03, type: 'square', gain: 0.03 }); }
  rotateTick() {
    if (!this._ensure() || this.muted) return;
    if (Math.random() > 0.12) return;
    this._blip({ f0: 200 + Math.random() * 60, f1: 180, t: 0.04, type: 'triangle', gain: 0.025 });
  }
  die() { this._blip({ f0: 280, f1: 40, t: 0.35, type: 'sawtooth', gain: 0.14 }); }
  crush() { this._blip({ f0: 120, f1: 30, t: 0.4, type: 'square', gain: 0.16 }); }
  chime() {
    this._blip({ f0: 660, f1: 660, t: 0.3, type: 'sine', gain: 0.12 });
    setTimeout(() => this._blip({ f0: 990, f1: 990, t: 0.5, type: 'sine', gain: 0.1 }), 120);
  }
  ui() { this._blip({ f0: 520, f1: 780, t: 0.08, type: 'triangle', gain: 0.08 }); }

  startPad() {
    if (!this._ensure() || this.muted || this.padNodes) return;
    const now = this.ctx.currentTime;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.05, now + 2.5);
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 420;
    const oscs = [110, 110.6, 164.8, 220.4].map((f, i) => {
      const o = this.ctx.createOscillator();
      o.type = i < 2 ? 'sawtooth' : 'sine';
      o.frequency.value = f;
      o.connect(filt);
      o.start(now);
      return o;
    });
    filt.connect(g).connect(this.master);
    this.padNodes = { g, oscs };
  }

  stopPad() {
    if (!this.padNodes || !this.ctx) return;
    const now = this.ctx.currentTime;
    const { g, oscs } = this.padNodes;
    g.gain.cancelScheduledValues(now);
    g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
    oscs.forEach((o) => o.stop(now + 1.3));
    this.padNodes = null;
  }
}
