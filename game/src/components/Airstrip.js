import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createBulbTexture } from './ChristmasLights.js';

// The airfield at the back of the valley: a strip of tarmac with runway
// lights, a beacon on a mast, and a light aircraft parked up for the night.
//
// Only the runway is above the snow. The .glb is a whole small airport -- two
// car parks, a taxiway, an apron, a second hard stand -- and all of it bar the
// landing strip is clipped away at the snow line, so what the valley has is a
// cleared runway with the rest of the field drifted over. See
// `stripClippingPlanes` for how, and why it is clipped rather than deleted.
//
// `hackathon/visual/airstrip/spec.md`. Scenery, like the town and the roads --
// it is parented to the map group, it never goes into the `houses` array, and
// nothing in Collision.js or Movement.js hears about it. Tode can fly straight
// through the parked plane, which is the same deal the conifers already offer.

const MODEL_PATH = '/models/airport.glb';
const PLANE_PATH = '/models/airport_airplane.glb';

// ---------------------------------------------------------------------------
// The model, in its own units. Everything below is measured off the loaded
// .glb rather than guessed, because the pad is 3,000 units of painted markings
// with no named parts to anchor to -- the mesh names are `Object_4` through
// `Object_121`, and the only way to know where the runway is was to read the
// vertices. The numbers are recorded here so nobody has to do it twice.
//
// The model is Y-up like every other asset here, so its X is the strip's long
// axis, its Z is the cross-axis, and its Y is height. After the Z-up quarter
// turn applied below, model +X is local +X and model +Z is local **-Y**.
// ---------------------------------------------------------------------------

// The runway proper: the band between the two painted edge lines (`Loft_5` and
// `Loft_6`, each a 9-unit stripe), running the length the centreline dashes
// cover. 2,339 x 385 model units, which is a 561 x 92 strip once scaled.
const RUNWAY = { minX: -848.6, maxX: 1490.0, minZ: -508.7, maxZ: -124.1 };
// The whole paved area, which is much more than the runway: two car parks off
// the north side, a taxiway and an apron off the south, and a second hard
// stand to the east. `Extrude_3` is the outer slab and bounds all of it, 720 x
// 378 units once scaled. None of it is drawn -- it is here because it is what
// the clipping below has to cut away.
const PAD = { minX: -1000.9, maxX: 1999.2, minZ: -1073.4, maxZ: 503.6 };

// The two mesh names worth knowing by name. The collider is the one piece of
// either model that must not ship: 3,770 triangles of invisible hull on a
// `baseColorFactor` of [1, 0, 0, 0], so it draws nothing, sorts as
// transparent geometry, and costs a fifth of the plane's triangles to do it.
const PLANE_COLLIDER_NAME = '18.4.Collider';
// The pavement's top surface, which is the asphalt texture; everything else in
// the pad is a painted marking lying on it.
const ASPHALT_MATERIAL = 'Mat12';

// ---------------------------------------------------------------------------
// Placement. The spec asks for the strip on the side nearest the mountains and
// the last house. Three things bound it:
//
//  - The mountains are the range along +Y. (`tools/generate_river_landscape.mjs`
//    puts them at model z = -SIZE, and world Y is the model's -Z.)
//  - The ground is only flat inside `FLAT_RADIUS` = 697. Outside it the basin
//    ramps into the hills, and a flat slab of tarmac laid across a ramp either
//    floats at one end or sinks at the other.
//  - The town fills the arc from -55 to +55 degrees at radius 480, and each
//    plot reaches about 125 units past its own centre.
//
// It has been walked out twice, and the clipping is what let it go as far as
// it has. While the whole 720 x 378 pad was drawn, the flat basin could only
// hold it at 163 units from the last house's garden, then 327 once it was
// swung round the shoulder of the valley. Clipped to the landing strip there
// is only a 585 x 116 rectangle that has to stand on level ground, so the
// field now sits 582 from the nearest plot and 242 from where Tode starts --
// three and a half times the first attempt, at no cost to its size.
//
// The strip runs very nearly north-south, from (-291, -76) out in the western
// field up to (-389, 476) under the peaks. The half turn in the yaw is what
// decides which way round that is, and it is worth stating: at 100 degrees the
// rectangle sits in exactly the same place, but the green threshold lands at
// the southern end and the approach sequence runs away from the mountains. At
// 280 the green end is the one under the peaks, which is the end everything
// here points at.
//
// The scale is the largest the valley can hold. It is small for an airport and
// deliberately so: at 0.24 the runway comes out 561 units long, which is seven
// sleigh-lengths. A scale that made the runway realistic against the aeroplane
// standing on it would be 1,900 units of tarmac, and the valley is 1,400
// across.
// ---------------------------------------------------------------------------
const SCALE = 0.24;
// Where the middle of the runway sits, and which way it points. Polar
// coordinates would read better but these are the numbers the fit was solved
// in, and rounding them to a tidy angle walks a corner of the strip back out
// of the flat basin.
const POSITION = { x: -340, y: 200 };
const YAW_DEGREES = 280;
// The same trick SnowRoads.js uses, and for the same reason: the snow bed
// inside the basin lies between -2.95 and -0.05, so anything at +0.05 clears
// it everywhere and cannot be poked through from below. The slab's own body
// hangs 1.8 units below that and is buried in the snow, which is what makes
// the pad read as laid INTO the field rather than dropped on top of it.
const GROUND_Z = 0.05;

