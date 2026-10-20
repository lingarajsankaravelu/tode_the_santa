import * as THREE from 'three';

// Chimney smoke, animated.
//
// The asset ships the plume as 19 separate cube meshes arranged in a static
// puff: 104 triangles each, unrotated nodes hanging directly off the `Smoke`
// group, each cube's geometry centred on its own origin and each node carrying
// its own non-uniform scale between 0.248 and 1.035. That structure is what
// makes this cheap -- a puff can be moved and grown by writing its node's
// position and scale, with no geometry work at all.
//
// The artist's arrangement is a plume shape already: narrow at the chimney,
// widest in the middle, thinning to wisps at the top, over 19 world units. So
// rather than inventing a particle system, each cube keeps its place in that
// profile as a PHASE -- its height in the original plume, normalised -- and
// then cycles upward through a taller version of the same shape. The silhouette
// stays the artist's; only the motion is new.

// World units the plume climbs above the chimney mouth. The house is 55 tall,
// so this is one house-height of smoke above the roof -- enough to read as a
// plume from across the field without turning into a column of cloud.
const PLUME_RISE = 55;
// Horizontal lean over the full rise: about 10 degrees off vertical. Smoke
// going straight up reads as a special effect; a slight lean reads as weather,
// and it is the same wind that makes the snow drift in Snow.js. The direction
// is the model's +X for every house, so the whole village leans one way.
const PLUME_LEAN = 10;
// Per frame, matching Snow.js and Movement.js, so the whole scene speeds up
// and slows down together. At 60 fps a puff takes about five seconds to go
// from the chimney to the top of its rise.
const PLUME_RATE = 0.0033;
// Five chimneys on one timer would puff in lockstep. An offset per house, by
// an amount that does not divide into one, keeps them independent.
const HOUSE_PHASE_STEP = 0.37;

// A puff expands as it rises and dissipates, which is the whole visual
// difference between smoke and a floating box. Multiplied into each cube's own
// baked scale, so the variety the artist built stays.
const PUFF_SCALE_START = 0.35;
const PUFF_SCALE_END = 1.8;
// Turns a cube makes over its rise. Small on purpose: a low-poly cube rotating
// slowly reads as smoke curling, and rotating fast reads as a dice throw.
const PUFF_SPIN = 0.35;

// Opacity, as a fraction of the material's own. It holds near full at the
// chimney and falls away to nothing by the top, which is what dissipating
// means -- and it is also what hides the recycle, since a puff is invisible at
// the moment it is moved back down to the mouth.
const FADE_POWER = 1.3;
// A ramp at the bottom of the rise, and it has to be long enough rather than
// merely present. It does two jobs: real chimney smoke is thin at the mouth
// and thickens just above it, and -- the reason for this exact number -- it is
// what hides the recycle. A puff is teleported 55 units down the instant its
// cycle wraps, so the frame it reappears on must be imperceptible. At 0.06 it
// came back at an alpha of 0.021, which is 5.3 of 255 levels and borderline
// visible; at 0.12 it is 0.010, or 2.6 levels, which is below one step.
// Measured, not guessed: the puff's first frame is at t = PLUME_RATE.
const FADE_IN = 0.12;

const plumes = [];
let clock = 0;

/**
 * Prepares one house's plume and registers it.
 *
 * Each puff gets its own clone of the material, which is the one thing here
 * that costs something. The asset gives all 19 cubes a single shared
 * `lambert23`, and a shared material cannot carry a per-puff opacity -- so
 * without cloning, the whole plume would have to fade as one, which is a
 * pulsing cloud rather than smoke.
 *
 * Cloning per house rather than per puff-index is deliberate too: it is what
 * lets the five chimneys run out of step. Sharing the materials across houses
 * would tie every chimney's fade together while their positions differed,
 * which looks worse than either being synchronised or being independent.
 *
 * It costs no draw calls. The 19 cubes are already 19 separate meshes, so they
 * were always 19 calls per house whatever material they shared.
 */
export function createSmokePlume(smoke, scale) {
  const puffs = [];
  let lowest = Infinity;
  let highest = -Infinity;

  smoke.children.forEach((node) => {
    const mesh = node.children.find((child) => child.isMesh);

    if (!mesh) return;

    mesh.material = mesh.material.clone();
    // Depth WRITING off, depth TESTING left on. The cubes interpenetrate and
    // three.js sorts transparent objects back to front as whole objects, which
    // has no correct answer for objects that pass through each other: with
    // depth writing on, whichever drew first rejects the parts of the others
    // behind it, and which one that is flips as the camera swings, so the puff
    // visibly reshuffles while Tode hops. Off, the house still occludes the
    // smoke and the alpha simply accumulates through it, which is what smoke
    // does anyway.
    mesh.material.depthWrite = false;

    lowest = Math.min(lowest, node.position.y);
    highest = Math.max(highest, node.position.y);

    puffs.push({
      node,
      material: mesh.material,
      base: node.position.clone(),
      baseScale: node.scale.clone(),
      peakOpacity: mesh.material.opacity,
      // Filled in below, once the plume's extent is known.
      phase: 0,
      // Alternating, so neighbouring puffs do not turn as a block.
      spin: puffs.length % 2 === 0 ? 1 : -1,
    });
  });

  if (puffs.length === 0) return;

  const span = highest - lowest;

  puffs.forEach((puff) => {
    // The puff's own height in the plume the artist built, normalised. This is
    // what makes the first frame look like the original arrangement rather
    // than like 19 cubes at the chimney.
    puff.phase = span > 0 ? (puff.base.y - lowest) / span : 0;
  });

  plumes.push({
    puffs,
    mouth: lowest,
    // The constants above are world units and everything here is in the
    // model's, because the plume is built inside the plot group and the plot
    // carries the scale.
    rise: PLUME_RISE / scale,
    lean: PLUME_LEAN / scale,
    offset: plumes.length * HOUSE_PHASE_STEP,
  });
}

/**
 * Advances every chimney in the town one frame.
 *
 * Takes no arguments, like updateChristmasLights: the plumes register
 * themselves as the houses load, and there is nothing per-call to decide.
 *
 * 19 puffs across 5 houses is 95 nodes, each getting a position, a scale, a
 * rotation and an opacity -- the same order of work as one frame of the 900
 * snowflakes.
 */
export function updateSmoke() {
  clock += PLUME_RATE;

  plumes.forEach((plume) => {
    plume.puffs.forEach((puff) => {
      // Cycles in [0, 1): 0 at the chimney mouth, 1 at the top of the rise.
      const t = (puff.phase + plume.offset + clock) % 1;
      const grow = PUFF_SCALE_START + (PUFF_SCALE_END - PUFF_SCALE_START) * t;

      puff.node.position.set(
        puff.base.x + plume.lean * t,
        plume.mouth + plume.rise * t,
        puff.base.z,
      );
      puff.node.scale.set(
        puff.baseScale.x * grow,
        puff.baseScale.y * grow,
        puff.baseScale.z * grow,
      );
      puff.node.rotation.y = puff.spin * PUFF_SPIN * t * Math.PI * 2;
      puff.material.opacity = puff.peakOpacity
        * Math.min(1, t / FADE_IN)
        * (1 - t) ** FADE_POWER;
    });
  });
}
