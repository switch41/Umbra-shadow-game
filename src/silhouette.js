import * as THREE from 'three';
import { W, H, SIL } from './config.js';
import { swapSilhouetteMaterial } from './models.js';

export class Silhouetter {
  constructor(renderer) {
    this.renderer = renderer;

    this.rt = new THREE.WebGLRenderTarget(W, H, {
      depthBuffer: false,
      stencilBuffer: false,
      samples: SIL.SAMPLES,
    });

    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-W / 2, W / 2, H / 2, -H / 2, 0.1, 600);
    this.camera.position.set(0, 0, 300);
    this.camera.lookAt(0, 0, 0);

    this.black = new THREE.MeshBasicMaterial({ color: 0x000000, fog: false });

    this.pixels = new Uint8Array(W * H * 4);
    this.mask = new Uint8Array(W * H);
    this.clean = new Uint8Array(W * H);
    this.visited = new Int32Array(W * H);
    this.stamp = 0;

    this._clearColor = new THREE.Color();
    this._clearAlpha = null;
  }

  compute(modelGroup) {
    const r = this.renderer;
    if (modelGroup.parent !== this.scene) this.scene.add(modelGroup);

    const restore = swapSilhouetteMaterial(modelGroup, this.black);

    r.getClearColor(this._clearColor);
    this._clearAlpha = r.getClearAlpha();

    try {
      r.setRenderTarget(this.rt);
      r.setClearColor(0xffffff, 1);
      r.clear(true, false, false);
      r.render(this.scene, this.camera);
      r.readRenderTargetPixels(this.rt, 0, 0, W, H, this.pixels);
    } finally {
      r.setRenderTarget(null);
      r.setClearColor(this._clearColor, this._clearAlpha);
      restore();
    }

    const src = this.pixels;
    const mask = this.mask;
    for (let y = 0; y < H; y++) {
      const row = (H - 1 - y) * W;
      for (let x = 0; x < W; x++) {
        const i = (row + x) * 4;
        const lum = (src[i] + src[i + 1] + src[i + 2]) / 3;
        mask[y * W + x] = lum < SIL.THRESHOLD ? 1 : 0;
      }
    }

    const out = this.clean;
    out.set(mask);
    this._fillHoles(out);
    this._removeSpecks(out, SIL.MIN_SPECK);
    return out;
  }

  _fillHoles(buf) {
    for (let p = 0; p < SIL.HOLE_PASSES; p++) {
      const adds = [];
      for (let y = 1; y < H - 1; y++) {
        for (let x = 1; x < W - 1; x++) {
          const i = y * W + x;
          if (buf[i]) continue;
          let n = 0;
          if (buf[i - 1]) n++;
          if (buf[i + 1]) n++;
          if (buf[i - W]) n++;
          if (buf[i + W]) n++;
          if (n >= 3) adds.push(i);
        }
      }
      for (const i of adds) buf[i] = 1;
    }
  }

  _removeSpecks(buf, minSize) {
    const visited = this.visited;
    const stamp = ++this.stamp;
    const stack = [];
    for (let start = 0; start < W * H; start++) {
      if (!buf[start] || visited[start] === stamp) continue;
      stack.length = 0;
      stack.push(start);
      visited[start] = stamp;
      const comp = [];
      let head = 0;
      while (head < stack.length) {
        const i = stack[head++];
        comp.push(i);
        const x = i % W;
        const y = (i / W) | 0;
        if (x > 0 && buf[i - 1] && visited[i - 1] !== stamp) { visited[i - 1] = stamp; stack.push(i - 1); }
        if (x < W - 1 && buf[i + 1] && visited[i + 1] !== stamp) { visited[i + 1] = stamp; stack.push(i + 1); }
        if (y > 0 && buf[i - W] && visited[i - W] !== stamp) { visited[i - W] = stamp; stack.push(i - W); }
        if (y < H - 1 && buf[i + W] && visited[i + W] !== stamp) { visited[i + W] = stamp; stack.push(i + W); }
      }
      if (comp.length < minSize) {
        for (const i of comp) buf[i] = 0;
      }
    }
  }
}
