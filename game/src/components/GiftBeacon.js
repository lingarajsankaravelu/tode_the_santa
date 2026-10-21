// Where the gift is, and where it is about to land.
//
// This module exists because the catching phase was unplayable without it, and
// the reason is worth recording. A gift spawns at a random bearing 220 to 700
// units from the sleigh and falls for ten to twenty seconds. The player cannot
// see behind them -- the camera looks forward over a 74-unit vehicle -- so a
// gift that spawns astern is invisible, and the first the player knows of it is
// the run ending. The honest symptom reported was "going up makes it game
// over": climbing is a reasonable thing to do when you are looking for
// something, and a gift landing behind you while you do it is indistinguishable
// from the climb having killed you.
//
// So the gift gets announced twice over, in world space and on screen:
//
//  - **A red ring** on the snow where the gift will land: the landing spot
//    stated plainly, and the one piece of this that is in the world rather
//    than over it. It pulses faster as the gift comes down. Red against the
//    parachute strobe's green, which is the pairing the rest of the town is
//    already lit in.
//  - ~~**A beam of light**~~ used to stand on that ring and run all the way up
//    to the gift, shortening as it fell, so the time left was something you
//    could see. **Removed on sight of it.** Read from the sleigh it was not a
//    beam in the distance, it was a yellow glare hanging off the bottom of the
//    present you were trying to line up on -- and once the parachute got its
//    strobe, the thing the beam existed to do was being done by something that
//    is part of the gift rather than painted under it. The code is commented
//    out in `createGiftBeacon` below rather than deleted.
//  - **A compass mark**, which is the half that solves the gift being behind
//    you, since no amount of in-world light can. It was a black capsule at the
//    bottom of the screen with an arrow and a range in it, and it was the one
//    thing on screen that was not snow, sky or sleigh. It is now a single
//    chevron riding a ring around the centre of the view: it appears only when
//    the gift is outside the camera's field of view, in the direction you would
//    have to turn, and fades out as you come round onto it. No numbers, no
//    panel. The ring says where the gift is going and the parachute's strobe
//    says where it is; all this has left to say is "not here, that way".
//
// Follows `Snow.js`, the closest existing module: asset-free, scene-level, its
// own clock, one update call per frame.
import * as THREE from 'three';
import { getCameraYaw } from './Camera.js';
import { groundHeightAt } from './Terrain.js';

// Christmas red, and the same red as the Christmas lights' own red bulb in
// `ChristmasLights.js` rather than a new one. The ring and the parachute's
// green strobe are the pair; the sleigh's lanterns keep the gold that used to
// be here.
const RING_COLOR = 0xfd2b2b;

// The ring sits a touch above the deck so it does not fight the snow surface
// in the depth buffer -- the same coplanar problem GROUND_Z in Landscape.js
// exists to avoid, at a smaller scale.
const RING_LIFT = 1.5;
const RING_INNER = 26;
const RING_OUTER = 34;

// The pulse. Slow at altitude, quickening as the gift comes down, which is the
// whole urgency cue: a ring beating fast means a present about to be lost.
const PULSE_MIN_HZ = 0.7;
const PULSE_MAX_HZ = 3.2;
// The fall height over which the pulse ramps from slow to fast.
//
// **Was 420**, the middle of the 280-560 spawn clearance band, which was right
// when `FALL_SPEED` was 28 and a fall lasted ten seconds. At 11 it lasts 25 to
// 50, and a beat that spends 38 seconds quickening is not a warning, it is the
// weather. 160 is a little under 15 seconds at the current fall speed, so the
// ring is steady for most of the descent and only starts hurrying when there
// is something to hurry about.
const URGENCY_HEIGHT = 160;

// Peak opacity of the ring. Short of 1 so the snow still reads through it as
// snow rather than as a decal, and because the pulse below needs somewhere to
// swing.
const RING_OPACITY = 0.6;

// Below this the mark is pointing at something the player is practically on
// top of, and a bearing to it is noise rather than direction.
const MIN_BEARING_DISTANCE = 30;

