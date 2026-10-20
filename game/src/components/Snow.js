import * as THREE from 'three';

const FLAKE_COUNT = 900;
// World units across, not pixels: sizeAttenuation is on, so a flake near the
// player comes out around 16 pixels and one at the band's edge around six.
const FLAKE_SIZE = 6;
// Dimmed by hand, because this is the one surface in the game the lights
// cannot reach: PointsMaterial is unlit. Everything else darkened when the
// scene moved to night; left alone, 900 white flakes at 0.85 against a
// near-black sky stay the brightest thing in the frame after the windows and
// read as television static rather than as weather.
const FLAKE_OPACITY = 0.55;
// So the flakes take the moonlight like everything else does. Multiplied into
// the gradient in createFlakeTexture below, which stays white.
const FLAKE_COLOR = 0xaebfd6;

// The band is sized to the camera's frustum, which is the only thing that
// decides whether the snow is visible at all.
//
// Camera.js sits 180 above Tode and pitches 26 degrees down with a 45 degree
// field of view, which puts the TOP edge of the view 3.6 degrees BELOW
// horizontal. That edge therefore starts at the camera's own height and only
// descends: nothing above 180 world units is ever on screen, at any distance.
// A band out at the mountains with a ceiling over their peaks -- the obvious
// way to build this -- is consequently invisible, because all of it sits in
// the wedge above the frame.
//
// So the field hugs the ground around the player instead (see updateSnow).
// These numbers are a function of Camera.js: if the camera's height, pitch or
// field of view change, recompute them or the snow silently vanishes again.
//
// A square, not a ring, because the field wraps: a flake that falls more than
// FIELD_HALF behind the player is teleported the full span forward, which is
// only seamless on a shape that tiles.
const FIELD_HALF = 900;
// Headroom directly above the player, a little under the camera's own height.
const CEILING_NEAR = 150;
// How fast the frame's top edge drops as the ground recedes: tan(3.6 degrees).
// A flake's ceiling is CEILING_NEAR minus this times its distance out, so the
// whole field stays under the edge instead of being cropped beyond a few
// hundred units. Worst case is a corner of the square at 1273 out, where the
// ceiling works out at 70 against a frame edge of 77.
const CEILING_TAPER = 0.063;
const CEILING_MIN = 55;

// Per frame, matching how the rest of the game steps -- Movement.js advances
// a hop by a per-frame fraction too, so the whole scene speeds up or slows
// down together rather than the weather drifting out of step with it.
//
// Slow on purpose. Over a fall of about 150 units this is six to seventeen
// seconds from ceiling to ground, which lets the sway below actually read as
// drift rather than as a twitch on the way past.
const FALL_SPEED_MIN = 0.15;
const FALL_SPEED_MAX = 0.45;
// Sideways sway. Driven by sin/cos of a per-flake phase, so it oscillates
// around where the flake started instead of accumulating -- otherwise the
// whole band would slide off one way over a long run.
const DRIFT = 0.45;
const DRIFT_RATE = 0.02;

/**
 * A soft round flake, as a 32px radial gradient.
 *
 * PointsMaterial draws a hard square without a map, which at this size reads
 * as grit rather than snow. A gradient in a canvas costs nothing and keeps
 * this component asset-free, the same trade Sky.js makes for the backdrop.
 */
function createFlakeTexture() {
  const size = 32;
  const canvas = document.createElement('canvas');

  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2,
  );

  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(0.45, 'rgba(255, 255, 255, 0.65)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);

  texture.colorSpace = THREE.SRGBColorSpace;

  return texture;
}

/** How high a flake at this distance from the player may be and stay in shot. */
function ceilingAt(distance) {
  return Math.max(CEILING_MIN, CEILING_NEAR - distance * CEILING_TAPER);
}

/**
 * Builds the snowfall as a single THREE.Points.
 *
 * One draw call for the lot. The per-flake fall speed and sway phase ride
 * along on the returned object rather than in module state, so the thing that
 * is drawn and the thing that is stepped cannot get out of sync.
 */
