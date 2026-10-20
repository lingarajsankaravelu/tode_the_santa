import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createAnimator } from './Animation.js';
import { createSantaSuit } from './SantaSuit.js';

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

    // Dressed before it is scaled or tipped, and that order is load-bearing:
    // the suit places itself against the model's own bounding box, which is
    // only in the model's authored units while its transform is still
    // identity. Added as a child, so it picks up the scale and the quarter
    // turn below and every yaw the movement code applies afterwards.
    model.add(createSantaSuit(model));

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
    // Null for today's tode.glb, which is a single fused mesh with no rig and
    // no shape keys, so every `player.animator?.` below it stays a no-op. It
    // becomes real the moment the asset in
    // `hackathon/skeleton/tode_the_santa/appearance/spec.md` is dropped in,
    // with no change needed here.
    player.animator = createAnimator(model, gltf.animations);
    player.animator?.play('Idle', { loop: true });
  });

  return player;
}
