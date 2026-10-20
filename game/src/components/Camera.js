import * as THREE from 'three';

// 45, not 30. The frustum has to reach the scenery: at 30 degrees, pitched
// down onto Tode, the top edge of the view sat 20 degrees BELOW horizontal
// and the furthest ground it could see was 388 units away -- so the hills,
// the pines and the mountains were all outside it no matter where he stood.
const FIELD_OF_VIEW = 45;
// 10, not 0.1, and this is the fix for the whole scene flickering rather than a
// tuning preference. A 24-bit depth buffer resolves about z^2 / (near * 2^24)
// at distance z, so at 0.1 the resolution was 2.4 world units out at the
// mountains and 4.0 at the far range -- coarser than the gaps between surfaces
// that are supposed to be in front of each other. The mountains overlap each
// other out there and the snow bed lies within a few units of the ground it
// covers, so both were losing the depth test in patches, and the patches
// flipped as the camera moved: the flicker appeared whenever Tode jumped.
//
// At 10 the resolution is 0.024 units at the mountains, a hundredfold
// improvement, and nothing is clipped by it. The camera sits about 368 units
// from Tode and the nearest thing to the lens is the snowfall, whose band
// geometry in Snow.js puts its closest flake roughly 53 units out -- five times
// the new plane. Nothing in this game is ever drawn close to the lens.
const NEAR_PLANE = 10;
const FAR_PLANE = 9000;
// Lower than it was, which buys reach twice over: a shallower pitch (26
// degrees, down from 35) tips the frustum's top edge out towards the horizon,
// and the shorter distance makes Tode bigger rather than smaller. Together
// with the wider field of view the camera now sees about 2500 units out, past
// the mountains at 1927.
const CAMERA_POSITION = { x: 260, y: -260, z: 180 };

export function createCamera() {
  const camera = new THREE.PerspectiveCamera(
    FIELD_OF_VIEW,
    window.innerWidth / window.innerHeight,
    NEAR_PLANE,
    FAR_PLANE,
  );

  camera.up.set(0, 0, 1);
  camera.position.set(CAMERA_POSITION.x, CAMERA_POSITION.y, CAMERA_POSITION.z);
  camera.lookAt(0, 0, 0);

  return camera;
}
