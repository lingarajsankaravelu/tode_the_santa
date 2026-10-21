// The handkerchief parachute each falling gift comes down under, and the
// beacon blinking at the top of it.
//
// Asset-free and built from primitives, the way `SnowRoads.js` and `Wreath.js`
// are: a square of cloth, four strings to a knot above the box, and one small
// additive bulb. Nothing here is loaded, so it cannot be the reason a gift is
// late to appear.
//
// Two things it is doing for the game rather than for the look:
//
//  - **It explains the fall speed.** `FALL_SPEED` in `Gifts.js` is 11 units a
//    second, which is a present drifting rather than dropping. A bare box
//    doing that looks like a bug in the physics; a box under a parachute looks
//    like the only thing it could possibly be doing.
//  - **The bulb is a second long-range cue.** It is `fog: false` like the
//    beam in `GiftBeacon.js`, so it reads from across the map, and it blinks
//    in sharp flashes rather than breathing -- the eye catches a change far
//    more readily than a brightness, which is the entire reason aircraft
//    carry strobes.
//
// Geometry and materials are built once and shared by every chute, the same
// call `Gifts.js` makes with `a_gift_box.glb`. Only one gift is ever in the
// air, so a shared bulb material is also a bulb material with exactly one
// writer per frame -- but the blink phase still lives on the chute, so a day
// when two gifts fall at once costs a `material.clone()` here and nothing
// else.
import * as THREE from 'three';

// The gift box is 8.55 wide and 11.15 tall, centred on the group origin, so
// its lid is at +5.6. Every figure below is measured off that.

// A square of cloth three times the width of the box. Big enough to read as
// the thing holding it up from a long way off, small enough that it does not
// become the object and leave the present as a detail underneath it.
const CLOTH_SIZE = 26;
// How far the middle of the cloth domes up above its hem. Low, because a
// handkerchief chute is a slack square with air in it, not a hemisphere.
const CLOTH_DOME = 5;
// And how far the four corners hang below the hem, which is the whole of what
// makes it read as cloth rather than as a lid.
const CORNER_DROP = 3.5;
// Height of the cloth's centre above the box's centre.
const CANOPY_Z = 21;
// Where the four strings meet, a little above the lid at 5.6.
const KNOT_Z = 7.2;

// Warm red, the one colour in this game's palette that is neither snow nor
// night: the sleigh's own trim and `SantaSuit.js` already own it, so a red
// canopy belongs to Tode rather than looking like a stray prop.
const CLOTH_COLOR = 0xe0574b;
const STRING_COLOR = 0xf4e8cf;

// The bulb. Green, and the reason is the cloth it sits on: a red strobe is the
// more natural choice for a thing in the air, and on a red canopy it would be
// a red light on red cloth. Green against that red is the maximum contrast
// available, it is the other half of the ring's red on the snow, and it is the
// pair the five houses are already lit in -- `ChristmasLights.js` runs red,
// blue, yellow and green bulbs off one buffer.
const BULB_COLOR = 0x3cff8e;
const BULB_RADIUS = 2.4;
// Flashes per second. Faster than a heartbeat so it cannot be mistaken for the
// ring's urgency pulse in `GiftBeacon.js`, which is the cue that *does* change
// rate and would mean nothing if a second thing in the sky also beat.
const BLINK_HZ = 1.5;
// Sharpness of the flash. The envelope is `beat ** FLASH_POWER`, so a higher
// number spends more of each cycle dark and makes the lit moment a strobe
// rather than a swell. 6 holds the bulb visibly on for about a sixth of a
// cycle.
const FLASH_POWER = 6;
const BULB_OPACITY = 0.95;

let clothGeometry = null;
let clothMaterial = null;
let stringGeometry = null;
let stringMaterial = null;
let bulbGeometry = null;
let bulbMaterial = null;

/**
 * The cloth, as a plane displaced along its own Z.
 *
 * A PlaneGeometry is already in the XY plane, which in this Z-up game is the
 * horizontal one, so -- as `SnowRoads.js` notes about the same two classes --
 * it needs no quarter turn and its vertex Z is already up.
 *
 * The displacement is a product of cosines: full `CLOTH_DOME` at the middle,
 * zero all along the hem, minus a corner term that only bites where both
 * axes are near their edge. That puts the four corners below the hem and the
 * middle of each edge on it, which is what a square of cloth with air under
 * it actually does.
 */
