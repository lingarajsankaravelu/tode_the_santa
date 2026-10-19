### Specification for AI agent: Atmosphere

Extends the scene described in `spec.md`. The goal is depth and place: the world
should have a sky instead of a blank page, a horizon that fades out instead of a
hard edge, and objects that sit in the light instead of floating on it.

Three things change: the backdrop, the lighting rig, and shadows. They are one
task because none of them reads correctly alone — shadows need a directional
light with a real angle, that angle only looks right against a sky, and the sky
only closes the world if the fog that hides the floor edge is the same colour.

#### Sky and fog
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
  units across, so its far corner sits about 2263 units from the origin: a `far`
  of 2400 dissolves the edge of the world into the sky rather than leaving it
  visible as a straight green cut-off. `near` of 600 keeps Tode and anything
  he is about to collide with completely clear — the camera sits roughly 520
  units from him.
- Note: fog applies to `MeshBasicMaterial` as well, so the checkerboard floor
  recedes correctly without changing its material.

In `style.css`:
- Set `body { background: #cfe3f0; }`. The renderer is created with
  `alpha: true`, so until the gradient texture is built the page shows through,
  and the default is white. This is the fallback for those first frames, not a
  replacement for `scene.background`.

#### Lighting
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
- Size the shadow camera to `left/right/top/bottom` of `-400 / 400 / 400 /
  -400`, with `near = 1` and `far = 2000`. The action is tight: enemies spawn at
  a radius of 220 and houses are placed within 170, so a box of ±400 covers
  everything that matters at full resolution. Sizing it to the whole 3200-unit
  floor instead would spend the entire shadow map on empty grass.
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
- `House.js` — set both `castShadow` and `receiveShadow`, so the houses catch
  each other's shadows and Tode's. Note the model is `clone()`d three times;
  the flags must be set on each clone or on the source before cloning.
- `Map.js` — the floor mesh gets `receiveShadow = true`, and its material must
  change from `MeshBasicMaterial` to `MeshLambertMaterial`, keeping the same
  checkerboard texture as its `map`. `MeshBasicMaterial` is unlit and will
  silently ignore `receiveShadow`, which makes it the one blocker here: without
  this swap, nothing in the game casts a shadow onto anything visible.

#### Constraints
- The floor's two greens (`#228B22` / `#90EE90`) are specified exactly in the
  original `spec.md`, and a lit material will no longer reproduce them
  byte-for-byte. That is accepted — but do not add tone mapping on top of it,
  which would shift every colour in the scene for a change this task does not
  need.
- Keep `TILE_SIZE` and the checkerboard pattern as they are. The floor doubles
  as a readout of hop distance (one square = one 80-unit hop), so this task
  changes how it is lit and nothing about what it shows.
- `alpha: true` stays on the renderer, as specified in `spec.md`.
