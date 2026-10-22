// The first phase of the story: the storm has taken Tode's gifts, and they are
// coming down. He flies after them and catches all five before they land.
//
// Implements `hackathon/core_loop/gift_catch/spec.md`, **with one deliberate
// reversal of it.** That spec's central rule was "the gifts never land, and
// that is still the design" -- the storm holds them up, nothing can be lost,
// and a run cannot become unwinnable. The game is now a race rather than a
// collection: the clock in `Timer.js` is the score, so a gift that hangs in
// the air forever has no stake in it. They fall, and one reaching the ground
// ends the run.
//
// What survived the reversal is everything that was never about hanging: five
// gifts, one in the air at a time, `Enemies.js` as the structural pattern,
// loading the model once and cloning it, and burning the delta on init and
// reset.
//
// They fall *slowly*, under a parachute, and those two are one decision -- see
// `FALL_SPEED` below and `Parachute.js`. And they are lost at the ground and
// nowhere else: the canopy line the sleigh crashes against is not a floor for
// a present.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { triggerGameOver, isGameOver } from './GameState.js';
import { setSackFull } from './Player.js';
import { groundHeightAt } from './Terrain.js';
import { WORLD_RADIUS, MAX_ALTITUDE } from './Movement.js';
import { houses } from './House.js';
import { play } from './Sound.js';
import { createParachute, updateParachute } from './Parachute.js';
import { refillBoost } from './Boost.js';
import { asset } from '../assets.js';

const MODEL_PATH = asset('models/a_gift_box.glb');
// The file is 225 x 293.29 x 225 in its own units with Y up, so this makes a
// present 8.55 wide x 11.15 tall x 8.55 deep in world units. Judged against
// the 74-unit sleigh rather than the 16-unit frog Tode used to be, and it has
// to be spottable at altitude across an open field.
const MODEL_SCALE = 0.038;
// Radians per second, about the up axis. A present turning as it falls,
// catching the light differently as it goes. It used to be 1.2 and it used to
// be carrying the whole job of making a gift visible at distance; the
// parachute's blinking bulb does that now, so this is back to the speed a box
// swinging under a canopy would actually turn at.
const SPIN_SPEED = 0.6;

// The swing. The gift hangs from a parachute, so it leans out of vertical and
// comes back -- a slow pendulum on both horizontal axes, at rates that do not
// divide into each other so the two never settle into one plane.
const SWAY_TILT = 0.11;
const SWAY_SPEED = 0.9;
// Half the model's height in world units: how far its centre sits above the
// ground when it is resting on it. `gift_delivery` wants the same figure for a
// delivered present sitting on the path.
const GIFT_REST = 5.6;

// The story. One per house, so `gift_delivery` needs no arithmetic of its own.
const GIFT_TOTAL = 5;

// ---------------------------------------------------------------------------
// Where they appear. **Measured from the sleigh, not from the origin.**
//
// The old spec placed them in a fixed band 120-600 out from the centre of the
// map, which worked because the sleigh could not get further than 700 from it
// either. The world is 1600 now. A gift spawned at the far ridge while the
// sleigh was at the opposite one would be 3200 units away, sixteen seconds at
// cruise, and the player has to find it before they can start flying to it.
// The slower fall bought room here but it did not change the reason: spawning
// relative to the player is what keeps a gift something you fly to rather
// than something you commute to.
// ---------------------------------------------------------------------------

// Closer than this and the gift spawns inside the catch radius, which reads as
// one appearing out of nothing already collected.
const SPAWN_MIN_RADIUS = 220;
// 3.5 seconds at the 200 cruise, plus about half a second to accelerate.
const SPAWN_MAX_RADIUS = 700;
// Kept off the world bound so a gift is never pinned against an edge the
// sleigh can only approach from one side.
const EDGE_MARGIN = 60;

// How far above the LOCAL ground a gift starts, not how high in absolute
// terms. Over the flat basin the two are the same; on the far ridge the ground
// is already at 575, and an absolute band would give a gift there a fall of a
// few seconds while one over the snow got the full minute.
const SPAWN_MIN_CLEARANCE = 280;
const SPAWN_MAX_CLEARANCE = 560;

// Units per second, straight down. The number that sets the whole difficulty
// of the catch, and still the single lever for making the game harder.
//
// **Was 28, which was a ten-second fall from the bottom of the clearance
// band.** Eleven makes it 25 seconds at worst and 50 at best, and the reason
// that is not simply easier is the clock: `Timer.js` is the score, so the fall
// is not a time limit the player races, it is the margin before a mistake
// becomes fatal. A slow drop costs a careless player nothing and costs a fast
// one nothing either -- it only removes the run that ends because a gift
// spawned astern at 700 units while the sleigh was pointed the other way.
//
// It is also why there is a parachute. A box sinking at 11 units a second
// under its own weight looks broken; the same box under a canopy looks like
// the only thing it could be doing. See `Parachute.js`.
const FALL_SPEED = 11;

