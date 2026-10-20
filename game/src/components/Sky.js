import * as THREE from 'three';

// The night sky, and the single source of truth for where it meets the ground.
//
// Three things have to agree on this colour: the bottom of the gradient, the
// fog that dissolves the far edge of the landscape into it, and the CSS
// background that covers the frames before the first render. Written out three
// times they drift apart the first time one of them is tuned, and the symptom
// is a visible seam at the horizon that nobody can find in the diff.
export const HORIZON_COLOR = 0x1d2b47;
const ZENITH_COLOR = 0x060b18;

// Two pixels wide because only the vertical axis carries anything: the texture
// is stretched across the whole backdrop, so the horizontal resolution is
// wasted either way. 256 rows is finer than an 8-bit channel can step over
// this range, so the gradient is smooth and banding comes from the display
// rather than from here.
const SKY_WIDTH = 2;
const SKY_HEIGHT = 256;

/**
 * The backdrop, as a vertical two-stop gradient in a canvas.
 *
 * Asset-free, the same trade Snow.js makes for its flake. A gradient is also
 * all this needs: there is no moon disc and no stars, which are their own
 * tasks -- a disc has to agree with the directional light's angle, and both
 * would be drawn over by the snowfall passing in front of them.
 *
 * The horizon is deliberately LIGHTER than the zenith, and lighter than a
 * clear night sky would really be. Snow throws a great deal of light back up,
 * so a snowfield at night has a genuine glow along its skyline -- and that
 * glow is what keeps the mountains readable as distance rather than as a flat
 * black band. A true dark sky loses them completely.
 */
export function createSkyTexture() {
  const canvas = document.createElement('canvas');

  canvas.width = SKY_WIDTH;
  canvas.height = SKY_HEIGHT;

  const context = canvas.getContext('2d');
  const gradient = context.createLinearGradient(0, 0, 0, SKY_HEIGHT);

  // Canvas row zero is the top of the image, and a CanvasTexture flips Y on
  // upload, so the first stop ends up at the top of the screen.
  gradient.addColorStop(0, hexToCss(ZENITH_COLOR));
  gradient.addColorStop(1, hexToCss(HORIZON_COLOR));

  context.fillStyle = gradient;
  context.fillRect(0, 0, SKY_WIDTH, SKY_HEIGHT);

  const texture = new THREE.CanvasTexture(canvas);

  // Without this the canvas is read as linear data and the gradient comes out
  // washed out and several shades too light -- which at night is the whole
  // difference between a sky and a grey wall.
  texture.colorSpace = THREE.SRGBColorSpace;

  return texture;
}

function hexToCss(hex) {
  return `#${hex.toString(16).padStart(6, '0')}`;
}
