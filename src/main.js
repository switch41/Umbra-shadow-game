import * as THREE from 'three';
import { W, H, PHYS } from './config.js';
import { Silhouetter } from './silhouette.js';
import { Player, makeSolid, stampRects, rectSolid, respawnPlayer } from './physics.js';
import { loadModel } from './models.js';
import { LEVELS, ENDING_LINE } from './levels.js';
import { Input } from './input.js';
import { Sfx } from './audio.js';
import { pathExists, solveLevel, findPath } from './solver.js';
import { Hud } from './hud.js';
import { World } from './world.js';
import { Preview } from './preview.js';
import { loadBest, saveBest } from './store.js';

const MASK_INTERVAL = 1 / 30;
const TURN_UNIT = 0.5;
const TAU = Math.PI * 2;

const wrap = (a) => ((a % TAU) + TAU) % TAU;
const wrapPi = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const overlap = (ax, ay, aw, ah, r) =>
  ax < r.x + r.w && ax + aw > r.x && ay < r.y + r.h && ay + ah > r.y;

const gameCanvas = document.getElementById('game');
const hud = new Hud();
const world = new World(gameCanvas);
const sfx = new Sfx();
const input = new Input();

const silRenderer = new THREE.WebGLRenderer({
  canvas: document.createElement('canvas'),
  antialias: false,
  alpha: false,
});
silRenderer.setPixelRatio(1);
silRenderer.setSize(W, H, false);
const silhouetter = new Silhouetter(silRenderer);

const preview = new Preview(document.getElementById('inset'));
preview.bind(silhouetter.scene);

const params = new URLSearchParams(location.search);
const botOn = params.has('auto');
const qLevel = parseInt(params.get('level') || '1', 10);
const startIndex = Number.isFinite(qLevel)
  ? Math.min(LEVELS.length, Math.max(1, qLevel)) - 1
  : 0;

let levelIndex = startIndex;
let level = LEVELS[levelIndex];
let player = new Player(level.spawn);
let pivot = null;
let solid = makeSolid();
let state = 'loading';
let loadToken = 0;
let yaw = 0;
let pitch = 0;
let turnAcc = 0;
let turns = 0;
let timer = 0;
let winT = 0;
let deathT = 0;
let totals = { time: 0, turns: 0 };
let poseDirty = false;
let lastMask = -10;
let solidCount = 0;
let debugOn = false;
let pathAt = -10;
let pathOk = false;
let pathFresh = false;
let flashColor = '#000000';
let flashA = 0;
let shake = 0;
let stepT = 0;
let paused = botOn ? false : document.hidden;
let fps = 0;
let fpsFrames = 0;
let fpsAt = 0;
let lastT = performance.now() / 1000;
let acc = 0;

const bot = {
  phase: 'rot',
  path: null,
  edges: null,
  idx: 0,
  idxT: 0,
  attemptIdx: 0,
  attempts: 0,
  timer: 0,
  logT: 0,
  pathT: 0,
  waitT: 0,
  needPath: true,
  restarts: 0,
  fail: false,
  failT: 0,
  passed: 0,
};

function fitStage() {
  const stage = document.getElementById('stage');
  const s = Math.min(window.innerWidth / W, window.innerHeight / H);
  const scale = s >= 1 ? Math.floor(s) : s;
  stage.style.width = `${Math.round(W * scale)}px`;
  stage.style.height = `${Math.round(H * scale)}px`;
  preview.resize();
}
window.addEventListener('resize', fitStage);
fitStage();

function unlock() {
  if (sfx._ensure()) sfx.startPad();
  window.removeEventListener('pointerdown', unlock);
  window.removeEventListener('keydown', unlock);
}
window.addEventListener('pointerdown', unlock);
window.addEventListener('keydown', unlock);

document.addEventListener('visibilitychange', () => {
  paused = document.hidden && !botOn;
  lastT = performance.now() / 1000;
  acc = 0;
  if (sfx.ctx) {
    if (document.hidden) sfx.ctx.suspend();
    else sfx.ctx.resume();
  }
});

function disposeModel(root) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.geometry?.dispose();
    const m = o.material;
    if (Array.isArray(m)) m.forEach((x) => x.dispose());
    else m?.dispose();
  });
}

