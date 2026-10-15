import * as THREE from 'three';

// World units along one edge of a single checkerboard square. Matched to the
// hop distance in Movement.js, so one key press moves Tode exactly one square
// and the floor doubles as a readout of how far a jump goes.
const TILE_SIZE = 80;
// Squares along one edge of the floor. Even, so the two-square texture tiles
// whole. 40 x 80 = 3200 units across, which is twenty hops from the centre in
// any direction -- far enough that Tode cannot casually wander off the edge.
const GRID_SIZE = 40;
// A hair below the ground plane. Tode's feet, the enemies' and the houses all
// rest at exactly z = 0, and coplanar surfaces shimmer.
const FLOOR_Z = -0.05;

const DARK_GREEN = 0x228b22;
const LIGHT_GREEN = 0x90ee90;

/**
 * The checkerboard, as a 2x2 texture repeated across one quad.
 *
 * The obvious alternative is a mesh per square, but a floor wide enough to hop
 * around on needs some sixteen hundred of them, all carrying the same two flat
 * colours. Four pixels and a wrap mode say the same thing to the GPU in a
 * single draw call, and the pattern stays as tweakable as it would have been:
 * the two colours below and TILE_SIZE are the whole description.
 */
function createCheckerboardTexture() {
  const colors = [DARK_GREEN, LIGHT_GREEN, LIGHT_GREEN, DARK_GREEN];
  const data = new Uint8Array(colors.length * 4);

  colors.forEach((color, index) => {
    const offset = index * 4;

    // Bytes pulled straight out of the hex, so what is stored is the sRGB
    // value the spec names. Going through THREE.Color would convert it to
    // linear on the way in and the floor would come out washed out.
    data[offset] = (color >> 16) & 0xff;
    data[offset + 1] = (color >> 8) & 0xff;
    data[offset + 2] = color & 0xff;
    data[offset + 3] = 0xff;
  });

  const texture = new THREE.DataTexture(data, 2, 2);

  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  // Each repeat of the texture covers two squares, hence the halving.
  texture.repeat.set(GRID_SIZE / 2, GRID_SIZE / 2);
  // Nearest on the way up keeps the squares hard-edged near the camera. The
  // default mipmapping on the way down is left alone on purpose: it blends the
  // far squares into plain green rather than a moire pattern.
  texture.magFilter = THREE.NearestFilter;
  texture.needsUpdate = true;

  return texture;
}

/**
 * Builds the ground. Returns a Group rather than the floor mesh itself,
 * because the houses are parented to it: moving or swapping out the map then
 * carries its scenery along.
 */
export function createMap() {
  const map = new THREE.Group();

  const size = TILE_SIZE * GRID_SIZE;
  // PlaneGeometry already lies in XY, which is this game's ground plane, so
  // this is the one piece of the scene that needs no rotation fixing up.
  const geometry = new THREE.PlaneGeometry(size, size);
  // Basic, not Standard: the spec names two exact colours, and the scene's
  // ambient and directional lights together would push a lit material well
  // past them.
  const material = new THREE.MeshBasicMaterial({ map: createCheckerboardTexture() });

  const floor = new THREE.Mesh(geometry, material);
  floor.position.z = FLOOR_Z;

  map.add(floor);

  return map;
}
