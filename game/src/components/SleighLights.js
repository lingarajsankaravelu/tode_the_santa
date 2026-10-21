import * as THREE from 'three';

// The sleigh carries its own light, because nothing else in the scene will.
//
// Lighting.js is a night rig on purpose: one cool moon at 1.0 raking from
// (-100, -100, 200) and a hemisphere fill at 0.6. That is the right light for
// a snowfield seen from above and the wrong light for the thing the camera is
// locked to -- the sleigh is nearly always between the moon and the lens, so
// the side facing the player is its shadowed side, and Tode sits down inside a
// carriage that shades him further. He was not missing. He was unlit.
//
// So: two unseen coach lamps on the carriage, and a string of bulbs laid
// along the wood -- down both side panels and out along the draft pole between the
// pullers. Along the wood, not over it: a string that floats above the rim
// has nothing holding it up and reads as hung over the sleigh rather than as
// part of it.
//
// The four colours are the town's, the same palette ChristmasLights pulls off
// the houses, because a sleigh decorated in a fifth and sixth colour would
// read as belonging to a different Christmas.
const COLORS = [0xfd0000, 0x3900ff, 0xecec00, 0x00cf00];

// Lantern flame. Warm against the moon's 0xd6e4ff, and that opposition is the
// whole point: the two lights differ in hue as well as in direction, so the
// sleigh separates from the snow behind it instead of being a brighter patch
// of the same blue.
const LANTERN_COLOR = 0xffb866;
// Candela, and these are tuned against the moon's 1.0 rather than picked.
//
// `decay` is 1 here, not the physical 2, and that is a deliberate cheat worth
// knowing about. A lamp 15 units from Tode and 41 from the lead pair is
// nearly 3x further from the team than from the rider; under inverse square
// the team gets an eighth of his light and either he blows out or they stay
// black. At decay 1 the ratio is the distance ratio, which is what a reader
// expects from one lamp lighting a small vehicle. Measured, the pair put
//
//   Tode .............. 2.6     the sack .......... 1.6
//   the rear pair ..... 1.6     the lead pair ..... 1.0
//
// against the moon's 1.0 -- lantern-lit, falling off down the team, and not
// floodlit.
const LANTERN_INTENSITY = 20;
const LANTERN_DECAY = 1;
// Where the pool ends. Big enough that a landed sleigh lays light on the snow
// around it (the lamps ride 8.8 above the sleigh's centre, so 21 above the
// snow with the runners down),
// small enough that flying over a house does not light the house.
const LANTERN_RANGE = 200;

// Everything below is in the sleigh's own units, measured off the model's
// mesh nodes rather than guessed:
//
//   Polygon_Reduction_1_Material_0_0  the carriage body, x -4.579..-2.621,
//                                     y 6.126..7.377, z -0.132..1.124
//   Cylinder_Mat.1_0                  the draft pole, x -2.709..-0.099,
//                                     y 6.553..6.705, z 0.531..0.616
//   Object_16 / _87 / _158 / _229     the four pullers, y 5.824..6.355
//
// The pole's top at 6.705 clears the pullers' backs at 6.355, which is what
// makes it the one place a string can run between them without lying on an
// animated animal.
const CARRIAGE = {
  // The outer faces of the two side panels, from the body's box. Only the
  // lamps use these now, and a lamp is an invisible point light -- being a
  // little wide of the real surface moves where the light comes from by half
  // a unit and shows nothing.
  left: -0.132,
  right: 1.124,
};
const POLE = {
  front: -0.15,
  back: -2.65,
  top: 6.705,
  // The pole's own centre line, which is 0.0785 off the carriage's -- the
  // model is not quite symmetric and the string follows the wood, not the
  // axis it ought to have been built on.
  z: 0.5735,
};
// Clear of the surface a bulb is mounted on. At zero half of each sprite is
// swallowed by the panel it lies against -- the same correction
// ChristmasLights makes with BULB_OUTSET, at this model's scale.
const OUTSET = 0.03;

// The two coach lamps, on the front corners of the carriage sides, where a
// real one is bolted. y 7.15 puts them on the panel and below its rim.
const LAMP_X = -2.70;
const LAMP_Y = 7.15;

// Sprite size, in world units, like the town's.
const BULB_SIZE = 5;
// Also world units -- `place` has already applied the sleigh's scale by the
// time the string is laid out, so this is the spacing the houses use and the
// two strings read at the same pitch.
const BULB_SPACING = 9;

/**
 * A bulb: a 32px radial gradient with a hot core and a tight falloff.
 *
 * The same shape as the town's, and intentionally not shared with it --
 * ChristmasLights keeps one module-level `shared` rig for all five plots and
 * exports nothing, and reaching into it to borrow a texture would couple the
 * sleigh to a cache that exists for a different reason.
 */
