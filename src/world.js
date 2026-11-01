import { W, H } from './config.js';

export class World {
  constructor(canvas) {
    canvas.width = W;
    canvas.height = H;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.shadowCanvas = document.createElement('canvas');
    this.shadowCanvas.width = W;
    this.shadowCanvas.height = H;
    this.debugCanvas = null;
    this.motes = [];
    for (let i = 0; i < 46; i++) {
      this.motes.push({
        x: Math.random() * W,
        y: Math.random() * H,
        sp: 1.5 + Math.random() * 5,
        ph: Math.random() * Math.PI * 2,
        a: 0.1 + Math.random() * 0.3,
      });
    }
  }

  buildShadow(mask) {
    const g = this.shadowCanvas.getContext('2d');
    const img = g.createImageData(W, H);
    const d = img.data;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (!mask[i]) continue;
        const o = i * 4;
        const up = y === 0 ? 0 : mask[i - W];
        if (!up) {
          d[o] = 243; d[o + 1] = 197; d[o + 2] = 140; d[o + 3] = 235;
        } else {
          d[o] = 7; d[o + 1] = 6; d[o + 2] = 11; d[o + 3] = 255;
        }
      }
    }
    for (let y = 2; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (!mask[i] || !mask[i - W] || mask[i - 2 * W]) continue;
        const o = i * 4;
        d[o] = 38; d[o + 1] = 29; d[o + 2] = 20; d[o + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
  }

  buildDebug(solid) {
    if (!this.debugCanvas) {
      this.debugCanvas = document.createElement('canvas');
      this.debugCanvas.width = W;
      this.debugCanvas.height = H;
    }
    const g = this.debugCanvas.getContext('2d');
    const img = g.createImageData(W, H);
    const d = img.data;
    for (let i = 0; i < W * H; i++) {
      if (!solid[i]) continue;
      const o = i * 4;
      d[o] = 0; d[o + 1] = 255; d[o + 2] = 150; d[o + 3] = 70;
    }
    g.putImageData(img, 0, 0);
  }

  draw(o) {
    const ctx = this.ctx;
    const { level, player, t, flashColor, flashA, shake, debugOn } = o;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.save();
    if (shake > 0) {
      const s = shake * 2;
      ctx.translate(
        Math.round((Math.random() * 2 - 1) * s),
        Math.round((Math.random() * 2 - 1) * s)
      );
    }

    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#221a10');
    bg.addColorStop(0.5, '#16110b');
    bg.addColorStop(1, '#0c0a07');
    ctx.fillStyle = bg;
    ctx.fillRect(-6, -6, W + 12, H + 12);

    const cx = level.modelPos.x;
    const cy = level.modelPos.y;
    const hr = 78 + Math.sin(t * 1.3) * 5;
    const halo = ctx.createRadialGradient(cx, cy, 6, cx, cy, hr);
    halo.addColorStop(0, 'rgba(255,196,120,0.16)');
    halo.addColorStop(0.5, 'rgba(255,170,95,0.07)');
    halo.addColorStop(1, 'rgba(255,160,80,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, W, H);

    for (const m of this.motes) {
      const y = ((m.y - t * m.sp) % H + H) % H;
      const a = m.a * (0.55 + 0.45 * Math.sin(t * 2 + m.ph));
      ctx.fillStyle = `rgba(255,214,160,${a.toFixed(3)})`;
      ctx.fillRect(Math.round(m.x), Math.round(y), 1, 1);
    }

    for (const r of level.ledges) {
      ctx.fillStyle = '#1a1510';
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.fillStyle = '#35291d';
      ctx.fillRect(r.x, r.y + 1, r.w, 1);
      ctx.fillStyle = '#5b4a36';
      ctx.fillRect(r.x, r.y, r.w, 1);
      ctx.fillStyle = 'rgba(0,0,0,.3)';
      ctx.fillRect(r.x, r.y + r.h - 1, r.w, 1);
    }

    for (const hz of level.hazards) {
      const n = Math.max(1, Math.floor(hz.w / 8));
      const tw = hz.w / n;
      const glowA = 0.18 + 0.09 * Math.sin(t * 3);
      const gg = ctx.createLinearGradient(0, hz.y - 10, 0, hz.y + 4);
      gg.addColorStop(0, 'rgba(255,110,30,0)');
      gg.addColorStop(1, `rgba(255,120,40,${glowA.toFixed(3)})`);
      ctx.fillStyle = gg;
      ctx.fillRect(hz.x, hz.y - 10, hz.w, 14);

      const tg = ctx.createLinearGradient(0, hz.y, 0, hz.y + hz.h);
      tg.addColorStop(0, 'rgba(255,132,48,0.95)');
      tg.addColorStop(0.45, 'rgba(96,38,15,0.92)');
      tg.addColorStop(1, 'rgba(20,14,10,0.95)');
      ctx.fillStyle = tg;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const bx = hz.x + i * tw;
        ctx.moveTo(bx, hz.y + hz.h);
        ctx.lineTo(bx + tw / 2, hz.y);
        ctx.lineTo(bx + tw, hz.y + hz.h);
      }
      ctx.fill();
    }

    const e = level.exit;
    const ex = e.x + e.w / 2;
    const ey = e.y + e.h / 2;
    const pu = 0.5 + 0.5 * Math.sin(t * 2.2);
    const er = 16 + pu * 7;
    const eg = ctx.createRadialGradient(ex, ey, 2, ex, ey, er);
    eg.addColorStop(0, `rgba(255,206,140,${(0.32 + 0.16 * pu).toFixed(3)})`);
    eg.addColorStop(1, 'rgba(255,190,110,0)');
    ctx.fillStyle = eg;
    ctx.fillRect(ex - er, ey - er, er * 2, er * 2);
    ctx.fillStyle = 'rgba(8,6,5,0.88)';
    ctx.fillRect(e.x, e.y, e.w, e.h);
    ctx.strokeStyle = `rgba(255,214,150,${(0.5 + 0.3 * pu).toFixed(3)})`;
    ctx.lineWidth = 1;
    ctx.strokeRect(e.x + 0.5, e.y + 0.5, e.w - 1, e.h - 1);
    ctx.fillStyle = `rgba(255,200,130,${(0.25 + 0.15 * pu).toFixed(3)})`;
    ctx.fillRect(e.x + 1, e.y + e.h - 2, e.w - 2, 1);

    ctx.drawImage(this.shadowCanvas, 0, 0);

    this._drawPlayer(ctx, player);

    const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.42, W / 2, H / 2, H * 0.95);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);

    if (debugOn) this._drawDebug(ctx, level, player);

    if (flashA > 0) {
      ctx.globalAlpha = Math.min(1, flashA);
      ctx.fillStyle = flashColor;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  _drawPlayer(ctx, player) {
    const sq = player.squash || 0;
    const pw = Math.round(player.w * (1 + 0.5 * sq));
    const ph = Math.max(3, Math.round(player.h * (1 - 0.35 * sq)));
    const px = Math.round(player.x + (player.w - pw) / 2);
    const py = Math.round(player.y + player.h - ph);

    const gx = px + pw / 2;
    const gy = py + ph;
    const gl = ctx.createRadialGradient(gx, gy, 1, gx, gy, 9);
    gl.addColorStop(0, 'rgba(255,176,100,0.22)');
    gl.addColorStop(1, 'rgba(255,160,90,0)');
    ctx.fillStyle = gl;
    ctx.fillRect(gx - 10, gy - 10, 20, 20);

    if (player.vy > 90) {
      ctx.fillStyle = 'rgba(255,190,130,0.2)';
      ctx.fillRect(px + 1, py - 4, Math.max(1, pw - 2), 4);
    }

    ctx.fillStyle = '#08070b';
    ctx.fillRect(px, py, pw, ph);

    ctx.fillStyle = 'rgba(246,198,140,0.95)';
    ctx.fillRect(px, py, pw, 1);

    ctx.fillStyle = 'rgba(246,198,140,0.28)';
    if (player.facing >= 0) ctx.fillRect(px + pw - 1, py + 1, 1, Math.max(1, ph - 2));
    else ctx.fillRect(px, py + 1, 1, Math.max(1, ph - 2));

    const ey = py + Math.max(1, Math.round(ph * 0.3));
    if (pw >= 3 && ey < py + ph - 1) {
      ctx.fillStyle = '#ffe9bd';
      const e1 = player.facing >= 0 ? px + pw - 2 : px;
      ctx.fillRect(e1, ey, 1, 1);
      const e2 = player.facing >= 0 ? px + pw - 1 : px + 1;
      ctx.fillRect(e2, ey, 1, 1);
    }
  }

  _drawDebug(ctx, level, player) {
    if (this.debugCanvas) ctx.drawImage(this.debugCanvas, 0, 0);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(80,180,255,0.9)';
    for (const r of level.ledges) ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
    ctx.strokeStyle = 'rgba(255,80,80,0.9)';
    for (const hz of level.hazards) ctx.strokeRect(hz.x + 0.5, hz.y + 0.5, hz.w - 1, hz.h - 1);
    ctx.strokeStyle = 'rgba(255,240,80,0.95)';
    ctx.strokeRect(level.exit.x + 0.5, level.exit.y + 0.5, level.exit.w - 1, level.exit.h - 1);
    ctx.strokeStyle = 'rgba(255,80,220,0.95)';
    ctx.strokeRect(level.spawn.x + 0.5, level.spawn.y + 0.5, 4, 8);
    ctx.strokeStyle = 'rgba(0,255,255,0.95)';
    ctx.strokeRect(player.x + 0.5, player.y + 0.5, player.w - 1, player.h - 1);
  }
}
