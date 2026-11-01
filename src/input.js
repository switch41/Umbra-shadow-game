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
