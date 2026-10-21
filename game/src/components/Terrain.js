// How high the ground is at a point, anywhere on the map.
//
// This exists because the world opened up. `Movement.js` used to hold the
// sleigh inside WORLD_RADIUS = 700, and that number was not a game-design
// choice -- it was exactly the radius of the landscape's flat basin, the one
// region where "the ground is at z = 0" is true. Its own header said as much:
// "nothing in this project samples terrain height, and river_landscape.glb is
// a mesh rather than a heightfield. Flying out over the hills needs a height
// query written first." This is that height query.
//
// **It is a port, not a measurement.** `tools/generate_river_landscape.mjs`
// builds the .glb from an analytic height field, so the ground height is a
// closed-form expression rather than something that has to be raycast against
// 100k triangles every frame. The functions below are that expression, copied
// across unchanged.
//
// The cost of the port is that it is a SECOND COPY of the generator's terrain
// maths, and the two can drift. Anything in this block comment's list that
// changes in the generator has to change here on the same commit:
//
//   SIZE, FLAT_R, BLEND_R, BANK, SNOW_DEPTH, COVER_MIN, GRID, riverX,
//   basinWeight, height, snowCover, snowHere
//
// The alternative was a downward raycast against the loaded mesh, which reads
// the geometry that actually shipped and so cannot drift. It was not taken
// because it costs a raycast per frame per falling body against a 3280-unit
// mesh, and because it answers nothing until the glTF has landed -- and the
// floor is needed on the first frame.
import { TERRAIN_SCALE, GROUND_Z } from './Landscape.js';

// ---------------------------------------------------------------------------
// Ported verbatim from tools/generate_river_landscape.mjs. Model units.
// ---------------------------------------------------------------------------

// Half-extent of the ground plane. The terrain is a SQUARE, which is why the
// world bound below is not simply the distance to its far corner.
const SIZE = 40;
// Dead flat out to FLAT_R, ramping back into the hills by BLEND_R.
const FLAT_R = 17;
const BLEND_R = 21;
// Half-width of the carved river channel.
const BANK = 2.6;

// Centre line of the river.
const riverX = (z) => 30.5 + 1.8 * Math.sin(z * 0.17) + 0.9 * Math.sin(z * 0.071 + 1.3);

// Smoothstep from the flat basin out into the hills.
function basinWeight(x, z) {
  const r = Math.hypot(x, z);

  if (r >= BLEND_R) return 1;
  if (r <= FLAT_R) return 0;

  const t = (r - FLAT_R) / (BLEND_R - FLAT_R);

  return t * t * (3 - 2 * t);
}

function height(x, z) {
  // Rolling hills.
  let h = 1.5 * Math.sin(x * 0.17 + 0.6) * Math.cos(z * 0.14)
       + 0.8 * Math.sin(x * 0.31 - z * 0.23)
       + 0.4 * Math.cos(x * 0.6 + z * 0.5);
  // Lift the far edges towards the mountains.
  h += Math.max(0, (z + 12) * 0.18) ** 1.6 * 0.35;

  // Carve the channel.
  const d = Math.abs(x - riverX(z));

  if (d < BANK * 2.2) {
    const t = Math.min(1, d / (BANK * 2.2));
    const carve = (1 - t * t) ** 1.5;

    h = h * (1 - carve * 0.9) - carve * 1.9;
  }

  return h * basinWeight(x, z);
}

// How much snow lies at a point, 0 to 1.
//
// Ported for the landing rule. Snow does not lie on water and slides off
// anything steep, which is what leaves the river channel and the rock faces
// bare -- and those are exactly the two surfaces a sleigh must not be allowed
// to set down on. The generator wrote this function to decide where to DRAW
// snow; it answers "is this landable?" for free, and it is a far better rule
// than a radius would be because it is the same rule that put the white
// surface on screen.
function snowCover(x, z) {
  const d = Math.abs(x - riverX(z));

  if (d < BANK * 1.9) return 0;

  const e = 0.35;
  const slope = Math.hypot(height(x + e, z) - height(x - e, z),
                           height(x, z + e) - height(x, z - e)) / (2 * e);
  const edge = Math.min(1, (d - BANK * 1.9) / (BANK * 0.9));

  return Math.max(0, edge * (1 - Math.min(1, slope / 1.1)));
}

// Below this much cover the generator does not draw snow at all.
const COVER_MIN = 0.12;
// Cells per side, for the single-cell hole filling below.
const GRID = 88;
const GRID_STEP = (SIZE * 2) / GRID;

/**
 * Whether snow is actually DRAWN at a point, holes included.
 *
 * The hole filling matters here and is not pedantry: the generator fills lone
 * bare cells because a single earth-coloured triangle in a white field is an
 * artefact. Testing raw `snowCover` instead would make those filled cells
 * fatal to land on while looking like snow -- a one-cell invisible hazard,
 * which is the worst kind.
 */
function snowHere(x, z) {
  if (snowCover(x, z) >= COVER_MIN) return true;

  let neighbours = 0;

  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    if (snowCover(x + dx * GRID_STEP, z + dz * GRID_STEP) >= COVER_MIN) neighbours += 1;
  }

  return neighbours >= 3;
}