// When the compass mark appears, as an angle off the nose.
//
// `FIELD_OF_VIEW` in Camera.js is 45 degrees vertical, which at 16:9 is about
// 74 across -- so a gift within 37 degrees of the nose is on screen and does
// not need pointing at. FADE_FROM is just inside that, and the mark reaches
// full strength by FADE_TO. The gap is what stops it blinking on and off while
// a gift sits near the edge of the view.
const FADE_FROM = 0.56;
const FADE_TO = 0.96;
// How far out the ring sits, as a fraction of the viewport's shorter side.
// Measured off the shorter side so the mark stays on screen in any window
// shape, and short of the edge so it is never half-clipped.
const RING_FRACTION = 0.34;
const MARK_OPACITY = 0.8;

// Same clamp as every other timed system here.
const MAX_DELTA = 0.1;

const clock = new THREE.Clock();

let beacon = null;
let ring = null;

let markElement = null;

let pulse = 0;

/**
 * The landing ring, in a group of its own for the scene.
 *
 * The group is kept even though there is one mesh in it now: the beam was the
 * second member, `main.js` adds this by the return value, and a group costs a
 * matrix.
 *
 * **The ring is painted on the snow, not glowing on it,** which is a change
 * from how this started and the reason the colour works. Additive blending
 * adds its colour to what is behind it, and the fields are flat white -- so
 * an additive ring on snow clips to white and loses its hue completely,
 * however saturated the constant is. That was survivable while it was a pale
 * gold, because pale gold on white is what it looked like anyway. A red ring
 * has to be ordinary blending or it is a white ring. `SnowRoads.js` makes the
 * same call for the same reason, and its comment is worth reading next to
 * this one.
 *
 * `depthWrite` stays off so it does not fight the ground it lies a unit and a
 * half above, and `fog` stays off because `scene.fog` starts at 600 and a
 * landing spot has to be readable from further off than that, where fog would
 * have dissolved it into the horizon colour.
 *
 * `depthTest` stays ON, so a hill between the player and the ring hides it --
 * which is correct, and is what the compass mark is there to cover.
 */
export function createGiftBeacon() {
  beacon = new THREE.Group();
  // Nothing to point at until the first gift spawns.
  beacon.visible = false;

  // The beam that used to stand here, kept for whoever wants it back. It was
  // a unit-tall open cylinder tipped a quarter turn so `scale.y` stretched it
  // along world Z, scaled to `span` and re-centred every frame in
  // `updateGiftBeacon`. What it looked like in play is in this file's header,
  // and is the reason it is commented rather than live.
  //
  // const beamMaterial = new THREE.MeshBasicMaterial({
  //   color: 0xffe9a0, transparent: true, opacity: 0.34,
  //   blending: THREE.AdditiveBlending, depthWrite: false,
  //   side: THREE.DoubleSide, fog: false,
  // });
  // beam = new THREE.Mesh(
  //   new THREE.CylinderGeometry(7, 7, 1, 10, 1, true), beamMaterial);
  // beam.rotation.x = Math.PI / 2;
  // beacon.add(beam);

  // A RingGeometry is already in the XY plane, which in this game is the
  // ground -- so unlike everything else here it needs no rotation at all.
  ring = new THREE.Mesh(
    new THREE.RingGeometry(RING_INNER, RING_OUTER, 48),
    new THREE.MeshBasicMaterial({
      color: RING_COLOR,
      transparent: true,
      opacity: RING_OPACITY,
      // No `blending` line: the default is ordinary alpha blending, which is
      // the whole point -- see above.
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false,
    }),
  );

  beacon.add(ring);

  return beacon;
}

/** The compass half: one mark, on a ring, pointing off-screen. */
export function initGiftBeacon() {
  markElement = document.createElement('div');
  markElement.className = 'gift-compass';
  // A glyph rather than an SVG or a border triangle: it inherits the colour
  // and the glow, scales with the font size, and rotates about its own centre
  // without any of the transform-origin care the border trick needs. This one
  // points UP, which is what lets the ring maths below place it and aim it
  // with a single rotation.
  markElement.textContent = '▲';

  document.body.appendChild(markElement);

  hideMark();
  clock.getDelta();
}

function hideMark() {
  markElement.style.opacity = '0';
}

