import * as THREE from 'three';

// The northern lights, as geometry in the scene rather than as paint on the
// backdrop.
//
// Sky.js stays exactly as it is. A `scene.background` texture is drawn flat
// across the frame: it has no perspective, so it would not move when the
// camera orbits, would not shift when the sleigh climbs the 900 units
// `Movement.js` now allows, and could not sit *behind* the mountains. It would
// also mean a full canvas redraw and texture upload every frame, on a canvas
// two or three orders of magnitude bigger than the 2 x 256 the gradient needs.
// And the gradient is the one thing holding the horizon together -- the
// bottom stop, `scene.fog` and the `body` background all agree on
// HORIZON_COLOR -- so an animated second concern does not belong in it.
//
// So: a cylindrical shell, seen from the inside, standing well outside the
// world. Not a plane, which foreshortens into a line unless it is billboarded
// at the camera, and the camera orbits freely on the mouse. Not a dome, which
// puts aurora directly overhead where the default 26-degree camera pitch never
// looks. A curtain hangs vertically and wraps part of the horizon, and a shell
// is the shape that does both.

// Outside the 1640-unit edge of the landscape, so the band rises from *behind*
// the two mountain ranges at 1702-1927 rather than in front of them. Far
// outside WORLD_RADIUS = 1600, so the sleigh can never reach it, let alone fly
// through it; well inside Camera.js's FAR_PLANE = 9000.
const RADIUS = 2600;
// The bottom of the band, chosen against MAX_ALTITUDE = 900: at the ceiling
// the player is level with the base of the aurora, which is the whole reward
// for climbing. It also clears the 575-unit terrain peak, so the band never
// appears to grow out of a hillside.
const BASE_Z = 650;
// A band 1650 tall at a radius of 2600 subtends about 32 degrees, so it fills
// the upper half of the frame without wrapping over the top of it.
const TOP_Z = 2300;
// Centred on +Y, which is north -- see the note on ARC_CENTER below. More than
// half the horizon, so turning to look at it is rewarded and turning away
// still leaves colour at the edge of the frame; less than the full circle, so
// the valley keeps a dark side and the band has visible ends.
const ARC_DEGREES = 200;
// A segment every 1.25 degrees. The curtain's folds are a fragment-shader
// effect, so this only has to be fine enough that the silhouette does not
// polygonise.
const RADIAL_SEGMENTS = 160;
// One. Nothing in the vertex stage varies with height -- the vertical gradient
// and the rays are both computed per fragment -- so extra rows would be 160
// triangles each for no change in the image. 160 x 1 is 160 quads -- 320
// triangles -- in one draw call, against the sleigh's 99,163. (The spec says
// 640; it counted two triangles per segment twice.)
const HEIGHT_SEGMENTS = 1;

// Which way is north, and why it is not arbitrary.
//
// `tools/generate_river_landscape.mjs` puts its main range of 14 peaks at
// model `z = -SIZE - rng(1.5, 7)`, and Landscape.js tips the model by
// `rotation.x = PI / 2`, which sends model (x, y, z) to world (x, -z, y). So
// model -z is world +Y: the fourteen-peak range runs along the +Y horizon. The
// aurora belongs over it. Two things fall out for free -- it reads as "over
// the mountains" rather than floating in open sky, and it is opposite the moon,
// which Lighting.js puts in the south-west, so the brightest thing in the sky
// and the second brightest are never in frame fighting each other.
//
// The arc is centred by CylinderGeometry's own thetaStart rather than by a
// second rotation on the mesh. THREE.CylinderGeometry lays its first vertex
// along local +Z, and the `rotation.x = PI / 2` that stands the shell up in
// this Z-up game sends local +Z to world -Y -- so theta 180 degrees is north,
// and the arc starts half its width before that. A `rotation.z` would not do
// this job: with the default XYZ Euler order it is applied *before* the tip,
// about an axis that is still horizontal, which tilts the shell instead of
// spinning it. `rotation.y` would work, but baking the offset into thetaStart
// costs nothing and leaves the mesh with one rotation to reason about.
const ARC_CENTER_DEGREES = 180;
const THETA_START = THREE.MathUtils.degToRad(ARC_CENTER_DEGREES - ARC_DEGREES / 2);