function findFlame(root) {
  let found = null;
  root.traverse((o) => {
    if (found || !o.isMesh) return;
    const m = o.material;
    if (m && m.emissive && m.transparent) found = m;
  });
  return found;
}

function setPose(ny, np) {
  yaw = wrap(ny);
  pitch = np;
  if (pivot) {
    pivot.rotation.y = yaw;
    pivot.rotation.x = pitch;
  }
}

function recomputeMask() {
  if (!pivot || !player) return;
  const mask = silhouetter.compute(pivot);
  solid.set(mask);
  stampRects(solid, level.ledges);
  world.buildShadow(mask);
  solidCount = 0;
  for (let i = 0; i < solid.length; i++) if (solid[i]) solidCount++;
  if (debugOn) world.buildDebug(solid);
  pathFresh = false;
  if (state === 'play' && rectSolid(solid, player.x, player.y, player.w, player.h)) {
    if (!player.depenetrate(solid)) die('crush');
  }
  poseDirty = false;
  lastMask = performance.now() / 1000;
}

async function loadLevel(index) {
  const token = ++loadToken;
  state = 'loading';
  levelIndex = index;
  level = LEVELS[index];
  hud.setLevel(level);
  hud.intro(level);

  const root = await loadModel(level.model);
  if (token !== loadToken) {
    disposeModel(root);
    return;
  }

  if (pivot) {
    silhouetter.scene.remove(pivot);
    disposeModel(pivot);
  }
  pivot = new THREE.Group();
  pivot.rotation.order = 'YXZ';
  pivot.position.set(level.modelPos.x - W / 2, H / 2 - level.modelPos.y, 0);
  pivot.add(root);
  silhouetter.scene.add(pivot);
  preview.setPivot(pivot, root.getObjectByName('blades'), findFlame(root));

  const qYaw = parseFloat(params.get('yaw'));
  const qPitch = parseFloat(params.get('pitch'));
  const base = level.start || { yaw: 0, pitch: 0 };
  const iy = Number.isFinite(qYaw) ? (qYaw * Math.PI) / 180 : base.yaw;
  const ip = Number.isFinite(qPitch) ? (qPitch * Math.PI) / 180 : base.pitch || 0;
  setPose(iy, ip);
  player = new Player(level.spawn);
  solid = makeSolid();
  turnAcc = 0;
  turns = 0;
  timer = 0;
  winT = 0;
  deathT = 0;
  stepT = 0;
  flashA = 0;
  shake = 0;
  hud.setTurns(0, level.par.turns);
  hud.setTime(0);

  state = 'play';
  recomputeMask();
  if (botOn) botInit();
  if (sfx.ctx && !sfx.muted && !sfx.padNodes) sfx.startPad();
}

function die(cause) {
  if (state !== 'play') return;
  state = 'dying';
  deathT = 0;
  shake = 1;
  if (cause === 'crush') {
    sfx.crush();
    flashColor = '#5e1a08';
  } else if (cause === 'hazard') {
    sfx.die();
    flashColor = '#7a1c08';
  } else {
    sfx.die();
    flashColor = '#3a1008';
  }
  flashA = 0.5;
}

function win() {
  if (state !== 'play') return;
  state = 'win';
  winT = 0;
  totals.time += timer;
  totals.turns += turns;
  sfx.chime();
  sfx.stopPad();
  if (botOn) {
    bot.passed++;
    bot.restarts = 0;
    console.log(`[umbra] AUTO lvl${level.id} PASS t=${timer.toFixed(1)} turns=${turns}`);
  }
  const prevBest = loadBest(level.id);
  const isBest = saveBest(level.id, timer, turns);
  hud.complete({
    name: level.name,
    time: timer,
    turns,
    par: level.par,
    best: isBest ? null : prevBest,
    isBest,
  });
}

function advance() {
  sfx.ui();
  if (levelIndex + 1 < LEVELS.length) {
    loadLevel(levelIndex + 1);
  } else {
    state = 'ending';
    if (botOn) console.log(`[umbra] AUTO-DONE ${bot.passed}/${LEVELS.length - startIndex}`);
    hud.ending({ line: ENDING_LINE, time: totals.time, turns: totals.turns });
    if (sfx.ctx && !sfx.muted && !sfx.padNodes) sfx.startPad();
  }
}

