import { W, H, PHYS } from './config.js';

export function makeSolid() {
  return new Uint8Array(W * H);
}

export function rectSolid(solid, x, y, w, h) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = x0 + w - 1;
  const y1 = y0 + h - 1;
  if (x0 < 0 || y0 < 0 || x1 >= W || y1 >= H) return true;
  for (let py = y0; py <= y1; py++) {
    const row = py * W;
    for (let px = x0; px <= x1; px++) {
      if (solid[row + px]) return true;
    }
  }
  return false;
}

export function stampRects(solid, rects) {
  for (const r of rects) {
    const x0 = Math.max(0, r.x | 0);
    const y0 = Math.max(0, r.y | 0);
    const x1 = Math.min(W - 1, (r.x + r.w - 1) | 0);
    const y1 = Math.min(H - 1, (r.y + r.h - 1) | 0);
    for (let y = y0; y <= y1; y++) {
      const row = y * W;
      for (let x = x0; x <= x1; x++) solid[row + x] = 1;
    }
  }
}

function rectOverlap(ax, ay, aw, ah, r) {
  return ax < r.x + r.w && ax + aw > r.x && ay < r.y + r.h && ay + ah > r.y;
}

export class Player {
  constructor(spawn) {
    this.reset(spawn);
    this.w = PHYS.PW;
    this.h = PHYS.PH;
  }

  reset(spawn) {
    this.x = spawn.x;
    this.y = spawn.y;
    this.vx = 0;
    this.vy = 0;
    this.grounded = false;
    this.coyote = 0;
    this.jumpBuf = 0;
    this.facing = 1;
    this.squash = 0;
    this.alive = true;
    this._xr = 0;
    this._yr = 0;
  }

  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }

  update(solid, inp, dt, events, level) {
    const P = PHYS;

    if (inp.jump) this.jumpBuf = P.BUFFER;
    else this.jumpBuf = Math.max(0, this.jumpBuf - dt);

    this.coyote = this.grounded ? P.COYOTE : Math.max(0, this.coyote - dt);

    if (this.jumpBuf > 0 && (this.grounded || this.coyote > 0)) {
      this.vy = -P.JUMP;
      this.grounded = false;
      this.coyote = 0;
      this.jumpBuf = 0;
      events.jump = true;
    }
    if (!inp.jumpHeld && this.vy < -P.JUMP / 2) this.vy = -P.JUMP / 2;

    if (inp.move !== 0) this.facing = inp.move;

    this.vy = Math.min(P.TERMINAL, this.vy + P.GRAVITY * dt);

    const dx = inp.move * P.WALK * dt;
    this._moveH(solid, dx);

    const wasGrounded = this.grounded;
    this._moveV(solid, this.vy * dt);

    if (this.grounded && !wasGrounded && this.vy >= 0) {
      this.squash = 1;
      events.land = true;
    }
    this.squash = Math.max(0, this.squash - dt * 6);

    if (this.grounded) this._snapDown(solid);

    if (this.grounded && this._onLedge(level)) {
      this.respawn = { x: this.x, y: this.y };
    }

    if (level.hazards) {
      for (const hz of level.hazards) {
        if (rectOverlap(this.x, this.y, this.w, this.h, hz)) {
          events.hazard = true;
          return 'dead';
        }
      }
    }
    if (this.y > H + 4) {
      events.fell = true;
      return 'dead';
    }
    return 'ok';
  }

  _moveH(solid, dx) {
    const P = PHYS;
    const total = dx + this._xr;
    const step = total > 0 ? 1 : total < 0 ? -1 : 0;
    if (step === 0) {
      this._xr = 0;
      this.vx = 0;
      return;
    }
    let remain = Math.trunc(total);
    this._xr = total - remain;
    if (remain === 0) {
      this.vx = 0;
      return;
    }
    while (remain !== 0) {
      const nx = this.x + step;
      if (!rectSolid(solid, nx, this.y, this.w, this.h)) {
        this.x = nx;
        remain -= step;
        continue;
      }
      let stepped = false;
      for (let up = 1; up <= P.STEP_UP; up++) {
        if (!rectSolid(solid, nx, this.y - up, this.w, this.h) && !rectSolid(solid, this.x, this.y - up, this.w, this.h)) {
          this.y -= up;
          this.x = nx;
          stepped = true;
          break;
        }
      }
      if (!stepped) break;
      remain -= step;
    }
    this.vx = step * PHYS.WALK;
  }

  _moveV(solid, dy) {
    const total = dy + this._yr;
    const step = total > 0 ? 1 : total < 0 ? -1 : 0;
    this.grounded = false;
    if (step === 0) {
      this._yr = 0;
      if (rectSolid(solid, this.x, this.y + 1, this.w, this.h)) this.grounded = true;
      return;
    }
    let remain = Math.trunc(total);
    this._yr = total - remain;
    while (remain !== 0) {
      const ny = this.y + step;
      if (!rectSolid(solid, this.x, ny, this.w, this.h)) {
        this.y = ny;
        remain -= step;
        continue;
      }
      if (step > 0) {
        this.grounded = true;
        this.vy = 0;
      } else {
        this.vy = Math.max(0, -this.vy * 0.15);
      }
      break;
    }
    if (!this.grounded && step >= 0 && rectSolid(solid, this.x, this.y + 1, this.w, this.h)) {
      this.grounded = true;
      this.vy = 0;
    }
  }

  _snapDown(solid) {
    for (let d = 1; d <= PHYS.SNAP_DOWN; d++) {
      if (!rectSolid(solid, this.x, this.y + d, this.w, this.h)) {
        if (!rectSolid(solid, this.x, this.y + d + 1, this.w, this.h)) {
          this.y += d;
          return;
        }
      } else {
        return;
      }
    }
  }

  _onLedge(level) {
    const feet = this.y + this.h;
    for (const r of level.ledges) {
      if (this.x + this.w - 1 >= r.x && this.x < r.x + r.w && feet >= r.y && feet <= r.y + r.h + 1) {
        return true;
      }
    }
    return false;
  }

  depenetrate(solid) {
    if (!rectSolid(solid, this.x, this.y, this.w, this.h)) return true;
    for (let i = 1; i <= PHYS.DEPEN_MAX; i++) {
      if (!rectSolid(solid, this.x, this.y - i, this.w, this.h)) {
        this.y -= i;
        this.vy = 0;
        return true;
      }
    }
    return false;
  }
}

export function respawnPlayer(player, level) {
  const target = player.respawn || level.spawn;
  player.reset({ x: target.x, y: target.y });
}
