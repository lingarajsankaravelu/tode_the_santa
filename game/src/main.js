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

const player = createPlayer();
scene.add(player);

const camera = createCamera();
player.add(camera);

const renderer = createRenderer();

initInput();
initAttackInput();
initScore();

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

renderer.setAnimationLoop(() => {
  // Everything that moves or counts stands still once the run is over.
  if (!isGameOver()) {
    updateMovement(player, enemies);
    updateEnemies(scene, player);
    updateScore();
  }

  // Kept outside the freeze so a flash caught mid-fade finishes cleanly
  // instead of hanging on screen. It refuses new attacks on its own.
  updateAttack(scene, player);

  renderer.render(scene, camera);
});
