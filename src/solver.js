import { W, H, PHYS } from './config.js';
import { makeSolid, stampRects } from './physics.js';

const PW = PHYS.PW;
const PH = PHYS.PH;

function standable(solid, x, r) {
  if (x < 0 || x >= W || r < 0 || r >= H) return false;
  if (!solid[r * W + x]) return false;
  if (r > 0 && solid[(r - 1) * W + x]) return false;
  return true;
}

function findStand(solid, x, rFrom, rMin, rMax) {
  for (let r = Math.max(0, rMin); r <= Math.min(H - 1, rMax); r++) {
    if (standable(solid, x, r)) return r;
  }
  return -1;
}

function collides(solid, px, py) {
  const x0 = Math.floor(px);
  const y0 = Math.floor(py);
  if (x0 < 0 || y0 < 0 || x0 + PW - 1 >= W || y0 + PH - 1 >= H) return true;
  for (let y = y0; y < y0 + PH; y++) {
    const row = y * W;
    for (let x = x0; x < x0 + PW; x++) {
      if (solid[row + x]) return true;
    }
  }
  return false;
}

function jumpLand(solid, x, r, dir) {
  let px = x;
  let py = r - PH + 1;
  let vy = -PHYS.JUMP;
  const vx = dir * PHYS.WALK;
  const dt = 1 / 60;
  for (let t = 0; t < 1.4; t += dt) {
    vy = Math.min(PHYS.TERMINAL, vy + PHYS.GRAVITY * dt);
    px += vx * dt;
    py += vy * dt;
    if (px < 0 || px > W - PW) return null;
    if (py > H) return null;
    if (collides(solid, px, py)) {
      let fix = 0;
      while (fix < PH + 2 && collides(solid, px, py - fix)) fix++;
      if (fix >= PH + 2) return null;
      const landX = Math.round(px);
      const landR = Math.round(py - fix) + PH - 1;
      if (landX < 0 || landX >= W) return null;
      if (standable(solid, landX, landR)) return { x: landX, r: landR };
      const s = findStand(solid, landX, landR, landR - 2, landR + 3);
      if (s >= 0) return { x: landX, r: s };
      return null;
    }
  }
  return null;
}

function buildSolid(level, mask) {
  const solid = makeSolid();
  solid.set(mask);
  stampRects(solid, level.ledges);
  return solid;
}

function spawnStands(solid, level) {
  const sx = Math.round(level.spawn.x);
  const sr = Math.round(level.spawn.y + PH);
  const out = [];
  for (let dx = -2; dx <= 2; dx++) {
    const s = findStand(solid, sx + dx, sr, sr - 6, sr + 8);
    if (s >= 0) out.push({ x: sx + dx, r: s });
  }
  return out;
}

function exitReached(level, x, r) {
  const py = r - PH + 1;
  const e = level.exit;
  return x + PW - 1 >= e.x && x < e.x + e.w && py + PH - 1 >= e.y && py < e.y + e.h;
}

export function pathExists(level, mask, dbg = null) {
  const solid = buildSolid(level, mask);
  const starts = spawnStands(solid, level);
  const stats = { nodes: 0, maxX: -1, hitExit: false };
  const track = (x) => {
    stats.nodes++;
    if (x > stats.maxX) stats.maxX = x;
  };

  if (!starts.length) {
    if (dbg) Object.assign(dbg, stats, { noStart: true });
    return false;
  }

  const key = (x, r) => r * W + x;
  const seen = new Set();
  const queue = [];
  if (dbg) dbg.deadEnds = [];
  for (const s of starts) {
    const k = key(s.x, s.r);
    if (!seen.has(k)) {
      seen.add(k);
      queue.push(s);
      track(s.x);
      if (exitReached(level, s.x, s.r)) {
        if (dbg) Object.assign(dbg, stats, { hitExit: true });
        return true;
      }
    }
  }

  let head = 0;
  while (head < queue.length && queue.length < 60000) {
    const { x, r } = queue[head++];
    const push = (nx, nr) => {
      if (nx < 0 || nx >= W || nr < 8 || nr >= H) return 0;
      const k = key(nx, nr);
      if (seen.has(k)) return 0;
      if (!standable(solid, nx, nr)) return 0;
      seen.add(k);
      queue.push({ x: nx, r: nr });
      track(nx);
      if (exitReached(level, nx, nr)) {
        if (dbg) Object.assign(dbg, stats, { hitExit: true });
        return 2;
      }
      return 1;
    };

    let progressed = false;
    for (const dir of [-1, 1]) {
      const nx = x + dir;
      const walked = findStand(solid, nx, r, r - PHYS.STEP_UP, r + PHYS.SNAP_DOWN + 1);
      if (walked >= 0) {
        const ok = push(nx, walked);
        if (ok === 2) return true;
        if (ok) progressed = true;
      }
      const landed = jumpLand(solid, x, r, dir);
      if (landed) {
        const ok = push(landed.x, landed.r);
        if (ok === 2) return true;
        if (ok) progressed = true;
      }
    }
    if (!progressed && dbg && dbg.deadEnds.length < 60) {
      dbg.deadEnds.push({ x, r });
    }
  }
  if (dbg) Object.assign(dbg, stats, { exhausted: true });
  return false;
}

