import * as THREE from 'three';
import { createEnemy } from './Enemy.js';
import { isPositionFree, wouldCollide } from './Collision.js';
import { triggerGameOver } from './GameState.js';

// Seconds between spawns.
const SPAWN_DELAY = 2;
// World units travelled per frame while chasing the player.
const ENEMY_SPEED = 1.5;
// Half-width of the map: how far the corner spawn points sit from the origin.
const SPAWN_DISTANCE = 220;
// Extra turn applied to the model if enemy.glb does not face +Y by default.
const MODEL_BASE_ROTATION = 0;

// The four corners of the map.
const SPAWN_POINTS = [
  { x: -SPAWN_DISTANCE, y: -SPAWN_DISTANCE },
  { x: SPAWN_DISTANCE, y: -SPAWN_DISTANCE },
  { x: -SPAWN_DISTANCE, y: SPAWN_DISTANCE },
  { x: SPAWN_DISTANCE, y: SPAWN_DISTANCE },
];

export const enemies = [];

const clock = new THREE.Clock();

let timeSinceLastSpawn = 0;
let nextSpawnPoint = 0;

function spawnEnemy(scene) {
  // Cycle the corners so every spawn point gets used in turn.
  const spawnPoint = SPAWN_POINTS[nextSpawnPoint];
  nextSpawnPoint = (nextSpawnPoint + 1) % SPAWN_POINTS.length;

  const enemy = createEnemy(spawnPoint);

  scene.add(enemy);
  enemies.push(enemy);
}

/**
 * Takes an enemy out of the scene and out of the tracking array. Safe to call
 * with an enemy that has already been removed.
 */
export function removeEnemy(scene, enemy) {
  const index = enemies.indexOf(enemy);

  if (index !== -1) enemies.splice(index, 1);

  scene.remove(enemy);
}

/**
 * Empties the map: every enemy leaves the scene and the tracking array, and
 * the spawn cycle restarts from the first corner. Called on restart.
 */
export function clearEnemies(scene) {
  enemies.forEach((enemy) => scene.remove(enemy));
  enemies.length = 0;

  nextSpawnPoint = 0;
  timeSinceLastSpawn = 0;

  // Throw away the time the Game Over screen was up, so the first enemy of
  // the new run arrives a full SPAWN_DELAY later rather than instantly.
  clock.getDelta();
}

export function updateEnemies(scene, player) {
  timeSinceLastSpawn += clock.getDelta();

  if (timeSinceLastSpawn >= SPAWN_DELAY) {
    timeSinceLastSpawn = 0;
    spawnEnemy(scene);
  }

  enemies.forEach((enemy) => {
    const toPlayerX = player.position.x - enemy.position.x;
    const toPlayerY = player.position.y - enemy.position.y;
    const distance = Math.hypot(toPlayerX, toPlayerY);

    if (distance === 0) return;

    // Where this frame's step towards the player would land.
    const nextX = enemy.position.x + (toPlayerX / distance) * ENEMY_SPEED;
    const nextY = enemy.position.y + (toPlayerY / distance) * ENEMY_SPEED;

    // Game Over outranks collision handling, so reaching Tode is no longer
    // something the enemy gets blocked out of -- it is the whole point of the
    // chase. Checked before the move is committed, so the step that lands on
    // him ends the run from either side.
    if (wouldCollide(enemy, nextX, nextY, player)) {
      triggerGameOver();
      return;
    }

    // Each other, though, they still respect: blocked enemies hold position
    // but keep turning, so a crowd stacks up instead of merging into one.
    if (isPositionFree(enemy, nextX, nextY, enemies)) {
      enemy.position.x = nextX;
      enemy.position.y = nextY;
    }

    // Face the player. With rotation.x = PI/2 the model's local Y axis is
    // world Z, so rotation.y is the turn we want; the model faces +Y at 0.
    if (enemy.model) {
      enemy.model.rotation.y = Math.atan2(-toPlayerX, toPlayerY) + MODEL_BASE_ROTATION;
    }
  });
}
