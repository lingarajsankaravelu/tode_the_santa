// Continuous flight. The player is the sleigh, and it flies.
//
// This file used to be a discrete hop queue: one key press was one 80-unit
// arc, resolved against the camera, refused by scenery. That whole model is
// gone -- see `hackathon/skeleton/sleigh/spec.md`, which this implements.
// What survived the rewrite is everything that was never about hopping: the
// camera-relative key table, `facingFor`, and the world bound.
//
// `isPositionFree` is back, which the spec did not plan for. The spec kept
// `Collision.js` out of the game by never letting the sleigh below 100, and
// that stopped being true the moment E was asked to land it. Collision is now
// conditional on altitude: above the roofs there is nothing to hit and the
// test is skipped, which is the same saving by a narrower rule.
import * as THREE from 'three';
import { isPositionFree } from './Collision.js';
import { getCameraYaw } from './Camera.js';
import { isGameOver } from './GameState.js';

// How far from the origin the sleigh may get, horizontally. Unchanged, and
// deliberately so: it is tempting to lift it now that height is available --
// the bound existed because Tode was pinned at z = 0 and the ground rises
// outside the basin -- but nothing in this project samples terrain height,
// and river_landscape.glb is a mesh rather than a heightfield. Flying out
// over the hills needs a height query written first.
const WORLD_RADIUS = 700;

// Extra turn applied to the model because snow_sleigh.glb does not face +Y.
// It faces +X, measured rather than guessed: the carriage body sits at the
// -X end, the four pullers at the +X end, and the draft pole runs between
// them along X. `facingFor` is written for the glTF convention of -Z forward,
// so a +X model needs a quarter turn on top of it.
//
// This replaces the PI that today's tode.glb needed. Tode is a passenger now
// and his own facing is set once, in Player.js, rather than per frame.
const MODEL_BASE_ROTATION = Math.PI / 2;

// Top speed, horizontally. The hop covered 80 units in 0.417s, which is 192
// units/sec -- matching it means the field keeps the size it has always had
// and none of the placement numbers in the other specs need revisiting.
const CRUISE_SPEED = 200;
// Half a second from rest to cruise. Enough weight that the sleigh reads as a
// vehicle rather than a cursor, little enough that catching a gift is not a
// planning exercise.
const ACCELERATION = 420;
// Coasts to a near stop in about a second and a half once the keys go.
const DRAG = 2.2;
// Space climbs, Shift descends. Slower than cruise on purpose: altitude is
// the axis the gifts are spread along, so it should cost something to change.
const LIFT_SPEED = 120;
// How high a house stands to the ridge. This used to be the justification for
// a hard floor of 100 -- stay above the roofs and nothing can be hit -- and
// it is now the altitude at which the collision test switches on instead. The
// sleigh is measured from its CENTRE, so the comparison below adds its own
// half-height: what has to clear a roof is its underside.
const HOUSE_RIDGE = 80;
// The camera sits 409 behind and 26 degrees above; past about this the ground
// leaves the frame and the player is flying over an empty backdrop.
const MAX_ALTITUDE = 400;
// Where a run starts. In the air rather than on the snow, so the first thing
// the player does is fly rather than take off, and inside the 140-360 range
// the gifts hang in so the first one is reachable without a change of
// altitude.
const START_ALTITUDE = 200;
// The altitude a sleigh rests at when it has nothing measured on it yet --
// `player.restAltitude` is half the model's own height and is the real
// answer. This is only the floor used in the frame or two before the glTF
// lands, and it is zero because a sleigh with no height sits on the ground.
const FALLBACK_REST_ALTITUDE = 0;
// Maximum roll into a turn, in radians. The single cheapest thing that makes
// flight feel like flight.
const BANK_ANGLE = 0.45;
// Per frame, the same easing idiom as the camera's smoothing.
const BANK_SMOOTHING = 0.1;

// Same reasoning as Animation.js: the first frame after the models load
// carries the whole load, and the first frame back from a backgrounded tab
// carries the whole time away. Either would teleport the sleigh.
const MAX_DELTA = 0.1;
// Below this the heading is noise rather than a direction, and pointing the
// model at it makes a drifting stop spin on the spot.
const MIN_HEADING_SPEED = 1;

// Key -> a direction in the CAMERA'S frame: forward is away from the lens,
// strafe is ninety degrees to its right. The world direction is worked out
// each frame from wherever the mouse has left the camera, so W is always
// "away from me" on screen whichever way the view happens to be pointing.
//
// Unchanged from the hop, which is the point: this table was already exactly
// what a flight model wants.
const MOVE_KEYS = {
  KeyW: { forward: 1, strafe: 0 },
  KeyS: { forward: -1, strafe: 0 },
  KeyA: { forward: 0, strafe: -1 },
  KeyD: { forward: 0, strafe: 1 },
  ArrowUp: { forward: 1, strafe: 0 },
  ArrowDown: { forward: -1, strafe: 0 },
  ArrowLeft: { forward: 0, strafe: -1 },
  ArrowRight: { forward: 0, strafe: 1 },
};