function buildClothGeometry() {
  const geometry = new THREE.PlaneGeometry(CLOTH_SIZE, CLOTH_SIZE, 6, 6);
  const position = geometry.attributes.position;

  for (let i = 0; i < position.count; i += 1) {
    // Normalised to -0.5..0.5 across the cloth, so `cos(PI * u)` is 1 in the
    // middle and 0 at either hem.
    const u = position.getX(i) / CLOTH_SIZE;
    const v = position.getY(i) / CLOTH_SIZE;
    const dome = Math.cos(Math.PI * u) * Math.cos(Math.PI * v);
    const corner = Math.abs(2 * u) * Math.abs(2 * v);

    position.setZ(i, CLOTH_DOME * dome - CORNER_DROP * corner);
  }

  position.needsUpdate = true;
  // The vertices moved after the fact, so the normals the constructor computed
  // are all straight up and the cloth would shade as a flat card.
  geometry.computeVertexNormals();

  return geometry;
}

/** The four strings, corner of the cloth to the knot above the lid. */
function buildStringGeometry() {
  const half = CLOTH_SIZE / 2;
  // The corners sit at the hem minus the full corner drop -- `dome` is 0 and
  // `corner` is 1 there, so this is the same expression as above with both
  // terms resolved.
  const cornerZ = CANOPY_Z - CORNER_DROP;
  const vertices = [];

  [-half, half].forEach((x) => {
    [-half, half].forEach((y) => {
      vertices.push(x, y, cornerZ, 0, 0, KNOT_Z);
    });
  });

  return new THREE.BufferGeometry().setAttribute(
    'position',
    new THREE.Float32BufferAttribute(vertices, 3),
  );
}

function buildShared() {
  if (clothGeometry) return;

  clothGeometry = buildClothGeometry();
  // DoubleSide because the player flies above the gift as often as below it,
  // and the underside of a canopy is the half they see on the approach.
  clothMaterial = new THREE.MeshStandardMaterial({
    color: CLOTH_COLOR,
    roughness: 0.9,
    metalness: 0,
    side: THREE.DoubleSide,
  });

  stringGeometry = buildStringGeometry();
  stringMaterial = new THREE.LineBasicMaterial({ color: STRING_COLOR });

  bulbGeometry = new THREE.SphereGeometry(BULB_RADIUS, 10, 8);
  // Additive and unfogged for the same three reasons the beam is, in
  // `GiftBeacon.js`: it is emitted light rather than a surface, it must not
  // fight the cloth it sits on in the depth buffer, and `scene.fog` starting
  // at 600 would dissolve the one cue that has to carry to 1500.
  bulbMaterial = new THREE.MeshBasicMaterial({
    color: BULB_COLOR,
    transparent: true,
    opacity: BULB_OPACITY,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
  });
}

/**
 * A chute to hang a gift from. Parent it to the gift group, not to the gift
 * box -- the box carries the Z-up quarter turn and the spin, and a canopy
 * tipped on its side spinning at 1.2 rad/sec is not a parachute.
 */
export function createParachute() {
  buildShared();

  const chute = new THREE.Group();

  const cloth = new THREE.Mesh(clothGeometry, clothMaterial);
  cloth.position.z = CANOPY_Z;

  const bulb = new THREE.Mesh(bulbGeometry, bulbMaterial);
  // On top of the dome rather than inside it, so the cloth never occludes the
  // flash from above.
  bulb.position.z = CANOPY_Z + CLOTH_DOME + BULB_RADIUS * 0.6;

  chute.add(cloth);
  chute.add(new THREE.LineSegments(stringGeometry, stringMaterial));
  chute.add(bulb);

  chute.bulb = bulb;
  // Randomised so two runs in a row do not blink in step with each other --
  // and so the first flash is not always on the frame the gift appears.
  chute.blinkPhase = Math.random() * Math.PI * 2;

  return chute;
}

/** Blinks the bulb. The sway of the whole gift belongs to `Gifts.js`. */
export function updateParachute(chute, delta) {
  chute.blinkPhase += delta * BLINK_HZ * Math.PI * 2;

  const beat = 0.5 + 0.5 * Math.sin(chute.blinkPhase);
  const flash = beat ** FLASH_POWER;

  // Never exactly zero: a fully transparent additive mesh is still drawn, and
  // leaving a floor on it keeps a steady bead between flashes for anyone
  // scanning the sky at the wrong moment.
  bulbMaterial.opacity = BULB_OPACITY * (0.12 + 0.88 * flash);
  chute.bulb.scale.setScalar(0.7 + 0.5 * flash);
}
