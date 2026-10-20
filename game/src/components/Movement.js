// Jump-based player movement: one arrow key press == one hop.
// `wouldCollide` and `triggerGameOver` went with the monsters -- see the
// commented hop-into-a-monster test below. Both are still exported by their
// modules; only this file stopped asking for them.
import { isPositionFree } from './Collision.js';
import { getCameraYaw } from './Camera.js';
import { isGameOver } from './GameState.js';
import { getDifficulty } from './Difficulty.js';


// Peak height of the hop arc, in world units.
const JUMP_HEIGHT = 25;
// Ground distance covered by a single hop, in world units.
const JUMP_DISTANCE = 80;
// How far from the origin Tode may get. Matches the flat middle of
// river_landscape.glb: FLAT_R of 17 in the generator, imported at a scale of
// 41 in Landscape.js, which puts the first rising ground at 707. Past this he
// would be standing inside a hill, so the hop is refused instead.
const WORLD_RADIUS = 700;
// Extra turn applied to the model because tode.glb does not face +Y by
// default. It faces +Z, which was settled by measurement rather than by eye:
// rendered from -Z the model is a blank slab with the eye blocks behind it,
// and from +Z it is the face. The loader tips every model by rotation.x =
// PI/2, which sends local +Z to world -Y -- so at a yaw of zero Tode faced
// the camera while ArrowUp carried him away from it, and all four keys ran
// him backwards. Half a turn puts his face on his direction of travel.
//
// This is the constant that exists for the problem, so it is the fix until
// the rebuilt model lands facing -Z as its spec requires, at which point it
// goes back to 0.
const MODEL_BASE_ROTATION = Math.PI;
// The hop advances by `moveSpeed` of its arc per *frame*, not per second, so
// turning it into a clip length means assuming a frame rate. At the table's
// 0.04 a hop is 25 frames and at its 0.08 ceiling it is 12.5, which on a 60Hz
// display is 0.42s falling to 0.21s over a run. A machine running at another
// rate hops at another speed -- that is true of the hop itself today, and the
// clip is stretched to match whatever the hop does rather than fixing it here.
const FRAMES_PER_SECOND = 60;

// Key -> a direction in the CAMERA'S frame: forward is away from the lens,
// strafe is ninety degrees to its right. The world direction is worked out
// per hop from wherever the mouse has left the camera, so W is always "away
// from me" on screen whichever way the view happens to be pointing. With a
// camera the player can spin, the old world-fixed table stopped matching the
// screen the moment they did -- press W, turn ninety degrees, and W is
// sideways.
//
// The arrows are kept beside WASD rather than replaced: four lines, and they
// are what anyone who has played this already will reach for.
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

/**
 * The yaw that points the model's nose along a ground direction.
 *
 * Written for a model whose forward is its local -Z -- the glTF convention,
 * and what the asset spec requires. MODEL_BASE_ROTATION carries the half turn
 * that today's wrong-facing tode.glb needs on top of it.
 */
function facingFor(direction) {
  return Math.atan2(-direction.x, direction.y) + MODEL_BASE_ROTATION;
}

const inputQueue = [];

let currentMove = null;

export function initInput() {
  window.addEventListener('keydown', (event) => {
    if (!MOVE_KEYS[event.code] || isGameOver()) return;

    event.preventDefault();
    inputQueue.push(event.code);
  });
}

function startMove(player, key) {
  const input = MOVE_KEYS[key];
  const yaw = getCameraYaw();

  // The camera's own forward and right, flattened onto the ground plane.
  // Only one of forward/strafe is ever non-zero, so the result is already a
  // unit vector and needs no normalising.
  const forwardX = Math.sin(yaw);
  const forwardY = Math.cos(yaw);
  const direction = {
    x: forwardX * input.forward + forwardY * input.strafe,
    y: forwardY * input.forward - forwardX * input.strafe,
  };

  currentMove = {
    direction,
    progress: 0,
    completed: false,
    startX: player.position.x,
    startY: player.position.y,
  };

  // Turn the loaded model, never the group -- the camera is a child of the
  // group and would swing around with it.
  if (player.model) {
    player.model.rotation.y = facingFor(direction);
  }

  // Stretched to this hop's own length, so the clip lands when Tode does
  // however far difficulty has wound the hop up.
  player.animator?.play('Hop', {
    seconds: 1 / (getDifficulty().moveSpeed * FRAMES_PER_SECOND),
  });
}

function cancelMove(player) {
  currentMove.completed = true;
  currentMove = null;
  player.position.z = 0;
  // Covers the hop that lands, the hop refused at the world edge and the hop
  // into a wall alike: all three end with Tode standing still, so all three
  // end on the idle.
  player.animator?.play('Idle', { loop: true });
}

/**
 * Puts Tode back at the origin, facing forward, with any queued or in-flight
 * hop thrown away. Called on restart.
 */
export function resetMovement(player) {
  inputQueue.length = 0;
  currentMove = null;

  player.position.set(0, 0, 0);

  if (player.model) {
    player.model.rotation.y = MODEL_BASE_ROTATION;
  }

  player.animator?.play('Idle', { loop: true });
}

export function updateMovement(player, enemies = [], obstacles = []) {
  if (!currentMove && inputQueue.length > 0) {
    startMove(player, inputQueue.shift());
  }

  if (!currentMove || currentMove.completed) return;

  // Hop speed is read per frame, so a hop in flight can finish faster than
  // it started. Harmless: progress only ever moves forward.
  const { moveSpeed } = getDifficulty();

  currentMove.progress = Math.min(currentMove.progress + moveSpeed, 1);

  const { direction, progress, startX, startY } = currentMove;

  // Where this frame of the hop wants to put the player.
  const nextX = startX + direction.x * JUMP_DISTANCE * progress;
  const nextY = startY + direction.y * JUMP_DISTANCE * progress;

  // Checked before the monsters, not after: an enemy that has chased Tode to
  // the rim should not get to kill him on a hop that was never going to
  // happen. A hop into the edge of the world fails exactly like a hop into a
  // house, so it reads as the same rule rather than a new one.
  // Always, god mode included. The ground past the basin is not level and
  // Tode stays at z = 0, so leaving it puts him inside a hillside -- which
  // looks like falling through the map, because that is what it is.
  if (Math.hypot(nextX, nextY) > WORLD_RADIUS) {
    cancelMove(player);
    return;
  }

  // Monsters are out of the game -- `game_story.md` has no enemy in it any
  // more -- so hopping into one is no longer a way to die. `enemies` still
  // arrives as a parameter and main.js still passes a list, so restoring this
  // is uncommenting it and restoring the two imports above.
  //
  // Game Over outranks collision handling: hopping into a monster ends the
  // run, rather than the hop being politely refused.
  //
  // if (enemies.some((enemy) => wouldCollide(player, nextX, nextY, enemy))) {
  //   triggerGameOver();
  //   return;
  // }

  // Everything else -- scenery and the like -- still just blocks. A blocked
  // hop is abandoned rather than paused, so Tode lands where he is instead of
  // hanging in mid-air against a wall.
  if (!isPositionFree(player, nextX, nextY, obstacles)) {
    cancelMove(player);
    return;
  }

  player.position.x = nextX;
  player.position.y = nextY;
  player.position.z = Math.sin(progress * Math.PI) * JUMP_HEIGHT;

  if (progress >= 1) {
    cancelMove(player);
  }
}