function doHint() {
  const lines = [];
  if (level.axes !== 'auto') {
    const dy = wrapPi(level.solved.yaw - yaw);
    if (Math.abs(dy) > 0.04) {
      const deg = Math.round((Math.abs(dy) * 180) / Math.PI);
      lines.push(`the light must turn ${dy > 0 ? '↻' : '↺'} ${deg}°`);
    } else {
      lines.push('the yaw is true');
    }
  }
  if (level.axes !== 'yaw') {
    const dp = level.solved.pitch - pitch;
    if (Math.abs(dp) > 0.04) {
      const deg = Math.round((Math.abs(dp) * 180) / Math.PI);
      lines.push(`tilt the light ${dp > 0 ? '↓' : '↑'} ${deg}°`);
    } else {
      lines.push('the tilt is true');
    }
  }
  lines.push(`— ${level.flavor}`);
  hud.hint(lines, 4.5);
  sfx.ui();
}

async function doSolve() {
  if (state !== 'play') return;
  const prev = { yaw, pitch };
  state = 'solving';
  hud.hint(['the light searches…', '(shift+h — solver)'], 30);
  let res;
  try {
    res = await solveLevel(
      level,
      (y, p) => {
        setPose(y, p);
        return silhouetter.compute(pivot);
      },
      { firstOnly: true, yieldEvery: 6, yawStep: Math.PI / 24, pitchStep: Math.PI / 16 }
    );
  } catch (err) {
    console.error(err);
    res = { found: false, checked: 0, pose: null };
  }
  setPose(prev.yaw, prev.pitch);
  poseDirty = true;
  state = 'play';
  if (res.found && res.pose) {
    const lines = [`solution found — ${res.checked} poses tried`];
    const dy = wrapPi(res.pose.yaw - prev.yaw);
    if (Math.abs(dy) > 0.04) {
      lines.push(`turn ${dy > 0 ? '↻' : '↺'} ${Math.round((Math.abs(dy) * 180) / Math.PI)}°`);
    }
    if (level.axes !== 'yaw') {
      const dp = res.pose.pitch - prev.pitch;
      if (Math.abs(dp) > 0.04) {
        lines.push(`tilt ${dp > 0 ? '↓' : '↑'} ${Math.round((Math.abs(dp) * 180) / Math.PI)}°`);
      }
    }
    hud.hint(lines, 6);
  } else {
    hud.hint([`no path found — ${res.checked} poses tried`], 6);
  }
  sfx.ui();
}

function handleKeys() {
  const jump = input.pressed.has('Space');
  const adv = jump || input.pressed.has('Enter');
  const h = input.pressed.has('KeyH');
  const shiftH = h && (input.held('ShiftLeft') || input.held('ShiftRight'));
  const r = input.pressed.has('KeyR');
  const m = input.pressed.has('KeyM');
  const g = input.pressed.has('KeyG');
  input.endFrame();

  if (m) {
    const off = sfx.toggleMute();
    if (!off && !sfx.padNodes && sfx.ctx) sfx.startPad();
    hud.hint([off ? 'sound off' : 'sound on'], 1.5);
  }

  if (g) {
    debugOn = !debugOn;
    hud.showDebug(debugOn);
    if (debugOn) {
      world.buildDebug(solid);
      pathFresh = false;
      pathAt = -10;
    }
  }

  if (state === 'solving') return { jump: false };

  if (r) {
    sfx.ui();
    hud.setDebug('');
    loadLevel(levelIndex);
    return { jump: false };
  }

  if (state === 'play') {
    if (h) {
      if (shiftH) doSolve();
      else doHint();
    }
    return { jump };
  }

  if (adv) {
    if (state === 'win') {
      advance();
    } else if (state === 'ending') {
      totals = { time: 0, turns: 0 };
      sfx.ui();
      loadLevel(startIndex);
    }
  }
  return { jump: false };
}

function botInit() {
  bot.phase = level.axes === 'auto' ? 'walk' : 'rot';
  bot.path = null;
  bot.edges = null;
  bot.idx = 0;
  bot.idxT = 0;
  bot.attemptIdx = 0;
  bot.attempts = 0;
  bot.timer = 0;
  bot.logT = 0;
  bot.pathT = 0;
  bot.waitT = 0;
  bot.needPath = true;
  bot.fail = false;
  bot.failT = 0;
}

