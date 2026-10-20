import * as THREE from 'three';

// The night rig. Two lights, and the absence of a third is the point.
//
// What was here before was an AmbientLight at 1.5 and a white DirectionalLight
// at 1.5, both inline in main.js: a bright overcast afternoon, which is the
// one thing that cannot be made to look like night. The ambient went first.
// Flat light arriving equally from every direction has no shape in it, so it
// does all its work on the parts of the scene that should be dark -- there is
// no amount of it that is dim enough to be night and still worth having. A
// hemisphere fill and a moon is the whole rig.

// The sky, which genuinely lights very little. This is the colour a level
// snowfield receives, because three.js weights a hemisphere light by
// 0.5 * dot(N, up) + 0.5 -- an upward-facing surface takes the sky end.
const SKY_COLOR = 0x16243d;
// Moonlight bouncing back up off the snow, which is what an underside gets.
// This replaces the grass green that skeleton/atmosphere specified for the
// same slot, back when there was a lawn.
//
// It is much lighter than the sky above it, and that is correct for snow --
// but only up to a point. Push it further and the scene lights from below,
// which reads as uncanny rather than as dark. The test is in Lighting's
// numbers below: an underside must stay well under a moonlit top.
const GROUND_COLOR = 0x93a7c4;
const HEMISPHERE_INTENSITY = 0.6;

// The moon. Cool on purpose: with a coloured key light the lit and shadowed
// sides of everything differ in hue as well as in brightness, which is what
// makes a dim scene still have form in it. A white moon at this intensity just
// looks like a weak sun.
const MOON_COLOR = 0xd6e4ff;
const MOON_INTENSITY = 1.0;
// The direction the day rig already used. It is a reasonable raking angle and
// changing it is a separate argument -- and one that would have to be settled
// together with where a moon disc goes, which this does not draw.
const MOON_POSITION = { x: -100, y: -100, z: 200 };

/**
 * Builds the lighting as a group, so main.js adds one thing and the rig can be
 * reasoned about in one file.
 *
 * The numbers above are checkable without opening a browser. three.js r181
 * computes diffuse as `irradiance * albedo / PI`, the snow bed's albedo is a
 * flat linear white, and this moon direction gives dot(N, L) = 0.8165 on level
 * ground:
 *
 *   snow, moonlit and level ......... rgb(117, 125, 142)
 *   snow, vertical, facing away ..... rgb( 47,  55,  68)
 *   an underside, lit by bounce ..... rgb( 67,  77,  91)
 *   the mountains' own 0xf2f4f7 ..... rgb(110, 119, 137)
 *
 * Three properties of those numbers are the reason they were chosen, and all
 * three are worth re-checking if anyone retunes this:
 *
 *  1. Lit snow lands near 128, against about 239 under the old day rig. Dim
 *     enough to be night, bright enough to play on.
 *  2. Shadow is about 2.5x darker than light AND bluer -- blue over red is
 *     1.45 in shadow against 1.21 in the light.
 *  3. The underside is brighter than a shaded vertical face, because snow
 *     bounces light upward, but clearly darker than the moonlit top.
 *
 * And the fourth line is the check that the ground and the mountains still
 * read as two surfaces: the mountains keep their own slightly grey 0xf2f4f7
 * against the bed's pure white, and under one rig that gap survives intact.
 *
 * Shadows are deliberately not switched on here. skeleton/atmosphere owns
 * them, and it needs a correction first: its shadow camera is sized +/-400 on
 * the basis that houses sit within 170, which has not been true since the town
 * moved to an arc at 480.
 */
export function createLighting() {
  const lighting = new THREE.Group();

  const hemisphere = new THREE.HemisphereLight(
    SKY_COLOR,
    GROUND_COLOR,
    HEMISPHERE_INTENSITY,
  );

  // Z is up in this game, and a HemisphereLight's split is along its own up
  // vector rather than the scene's -- left at the default (0, 1, 0) the sky
  // and ground colours would divide the world along the horizon instead of
  // across it, so one whole side of the map would be lit from below.
  hemisphere.position.set(0, 0, 1);

  const moon = new THREE.DirectionalLight(MOON_COLOR, MOON_INTENSITY);

  moon.position.set(MOON_POSITION.x, MOON_POSITION.y, MOON_POSITION.z);

  lighting.add(hemisphere);
  lighting.add(moon);

  return lighting;
}
