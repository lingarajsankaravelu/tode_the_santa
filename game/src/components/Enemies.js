import * as THREE from 'three';
import { createEnemy } from './Enemy.js';

// Seconds between spawns.
const SPAWN_DELAY = 10;
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

    // Step towards the player along the XY ground plane.
    enemy.position.x += (toPlayerX / distance) * ENEMY_SPEED;
    enemy.position.y += (toPlayerY / distance) * ENEMY_SPEED;

    // Face the player. With rotation.x = PI/2 the model's local Y axis is
    // world Z, so rotation.y is the turn we want; the model faces +Y at 0.
    if (enemy.model) {
      enemy.model.rotation.y = Math.atan2(-toPlayerX, toPlayerY) + MODEL_BASE_ROTATION;
    }
  });
}