function botFail(msg) {
  if (bot.fail) return;
  bot.fail = true;
  bot.failT = 0;
  bot.restarts = 0;
  console.log(`[umbra] AUTO lvl${level.id} FAIL ${msg}`);
}

function refreshPath() {
  bot.needPath = false;
  bot.path = null;
  bot.edges = null;
  bot.idx = 0;
  if (!player.grounded) return;
  const cx = Math.round(player.x);
  const cr = Math.round(player.y + PHYS.PH);
  const p = findPath(level, solid, { at: { x: cx, r: cr }, trace: botOn });
  if (p) {
    bot.path = p.nodes;
    bot.edges = p.edges;
  } else if (botOn && bot.timer - (bot.lastNullLog ?? 0) > 1) {
    bot.lastNullLog = bot.timer;
    console.log(`[umbra] PATHNULL lvl${level.id} at ${cx},${cr}`);
  }
}

function botTick(dt) {
  if (bot.fail) {
    bot.failT += dt;
    if (bot.failT >= 1.2 && state === 'play') advance();
    return;
  }
  bot.timer += dt;
  const auto = level.axes === 'auto';
  if (bot.timer > (auto ? 90 : 50)) {
    botFail(`timeout ${bot.timer.toFixed(0)}s at ${player.x.toFixed(0)},${player.y.toFixed(0)}`);
    return;
  }
  if (bot.phase !== 'walk') return;

  bot.pathT += dt;
  if (bot.needPath || (auto && bot.pathT >= 0.5)) {
    bot.pathT = 0;
    if (player.grounded || bot.needPath) refreshPath();
  }
  if (!bot.path) {
    bot.waitT += dt;
    if (bot.waitT > (auto ? 45 : 5)) {
      if (!auto && bot.restarts < 2) {
        bot.restarts++;
        console.log(
          `[umbra] AUTO lvl${level.id} RESTART ${bot.restarts} (no path at ${player.x.toFixed(0)},${player.y.toFixed(0)})`
        );
        loadLevel(levelIndex);
        return;
      }
      botFail(`no path at ${player.x.toFixed(0)},${player.y.toFixed(0)} t=${bot.timer.toFixed(0)}`);
    }
    return;
  }
  bot.waitT = 0;
  bot.idxT += dt;

  if (!auto && bot.idxT > 3) {
    bot.idxT = 0;
    bot.attempts++;
    bot.attemptIdx = bot.idx;
    bot.needPath = true;
    if (bot.attempts > 4) {
      const t = bot.path[bot.idx];
      botFail(
        `stuck idx ${bot.idx}/${bot.path.length} at ${player.x.toFixed(0)},${player.y.toFixed(0)}` +
          ` tgt ${t.x},${t.r} edge=${bot.edges[bot.idx - 1] ?? 'start'} row=${Math.round(player.y + PHYS.PH)}`
      );
      return;
    }
  }

  if (bot.timer - bot.logT >= 5) {
    bot.logT = bot.timer;
    const t = bot.path[Math.min(bot.idx, bot.path.length - 1)];
    console.log(
      `[umbra] AUTO-BOT lvl${level.id} t=${bot.timer.toFixed(0)} pos=${player.x.toFixed(0)},${player.y.toFixed(0)}` +
        ` idx=${bot.idx}/${bot.path.length} tgt=${t.x},${t.r} edge=${bot.edges[bot.idx - 1] ?? 'start'}` +
        ` gnd=${player.grounded} att=${bot.attempts}`
    );
  }
}

function botRot() {
  if (bot.phase === 'walk') {
    if (level.axes !== 'auto') return null;
    const dp = (level.solved.pitch ?? 0) - pitch;
    if (Math.abs(dp) > 0.02) return { yaw: 0, pitch: Math.sign(dp) };
    return null;
  }
  if (bot.phase !== 'rot') return null;
  const dy = wrapPi(level.solved.yaw - yaw);
  const dp = (level.solved.pitch ?? 0) - pitch;
  const ry = Math.abs(dy) > 0.02 ? Math.sign(dy) : 0;
  const rp = level.axes !== 'yaw' && Math.abs(dp) > 0.02 ? Math.sign(dp) : 0;
  if (ry === 0 && rp === 0) {
    bot.phase = 'walk';
    bot.needPath = true;
    return null;
  }
  return { yaw: ry, pitch: rp };
}