// Between one gift being caught and the next appearing.
const SPAWN_GAP = 1.5;

// No gift spawns within this of a house centre. **This is the one piece of the
// old spec's reachability reasoning that still matters**, and it matters more
// now rather than less. Below the ridge, `Movement.js` blocks horizontally
// against a house: the keep-out disc around a centre runs 90.8 to 110.1 units,
// and the catch radius is 49, so a gift falling down the middle of a plot
// passes through a band where the sleigh cannot legally reach it -- and now
// that it falls, that band is where it lands. 160 clears the widest disc plus
// the catch radius, so the whole of every fall is catchable.
const PLOT_KEEPOUT = 160;
// Attempts before the keep-out is given up on. Five plots at 160 cover a small
// fraction of a 1600-unit world, so this effectively never runs out -- it is
// here because an unbounded `while` in a spawn path is how a frame hangs.
const SPAWN_ATTEMPTS = 12;

// A slow horizontal wander as it comes down, re-aimed every few seconds. Under
// a tenth of the 200 cruise, so it is a nudge, never a chase.
const DRIFT_SPEED = 18;
const DRIFT_INTERVAL = 2.6;

// The sleigh is 74.2 long, so its nose reaches 37.1 from `player.position`;
// the gift is about 5.5 from its own centre to a corner. 49 leaves roughly 6
// units of slack -- generous enough that a near miss at 200 units/sec still
// counts, tight enough that you have to aim.
//
// A sphere against a body 2.8 times longer than it is wide, so a gift taken 40
// units off the beam counts while visibly beside the sleigh rather than in it.
// That is the correct trade for a catching game, and the same call `Player.js`
// makes when it uses the half-length for `collisionRadius`: be generous
// lengthwise and accept that the generosity is isotropic.
const CATCH_RADIUS = 49;

// Same reasoning as Movement.js and Animation.js: the first frame back from a
// backgrounded tab carries the whole time away, which here would be paid out
// as a gift dropping several hundred units in one step -- straight past the
// sleigh and into the ground.
const MAX_DELTA = 0.1;

// ---------------------------------------------------------------------------
// Debug: `?deliver` in the URL opens the run with all five gifts already
// caught, the sack full and god mode on -- straight into the delivery phase.
//
// It exists because the second phase is 30 to 60 seconds of play behind the
// first one, and "fly to town and drop five presents" is not a thing anyone
// should have to catch five falling boxes to look at. The same reasoning as
// `?god` in `GameState.js`, which this borrows its shape from: a URL
// parameter, read once at module scope, off unless asked for.
//
// It does NOT stop the clock or skip the timer, so a run started this way is
// still timed -- it is a shortcut past the catch, not a sandbox.
const SKIP_CATCH_PARAM = 'deliver';
const skipCatch = new URLSearchParams(window.location.search).has(SKIP_CATCH_PARAM);

/**
 * Whether the run opened straight into delivery.
 *
 * Read by `main.js`, which turns god mode on for it. The flag lives here
 * because this is the module that owns the catch it skips, and god mode is
 * switched on from there because `GameState.js` imports nothing and must not
 * learn what a gift is -- the same discipline the win state is specified
 * around.
 */
export function isCatchSkipped() {
  return skipCatch;
}

export const gifts = [];

const clock = new THREE.Clock();

// Loaded once and cloned per gift, rather than `loader.load` per gift the way
// `Enemies.js` does. 123,440 triangles is too much to re-parse five times, and
// `gltf.scene.clone()` shares the geometry so it uploads once.
let template = null;

let caught = skipCatch ? GIFT_TOTAL : 0;
// Starts at the full gap so the first gift appears on the first frame the
// sleigh and the model are both ready, rather than 1.5 seconds into the run.
let timeSinceCatch = SPAWN_GAP;

let countElement = null;
// `gift_delivery` relabels this to `Delivered` rather than adding a second
// counter in the same column.
const DEFAULT_LABEL = 'Gifts';
let countLabel = DEFAULT_LABEL;
// What the counter counts, when it is not counting catches. Null while this
// phase owns it.
//
// The spec for `gift_delivery` asked only for a relabel, on the reading that
// the counter is "the one gift_catch already owns". It is -- but by the time
// the label changes, `caught` is five, so a relabel alone would open the
// delivery phase reading `Delivered 5 / 5`. The denominator is shared; the
// numerator is not.
let countOverride = null;
// Whether `?deliver`'s full sack has been put on the carriage yet. One-shot
// per run; see `updateGifts`.
let sackFilled = false;
let renderedText = null;

