import * as THREE from 'three';
import './style.css';
import { createPlayer } from './components/Player.js';
import { createCamera } from './components/Camera.js';
import { createRenderer } from './components/Renderer.js';
import { initInput, updateMovement } from './components/Movement.js';
import { updateEnemies } from './components/Enemies.js';

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

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

renderer.setAnimationLoop(() => {
  updateMovement(player);
  updateEnemies(scene, player);
  renderer.render(scene, camera);
});