function botControl() {
  const c = { move: 0, jump: false, jumpHeld: false };
  if (bot.fail || bot.phase !== 'walk' || !bot.path) return c;
  if (bot.idx >= bot.path.length) {
    bot.needPath = true;
    return c;
  }
  const px = player.x;
  const rowNow = Math.round(player.y + PHYS.PH);
  const t = bot.path[bot.idx];
  const dx = t.x - px;
  const dr = t.r - rowNow;
  const isJump = bot.edges[bot.idx - 1] === 'jump';
  const first = bot.idx === 0;
  const last = bot.idx === bot.path.length - 1;
  const tol = first ? 4 : isJump ? 7 : last ? 0.6 : 3;
  const rowTol = first ? 3 : isJump ? 3 : 1;
  if (Math.abs(dx) <= tol && Math.abs(dr) <= rowTol && player.grounded) {
    bot.idx++;
    bot.idxT = 0;
    if (bot.idx > bot.attemptIdx) bot.attempts = 0;
    if (bot.idx >= bot.path.length) {
      bot.needPath = true;
      return c;
    }
  }
  const t2 = bot.path[bot.idx];
  if (bot.edges[bot.idx - 1] === 'jump') {
    const origin = bot.path[bot.idx - 1];
    const odx = origin.x - px;
    if (!player.grounded) {
      c.move = Math.sign(t2.x - px) || 1;
      c.jumpHeld = true;
      return c;
    }
    if (Math.abs(odx) > 3.5) {
      c.move = Math.sign(odx);
      return c;
    }
    c.move = Math.sign(t2.x - origin.x) || 1;
    c.jump = true;
    c.jumpHeld = true;
    return c;
  }
  const dx2 = t2.x - px;
  c.move = Math.abs(dx2) < 0.6 ? 0 : Math.sign(dx2);
  return c;
}

function step(dt, jumpEdge) {
  if (state === 'dying') {
    deathT += dt;
    if (deathT >= 0.7) {
      respawnPlayer(player, level);
      if (rectSolid(solid, player.x, player.y, player.w, player.h)) player.depenetrate(solid);
      state = 'play';
    }
    return;
  }
  if (state === 'win') {
    winT += dt;
    if (winT >= 6) advance();
    return;
  }
  if (state !== 'play') return;

  const allowPitch = level.axes !== 'yaw';
  let rot = input.rotAxes(allowPitch);
  if (botOn) {
    botTick(dt);
    const br = botRot();
    if (br) rot = br;
  }
  let moved = 0;

  if (level.axes === 'auto') {
    setPose(yaw + level.autoSpeed * dt, pitch);
    poseDirty = true;
  } else if (rot.yaw !== 0) {
    const d = rot.yaw * PHYS.ROT_CAP * dt;
    setPose(yaw + d, pitch);
    moved += Math.abs(d);
  }
  if (rot.pitch !== 0 && allowPitch) {
    const np = Math.max(-1.15, Math.min(1.15, pitch + rot.pitch * PHYS.ROT_CAP * dt));
    moved += Math.abs(np - pitch);
    setPose(yaw, np);
  }
  if (moved > 0) {
    turnAcc += moved;
    const nt = Math.floor(turnAcc / TURN_UNIT);
    if (nt !== turns) {
      turns = nt;
      hud.setTurns(turns, level.par.turns);
    }
    poseDirty = true;
    sfx.rotateTick();
  }

  let control = { move: input.move, jump: jumpEdge, jumpHeld: input.jumpHeld };
  if (botOn) control = botControl();
  const events = { jump: false, land: false, hazard: false, fell: false };
  const res = player.update(solid, control, dt, events, level);
  if (events.jump) sfx.jump();
  if (events.land) sfx.land();
  if (res === 'dead') {
    die(events.hazard ? 'hazard' : 'fall');
    return;
  }

  if (player.grounded && input.move !== 0) {
    stepT += dt;
    if (stepT >= 0.24) {
      stepT = 0;
      sfx.step();
    }
  } else {
    stepT = 0.16;
  }

  if (overlap(player.x, player.y, player.w, player.h, level.exit)) {
    win();
    return;
  }
  timer += dt;
}