function renderCount() {
  if (!countElement) return;

  const text = `${countLabel} ${countOverride ?? caught} / ${GIFT_TOTAL}`;

  // The loop calls this every frame, so skip DOM writes that change nothing.
  if (text === renderedText) return;

  renderedText = text;
  countElement.textContent = text;
}

/**
 * Relabels the counter, and optionally counts something else.
 *
 * For `gift_delivery`, which owns the second phase's numerator but not the
 * element. Called with no count it is a relabel and the catches are still what
 * is shown, which is what the delivery spec asked for and is kept because a
 * caller that only wants the label should not have to pass a number.
 */
export function setGiftCountLabel(label, count = null) {
  countLabel = label;
  countOverride = count;
  renderCount();
}

/**
 * A standalone copy of the present: the cloned model at MODEL_SCALE, tipped
 * the quarter turn every loaded model gets, ready to be added to a scene.
 * Null until the glTF is in.
 *
 * `gift_delivery` drops and delivers the same box this phase catches, and the
 * alternative is a second GLTFLoader call for a 3.5 MB file this module has
 * already parsed and whose 123,440 triangles are already uploaded. Returns the
 * box alone and not the group `spawnGift` builds: a dropped gift falls, and
 * there is no parachute on it.
 */
export function createGiftBox() {
  if (!template) return null;

  const box = template.clone();

  box.scale.setScalar(MODEL_SCALE);
  // As in `spawnGift`: with rotation.x set first the model's local Y is world
  // Z, which is what makes `box.rotation.y` the spin about the up axis.
  box.rotation.x = Math.PI / 2;

  return box;
}

/**
 * Creates the counter, starts the model loading, and burns the delta.
 *
 * Called once from main.js next to `initTimer`.
 */
export function initGifts() {
  countElement = document.createElement('div');
  countElement.className = 'gift-count';
  document.body.appendChild(countElement);
  renderCount();

  new GLTFLoader().load(
    MODEL_PATH,
    (gltf) => {
      template = gltf.scene;
    },
    undefined,
    (error) => {
      // Without this a failed load is a silent run with nothing to catch,
      // which is a worse ten minutes than an error in the console.
      console.error('Gift model failed to load', error);
    },
  );

  if (skipCatch) {
    console.info(
      `Gifts: ?${SKIP_CATCH_PARAM} -- opening with ${GIFT_TOTAL} gifts in the sack`,
    );
  }

  // Every timed system here does this. The wall time spent loading a 3.5 MB
  // model otherwise gets paid out on the first frame.
  clock.getDelta();
}

/** True when a point is far enough from all five plots to be catchable. */
function clearOfHouses(x, y) {
  return houses.every(
    (house) => Math.hypot(x - house.position.x, y - house.position.y) >= PLOT_KEEPOUT,
  );
}

/**
 * A horizontal point in the spawn band around the sleigh, inside the world and
 * clear of the plots. Falls back to the last candidate rather than failing:
 * the caller needs a gift, and a slightly awkward one beats none.
 */
function spawnPointNear(player) {
  let point = null;

  for (let attempt = 0; attempt < SPAWN_ATTEMPTS; attempt += 1) {
    const angle = Math.random() * Math.PI * 2;
    const radius = SPAWN_MIN_RADIUS + Math.random() * (SPAWN_MAX_RADIUS - SPAWN_MIN_RADIUS);

    let x = player.position.x + Math.cos(angle) * radius;
    let y = player.position.y + Math.sin(angle) * radius;
    const fromCentre = Math.hypot(x, y);
    const bound = WORLD_RADIUS - EDGE_MARGIN;

    // Pulled back onto the bound rather than rejected, so a sleigh flying the
    // rim does not have to wait out twelve failed attempts for every gift.
    if (fromCentre > bound) {
      x *= bound / fromCentre;
      y *= bound / fromCentre;
    }

    point = { x, y };

    if (clearOfHouses(x, y)) return point;
  }

  return point;
}

