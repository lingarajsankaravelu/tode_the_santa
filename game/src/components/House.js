import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createChristmasLights } from './ChristmasLights.js';

const MODEL_PATH = '/models/winter_country_house.glb';
// The House group inside the model is 10.85 units tall, so this puts it at
// 80.3 world units -- the height small_house.glb had at its own scale of 65.
// That number is the anchor everything else is sized against: an 80-unit house
// reads as an 18 ft cottage, which makes one world unit about 2.7 inches, Tode
// 2.3 ft tall and one hop 18 ft. Matching it means this file changes the
// architecture and nothing else about the game's sense of scale.
const MODEL_SCALE = 7.4;

// The model is not a house. It is a Sketchfab diorama of 1,441 nodes, 679
// meshes and 124,005 triangles: a house, a well, trees, a snowman, lying snow,
// a bridge, sledges, shovels, fishes, a smoke puff and a ground patch, spread
// across a scene 159 units long. Only the named pieces below are kept, which
// brings a house to 80,238 triangles.
//
// The discard that matters is `Ground`, 27,595 triangles of ground patch. The
// landscape already is the ground, and two ground surfaces at one height is
// the coplanar case GROUND_Z in Landscape.js exists to avoid -- five of them
// would shimmer across the whole town.
//
// `Snow` is kept, and the name is a trap worth recording: it is not a ground
// layer. Its children all sit above z = 0 and all use the Snow2 material --
// `Snow1` is 15.5 x 10.8 at roof height, which is the house's own footprint,
// and the six polySurface children are caps on the trees and posts. Dropping
// it was the first thing anyone noticed in the browser: a winter country house
// with no snow on it.
const BUILDING_NAME = 'House';

// Each kept prop. Every one of them is now left exactly where the artist put
// it, and the offsets are kept at zero rather than removed because getting one
// of them wrong is a specific, easy mistake -- see the sign note below.
//
// Offsets are in model units and are applied before the scale, so they read at
// the same size as the measurements above. **The front of the house is model
// +Z.** The model faces -Y in game space at a yaw of zero, which is why
// MODEL_BASE_ROTATION exists, and after the Z-up quarter turn model +Z is the
// direction that ends up pointing at the origin -- so a POSITIVE z offset
// moves a prop out towards the field and a negative one pushes it round the
// back. Confirmed by transforming the basis vectors rather than reasoned
// about: model +Z comes out as world (-1, 0, 0) for the house at angle 0,
// which sits at world (480, 0), so +Z is towards the middle of the map.
//
// Two of these are not whole groups, and that is deliberate -- measuring the
// groups alone is misleading:
//  - The snowman is `polySurface538` specifically. Its parent `SnowMan` group
//    also holds a bucket and some odds and ends scattered near the diorama's
//    origin. That group's spread is where the "39.9 units from the house"
//    figure came from, and it is the wrong measurement: the snowman mesh on
//    its own already stands 26 world units off the front wall, which is the
//    front yard. It is the reason this entry carried an offset of
//    `{ x: -1, z: -30 }` for a while -- a pull of 30 towards a house that was
//    only 4 model units away, in the direction that goes through it, which put
//    a snowman 196 units behind all five houses.
//  - `Kolodec` is the well, but 118.6 of its 119-unit span is one child,
//    `pCylinder14` -- a pond or path lying 58 units off. Dragging that into
//    every plot would put a 878-unit slab through the town, so it is excluded
//    by name and the rest of the group, a tidy well cluster, is kept.
// The conifers, named because visual/christmas_lights needs the group itself
// and not just its contents -- the light strings are measured off it.
const TREES_NAME = 'Trees1';

const PROPS = [
  // Twenty-odd conifers clustered off the house's corner. Deliberately NOT
  // nudged: the snow sitting on these trees lives in the `Snow` group below,
  // not inside `Trees1`, so moving the trees would walk them out from under
  // their own snow caps and leave six white blobs floating where they used to
  // be. At (66, 72) world units from the house they already read as beside it.
  { name: TREES_NAME, offset: { x: 0, z: 0 } },
  { name: 'Kolodec', offset: { x: 0, z: 0 }, exclude: ['pCylinder14'] },
  // The snowman, in the front yard where it was modelled: 26 world units off
  // the front wall, 12 clear of the nearest conifer and 72 clear of the well.
  // It stands 28 units to one side of the plot's own radius, which is where
  // visual/snow_roads will run a 36-wide spur to the door -- so it clears that
  // path by 10 units, and if SPUR_WIDTH grows, this is the prop it hits first.
  { name: 'polySurface538', offset: { x: 0, z: 0 } },
  // Lying snow: the roof, and caps on the trees and posts. Left unmoved for
  // the same reason the trees are.
  { name: 'Snow', offset: { x: 0, z: 0 } },
];

