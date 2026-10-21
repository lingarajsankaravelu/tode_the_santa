// The second half of the story: five gifts in the sack, five houses, one
// each, dropped from the air as Tode passes over.
//
// Implements `hackathon/core_loop/gift_delivery/spec.md`. Three places where
// this file differs from that spec, all of them because the world moved under
// it between revisions and all of them noted at the constant concerned:
//
//  - `DOORSTEP_RADIUS` is still 428.8, but not for the reason given.
//  - The drop lands on the TERRAIN, not on the plane z = 0.
//  - The counter needs a count of its own, not just a relabel.
//
// And one place where it differs because the DESIGN moved rather than the
// world: **a miss ends the run.** The spec made a miss cost time and nothing
// else; see `updateDrop` for why that changed and for how god mode still gets
// the forgiving version.
//
// The spec's own framing survives the rest: delivery is a drop, and the lead
// depends on how high and how fast you are.
import * as THREE from 'three';
import { houseAngle, HOUSE_COUNT, houses } from './House.js';
import { createGiftBox, setGiftCountLabel, GIFT_REST, GIFT_TOTAL } from './Gifts.js';
import { setSackFull } from './Player.js';
import { groundHeightAt } from './Terrain.js';
import { MAX_ALTITUDE, sleighVelocity } from './Movement.js';
import { play } from './Sound.js';
import { isGameOver, triggerGameOver } from './GameState.js';

// Where a gift has to land: a point on the ground, on the house's own angle,
// at a fixed radius from the origin.
//
// **The spec calls this "the centre of the house's path spur, which
// SnowRoads.js already puts there", and that half of the note is wrong.** The
// spur spans radial 322.2 to 440.5 and its centre is 381.35, not 428.8. What
// is true -- and is the half that matters -- is that 428.8 is ON the spur, and
// is the one patch of the corridor clear of everything else in it: walking out
// from the middle of town the plot reads lantern 407.7, **428.8**, lantern
// 433.7, porch column 437.5, front door 453.7. A gift there sits on the snow
// path, a few units short of the outer lantern, with the porch roof still
// clear of it -- which is the whole requirement, because the drop resolves
// against the ground and knows nothing about what is overhead.
const DOORSTEP_RADIUS = 428.8;
// How close the landing has to be. **The spec says 70; this is 90**, and the
// reason is the one thing neither this spec nor `House.js` wrote down: every
// prop on a plot is on the SAME lateral side. Measured off the placed plot,
// lateral positive to one side of the path's axis:
//
//   Trees1 ....... radial 333.4 .. 455.9    lateral  +45.5 .. +134.6
//   SnowMan ...... radial 394.3 .. 405.3    lateral  +22.5 ..  +33.7
//   Kolodec ...... radial 477.1 .. 497.0    lateral  +53.5 .. +115.4
//   Door ......... radial 453.9 .. 456.1    lateral  -20.9 ..   -6.4
//
// So the conifers, the snowman and the well are all to one side and the other
// side is open snow out to -55. A 70-unit circle on the axis reaches +70,
// which is 25 units deep into the tree line -- and that part of it is under a
// canopy and cannot be seen or aimed at, at any opacity. What the extra 20
// buys is on the clear side and in the inward sector, where the marker in this
// file actually reads.
//
// Two limits it stays short of, and both are closer than the spec's arithmetic
// suggests:
//
//  - **101.9**, where it breaks. Adjacent doorsteps are
//    2 x 428.8 x sin(13.75 degrees) = 203.8 apart -- the town spans 110
//    degrees over five houses -- so at 101.9 neighbouring circles touch and a
//    drop between two houses stops being unambiguous about which one it was
//    meant for. 90 leaves 23.8 units of gap, which is also what keeps the five
//    discs reading as five targets rather than as one band across the town.
//  - **about 103**, where it starts spilling onto the lane: `SnowRoads.js`
//    puts the road at radial 275.2 to 325.2, and 428.8 - 90 = 338.8 clears its
//    outer edge by 13.6.
//
// The cost is the judgement call, and it is the thing to put back first if
// delivery feels free: at the 200 cruise the window opens from the spec's
// +/-0.35 seconds to +/-0.45.
const DELIVERY_RADIUS = 90;

