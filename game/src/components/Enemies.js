import * as THREE from 'three';
import { createEnemy } from './Enemy.js';
import { isPositionFree, wouldCollide } from './Collision.js';
import { triggerGameOver } from './GameState.js';
import { getDifficulty } from './Difficulty.js';

// Off while the winter scenery is being built: you cannot stand still long
// enough to look at the ground with monsters arriving every few seconds. Set
// back to true to restore the chase -- nothing else here changes, and an empty
// enemies array is a state every other system already handles, since that is
// what the first few seconds of a run look like anyway.
const SPAWN_ENABLED = false;

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
  // the new run arrives a full spawn delay later rather than instantly.
  clock.getDelta();
}

export function updateEnemies(scene, player, obstacles = []) {
  // Spawn delay and speed are read fresh each frame, so a shrinking delay
  // takes effect against the timer already running.
  const { spawnDelay, enemySpeed } = getDifficulty();

  timeSinceLastSpawn += clock.getDelta();

  if (SPAWN_ENABLED && timeSinceLastSpawn >= spawnDelay) {
    timeSinceLastSpawn = 0;
    spawnEnemy(scene);
  }

  enemies.forEach((enemy) => {
    const toPlayerX = player.position.x - enemy.position.x;
    const toPlayerY = player.position.y - enemy.position.y;
    const distance = Math.hypot(toPlayerX, toPlayerY);

    if (distance === 0) return;

    // Where this frame's step towards the player would land.
    const nextX = enemy.position.x + (toPlayerX / distance) * enemySpeed;
    const nextY = enemy.position.y + (toPlayerY / distance) * enemySpeed;

    // Game Over outranks collision handling, so reaching Tode is no longer
    // something the enemy gets blocked out of -- it is the whole point of the
    // chase. Checked before the move is committed, so the step that lands on
    // him ends the run from either side.
    if (wouldCollide(enemy, nextX, nextY, player)) {
      triggerGameOver();
      return;
    }

    // Each other and the scenery, though, they still respect. Candidate steps
    // in order of preference: straight at the player, then each axis on its
    // own. The single-axis ones are what let a monster scrape along a wall and
    // round the corner of a house -- without them it would walk into the near
    // side and push at it for the rest of the run, since nothing here does
    // pathfinding. A blocked enemy holds position but keeps turning, so a
    // crowd stacks up instead of merging into one.
    const steps = [
      [nextX, nextY],
      [nextX, enemy.position.y],
      [enemy.position.x, nextY],
    ];

    const step = steps.find(
      ([x, y]) =>
        isPositionFree(enemy, x, y, enemies) && isPositionFree(enemy, x, y, obstacles),
    );

    if (step) {
      [enemy.position.x, enemy.position.y] = step;
    }

    // Face the player. With rotation.x = PI/2 the model's local Y axis is
    // world Z, so rotation.y is the turn we want; the model faces +Y at 0.
    if (enemy.model) {
      enemy.model.rotation.y = Math.atan2(-toPlayerX, toPlayerY) + MODEL_BASE_ROTATION;
    }
  });
}
