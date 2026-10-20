### Specification for AI agent: Atmosphere

Extends the scene described in `spec.md`. The goal is depth and place: the world
should have a sky instead of a blank page, a horizon that fades out instead of a
hard edge, and objects that sit in the light instead of floating on it.

Three things change: the backdrop, the lighting rig, and shadows. They are one
task because none of them reads correctly alone — shadows need a directional
light with a real angle, that angle only looks right against a sky, and the sky
only closes the world if the fog that hides the floor edge is the same colour.

> **Amended — only the Shadows section is still live.** `visual/night` has
> landed, and it built the sky, the fog and the lighting rig as a night scene:
> `Sky.js`, `Lighting.js`, `scene.fog` and the `body` background all exist and
> are implemented. The two sections below are kept as a record of the daylight
> version that was specified first; **do not implement them.** The gradient is
> a day gradient, and the hemisphere light's ground colour is a grass green
> referring to a lawn that no longer exists — `visual/river_landscape` replaced
> the floor with terrain and `visual/snow_ground` covered it in snow.
>
> Two figures stated below are also simply out of date, and are corrected where
> they appear: the camera sits **409** units from Tode, not 520, and the floor
> is the 3280-unit landscape rather than a 3200-unit checkerboard.
>
> Shadows were deliberately left out of `visual/night` so that this file keeps
> them. That section needs the correction marked in it before it is built.

#### Sky and fog — superseded by `visual/night`
In the `components` directory, add a `Sky.js` file:
- Export `createSkyTexture()`, returning a `THREE.CanvasTexture` holding a
  vertical two-stop linear gradient: `#4a7fb5` at the top, `#cfe3f0` at the
  horizon. A canvas of `2 x 256` is enough — it is stretched across the
  backdrop, so only the vertical axis carries information.
- Set `colorSpace` to `THREE.SRGBColorSpace` so the gradient is not washed out.
- Export the horizon colour as a named constant (`HORIZON_COLOR = 0xcfe3f0`).
  The fog below and the CSS fallback both have to match it, and three copies of
  one hex drifting apart is the failure mode here.

In the main entry point `main.js`:
- Assign the texture to `scene.background`.
- Add `scene.fog = new THREE.Fog(HORIZON_COLOR, 600, 2400)`. The floor is 3200
  units across, so its far corner sits about 2263 units from the origin (the
  landscape that replaced it is 3280 across and 2319 to the corner, which is
  why the implemented `far` is 2300): a `far`
  of 2400 dissolves the edge of the world into the sky rather than leaving it
  visible as a straight green cut-off. `near` of 600 keeps Tode and anything
  he is about to collide with completely clear — the camera sits 409 units from
  him (stated here as 520, which was the old `CAMERA_POSITION`).
- Note: fog applies to `MeshBasicMaterial` as well, so the checkerboard floor
  recedes correctly without changing its material.

In `style.css`:
- Set `body { background: #cfe3f0; }`. The renderer is created with
  `alpha: true`, so until the gradient texture is built the page shows through,
  and the default is white. This is the fallback for those first frames, not a
  replacement for `scene.background`.

#### Lighting — superseded by `visual/night`
In the `components` directory, add a `Lighting.js` file. This replaces the two
lights currently created inline in `main.js`.
- Export `createLighting()`, returning a `THREE.Group` containing:
  - An `AmbientLight` at intensity `0.35`. Down from `1.5`: the old value was
    doing all the work, which is exactly why nothing in the scene had a shaded
    side.
  - A `HemisphereLight` at intensity `0.5`, sky colour `#4a7fb5` and ground
    colour `#4c8f3a`. This is what replaces the lost ambient — it fills the
    shadowed sides with light that agrees with the sky above and the grass
    below, instead of flat white from everywhere.
  - A `DirectionalLight` at intensity `2.0`, colour `#fff4e0`. Warm against the
    cool fill, so the lit and unlit sides of a model differ in hue and not just
    brightness.
