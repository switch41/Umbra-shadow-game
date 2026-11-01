import { loadBest } from './store.js';

const fmtTime = (s) => {
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, '0')}`;
};

export class Hud {
  constructor() {
    this.levelEl = document.getElementById('hud-level');
    this.statsEl = document.getElementById('hud-stats');
    this.hintEl = document.getElementById('hint');
    this.debugEl = document.getElementById('debug');
    this.hintbarEl = document.getElementById('hintbar');
    this.overlayEl = document.getElementById('overlay');
    this.titleEl = document.getElementById('ov-title');
    this.subEl = document.getElementById('ov-sub');
    this.statsOutEl = document.getElementById('ov-stats');
    this.keyEl = document.getElementById('ov-key');
    this._timeStr = '';
    this._hintT = null;
    this._ovT = null;
  }

  setLevel(level) {
    this.levelEl.textContent = `${level.id} · ${level.name}`;
    this._best = loadBest(level.id);
    this._timeStr = '';
    this.setTime(0);
    this.setTurns(0, level.par.turns);
    const base = 'A D walk · SPACE jump · H hint · G debug · M mute · R restart';
    let rot;
    if (level.axes === 'yaw') rot = '← → rotate';
    else if (level.axes === 'auto') rot = 'the model turns itself · ↑ ↓ tilt';
    else rot = '← → rotate · ↑ ↓ tilt';
    this.hintbarEl.textContent = `${rot} · ${base}`;
    const touch = document.getElementById('touch');
    if (touch) touch.dataset.axes = level.axes;
  }

  setTime(sec) {
    const s = fmtTime(sec);
    if (s !== this._timeStr) {
      this._timeStr = s;
      this._sync();
    }
  }

  setTurns(n, par) {
    this._turns = n;
    this._par = par;
    this._sync();
  }

  _sync() {
    const t = this._timeStr || '0:00';
    const turns = this._turns ?? 0;
    const par = this._par;
    let s = par ? `${t} · turns ${turns}/${par}` : `${t} · turns ${turns}`;
    if (this._best) s += ` · best ${fmtTime(this._best.time)}`;
    this.statsEl.textContent = s;
  }

  hint(lines, ttl = 4) {
    this.hintEl.innerHTML = lines.join('<br>');
    this.hintEl.classList.add('on');
    if (this._hintT) clearTimeout(this._hintT);
    if (ttl > 0) {
      this._hintT = setTimeout(() => {
        this.hintEl.classList.remove('on');
        this._hintT = null;
      }, ttl * 1000);
    }
  }

  clearHint() {
    if (this._hintT) clearTimeout(this._hintT);
    this.hintEl.classList.remove('on');
  }

  _show({ title, sub = '', stats = '', key = '', ttl = 0, onDone = null }) {
    this.titleEl.textContent = title;
    this.subEl.textContent = sub;
    this.statsOutEl.textContent = stats;
    if (key) {
      this.keyEl.textContent = key;
      this.keyEl.classList.remove('hidden');
    } else {
      this.keyEl.classList.add('hidden');
    }
    this.overlayEl.classList.remove('hidden', 'fade');
    if (this._ovT) clearTimeout(this._ovT);
    if (ttl > 0) {
      this._ovT = setTimeout(() => {
        this.overlayEl.classList.add('fade');
        if (onDone) onDone();
      }, ttl * 1000);
    }
  }

  intro(level) {
    this._show({ title: level.name, sub: level.flavor, ttl: 2.6 });
  }

  loading() {
    this._show({ title: 'Umbra', sub: 'the light gathers…' });
  }

  complete({ name, time, turns, par, best = null, isBest = false }) {
    const bt = `${fmtTime(time)} / par ${fmtTime(par.time)}`;
    const okT = time <= par.time;
    const bt2 = `${turns} / par ${par.turns}`;
    const okU = turns <= par.turns;
    let stats = `TIME  ${bt}${okT ? '  ✓' : ''}\nTURN  ${bt2}${okU ? '  ✓' : ''}`;
    if (isBest) {
      stats += '\n\nNEW BEST';
    } else if (best) {
      stats += `\n\nBEST  ${fmtTime(best.time)} / ${best.turns} turns`;
    }
    this._show({
      title: 'Shadow held',
      sub: name,
      stats,
      key: 'SPACE  →  next',
      ttl: 6,
    });
  }

  ending({ line, time, turns }) {
    this._show({
      title: 'Umbra',
      sub: line,
      stats: `TOTAL TIME  ${fmtTime(time)}\nTOTAL TURNS ${turns}`,
      key: 'SPACE  →  begin again',
    });
  }

  hideOverlay() {
    if (this._ovT) clearTimeout(this._ovT);
    this.overlayEl.classList.add('fade');
  }

  setDebug(text) {
    this.debugEl.textContent = text;
  }

  showDebug(on) {
    this.debugEl.style.display = on ? 'block' : 'none';
    if (!on) this.debugEl.textContent = '';
  }
}
