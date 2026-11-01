# UMBRA — Work Log

Append-only. Newest entries at the bottom of each section.

## Done

### 2026-10-31 (session 1 — audit)
- Read all 8 existing modules (`config`, `physics`, `silhouette`, `solver`, `models`,
  `levels`, `input`, `audio`) — architecture is sound: 320×180 screen, 120 Hz fixed-step
  platformer, orthographic silhouette render → binary mask → collision grid → BFS solver.
- Found blocker: `index.html` loads `/src/main.js`, which does not exist → game cannot run.
- Found bug: `silhouette.js compute()` renders `this.scene` but never adds the model to it
  → mask would come back empty.
- Confirmed `three@0.180` MSAA readback caveat: `readRenderTargetPixels()` reads the
  *multisampled* FBO directly (`WebGLRenderer.js:2858`), no auto-resolve. Mitigation:
  resolve via blit before read, or drop `SIL.SAMPLES` to 0.
- No git commits yet (branch `master`, zero commits). `node_modules` present,
  `three` + `vite` installed. No `models/` dir → GLTF fallback to procedural models is OK.

### 2026-10-31 (session 2 — build)
- `WORKLOG.md` created (this file).
- `src/silhouette.js`: model now attached to the silhouette scene, material swap wrapped
  in `try/finally`; `SIL.SAMPLES` dropped 4→0 (three r180 `readRenderTargetPixels` reads
  the multisampled FBO with no resolve — aliased mask is the intended crisp look).
- `index.html`: HUD / hint / overlay / debug markup + styles added; hintbar per-level text.
- New: `src/hud.js`, `src/world.js`, `src/preview.js`, `src/main.js`.
  - `world.js` — 2D renderer: sky gradient, lamplight halo, dust motes, ledges, hazard
    teeth, shadow mask (cached ImageData + warm top edge), player sprite with squash +
    ember eyes, exit lantern, vignette, debug overlay.
  - `preview.js` — second WebGL context on `#inset`, perspective orbit cam + 3 lights,
    spinning windmill blades, flickering lantern flame.
  - `hud.js` — level name / timer / turns vs par, hint lines, completion + ending
    overlays, debug readout (DOM text).
  - `main.js` — fixed 120 Hz accumulator, state machine
    `loading→play→dying→win→ending`, rotation (yaw/pitch/auto) with turn counting,
    mask→solid pipeline (dirty + 30 Hz throttle), crush/depenetrate, death/respawn,
    exit detection, `pathExists` debug, hint from `level.solved`, Shift+H async solver.
- `src/solver.js`: `solveLevel()` now optional-yields (`opts.yieldEvery`) so the
  debug solver doesn't freeze the tab.

### 2026-10-31 (session 3 — level calibration)
- Dev URL params in `main.js`: `?level=N`, `?yaw/?pitch=deg`, `?verify=1`,
  `?probe=1` (ASCII collision maps + BFS stats incl. dead-end coords), `?tune=1`
  (pose auto-tuner). All log `[umbra] ...` for the headless-Chrome harness.
- `scripts/check-levels.mjs`: Node topology check — all 5 levels pass (spawn free,
  gap crossable); no runtime needed.
- Diagnosed unsolvable levels via probe dead-ends:
  - L2 needed a 30px climb; `JUMP=170` apex is 28.9px → missed by 1px.
  - L4's lantern neck blocked its own roof at `pitch 0` → needs tilt (foreshortening).
  - L1/L5 shadows too small to reach the far ledge at `MODEL_TARGET=92`.
- Fixes: `PHYS.JUMP` 170→176, `MODEL_TARGET` 92→112.
- Built `?tune=1` sweep (yaw×pitch×blade-phase, phase-scanned for `autoSpeed` levels);
  found real solvable poses for all 5 levels. Patched `levels.js`:
  - L1 `start {yaw: π/2}` (π/2 yaw proven unsolvable), `solved {π, 0}` kept.
  - L2 `solved {0.2618, -1.125}`, L3 `start {yaw: π/2}`, `solved {0,0}` kept,
    L4 `solved {0.2618, 0.75}`, L5 `solved {0, -1.125}` (works at 3/9 blade phases).
  - New optional `level.start` pose — `loadLevel` uses it (overridden by `?yaw/?pitch`).
- **`?verify=1` → 5/5: every level's start pose is unsolvable and its solved pose
  bridges spawn→exit** (phase-scanned for L5). Screenshot confirms L1 start shadow
  floats disconnected between ledges.
- `npm run build` green (vite, ~606 kB chunk = three.js only, warning expected).

### 2026-10-31 (session 4 — automated playthrough)
- `?auto=1`: in-page bot that rotates to `level.solved` (rate-limited like a human),
  then follows a BFS path (`findPath()` in solver.js, returns nodes+edge types from any
  anchor cell) using the real `Player` physics — walk, jump, land, respawn — through
  every level's exit, level after level. Logs `AUTO lvlN PASS/FAIL`, `AUTO-DONE x/y`,
  with 5s progress telemetry (`AUTO-BOT`) and BFS/PATHNULL traces.
- Headless harness discovery: under `--virtual-time-budget`, rAF is starved (page idle
  fast-forward; only `setTimeout`-driven code runs — that's why `?verify/?probe/?tune`
  worked but gameplay didn't). Fixed with a watchdog: a 33ms `setInterval` drives
  `frame()` whenever the last frame is >50ms old; rAF stays primary in real browsers
  (`requestFrame()` guard prevents pending-queue pileup). `paused` forced off in auto mode.
- Bot bugs fixed during bring-up: path anchor row off-by-one (`y+PH` not `y+PH-1` —
  BFS rows are solid surface rows), same off-by-one in arrival checks, loose first-node
  tolerance (path[0] may be a different near-stand than the player cell), no-path
  restart fallback (≤2), pitch assist on `axes:'auto'` levels.
- **Real gameplay bug found & fixed**: the `axes:'auto'` rotation branch never set
  `poseDirty` → level 5's shadow mask froze after pitch settled (auto-yaw terrain never
  updated; preview spun but the playable silhouette was static). `?verify` missed it
  because it computes masks explicitly.