export function createSnow() {
  const positions = new Float32Array(FLAKE_COUNT * 3);
  const speeds = new Float32Array(FLAKE_COUNT);
  const phases = new Float32Array(FLAKE_COUNT);

  for (let index = 0; index < FLAKE_COUNT; index += 1) {
    // Spread evenly over the square, which is where Tode starts.
    const x = THREE.MathUtils.randFloatSpread(FIELD_HALF * 2);
    const y = THREE.MathUtils.randFloatSpread(FIELD_HALF * 2);
    const offset = index * 3;

    positions[offset] = x;
    positions[offset + 1] = y;
    // Z is up in this game. Seeded across the flake's own headroom so the
    // first frame already shows a fall in progress rather than a curtain
    // dropping in.
    positions[offset + 2] = Math.random() * ceilingAt(Math.hypot(x, y));

    speeds[index] = THREE.MathUtils.lerp(FALL_SPEED_MIN, FALL_SPEED_MAX, Math.random());
    phases[index] = Math.random() * Math.PI * 2;
  }

  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    map: createFlakeTexture(),
    color: FLAKE_COLOR,
    size: FLAKE_SIZE,
    sizeAttenuation: true,
    transparent: true,
    opacity: FLAKE_OPACITY,
    // Flakes overlap each other and the terrain constantly; writing depth
    // would let whichever drew first punch a hole in the ones behind it.
    depthWrite: false,
  });

  const snow = new THREE.Points(geometry, material);

  // The band surrounds the camera, so its bounding sphere is always on screen
  // and the cull test is wasted work that occasionally gets it wrong.
  snow.frustumCulled = false;

  snow.speeds = speeds;
  snow.phases = phases;

  return snow;
}

/**
 * Advances the snowfall one frame and keeps the field around the player.
 *
 * Every flake holds a world position and keeps it. The field follows Tode by
 * *wrapping* -- a flake that ends up more than FIELD_HALF away on an axis is
 * moved the full span to the other side -- rather than by translating the
 * whole object to his position.
 *
 * The difference is the whole point. Moving the object rigidly keeps every
 * flake at a fixed offset from the camera, which is also parented to him, so
 * the snow sits dead still on screen while the world slides underneath and
 * reads as glued to the lens. Wrapping leaves the flakes standing in the
 * world, so Tode hops through them and they stream past him.
 *
 * Flakes that reach the ground go back up in the same column -- the jump is
 * well under a pixel out there, and respawning them somewhere else would make
 * the field shimmer.
 */
export function updateSnow(snow, player) {
  const position = snow.geometry.attributes.position;
  const coordinates = position.array;
  const { x: playerX, y: playerY } = player.position;
  const span = FIELD_HALF * 2;

  for (let index = 0; index < FLAKE_COUNT; index += 1) {
    const offset = index * 3;

    coordinates[offset + 2] -= snow.speeds[index];

    snow.phases[index] += DRIFT_RATE;
    coordinates[offset] += Math.sin(snow.phases[index]) * DRIFT;
    coordinates[offset + 1] += Math.cos(snow.phases[index] * 0.7) * DRIFT * 0.5;

    const fromPlayerX = coordinates[offset] - playerX;
    const fromPlayerY = coordinates[offset + 1] - playerY;

    if (fromPlayerX > FIELD_HALF) coordinates[offset] -= span;
    else if (fromPlayerX < -FIELD_HALF) coordinates[offset] += span;

    if (fromPlayerY > FIELD_HALF) coordinates[offset + 1] -= span;
    else if (fromPlayerY < -FIELD_HALF) coordinates[offset + 1] += span;

    if (coordinates[offset + 2] < 0) {
      // Measured now, not at build time: the flake has moved, and so has he.
      coordinates[offset + 2] = ceilingAt(
        Math.hypot(coordinates[offset] - playerX, coordinates[offset + 1] - playerY),
      );
    }
  }

  position.needsUpdate = true;
}