// ---------------------------------------------------------------------------
// The world-unit interface, and the numbers the flight model is tuned against.
// All measured by scanning the field above on a 1200 x 1200 grid rather than
// reasoned about, because two of them are counter-intuitive.
// ---------------------------------------------------------------------------

// Where the flat basin ends and the ramp begins: FLAT_R * 41. Inside this the
// ground really is at zero, which is the agreement the whole game was built on
// while the sleigh could not leave it.
export const FLAT_RADIUS = FLAT_R * TERRAIN_SCALE;

// The highest the ground gets anywhere on the map, at the +x +z corner. **575,
// against the ceiling of 400 the sleigh used to have** -- which is the fact
// that makes "fly the whole area" and "fly closer to the sky" the same change
// rather than two. The deepest is -95, in the river channel.
export const TERRAIN_PEAK = 575;

// Nothing is planted inside `inBasin` in the generator -- r < BLEND_R + 1.5 --
// so the nearest tree to the origin stands at 22.5 model units.
export const PLANTED_RADIUS = (BLEND_R + 1.5) * TERRAIN_SCALE;

// The tallest pine the generator can produce, measured through its builder
// rather than guessed: a trunk of up to 0.95, then three cones whose apexes
// land at 2.11, 2.63 and 3.07 above the snow. 3.07 * 41 = 126, so 130 covers
// every tree on the map with four units to spare.
//
// This is the honest limit of an analytic floor. The height field knows about
// the LAND and nothing about what is standing on it -- the 110 pines, the 55
// rocks and the 7 boulders are all separate geometry the expression above
// cannot see. Rather than port their seeded placement too (which would mean
// reproducing the generator's RNG sequence exactly, and would break the day
// anyone re-ran it), the canopy is treated as solid: out where trees grow, the
// bottom of flyable air is the top of the canopy, not the ground. It costs the
// player the right to skim a hillside between two pines, which is not a
// manoeuvre anything in the game asks for.
const CANOPY_HEIGHT = 130;

/**
 * The height of the LAND at a world point, in world units.
 *
 * World X is the model's X. World Y is the model's **-Z**: `Landscape.js` tips
 * the model by `rotation.x = PI / 2`, which sends model (x, y, z) to world
 * (x, -z, y) -- so the model's up axis becomes world Z, and its Z axis comes
 * out backwards. Getting that sign wrong mirrors the river onto the wrong bank
 * and is invisible until something falls into a hillside that looks flat.
 */
export function groundHeightAt(x, y) {
  return height(x / TERRAIN_SCALE, -y / TERRAIN_SCALE) * TERRAIN_SCALE + GROUND_Z;
}

/**
 * The lowest altitude a flying body may occupy before it has hit the world.
 *
 * The land, plus the canopy wherever trees grow. Inside the basin this is flat
 * zero and the two are the same thing.
 */
export function crashFloorAt(x, y) {
  const ground = groundHeightAt(x, y);

  if (Math.hypot(x, y) < PLANTED_RADIUS) return ground;

  return ground + CANOPY_HEIGHT;
}

/**
 * Whether the sleigh may set down here.
 *
 * Two conditions, and both are refusals of a specific surface:
 *
 * - **Snow has to be lying.** `snowHere` is false over the river and on
 *   anything steep enough that the snow slid off it, which is water and bare
 *   rock. Runners work on snow; a 74-unit sleigh put down in a stream or on a
 *   crag does not slide, it crashes.
 * - **No trees.** Out past `PLANTED_RADIUS` the generator plants 110 pines,
 *   and the height field cannot see them -- `crashFloorAt` treats the whole
 *   canopy as solid out there, so there is no ground to reach in the first
 *   place. Landing is a basin-and-ramp manoeuvre, which is also where the
 *   town is and therefore where anyone would want to put down.
 *
 * Inside the flat basin this is true everywhere: the ground is level, the
 * river is 1250 units out, and the snow is unbroken.
 */
export function isLandableAt(x, y) {
  if (Math.hypot(x, y) >= PLANTED_RADIUS) return false;

  return snowHere(x / TERRAIN_SCALE, -y / TERRAIN_SCALE);
}

/**
 * What the sleigh would be setting down on, as a word.
 *
 * Exists so a crash can say WHY. "Game Over" on its own, over a snowfield that
 * looks landable, is the single most confusing thing this flight model can do
 * -- the player has to infer the rule from the silence. The four answers map
 * one-to-one onto the refusals in `isLandableAt`.
 */
export function landingSurfaceAt(x, y) {
  if (Math.hypot(x, y) >= PLANTED_RADIUS) return 'trees';

  const mx = x / TERRAIN_SCALE;
  const mz = -y / TERRAIN_SCALE;

  if (snowHere(mx, mz)) return 'snow';

  // The same test `snowCover` makes first, and the reason it returns zero over
  // the channel: inside this band there is water rather than ground.
  if (Math.abs(mx - riverX(mz)) < BANK * 1.9) return 'water';

  return 'rock';
}
