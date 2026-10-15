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

  return renderer;
}
