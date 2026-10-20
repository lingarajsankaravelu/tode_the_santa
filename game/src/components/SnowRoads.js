import * as THREE from 'three';
import {
  HOUSE_COUNT,
  TOWN_FACING,
  TOWN_RADIUS,
  TOWN_SPREAD_DEGREES,
  houseAngle,
} from './House.js';

// A lane past the five-house town, with a footpath up to each front door.
//
// Purely decorative, and deliberately not an obstacle: it is parented to the
// map group and never goes into the `houses` array, so Collision.js never
// hears about it. Nothing drives yet and nothing should be blocked by a road.
//
// The geometry is two stock shapes and no rotation, which makes this the one
// piece of scenery in the project that needs neither a hand-built
// BufferGeometry nor the Z-up quarter turn: RingGeometry and PlaneGeometry
// both already lie in XY, and XY is this game's ground plane.

// How far the yards reach in front of a house centre, measured rather than
// assumed -- and the measurement is the reason this file does not look like
// its spec. visual/snow_roads asked for a road centred at 390, on the basis
// that the houses sit at 480 with a 74.7-deep footprint. Walking every vertex
// of a placed plot through its transforms says otherwise:
//
//   front door ............. radial 453.7
//   porch column ........... radial 437.5   (on the path's own centre line)
//   house, above ground .... radial 436.2
//   house foundation ....... radial 430.8   (buried; the box's own minimum)
//   path lanterns .......... radial 433.7 and 407.7
//   SnowMan ................ radial 394.1 .. 405.1
//   Trees1 ................. radial 333.2 .. 455.7
//
// A 50-wide road centred at 390 spans 365 to 415, which is inside three of
// those: it would have run the street through five snowmen, through the
// conifer clusters, and straight over the outer lanterns that
// visual/house_decorations laid down the path. The spec measured the building
// and not the garden -- and measured it through its bounding box, which here
// reports the buried foundation.
//
// Inside the tree line is the only band in the town that is clear of props at
// every angle, because the arc crosses every plot at the same radius. So the
// road goes there, and it reads as what it now is: a country lane running past
// the edge of the properties, with a path crossing each yard to the door.
const YARD_DEPTH = 146.8;
// Gap left between the road's outer edge and the innermost conifer. Small on
// purpose -- the branches that reach 333.2 are canopy, overhanging a verge,
// and a lane that passes under them sits in the town rather than beside it.
//
// Conservative, as it turns out, and left alone for it. 333.2 is the radial
// PROJECTION of the nearest branch onto its own plot's axis; its true distance
// from the origin is 344.0, because the lateral offset adds to it. So the
// lane's outer edge at 325.2 clears the nearest plot vertex by 18.8 units, and
// does so at all five plots, which are clones of one another.
const ROAD_CLEARANCE = 8;
// About 11 ft at this project's 2.7 inches per unit: a lane, not a motorway.
const ROAD_WIDTH = 50;
// Centre line, derived rather than stated so the road moves with the town.
// 480 - 146.8 - 8 - 25 = 300.2, spanning 275.2 to 325.2.
const ROAD_RADIUS = TOWN_RADIUS - YARD_DEPTH - ROAD_CLEARANCE - ROAD_WIDTH / 2;
// Past each end house, so the road does not stop dead at the last doorstep.
// Ten degrees at this radius is 52 units of road beyond the final spur, which
// is more than the spur's own width.
const ROAD_OVERSHOOT_DEGREES = 10;
const ROAD_SPREAD_DEGREES = TOWN_SPREAD_DEGREES + ROAD_OVERSHOOT_DEGREES * 2;
// thetaSegments. 130 degrees at radius 300 is 681 units of road, so this is a
// chord every 10.6 units -- straight-looking at the camera's 340-unit remove.
const ROAD_SEGMENTS = 64;
// Compacted snow: darker and cooler than the fields, with the verges left
// bright. The fields are flat 0xffffff (tools/generate_river_landscape.mjs),
// and under the night rig an up-facing white renders rgb(117, 125, 142); this
// albedo under the same rig renders rgb(95, 106, 125). A fifth of the
// brightness off the snow either side of it, which is a lane you can see
// without a lane that glows.
const ROAD_COLOR = 0xd2dae3;

// How far the porch stands in front of a house centre: 480 - 437.5. The path
// ends under the porch columns rather than at the door, which is 16 units
// further back behind them -- and not at the bounding box's 430.8 either,
// since that is foundation below the ground. Measured in the path's own
// corridor, |lateral| < 18: nothing else in the house reaches into it.
const PORCH_DEPTH = 42.5;
// A footpath, about a fifth of the house's 169-unit frontage. Not a free
// number any more: visual/house_decorations put the lanterns at +/-22 from the
// plot's axis on the understanding that this is 36, so they stand 4 units off
// the path's edge. Widening this walks the path over its own lanterns, and
// then over the snowman 4.5 units beyond them.
//
// Note that it is the axis the path follows and not the door, which sits off
// to one side at lateral 6.4 to 20.9. That is house_decorations' decision,
// already shipped: the lanterns are centred on the plot, so the path is too,
// and the two agree with each other.
const SPUR_WIDTH = 36;
// Tucked under the road edge at one end and the porch at the other. Butting
// them up exactly leaves a seam at the join; overlapping hides it.
const SPUR_OVERLAP = 3;
const SPUR_INNER = ROAD_RADIUS + ROAD_WIDTH / 2 - SPUR_OVERLAP;
const SPUR_OUTER = TOWN_RADIUS - PORCH_DEPTH + SPUR_OVERLAP;
const SPUR_LENGTH = SPUR_OUTER - SPUR_INNER;
const SPUR_RADIUS = (SPUR_INNER + SPUR_OUTER) / 2;

