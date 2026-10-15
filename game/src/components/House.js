import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { isPositionFree } from './Collision.js';

const MODEL_PATH = '/models/small_house.glb';
const MODEL_SCALE = 65;

const HOUSE_COUNT = 3;
// Houses are scattered within this distance of the origin on each axis. Short
// of the 220 the enemy spawn corners sit at, so a monster never materialises
// inside a wall and spends the run shoving at it.
const PLACEMENT_RANGE = 170;
// Kept clear around Tode's start, which is also where a restart drops him back
// in. Comfortably more than one hop, so he always has somewhere to go.
const ORIGIN_CLEARANCE = 140;
// Three houses loose in a 340-unit square land on the first or second try
// nearly always; the cap is only there so an unlucky seed cannot spin.
const MAX_PLACEMENT_ATTEMPTS = 100;

const loader = new GLTFLoader();

// The placed houses. Exported as the obstacle list that Movement and Enemies
// test their next step against.
export const houses = [];

function randomCoordinate() {
  return THREE.MathUtils.randFloatSpread(PLACEMENT_RANGE * 2);
}

/**
 * Picks somewhere this house can stand: clear of Tode's start, and clear of
 * the houses already placed.
 *
 * Falls back to the last candidate that at least missed Tode. Three houses in
 * the open is not a packing problem, so the fallback is a formality, but a
 * house overlapping another is survivable scenery while a house on the player
 * is an unwinnable run.
 */
function findPlacement(house) {
  let fallback = null;

  for (let attempt = 0; attempt < MAX_PLACEMENT_ATTEMPTS; attempt += 1) {
    const x = randomCoordinate();
    const y = randomCoordinate();

    if (Math.hypot(x, y) < ORIGIN_CLEARANCE) continue;

    if (isPositionFree(house, x, y, houses)) return { x, y };

    fallback = { x, y };
  }

  return fallback ?? { x: PLACEMENT_RANGE, y: PLACEMENT_RANGE };
}

function createHouse(model) {
  const house = new THREE.Group();

  model.scale.setScalar(MODEL_SCALE);
  // Z is up in this game, so every loaded model is tipped a quarter turn.
  model.rotation.x = Math.PI / 2;
  // A quarter turn's worth of variety, so the three do not all face the same
  // way. In Euler XYZ order this one is applied inside the tip above, which
  // makes it a yaw in world space -- the same trick Movement.js uses to turn
  // Tode and Enemies.js to turn the monsters.
  model.rotation.y = Math.floor(Math.random() * 4) * (Math.PI / 2);

  // Measured after both rotations, so the box is the one the house actually
  // occupies, then lifted to put its lowest point exactly on ground level.
  const box = new THREE.Box3().setFromObject(model);
  model.position.z = -box.min.z;

  house.add(model);
  // Exposed for Collision.js, which measures the footprint off the model
  // rather than the group.
  house.model = model;

  return house;
}

/**
 * Loads the house model once and scatters HOUSE_COUNT copies across the map
 * group.
 *
 * Asynchronous, so `houses` stays empty for the first few frames. That is the
 * same deal the enemy list already offers, and an empty obstacle list simply
 * blocks nothing.
 */
export function createHouses(map) {
  loader.load(MODEL_PATH, (gltf) => {
    for (let index = 0; index < HOUSE_COUNT; index += 1) {
      // Cloned rather than loaded three times. small_house.glb is a single
      // static mesh with no skeleton, which is the case clone() handles
      // cleanly -- unlike enemy.glb, whose bones it would share.
      const house = createHouse(gltf.scene.clone());
      const { x, y } = findPlacement(house);

      house.position.set(x, y, 0);

      map.add(house);
      houses.push(house);
    }
  });

  return houses;
}
