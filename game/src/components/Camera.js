import * as THREE from 'three';

// 45, not 30. The frustum has to reach the scenery: at 30 degrees, pitched
// down onto Tode, the top edge of the view sat 20 degrees BELOW horizontal
// and the furthest ground it could see was 388 units away -- so the hills,
// the pines and the mountains were all outside it no matter where he stood.
const FIELD_OF_VIEW = 45;
const NEAR_PLANE = 0.1;
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
