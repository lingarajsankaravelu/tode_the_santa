import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createAnimator } from './Animation.js';
import { createSantaSuit } from './SantaSuit.js';
import { createSleighLights } from './SleighLights.js';
import { START_ALTITUDE, MODEL_BASE_ROTATION } from './Movement.js';
import { asset } from '../assets.js';

// The player is the sleigh. Tode rides in it, and the hop is gone -- see
// `hackathon/skeleton/sleigh/spec.md`.
const SLEIGH_PATH = asset('models/snow_sleigh.glb');
const TODE_PATH = asset('models/tode.glb');
// The EMPTY one, and that is the story rather than a placeholder: the storm
// took the gifts before the game starts, so the sack is empty until Tode
// catches them back. `christmas_gift_sack.glb` is its full counterpart: the
// fifth catch fills it and `core_loop/gift_delivery/spec.md` empties it again,
// both through `setSackFull` below.
const SACK_PATH = asset('models/empty_christmas_sack.glb');
// Its full counterpart, loaded alongside it rather than fetched at the moment
// of the swap: `core_loop/gift_catch/spec.md` fills the sack on the fifth
// catch, and a 2 MB load starting on that frame would hitch exactly as the
// game hands out its reward. Both sacks ride the carriage and one is visible.
const FULL_SACK_PATH = asset('models/christmas_gift_sack.glb');

// The file is 4.638 x 1.552 x 1.669 in its own units, so this makes it
// 74.2 long x 24.8 tall x 26.7 wide, of which the carriage is 31.3 x 20.0 x
// 20.1 -- and the length is what matters here, because Tode is 8.3 deep and
// the sack 6.7, so the two of them take 15 of those 31.3 and ride one behind
// the other with room between.
//
// Up from 9.7 in two steps. At 9.7 the sleigh was 45 long and Tode was taller
// than the whole vehicle; at 13 he fitted but was the only thing in it.
const SLEIGH_SCALE = 16;
// Down from the 16 he had as the player, where he was 16.0 wide and 16.0 tall
// to the tip of the hat. 11 puts him at 11.0 wide and 11.0 tall in a carriage
// 20.1 across whose floor-to-top is 14.1 -- comfortably inside it, with his
// hat below the rim line. A passenger is smaller than what carries them.
const TODE_SCALE = 11;
// The empty sack is 1.5647 x 1.7185 x 1.5298 in its own units, so 4.4 makes
// it 6.9 x 7.6 x 6.7: about two thirds of Tode's height, which is the size a
// sack reads as when it belongs to someone rather than being cargo.
const SACK_SCALE = 4.4;

// The sleigh's true extent in its own units, and it is a CONSTANT because
// `Box3.setFromObject` cannot measure this model. Twelve of its meshes are
// skinned, and glTF requires a skinned mesh node's own transform to be
// ignored -- so three.js leaves that geometry sitting in bind space at a
// matrix that has nothing to do with where it draws. Asked for this model's
// box, three.js answers 241.5 x 593.3 x 138.2 centred at (-102.3, 355.6,
// 59.4). The truth, from walking the node transforms of the unskinned
// geometry, is below. Recentring on the former puts the sleigh several
// hundred units from the player and it is simply never on screen.
//
// Same trap, one level down, as the note in `game_story.md`: the raw numbers
// lie on multi-node models. They lie differently on skinned ones.
const SLEIGH_BOUNDS = {
  min: { x: -4.5788, y: 5.8243, z: -0.4744 },
  max: { x: 0.059, y: 7.3768, z: 1.1942 },
};

// Where Tode sits, in the sleigh's own units, measured off the carriage body
// mesh (`Polygon_Reduction_1_Material_0_0`, which spans x -4.58..-2.62 and
// y 6.13..7.38). The four pullers are at the +X end with the draft pole
// between, so the carriage is the -X end and forward is +X.
// The interior floor, about a third of the way up the carriage body. What
// stands on it is placed by its own measured box, so this is the plane rather
// than anybody's position.
const FLOOR_Y = 6.5;
// Centred across the carriage. Both riders share it.
const CENTRE_Z = 0.495;

// Lengthwise places, in the sleigh's own units. Forward is +X, so Tode takes
// the front of the carriage and the sack rides behind him. The carriage body
// spans -4.58 to -2.62; at this scale the 0.8 between these two is 12.8 world
// units against the 7.5 their two half-depths need, so they do not touch.
const SEAT_X = -3.3;
const SACK_X = -4.1;

