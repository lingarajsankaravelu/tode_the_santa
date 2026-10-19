import * as THREE from 'three';
import './style.css';
import { createPlayer } from './components/Player.js';
import { createCamera } from './components/Camera.js';
import { createRenderer } from './components/Renderer.js';
import { initInput, updateMovement, resetMovement } from './components/Movement.js';
import { updateEnemies, enemies, clearEnemies } from './components/Enemies.js';
import { initAttackInput, updateAttack } from './components/Attack.js';
import { initScore, updateScore, resetScore } from './components/Score.js';
import { initGameState, isGameOver } from './components/GameState.js';
import { updateDifficulty } from './components/Difficulty.js';
import { createMap } from './components/Map.js';
import { createHouses, houses } from './components/House.js';
import { createSnow, updateSnow } from './components/Snow.js';
import { initMusic } from './components/Music.js';

const AMBIENT_LIGHT_INTENSITY = 1.5;
const DIRECTIONAL_LIGHT_INTENSITY = 1.5;
const DIRECTIONAL_LIGHT_POSITION = { x: -100, y: -100, z: 200 };

const scene = new THREE.Scene();

const ambientLight = new THREE.AmbientLight(0xffffff, AMBIENT_LIGHT_INTENSITY);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, DIRECTIONAL_LIGHT_INTENSITY);
directionalLight.position.set(
  DIRECTIONAL_LIGHT_POSITION.x,
  DIRECTIONAL_LIGHT_POSITION.y,
  DIRECTIONAL_LIGHT_POSITION.z,
);
scene.add(directionalLight);

// Added before the player so the floor is the first thing in the scene; the
// houses are parented to the map group rather than the scene, so the scenery
// travels with the ground it sits on.
const map = createMap();
scene.add(map);
createHouses(map);

const player = createPlayer();
scene.add(player);

const camera = createCamera();
player.add(camera);

// Snow hangs off the scene next to the lights rather than off the map group
// the ground scenery uses. Created after the player because updateSnow needs
// him to follow.
const snow = createSnow();
scene.add(snow);

const renderer = createRenderer();

initInput();
initAttackInput();
initScore();
// Nothing to update per frame: the element loops itself, and it carries on
// across a Game Over the same way the snow and the lights do.
initMusic();

// Hiding the model rather than the group: the camera is a child of the group,
// and there is no need to find out how a renderer feels about an invisible
// one.
function setPlayerVisible(visible) {
  if (player.model) player.model.visible = visible;
}

initGameState({
  onGameOver: () => setPlayerVisible(false),
  onRestart: () => {
    resetMovement(player);
    clearEnemies(scene);
    resetScore();
    setPlayerVisible(true);
  },
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Primes the difficulty table before anything reads it.
updateDifficulty();

renderer.setAnimationLoop(() => {
  // Everything that moves or counts stands still once the run is over.
  if (!isGameOver()) {
    // First, so every system this frame scales off the same score.
    updateDifficulty();
    updateMovement(player, enemies, houses);
    updateEnemies(scene, player, houses);
    updateScore();
  }

  // Kept outside the freeze so a flash caught mid-fade finishes cleanly
  // instead of hanging on screen. It refuses new attacks on its own.
  updateAttack(scene, player);

  // Also outside it: the snow carries on over the Game Over screen, the
  // same way the lighting stays up rather than cutting to black.
  updateSnow(snow, player);

  renderer.render(scene, camera);
});
