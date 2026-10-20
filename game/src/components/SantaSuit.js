import * as THREE from 'three';

// A STOPGAP. Dresses the existing tode.glb as Santa out of three.js
// primitives -- a cone, two rings and two squashed spheres -- because the
// real answer is a rebuilt, rigged model and that is a Blender job. See
// `hackathon/skeleton/tode_the_santa/appearance/spec.md`, which this file
// stands in for rather than implements: nothing here deforms, nothing here
// animates, and these are smooth shapes sitting on a faceted model. It puts
// a Santa on screen today. Delete the whole file when the asset lands.
//
// Everything is built in the MODEL'S OWN local space, which is why Player.js
// calls this before it scales and tips the model: at that point the model's
// transform is still identity, so its bounding box is in the units the glTF
// was authored in. The suit is then a child, so it inherits the scale, the
// quarter turn, and every yaw the movement code applies -- the hat turns when
// Tode turns, for free.
//
// Local axes are glTF's, not the game's: +Y is up, and on THIS model the face
// is on **+Z**, which was measured rather than assumed (see below).

const COLORS = {
  red: 0xe3272f,
  white: 0xffffff,
  // Not pure black: under this scene's night rig 0x000000 reads as a hole cut
  // in the frog rather than as cloth.
  black: 0x151515,
  gold: 0xf2c14e,
};

// Measured off the model's 8,262 vertices, sliced into twentieths of its
// height. `front` is the furthest +Z any vertex in that band reaches, which
// is the surface the costume has to sit on, and `halfWidth` is how far out it
// goes. Heights are fractions of the model's own height, 0 at the feet.
//
//   band        local Y    front     halfWidth   what it is
//   0.00-0.10   -0.30       +0.378     0.501     feet, splayed and deep
//   0.10-0.45   -0.24..-0.04 +0.17..+0.24 0.363   body
//   0.45-0.65   -0.01..+0.09 +0.18..+0.225 0.31..0.34  head band and mouth
//   0.65-1.00   +0.11..+0.32 +0.19      0.27     the two eye blocks
//
// The mouth sits at 0.50-0.56 of the height, which is what puts the beard
// just under it at 0.50 and the belly clear of it at 0.28.
const AT = {
  bellyHeight: 0.28,
  bellyZ: 0.08,
  beltHeight: 0.2,
  beltZ: 0.04,
  beardHeight: 0.44,
  beardZ: 0.19,
  buckleZ: 0.3,
};

// Sizes, as fractions of the model's measured width or height so the suit
// still fits if the model is re-exported at another scale.
const FIT = {
  // The head is only 0.54 wide -- the model's full 1.0 width is the splayed
  // feet, not the head -- so the hat is sized against the head, not the box.
  hatRadius: 0.26, // of width; the crown is 0.27 half-wide, so the brim just covers it
  // Tall against the model, but the cone is 0.52 across, and anything under
  // about this reads as a red disc rather than a hat once the game's camera
  // looks down on it at 26 degrees.
  hatHeight: 0.62, // of height
  brimTube: 0.035,
  pompom: 0.06,
  bellyRadius: 0.28, // of width; narrower than the body's 0.363 so it bulges forward, not sideways
  beltRadius: 0.26, // narrower than the belly above it, so the belly overhangs
  beltTube: 0.03,
  beardRadius: 0.11,
};

// The model is far deeper than it is round, so every ring and ball is
// flattened or it reads as a hula hoop rather than a belt.
//
// Watch the axis on the two rings. A local matrix is T * R * S, so the scale
// lands BEFORE the quarter turn that lays a torus flat -- which means the
// axis to squeeze a ring's depth on is its own **Y**, not its Z. Squeezing Z
// only thins the tube, and the ring stays a full circle.
const SQUASH = {
  belly: new THREE.Vector3(1, 0.38, 0.8),
  belt: new THREE.Vector3(1, 0.8, 1),
  brim: new THREE.Vector3(1, 0.9, 1),
  beard: new THREE.Vector3(1.5, 0.6, 0.5),
};

// Low-poly on purpose: at 32 screen pixels nothing here resolves, and it is
// dressing 10,740 triangles of baked frog.
const SEGMENTS = { radial: 20, ring: 10 };

