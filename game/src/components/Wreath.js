import * as THREE from 'three';

// A wreath on the front door. The one decoration in the town that is built
// rather than found: everything else is either already in the asset or a
// sprite, and this is geometry from nothing.

// World units. A 9-unit wreath on a door measuring 14 by 23 is the right
// proportion -- big enough to read from the field, not so big it covers the
// glass.
const WREATH_RADIUS = 4.5;
const WREATH_TUBE = 1.2;
// 8 radial segments, not the 16 a torus defaults to. Every other surface in
// this town is flat-shaded low-poly -- the landscape, the mountains, the
// smoke -- and a smooth torus reads as imported from somewhere else.
const WREATH_RADIAL_SEGMENTS = 8;
const WREATH_TUBULAR_SEGMENTS = 24;
// Height up the door, in model units. The door spans -0.10 to 2.96 and the
// wreath is 0.77 model units tall with its berries, so this leaves a clear
// 1.8 world units between its top and the top of the door. 2.2, which the
// spec suggests, puts the top at 2.97 against a door ending at 2.96 -- level
// with the lintel, which reads as jammed into the frame rather than hung on
// the door.
const WREATH_HEIGHT = 1.95;

// The PINE green from tools/generate_river_landscape.mjs, so the wreath is
// the same green as the conifers it was notionally cut from.
const WREATH_COLOR = 0x2f6b3f;
// Berries. Emissive rather than lit, so they read at night the way the
// windows do -- this is the detail that makes it a Christmas wreath instead
// of a green ring. The base colour is nearly black because the emissive is
// doing all the work; a red base as well would wash out to orange.
const BERRY_COLOR = 0x240000;
const BERRY_EMISSIVE = 0xfd0000;
const BERRY_RADIUS = 0.8;
const BERRY_COUNT = 5;

// Built once and shared. Five doors, one wreath's worth of geometry.
let shared = null;

function build(scale) {
  const ring = new THREE.TorusGeometry(
    WREATH_RADIUS / scale,
    WREATH_TUBE / scale,
    WREATH_RADIAL_SEGMENTS,
    WREATH_TUBULAR_SEGMENTS,
  );

  const ringMaterial = new THREE.MeshStandardMaterial({
    color: WREATH_COLOR,
    roughness: 1,
    metalness: 0,
    flatShading: true,
  });

  // Low enough to be a berry and not a ball bearing. At 0.8 world units these
  // are under two screen pixels from across the field, so the subdivision is
  // there to stop them being visibly cubic on the doorstep and nothing more.
  const berry = new THREE.SphereGeometry(BERRY_RADIUS / scale, 6, 4);
  const berryMaterial = new THREE.MeshStandardMaterial({
    color: BERRY_COLOR,
    emissive: BERRY_EMISSIVE,
    roughness: 1,
    metalness: 0,
    flatShading: true,
  });

  return { ring, ringMaterial, berry, berryMaterial };
}

/**
 * One door's wreath, as a group to add to the plot.
 *
 * Positioned off the DOOR node rather than the house, which matters: the
 * House group's box reaches z 6.65 while the door's own plane is at 3.56,
 * because there is a porch or step in front of the building. Hanging this on
 * the box would leave it floating three model units clear of the house.
 *
 * No rotation. A TorusGeometry lies in the XY plane with its axis along Z, and
 * the door is a thin slab in Z -- 1.95 by 3.06 across and 0.30 deep -- so the
 * facade IS the XY plane and the torus already faces out of it. Checked rather
 * than assumed, because a wreath rotated into the wall is invisible and a
 * wreath rotated flat is a doormat.
 */
export function createWreath(door, scale) {
  if (!shared) shared = build(scale);

  const box = new THREE.Box3().setFromObject(door);
  const centre = box.getCenter(new THREE.Vector3());
  const wreath = new THREE.Group();
  const ring = new THREE.Mesh(shared.ring, shared.ringMaterial);

  wreath.name = 'Wreath';
  wreath.add(ring);

  const radius = WREATH_RADIUS / scale;

  for (let index = 0; index < BERRY_COUNT; index += 1) {
    const angle = (index / BERRY_COUNT) * Math.PI * 2;
    const berry = new THREE.Mesh(shared.berry, shared.berryMaterial);

    // On the ring's centre line, pushed forward onto the front of the tube so
    // they are not half-sunk in it.
    berry.position.set(
      Math.cos(angle) * radius,
      Math.sin(angle) * radius,
      (WREATH_TUBE * 0.6) / scale,
    );
    wreath.add(berry);
  }

  // Clear of the door by a little over the tube's radius. At exactly the tube
  // radius the back of the ring lands precisely on the door's plane, and a
  // surface tangent to another surface is the coplanar case the whole project
  // keeps running into -- GROUND_Z in Landscape.js and the road's
  // polygonOffset both exist for it. The extra 15% costs 0.2 world units of
  // standoff, which is invisible, and takes the question away.
  wreath.position.set(
    centre.x,
    WREATH_HEIGHT,
    box.max.z + (WREATH_TUBE * 1.15) / scale,
  );

  return wreath;
}