function nearStands(solid, x, r) {
  const out = [];
  for (let dr = -8; dr <= 6; dr++) {
    for (let dx = -4; dx <= 4; dx++) {
      const nx = x + dx;
      const nr = r + dr;
      if (standable(solid, nx, nr)) out.push({ x: nx, r: nr, d: Math.abs(dx) + Math.abs(dr) * 1.5 });
    }
  }
  out.sort((a, b) => a.d - b.d);
  return out.slice(0, 12);
}

export function findPath(level, mask, opts = {}) {
  const solid = buildSolid(level, mask);
  const starts = opts.at ? nearStands(solid, opts.at.x, opts.at.r) : spawnStands(solid, level);
  if (opts.trace) {
    console.log(
      `[umbra] BFS from ${opts.at ? `${opts.at.x},${opts.at.r}` : 'spawn'} starts=${starts.length}` +
        (starts.length ? ` first=${starts[0].x},${starts[0].r}` : '')
    );
  }
  if (!starts.length) return null;

  const key = (x, r) => r * W + x;
  const seen = new Set();
  const prev = new Map();
  const queue = [];
  for (const s of starts) {
    const k = key(s.x, s.r);
    if (seen.has(k)) continue;
    seen.add(k);
    queue.push(s);
    prev.set(k, null);
    if (exitReached(level, s.x, s.r)) return chain(k, prev);
  }

  let head = 0;
  while (head < queue.length && queue.length < 60000) {
    const { x, r } = queue[head++];
    const push = (nx, nr, type) => {
      if (nx < 0 || nx >= W || nr < 8 || nr >= H) return 0;
      const k = key(nx, nr);
      if (seen.has(k)) return 0;
      if (!standable(solid, nx, nr)) return 0;
      seen.add(k);
      queue.push({ x: nx, r: nr });
      prev.set(k, { p: key(x, r), type });
      if (exitReached(level, nx, nr)) return 2;
      return 1;
    };
    for (const dir of [-1, 1]) {
      const walked = findStand(solid, x + dir, r, r - PHYS.STEP_UP, r + PHYS.SNAP_DOWN + 1);
      if (walked >= 0 && push(x + dir, walked, 'walk') === 2) return chain(key(x + dir, walked), prev);
      const landed = jumpLand(solid, x, r, dir);
      if (landed && push(landed.x, landed.r, 'jump') === 2) return chain(key(landed.x, landed.r), prev);
    }
  }
  if (opts.trace) console.log(`[umbra] BFS exhausted queue=${queue.length}`);
  return null;
}

function chain(k, prev) {
  const nodes = [];
  const types = [];
  let cur = k;
  nodes.push(cur);
  while (true) {
    const e = prev.get(cur);
    if (!e) break;
    types.push(e.type);
    cur = e.p;
    nodes.push(cur);
  }
  nodes.reverse();
  types.reverse();
  return {
    nodes: nodes.map((n) => ({ x: n % W, r: Math.floor(n / W) })),
    edges: types,
  };
}

export async function solveLevel(level, computeMask, opts = {}) {
  const yawStep = opts.yawStep ?? Math.PI / 30;
  const pitchStep = opts.pitchStep ?? Math.PI / 20;
  const allowPitch = level.axes !== 'yaw';

  const saved = { yaw: 0, pitch: 0 };
  let checked = 0;

  const poses = [];
  for (let yaw = 0; yaw < Math.PI * 2 - 1e-4; yaw += yawStep) {
    if (allowPitch) {
      for (let pitch = -1.15; pitch <= 1.15 + 1e-4; pitch += pitchStep) {
        poses.push({ yaw, pitch });
      }
    } else {
      poses.push({ yaw, pitch: 0 });
    }
  }

  const results = [];
  for (const pose of poses) {
    saved.yaw = pose.yaw;
    saved.pitch = pose.pitch;
    const mask = computeMask(saved.yaw, saved.pitch);
    checked++;
    if (opts.yieldEvery && checked % opts.yieldEvery === 0) {
      await new Promise((r) => setTimeout(r, 0));
    }
    if (pathExists(level, mask)) {
      results.push({ ...pose });
      if (opts.firstOnly) return { found: true, pose, checked, results };
    }
  }
  return { found: results.length > 0, pose: results[0] ?? null, checked, results };
}
