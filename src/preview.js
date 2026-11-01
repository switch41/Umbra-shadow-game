import * as THREE from 'three';
import { MODEL_TARGET } from './models.js';

export class Preview {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.camera = new THREE.PerspectiveCamera(32, 4 / 3, 1, 3000);
    this.scene = null;
    this.pivot = null;
    this.blades = null;
    this.flameMat = null;
    this.lights = [];
    this.resize();
  }

  bind(scene) {
    if (this.scene === scene) return;
    this.scene = scene;
    const amb = new THREE.HemisphereLight(0x9fb4d8, 0x40280f, 0.55);
    const key = new THREE.DirectionalLight(0xfff2dd, 1.6);
    const fill = new THREE.DirectionalLight(0x7fa0ff, 0.35);
    const lamp = new THREE.PointLight(0xffa347, 1.5, 0, 0);
    scene.add(amb, key, fill, lamp);
    this.lights = [key, fill, lamp];
  }

  setPivot(pivot, blades, flameMat) {
    this.pivot = pivot;
    this.blades = blades || null;
    this.flameMat = flameMat || null;
    const p = pivot.position;
    this.lights[0].position.set(p.x + 150, p.y + 180, 270);
    this.lights[0].target.position.copy(p);
    this.lights[1].position.set(p.x - 190, p.y - 50, -140);
    this.lights[1].target.position.copy(p);
    this.lights[2].position.set(p.x, p.y - 130, 95);
    if (this.lights[0].target.parent === null) {
      this.scene.add(this.lights[0].target, this.lights[1].target);
    }
    this.dist = MODEL_TARGET * 3.1;
  }

  resize() {
    const w = this.canvas.clientWidth || 96;
    const h = this.canvas.clientHeight || 72;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  render(t, dt) {
    if (!this.scene || !this.pivot) return;
    const p = this.pivot.position;
    const dist = this.dist || MODEL_TARGET * 3.1;
    const ang = -0.4 + Math.sin(t * 0.13) * 0.14;
    this.camera.position.set(
      p.x + Math.sin(ang) * dist,
      p.y + dist * 0.22 + Math.sin(t * 0.21) * dist * 0.03,
      p.z + Math.cos(ang) * dist
    );
    this.camera.lookAt(p.x, p.y, p.z);

    if (this.blades) this.blades.rotation.z = -t * 1.3;
    if (this.flameMat) {
      this.flameMat.emissiveIntensity = 0.6 + Math.sin(t * 9) * 0.12 + Math.random() * 0.07;
    }

    this.renderer.render(this.scene, this.camera);
  }
}
