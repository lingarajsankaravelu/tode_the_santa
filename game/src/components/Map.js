import * as THREE from 'three';
import { createLandscape } from './Landscape.js';
import { createSnowRoads } from './SnowRoads.js';
import { createAirstrip } from './Airstrip.js';

/**
 * Builds the ground. Returns a Group rather than the landscape itself,
 * because the houses are parented to it: moving or swapping out the map then
 * carries its scenery along.
 *
 * This used to be a checkerboard quad, two greens and a tile size that
 * doubled as a readout of how far one hop goes. The landscape replaces it
 * outright -- its colours live in the model as vertex data, and hop distance
 * is no longer legible from the floor. Both are accepted costs of having real
 * ground; see hackathon/visual/river_landscape/spec.md.
 */
export function createMap() {
  const map = new THREE.Group();

  map.add(createLandscape());
  // After the landscape, which is the order the two want to be drawn in -- but
  // only as a statement of intent. three.js sorts opaque meshes front to back
  // rather than by insertion, so what actually keeps the road on top of the
  // ground is the polygonOffset and the 0.04 lift in SnowRoads.js.
  map.add(createSnowRoads());
  // The aerodrome under the mountains, past the last house. Scenery standing
  // on the ground rather than ground itself, like the roads and the town: it
  // is here rather than in main.js because it is part of the place the map
  // is, and moving the map should carry it along.
  map.add(createAirstrip());

  return map;
}
