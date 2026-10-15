// Jump-based player movement: one arrow key press == one hop.
import { isPositionFree, wouldCollide } from './Collision.js';
import { isGameOver, triggerGameOver } from './GameState.js';


// Fraction of a hop completed per frame (1 / MOVE_SPEED frames per hop).
const MOVE_SPEED = 0.04;
// Peak height of the hop arc, in world units.
const JUMP_HEIGHT = 25;
// Ground distance covered by a single hop, in world units.
const JUMP_DISTANCE = 80;
// Extra turn applied to the model if tode.glb does not face +Y by default.
const MODEL_BASE_ROTATION = 0;

// Arrow key -> travel direction on the XY ground plane, plus the facing angle
// around the model's up axis (which is world Z once rotation.x = PI/2).
const DIRECTIONS = {
  ArrowUp: { x: 0, y: 1, rotation: 0 },
  ArrowDown: { x: 0, y: -1, rotation: Math.PI },
  ArrowLeft: { x: -1, y: 0, rotation: Math.PI / 2 },
  ArrowRight: { x: 1, y: 0, rotation: -Math.PI / 2 },
};

const inputQueue = [];

let currentMove = null;

export function initInput() {
  window.addEventListener('keydown', (event) => {
    if (!DIRECTIONS[event.key] || isGameOver()) return;

    event.preventDefault();
    inputQueue.push(event.key);
  });
}

function startMove(player, key) {
  const direction = DIRECTIONS[key];

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
    player.model.rotation.y = direction.rotation + MODEL_BASE_ROTATION;
  }
}

function cancelMove(player) {
  currentMove.completed = true;
  currentMove = null;
  player.position.z = 0;
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
}

export function updateMovement(player, enemies = [], obstacles = []) {
  if (!currentMove && inputQueue.length > 0) {
    startMove(player, inputQueue.shift());
  }

  if (!currentMove || currentMove.completed) return;

  currentMove.progress = Math.min(currentMove.progress + MOVE_SPEED, 1);

  const { direction, progress, startX, startY } = currentMove;

  // Where this frame of the hop wants to put the player.
  const nextX = startX + direction.x * JUMP_DISTANCE * progress;
  const nextY = startY + direction.y * JUMP_DISTANCE * progress;

  // Game Over outranks collision handling: hopping into a monster ends the
  // run, rather than the hop being politely refused.
  if (enemies.some((enemy) => wouldCollide(player, nextX, nextY, enemy))) {
    triggerGameOver();
    return;
  }

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
