import * as THREE from 'three';

// Fairy lights through the conifers in every yard.
//
// The colours are not chosen. winter_country_house.glb already carries twelve
// small bulbs on the house itself, on four emissive materials, and a string in
// four other colours would read as two unrelated decorations on one plot.
// These are those same four, converted from their linear emissiveFactor to the
// sRGB hex that produces it:
//
//   RedLight     [0.9815, 0, 0]           -> 0xfd0000
//   BlueLight    [0.0410, 0, 1]           -> 0x3900ff
//   YellowLight  [0.8413, 0.8413, 0]      -> 0xecec00
//   GreenLight   [0, 0.6267, 0]           -> 0x00cf00
//
// Cycled in a fixed order across the whole plot rather than restarting per
// tree, so the pattern carries from one tree to the next the way one long wire
// would. A real string alternates; random colours along it read as confetti.
const COLORS = [0xfd0000, 0x3900ff, 0xecec00, 0x00cf00];

// All of these are world units, converted to the model's own units on the way
// in -- the string is built in model space so the plot's transform can place
// it (see createChristmasLights).
//
// Below this a cluster is not a tree. It removes the six `Shishki` pinecone
// clusters in the group and nothing else: the tallest pinecone cluster is 6
// world units and the shortest real tree is 35, so the threshold sits in a
// wide gap rather than on a boundary.
const MIN_TREE_HEIGHT = 30;
// How far apart two meshes' footprints can be and still be the same tree. The
// closest two trees in the stand are 17 units apart and the parts of one tree
// are within about 2, so anything from 3 to 15 works.
const CLUSTER_SPAN = 7;
// A part is canopy if its girth is at least this much of the whole tree's.
// What it excludes is the trunk, which is a tenth of the width.
const CANOPY_GIRTH_FRACTION = 0.5;

// Along the wire. About 24 inches at this project's scale of 2.7 inches per
// unit, which is a real string's spacing, and it holds the bulbs 8 screen
// pixels apart at the furthest the town is ever seen from.
const BULB_SPACING = 9;
// Turns are per unit of canopy, NOT a fixed count: 1.6 turns on the shortest
// tree and 4.5 on the tallest, so every tree is laced at the same pitch
// instead of the short ones looking strangled and the tall ones barely
// touched.
const HEIGHT_PER_TURN = 12;
const MIN_TURNS = 1.5;
// Fraction of the canopy climbed. Stopping short of the tip is deliberate:
// five of the 22 trees carry snow caps over the upper half of their canopy, so
// the last bulbs on those would be behind snow. A bulb under snow being hidden
// is correct, and the alternative -- a bigger outset -- floats the whole
// string off every tree in the yard to rescue five bulbs.
const WRAP_TOP = 0.88;
// Pushes the helix just outside the needles. At zero the bulbs sit exactly on
// the cone and half of each sprite is swallowed by the branch it lies against.
const BULB_OUTSET = 1.5;
const MIN_BULBS = 5;

// The string along the front eaves, which is the decoration people actually
// notice on a real house.
//
// An earlier note in visual/christmas_lights said this meant picking an edge
// out of an 80,238-triangle mesh, and that was wrong. `Snow1` -- the roof
// snow, already kept by House.js -- is one mesh of 5,866 vertices, and its
// front edge is flat: the 45 vertices within a whisker of its maximum z all
// sit level, spanning 100 world units at a height of 24. So the eave is a
// single horizontal segment, and the string is a line.
const EAVE_SPACING = 9;
// How close to the front edge a vertex has to be to count as on it. The
// measured edge vertices are within 0.59 world units of the maximum.
const EAVE_EDGE_BAND = 0.6;
// Mid-span droop. Without it this is a ruler-straight row of dots, which is
// the single thing most likely to make it read as programmer art. A sine is
// indistinguishable from a catenary over 100 units and needs nothing solved.
const EAVE_SAG = 3;
// Hangs the string below the eave rather than on it, so the bulbs are not
// half-buried in roof snow.
const EAVE_DROP = 2;
// And forward of it, for the same reason BULB_OUTSET exists.
const EAVE_OUT = 1.5;

