import { Player, makeSolid } from '../src/physics.js';

const solid = makeSolid();
for (let x = 0; x < 320; x++) {
  for (let y = 170; y < 180; y++) solid[y * 320 + x] = 1;
}
const level = {
  hazards: [],
  ledges: [{ x: 0, y: 170, w: 320, h: 10 }],
  exit: { x: 0, y: 0, w: 1, h: 1 },
};
const ev = () => ({ jump: false, land: false, hazard: false, fell: false });
const DT = 1 / 120;

// settle on floor
const p = new Player({ x: 10, y: 162 });
for (let i = 0; i < 60; i++) p.update(solid, { move: 0, jump: false, jumpHeld: false }, DT, ev(), level);

// walk 1 second right
const x0 = p.x;
for (let i = 0; i < 120; i++) p.update(solid, { move: 1, jump: false, jumpHeld: false }, DT, ev(), level);
console.log(`walk 1s dx = ${(p.x - x0).toFixed(2)} px  (spec WALK=45 => expect 45.00)`);

// jump straight up: measure apex rise + airtime
p.x = 10;
for (let i = 0; i < 60; i++) p.update(solid, { move: 0, jump: false, jumpHeld: false }, DT, ev(), level);
const jy0 = p.y;
let minY = jy0;
let air = 0;
let first = true;
for (let i = 0; i < 400; i++) {
  p.update(solid, { move: 0, jump: first, jumpHeld: true }, DT, ev(), level);
  first = false;
  if (p.y < minY) minY = p.y;
  if (!p.grounded) air++;
  else if (air > 4) break;
}
console.log(`jump rise  = ${(jy0 - minY).toFixed(2)} px  (spec JUMP=176,g=500 => expect 30.98)`);
console.log(`jump air   = ${(air * DT).toFixed(3)} s     (spec => expect ~0.70)`);

// jump with forward held: horizontal distance
p.x = 10;
for (let i = 0; i < 60; i++) p.update(solid, { move: 0, jump: false, jumpHeld: false }, DT, ev(), level);
const jx0 = p.x;
air = 0;
first = true;
for (let i = 0; i < 400; i++) {
  p.update(solid, { move: 1, jump: first, jumpHeld: true }, DT, ev(), level);
  first = false;
  if (!p.grounded) air++;
  else if (air > 4) break;
}
console.log(`jump dx    = ${(p.x - jx0).toFixed(2)} px  over ${(air * DT).toFixed(3)} s  (spec 45px/s => expect ~31.5)`);
