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
import { createSkyTexture, HORIZON_COLOR } from './components/Sky.js';
import { createLighting } from './components/Lighting.js';

// Where the landscape dissolves into the sky. The ground is 3280 units across,
// so its far corner stands 2319 from the origin: fading out at 2300 means the
// edge of the world is never a straight cut-off against the backdrop, it is
// just distance. Tight on purpose -- any less and the corners come back.
const FOG_FAR = 2300;
// Has to clear the camera, which sits 409 units behind Tode, or he is the one
// thing in the scene that fogs. It also leaves the town crisp as he walks up
// to it: the nearest front wall is 443 out from the origin.
const FOG_NEAR = 600;

const scene = new THREE.Scene();

// The game had no sky at all until now -- the renderer is created with
// `alpha: true` and nothing ever assigned a background, so the whole thing was
// played against the browser's white page. That went unnoticed in daylight and
// is the first thing anyone sees at night.
scene.background = createSkyTexture();
scene.fog = new THREE.Fog(HORIZON_COLOR, FOG_NEAR, FOG_FAR);

scene.add(createLighting());

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