// Units/sec^2. About three times real gravity at this project's scale --
// roughly 2.7 inches per world unit, so true g would be about 143. Exaggerated
// on purpose: at 143 a drop from 400 hangs for 2.4 seconds, which is a long
// time to watch a box.
const GRAVITY = 420;
// Stops the whole sack being emptied onto one roof in a single pass.
const DROP_COOLDOWN = 0.5;
// How long a missed gift lies in the snow before the wind takes it back.
const RETURN_DELAY = 3.5;
// It rises, and is removed once it passes MAX_ALTITUDE -- at which point it is
// back in the sack.
//
// Worth knowing what that costs now, because the ceiling moved after the spec
// was written. The spec priced a miss at "3.5 seconds, plus the trip back
// round", on a MAX_ALTITUDE of 400: a 1.5-second rise. It is 900 now, so the
// rise is 3.5 seconds and a miss is about 7 before the gift can be dropped
// again. Left at MAX_ALTITUDE rather than pinned to 400, because the rule the
// spec is stating is "out of the world", and a gift that vanished at the
// altitude the sleigh cruises at would vanish in plain sight. 7 seconds is
// still a cost in time and nothing else, which is the whole of the design.
const RETURN_SPEED = 260;

// ---------------------------------------------------------------------------
// The marked doorstep: a yellow-tinted disc of exactly DELIVERY_RADIUS on the
// snow at each undelivered house, and an on-screen line naming the key.
//
// Neither is in the spec, and the spec's reason for having neither was
// "progress is legible by looking at the town, with no UI at all" -- which is
// true of progress and not true of the TARGET. A player arriving over the town
// with a full sack is being asked to judge a 70-unit circle they cannot see,
// on a key they have not been told about, having spent the whole first phase
// being shown a red ring wherever they were supposed to go. The discs state
// the tolerance the drop is actually scored against; the line states the key.
// Both are the catching phase's own cues, kept rather than withdrawn.
// ---------------------------------------------------------------------------

// The gold this game already uses for "the thing you have to do" -- the Game
// Over screen's reason line and the god-mode badge are both `#ffd964`, and the
// boost gauge is a shade off it. Deliberately NOT the landing ring's Christmas
// red in `GiftBeacon.js`: that ring says "a gift is coming down here and you
// will lose it", and this disc says "put one here". Two cues that mean
// opposite things should not share a colour.
const MARKER_COLOR = 0xffd964;
// Ordinary alpha blending and these two opacities, not additive. The lesson is
// `GiftBeacon.js`'s and its comment is worth reading: the fields are flat
// white, so an additive mark on snow clips to white and loses its hue
// completely however saturated the constant is.
//
// The fill is faint because it covers 25,447 square units of snow per house --
// a tenth of the whole town's footprint, five times over -- with the path, a
// lantern and most of a conifer stand inside it. The rim is what the eye lines
// up on. **Down from 0.17 when DELIVERY_RADIUS went from 70 to 90**: the same
// wash over 65% more ground had the five plots reading as a yellow-tinted
// town rather than as five marked doorsteps.
const MARKER_FILL_OPACITY = 0.13;
const MARKER_RIM_OPACITY = 0.6;
// The rim's width, inward from DELIVERY_RADIUS -- so the OUTER edge of the
// band is the real boundary. A rim centred on it would read as a line two
// units wider than the rule it is drawing.
const MARKER_RIM_WIDTH = 3;
// Above the deck, so neither fights the snow in the depth buffer -- the same
// coplanar problem `GROUND_Z` in `Landscape.js` exists to avoid, and the same
// fix the landing ring uses at 1.5. The rim is a touch higher than the fill
// for the same reason, against the fill.
const MARKER_FILL_LIFT = 1.2;
const MARKER_RIM_LIFT = 1.5;
// Breathing, so the discs read as live targets rather than as paint. Slow: a
// doorstep is not urgent the way a falling present is, and `GiftBeacon.js`
// owns the fast beat.
const MARKER_PULSE_HZ = 0.55;
// How much of each opacity the pulse swings.
const MARKER_PULSE_DEPTH = 0.35;
// Segments. 70 units of radius is 440 of circumference, so 56 puts a chord
// every 7.9 units -- round at any range the sleigh reads it from.
const MARKER_SEGMENTS = 56;