// The aeroplane. 40 x 51 x 14 model units with the wheels at y = 0, so it
// needs no grounding offset -- and the nose is model +X, read off the vertex
// profile rather than assumed: the tail end carries the fin (13.6 units tall
// against the nose's 5.9) and the nose wheel sits forward at x = 13.
//
// 1.5 puts it at 61 long with a 76-unit span, against a house that is 80 tall.
// That is a light aircraft the size of a cottage, which is the honest reading
// of a game whose unit is 2.7 inches and whose whole valley is 225 metres.
//
// The span is what sets it. On the runway the aeroplane has 92 units of paint
// to stand in, so 1.8 -- which was right when it stood on the apron -- puts
// the wingtips through the edge lights. At 1.5 they sit 8 units inside the
// edge lines and well clear of the lamps.
const PLANE_SCALE = 1.5;
// Standing in the middle of the runway, which is where the spec asks for it.
// The apron would be the realistic place to leave an aeroplane overnight, and
// it is also now under the snow with the rest of the field -- and the middle
// of the strip is the one spot that is unambiguous from the air, which is the
// only angle this is ever seen from.
const PLANE_POSITION = { x: 0, y: 0 };
// Nose towards the green threshold and the mountains, which is the direction
// everything else on this field points.
const PLANE_YAW_DEGREES = 180;

// ---------------------------------------------------------------------------
// The lights. Two families, and they are two because a PointsMaterial carries
// one size for every point it draws:
//
//   runway   11  the edge, threshold and centreline lights
//   beacon   22  the one rotating light on its mast
//
// `spec.md` also asks for Christmas lights along the sides of the field, and
// there was a 118-bulb garland on stakes round the pavement here. It was cut
// on sight: at this distance the airfield is read by its runway lights, and a
// second string of coloured dots round the outside of them turned a legible
// aerodrome into a smear. The town is where the fairy lights belong.
//
// All distances here are LOCAL units -- that is, world units, since the group
// carries no scale of its own. The model's scale is applied on the way in by
// `toLocal`, so nothing in this section has to think in model units.
// ---------------------------------------------------------------------------

// How much tarmac is left above the snow, measured out from the runway's own
// paint. 12 units past the edge lines puts the cut just outside the edge
// lights, which stand 5 units out on the shoulder; 12 past the threshold bars
// does the same at the ends. Any less and the lamps stand in the snow; much
// more and the aprons start coming back.
const STRIP_SHOULDER = 12;

