import * as THREE from 'three';

const FLAKE_COUNT = 900;
// World units across, not pixels: sizeAttenuation is on, so a flake near the
// player comes out around 16 pixels and one at the band's edge around six.
const FLAKE_SIZE = 6;
const FLAKE_OPACITY = 0.85;

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
// So the band hugs the ground near the player instead, and follows him (see
// updateSnow). These numbers are a function of Camera.js: if the camera's
// height, pitch or field of view change, recompute them or the snow silently
// vanishes again.
const INNER_RADIUS = 120;
const OUTER_RADIUS = 900;
// Headroom directly above the player, a little under the camera's own height.
const CEILING_NEAR = 150;
// How fast the frame's top edge drops as the ground recedes: tan(3.6 degrees).
// A flake's ceiling is CEILING_NEAR minus this times its distance out, so the
// whole band stays under the edge instead of being cropped beyond a few
// hundred units.
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

/**
 * Builds the snowfall as a single THREE.Points.
 *
 * One draw call for the lot. The per-flake fall speed, sway phase and ceiling
 * ride along on the returned object rather than in module state, so the thing
 * that is drawn and the thing that is stepped cannot get out of sync.
 */
export function createSnow() {
  const positions = new Float32Array(FLAKE_COUNT * 3);
  const speeds = new Float32Array(FLAKE_COUNT);
  const phases = new Float32Array(FLAKE_COUNT);
  // Each flake remembers its own ceiling, because the ceiling depends on how
  // far out the flake is and recycling must put it back under the frame edge.
  const ceilings = new Float32Array(FLAKE_COUNT);

  for (let index = 0; index < FLAKE_COUNT; index += 1) {
    const angle = Math.random() * Math.PI * 2;
    // Square-rooted so the flakes spread evenly over the band's area. Picking
    // the radius straight from a uniform number would crowd them at the
    // inside edge, right where they are least wanted.
    const radius = Math.sqrt(
      INNER_RADIUS ** 2 + Math.random() * (OUTER_RADIUS ** 2 - INNER_RADIUS ** 2),
    );
    const ceiling = Math.max(CEILING_MIN, CEILING_NEAR - radius * CEILING_TAPER);
    const offset = index * 3;

    positions[offset] = Math.cos(angle) * radius;
    positions[offset + 1] = Math.sin(angle) * radius;
    // Z is up in this game. Seeded across the full height so the first frame
    // already shows a fall in progress rather than a curtain dropping in.
    positions[offset + 2] = Math.random() * ceiling;

    ceilings[index] = ceiling;
    speeds[index] = THREE.MathUtils.lerp(FALL_SPEED_MIN, FALL_SPEED_MAX, Math.random());
    phases[index] = Math.random() * Math.PI * 2;
  }

  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    map: createFlakeTexture(),
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
  snow.ceilings = ceilings;

  return snow;
}

/**
 * Advances the snowfall one frame and keeps it around the player.
 *
 * The band travels with Tode rather than sitting at the world origin: it is
 * only 900 units across, so anchored at the origin it would fall off one side
 * of the frame as soon as he hopped away. This is the same move the lighting
 * makes to keep its shadow box over him.
 *
 * Only x and y follow. Taking z as well would lift the whole band on every
 * hop and the snow would bob with him.
 *
 * Flakes that reach the ground go back to their own ceiling in the same
 * column -- the jump is well under a pixel out there, and respawning them at
 * a fresh angle would make the band shimmer.
 */
export function updateSnow(snow, player) {
  const position = snow.geometry.attributes.position;
  const coordinates = position.array;

  snow.position.set(player.position.x, player.position.y, 0);

  for (let index = 0; index < FLAKE_COUNT; index += 1) {
    const offset = index * 3;

    coordinates[offset + 2] -= snow.speeds[index];

    snow.phases[index] += DRIFT_RATE;
    coordinates[offset] += Math.sin(snow.phases[index]) * DRIFT;
    coordinates[offset + 1] += Math.cos(snow.phases[index] * 0.7) * DRIFT * 0.5;

    if (coordinates[offset + 2] < 0) {
      coordinates[offset + 2] = snow.ceilings[index];
    }
  }

  position.needsUpdate = true;
}