// The green of atomic oxygen at 557.7nm, which is the colour everyone means by
// "northern lights". Kept bright and slightly blue of pure green so it reads
// as light rather than as paint.
const AURORA_LOW = 0x3cf0a0;
// The violet-magenta upper fringe. Two hues rather than one is the difference
// between an aurora and a green stripe, and this is also the pair that sits
// best over Sky.js's ZENITH_COLOR = 0x060b18.
const AURORA_HIGH = 0x7a4cff;
// Slow. The band should be noticeably different thirty seconds later and never
// visibly crawl while the player is looking at it.
const FOLD_SPEED = 0.035;
// Faster than the folds, so the streaks slide through the curtain instead of
// the whole band moving as one rigid object.
const RAY_SPEED = 0.085;
// Peak additive contribution. Under 1 on purpose: Renderer.js sets no tone
// mapping, so a term of 1.0 over the sky gradient clips to white and the two
// hues are lost exactly where the band is brightest. Tune this first if it
// looks wrong.
const BRIGHTNESS = 0.55;

// Six and a half fold periods across the 200-degree arc, so a fold is about 30
// degrees of sky wide -- wide enough to read as a sheet of curtain rather than
// as stripes.
const FOLD_SCALE = 6.5;
// Rays are the same noise an order of magnitude finer.
const RAY_SCALE = 48.0;

// Its own clock, the way Snow.js, Score.js, Animation.js and Movement.js each
// own theirs rather than taking a delta from the render loop.
const clock = new THREE.Clock();
// Clamped like Movement.js and Animation.js clamp theirs. Nothing visible
// would break if a tab-switch handed this a ten-second delta, but every other
// timed system here clamps, and the one that does not is the one that gets
// debugged later.
const MAX_DELTA = 0.1;

let elapsed = 0;

const VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;

  void main() {
    // On an open-ended cylinder uv.x walks the arc and uv.y runs base to top.
    // That is the whole of the vertex stage's contribution: everything the
    // curtain does is a function of those two numbers and the clock.
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  uniform float uTime;
  uniform vec3 uLowColor;
  uniform vec3 uHighColor;
  uniform float uBrightness;

  varying vec2 vUv;

  // The usual fract(sin(...)) value noise. Notorious for banding artefacts at
  // high frequency; this noise is deliberately low, and the alternative is a
  // texture, which this component does not have -- asset-free like Sky.js's
  // gradient and Snow.js's flake.
  float hash(float n) {
    return fract(sin(n * 127.1) * 43758.5453123);
  }

  float valueNoise(float x) {
    float cell = floor(x);
    float offset = fract(x);
    // Smoothstep the interpolant, or the folds come out as visible facets.
    offset = offset * offset * (3.0 - 2.0 * offset);

    return mix(hash(cell), hash(cell + 1.0), offset);
  }

  // Three octaves and no more. The folds are low-frequency by design, so a
  // fourth would contribute detail the band's own softness hides -- and the
  // honest cost of this whole task is fill rate, not triangles.
  float folds(float x) {
    return valueNoise(x) * 0.5
      + valueNoise(x * 2.1 + 11.0) * 0.3
      + valueNoise(x * 4.3 + 23.0) * 0.2;
  }

  void main() {
    // 1. Curtain folds. This is the term that makes it an aurora rather than a
    // glowing band: it decides where the curtain is bright and where it has
    // thinned to nothing. The smoothstep is what opens the gaps -- without it
    // the noise never reaches zero and the band is continuous all the way
    // round.
    float fold = folds(vUv.x * ${FOLD_SCALE.toFixed(1)} + uTime * ${FOLD_SPEED.toFixed(3)});

    fold = smoothstep(0.26, 0.86, fold);

    // 2. Vertical falloff. Real aurora is brightest at its lower edge, where
    // the curtain is densest, and a band that fades upward is the single
    // strongest cue that it is hanging rather than painted. The second term
    // softens the bottom few per cent so the base is an edge rather than a
    // cut line.
    float vertical = pow(1.0 - vUv.y, 2.2) * smoothstep(0.0, 0.06, vUv.y);

    // 3. Rays. The same noise an order of magnitude finer, barely varying in
    // uv.y so it reads as vertical streaks, and scrolled faster than the folds
    // so the two do not move together.
    float ray = valueNoise(
      vUv.x * ${RAY_SCALE.toFixed(1)} + uTime * ${RAY_SPEED.toFixed(3)} + vUv.y * 0.6
    );

    // Never down to zero: the rays modulate the curtain, they do not cut it
    // into ribbons.
    float rays = mix(0.55, 1.0, ray);

    // The arc has ends, and a hard one would read as a torn edge. Softened
    // over the outer few per cent of the sweep so the band runs out instead of
    // stopping.
    float ends = smoothstep(0.0, 0.07, vUv.x) * smoothstep(0.0, 0.07, 1.0 - vUv.x);

    float intensity = fold * vertical * rays * ends * uBrightness;

    // 4. Colour, mixed along uv.y rather than along the folds: the green base
    // through the violet upper fringe.
    vec3 color = mix(uLowColor, uHighColor, smoothstep(0.0, 1.0, vUv.y));

    // Additive blending, so brightness *is* the alpha and the shader never
    // needs a sensible one of its own.
    gl_FragColor = vec4(color * intensity, intensity);
  }
`;

/**
 * Builds the aurora as one open-ended cylindrical shell.
 *
 * Parent it to the scene, not to the player. The shell is 2600 units out; if
 * it travelled with the sleigh it would be the one object in the world with no
 * parallax, which is exactly the sticker problem the shape exists to avoid.
 */
export function createAurora() {
  const geometry = new THREE.CylinderGeometry(
    RADIUS,
    RADIUS,
    TOP_Z - BASE_Z,
    RADIAL_SEGMENTS,
    HEIGHT_SEGMENTS,
    true,
    THETA_START,
    THREE.MathUtils.degToRad(ARC_DEGREES),
  );

  const material = new THREE.ShaderMaterial({
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    uniforms: {
      uTime: { value: 0 },
      uLowColor: { value: new THREE.Color(AURORA_LOW) },
      uHighColor: { value: new THREE.Color(AURORA_HIGH) },
      uBrightness: { value: BRIGHTNESS },
    },
    transparent: true,
    // Aurora is emitted light, not a surface. Additive over the 0x060b18
    // zenith is what makes it glow rather than sit on the sky like gauze.
    blending: THREE.AdditiveBlending,
    // Standard for additive: two overlapping fragments of the same band must
    // both contribute.
    depthWrite: false,
    // Kept on, so a mountain in front of the band still occludes it. At a
    // radius of 2600 that is the correct and only relationship it has with the
    // terrain.
    depthTest: true,
    // The camera is inside the cylinder.
    side: THREE.BackSide,
    // NOT fog-aware, and deliberately. `scene.fog` ends at 2300 and the shell
    // is at 2600, so a fog-aware material would render the aurora as flat
    // HORIZON_COLOR -- a dull blue-grey band, which is a bug that looks like a
    // design choice. ShaderMaterial does not get fog unless asked, so this is
    // a matter of not adding `fog: true`. Do not add it.
  });

  const aurora = new THREE.Mesh(geometry, material);

  // CylinderGeometry is built centred on its own origin, so the mesh is lifted
  // to put the band's base at BASE_Z.
  aurora.position.z = (BASE_Z + TOP_Z) / 2;
  // Stands the shell up, like every other model in this Z-up game.
  aurora.rotation.x = Math.PI / 2;

  // No collider, and in no obstacle list. The shell is at 2600 and
  // WORLD_RADIUS is 1600, so there is nothing here the player can reach.

  return aurora;
}

/**
 * Advances the curtain one frame.
 *
 * Called outside main.js's `isGameOver()` guard, the same way the snow, the
 * lights and the smoke are: the sky does not stop because the run ended, and a
 * band of aurora freezing on the Game Over frame would read as part of the
 * failure. There is nothing to reset on a restart -- the only state is this
 * clock, and it keeps running for the same reason.
 */
export function updateAurora(aurora) {
  elapsed += Math.min(clock.getDelta(), MAX_DELTA);
  aurora.material.uniforms.uTime.value = elapsed;
}
