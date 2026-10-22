import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { asset } from '../assets.js';

const MODEL_PATH = asset('models/river_landscape.glb');
// The model's flat middle has a radius of 17 in its own units, so 41 puts
// that edge at 707 -- the bound Movement.js holds Tode inside. Sized to the
// camera, not to the old floor: Camera.js can see about 2500 units out, and
// at 100 the nearest tree stood at 2250 and the mountains at 4700, so the
// whole landscape sat outside the frustum and the game looked like it was
// played on bare green. At 41 the terrain is 3280 across, the first tree is
// at 922 and the mountains at 1927, all of it in frame.
// Changing this breaks the agreement with WORLD_RADIUS; change FLAT_R in
// tools/generate_river_landscape.mjs instead.
const MODEL_SCALE = 41;
// Exported because `Terrain.js` needs it: the ground height it computes comes
// out of the generator's own maths in MODEL units, and this is the only number
// that turns those into world ones. Two copies of it would be two answers to
// where the ground is.

// Material name baked into the .glb by the generator. The water plane is the
// one mesh that must not cast: a transparent surface throwing a shadow reads
// as a dark slab lying on the riverbed.
const WATER_MATERIAL_NAME = 'Water';
// A hair below the ground plane, inherited from the floor this replaces.
// Tode's feet, the enemies' and the houses all rest at exactly z = 0, and
// coplanar surfaces shimmer. 0.05 of a unit is a hundredth of an inch at this
// scale, so it costs nothing visually.
const GROUND_Z = -0.05;

/**
 * Loads the landscape and returns the group holding it.
 *
 * This is the ground itself, not scenery standing on it. The model's flat
 * basin sits at y = 0, which after the quarter turn below is the plane Tode,
 * the enemies and the houses all stand on -- dropped by GROUND_Z so their
 * undersides are not exactly coplanar with it.
 *
 * Asynchronous, so the world is empty for the first few frames. That is the
 * same deal House.js already offers.
 */
export function createLandscape() {
  const landscape = new THREE.Group();

  const loader = new GLTFLoader();

  loader.load(MODEL_PATH, (gltf) => {
    const model = gltf.scene;

    model.scale.setScalar(MODEL_SCALE);
    // Z is up in this game, so every loaded model is tipped a quarter turn.
    model.rotation.x = Math.PI / 2;

    // GLTF meshes default to casting and receiving nothing, and a loaded .glb
    // is a tree, so the flags have to be set per mesh on the way in.
    model.traverse((child) => {
      if (!child.isMesh) return;

      child.receiveShadow = true;
      child.castShadow = child.material?.name !== WATER_MATERIAL_NAME;
    });

    model.position.z = GROUND_Z;

    landscape.add(model);
    landscape.model = model;
  });

  return landscape;
}

// Exported because `Terrain.js` needs both: the ground height it computes comes
// out of the generator's own maths in MODEL units, and these are the only two
// numbers that turn those into world ones. A second copy of either would be a
// second answer to where the ground is.
export { MODEL_SCALE as TERRAIN_SCALE, GROUND_Z };