// What the hint says, and when it goes.
const HINT_TEXT = 'Space to deliver a gift';
// It is dismissed by the first press rather than by a timer. A key hint has
// landed the moment the key is used, and a player who has not pressed it yet
// is exactly the player still reading -- so this is shown for as long as it is
// the answer to the question being asked, which no number of seconds can know.
const HINT_CLASS = 'delivery-hint';
const VISIBLE_CLASS = 'visible';

// Radians per second about the up axis, while a gift is in the air. Not in the
// spec, and the same speed `Gifts.js` turns a falling present at: a box that
// held one face to the camera for the whole fall would be the only thing in
// the game that does. It stops once the gift is lying in the snow, which is
// also what makes a delivered one read as set down rather than paused.
const TUMBLE_SPEED = 0.6;

// Space. The spec argues this out at length and the argument is still live, so
// briefly: `Movement.js` had Space as an alias for Q, Q does the job, and
// Space is the most natural "release the thing you are carrying" key on a
// keyboard. The `Space` row is gone from CLIMB_KEYS and the hint in
// `Camera.js` now advertises the drop.
//
// `GameState.js` claims the same key on keydown while the run is over, to
// restart. The two cannot both be live -- the render loop stops calling
// `updateDelivery` the moment the run ends -- and when
// `conclusion/win_state/spec.md` lands, that guard has to read its
// `isRunOver()` rather than `gameOver`, or Space on the win screen falls
// through to this module.
const DROP_KEY = 'Space';

// Same reasoning as every other timed system here: the first frame back from a
// backgrounded tab carries the whole time away, which for a gift mid-fall
// would be several hundred units in one step -- straight through the ground
// without a landing frame to test.
const MAX_DELTA = 0.1;

// The counter `gift_catch` already owns, relabelled rather than doubled.
const COUNT_LABEL = 'Delivered';

// House indices served, owned HERE and not in `House.js` -- the town is
// scenery and should not know there is a game loop.
const delivered = new Set();

// Every gift that has left the sack and not yet come back to it: falling,
// lying in the snow, or rising out of the world. A delivered one is not in
// here; it has stopped being anything but scenery, and `placed` holds it only
// so a restart can take it out of the scene again.
const drops = [];
const placed = [];

const clock = new THREE.Clock();

let cooldown = 0;
// Set by the keydown listener and consumed by the next update. A latch rather
// than a held-key test: a drop is an event, and reading the key state would
// empty the sack at one gift per cooldown for as long as a thumb rested on it.
let dropRequested = false;
// Whether the counter has been handed over to this phase yet. One assignment
// per run, on the first frame of delivery.
let labelled = false;
// What the sack currently shows, so the swap is written once rather than every
// frame.
let sackFull = true;

// The five doorstep discs, indexed by house, inside one group for the scene.
// Built at startup -- `houseAngle` is pure arithmetic and does not wait on the
// async `houses`, so these need no readiness guard of their own.
let markerGroup = null;
const markers = [];
// Shared across all five, so the pulse below is two writes for the whole town
// rather than ten -- the same saving `ChristmasLights.js` gets from one colour
// buffer. It also means each disc cannot drift out of step with the others,
// which five separate materials would eventually do.
let fillMaterial = null;
let rimMaterial = null;
let markerPulse = 0;

let hintElement = null;

