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
import {
  initTimer,
  updateTimer,
  resetTimer,
  stopTimer,
  getElapsedText,
  isBestRun,
} from './components/Timer.js';
// The boost is updated from Movement.js rather than here: it burns only while
// the sleigh is being asked to go somewhere, and that module is the one that
// knows. All this owns is the readout's life cycle.
import { initBoost, resetBoost } from './components/Boost.js';
import {
  initGifts,
  updateGifts,
  resetGifts,
  gifts,
  allCaught,
  isCatchSkipped,
} from './components/Gifts.js';
import {
  initDeliveryInput,
  updateDelivery,
  resetDelivery,
  createDoorstepMarkers,
} from './components/Delivery.js';
import {
  createGiftBeacon,
  initGiftBeacon,
  updateGiftBeacon,
} from './components/GiftBeacon.js';
import {
  initGameState,
  isRunLive,
  isFreeRoam,
  setGodMode,
  beginRun,
  restartGame,
} from './components/GameState.js';
import {
  initFreeRoam,
  enterFreeRoam,
} from './components/FreeRoam.js';
import {
  initTitleScreen,
  openTitleScreen,
} from './components/TitleScreen.js';
import { initControls } from './components/Controls.js';
import { updateDifficulty } from './components/Difficulty.js';
import { createMap } from './components/Map.js';
import { createHouses, houses } from './components/House.js';
import { createSnow, updateSnow } from './components/Snow.js';
import { createAurora, updateAurora } from './components/Aurora.js';
import {
  updateChristmasLights,
  celebrate,
  resetChristmasLights,
} from './components/ChristmasLights.js';
import { updateSmoke } from './components/Smoke.js';
import { updateAirstrip } from './components/Airstrip.js';
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

// Next to the snow, and on the scene for the same reason: the shell stands
// 2600 units out over the +Y mountains, and parenting it to the player would
// leave it the one object in the world with no parallax. Nothing reads it
// against Tode, so order here does not matter.
const aurora = createAurora();
scene.add(aurora);

// Hangs off the scene next to the snow, not off the player: it stands on the
// ground at the gift's position, which has nothing to do with where the sleigh
// is. Added after the player only because it is updated against him.
scene.add(createGiftBeacon());

// The five marked doorsteps, next to the beacon and on the scene for the same
// reason: they stand on the ground at a fixed point of the town, and the map
// group is where the town itself lives. Hidden until the sack is full.
scene.add(createDoorstepMarkers());

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
// Binds Space, which `Movement.js` has just given up. Nothing else to set up:
// the gifts it drops are clones of the template `initGifts` is loading, and
// the counter it writes to is the one `initGifts` creates.
initDeliveryInput();
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

/**
 * Puts the world back to the top of a run: the sleigh at the start, the sack
 * empty, nothing left in the air or standing at a door, the town twinkling
 * rather than celebrating, and every clock's banked delta burned.
 *
 * Used by both ways in. A restart is the obvious one; free roam wants exactly
 * the same thing for a different reason -- the player has come to look at the
 * town, and the leftovers of the run they just finished are not part of it.
 */
function resetWorld() {
  resetMovement(player);
  // clearEnemies(scene);
  resetGifts(scene, player);
  // Every gift in the air, lying in the snow, and standing at a door.
  resetDelivery(scene);
  // resetScore();
  resetTimer();
  // A full tank, like the start of any run.
  resetBoost();
  // Back to twinkling. The delivered presents are the easy half of a
  // restart to remember; this is the half that will be forgotten, because
  // nothing visibly breaks -- the second run simply starts with the town
  // already celebrating and the ending has nothing left to give.
  resetChristmasLights();
  setPlayerVisible(true);
}

// Built before `initGameState`, which hands it the "Main menu" option on the
// Game Over screen, and shown at the bottom of this file.
initTitleScreen({
  onStart: () => restartGame(),
  // `hackathon/menu/free_roam/spec.md`. Not a run: see `FreeRoam.js`.
  onFreeRoam: () => enterFreeRoam(),
});