const HOUSE_COUNT = 5;
// Distance from the origin to each house centre. The plot reaches about 125
// units further, so the town's outer edge lands near 605 -- inside the
// WORLD_RADIUS of 700 that Movement.js holds Tode inside, which it must be or
// he is stopped by the invisible edge of the world before reaching the front
// doors. It also puts the nearest wall 443 units from his start, far enough
// that the town is somewhere he travels to rather than somewhere he begins.
const TOWN_RADIUS = 480;
// Angular width of the arc, centred on +X. 110 degrees across five houses is a
// 27.5 degree step, which puts adjacent centres 228 units apart. Two houses
// need at most about 137 between them (see the footprint note below), so the
// geometry clears it comfortably and replaces the old rejection loop rather
// than hiding it.
const TOWN_SPREAD_DEGREES = 110;
// Why +X: the river is on that side. riverX in
// tools/generate_river_landscape.mjs puts the channel centre at model x 30.5,
// which at Landscape.js's scale of 41 is 1251 world units, nearest water 1091.
// So the town faces the water across the fields.
//
// The town cannot sit on the bank, and this is not a shortcut. The nearest
// water is at 1091 and WORLD_RADIUS is 700: moving the channel inward would
// break the flat-basin guarantee the landscape depends on, and raising the
// bound would let Tode hop into the hills at z = 0 with the ground through his
// waist. A town between the field and the river is the version that works.
const TOWN_FACING = 0;
// The house model faces -Y at a yaw of zero, not +Y like tode.glb and
// enemy.glb, so every house needs half a turn on top of the facing worked out
// below. Confirmed in the browser: at 0 the five fronts pointed out of the map
// and the town presented its back walls to the field.
//
// Set here rather than by rotating the group, which is a different thing --
// the group carries the house's position, and turning it would swing the plot
// around the origin instead of turning the house on its own spot.
const MODEL_BASE_ROTATION = Math.PI;
// The diorama's own ground sits at model y = 0 -- the discarded Ground group
// tops out at +0.52 -- so placing the plot at zero keeps every piece at the
// height the artist put it, including the small amount the house foundation
// and the tree trunks are buried by. Deliberately NOT lifted by -box.min.z the
// way a single model is: the house's lowest point is at -3.48, so grounding on
// it would raise the whole plot and leave the trees and the snowman floating
// 26 units in the air. Checked in the browser rather than left to the
// reasoning: at zero the houses sit on the ground.
const PLOT_Z = 0;

// The windows were already lit, and nobody had noticed.
//
// `winter_country_house.glb` carries five emissive materials, all of them
// inside the `House` group this file already keeps: `Glass` on seven window
// panes, and `RedLight`, `BlueLight`, `YellowLight` and `GreenLight` on twelve
// small bulbs. 19 pieces and 152 triangles out of the house's 80,238, so they
// cost nothing. Emissive is not affected by scene lighting, so under the old
// day rig -- ambient and directional both at 1.5 -- they were simply lost in a
// scene whose snow was already at 239. Turning the lights down revealed them.
//
// Nothing here adds a light to a window. The one change is the colour.
const WINDOW_MATERIAL = 'Glass';
// The model ships `emissiveFactor [1, 1, 0]`, which is pure saturated yellow
// and reads as a warning lamp rather than a lit room. This is a lamp amber.
//
// Passed as a hex and not pre-converted: THREE.Color treats a hex as sRGB and
// converts it to linear on the way in, which is what is wanted. Converting it
// by hand first applies the curve twice and the windows come out dim and
// brown.
const WINDOW_COLOR = 0xffcc77;

const loader = new GLTFLoader();

// The placed houses, in the order the arc was walked -- west to east. Exported
// as the obstacle list Movement and Enemies test their next step against, and
// as the five addresses the delivery task will index into.
export const houses = [];

/**
 * Pulls one named piece out of the loaded diorama and into the plot.
 *
 * Adding a child to a new parent detaches it from the old one, so the pieces
 * left behind are simply never re-homed and go out with the rest of the scene.
 * Named rather than filtered: a future version of the asset with extra props
 * then stays out on its own rather than quietly shipping.
 */
function takePiece(source, plot, name, exclude = []) {
  const piece = source.getObjectByName(name);

  if (!piece) return null;

  exclude.forEach((childName) => {
    const child = piece.getObjectByName(childName);

    if (child) child.removeFromParent();
  });

  plot.add(piece);

  return piece;
}