/**
 * Places the compass mark on its ring, and fades it with the bearing.
 *
 * Resolved against the camera the same way `Movement.js` resolves the movement
 * keys -- `getCameraYaw` gives the lens direction, the camera's forward on the
 * ground is `(sin yaw, cos yaw)` and its right is `(cos yaw, -sin yaw)`. The
 * bearing that comes out is measured clockwise from straight ahead, which is
 * also how CSS measures a positive rotation, so the same number does both jobs
 * below: it swings the mark round the ring AND aims the glyph outward.
 *
 * Doing it this way rather than by projecting the gift through the camera
 * matrix is deliberate: a projection is undefined for a point behind the lens,
 * which is exactly the case this mark exists for.
 */
function aimMark(gift, player) {
  const dx = gift.position.x - player.position.x;
  const dy = gift.position.y - player.position.y;
  const distance = Math.hypot(dx, dy);

  // Practically on top of it: the beam is filling the screen and a direction
  // to it means nothing.
  if (distance <= MIN_BEARING_DISTANCE) {
    hideMark();

    return;
  }

  const yaw = getCameraYaw();
  const forward = (dx * Math.sin(yaw) + dy * Math.cos(yaw)) / distance;
  const right = (dx * Math.cos(yaw) - dy * Math.sin(yaw)) / distance;
  const bearing = Math.atan2(right, forward);
  const off = Math.abs(bearing);

  // In view, so there is nothing to say. This is the whole of what makes the
  // cue unobtrusive: most of the time it is not there.
  if (off <= FADE_FROM) {
    hideMark();

    return;
  }

  // Rises over the gap between the two angles, so coming round onto a gift
  // dims the mark out rather than switching it off.
  const strength = Math.min((off - FADE_FROM) / (FADE_TO - FADE_FROM), 1);
  // The shorter side, so the ring fits whatever shape the window is.
  const radius = Math.min(window.innerWidth, window.innerHeight) * RING_FRACTION;

  // Read left to right as nested frames: centre the glyph on the middle of
  // the screen, swing round to the bearing, then push out along the swung
  // up-axis -- which leaves the glyph pointing away from the centre, at the
  // gift, with no second rotation needed.
  markElement.style.transform =
    `translate(-50%, -50%) rotate(${bearing}rad) translateY(${-radius}px)`;
  markElement.style.opacity = `${MARK_OPACITY * strength}`;
}

/**
 * `gift` is the one gift in the air, or null between them.
 *
 * Takes the gift rather than reaching into `Gifts.js` for it, so this module
 * knows nothing about the catching phase but what it is pointed at -- and so
 * `gift_delivery` can hand it a target of its own without a second module.
 */
export function updateGiftBeacon(gift, player) {
  const delta = Math.min(clock.getDelta(), MAX_DELTA);

  if (!gift || !player.ready) {
    beacon.visible = false;
    hideMark();

    return;
  }

  beacon.visible = true;

  const ground = groundHeightAt(gift.position.x, gift.position.y);
  // How far the gift still has to fall. It was the beam's length; it is now
  // only read for the pulse rate below, and the floor of 1 is kept because a
  // gift at the instant it lands would otherwise divide the urgency by
  // nothing.
  const span = Math.max(gift.position.z - ground, 1);

  // `groundHeightAt`, so the ring is drawn on the exact line `Gifts.js` loses
  // a present at.
  ring.position.set(gift.position.x, gift.position.y, ground + RING_LIFT);

  // Faster the lower it gets. Phase is accumulated rather than read off a
  // clock total, so the rate can change without the beat jumping.
  const urgency = 1 - THREE.MathUtils.clamp(span / URGENCY_HEIGHT, 0, 1);
  pulse += delta * (PULSE_MIN_HZ + (PULSE_MAX_HZ - PULSE_MIN_HZ) * urgency) * Math.PI * 2;

  const beat = 0.5 + 0.5 * Math.sin(pulse);

  ring.material.opacity = RING_OPACITY * (0.45 + 0.55 * beat);
  ring.scale.setScalar(1 + 0.12 * beat * (0.3 + urgency));

  aimMark(gift, player);
}