// Down each side of the runway. 30 units is about 6 ft at this project's
// scale, which is far too close together for a real runway and is exactly
// right for one 561 units long: at the spacing a real airfield uses there
// would be four lights a side and it would read as a road.
const EDGE_SPACING = 30;
// Outboard of the painted edge line, so the lights stand on the shoulder
// rather than in the landing area.
const EDGE_OUTSET = 5;
// Runway edge lights are white at the sides and shade to amber in the last
// third. One colour is enough at this size; this is that white, warmed so it
// sits with the town's window amber rather than against it.
const EDGE_COLOR = 0xfff0d0;
// Standard airfield colours, and the one piece of real aviation vocabulary
// worth keeping: green marks the threshold you land over, red the far end you
// must not run past. Green goes on the mountain end, which is the one the
// sequence below runs towards.
const THRESHOLD_COLOR = 0x2bff7a;
const RUNWAY_END_COLOR = 0xff3b24;
// Five lights across each end, inside the edge lights.
const THRESHOLD_LIGHTS = 5;
// Height above the tarmac. A runway light is a 14-inch fixture; this is 8
// inches, and the difference is not visible against a 7-unit sprite.
const LIGHT_HEIGHT = 3;

// The sequenced flashers down the centreline -- the "rabbit" that runs towards
// the threshold on a real approach, and the single most recognisable thing an
// airfield does at night. This is what `spec.md` means by blinking lights.
const CENTRE_SPACING = 40;
const FLASH_COLOR = 0xffffff;
// One run of the strip. Real sequenced flashers run twice a second, which at
// this length would be a strobe rather than a wave.
const SEQUENCE_SECONDS = 1.4;
// How much of the strip is lit at once, as a fraction of the run. Three or
// four lamps at a time, which reads as a wave travelling rather than as a row
// of lamps taking turns.
const FLASH_FRACTION = 0.18;
// What a flasher sits at between pulses. Not zero: an unlit lamp in a line of
// lamps reads as a dead bulb, and the centreline should still be legible as a
// line when the wave is at the other end.
const FLASH_FLOOR = 0.12;
// The threshold bars strobe once per run of the wave, on the beat the wave
// arrives. Flashing them with the rabbit is what ties the two together into
// one approach lighting system instead of two unrelated animations.
const THRESHOLD_FLASH_FRACTION = 0.1;
const THRESHOLD_FLOOR = 0.45;

// The beacon: the alternating white-and-green flash that says "aerodrome" from
// anywhere in the valley. One light on a mast at the corner of the apron.
const BEACON_SECONDS = 2.2;
const BEACON_COLORS = [0xffffff, 0x2bff7a];
const BEACON_HEIGHT = 34;
const BEACON_SIZE = 22;
// The mast under it. Thin enough to disappear at distance and solid enough
// that the light is not floating on nothing when Tode flies past it.
const MAST_RADIUS = 1.1;
const MAST_COLOR = 0x2b3340;

const RUNWAY_LIGHT_SIZE = 11;
// Seconds, and the same clamp every timed system in this project uses. The
// lights run outside the game's freeze -- the airfield does not stop because
// the run ended -- so this delta is read on every frame of the game's life;
// the clamp is for the first frame after a tab switch or a 700 KB glTF.
const MAX_DELTA = 0.1;

// Where the model's origin is put. The runway's own centre, so that local X is
// the runway's long axis and local Y is its cross-axis, and so every light
// below can be written as "so far along, so far across" instead of as an
// offset from a corner of a 3,000-unit pad.
const ANCHOR_X = (RUNWAY.minX + RUNWAY.maxX) / 2;
const ANCHOR_Z = (RUNWAY.minZ + RUNWAY.maxZ) / 2;

const loader = new GLTFLoader();

// One texture for all three light families. They are the same glow at three
// sizes, and a canvas each would be three uploads of identical pixels.
let bulbTexture = null;

function sharedBulbTexture() {
  if (!bulbTexture) bulbTexture = createBulbTexture();

  return bulbTexture;
}

// One airfield, so its state lives in the module rather than on the group --
// the same arrangement, and for the same reason, as the town's shared light
// buffer in ChristmasLights.js. There is one buffer and one thing drawing it.
let runwayLights = null;
let beacon = null;
let elapsed = 0;
const clock = new THREE.Clock();

/**
 * A point on the pad, from model coordinates to the group's local ones.
 *
 * World Y is the model's **-Z**, the same mapping `Terrain.js` documents: the
 * group tips the model by `rotation.x = PI / 2`, which sends model (x, y, z)
 * to (x, -z, y). Getting that sign wrong mirrors the apron onto the far side
 * of the runway, which is invisible until the parked aeroplane turns up in a
 * car park.
 */