initFreeRoam({
  onEnter: resetWorld,
  onExit: () => openTitleScreen(),
});

// `hackathon/menu/controls/spec.md`. Opened from the title screen itself; all
// that is wired from here is the way back, for the same reason free roam's is
// -- `Controls.js` must not import the screen that imports it.
initControls({
  onExit: () => openTitleScreen(),
});

initGameState({
  onGameOver: () => setPlayerVisible(false),
  // The won ending. Tode is NOT hidden, unlike the lost one: he has just
  // finished the round, and the town coming up behind him is what the screen
  // is there to show. The clock stops here and nowhere else -- this is the
  // call `Timer.js` has been waiting for since the fifth catch stopped
  // standing in for an ending.
  onWin: () => {
    stopTimer();
    celebrate();
  },
  // The Game Over screen's second option. Routed through here rather than
  // imported there, like every other thing `GameState.js` does not know
  // about.
  onMainMenu: () => openTitleScreen(),
  // What both ending screens print as the result. Handed in rather than
  // imported there, because `GameState.js` imports nothing -- see its header.
  getTime: getElapsedText,
  // And whether that result is a record, which only the win screen asks.
  isBestRun,
  onRestart: resetWorld,
});

// `?deliver` opens the run in the delivery phase, and brings god mode with it:
// the point of the shortcut is to fly to town and drop five presents, and a
// roof or a stand of trees ending that on the way in is the catching phase's
// hazard being paid for twice. Switched on from here rather than inside
// `GameState.js`, which imports nothing and must not learn what a gift is;
// after `initGameState`, because the badge it shows is created there.
if (isCatchSkipped()) {
  setGodMode(true);
  // Straight past the title screen: the point of the shortcut is to be in the
  // air with five gifts, and `beginRun` rather than `restartGame` because
  // there is nothing to reset at boot and the models are not in yet.
  beginRun();
} else {
  openTitleScreen();
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Primes the difficulty table before anything reads it.
updateDifficulty();

renderer.setAnimationLoop(() => {
  // Everything that moves or counts stands still unless a run is being
  // played -- which is not the same question as "is it over". The title
  // screen is up before the first run and between runs, and the world has to
  // hold still behind it too.
  // Free roam first, because it is the cheaper question and the two can never
  // both be true: a roam is not a run, so `isRunLive()` is false throughout
  // one. The sleigh flies and the camera turns; the gifts, the clock and the
  // deliveries are the three things this branch leaves out, which is the whole
  // of `hackathon/menu/free_roam/spec.md`.
  if (isFreeRoam()) {
    // The town is still solid and the ground is still under him -- what is
    // gone is the consequence, which `isCrashSafe()` in `GameState.js` owns.
    updateMovement(player, [], houses);
    // Nothing to point at, and said every frame rather than once on entry:
    // this is also what keeps the beacon's own clock from banking the length
    // of the roam and spending it on the first frame of the next run.
    updateGiftBeacon(null, player);
  } else if (isRunLive()) {
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
    // The second phase, gated on the first finishing and on nothing else.
    // Three phases that run strictly in order, each gated on the previous
    // one's predicate, are a condition in the render loop rather than a phase
    // machine -- a machine earns its place when a phase can be re-entered or
    // skipped, and none of these can. The third, winning, is
    // `conclusion/win_state/spec.md`.
    if (allCaught()) updateDelivery(scene, player);
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

  // Outside the freeze with the town's strings, and for the same reason: the
  // runway sequence stopping on the Game Over frame would read as the
  // aerodrome going down with Tode. No argument -- there is one airfield.
  updateAirstrip();
  // Also outside it: the snow carries on over the Game Over screen, the
  // same way the lighting stays up rather than cutting to black.
  updateSnow(snow, player);
  // And outside it with the snow: the sky does not stop because the run
  // ended, and a band of aurora freezing on the Game Over frame would read as
  // part of the failure.
  updateAurora(aurora);
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