function createBulbTexture() {
  const size = 32;
  const canvas = document.createElement('canvas');

  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(
    size / 2, size / 2, 0,
    size / 2, size / 2, size / 2,
  );

  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(0.35, 'rgba(255, 255, 255, 0.9)');
  gradient.addColorStop(0.7, 'rgba(255, 255, 255, 0.25)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);

  texture.colorSpace = THREE.SRGBColorSpace;

  return texture;
}

/**
 * Walks a path of corners at a fixed spacing.
 *
 * Both are in world units: the corners arrive already mapped through `place`,
 * so resizing the sleigh changes how many bulbs the rim takes rather than how
 * far apart they sit.
 */
function along(corners, spacing) {
  const points = [];

  for (let index = 0; index < corners.length - 1; index += 1) {
    const from = corners[index];
    const to = corners[index + 1];
    const run = from.distanceTo(to);
    // At least the two ends of every leg, so a corner always carries a bulb.
    const steps = Math.max(1, Math.round(run / spacing));

    for (let step = 0; step < steps; step += 1) {
      points.push(from.clone().lerp(to, step / steps));
    }
  }

  points.push(corners[corners.length - 1].clone());

  return points;
}

/**
 * Builds the sleigh's lighting, in the space `place` maps into.
 *
 * `place(x, y, z)` is Player.js's `onSleigh` -- a point of the sleigh's own
 * geometry, in world units, recentred the way the model itself was. Taking it
 * as an argument rather than importing the bounds keeps one definition of
 * where the sleigh's middle is, in the file that already owns it.
 *
 * The constants above are in the sleigh's own units where they are read
 * before `place` (the rim, the outset) and in world units where they are read
 * after it (the sizes, the spacing, the light's range and intensity).
 *
 * Returns a group for `tilt`, so the whole rig banks with the sleigh. Adding
 * it to `player` instead would leave the lamps and the string level while the
 * sleigh rolls under them -- and would put them in front of the camera, which
 * is a child of that same group.
 */
export function createSleighLights(place) {
  const rig = new THREE.Group();

  rig.name = 'SleighLights';

  // One run: the draft pole between the pullers.
  //
  // There were three. The other two laid four bulbs down each carriage side
  // panel, at y 6.95 and just outside the body's z of -0.132 and 1.124 --
  // numbers taken from the body mesh's bounding box, which is the mistake.
  // That box is the hull at its widest, and the carriage narrows as it rises,
  // so at the height those bulbs sat the panel had already drawn in under
  // them and all eight hung in the air either side of Tode.
  //
  // Following the true surface would mean sampling the body's vertices along
  // its length rather than reading one box, and the pole does not have the
  // problem: it is a cylinder of near-constant section, so its own box IS its
  // surface and the string lies on it.
  const runs = [
    [
      place(POLE.back, POLE.top + OUTSET, POLE.z),
      place(POLE.front, POLE.top + OUTSET, POLE.z),
    ],
  ];
  // Five bulbs, along the pole.
  const bulbs = runs.flatMap((run) => along(run, BULB_SPACING));
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(bulbs.length * 3);
  const colors = new Float32Array(bulbs.length * 3);
  const color = new THREE.Color();

  bulbs.forEach((bulb, index) => {
    bulb.toArray(positions, index * 3);
    // Cycled in a fixed order and carried straight on from one run into the
    // next, which is what one long wire looks like -- the same reason
    // ChristmasLights carries its cycle from tree to tree rather than
    // restarting per tree. Four colours over five bulbs, so the string does
    // not read as a repeating pair.
    color.set(COLORS[index % COLORS.length]).toArray(colors, index * 3);
  });

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const string = new THREE.Points(geometry, new THREE.PointsMaterial({
    map: createBulbTexture(),
    size: BULB_SIZE,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    blending: THREE.AdditiveBlending,
    // Depth test on, depth write off -- same reasoning as the town's string.
    // The carriage hides the bulbs on its far side, and overlapping glows
    // brighten each other instead of punching holes in one another.
    depthWrite: false,
  }));

  string.name = 'Bulbs';
  // The one place where the town's reasoning does not carry over: this object
  // is always within a few dozen units of the camera and always on screen, so
  // the cull test can only ever cost and never save.
  string.frustumCulled = false;
  rig.add(string);

  // The two coach lamps: the light only, with nothing drawn where it comes
  // from. The sprites that used to sit here were two big warm blobs either
  // side of Tode, floating clear of the panel with no lamp body under them --
  // the thing they were meant to prevent, which is light arriving from
  // nowhere, read worse as a pair of hanging dots than as no source at all.
  //
  // What licenses leaving them out is the string above: there are lit bulbs
  // on the sleigh, forward of the lamps and in shot whenever they are, so the
  // glow on the carriage has something visible to be credited to.
  const lamps = [
    place(LAMP_X, LAMP_Y, CARRIAGE.left - OUTSET),
    place(LAMP_X, LAMP_Y, CARRIAGE.right + OUTSET),
  ];

  lamps.forEach((lamp) => {
    const light = new THREE.PointLight(
      LANTERN_COLOR,
      LANTERN_INTENSITY,
      LANTERN_RANGE,
      LANTERN_DECAY,
    );

    light.position.copy(lamp);
    rig.add(light);
  });

  // Steady, where the town's bulbs twinkle. A string eight units from the lens
  // that changes brightness every frame is a distraction for the whole run,
  // and the town twinkling in the distance while the sleigh holds steady is
  // the right way round: the flicker is a thing you notice out there, not a
  // thing happening to the vehicle you are flying.
  return rig;
}