function material(color) {
  // Standard, not Basic, for the reason SnowRoads.js landed on the same
  // choice: the scene has a night lighting rig, and an unlit red would render
  // as a patch of daylight stuck to a lit frog.
  return new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0 });
}

export function createSantaSuit(model) {
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const centre = box.getCenter(new THREE.Vector3());

  const suit = new THREE.Group();

  // Placed against the measured box rather than against zero, because the
  // model's origin is not under its middle.
  const atHeight = (fraction) => box.min.y + size.y * fraction;

  const add = (mesh, fraction, z, squash) => {
    mesh.position.set(centre.x, atHeight(fraction), z);
    if (squash) mesh.scale.copy(squash);
    suit.add(mesh);
    return mesh;
  };

  const hatRadius = size.x * FIT.hatRadius;
  const hatHeight = size.y * FIT.hatHeight;

  // Its own group, so the whole hat leans as one piece.
  const hat = new THREE.Group();

  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(hatRadius, hatHeight, SEGMENTS.radial),
    material(COLORS.red),
  );
  // A cone is centred on its own height, so half of it lifts the base to the
  // crown; the small subtraction sinks the base in rather than balancing it.
  cone.position.y = hatHeight / 2 - size.y * 0.04;
  hat.add(cone);

  const brim = new THREE.Mesh(
    new THREE.TorusGeometry(hatRadius, size.x * FIT.brimTube, SEGMENTS.ring, SEGMENTS.radial),
    material(COLORS.white),
  );
  // A torus lies in its own XY plane, so every ring here is tipped a quarter
  // turn to lie flat around the up axis.
  brim.rotation.x = Math.PI / 2;
  brim.scale.copy(SQUASH.brim);

  const pompom = new THREE.Mesh(
    new THREE.SphereGeometry(size.x * FIT.pompom, SEGMENTS.radial, SEGMENTS.ring),
    material(COLORS.white),
  );
  pompom.position.y = hatHeight - size.y * 0.04;
  hat.add(pompom);

  hat.position.set(centre.x, box.max.y, centre.z);
  // Leaned rather than upright, which is most of what makes it read as a hat
  // and not a traffic cone.
  hat.rotation.z = -0.14;
  suit.add(hat);

  // The brim is added to the suit rather than to the hat, so it stays level
  // while the cone above it leans. Leaning with it put the band across one
  // eye and left a wedge of bare head showing under the other.
  brim.position.set(centre.x, box.max.y - size.y * 0.02, centre.z);
  suit.add(brim);

  // The belly. Squashed hard vertically: the body is only 0.22 deep in height
  // and a round ball there would swallow the mouth above it.
  add(
    new THREE.Mesh(
      new THREE.SphereGeometry(size.x * FIT.bellyRadius, SEGMENTS.radial, SEGMENTS.ring),
      material(COLORS.red),
    ),
    AT.bellyHeight,
    AT.bellyZ,
    SQUASH.belly,
  );

  // Belt, below the belly's widest point so the belly overhangs it. The spec
  // is firm about this and it is the difference between Santa and a frog in a
  // red shirt.
  const belt = add(
    new THREE.Mesh(
      new THREE.TorusGeometry(
        size.x * FIT.beltRadius,
        size.x * FIT.beltTube,
        SEGMENTS.ring,
        SEGMENTS.radial,
      ),
      material(COLORS.black),
    ),
    AT.beltHeight,
    AT.beltZ,
  );
  belt.rotation.x = Math.PI / 2;
  belt.scale.copy(SQUASH.belt);

  add(
    new THREE.Mesh(
      new THREE.BoxGeometry(size.x * 0.1, size.y * 0.1, size.x * 0.04),
      material(COLORS.gold),
    ),
    AT.beltHeight,
    AT.buckleZ,
  );

  // Beard, on the +Z face, just under the mouth.
  add(
    new THREE.Mesh(
      new THREE.SphereGeometry(size.x * FIT.beardRadius, SEGMENTS.radial, SEGMENTS.ring),
      material(COLORS.white),
    ),
    AT.beardHeight,
    AT.beardZ,
    SQUASH.beard,
  );

  return suit;
}