// The star on the tallest tree in the yard, which is what makes a plot read as
// decorated rather than merely lit.
//
// It cannot share the bulbs' material, and that is not a shortcut: a
// PointsMaterial carries ONE size for every point it draws, and per-point
// sizing needs a custom shader. visual/house_decorations says to put the star
// "in the same geometry as the string" and also to make it 16 units against
// the bulbs' 7, and those two instructions cannot both hold. The size is the
// one that matters, so the star is its own one-point Points -- still built
// once and shared by all five plots, so it costs one draw call per plot.
const STAR_SIZE = 16;
// Above the tip, so it sits on the tree rather than in it.
const STAR_LIFT = 3;
// Warm white. Deliberately not one of the four COLORS: a star that is the
// same red or green as the string is not a star, it is a bulb that got lost.
const STAR_COLOR = 0xfff4d0;

// World units, and this is the one constant here that does NOT ride the plot's
// scale. gl_PointSize is computed from the material's size and the view
// distance alone, so an object's scale does not reach it -- everything else in
// this file is in model units and gets multiplied by 7.4 on the way to the
// screen, and this does not.
//
// 7 gives 6.6 screen pixels with Tode on the doorstep and 3.1 from across the
// field, on a 900 pixel viewport. three.js computes
// `size * pixelRatio * (height * 0.5) / distance` and the pixel ratio cancels
// against the canvas being scaled back down, so on-screen CSS pixels are
// `0.5 * size * cssHeight / distance`. Note that this is NOT the
// geometrically correct size -- three.js leaves the field of view out of it
// entirely, which at this project's 45 degrees makes a point 2.41x smaller
// than the arithmetic in Snow.js assumes.
const BULB_SIZE = 7;

// Between 60% and 100% brightness, so a bulb never goes out. A string with
// bulbs going fully dark reads as faulty rather than as festive.
const TWINKLE_FLOOR = 0.6;
// Per frame, matching Snow.js and Movement.js, so the whole scene speeds up
// and slows down together rather than the decoration drifting out of step
// with the game. At 60 fps this is a period of about 3.5 seconds.
const TWINKLE_RATE = 0.03;
// Roughly the golden angle in radians. Spacing the phases by it means
// neighbouring bulbs are never in step and the pattern does not repeat down
// the string, without the look differing on every reload the way random
// phases would.
const PHASE_STEP = 2.399;

// The five plots are identical in model space -- House.js clones one loaded
// scene and only the plot's own transform differs -- so the string's vertices
// are the same numbers five times over. One geometry and one material serve
// all five, which means the twinkle is one update per frame for the whole town
// instead of five.
//
// This is the one place in the project where shared state lives in the module
// rather than on the returned object. Snow.js deliberately hangs its per-flake
// speeds and phases off the Points it returns, so that the thing drawn and the
// thing stepped cannot get out of sync. Here there is one buffer and five
// things drawing it, so hanging it off any one of them would be the misleading
// arrangement.
let shared = null;
let twinkle = 0;

/**
 * A bulb, as a 32px radial gradient with a hot core.
 *
 * Deliberately not Snow.js's flake texture, which is soft all the way
 * through. A bulb has a bright centre and a tight falloff, and the difference
 * is what licenses a 7-unit sprite for a physically 2-inch lamp: the sprite is
 * the glow, and only the core is the bulb.
 */