// Altitude is its own set of keys rather than a third axis on the table
// above, because it is not camera-relative: up is up whichever way the player
// is looking.
//
// Q and E are the documented pair -- they sit next to WASD, so a hand already
// on the movement keys can change height without leaving them. Space and
// Shift are kept as aliases for anyone who reaches for them first.
//
// Space being here is temporary. `core_loop/gift_delivery/spec.md` wants it
// for the drop and `GameState.js` claims it for restart, and now that Q and E
// exist nothing is lost by unbinding it. Left in until one of those two
// actually needs it.
const CLIMB_KEYS = {
  KeyQ: 1,
  KeyE: -1,
  Space: 1,
  ShiftLeft: -1,
  ShiftRight: -1,
};

// Which keys are down right now. A set rather than the hop's queue: flight is
// a state the player holds, not a sequence of commands they issue.
const held = new Set();

// Horizontal only. Altitude is driven straight off the keys -- there is no
// momentum on the vertical axis, so letting go of Space stops the climb dead
// rather than coasting the sleigh through MAX_ALTITUDE.
const velocity = new THREE.Vector2();

let bank = 0;

const clock = new THREE.Clock();

/**
 * The yaw that points the model's nose along a ground direction.
 *
 * Written for a model whose forward is its local -Z -- the glTF convention.
 * MODEL_BASE_ROTATION carries the quarter turn the +X sleigh needs on top.
 */
function facingFor(direction) {
  return Math.atan2(-direction.x, direction.y) + MODEL_BASE_ROTATION;
}

export function initInput() {
  window.addEventListener('keydown', (event) => {
    if (!MOVE_KEYS[event.code] && !CLIMB_KEYS[event.code]) return;

    // Stops Space scrolling the page. It does not stop GameState's own
    // restart listener seeing the key -- that would take stopPropagation.
    event.preventDefault();
    held.add(event.code);
  });

  // Never gated on isGameOver, unlike the press. A key released during the
  // Game Over screen has to come off the set, or it is still held when the
  // run restarts.
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });

  // A key held while the tab loses focus never sends its keyup, and the
  // sleigh would fly off on its own while the player was elsewhere.
  window.addEventListener('blur', () => {
    held.clear();
  });
}

/**
 * Sums the held movement keys into a unit direction on the ground plane,
 * resolved against the camera. Returns null when nothing is asked for --
 * which is not the same as asking for zero, because the two are handled
 * differently: one accelerates, the other drags.
 */
function desiredDirection() {
  let forward = 0;
  let strafe = 0;

  held.forEach((code) => {
    const key = MOVE_KEYS[code];

    if (!key) return;

    forward += key.forward;
    strafe += key.strafe;
  });

  // W and S together, or A and D, cancel to nothing. Treated as no input
  // rather than as a direction of length zero.
  if (forward === 0 && strafe === 0) return null;

  const yaw = getCameraYaw();
  // The camera's own forward and right, flattened onto the ground plane.
  const forwardX = Math.sin(yaw);
  const forwardY = Math.cos(yaw);

  const x = forwardX * forward + forwardY * strafe;
  const y = forwardY * forward - forwardX * strafe;
  // Normalised, so a diagonal is not faster than a straight line.
  const length = Math.hypot(x, y);

  return { x: x / length, y: y / length };
}

/**
 * The lowest the sleigh's centre may go where it currently stands.
 *
 * On open snow that is its own half-height, which rests it on the ground. Over
 * a house it is the ridge, because a roof is in the way -- without this the
 * player could fly high over the town, press E, and descend straight through
 * one. The horizontal test below cannot catch that: it only refuses movement
 * ACROSS the ground, and this is movement down onto it.
 */
function floorFor(player, obstacles) {
  const rest = player.restAltitude ?? FALLBACK_REST_ALTITUDE;

  if (isPositionFree(player, player.position.x, player.position.y, obstacles)) {
    return rest;
  }

  return HOUSE_RIDGE + rest;
}

/** True when the sleigh's underside is low enough to strike a house. */
function canHitScenery(player) {
  return player.position.z - (player.restAltitude ?? FALLBACK_REST_ALTITUDE) < HOUSE_RIDGE;
}

function climbInput() {
  let climb = 0;

  held.forEach((code) => {
    climb += CLIMB_KEYS[code] ?? 0;
  });

  // Signed rather than summed: holding both shift keys is still one descent.
  return Math.sign(climb);
}

/**
 * Advances the horizontal velocity, and clamps it to the world circle by
 * killing the component that points out of it.
 */
