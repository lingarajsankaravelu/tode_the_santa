import * as THREE from 'three';
import './style.css';
import { createPlayer } from './components/Player.js';
import { createCamera, updateCamera, initCameraControls } from './components/Camera.js';
import { createRenderer } from './components/Renderer.js';
import { initInput, updateMovement, resetMovement } from './components/Movement.js';
// Monsters are out of the game. `game_story.md` is now catch-the-gifts and
// deliver them: there is nothing in it to fight, and nothing chasing Tode.
// They were already dormant before this -- `SPAWN_ENABLED` in Enemies.js has
// been false since the winter scenery went in -- so this commits what was
// already true and stops the chase running against an empty array every
// frame. Enemies.js, Enemy.js and enemy.glb are all left in place: restoring
// the chase is this import and the three call sites below.
// import { updateEnemies, enemies, clearEnemies } from './components/Enemies.js';
// The attack went out with the monsters it existed to kill. `game_story.md`
// has no combat in it: Tode catches gifts and delivers them. What was left
// once the strike was commented out was a yellow circle that flashed on Space
// and hit nothing. Attack.js is kept on disk the way Enemies.js is -- this
// import and the two call sites below are the whole of the wiring.
// import { initAttackInput, updateAttack } from './components/Attack.js';
// The score is retired -- see Score.js's header. A game about how fast Santa
// can collect and deliver wants a clock, not an accumulator.
// import { initScore, updateScore, resetScore } from './components/Score.js';
import { initTimer, updateTimer, resetTimer } from './components/Timer.js';
// The boost is updated from Movement.js rather than here: it burns only while
// the sleigh is being asked to go somewhere, and that module is the one that
// knows. All this owns is the readout's life cycle.
import { initBoost, resetBoost } from './components/Boost.js';
import { initGifts, updateGifts, resetGifts, gifts } from './components/Gifts.js';
import {
  createGiftBeacon,
  initGiftBeacon,
  updateGiftBeacon,
} from './components/GiftBeacon.js';
import { initGameState, isGameOver } from './components/GameState.js';
import { updateDifficulty } from './components/Difficulty.js';
import { createMap } from './components/Map.js';
import { createHouses, houses } from './components/House.js';
import { createSnow, updateSnow } from './components/Snow.js';
import { updateChristmasLights } from './components/ChristmasLights.js';
import { updateSmoke } from './components/Smoke.js';
import { initMusic } from './components/Music.js';
import { createSkyTexture, HORIZON_COLOR } from './components/Sky.js';
import { createLighting } from './components/Lighting.js';
import { updateAnimations } from './components/Animation.js';

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

// Hangs off the scene next to the snow, not off the player: it stands on the
// ground at the gift's position, which has nothing to do with where the sleigh
// is. Added after the player only because it is updated against him.
scene.add(createGiftBeacon());

const renderer = createRenderer();

initInput();
// Needs the canvas rather than the window: pointer lock is requested on an
// element, and the renderer owns the only one.
initCameraControls(renderer.domElement);
// initAttackInput();
// initScore();
initTimer();
// Creates the tank's bar and binds Shift.
initBoost();
// Creates the counter and starts a_gift_box.glb loading. The gifts only begin
// appearing once both that and the sleigh are in.
initGifts();
initGiftBeacon();
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
    // clearEnemies(scene);
    resetGifts(scene, player);
    // resetScore();
    resetTimer();
    // A full tank, like the start of any run.
    resetBoost();
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
    // `houses` is live again, and fatal: below the ridge, flying into one ends
    // the run. The empty first list is the monsters, kept in the call rather
    // than dropped from the signature so restoring the chase is one word.
    updateMovement(player, [], houses);
    // No obstacle list, unlike the call above: the only two things that can
    // happen to a gift in the air are being caught and reaching the ground.
    updateGifts(scene, player);
    // After updateGifts, so the beam is on this frame's gift rather than
    // trailing it by one. `gifts[0]` is the only gift there can be -- one in
    // the air at a time -- and undefined between them, which the beacon reads
    // as nothing to point at.
    updateGiftBeacon(gifts[0] ?? null, player);
    // updateEnemies(scene, player, houses);
    // updateScore();
    updateTimer();
  }

  // Was kept outside the freeze so a flash caught mid-fade finished cleanly
  // instead of hanging on screen. It refused new attacks on its own.
  // updateAttack(scene, player);

  // Outside the freeze so a swing caught mid-turn still finishes instead of
  // stopping halfway round.
  updateCamera(camera, player);

  // Also outside it: the snow carries on over the Game Over screen, the
  // same way the lighting stays up rather than cutting to black.
  updateSnow(snow, player);
  // Outside the freeze for the same reason, and because a town going dark on
  // the Game Over frame would read as the lights being part of the failure.
  // No argument: all five plots share one buffer, so this is one pass for the
  // whole town.
  updateChristmasLights();
  // Also outside the freeze: a town whose chimneys stop on the Game Over
  // frame reads as the village dying with Tode.
  updateSmoke();

  // Outside it for a plainer reason than the rest: the module reads a delta
  // off its own clock, and a clock only asked for one some frames banks the
  // time in between. Freezing this would hand every animation in the scene
  // the whole length of the Game Over screen on the first frame of the
  // restart. Tode is hidden by then anyway, so there is nothing to freeze.
  updateAnimations();

  renderer.render(scene, camera);
});
