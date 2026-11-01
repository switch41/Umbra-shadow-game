# UMBRA

A shadow platformer. Rotate the 3D model, reshape its silhouette, and walk on the
darkness it casts. Five hand-calibrated levels, no combat — the puzzle is the light.

Built with three.js + Vite. The playable world is a 320×180 pixel canvas; the model
lives in a small WebGL inset that you spin to change the shadow.

## Play

```sh
npm install
npm run dev
```

Open the printed URL (default http://localhost:5173).

| Input | Action |
| --- | --- |
| ← → | rotate the model (yaw) |
| ↑ ↓ | tilt the model (pitch) |
| A D | walk |
| SPACE | jump / advance |
| H | hint (shows the light's true angle) |
| G | debug overlay (collision grid, BFS reachability) |
| M | mute |
| R | restart level |

Shift+H runs the built-in solver (dumps a suggested turn/tilt).

URL params for development/testing:

- `?level=N` — start at level N
- `?yaw=deg&pitch=deg` — force a pose
- `?auto=1` — bot playthrough of every level (logs `AUTO lvlN PASS/FAIL`)
- `?verify=1` — check every level's start pose is unsolvable and solved pose bridges
- `?probe=1` — ASCII collision maps + BFS stats
- `?tune=1` — pose auto-tuner sweep

## Checks

```sh
npm run check          # physics probe + level topology + best-time store
npm run check:physics  # walk speed, jump apex/airtime vs spec
npm run check:levels   # every level has a spawn→exit path
npm run check:store    # localStorage best-time roundtrip/tiebreak/corruption
npm run build          # production build → dist/
```

## How it works

1. `silhouette.js` renders the model orthographically into an offscreen 320×180
   target and reads back a binary mask.
2. `physics.js` stamps that mask (plus static ledges) into a collision grid;
   the player is a 4×8 rectangle walking that grid at a fixed 120 Hz step.
3. `solver.js` runs BFS over "standable" cells with walk and jump edges, so
   levels can be verified solvable and the bot/auto-test can play them.
4. `levels.js` defines each level's model, start/solved pose, ledges, spawn,
   exit, and hazards. The solved pose is what the level is *tuned* around —
   the player still has to find it.

## Project layout

```
index.html        shell + HUD markup + styles
src/
  main.js         game loop, state machine, rotation, bot, dev harnesses
  config.js       screen size, physics constants
  physics.js      player integrator + collision grid
  silhouette.js   model → binary mask
  solver.js       BFS path solver (also used by ?verify/?probe/?auto)
  levels.js       the five levels
  models.js       procedural stand-ins (drop GLBs in public/models/ later)
  world.js        2D renderer (sky, shadow mask, player, hazards)
  preview.js      3D inset renderer
  hud.js          DOM HUD / overlays
  input.js        keyboard + on-screen touch controls
  store.js        localStorage best times
  audio.js        WebAudio blips + pad
scripts/
  check-physics.mjs   physics spec probe
  check-levels.mjs    static topology check
  check-store.mjs     best-time store assertions
```

## License

MIT