function toLocal(modelX, modelZ, height = 0) {
  return new THREE.Vector3(
    (modelX - ANCHOR_X) * SCALE,
    -(modelZ - ANCHOR_Z) * SCALE,
    height,
  );
}

// The runway in local units, derived once so the light rows below cannot drift
// away from the paint they are supposed to line up with.
const RUNWAY_HALF_LENGTH = ((RUNWAY.maxX - RUNWAY.minX) / 2) * SCALE;
const RUNWAY_HALF_WIDTH = ((RUNWAY.maxZ - RUNWAY.minZ) / 2) * SCALE;

/**
 * The four planes that bury everything but the landing strip.
 *
 * The .glb is a whole airport on one pair of slabs: `Extrude_3` and
 * `Extrude_4` are single meshes spanning all 720 x 378 units of it, with every
 * marking in the place a plan view would put it. So the aprons and the car
 * parks cannot be dropped by name the way House.js drops a diorama's ground --
 * there is no node to drop. Cutting the geometry would mean shipping a second
 * .glb and re-deriving every measurement in this file against it.
 *
 * Clipping does it in the material instead. Four vertical planes, two across
 * and two along, and what falls outside them is simply not drawn: the snow
 * closes over it, which is exactly the look asked for -- a runway kept clear
 * through a field that has drifted over everything else. The cut edge is 0.2
 * units proud of the snow, so there is no visible wall where the tarmac ends.
 *
 * World space, which is what `material.clippingPlanes` wants. The group's
 * transform never changes after it is built, so these are computed once from
 * the same two constants that place it rather than tracked per frame.
 */
function stripClippingPlanes() {
  const yaw = THREE.MathUtils.degToRad(YAW_DEGREES);
  // The strip's own axes, in world terms.
  const along = new THREE.Vector3(Math.cos(yaw), Math.sin(yaw), 0);
  const across = new THREE.Vector3(-Math.sin(yaw), Math.cos(yaw), 0);
  const centre = new THREE.Vector3(POSITION.x, POSITION.y, 0);
  const planes = [];

  [
    [along, RUNWAY_HALF_LENGTH + STRIP_SHOULDER],
    [across, RUNWAY_HALF_WIDTH + STRIP_SHOULDER],
  ].forEach(([axis, half]) => {
    // A THREE.Plane keeps what is in front of it. These two keep the slab
    // between -half and +half along `axis`: the first measures back from the
    // far side, the second forward from the near one.
    planes.push(new THREE.Plane(axis.clone().negate(), centre.dot(axis) + half));
    planes.push(new THREE.Plane(axis.clone(), half - centre.dot(axis)));
  });

  return planes;
}

/**
 * Every light on the strip, as a flat list.
 *
 * Each entry carries its colour and how it behaves: `sequence` is where in the
 * running wave it sits, as a fraction from 0 at the far end to 1 at the
 * threshold, or null for a lamp that simply stays on.
 *
 * Built as one list and drawn as one Points, which makes the whole airfield a
 * single draw call and a single pass per frame.
 */