/**
 * A point of the sleigh's own geometry, in world units, once the recentring in
 * `createPlayer` is applied. Centring matters beyond looks: the camera aims at
 * `player.position` and the gift specs measure their catch radius from it, so
 * the middle of the sleigh has to be it.
 */
function onSleigh(x, y, z) {
  return new THREE.Vector3(
    (x - (SLEIGH_BOUNDS.min.x + SLEIGH_BOUNDS.max.x) / 2) * SLEIGH_SCALE,
    (y - (SLEIGH_BOUNDS.min.y + SLEIGH_BOUNDS.max.y) / 2) * SLEIGH_SCALE,
    (z - (SLEIGH_BOUNDS.min.z + SLEIGH_BOUNDS.max.z) / 2) * SLEIGH_SCALE,
  );
}

/**
 * Stands anything on the carriage floor at a lengthwise place, by its own
 * measured box -- the same way Tode used to be stood on the ground.
 *
 * Module level rather than a closure inside the loader, so a later phase that
 * puts something else in the carriage has one definition of where the floor is
 * instead of a second copy of FLOOR_Y, CENTRE_Z and the recentring.
 *
 * Measuring at runtime is safe for these models and not for the sleigh:
 * tode.glb is one fused mesh with no skin, which is the whole reason it cannot
 * be animated and also what makes its box trustworthy, and neither sack
 * carries a skin either.
 */
export function standOnSleighFloor(object, x) {
  const at = onSleigh(x, FLOOR_Y, CENTRE_Z);

  object.position.set(at.x, at.y - new THREE.Box3().setFromObject(object).min.y, at.z);
}

/**
 * Shows the full sack or the empty one.
 *
 * `core_loop/gift_catch/spec.md` calls this on the fifth catch and
 * `gift_delivery` calls it again when the last gift leaves the sack. A no-op
 * before the glTFs land, which is the only state where neither sack exists.
 */
export function setSackFull(player, full) {
  if (!player.emptySack || !player.fullSack) return;

  player.emptySack.visible = !full;
  player.fullSack.visible = full;
  player.sack = full ? player.fullSack : player.emptySack;
}

