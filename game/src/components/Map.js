import * as THREE from 'three';
import { createLandscape } from './Landscape.js';

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

  return map;
}