/** Gifts in hand: five, less the delivered, less everything still out. */
function inHand() {
  return GIFT_TOTAL - delivered.size - drops.length;
}

/** The doorstep of house `index`: a point on the ground, on the house's angle. */
function doorstep(index) {
  const angle = houseAngle(index);

  return {
    x: Math.cos(angle) * DOORSTEP_RADIUS,
    y: Math.sin(angle) * DOORSTEP_RADIUS,
  };
}

/**
 * Which undelivered house a landing at (x, y) serves, or -1.
 *
 * The nearest one inside DELIVERY_RADIUS, though the nearest is the only one
 * it can be: the circles are 64 units apart and cannot overlap. Checking
 * distance rather than taking the nearest unconditionally is what makes a drop
 * on open country a miss.
 *
 * A house already served is simply not a candidate, which is the whole of
 * "a house cannot be delivered to twice" -- no special case, no guard.
 */
function houseServedAt(x, y) {
  let best = -1;
  let bestDistance = DELIVERY_RADIUS;

  for (let index = 0; index < HOUSE_COUNT; index += 1) {
    if (delivered.has(index)) continue;

    const target = doorstep(index);
    const distance = Math.hypot(x - target.x, y - target.y);

    if (distance < bestDistance) {
      best = index;
      bestDistance = distance;
    }
  }

  return best;
}

function renderCount() {
  setGiftCountLabel(COUNT_LABEL, delivered.size);
}

/**
 * One doorstep disc: a tinted fill and a brighter rim at its edge, at exactly
 * DELIVERY_RADIUS.
 *
 * `CircleGeometry` and `RingGeometry` both already lie in XY, which in this
 * game is the ground -- so unlike almost everything else here neither needs
 * the Z-up quarter turn. `SnowRoads.js` makes the same observation.
 *
 * `depthWrite` is off so these do not fight the snow they lie a unit above,
 * and `fog` is off because `scene.fog` starts at 600: a target has to be
 * readable from the altitude it is aimed from, and the whole town is further
 * off than that on the way in. `depthTest` stays ON, so a roof in front of a
 * doorstep hides it, which is correct -- it is lying on the ground, not
 * painted on the lens.
 */
function createMarker(index) {
  const marker = new THREE.Group();
  const { x, y } = doorstep(index);
  const ground = groundHeightAt(x, y);

  const fill = new THREE.Mesh(
    new THREE.CircleGeometry(DELIVERY_RADIUS, MARKER_SEGMENTS),
    fillMaterial,
  );

  fill.position.z = MARKER_FILL_LIFT;

  const rim = new THREE.Mesh(
    new THREE.RingGeometry(
      DELIVERY_RADIUS - MARKER_RIM_WIDTH,
      DELIVERY_RADIUS,
      MARKER_SEGMENTS,
    ),
    rimMaterial,
  );

  rim.position.z = MARKER_RIM_LIFT;

  marker.add(fill);
  marker.add(rim);
  marker.position.set(x, y, ground);

  return marker;
}

/**
 * The five marked doorsteps, in a group for the scene.
 *
 * Called once from main.js next to `createGiftBeacon`, and on the scene rather
 * than on the map group even though it is ground scenery: the map group is
 * where `House.js` puts the town, and these are not the town, they are the
 * game loop drawn on it. Hidden until the delivery phase opens.
 */
export function createDoorstepMarkers() {
  fillMaterial = new THREE.MeshBasicMaterial({
    color: MARKER_COLOR,
    transparent: true,
    opacity: MARKER_FILL_OPACITY,
    // No `blending` line: the default is ordinary alpha blending, which is the
    // whole point -- see MARKER_FILL_OPACITY.
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: false,
  });

  rimMaterial = fillMaterial.clone();
  rimMaterial.opacity = MARKER_RIM_OPACITY;

  markerGroup = new THREE.Group();
  // Nothing to aim at until the sack is full.
  markerGroup.visible = false;

  for (let index = 0; index < HOUSE_COUNT; index += 1) {
    const marker = createMarker(index);

    markerGroup.add(marker);
    markers.push(marker);
  }

  return markerGroup;
}

