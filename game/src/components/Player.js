import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const MODEL_PATH = '/models/tode.glb';
// 16 puts Tode at 16 x 12 on the ground and 10.1 tall -- about knee height
// next to the houses, which stand 80 units to the ridge. Down from 20, where
// he read as a four-and-a-half-foot frog, but back up from 12: the wider
// camera this scenery needs costs him screen size, and 12 left him an
// eleven-pixel speck. Nothing below needs adjusting -- the model is lifted by
// its own measured box, so it rests on the ground plane at any scale.
const MODEL_SCALE = 16;

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
    // Exposed so the movement code can rotate the model without turning the
    // group (and with it the child camera).
    player.model = model;
  });

  return player;
}