function runwayLightPlan() {
  const lights = [];
  // Along the strip, from the red end towards the green one. Local -X is the
  // mountain end, so the wave runs from +X to -X and the fractions below count
  // the same way.
  const edgeCount = Math.floor((RUNWAY_HALF_LENGTH * 2) / EDGE_SPACING);
  const edgeStep = (RUNWAY_HALF_LENGTH * 2) / edgeCount;
  const across = RUNWAY_HALF_WIDTH + EDGE_OUTSET;

  for (let index = 0; index <= edgeCount; index += 1) {
    const x = RUNWAY_HALF_LENGTH - index * edgeStep;

    [across, -across].forEach((y) => {
      lights.push({
        position: new THREE.Vector3(x, y, LIGHT_HEIGHT),
        color: EDGE_COLOR,
        sequence: null,
      });
    });
  }

  // The centreline flashers. Inset lights on a real runway, so they sit lower
  // than the edge lamps -- which is also what keeps them from reading as a
  // third row of edge lights when the strip is seen end-on.
  const centreCount = Math.floor((RUNWAY_HALF_LENGTH * 2) / CENTRE_SPACING);
  const centreStep = (RUNWAY_HALF_LENGTH * 2) / centreCount;

  for (let index = 0; index <= centreCount; index += 1) {
    lights.push({
      position: new THREE.Vector3(
        RUNWAY_HALF_LENGTH - index * centreStep,
        0,
        LIGHT_HEIGHT / 2,
      ),
      color: FLASH_COLOR,
      sequence: index / centreCount,
    });
  }

  // The two bars across the ends. Inside the edge lights, so the three rows
  // close the rectangle rather than crossing it.
  const span = RUNWAY_HALF_WIDTH * 0.8;

  for (let index = 0; index < THRESHOLD_LIGHTS; index += 1) {
    const y = -span + (span * 2 * index) / (THRESHOLD_LIGHTS - 1);

    lights.push({
      position: new THREE.Vector3(-RUNWAY_HALF_LENGTH, y, LIGHT_HEIGHT),
      color: THRESHOLD_COLOR,
      // 1 is where the wave finishes: the threshold bar flashes as it lands.
      sequence: 1,
      threshold: true,
    });
    lights.push({
      position: new THREE.Vector3(RUNWAY_HALF_LENGTH, y, LIGHT_HEIGHT),
      color: RUNWAY_END_COLOR,
      // 0, so the far end flashes as the wave leaves it.
      sequence: 0,
      threshold: true,
    });
  }

  return lights;
}

/**
 * The runway lights, as one Points with a colour per vertex.
 *
 * The base colours are kept alongside the drawn ones, exactly as the town's
 * strings do it: the update multiplies a brightness into the base rather than
 * reading back what it wrote last frame, which would decay to black over a few
 * hundred frames of rounding.
 */
function createRunwayLights() {
  const plan = runwayLightPlan();
  const positions = new Float32Array(plan.length * 3);
  const colors = new Float32Array(plan.length * 3);
  const base = new Float32Array(plan.length * 3);
  const sequence = new Float32Array(plan.length);
  const steady = new Uint8Array(plan.length);
  const threshold = new Uint8Array(plan.length);
  const color = new THREE.Color();

  plan.forEach((light, index) => {
    light.position.toArray(positions, index * 3);
    color.setHex(light.color).toArray(base, index * 3);
    sequence[index] = light.sequence ?? 0;
    steady[index] = light.sequence === null ? 1 : 0;
    threshold[index] = light.threshold ? 1 : 0;
  });

  colors.set(base);

  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const points = new THREE.Points(geometry, new THREE.PointsMaterial({
    map: sharedBulbTexture(),
    size: RUNWAY_LIGHT_SIZE,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    // A light adds to what is behind it, and here what is behind it is dark
    // asphalt -- the one surface in this game that cannot be blown out.
    blending: THREE.AdditiveBlending,
    // Depth testing stays on so the parked aeroplane occludes the lamps behind
    // it; depth writing stays off so overlapping lamps brighten each other
    // instead of punching holes in one another.
    depthWrite: false,
  }));

  points.name = 'RunwayLights';
  runwayLights = { geometry, base, sequence, steady, threshold, count: plan.length };

  return points;
}

/**
 * The aerodrome beacon and the mast it stands on.
 *
 * In the snow off the eastern shoulder, towards the green threshold. It used
 * to stand at the corner of the apron, which is under the drift now -- and
 * beside the strip is the better place for it anyway: clear of the edge lights
 * so it reads as its own light rather than as one of theirs, and tall enough
 * to be the first thing that shows over the shoulder of the valley.
 */
const BEACON_FOOT = { x: -190, y: -80 };