/**
 * The breath. Opacity only, and deliberately NOT scale, which is what the
 * landing ring in `GiftBeacon.js` pulses: that ring is a hint about where
 * something will land, so a few units of swing cost nothing. This circle is
 * the tolerance the drop is actually scored against, and a target that
 * visibly changes size is a target lying about its size.
 */
function pulseMarkers(delta) {
  markerPulse += delta * MARKER_PULSE_HZ * Math.PI * 2;

  const beat = 1 - MARKER_PULSE_DEPTH * (0.5 + 0.5 * Math.sin(markerPulse));

  fillMaterial.opacity = MARKER_FILL_OPACITY * beat;
  rimMaterial.opacity = MARKER_RIM_OPACITY * beat;
}

function showHint(visible) {
  if (!hintElement) return;

  hintElement.classList.toggle(VISIBLE_CLASS, visible);
}

/**
 * Binds the drop key.
 *
 * Called once from main.js next to `initGifts`. `event.repeat` is refused so
 * holding the key is one gift rather than a stream of them at the OS's
 * autorepeat rate, and `preventDefault` is this module's job now that
 * `Movement.js` no longer claims Space -- without it the page scrolls.
 */
export function initDeliveryInput() {
  hintElement = document.createElement('div');
  hintElement.className = HINT_CLASS;
  hintElement.textContent = HINT_TEXT;
  document.body.appendChild(hintElement);

  window.addEventListener('keydown', (event) => {
    if (event.code !== DROP_KEY || event.repeat) return;

    // Stands down once the run is over, which is when `GameState.js` claims
    // the same key to restart. `updateDelivery` is not being called then
    // either, so this is not what stops the drop -- it stops the latch below
    // being set and then consumed on the first frame of the NEXT run, which
    // would otherwise depend on this listener having been registered before
    // GameState's. `resetDelivery` clears it as well; this makes it not
    // happen rather than undoing it afterwards.
    if (isGameOver()) return;

    event.preventDefault();
    dropRequested = true;
  });

  // The wall time spent loading and then catching five gifts, which this
  // module's clock has been banking since the page opened.
  clock.getDelta();
}

/** Takes a gift out of the sack and lets go of it. */
function releaseGift(scene, player) {
  const box = createGiftBox();

  // Null until `a_gift_box.glb` is in, which it must be -- five of them have
  // been caught by now -- but a module that clones someone else's template
  // should not assume the owner succeeded.
  if (!box) return;

  // Added to the SCENE, not to the player. The camera is a child of the player
  // group, so a gift parented there would be released in front of the lens and
  // would then travel with the sleigh instead of falling behind it. Nothing
  // here needs the brief attached frame the spec allows for, so there is no
  // moment where this is on `player.tilt` either.
  box.position.copy(player.position);
  scene.add(box);

  // The sleigh's horizontal velocity, kept. This is the lead the player is
  // judging: the gift goes on at the speed it left at and the only force on it
  // after that is gravity.
  const velocity = sleighVelocity();

  drops.push({
    box,
    vx: velocity.x,
    vy: velocity.y,
    vz: 0,
    // 'falling', then 'resting', then 'returning'. A delivered gift leaves the
    // list rather than taking a fourth state.
    state: 'falling',
    restTimer: 0,
  });

  cooldown = DROP_COOLDOWN;

  // The hint has done its job: the key has been pressed. Withdrawn here rather
  // than on the first DELIVERY, so a player who presses Space and misses is
  // not still being told which key to press.
  showHint(false);
}

