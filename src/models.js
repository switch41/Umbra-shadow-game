import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

function std(color, rough = 0.8, metal = 0.05) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
}

function mesh(geo, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  return m;
}

function teapot() {
  const g = new THREE.Group();
  const clay = std(0xc9885a, 0.72);
  const dark = std(0x8a5a3a, 0.7);

  const body = mesh(new THREE.SphereGeometry(20, 24, 18), clay);
  body.scale.set(1, 0.72, 1);
  g.add(body);

  g.add(mesh(new THREE.SphereGeometry(10, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), dark, 0, 12, 0));
  g.add(mesh(new THREE.SphereGeometry(3.4, 12, 10), dark, 0, 17, 0));

  const spout = mesh(new THREE.CylinderGeometry(2.4, 5.4, 26, 12), clay, 20, 7, 0);
  spout.rotation.z = -Math.PI / 2 - 0.45;
  g.add(spout);

  const handle = mesh(new THREE.TorusGeometry(13, 3.3, 10, 24, Math.PI * 1.25), dark, -18, 5, 0);
  handle.rotation.z = Math.PI * 0.38;
  g.add(handle);

  return g;
}

function chair() {
  const g = new THREE.Group();
  const wood = std(0x9a6b3f, 0.85);

  g.add(mesh(new THREE.BoxGeometry(30, 3.5, 28), wood, 0, 0, 0));

  const legGeo = new THREE.BoxGeometry(3.5, 26, 3.5);
  for (const [lx, lz] of [[-12, -11], [12, -11], [-12, 11], [12, 11]]) {
    g.add(mesh(legGeo, wood, lx, -14.5, lz));
  }

  const postGeo = new THREE.BoxGeometry(3.5, 26, 3.5);
  g.add(mesh(postGeo, wood, -12, 14.5, -12));
  g.add(mesh(postGeo, wood, 12, 14.5, -12));

  const slatGeo = new THREE.BoxGeometry(24, 3, 2.5);
  g.add(mesh(slatGeo, wood, 0, 24, -12));
  g.add(mesh(slatGeo, wood, 0, 16, -12));
  g.add(mesh(slatGeo, wood, 0, 8, -12));

  return g;
}

function bridge() {
  const g = new THREE.Group();
  const stone = std(0x8d8578, 0.9);
  const dark = std(0x6b6459, 0.9);

  g.add(mesh(new THREE.BoxGeometry(9, 36, 12), dark, -30, -14, 0));
  g.add(mesh(new THREE.BoxGeometry(9, 36, 12), dark, 30, -14, 0));

  g.add(mesh(new THREE.BoxGeometry(18, 5, 14), stone, -31, 12, 0));
  g.add(mesh(new THREE.BoxGeometry(18, 5, 14), stone, 31, 12, 0));
  g.add(mesh(new THREE.BoxGeometry(16, 5, 14), stone, 0, 16, 0));

  const post = new THREE.BoxGeometry(2.5, 9, 2.5);
  for (const px of [-36, -26, 26, 36]) g.add(mesh(post, dark, px, 19, -6));
  g.add(mesh(new THREE.BoxGeometry(16, 2.5, 2), dark, -31, 22.5, -6));
  g.add(mesh(new THREE.BoxGeometry(16, 2.5, 2), dark, 31, 22.5, -6));

  return g;
}

function lantern() {
  const g = new THREE.Group();
  const iron = std(0x4a4a52, 0.55, 0.65);
  const glass = new THREE.MeshStandardMaterial({
    color: 0xd9a441, roughness: 0.35, metalness: 0.05,
    emissive: 0xb97a20, emissiveIntensity: 0.7, transparent: true, opacity: 0.85,
  });

  g.add(mesh(new THREE.TorusGeometry(5, 1.6, 8, 18), iron, 0, 27, 0));
  g.add(mesh(new THREE.CylinderGeometry(2.6, 2.6, 7, 10), iron, 0, 20, 0));
  g.add(mesh(new THREE.ConeGeometry(13.5, 9, 4), iron, 0, 13.5, 0));
  g.add(mesh(new THREE.CylinderGeometry(9, 11, 5, 4), iron, 0, -14, 0));

  const bar = new THREE.BoxGeometry(2.2, 22, 2.2);
  const r = 7.5;
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + i * Math.PI / 2;
    g.add(mesh(bar, iron, Math.cos(a) * r, -0.5, Math.sin(a) * r));
  }
  const midBar = new THREE.BoxGeometry(1.6, 20, 1.6);
  g.add(mesh(midBar, iron, 0, -0.5, r + 2.5));
  g.add(mesh(midBar, iron, 0, -0.5, -r - 2.5));

  const flame = mesh(new THREE.SphereGeometry(4.2, 12, 10), glass, 0, -3, 0);
  flame.scale.set(1, 1.5, 1);
  g.add(flame);
  g.add(mesh(new THREE.TorusGeometry(9.5, 1.3, 6, 16), iron, 0, 9.5, 0).rotateX(Math.PI / 2));

  return g;
}

function windmill() {
  const g = new THREE.Group();
  const wood = std(0x8b6b45, 0.85);
  const cloth = std(0xd8d2c4, 0.92);
  const roof = std(0x6e4a30, 0.8);

  g.add(mesh(new THREE.CylinderGeometry(9, 15, 56, 12), wood, 0, -10, 0));
  g.add(mesh(new THREE.BoxGeometry(24, 4, 20), wood, 0, 18, 0));
  g.add(mesh(new THREE.ConeGeometry(14, 13, 8), roof, 0, 26, 0));

  const blades = new THREE.Group();
  blades.name = 'blades';
  for (let i = 0; i < 4; i++) {
    const arm = new THREE.Group();
    const b = mesh(new THREE.BoxGeometry(4.5, 40, 1.5), cloth, 2, 21, 0);
    b.rotation.z = -0.12;
    arm.add(b);
    arm.add(mesh(new THREE.BoxGeometry(2, 20, 2), wood, 0, 11, 0));
    arm.rotation.z = i * Math.PI / 2 + Math.PI / 4;
    blades.add(arm);
  }
  blades.position.set(0, 16, 12);
  g.add(blades);
  g.add(mesh(new THREE.SphereGeometry(3.6, 10, 8), wood, 0, 16, 12));

  return g;
}

const PROCEDURAL = { teapot, chair, bridge, lantern, windmill };

export const MODEL_TARGET = 112;

export function proceduralModel(name) {
  const build = PROCEDURAL[name];
  if (!build) throw new Error(`unknown model "${name}"`);
  return build();
}

function normalize(root, target = MODEL_TARGET) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const s = target / maxDim;
  root.scale.multiplyScalar(s);
  center.multiplyScalar(s);
  root.position.sub(center);
  const wrap = new THREE.Group();
  wrap.add(root);
  return wrap;
}

export async function loadModel(name) {
  try {
    const gltf = await new GLTFLoader().loadAsync(`/models/${name}.glb`);
    return normalize(gltf.scene);
  } catch {
    return normalize(proceduralModel(name));
  }
}

export function swapSilhouetteMaterial(root, material) {
  const saved = [];
  root.traverse((o) => {
    if (o.isMesh) {
      saved.push([o, o.material]);
      o.material = material;
    }
  });
  return () => {
    for (const [o, m] of saved) o.material = m;
  };
}