function spawnGift(scene, player) {
  // A group now, rather than the cloned box itself, because the box is no
  // longer the only thing falling. The group is the gift as far as every other
  // module is concerned -- `gift.position` is still the present's centre, and
  // `GiftBeacon.js` and the catch test below read nothing else -- and the two
  // children hang off it:
  //
  //  - `gift.box`, the cloned model, which carries the 0.038 scale and the
  //    Z-up quarter turn and spins about its own axis.
  //  - the parachute, which must NOT inherit either of those, which is the
  //    whole reason this group exists. Parented to the box it would be 26
  //    millimetres across, lying on its side, spinning.
  const gift = new THREE.Group();

  const box = template.clone();

  box.scale.setScalar(MODEL_SCALE);
  // Z is up in this game, so every loaded model is tipped a quarter turn. With
  // rotation.x set first the model's local Y is world Z, which is what makes
  // `box.rotation.y` the spin about the up axis.
  box.rotation.x = Math.PI / 2;

  gift.add(box);
  gift.box = box;

  gift.chute = createParachute();
  gift.add(gift.chute);

  const { x, y } = spawnPointNear(player);
  // Above the ground where it actually starts, and capped well under the
  // ceiling -- a gift above MAX_ALTITUDE is one the sleigh cannot climb to,
  // which would be the unwinnable case all over again with the sign flipped.
  const clearance = SPAWN_MIN_CLEARANCE
    + Math.random() * (SPAWN_MAX_CLEARANCE - SPAWN_MIN_CLEARANCE);

  gift.position.set(
    x,
    y,
    Math.min(groundHeightAt(x, y) + clearance, MAX_ALTITUDE - 40),
  );

  gift.driftAngle = Math.random() * Math.PI * 2;
  gift.timeToReaim = DRIFT_INTERVAL;
  gift.swayPhase = Math.random() * Math.PI * 2;

  scene.add(gift);
  gifts.push(gift);
}

/** Splices by index, the way `removeEnemy` does, so this is safe mid-pass. */
function removeGift(scene, gift) {
  const index = gifts.indexOf(gift);

  if (index !== -1) gifts.splice(index, 1);

  scene.remove(gift);
}

function onCatch(scene, gift, player) {
  removeGift(scene, gift);

  caught += 1;
  timeSinceCatch = 0;
  renderCount();

  play('catch');

  // Half a tank back. This is the exchange the boost exists for: the gift just
  // caught pays for the sprint to the next one, so spending the tank on the
  // way in is the fast line rather than a risk. `Boost.js`'s header has the
  // rest of the reasoning.
  refillBoost();

  // The line the appearance spec has been waiting for. The smile was wired to
  // a monster kill and lost its trigger when the monsters left; catching a
  // gift is its home. The animator holds the grin and takes it off itself, so
  // there is no timer to own here. It does nothing until the rigged Tode
  // lands, and costs nothing meanwhile.
  player.animator?.setExpression('smile', 1, { seconds: 1.2 });

  if (caught < GIFT_TOTAL) return;

  // On the fifth catch the sack fills. `gift_delivery/spec.md` owns both sack
  // models and `Player.js` owns the carriage floor they stand on; this phase
  // owns only the moment, which belongs here rather than there because it is
  // what makes the sleigh look loaded for the flight to town.
  setSackFull(player, true);

  // **No `stopTimer()` here any more.** It was a placeholder for the run's
  // end while the fifth catch was the last thing the game had to say; the
  // delivery phase exists now, and the Game Over screen shows the time, so
  // stopping the clock here would have reported the flight to town and the
  // five drops as taking no time at all. The real stop is the fifth delivery
  // -- `allDelivered()` -- which belongs to `conclusion/win_state/spec.md`
  // along with the ending it announces.
}

function driftGift(gift, delta) {
  gift.timeToReaim -= delta;

  if (gift.timeToReaim <= 0) {
    gift.driftAngle = Math.random() * Math.PI * 2;
    gift.timeToReaim = DRIFT_INTERVAL;
  }

  const x = gift.position.x + Math.cos(gift.driftAngle) * DRIFT_SPEED * delta;
  const y = gift.position.y + Math.sin(gift.driftAngle) * DRIFT_SPEED * delta;
  const radius = Math.hypot(x, y);
  const bound = WORLD_RADIUS - EDGE_MARGIN;

  // Clamped so a gift cannot wander out of the world, and horizontal only --
  // the fall is the vertical term and there is not a second one.
  if (radius > bound) {
    gift.position.x = (x * bound) / radius;
    gift.position.y = (y * bound) / radius;
  } else {
    gift.position.x = x;
    gift.position.y = y;
  }
}

/**
 * Takes every gift out of the scene and puts the count back to zero. Called on
 * restart.
 *
 * `player` is optional only so a caller with nothing to hand it still clears
 * the scene; without it the sack stays as the last run left it.
 */