function deliverGift(player, drop, index) {
  delivered.add(index);

  // Left exactly where it landed rather than snapped to the doorstep: the
  // whole point of the 70-unit circle is that the player aimed and this is
  // where it went. It stays on the path for the rest of the run, which is what
  // makes progress legible by looking at the town instead of at the counter.
  drops.splice(drops.indexOf(drop), 1);
  placed.push(drop.box);

  // Its circle stops being drawn because it has stopped being a target -- the
  // same moment, and the same fact, that makes a second gift dropped on it a
  // miss. `houseServedAt` and this line read the one `delivered` set, so the
  // marks on the snow cannot disagree with what the drop is scored against.
  if (markers[index]) markers[index].visible = false;

  play('deliver');
  // The same call the catch makes. The animator holds the grin and takes it
  // off itself, so there is no timer to own here.
  player.animator?.setExpression('smile', 1, { seconds: 1.2 });

  renderCount();
}

function removeDrop(scene, drop) {
  const index = drops.indexOf(drop);

  if (index !== -1) drops.splice(index, 1);

  scene.remove(drop.box);
}

/**
 * One gift, one frame.
 *
 * The landing test is the only part with a decision in it; the rest is three
 * states advancing on a timer.
 */
function updateDrop(scene, player, drop, delta) {
  if (drop.state === 'resting') {
    drop.restTimer -= delta;

    if (drop.restTimer <= 0) drop.state = 'returning';

    return;
  }

  if (drop.state === 'returning') {
    drop.box.position.z += RETURN_SPEED * delta;
    drop.box.rotation.y += TUMBLE_SPEED * delta;

    // Out of the world and back into the sack. `inHand` counts it the moment
    // it leaves `drops`, so this line is also where the count goes up and --
    // if the sack had emptied -- where the full one comes back.
    if (drop.box.position.z > MAX_ALTITUDE) removeDrop(scene, drop);

    return;
  }

  drop.vz -= GRAVITY * delta;

  drop.box.position.x += drop.vx * delta;
  drop.box.position.y += drop.vy * delta;
  drop.box.position.z += drop.vz * delta;
  drop.box.rotation.y += TUMBLE_SPEED * delta;

  // **Against the terrain, where the spec says the plane z = 0.** That was
  // true of the world the spec was written for and the two still agree
  // everywhere it matters -- the town stands at 480, well inside the flat
  // basin -- but `WORLD_RADIUS` is 1600 now and the ground outside the basin
  // runs from -95 in the river channel to 575 on the far ridge. A drop over
  // the hills would otherwise sink hundreds of units into them before it
  // registered as a miss, and the gift that blew back out would rise out of
  // solid rock. This is still not a test of WHAT it landed on, which is the
  // thing the spec is actually ruling out: there is no surface here, only a
  // height.
  const floor = groundHeightAt(drop.box.position.x, drop.box.position.y);

  if (drop.box.position.z - GIFT_REST > floor) return;

  // Stood on the deck rather than left part-buried, the same way `Gifts.js`
  // stands a missed present.
  drop.box.position.z = floor + GIFT_REST;

  const index = houseServedAt(drop.box.position.x, drop.box.position.y);

  if (index !== -1) {
    deliverGift(player, drop, index);

    return;
  }

  // **A miss ends the run.** The spec priced a miss in time -- it lay in the
  // snow, blew back into the sack, and cost about 7 seconds -- and that is no
  // longer the design: five gifts, five houses, and no second attempt at any
  // of them. Priced in time, the floor on a run was "fly badly for long
  // enough and you still finish", which left the delivery phase with no way
  // to be failed and the clock doing all of the work.
  //
  // Called before the blow-back below rather than instead of it, and that
  // order is the whole trick: `triggerGameOver` returns without doing
  // anything in god mode, so the lines after it are now exactly the god-mode
  // path. A ?god or G run still gets the old behaviour -- the gift lies there,
  // the wind takes it back, and the sack refills -- which is what makes god
  // mode usable for practising the drop.
  triggerGameOver('A gift missed the doorstep');

  // Nothing is destroyed. It lies in the snow for RETURN_DELAY and then blows
  // back into the sack. It is not an obstacle while it lies there, including
  // to a landed sleigh -- `Collision.js` is untouched by this phase -- because
  // making it solid would mean the only way to recover a miss is to not be
  // standing where it fell.
  drop.state = 'resting';
  drop.restTimer = RETURN_DELAY;
  drop.vx = 0;
  drop.vy = 0;
  drop.vz = 0;
}