/**
 * Retints the window glass on the loaded source, once.
 *
 * Deliberately not inside the per-house traverse below. `gltf.scene.clone()`
 * shares materials rather than copying them, so a clone's `Glass` is the same
 * object as the source's -- setting it per house would do identical work five
 * times and, worse, would read as if each house had its own glass.
 */
function lightTheWindows(source) {
  source.traverse((child) => {
    if (!child.isMesh) return;
    if (child.material?.name !== WINDOW_MATERIAL) return;

    child.material.emissive.setHex(WINDOW_COLOR);
  });
}

function createHouse(source, angle) {
  const house = new THREE.Group();
  const plot = new THREE.Group();

  const building = takePiece(source, plot, BUILDING_NAME);
  let trees = null;

  PROPS.forEach(({ name, offset, exclude }) => {
    const prop = takePiece(source, plot, name, exclude);

    if (!prop) return;

    prop.position.x += offset.x;
    prop.position.z += offset.z;

    if (name === TREES_NAME) trees = prop;
  });

  if (trees) {
    // Here, and not a line later, which is the whole of the placement
    // problem. The string is measured off the trees' own boxes, and it has to
    // come out in the plot's coordinates -- so the plot's matrix has to still
    // be identity when the boxes are read, which it is only until
    // plot.scale/rotation are set below. Measuring the source scene instead
    // would assume Trees1 sits at the top of the loaded hierarchy, and
    // re-parenting in three.js does not preserve a world transform.
    plot.updateMatrixWorld(true);
    // Not an obstacle, and nothing to add to the `houses` array: this is a
    // child of the plot, so it travels with the yard and Collision.js never
    // hears about it.
    plot.add(createChristmasLights(trees, MODEL_SCALE));
  }

  plot.scale.setScalar(MODEL_SCALE);
  // Z is up in this game and the .glb is Y-up, the same quarter turn every
  // other loaded model gets.
  plot.rotation.x = Math.PI / 2;
  // Applied inside the tip above in Euler XYZ order, which makes it a yaw in
  // world space. Faces the origin, so the fronts look onto the field -- the
  // arc of houses all facing the same place is the point, which is why the old
  // random quarter-turn is gone.
  plot.rotation.y = Math.atan2(Math.cos(angle), -Math.sin(angle)) + MODEL_BASE_ROTATION;
  plot.position.z = PLOT_Z;

  house.add(plot);
  // Collision.js measures the footprint off this property, and it must be the
  // building alone. Pointed at the whole plot it would average in the trees,
  // the well and the snowman and return a radius near 92 -- a hundred-unit
  // invisible disc around every home, with no walking through a garden. The
  // building alone gives 45.7 axis-aligned, rising to about 65 for a house
  // yawed near 45 degrees, since Collision.js measures an axis-aligned box.
  // The arc's 228-unit spacing clears even that worst case.
  house.model = building;

  // GLTF meshes default to casting and receiving nothing, and a loaded .glb is
  // a tree, so the flags go on per mesh. Shadows are not switched on in
  // Renderer.js yet -- that is the atmosphere task -- and these are inert
  // until they are.
  plot.traverse((child) => {
    if (!child.isMesh) return;

    child.castShadow = true;
    child.receiveShadow = true;
  });

  return house;
}

/**
 * Builds the town into the map group.
 *
 * Five houses on a fixed arc rather than scattered at random. The old
 * placement picked coordinates and retried on overlap, which suited three
 * anonymous cottages and is wrong twice over here: a town is a place, and the
 * delivery task needs five addresses that are in the same spot on every run
 * rather than five different ones per reload.
 *
 * Asynchronous, so `houses` stays empty for the first few frames. That is the
 * same deal the enemy list offers, and an empty obstacle list blocks nothing.
 */
export function createHouses(map) {
  loader.load(MODEL_PATH, (gltf) => {
    lightTheWindows(gltf.scene);

    const spread = THREE.MathUtils.degToRad(TOWN_SPREAD_DEGREES);

    for (let index = 0; index < HOUSE_COUNT; index += 1) {
      // Evenly across the arc, first and last house on its ends.
      const angle = TOWN_FACING - spread / 2 + (spread * index) / (HOUSE_COUNT - 1);

      // Cloned per house. The model has no skins and no animations, which is
      // the case clone() handles cleanly -- the same reason small_house.glb
      // could be cloned and enemy.glb cannot.
      const house = createHouse(gltf.scene.clone(), angle);

      house.position.set(
        Math.cos(angle) * TOWN_RADIUS,
        Math.sin(angle) * TOWN_RADIUS,
        0,
      );

      map.add(house);
      houses.push(house);
    }
  });

  return houses;
}