function updateDebug(t) {
  if (!pathFresh && t - pathAt >= 0.5) {
    pathAt = t;
    pathOk = pathExists(level, solid);
    pathFresh = true;
  }
  const deg = (r) => Math.round((((r * 180) / Math.PI) % 360 + 360) % 360);
  hud.setDebug(
    `fps    ${fps}\n` +
      `state  ${state}\n` +
      `yaw    ${deg(yaw)}°   pitch ${deg(pitch)}°\n` +
      `pos    ${player.x.toFixed(0)},${player.y.toFixed(0)}   v ${player.vx.toFixed(0)},${player.vy.toFixed(0)}\n` +
      `ground ${player.grounded}   solid ${solidCount}px\n` +
      `path   ${pathOk ? 'exit reachable' : 'no path'}`
  );
}

let rafPending = false;
let lastFrameAt = performance.now();

function requestFrame() {
  rafPending = true;
  requestAnimationFrame((t) => {
    rafPending = false;
    frame(t);
  });
}

function frame(now) {
  lastFrameAt = now;
  if (!rafPending) requestFrame();
  const t = now / 1000;
  let dt = t - lastT;
  lastT = t;
  if (!(dt > 0) || dt > 0.25) dt = 0.25;

  fpsFrames++;
  if (t - fpsAt >= 1) {
    fps = fpsFrames;
    fpsFrames = 0;
    fpsAt = t;
  }

  const keys = handleKeys();

  if (!paused) {
    acc += dt;
    let n = 0;
    while (acc >= PHYS.DT && n < 10) {
      step(PHYS.DT, keys.jump);
      acc -= PHYS.DT;
      n++;
    }
    if (acc > PHYS.DT * 10) acc = 0;
  }

  if (state === 'play' && poseDirty && t - lastMask >= MASK_INTERVAL) recomputeMask();

  flashA = Math.max(0, flashA - dt * 1.7);
  shake = Math.max(0, shake - dt * 2.4);

  if (debugOn) updateDebug(t);

  world.draw({ level, player, t, flashColor, flashA, shake, debugOn });
  preview.render(t, dt);
  hud.setTime(timer);
}

const PHASES = [0, 0.7, 1.4, 2.1, 2.8, 3.5, 4.2, 4.9, 5.6];

function phasePath(L, y, p) {
  setPose(y, p);
  const phases = L.autoSpeed ? PHASES : [0];
  for (const ph of phases) {
    if (preview.blades) preview.blades.rotation.z = ph;
    if (pathExists(L, silhouetter.compute(pivot))) return true;
  }
  return false;
}

async function runTune() {
  for (let i = 0; i < LEVELS.length; i++) {
    await loadLevel(i);
    state = 'solving';
    const L = LEVELS[i];
    const allowPitch = L.axes !== 'yaw';
    const phases = L.autoSpeed ? PHASES : [0];
    const yaws = [];
    for (let a = 0; a < Math.PI * 2 - 1e-4; a += Math.PI / 12) yaws.push(a);
    const pitches = allowPitch ? [-1.125, -0.75, -0.375, 0, 0.375, 0.75, 1.125] : [0];

    const sp = L.start || { yaw: 0, pitch: 0 };
    const startOk = phasePath(L, sp.yaw, sp.pitch || 0);

    let checked = 0;
    const found = [];
    outer: for (const y of yaws) {
      for (const p of pitches) {
        for (const ph of phases) {
          setPose(y, p);
          if (preview.blades) preview.blades.rotation.z = ph;
          const mask = silhouetter.compute(pivot);
          checked++;
          if (checked % 6 === 0) await new Promise((r) => setTimeout(r, 0));
          if (pathExists(L, mask)) {
            found.push({ y, p, ph });
            if (found.length >= 6) break outer;
          }
        }
      }
    }
    const fmt = (o) =>
      `{ yaw: ${+o.y.toFixed(4)}, pitch: ${+o.p.toFixed(4)}${L.autoSpeed ? ', phase: ' + +o.ph.toFixed(3) : ''} }`;
    console.log(
      `[umbra] TUNE lvl${L.id} "${L.name}" start=${startOk} checked=${checked} found=${found.length} :: ` +
        found.map(fmt).join(' | ')
    );
  }
  console.log('[umbra] TUNE-DONE');
  state = 'ending';
}