function createBulbTexture() {
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
 * A four-point glint, as a 32px sprite.
 *
 * A cross of two tapered bars over a hot core. At the 7 to 15 pixels this is
 * ever drawn at, that is indistinguishable from a modelled star and costs a
 * canvas instead of geometry.
 */
function createStarTexture() {
  const size = 32;
  const canvas = document.createElement('canvas');

  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext('2d');
  const middle = size / 2;
  const core = context.createRadialGradient(middle, middle, 0, middle, middle, middle * 0.55);

  core.addColorStop(0, 'rgba(255, 255, 255, 1)');
  core.addColorStop(0.4, 'rgba(255, 255, 255, 0.75)');
  core.addColorStop(1, 'rgba(255, 255, 255, 0)');

  context.fillStyle = core;
  context.fillRect(0, 0, size, size);

  // The two spikes. Drawn as thin bars with a gradient that fades at both
  // ends, which is what gives the star its points.
  const across = context.createLinearGradient(0, 0, size, 0);

  across.addColorStop(0, 'rgba(255, 255, 255, 0)');
  across.addColorStop(0.5, 'rgba(255, 255, 255, 0.85)');
  across.addColorStop(1, 'rgba(255, 255, 255, 0)');

  context.fillStyle = across;
  context.fillRect(0, middle - 1.5, size, 3);

  const down = context.createLinearGradient(0, 0, 0, size);

  down.addColorStop(0, 'rgba(255, 255, 255, 0)');
  down.addColorStop(0.5, 'rgba(255, 255, 255, 0.85)');
  down.addColorStop(1, 'rgba(255, 255, 255, 0)');

  context.fillStyle = down;
  context.fillRect(middle - 1.5, 0, 3, size);

  const texture = new THREE.CanvasTexture(canvas);

  texture.colorSpace = THREE.SRGBColorSpace;

  return texture;
}

/**
 * Recovers the individual trees from the `Trees1` group.
 *
 * The group's own child list is not one node per tree, and this is the whole
 * difficulty of the task. Three of its children are clusters of eight meshes
 * covering several trees each, and conversely a single tree is often three or
 * nine separate meshes -- a trunk, and two or three canopy tiers with
 * unrelated names. So the trees are recovered by clustering every descendant
 * mesh's footprint, which is the one thing that actually distinguishes them.
 *
 * Returns the canopy box and axis per tree, not the tree box: between 20% and
 * 41% of every tree here is bare trunk, and a helix starting at the tree's
 * base would hang its first turns on thin air below the lowest branches.
 *
 * Measured, not pasted. The stand is 22 trees at four different heights with
 * no grid to it, and a hand-typed table of 22 rows would be checked once and
 * then be wrong the first time anyone touched the model.
 */
function findTrees(trees, scale) {
  const minHeight = MIN_TREE_HEIGHT / scale;
  const span = CLUSTER_SPAN / scale;
  const clusters = [];

  trees.traverse((child) => {
    if (!child.isMesh) return;

    const box = new THREE.Box3().setFromObject(child);
    const centre = box.getCenter(new THREE.Vector3());
    // Y is up here. The string is built before House.js applies the Z-up
    // quarter turn to the plot, so this is still the model's own orientation.
    let cluster = clusters.find(
      (candidate) => Math.hypot(candidate.centre.x - centre.x, candidate.centre.z - centre.z) < span,
    );

    if (!cluster) {
      cluster = { box: new THREE.Box3(), parts: [], centre };
      clusters.push(cluster);
    }

    cluster.box.union(box);
    cluster.parts.push(box);
    cluster.box.getCenter(cluster.centre);
  });

  const size = new THREE.Vector3();
  const partSize = new THREE.Vector3();

  return clusters
    .filter((cluster) => cluster.box.getSize(size).y >= minHeight)
    .map((cluster) => {
      const girth = Math.max(cluster.box.getSize(size).x, size.z);
      const canopy = new THREE.Box3();

      cluster.parts.forEach((part) => {
        part.getSize(partSize);

        if (Math.max(partSize.x, partSize.z) >= girth * CANOPY_GIRTH_FRACTION) canopy.union(part);
      });

      return { canopy, centre: canopy.getCenter(new THREE.Vector3()) };
    });
}

/**
 * Bulb positions for one tree: a helix up the canopy, sampled at even arc
 * length.
 *
 * By arc length and not by the height parameter, which is the easy mistake
 * here. A cone's helix is far longer per unit of height at the bottom than at
 * the top, so stepping the parameter evenly bunches every bulb around the tip
 * and leaves the broad base of the tree bare.
 */
function stringFor(tree, scale) {
  const size = tree.canopy.getSize(new THREE.Vector3());
  const radius = Math.max(size.x, size.z) / 2;
  const height = size.y;
  const turns = Math.max(MIN_TURNS, (height * scale) / HEIGHT_PER_TURN);
  const outset = BULB_OUTSET / scale;
  const samples = 400;
  const path = [];

  for (let index = 0; index <= samples; index += 1) {
    const u = (index / samples) * WRAP_TOP;
    const angle = u * turns * Math.PI * 2;
    const r = radius * (1 - u) + outset;

    path.push(new THREE.Vector3(
      tree.centre.x + Math.cos(angle) * r,
      tree.canopy.min.y + u * height,
      tree.centre.z + Math.sin(angle) * r,
    ));
  }

  const lengths = [0];

  for (let index = 1; index < path.length; index += 1) {
    lengths.push(lengths[index - 1] + path[index].distanceTo(path[index - 1]));
  }

  const total = lengths[lengths.length - 1];
  const count = Math.max(MIN_BULBS, Math.round((total * scale) / BULB_SPACING));
  const bulbs = [];
  let segment = 0;

  for (let index = 0; index < count; index += 1) {
    const target = (index / (count - 1)) * total;

    while (segment < lengths.length - 2 && lengths[segment + 1] < target) segment += 1;

    const run = lengths[segment + 1] - lengths[segment];
    const t = run > 0 ? (target - lengths[segment]) / run : 0;

    bulbs.push(path[segment].clone().lerp(path[segment + 1], Math.min(1, t)));
  }

  return bulbs;
}

/**
 * Bulb positions along the front eave of the roof.
 *
 * Derived from the geometry rather than from the measured numbers above, the
 * same choice the trees get: take the vertices within a band of the mesh's
 * maximum z, and use their x range and mean height. If the asset changes, this
 * follows it.
 *
 * Takes the roof in plot-local space, so `matrixWorld` is the plot-local
 * transform -- House.js calls this while the plot's own matrix is still
 * identity.
 *
 * The named node is a wrapper, not the mesh. Almost every named thing in this
 * diorama is: `Snow1` holds one child that carries the geometry, the way each
 * of the smoke's `pCube` nodes does. So the mesh is searched for rather than
 * assumed, which costs nothing and is the difference between this working and
 * reading `geometry` off an Object3D.
 */
function eaveString(roof, scale) {
  let mesh = null;

  roof.traverse((child) => {
    if (!mesh && child.isMesh) mesh = child;
  });

  if (!mesh) return [];

  const attribute = mesh.geometry.attributes.position;
  const box = new THREE.Box3().setFromObject(mesh);
  const band = EAVE_EDGE_BAND / scale;
  const vertex = new THREE.Vector3();
  let lowestX = Infinity;
  let highestX = -Infinity;
  let heightSum = 0;
  let found = 0;

  for (let index = 0; index < attribute.count; index += 1) {
    vertex.fromBufferAttribute(attribute, index).applyMatrix4(mesh.matrixWorld);

    if (vertex.z < box.max.z - band) continue;

    lowestX = Math.min(lowestX, vertex.x);
    highestX = Math.max(highestX, vertex.x);
    heightSum += vertex.y;
    found += 1;
  }

  if (found === 0) return [];

  const height = heightSum / found;
  const span = highestX - lowestX;
  const count = Math.max(2, Math.round((span * scale) / EAVE_SPACING) + 1);
  const sag = EAVE_SAG / scale;
  const bulbs = [];

  for (let index = 0; index < count; index += 1) {
    const u = index / (count - 1);

    bulbs.push(new THREE.Vector3(
      lowestX + span * u,
      height - EAVE_DROP / scale - sag * Math.sin(Math.PI * u),
      box.max.z + EAVE_OUT / scale,
    ));
  }

  return bulbs;
}

function build({ trees, roof }, scale) {
  const found = findTrees(trees, scale);
  // Tallest first, so that lighting only the nearest few per plot stays a
  // one-line experiment if 22 decorated trees turns out to read as a
  // fairground rather than a village.
  const size = new THREE.Vector3();

  found.sort((a, b) => b.canopy.getSize(size).y - a.canopy.getSize(size).y);

  // One wire: the tree strings first, then the eave, so the four-colour cycle
  // carries across from the last tree to the roof the way it carries from one
  // tree to the next.
  const bulbs = [
    ...found.flatMap((tree) => stringFor(tree, scale)),
    ...(roof ? eaveString(roof, scale) : []),
  ];
  const positions = new Float32Array(bulbs.length * 3);
  // The base colours are kept so the twinkle can scale them each frame
  // without the rounding drift that repeatedly scaling the live buffer would
  // accumulate.
  const base = new Float32Array(bulbs.length * 3);
  const colors = new Float32Array(bulbs.length * 3);
  const color = new THREE.Color();

  bulbs.forEach((bulb, index) => {
    bulb.toArray(positions, index * 3);
    // Through THREE.Color, which converts the hex from sRGB to linear on
    // input. The colour attribute is read as linear working-space values with
    // no conversion of its own, so dividing the hex's bytes by 255 here would
    // put sRGB numbers into a linear buffer and the bulbs come out pale and
    // milky -- which looks like a blending fault and is not one.
    color.setHex(COLORS[index % COLORS.length]);
    color.toArray(base, index * 3);
    color.toArray(colors, index * 3);
  });

  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  // The tallest tree, by the height of its tip rather than by the length of
  // its canopy -- they disagree here. Sorted by canopy length the winner is a
  // 68-unit tree with 54 units of canopy; by tip height it is a 71-unit tree
  // whose canopy is only 45. The star belongs on the one that is actually
  // highest.
  const crown = found.reduce(
    (best, tree) => (tree.canopy.max.y > best.canopy.max.y ? tree : best),
    found[0],
  );
  const starGeometry = new THREE.BufferGeometry();

  starGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
    crown.centre.x,
    crown.canopy.max.y + STAR_LIFT / scale,
    crown.centre.z,
  ]), 3));

  const starMaterial = new THREE.PointsMaterial({
    map: createStarTexture(),
    size: STAR_SIZE,
    sizeAttenuation: true,
    color: STAR_COLOR,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const material = new THREE.PointsMaterial({
    map: createBulbTexture(),
    size: BULB_SIZE,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    // A light adds to what is behind it. The risk is washing out where a bulb
    // overlaps bright snow, and night took lit snow from 239 to 128, so that
    // risk is much smaller than it was. If a bulb against a snow cap does blow
    // out, drop BULB_SIZE rather than reaching for NormalBlending, which
    // flattens the glow everywhere to fix a few pixels.
    blending: THREE.AdditiveBlending,
    // Depth testing stays ON, which is what makes the string read as wrapped
    // around something solid: the tree hides the bulbs on its far side. Not
    // writing depth means overlapping bulbs brighten each other instead of
    // whichever drew first punching a hole in the rest.
    depthWrite: false,
  });

  return {
    geometry,
    material,
    base,
    count: bulbs.length,
    trees: found.length,
    starGeometry,
    starMaterial,
  };
}

/**
 * One plot's string, as a single THREE.Points.
 *
 * Returns a group of two Points: the twinkling bulbs, and the star, which has
 * to be separate because they need different sizes. The star is deliberately
 * left out of the twinkle -- a twinkling star reads as a faulty bulb, where a
 * steady one reads as the top of the tree.
 *
 * Built in MODEL units and meant to be added to the plot group, which already
 * carries the scale, the Z-up quarter turn and the house's yaw -- so there is
 * no world-space arithmetic in this file at all, and all five plots are placed
 * correctly by a transform that already existed.
 *
 * The trees object must be measured in that same plot-local space, which is
 * why House.js calls this after re-parenting the pieces and before it applies
 * the plot's own transform. Measuring the source scene instead would assume
 * the group sits at the top of the loaded hierarchy, and re-parenting in
 * three.js does not preserve a world transform.
 */
export function createChristmasLights(pieces, scale) {
  if (!shared) shared = build(pieces, scale);

  const lights = new THREE.Group();
  const bulbs = new THREE.Points(shared.geometry, shared.material);
  const star = new THREE.Points(shared.starGeometry, shared.starMaterial);

  lights.name = 'ChristmasLights';
  bulbs.name = 'Bulbs';
  star.name = 'Star';
  lights.add(bulbs);
  lights.add(star);
  // frustumCulled is left at its default of true, unlike Snow.js, which turns
  // it off because its band surrounds the camera and the test is wasted work.
  // A plot's string is a compact object on the far side of the map, which is
  // exactly the case the cull test is for.

  return lights;
}

/**
 * Twinkles every bulb in the town.
 *
 * Takes no arguments on purpose: all five plots are showing one shared buffer,
 * so this is a single pass over 214 bulbs for the whole town rather than five.
 * The cost of that sharing is that the five plots twinkle in unison, which at
 * the distance between them should not read -- and if it ever does, the fix is
 * a per-plot phase offset rather than five buffers.
 *
 * Brightness only. Shifting the hue would lose the four-colour string, which
 * is the thing that makes it read as Christmas lights.
 */
export function updateChristmasLights() {
  if (!shared) return;

  const attribute = shared.geometry.attributes.color;
  const colors = attribute.array;

  twinkle += TWINKLE_RATE;

  for (let index = 0; index < shared.count; index += 1) {
    const wave = 0.5 + 0.5 * Math.sin(twinkle + index * PHASE_STEP);
    const brightness = TWINKLE_FLOOR + (1 - TWINKLE_FLOOR) * wave;
    const offset = index * 3;

    colors[offset] = shared.base[offset] * brightness;
    colors[offset + 1] = shared.base[offset + 1] * brightness;
    colors[offset + 2] = shared.base[offset + 2] * brightness;
  }

  attribute.needsUpdate = true;
}