- **`?auto=1` → AUTO-DONE 5/5**: every level beaten end-to-end by real physics —
  L1 10.6s/3t, L2 9.2s/2t, L3 10.4s/3t, L4 6.6s/1t, L5 14.8s/2t (all under par).

### 2026-11-01 (session 5 — physics/bot correctness + first commit)
- **Real gameplay bug found & fixed** (`physics.js`): `_moveH`/`_moveV` quantized
  sub-pixel motion to whole pixels per call → walk ran at 120px/s (spec 45) and jump
  rose 55px (spec ~31). The old 5/5 auto pass was accidental — the bot overshot into
  exits. Fixed with cross-frame fractional accumulators (`_xr`/`_yr` in `reset()`,
  `Math.trunc` stepping, remainder carried) plus a floor probe so landing still
  snaps on fractional positions.
- `PHYS.JUMP` 176→180: integer apex rise was 29px worst-case at 176 vs the solver's
  ~31px node assumption; at 180 worst-case is exactly 31px (6 ground phases swept).
- **Bot coordinate-convention fix** (`main.js`, `solver.js`): solver nodes are
  player *left-edge* x (`exitReached` checks `x+PW-1`, `collides` takes left edge)
  but `spawnStands` and the bot seeded/compared against player *center* — a
  systematic 2px bias. That stranded the L3 bot on a dead-end shadow sliver and
  froze L4's at x=265 (needs ≥267 to touch its exit). All sites now use left-edge;
  final path node uses 0.6px tolerance so the bot walks until `overlap()` fires.
- **`?auto=1` → AUTO-DONE 5/5** with corrected physics: L1 7.7s/3t, L2 6.6s/2t,
  L3 11.7s/3t, L4 6.6s/1t, L5 14.0s/2t.
- Verification tooling promoted to permanent checks: `scripts/check-physics.mjs`
  (walk 45.00px/s, jump rise 31px, air 0.708s) + existing `check-levels.mjs`;
  `npm run check` runs both. One-off jump sweep probe deleted.
- Cleanup: dead `src/render2d.js` deleted (superseded by `world.js`, zero imports);
  `.gitignore` added (`node_modules/`, `dist/`, `_*.log`, `_*.png`).
- **First git commit** (single initial import of the verified working game —
  no pre-fix baseline reconstructed; history lives in this log).

### 2026-11-01 (session 6 — public repo + features)
- Pushed to https://github.com/switch41/Game (identity `switch41`).
  Declined a request to fabricate ~200 padded commits; history is real work only.
- `README.md`: play instructions, controls table, dev URL params, check commands,
  architecture walkthrough, project layout.
- **Best times** (`src/store.js`): per-level best time/turns in localStorage
  (`umbra.best.v1`); faster time wins, turns break ties; corrupt-JSON and
  storage-throw fallbacks. Complete overlay shows `NEW BEST` or previous best;
  in-play stats line shows `best m:ss`. `scripts/check-store.mjs` — 18 node
  assertions, wired into `npm run check`.
- **Touch controls**: `Input.press/release` + `bindTouch()` map on-screen buttons
  onto the same key codes as the keyboard (shared move/jump/rotAxes logic).
  Fixed bottom bar shown only under `pointer:coarse`; tilt hidden on yaw-only
  levels, rotate hidden on auto-spin levels (`data-axes` set in `Hud.setLevel`);
  hintbar hidden there. DOM verified in headless dump.
- **Fall tracking**: per-level death counter (reset on load, `++` in `die()`);
  complete overlay `FALL n` when >0; ending screen `TOTAL FALLS`.
- **CI** (`.github/workflows/ci.yml`): push/PR → node 22, `npm ci`,
  `npm run check` + `npm run build`.
- **Favicon/meta**: `public/favicon.svg` (lamp + cast-shadow mark),
  theme-color, description, `viewport-fit=cover` for safe-area touch padding.
- Verification each step: `npm run check` green, `vite build` green,
  `?auto=1` still reaches AUTO-DONE 5/5 (occasional headless restarts on
  spawn-path timing are pre-existing and self-heal via the restart fallback).

### 2026-11-01 (session 7 — hosting)
- Vercel first (project `switch41/umbra`, SSO protection disabled so the
  site is public) — but user chose Cloudflare Workers as the host instead.
- **Cloudflare Workers static assets** (free, `*.workers.dev` like the
  user's existing sites): installed wrangler 4.x, OAuth login,
  `wrangler.jsonc` (`name: umbra`, assets from `dist/`, no worker script).
- **Live: https://umbra.kushalparihar013.workers.dev** — verified by
  fetching the page (game shell + touch controls present) and by running
  `?auto=1` against production: AUTO-DONE 5/5.
- `npm run deploy` = `vite build && wrangler deploy`; `.wrangler/` ignored.
- README links the live URL + deploy command; everything pushed to GitHub.

## Pending

- [ ] Runtime playtest in a real browser (`npm run dev` → http://localhost:5173):
      feel of `JUMP=180` / corrected walk speed, all 5 levels beatable by hand,
      ending screen, audio, keyboard + touch controls, best-time display.
- [ ] Optional later: `public/models/*.glb` hand-made models.
