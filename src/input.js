export class Input {
  constructor() {
    this.keys = new Set();
    this.pressed = new Set();

    this._down = (e) => {
      if (e.repeat) return;
      const k = e.code;
      this.keys.add(k);
      this.pressed.add(k);
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(k)) e.preventDefault();
    };
    this._up = (e) => this.keys.delete(e.code);
    this._blur = () => this.keys.clear();

    window.addEventListener('keydown', this._down);
    window.addEventListener('keyup', this._up);
    window.addEventListener('blur', this._blur);
  }

  held(code) { return this.keys.has(code); }
  once(code) {
    if (this.pressed.has(code)) {
      this.pressed.delete(code);
      return true;
    }
    return false;
  }
  endFrame() { this.pressed.clear(); }

  press(code) {
    if (this.keys.has(code)) return;
    this.keys.add(code);
    this.pressed.add(code);
  }
  release(code) {
    this.keys.delete(code);
  }

  bindTouch(root) {
    if (!root) return;
    const active = new Map();
    const down = (e) => {
      const btn = e.target.closest?.('[data-key]');
      if (!btn) return;
      e.preventDefault();
      try {
        btn.setPointerCapture(e.pointerId);
      } catch {
        /* capture unsupported — window pointerup still fires */
      }
      active.set(e.pointerId, { code: btn.dataset.key, btn });
      btn.classList.add('held');
      this.press(btn.dataset.key);
    };
    const up = (e) => {
      const a = active.get(e.pointerId);
      if (!a) return;
      active.delete(e.pointerId);
      a.btn.classList.remove('held');
      this.release(a.code);
    };
    root.addEventListener('pointerdown', down);
    root.addEventListener('pointerup', up);
    root.addEventListener('pointercancel', up);
    root.addEventListener('lostpointercapture', up);
    root.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  get move() {
    return (this.held('KeyD') ? 1 : 0) - (this.held('KeyA') ? 1 : 0);
  }
  get jumpHeld() { return this.held('Space'); }

  rotAxes(allowPitch) {
    let yaw = 0;
    let pitch = 0;
    if (this.held('ArrowLeft')) yaw -= 1;
    if (this.held('ArrowRight')) yaw += 1;
    if (allowPitch) {
      if (this.held('ArrowUp')) pitch -= 1;
      if (this.held('ArrowDown')) pitch += 1;
    }
    return { yaw, pitch };
  }
}
