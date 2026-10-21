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

// The camera orbits Tode on the mouse, the way a third-person game does,
// instead of holding one fixed angle on the world. Distance and the opening
// angles come straight off CAMERA_POSITION, so the first frame is framed
// exactly as it always was: 409.4 units out, 26 degrees up, and a quarter
// turn round from due south.
const ORBIT_DISTANCE = Math.hypot(CAMERA_POSITION.x, CAMERA_POSITION.y, CAMERA_POSITION.z);
const GROUND_DISTANCE = Math.hypot(CAMERA_POSITION.x, CAMERA_POSITION.y);
const DEFAULT_PITCH = Math.atan2(CAMERA_POSITION.z, GROUND_DISTANCE);
const DEFAULT_YAW = Math.atan2(-CAMERA_POSITION.x, -CAMERA_POSITION.y);

// Just short of grazing the snow, and just short of straight down. Either
// limit reached in full loses the horizon the whole scene is composed around,
// and the low end would put the lens inside the ground.
const MIN_PITCH = 0.12;
const MAX_PITCH = 1.25;

// Radians per pixel of mouse travel. At 0.0025 a 400-pixel sweep is most of a
// half turn, which is about standard for a game that is not a shooter.
const SENSITIVITY = 0.0025;
// -1 for inverted look.
const PITCH_DIRECTION = 1;

const HINT_CLASS = 'mouse-hint';
const HINT_TEXT =
  'Click to look around \u00b7 WASD to fly \u00b7 Q / E for height \u00b7 Esc to release';
const VISIBLE_CLASS = 'visible';

let yaw = DEFAULT_YAW;
let pitch = DEFAULT_PITCH;

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

/**
 * The camera's heading on the ground plane.
 *
 * Movement.js reads this so that W means "away from the camera" rather than
 * "towards +Y". Once the player can spin the view, world-fixed controls stop
 * matching the screen within a couple of hops -- press W, turn ninety
 * degrees, and W is now sideways.
 */
export function getCameraYaw() {
  return yaw;
}

/**
 * Takes the mouse. Pointer lock is the only way to get mouse travel that does
 * not stop at the edge of the window, and a browser will only grant it from a
 * user gesture -- hence the click, and the hint that says so.
 */
export function initCameraControls(canvas) {
  const hint = document.createElement('div');
  hint.className = HINT_CLASS;
  hint.textContent = HINT_TEXT;
  document.body.appendChild(hint);
  hint.classList.add(VISIBLE_CLASS);

  canvas.addEventListener('click', () => {
    if (document.pointerLockElement !== canvas) canvas.requestPointerLock();
  });

  // Shown whenever the mouse is free, which covers both the first load and
  // every time Escape hands it back.
  document.addEventListener('pointerlockchange', () => {
    hint.classList.toggle(VISIBLE_CLASS, document.pointerLockElement !== canvas);
  });

  document.addEventListener('mousemove', (event) => {
    if (document.pointerLockElement !== canvas) return;

    yaw += event.movementX * SENSITIVITY;
    pitch = THREE.MathUtils.clamp(
      pitch + event.movementY * SENSITIVITY * PITCH_DIRECTION,
      MIN_PITCH,
      MAX_PITCH,
    );
  });
}

/**
 * Puts the camera where the mouse has left it. The camera is a child of the
 * player group, so this position is an offset from Tode and it follows him
 * around the field for free; all this decides is which side of him it orbits
 * to, and how high.
 */
export function updateCamera(camera, player) {
  const ground = ORBIT_DISTANCE * Math.cos(pitch);

  camera.position.set(
    -Math.sin(yaw) * ground,
    -Math.cos(yaw) * ground,
    ORBIT_DISTANCE * Math.sin(pitch),
  );
  // Aimed at his feet, which is where the old fixed rig's one-off lookAt
  // pointed, so he sits in the frame where he always did.
  camera.lookAt(player.position.x, player.position.y, player.position.z);
}