/**
 * Called from the render loop, inside the run-is-not-over guard and only once
 * `allCaught()` is true.
 */
export function updateDelivery(scene, player) {
  const delta = Math.min(clock.getDelta(), MAX_DELTA);

  // After the delta is read, not before -- the same idiom as `updateMovement`
  // and `updateGifts`, and for the same reason.
  //
  // `houses` is filled asynchronously and is empty for the first few frames of
  // the page. It will have been full long before the fifth gift was caught, so
  // this is a guard against a shape rather than against a case anyone will
  // see: a module that reads a list someone else fills should not assume it is
  // there. The drop is inert until it is.
  if (!player.ready || houses.length < HOUSE_COUNT) return;

  if (!labelled) {
    labelled = true;
    renderCount();
    // The first frame of the delivery phase: the town's doorsteps are marked,
    // and the key is named. Both wait for this frame rather than being up from
    // the start of the run, because during the catch neither is true yet --
    // there is nothing in the sack and nowhere to put it.
    if (markerGroup) markerGroup.visible = true;
    showHint(true);
  }

  if (markerGroup) pulseMarkers(delta);

  cooldown -= delta;

  // Gifts in hand is `5 - delivered - out`; at zero the key is ignored, which
  // is also what makes a press during the fall of the last gift do nothing.
  if (dropRequested && cooldown <= 0 && inHand() > 0) releaseGift(scene, player);

  // Consumed whether or not it was acted on, so a press refused by the
  // cooldown does not fire half a second later.
  dropRequested = false;

  // Backwards: `updateDrop` can splice the current gift out on delivery or on
  // its way out of the world.
  for (let index = drops.length - 1; index >= 0; index -= 1) {
    updateDrop(scene, player, drops[index], delta);
  }

  // The sack swaps once the last gift is out of it, and swaps back if a miss
  // blows one home. `Player.js` owns the carriage floor both models stand on
  // and has already stood each of them on it by its own box; this is the
  // visibility toggle between the two.
  const full = inHand() > 0;

  if (full !== sackFull) {
    sackFull = full;
    setSackFull(player, full);
  }
}

/**
 * Takes every gift out of the scene -- falling, lying in the snow and
 * delivered at a door -- and puts the count back to zero. Called on restart.
 *
 * `Gifts.js` puts the counter's label back to `Gifts` itself, so there is
 * nothing to undo here; and it is `resetGifts` that puts the empty sack back
 * on the carriage, because a restart is the catching phase again.
 */
export function resetDelivery(scene) {
  drops.forEach((drop) => scene.remove(drop.box));
  drops.length = 0;

  placed.forEach((box) => scene.remove(box));
  placed.length = 0;

  delivered.clear();

  cooldown = 0;
  dropRequested = false;
  labelled = false;
  sackFull = true;

  // Every doorstep is a target again, and the group goes back out of sight
  // until the next sack is full. Forgetting this is the quiet half of the
  // restart: nothing would look broken, the next run would simply start with
  // the served houses unmarked.
  markers.forEach((marker) => {
    marker.visible = true;
  });

  if (markerGroup) markerGroup.visible = false;

  showHint(false);

  // Throw away the time the overlay was up.
  clock.getDelta();
}

/**
 * The served house indices.
 *
 * Indices and not houses, deliberately: `houses` is filled asynchronously, and
 * a getter that handed back objects would be a getter every caller had to know
 * that about. Sorted, so it reads west to east like the array it indexes.
 */
export function getDelivered() {
  return [...delivered].sort((a, b) => a - b);
}

/**
 * The win condition. `conclusion/win_state/spec.md` owns what happens next --
 * this module does not show a screen, stop the clock or end the run.
 */
export function allDelivered() {
  return delivered.size >= HOUSE_COUNT;
}