async function runProbe() {
  for (let i = 0; i < LEVELS.length; i++) {
    await loadLevel(i);
    state = 'solving';
    const L = LEVELS[i];
    const sp = L.start || { yaw: 0, pitch: 0 };
    const poses = [
      ['start', sp.yaw, sp.pitch || 0],
      ['solved', L.solved.yaw, L.solved.pitch],
    ];
    for (const [tag, py, pp] of poses) {
      setPose(py, pp);
      recomputeMask();
      const bfs = {};
      const ok = pathExists(L, solid, bfs);
      const dead = (bfs.deadEnds || [])
        .slice()
        .sort((a, b) => b.x - a.x)
        .slice(0, 14)
        .map((d) => `${d.x}@${d.r}`)
        .join(' ');
      const mask = silhouetter.clean;
      let minX = W, maxX = -1, minY = H, maxY = -1, count = 0;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          if (!mask[y * W + x]) continue;
          count++;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
      console.log(
        `[umbra] STAT lvl${L.id} ${tag} path=${ok} bfs nodes=${bfs.nodes} maxX=${bfs.maxX} ` +
          `${bfs.hitExit ? 'EXIT' : bfs.noStart ? 'NOSTART' : 'exhausted'} ` +
          `bbox=x[${minX}..${maxX}] y[${minY}..${maxY}] px=${count} ` +
          `ledges=L(${L.ledges[0].x}+${L.ledges[0].w}@y${L.ledges[0].y}) R(${L.ledges[1].x}+${L.ledges[1].w}@y${L.ledges[1].y}) ` +
          `spawn=${L.spawn.x},${L.spawn.y} exit=${L.exit.x},${L.exit.y}` +
          (ok ? '' : ` | dead: ${dead}`)
      );
      for (let y = 30; y < H; y++) {
        let row = '';
        let any = false;
        for (let x = 0; x < W; x++) {
          const idx = y * W + x;
          let ch = '.';
          if (mask[idx]) ch = '#';
          else if (solid[idx]) ch = '-';
          else if (y >= L.exit.y && y < L.exit.y + L.exit.h && x >= L.exit.x && x < L.exit.x + L.exit.w) ch = 'x';
          else if (y >= L.spawn.y && y < L.spawn.y + 8 && x >= L.spawn.x && x < L.spawn.x + 4) ch = 's';
          if (ch !== '.') any = true;
          row += ch;
        }
        if (any) console.log(`[umbra] MAP lvl${L.id} ${tag} r${String(y).padStart(3, '0')} ${row}`);
      }
    }
  }
  console.log('[umbra] PROBE-DONE');
  state = 'ending';
}

async function runVerify() {
  const out = [];
  for (let i = 0; i < LEVELS.length; i++) {
    await loadLevel(i);
    state = 'solving';
    const L = LEVELS[i];
    const sp = L.start || { yaw: 0, pitch: 0 };
    const startOk = phasePath(L, sp.yaw, sp.pitch || 0);
    const solvedOk = phasePath(L, L.solved.yaw, L.solved.pitch);
    const line = `VERIFY lvl${L.id} "${L.name}" start=${startOk} solved=${solvedOk}`;
    out.push(line);
    console.log(`[umbra] ${line}`);
  }
  const good = out.filter((l) => l.includes('solved=true')).length;
  console.log(`[umbra] VERIFY-DONE ${good}/${LEVELS.length} solved poses valid`);
  state = 'ending';
}

hud.loading();
if (params.has('tune')) {
  runTune().catch((err) => console.error('[umbra] TUNE-ERR', err));
} else if (params.has('probe')) {
  runProbe().catch((err) => console.error('[umbra] PROBE-ERR', err));
} else if (params.has('verify')) {
  runVerify().catch((err) => console.error('[umbra] VERIFY-ERR', err));
} else {
  loadLevel(startIndex).catch((err) => console.error(err));
}
requestFrame();
setInterval(() => {
  const now = performance.now();
  if (now - lastFrameAt > 50) frame(now);
}, 33);