export function resetGifts(scene, player) {
  gifts.forEach((gift) => scene.remove(gift));
  gifts.length = 0;

  // A restart under `?deliver` is the delivery phase again, not the catch:
  // the flag is what the run IS, so a reset that put five gifts back in the
  // air would make the shortcut good for one run only.
  caught = skipCatch ? GIFT_TOTAL : 0;
  timeSinceCatch = SPAWN_GAP;
  // Back to `Gifts` even if `gift_delivery` had moved it on to `Delivered`: a
  // restart is the catching phase again, and the numerator is the catches
  // again with it.
  countLabel = DEFAULT_LABEL;
  countOverride = null;
  renderCount();

  if (player) setSackFull(player, skipCatch);

  // Throw away the time the Game Over screen was up, so the first gift of the
  // new run starts its fall from where it spawned.
  clock.getDelta();
}

export function allCaught() {
  return caught >= GIFT_TOTAL;
}

/**
 * No obstacle list: a gift is in the air, and the only two things that can
 * happen to it are being caught and reaching the ground.
 */
export function updateGifts(scene, player) {
  const delta = Math.min(clock.getDelta(), MAX_DELTA);

  // After the delta is read, not before -- the same idiom as `updateMovement`,
  // and for the same reason. `player.ready` goes true once all three of its
  // models are in; a catch test against a sleigh still at the construction
  // default is a catch at the wrong place.
  if (!player.ready || !template) return;

  // The one thing `?deliver` cannot do at init: `setSackFull` is a no-op until
  // both sacks are loaded, and this is the first frame they are. A one-shot
  // rather than a line in `onCatch`, because with the catch skipped `onCatch`
  // is never called at all.
  if (skipCatch && !sackFilled) {
    sackFilled = true;
    setSackFull(player, true);
  }

  // Only one gift exists at a time. The story asks for it ("one after the
  // other"), it caps a 123,440-triangle model at one instance on screen, and
  // with a fall to watch it also means there is only ever one thing the player
  // can be too late for.
  if (gifts.length === 0) {
    if (allCaught()) return;

    timeSinceCatch += delta;

    if (timeSinceCatch >= SPAWN_GAP) spawnGift(scene, player);

    return;
  }

  gifts.forEach((gift) => {
    driftGift(gift, delta);
    gift.position.z -= FALL_SPEED * delta;
    gift.box.rotation.y += SPIN_SPEED * delta;

    // The swing, on the group, so the canopy and the strings lean with the
    // box they are holding. Small angles on two axes at different rates, so
    // the default XYZ Euler order costs nothing here.
    gift.swayPhase += delta * SWAY_SPEED;
    gift.rotation.x = Math.sin(gift.swayPhase) * SWAY_TILT;
    gift.rotation.y = Math.cos(gift.swayPhase * 0.73) * SWAY_TILT;

    updateParachute(gift.chute, delta);

    // `Collision.js` cannot do this one: `wouldCollide` measures both bodies
    // as circles on the ground plane and knows nothing about Z. It is in the
    // flight model now, but only for scenery below the ridge, and widening it
    // to gifts would put a vertical term into a module whose whole job is the
    // ground plane. A straight 3D distance instead.
    const distance = Math.hypot(
      gift.position.x - player.position.x,
      gift.position.y - player.position.y,
      gift.position.z - player.position.z,
    );

    if (distance < CATCH_RADIUS) {
      onCatch(scene, gift, player);

      return;
    }

    // The fail state, and **the ground is the whole of it.** This was
    // `crashFloorAt`, which lifts to the treetops outside the planted radius,
    // so a present drifting over the forest was lost 130 units up with clear
    // air still under it and nothing on screen to say why. The sleigh still
    // crashes against the canopy -- it is a vehicle, and flying into a tree
    // should hurt -- but a gift is lost only by reaching the floor. It is also
    // the line `GiftBeacon.js` already draws its beam and its ring on, so what
    // the player is shown and what kills them are now the same number.
    const floor = groundHeightAt(gift.position.x, gift.position.y);

    if (gift.position.z - GIFT_REST <= floor) {
      // Stood on the deck rather than left part-buried, so the Game Over
      // overlay goes up over a frame that shows the player what they missed.
      gift.position.z = floor + GIFT_REST;
      triggerGameOver('A gift reached the ground -- catch them before they land');

      // God mode refuses the Game Over, and a landed gift that stays in the
      // array is a run that can never spawn another one -- one at a time means
      // this gift blocks the rest of the game forever. So in god mode a miss
      // is a free miss: the present is cleared and the next one is along.
      if (!isGameOver()) {
        removeGift(scene, gift);
        timeSinceCatch = 0;
      }
    }
  });
}

export { GIFT_TOTAL, GIFT_REST };