function moveHorizontally(player, direction, delta, obstacles) {
  if (direction) {
    velocity.x += direction.x * ACCELERATION * delta;
    velocity.y += direction.y * ACCELERATION * delta;

    if (velocity.length() > CRUISE_SPEED) velocity.setLength(CRUISE_SPEED);
  } else {
    // Exponential rather than `velocity *= 1 - DRAG * delta`, which is the
    // same curve at 60Hz and goes negative on a long frame.
    velocity.multiplyScalar(Math.exp(-DRAG * delta));
  }

  let x = player.position.x + velocity.x * delta;
  let y = player.position.y + velocity.y * delta;

  const radius = Math.hypot(x, y);

  if (radius > WORLD_RADIUS) {
    // Pulled back onto the circle, and the outward part of the velocity is
    // removed so the sleigh slides along the bound instead of pressing into
    // it and stopping dead.
    const scale = WORLD_RADIUS / radius;

    x *= scale;
    y *= scale;

    const outward = (velocity.x * x + velocity.y * y) / WORLD_RADIUS;

    if (outward > 0) {
      velocity.x -= (outward * x) / WORLD_RADIUS;
      velocity.y -= (outward * y) / WORLD_RADIUS;
    }
  }

  // Only tested down among the buildings. Up at cruising height there is
  // nothing in the sky, and this is the saving that the old hard floor of 100
  // used to buy outright.
  if (canHitScenery(player) && !isPositionFree(player, x, y, obstacles)) {
    // Stopped rather than slid along. A sleigh is not a character squeezing
    // past a wall, and the player has the whole vertical axis available to
    // get over the thing instead.
    velocity.set(0, 0);
    return;
  }

  player.position.x = x;
  player.position.y = y;
}

/**
 * Points the nose along the velocity -- not along the key that was pressed.
 * With momentum those differ, and following the velocity is what makes a
 * drifting turn look right.
 *
 * The bank is how far the velocity is from the direction being asked for,
 * which is zero in a straight line and at its limit in a hard reversal.
 */
function orient(player, direction) {
  const speed = velocity.length();

  if (speed > MIN_HEADING_SPEED) {
    player.model.rotation.y = facingFor({ x: velocity.x / speed, y: velocity.y / speed });
  }

  let target = 0;

  if (direction && speed > MIN_HEADING_SPEED) {
    // The z of (velocity x direction), normalised: the sine of the angle
    // between them, signed by which way round the turn goes. Positive is a
    // turn to the left, and the sleigh's right side is its local +Z, so the
    // roll that drops the inside wing is the negative of it.
    const cross = (velocity.x * direction.y - velocity.y * direction.x) / speed;

    target = -cross * BANK_ANGLE;
  }

  bank += (target - bank) * BANK_SMOOTHING;
  player.tilt.rotation.x = bank;
}

/**
 * Puts the sleigh back at the start of a run: over the origin, at altitude,
 * at rest and level. Called on restart.
 */
export function resetMovement(player) {
  held.clear();
  velocity.set(0, 0);
  bank = 0;

  player.position.set(0, 0, START_ALTITUDE);

  if (player.model) {
    player.model.rotation.y = MODEL_BASE_ROTATION;
    player.tilt.rotation.x = 0;
  }

  // The Game Over screen is wall time like any other, and a clock only asked
  // for a delta on some frames banks the gap.
  clock.getDelta();
}

/**
 * `enemies` is unused and kept, so restoring the monsters is one word in
 * main.js. `obstacles` is the town, and it is used again now that E lands the
 * sleigh: below the roofs it blocks, above them it is skipped.
 */
export function updateMovement(player, enemies = [], obstacles = []) {
  const delta = Math.min(clock.getDelta(), MAX_DELTA);

  // `player.ready` rather than `player.model`: the groups are built
  // synchronously and only the glTF inside them is awaited, so the model is
  // there from frame one and is not the thing to test. Returning AFTER the
  // delta is read, not before, is what stops the seconds spent loading 10 MB
  // of glTF being paid out as one enormous first frame.
  if (!player.ready || isGameOver()) return;

  const direction = desiredDirection();

  moveHorizontally(player, direction, delta, obstacles);

  // Clamped every frame rather than only when a key is held, so a sleigh that
  // is already low and crosses onto a plot is lifted clear rather than left
  // inside a roof.
  player.position.z = THREE.MathUtils.clamp(
    player.position.z + climbInput() * LIFT_SPEED * delta,
    floorFor(player, obstacles),
    MAX_ALTITUDE,
  );

  orient(player, direction);

  // The sleigh's one clip animates the four pullers and nothing else, so its
  // rate is the sleigh's speed rather than a constant -- otherwise they
  // sprint on the spot whenever it stops. They slow as it slows and settle
  // when it settles, which is the nearest this asset gets to a standing pose:
  // there is no second clip to cut to.
  player.animator?.setTimeScale(Math.min(velocity.length() / CRUISE_SPEED, 1));
}

// Read by Player.js so a run starts where resetMovement puts it back, and by
// the gift specs, which pick their spawn heights against the flight band.
export { START_ALTITUDE, HOUSE_RIDGE, MAX_ALTITUDE, WORLD_RADIUS, MODEL_BASE_ROTATION };