export function createPlayer() {
  const player = new THREE.Group();
  player.position.set(0, 0, START_ALTITUDE);

  // Yaw lives here, so Movement.js can turn the sleigh without turning the
  // camera -- which is a child of the group above, not of this.
  const model = new THREE.Group();
  // Facing north, which is what `facingFor` returns for a direction of
  // +Y. Movement.js only writes this once the sleigh is actually moving, so
  // without it a run opens on a sleigh pointing along +X.
  model.rotation.y = MODEL_BASE_ROTATION;
  // Z is up in this game, so every loaded model is tipped a quarter turn.
  model.rotation.x = Math.PI / 2;

  // Roll lives one level further in. A child with no rotation of its own
  // shares its parent's axes, and the sleigh's forward is its local +X -- so
  // `tilt.rotation.x` is a roll about the nose, which is what banking is.
  // Doing it on `model` instead would fight the quarter turn above, and
  // `model.rotation.z` would be a pitch rather than a roll.
  const tilt = new THREE.Group();
  model.add(tilt);
  player.add(model);

  player.model = model;
  player.tilt = tilt;
  // False until both glTFs are in. Movement.js holds its clock still while
  // it is, so the load does not arrive as one huge first delta.
  player.ready = false;

  const loader = new GLTFLoader();

  // Both before either is used, because the animator is built once over the
  // pair of them and has to see every morph target in the group. Tode has
  // none today; the rigged asset the appearance spec specifies will.
  Promise.all([
    loader.loadAsync(SLEIGH_PATH),
    loader.loadAsync(TODE_PATH),
    loader.loadAsync(SACK_PATH),
    loader.loadAsync(FULL_SACK_PATH),
  ]).then(
    ([sleighGltf, todeGltf, sackGltf, fullSackGltf]) => {
      const sleigh = sleighGltf.scene;
      const tode = todeGltf.scene;
      const sack = sackGltf.scene;
      const fullSack = fullSackGltf.scene;

      // Dressed before it is scaled, and that order is load-bearing: the suit
      // places itself against the model's own bounding box, which is only in
      // the authored units while the transform is still identity.
      tode.add(createSantaSuit(tode));

      sleigh.scale.setScalar(SLEIGH_SCALE);

      sleigh.position.copy(onSleigh(0, 0, 0));

      // Tode is already Y-up in this frame -- `tilt` inherits the quarter
      // turn from `model`, so its own axes are the sleigh's. He faces his
      // local +Z, and a quarter turn about up swings that onto the sleigh's
      // +X, which is the way it is going.
      tode.scale.setScalar(TODE_SCALE);
      tode.rotation.y = Math.PI / 2;

      standOnSleighFloor(tode, SEAT_X);

      // Each sack is scaled and then stood on the floor by its OWN box. The
      // full one is 46% wider and 33% taller than the empty one, so the swap
      // is not a visibility toggle at one shared transform -- but it is a
      // visibility toggle between two separately stood models, which is what
      // these two lines buy.
      sack.scale.setScalar(SACK_SCALE);
      standOnSleighFloor(sack, SACK_X);

      fullSack.scale.setScalar(SACK_SCALE);
      standOnSleighFloor(fullSack, SACK_X);
      // The run opens with the storm having taken the gifts, so the sack Tode
      // sets out with is the empty one.
      fullSack.visible = false;

      tilt.add(sleigh);
      tilt.add(tode);
      tilt.add(sack);
      tilt.add(fullSack);

      // Last, and into `tilt` with the rest, so the lanterns bank with the
      // sleigh instead of hanging level over a rolling carriage. It is handed
      // `onSleigh` rather than the bounds: one definition of where the middle
      // of this model is, and it lives in this file.
      tilt.add(createSleighLights(onSleigh));

      // Both exposed for `setSackFull` above, and `player.sack` kept pointing
      // at whichever one is currently shown. Parented to the sleigh rather
      // than to `player`, which is the trap gift_delivery's spec repeats: the
      // camera is a child of `player`, so anything added there is added in
      // front of the lens.
      player.emptySack = sack;
      player.fullSack = fullSack;
      player.sack = sack;

      // Half the sleigh's own height, which is how far its underside sits
      // below `player.position`. Movement.js rests it on the snow at exactly
      // this altitude, so the runners touch the ground and nothing sinks.
      player.restAltitude = ((SLEIGH_BOUNDS.max.y - SLEIGH_BOUNDS.min.y) * SLEIGH_SCALE) / 2;

      // Set here rather than measured by Collision.js, for two reasons.
      //
      // The first is that `measureGroundRadius` uses `Box3.setFromObject`,
      // which cannot measure this model at all -- see SLEIGH_BOUNDS above.
      // Left to itself it would hand back a radius in the hundreds and the
      // sleigh would be stopped by houses it was nowhere near.
      //
      // The second is that its convention is the average of the two ground
      // half-extents, which is a good circle for a roughly round character
      // and a poor one for something 2.8 times longer than it is wide: the
      // average gives 20.5 against a nose that reaches 30.1, so the sleigh
      // would clip roofs lengthwise. The half-length is used instead. It
      // stops the sleigh a little early side-on, which is the right way round
      // for a vehicle.
      player.collisionRadius = ((SLEIGH_BOUNDS.max.x - SLEIGH_BOUNDS.min.x) * SLEIGH_SCALE) / 2;

      // One animator over both models. It finds `run` among the sleigh's
      // clips and would find Tode's shape keys in the same pass, so the
      // `setExpression('smile')` calls the gift specs make land on the same
      // object as the clip below -- no second animator, no second wiring.
      player.animator = createAnimator(model, [
        ...sleighGltf.animations,
        ...todeGltf.animations,
      ]);
      // The only clip in the file, and it animates the four pullers and
      // nothing else: 495 channels over their skeletons. Left looping even
      // when the sleigh is still, because stopping it freezes four figures
      // mid-stride, which reads worse than a team trotting on the spot.
      player.animator?.play('Run', { loop: true });

      player.ready = true;
    },
  ).catch((error) => {
    // Without this a failed load is an unhandled rejection and the game just
    // flies an invisible sleigh around, which is a worse ten minutes than an
    // error in the console.
    console.error('Player models failed to load', error);
  });

  return player;
}
