import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { asset } from '../assets.js';

const MODEL_PATH = asset('models/enemy.glb');
const MODEL_SCALE = 5;

const loader = new GLTFLoader();

export function createEnemy(position) {
  const enemy = new THREE.Group();
  enemy.position.set(position.x, position.y, 0);

  loader.load(MODEL_PATH, (gltf) => {
    const model = gltf.scene;

    model.scale.setScalar(MODEL_SCALE);
    // Z is up in this game, so every loaded model is tipped a quarter turn.
    model.rotation.x = Math.PI / 2;

    // Lift the model so its lowest point rests on the ground plane.
    const box = new THREE.Box3().setFromObject(model);
    model.position.z = -box.min.z;

    enemy.add(model);
    // Exposed so the chase code can turn the model without turning the group.
    enemy.model = model;
  });

  return enemy;
}
