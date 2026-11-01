import { LEVELS } from '../src/levels.js';
import { pathExists } from '../src/solver.js';
import { makeSolid, stampRects, rectSolid } from '../src/physics.js';

let failed = 0;

for (const level of LEVELS) {
  const mask = makeSolid();

  const left = level.ledges[0];
  const right = level.ledges[1];
  const x0 = left.x + left.w;
  const x1 = right.x;
  const rise = right.y - left.y;

  for (let x = x0; x <= x1; x++) {
    const f = x1 === x0 ? 0 : (x - x0) / (x1 - x0);
    const top = Math.round(left.y + rise * f);
    for (let y = top; y <= left.y + 14 && y < 180; y++) mask[y * 320 + x] = 1;
  }

  const solid = makeSolid();
  solid.set(mask);
  stampRects(solid, level.ledges);

  const sx = Math.round(level.spawn.x);
  const sy = Math.round(level.spawn.y);
  const spawnInSolid = rectSolid(solid, sx, sy, 4, 8);

  const ok = pathExists(level, mask);
  const status = ok && !spawnInSolid ? 'OK  ' : 'FAIL';
  if (status === 'FAIL') failed++;
  console.log(
    `${status} level ${level.id} "${level.name}"  path=${ok}  spawnBlocked=${spawnInSolid}  ` +
      `gap ${x0}->${x1} rise=${rise}`
  );
}

console.log(failed ? `\n${failed} LEVEL(S) FAILED` : '\nALL LEVELS TOPOLOGY OK');
process.exit(failed ? 1 : 0);
