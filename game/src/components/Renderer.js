import * as THREE from 'three';

const CANVAS_SELECTOR = 'canvas.game';

export function createRenderer() {
  const canvas = document.querySelector(CANVAS_SELECTOR);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
  });

  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  // Lets a material carry its own clipping planes. Off by default, and the one
  // thing in the game that wants it is Airstrip.js, which buries all of the
  // airport bar the landing strip by cutting the pavement at the snow line.
  // This is a per-material opt-in: nothing without `clippingPlanes` set on it
  // is affected, so the rest of the scene does not know this is on.
  renderer.localClippingEnabled = true;

  return renderer;
}