function createBeacon() {
  const group = new THREE.Group();
  const foot = new THREE.Vector3(BEACON_FOOT.x, BEACON_FOOT.y, 0);

  const mast = new THREE.Mesh(
    new THREE.CylinderGeometry(MAST_RADIUS, MAST_RADIUS * 1.6, BEACON_HEIGHT, 6),
    new THREE.MeshStandardMaterial({ color: MAST_COLOR, metalness: 0.2, roughness: 0.8 }),
  );

  // CylinderGeometry stands up the Y axis and this game's up is Z, the same
  // quarter turn every loaded model gets -- and the only reason this one is
  // written out rather than inherited is that the mast is built here.
  mast.rotation.x = Math.PI / 2;
  mast.position.set(foot.x, foot.y, BEACON_HEIGHT / 2);
  mast.castShadow = true;
  mast.name = 'BeaconMast';

  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
    foot.x,
    foot.y,
    BEACON_HEIGHT,
  ]), 3));

  const material = new THREE.PointsMaterial({
    map: sharedBulbTexture(),
    size: BEACON_SIZE,
    sizeAttenuation: true,
    color: BEACON_COLORS[0],
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const light = new THREE.Points(geometry, material);

  light.name = 'Beacon';
  beacon = { material, color: new THREE.Color() };

  group.add(mast);
  group.add(light);

  return group;
}

/**
 * Re-materialises the pad.
 *
 * The .glb ships every one of its five materials as `KHR_materials_unlit`,
 * which three.js loads as MeshBasicMaterial -- a material that writes its
 * texture straight to the screen with no lighting applied. That is the exact
 * failure SnowRoads.js's header describes: under the night rig a lit white
 * surface arrives at about rgb(117, 125, 142), so an unlit pad would be a
 * daylit slab of tarmac sitting in a moonlit valley.
 *
 * Standard materials instead, keeping each one's own map, so the airfield
 * tracks the rig automatically and survives the next retune of it. Metalness 0
 * and roughness 1 are the snow bed's own values and the road's.
 */
function lightThePavement(model) {
  // One set of planes for the whole pad, shared by every material on it. They
  // are plain data to the renderer, so sharing them costs nothing and means
  // the cut cannot come out in a different place on the markings than on the
  // asphalt they are painted on.
  const clippingPlanes = stripClippingPlanes();

  model.traverse((child) => {
    if (!child.isMesh) return;

    const unlit = child.material;

    child.material = new THREE.MeshStandardMaterial({
      map: unlit.map ?? null,
      color: unlit.color ?? 0xffffff,
      metalness: 0,
      roughness: 1,
      side: unlit.side,
      // The markings are separate meshes lying a fraction above the asphalt,
      // and the asphalt is itself a fraction above the slab beneath it. Both
      // gaps are under a quarter of a unit once scaled, which is exactly the
      // case polygon offset exists for -- it biases in hardware, independent
      // of how far away the camera is.
      polygonOffset: unlit.name !== ASPHALT_MATERIAL,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
      // The snow line. Switched on for the pavement alone -- the lights, the
      // mast and the aeroplane carry no planes, so nothing that stands ON the
      // field is cut by the edge of it.
      clippingPlanes,
    });

    // The pad is flat ground. It takes shadow from the aeroplane and the mast
    // and has nothing of its own to cast -- a 0.8-unit-thick slab casting a
    // shadow onto the snow it is buried in is one more surface to fight with.
    child.receiveShadow = true;
    child.castShadow = false;
  });
}

/**
 * Loads the aeroplane onto the runway.
 *
 * Takes the airstrip group rather than the scene: the plane is parked on the
 * runway, so it belongs to the field's transform and travels with it if the
 * field is ever moved.
 */
function addPlane(airstrip) {
  loader.load(PLANE_PATH, (gltf) => {
    const plane = gltf.scene;
    const collider = plane.getObjectByName(PLANE_COLLIDER_NAME);

    if (collider) collider.removeFromParent();

    plane.scale.setScalar(PLANE_SCALE);
    // The Z-up quarter turn, then the yaw inside it -- Euler XYZ order, which
    // makes the second rotation a yaw in the group's own plane. The same
    // arrangement House.js uses to face a plot at the origin.
    plane.rotation.x = Math.PI / 2;
    plane.rotation.y = THREE.MathUtils.degToRad(PLANE_YAW_DEGREES);

    // On the pavement, not in it: the asphalt's top surface is 0.8 model units
    // above the slab's origin, which is where the wheels have to sit.
    plane.position.set(PLANE_POSITION.x, PLANE_POSITION.y, 0.8 * SCALE);

    plane.traverse((child) => {
      if (!child.isMesh) return;

      child.castShadow = true;
      child.receiveShadow = true;
    });

    airstrip.add(plane);
  });
}

/**
 * Builds the airfield and returns the group holding it.
 *
 * Asynchronous in the same way the town and the landscape are: the lights are
 * there on the first frame because they are built here, and the tarmac and the
 * aeroplane arrive when their glTFs land.
 */
export function createAirstrip() {
  const airstrip = new THREE.Group();

  airstrip.name = 'Airstrip';
  airstrip.position.set(POSITION.x, POSITION.y, GROUND_Z);
  airstrip.rotation.z = THREE.MathUtils.degToRad(YAW_DEGREES);

  airstrip.add(createRunwayLights());
  airstrip.add(createBeacon());

  loader.load(MODEL_PATH, (gltf) => {
    const model = gltf.scene;

    lightThePavement(model);

    model.scale.setScalar(SCALE);
    // Z up, like every other loaded model here.
    model.rotation.x = Math.PI / 2;
    // Puts the runway's centre at the group's origin, which is the agreement
    // every light position above is written against.
    //
    // Mind the sign on the second term. This offset is applied in the GROUP's
    // frame, after the quarter turn above has already sent model +Z to local
    // -Y -- so cancelling a model-space anchor of ANCHOR_Z means moving by
    // +ANCHOR_Z, not -ANCHOR_Z, and `toLocal`'s minus has no business here.
    // Getting it wrong slides the whole pad 152 units sideways, which is three
    // times the runway's half width: the clip then framed the hangar apron at
    // the south end of the field and the aeroplane parked itself on the
    // helipad, both of which is exactly what it did.
    model.position.set(-ANCHOR_X * SCALE, ANCHOR_Z * SCALE, 0);

    airstrip.add(model);
  });

  addPlane(airstrip);

  return airstrip;
}

/**
 * Runs the approach sequence and the beacon.
 *
 * Takes no arguments and is called from the render loop outside the game's
 * freeze, next to `updateChristmasLights`: an airfield whose lights stop on
 * the Game Over frame reads as the valley dying with Tode.
 */
export function updateAirstrip() {
  // Before any early return, like every other delta in this project: a clock
  // that is only asked for a delta on some frames banks the time in between
  // and spends it all on the next one.
  const delta = Math.min(clock.getDelta(), MAX_DELTA);

  elapsed += delta;

  if (runwayLights) {
    const { geometry, base, sequence, steady, threshold, count } = runwayLights;
    const attribute = geometry.attributes.color;
    const colors = attribute.array;
    // Where the wave is, as a fraction of its run. The lights count the same
    // way, so a lamp is lit while the head is just past it.
    const head = (elapsed % SEQUENCE_SECONDS) / SEQUENCE_SECONDS;

    for (let index = 0; index < count; index += 1) {
      let brightness = 1;

      if (!steady[index]) {
        // Distance behind the head, wrapped, so the lamp at the far end lights
        // again as the wave comes round rather than staying dark for a cycle.
        const behind = (head - sequence[index] + 1) % 1;
        const bar = threshold[index];
        const width = bar ? THRESHOLD_FLASH_FRACTION : FLASH_FRACTION;
        const floor = bar ? THRESHOLD_FLOOR : FLASH_FLOOR;

        brightness = behind < width ? 1 : floor;
      }

      const offset = index * 3;

      colors[offset] = base[offset] * brightness;
      colors[offset + 1] = base[offset + 1] * brightness;
      colors[offset + 2] = base[offset + 2] * brightness;
    }

    attribute.needsUpdate = true;
  }

  if (beacon) {
    // Alternating white and green, a half period each, with a short bright
    // pulse inside each half rather than a steady burn: a beacon is a rotating
    // mirror, so what anyone on the ground sees is a sweep passing over them.
    const phase = (elapsed % BEACON_SECONDS) / BEACON_SECONDS;
    const half = phase < 0.5 ? 0 : 1;
    const within = (phase % 0.5) / 0.5;
    const sweep = Math.max(0, 1 - within * 4);

    beacon.color.setHex(BEACON_COLORS[half]);
    beacon.material.color.copy(beacon.color).multiplyScalar(0.25 + 0.75 * sweep);
  }
}