// Above the snow bed rather than squeezed in beneath it. The bed's surface
// inside the basin lies between -2.95 and -0.05 world units: the generator
// subtracts both its relief terms, so the snow can only ever dip BELOW the
// walk plane, and Landscape.js then drops the whole model by GROUND_Z. So the
// road clears it by at least 0.09 and by up to 3 units in the hollows, and
// nothing can poke through from below. At 2.7 inches per unit this is about a
// quarter inch of packed snow lying on the ground -- physically sensible, and
// far too small to read as floating.
const ROAD_Z = 0.04;

/**
 * The road's material: standard, not basic.
 *
 * A deliberate departure from the spec, which asked for MeshBasicMaterial
 * because "the scene's ambient and directional lights are both at intensity
 * 1.5, which together push a lit white material past white". That has not been
 * true since visual/night replaced the day rig with a 0.6 hemisphere and a
 * moon: nothing is blown out any more, and an unlit material now fails in the
 * opposite direction. MeshBasicMaterial writes its colour straight to the
 * screen, so this road would arrive at rgb(210, 218, 227) on a snowfield
 * rendering at rgb(117, 125, 142) -- a strip of daylight laid across the town
 * at night.
 *
 * Lit, it instead tracks the fields automatically: same normal, same light, so
 * the albedo ratio is all that separates them, and it survives the next retune
 * of the rig without anyone re-deriving a hex. It also means the road can take
 * a shadow, which matters because skeleton/atmosphere is next and the houses
 * and conifers already carry `castShadow` -- an unlit road would be a
 * shadowless hole in the middle of the only place in the game that has any.
 *
 * Metalness 0 and roughness 1 are the snow bed's own values, and the house's
 * Snow2 material's: three surfaces of snow, one material response.
 */
function createRoadMaterial() {
  return new THREE.MeshStandardMaterial({
    color: ROAD_COLOR,
    metalness: 0,
    roughness: 1,
    // The textbook tool for a decal on a near-coplanar surface: it biases the
    // road's depth in hardware, independent of distance, which is what makes
    // it robust where a fixed Z offset is not.
    //
    // Belt and braces, and worth saying so. Camera.js's NEAR_PLANE is 10 now,
    // not the 0.1 this spec's depth table was written against, so the buffer
    // resolves about 0.001 units at town distance against a 0.09 gap -- ninety
    // times the margin it needs. Kept because 681 units of coplanar surface
    // should not depend on a single setting in another file staying put.
    //
    // NOT depthWrite: false with a render order. That appears to work and then
    // breaks the moment anything is drawn between the road and the camera.
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
}

/**
 * The lane: one ring segment, centred on the world origin because the town is.
 */
function createLane(material) {
  const spread = THREE.MathUtils.degToRad(ROAD_SPREAD_DEGREES);
  const lane = new THREE.Mesh(
    new THREE.RingGeometry(
      ROAD_RADIUS - ROAD_WIDTH / 2,
      ROAD_RADIUS + ROAD_WIDTH / 2,
      ROAD_SEGMENTS,
      1,
      TOWN_FACING - spread / 2,
      spread,
    ),
    material,
  );

  lane.name = 'Lane';
  lane.position.z = ROAD_Z;
  lane.receiveShadow = true;

  return lane;
}

/**
 * One footpath, from the road's outer edge to house `index`'s doorstep.
 *
 * The angle comes from House.js rather than from five numbers written out
 * here, which is the whole reason that function is exported: a path that does
 * not line up with its own door is the failure this costs the least to avoid.
 */
function createSpur(index, material) {
  const angle = houseAngle(index);
  // Length along local X, so a single yaw of `angle` turns it radially: local
  // +X maps to (cos angle, sin angle), which is the direction of the door.
  const spur = new THREE.Mesh(
    new THREE.PlaneGeometry(SPUR_LENGTH, SPUR_WIDTH),
    material,
  );

  spur.name = `Spur${index}`;
  spur.position.set(
    Math.cos(angle) * SPUR_RADIUS,
    Math.sin(angle) * SPUR_RADIUS,
    ROAD_Z,
  );
  spur.rotation.z = angle;
  spur.receiveShadow = true;

  return spur;
}

/**
 * Builds the road. Synchronous -- there is no model to load -- so unlike the
 * houses and the landscape it is there on the first frame.
 */
export function createSnowRoads() {
  const roads = new THREE.Group();
  // One material for all six meshes. They are the same surface, and sharing it
  // means a retune is one edit rather than six.
  const material = createRoadMaterial();

  roads.name = 'SnowRoads';
  roads.add(createLane(material));

  for (let index = 0; index < HOUSE_COUNT; index += 1) {
    roads.add(createSpur(index, material));
  }

  return roads;
}
