import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

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

// Each kept prop, with the nudge that brings it into its own house's yard.
// Offsets are in model units and are applied before the scale, so they read at
// the same size as the measurements above.
//
// Two of these are not whole groups, and that is deliberate -- measuring the
// groups alone is misleading:
//  - The snowman is `polySurface538` specifically. Its parent `SnowMan` group
//    also holds a bucket and some odds and ends scattered near the diorama's
//    origin, and the snowman itself stands 39.9 units away from the house.
//  - `Kolodec` is the well, but 118.6 of its 119-unit span is one child,
//    `pCylinder14` -- a pond or path lying 58 units off. Dragging that into
//    every plot would put a 878-unit slab through the town, so it is excluded
//    by name and the rest of the group, a tidy well cluster, is kept.
const PROPS = [
  // Twenty-odd conifers clustered off the house's corner. Deliberately NOT
  // nudged: the snow sitting on these trees lives in the `Snow` group below,
  // not inside `Trees1`, so moving the trees would walk them out from under
  // their own snow caps and leave six white blobs floating where they used to
  // be. At (66, 72) world units from the house they already read as beside it.
  { name: 'Trees1', offset: { x: 0, z: 0 } },
  { name: 'Kolodec', offset: { x: 0, z: 0 }, exclude: ['pCylinder14'] },
  { name: 'polySurface538', offset: { x: -1, z: -30 } },
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
// Extra turn if the house model does not face +Y at a yaw of zero. Same escape
// hatch Movement.js and Enemies.js keep for Tode and the monsters; set it once
// here rather than rotating the group, which would be a different thing.
const MODEL_BASE_ROTATION = 0;
// The diorama's own ground sits at model y = 0 -- the discarded Ground group
// tops out at +0.52 -- so placing the plot at zero keeps every piece at the
// height the artist put it, including the small amount the house foundation
// and the tree trunks are buried by. Deliberately NOT lifted by -box.min.z the
// way a single model is: the house's lowest point is at -3.48, so grounding on
// it would raise the whole plot and leave the trees and the snowman floating
// 26 units in the air.
const PLOT_Z = 0;

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

function createHouse(source, angle) {
  const house = new THREE.Group();
  const plot = new THREE.Group();

  const building = takePiece(source, plot, BUILDING_NAME);

  PROPS.forEach(({ name, offset, exclude }) => {
    const prop = takePiece(source, plot, name, exclude);

    if (!prop) return;

    prop.position.x += offset.x;
    prop.position.z += offset.z;
  });

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
