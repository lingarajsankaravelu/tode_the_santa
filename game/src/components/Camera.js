import * as THREE from 'three';

const FIELD_OF_VIEW = 30;
const NEAR_PLANE = 0.1;
const FAR_PLANE = 9000;
const CAMERA_POSITION = { x: 300, y: -300, z: 300 };

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
