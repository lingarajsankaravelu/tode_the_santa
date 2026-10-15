import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const MODEL_PATH = '/models/tode.glb';
const MODEL_SCALE = 20;

export function createPlayer() {
  const player = new THREE.Group();
  player.position.set(0, 0, 0);

  const loader = new GLTFLoader();

  loader.load(MODEL_PATH, (gltf) => {
    const model = gltf.scene;

    model.scale.setScalar(MODEL_SCALE);
    // Z is up in this game, so every loaded model is tipped a quarter turn.
    model.rotation.x = Math.PI / 2;

    // Lift the model so its lowest point rests on the ground plane.
    const box = new THREE.Box3().setFromObject(model);
    model.position.z = -box.min.z;

    player.add(model);
  });

  return player;
}