- Position the directional light at an offset of `(-600, -400, 800)` from its
  target. A raking angle, so the shadows have length and read as contact.

#### Shadows
In `Renderer.js`:
- Set `shadowMap.enabled = true` and `shadowMap.type = THREE.PCFSoftShadowMap`.

In `Lighting.js`, on the directional light:
- Set `castShadow = true`.
- Size the shadow camera to `left/right/top/bottom` of `-700 / 700 / 700 /
  -700`, with `near = 1` and `far = 2000`. **Amended from ±400**, which is now
  wrong rather than merely tight: it was sized on the argument that "enemies
  spawn at a radius of 220 and houses are placed within 170", and
  `visual/winter_town` has since moved the houses onto an arc at **480** with
  their plots reaching **605**. A ±400 box misses the entire town, so the five
  houses — the heaviest and most important casters in the scene — would cast
  nothing at all. ±700 matches `WORLD_RADIUS` in `Movement.js`, which is the
  real bound on where anything can be. It is 3.1× the area at the same
  `mapSize`, so expect softer, coarser shadow edges; if that is too coarse,
  raise `mapSize` rather than shrinking the box back.
- Set `shadow.mapSize` to `2048 x 2048`.
- Set `shadow.normalBias = 0.5`. Shadow acne is guaranteed otherwise — this
  world is built at a scale of 80 units per tile, and `normalBias` is the knob
  that scales with the geometry, where a flat `bias` would have to be retuned
  per model.

Because the shadow box is ±400 and Tode can hop twenty squares in any
direction, the light has to travel with him:
- Export `updateLighting(player)` from `Lighting.js`. Each frame, move the
  directional light to the player's position plus the fixed offset above, and
  move `light.target.position` to the player's position.
- Add `light.target` to the lighting group explicitly. A `DirectionalLight`
  aims at its target's *world* position, and that target defaults to the origin
  and is not in the scene graph until it is added — leaving it out means the
  light keeps pointing at the centre of the map and the shadows swing around as
  Tode walks away.
- Call `updateLighting(player)` from the animation loop in `main.js`, outside
  the `isGameOver()` guard, so the Game Over screen stays lit as it is rather
  than going dark on the final frame.

Casting and receiving has to be switched on per mesh. GLTF meshes default to
neither, and a loaded `.glb` is a tree, so each loader callback must traverse:
- `Player.js` — traverse the loaded model, set `castShadow = true` on every
  `Mesh`.
- `Enemy.js` — the same.
- `House.js` — **already done.** `createHouse` traverses the plot and sets both
  flags on every mesh, with a comment saying they are inert until this task
  switches shadows on in `Renderer.js`. Nothing to add.
- `Map.js` — **this instruction is stale and must not be followed.** It
  describes swapping the checkerboard floor's `MeshBasicMaterial` for
  `MeshLambertMaterial`; `visual/river_landscape` removed the checkerboard, the
  `TILE_SIZE` and the floor mesh outright, and `Map.js` now only assembles the
  landscape. The landscape's own material is already a lit
  `MeshStandardMaterial`, so what this section was working around no longer
  exists. The one thing still wanted from it: set `receiveShadow = true` on the
  landscape mesh in `Landscape.js`, since a .glb mesh defaults to receiving
  nothing.

#### Constraints
- The two constraints that stood here about the checkerboard floor — its exact
  greens `#228B22` / `#90EE90`, and keeping `TILE_SIZE` and the pattern as a
  readout of hop distance — are gone with the floor itself. Left in, they would
  send whoever implements shadows looking for a mesh that no longer exists.
- Do not add tone mapping. That part of the original constraint still stands,
  and it stands more firmly now: `visual/night` states its expected rendered
  values as exact sRGB numbers, and a tone map would shift every one of them.
- `alpha: true` stays on the renderer, as specified in `spec.md`.
