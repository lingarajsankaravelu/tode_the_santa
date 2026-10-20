### Specification for AI agent: Night

Moves the game to night, which is when the story happens: `game_story.md` has
Tode delivering Christmas presents to five houses, and Santa delivers on
Christmas Eve. Every other winter task so far has been building the set for a
scene that is lit like a summer afternoon.

It is also the task with the best return in the project, for a reason that only
turned up on inspection of the asset — see "The house is already lit" below.

#### What is actually there now

Worth stating plainly, because three of these are not what the existing specs
describe:

- **There is no sky.** `Renderer.js` is created with `alpha: true`, `style.css`
  sets no `background`, and nothing assigns `scene.background`. The game is
  played against the browser's default **white page**. Night makes this the
  first thing anyone notices.
- **`Sky.js` does not exist**, although `Snow.js:58` refers to it in a comment
  as if it does. This task creates it and makes that reference true.
- **The lights are inline in `main.js`** — `AmbientLight` at 1.5 and
  `DirectionalLight` at 1.5, offset `(-100, -100, 200)`. There is no
  `Lighting.js`.
- `Camera.js` now has `NEAR_PLANE = 10` and `FAR_PLANE = 9000`, and the camera
  sits **409** units from Tode (`CAMERA_POSITION` is `(260, -260, 180)`).

**This spec supersedes the Sky and Lighting sections of
`skeleton/atmosphere/spec.md`.** That file specifies a daylight gradient
(`#4a7fb5` over `#cfe3f0`), a hemisphere light with a *grass green* ground
colour, and a warm directional at intensity 2.0. All of it is a day rig, and its
ground colour refers to a lawn that no longer exists. Its shadow section is left
alone and still owns shadows — see "Out of scope".

Two further things in that file are stale and should be corrected there rather
than inherited here: its `Map.js` instructions describe a checkerboard of
`MeshBasicMaterial` with a `TILE_SIZE`, which `visual/river_landscape` replaced
outright, and it states the camera sits "roughly 520 units" from Tode, which is
now 409.

#### The house is already lit

**Do not add lit windows. They are in the model, and they have been invisible
this whole time because the scene is too bright to see them.**

`winter_country_house.glb` carries five emissive materials, all of them inside
the `House` group that `House.js` already keeps:

| Material | `emissiveFactor` | Pieces | Triangles | What it is |
|---|---|---|---|---|
| `Glass` | `[1, 1, 0]` | 7 | 56 | the windows |
| `RedLight` | `[0.98, 0, 0]` | 4 | 32 | a bulb |
| `BlueLight` | `[0.04, 0, 1]` | 4 | 32 | a bulb |
| `YellowLight` | `[0.84, 0.84, 0]` | 2 | 16 | a bulb |
| `GreenLight` | `[0, 0.63, 0]` | 2 | 16 | a bulb |

19 pieces and 152 triangles out of the house's 80,238 — so this costs nothing.
The seven glass panes span **62 × 59** world units across the walls at heights
**21.8 to 48.3** on an 80-unit house: real windows, at eye level, and they will
read clearly from across the field. Emissive is not affected by lights, so
against a night scene whose brightest snow is around 140 they will be the
brightest thing in the frame by a wide margin.

Five houses on an arc with their windows lit, seen across open snow, *is* the
story. It arrives for free.

Two honest notes:

- **The four coloured bulbs are tiny.** Each is 1.8 × 3.4 × 0.3 world units,
  which at a 45° field of view works out at about 5 pixels with Tode on the
  doorstep and 2 to 3 from across the field. They are a sparkle, not a light
  display. Do not build the task around them.
- **Retint `Glass`.** `[1, 1, 0]` is pure saturated yellow and reads as a
  warning lamp rather than a lit room. Set `material.emissive` to a lamp amber
  of `0xffcc77`. Remember that `THREE.Color` converts sRGB to linear on input,
  which is correct here and is the trap recorded in `repo_knowledge.md` §7 —
  pass the hex, do not pre-convert it.
- Do this **once on the loaded source**, not per clone. `gltf.scene.clone()`
  shares materials, so setting it in the per-house traverse would do the same
  work five times.

#### Sky and fog

In the `components` directory, add `Sky.js`:

- Export `createSkyTexture()`, returning a `THREE.CanvasTexture` holding a
  vertical two-stop gradient: `#060b18` at the top, `#1d2b47` at the horizon.
  A `2 × 256` canvas is enough — it stretches across the backdrop, so only the
  vertical axis carries information.
- Set `colorSpace = THREE.SRGBColorSpace`, or the gradient washes out.
- Export `HORIZON_COLOR = 0x1d2b47` as a named constant. The fog and the CSS
  fallback both have to match it, and three copies of one hex drifting apart is
  the failure mode here.

The horizon is deliberately **lighter** than the zenith, and more so than a
clear night sky would be. Snow throws a great deal of light back up, and a
snowfield at night has a visible glow along its horizon. It is also what keeps
the mountains readable as distance.

In `main.js`: assign the texture to `scene.background` and add
`scene.fog = new THREE.Fog(HORIZON_COLOR, 600, 2300)`.

- `far = 2300`: the landscape is 3280 units across, so its far corner is 2319
  from the origin. Dissolving at 2300 hides the edge of the world in the sky
  instead of leaving it as a straight cut-off.
- `near = 600`: must clear the camera's 409 units to Tode, or he fogs. It also
  leaves the town unfogged as he approaches it — the nearest house wall is 443
  from the origin.

In `style.css`: `body { background: #1d2b47; }`. With `alpha: true` the page
shows through until the texture exists, and the default is white — which at
night is a white flash on load. This is the fallback for those frames, not a
replacement for `scene.background`.

#### Lighting

Add `Lighting.js`, exporting `createLighting()` and returning a `THREE.Group`.
It replaces both lights currently inline in `main.js`.

**Two lights, not three.** No `AmbientLight`: flat light from every direction is
what the day rig used to do all its work, and it is the one thing that cannot
look like night. A hemisphere fill and a moon is the whole rig.

| Light | Value | Why |
|---|---|---|
| `HemisphereLight` sky | `#16243d` | The night sky, which genuinely lights very little. |
| `HemisphereLight` ground | `#93a7c4` | Moonlight bouncing back off the snow. This is the replacement for the grass-green ground colour in the day spec, and it is what keeps undersides readable. |
| `HemisphereLight` intensity | `0.6` | |
| `DirectionalLight` colour | `#d6e4ff` | The moon: cool, so lit and shadowed sides differ in hue and not only in brightness. |
| `DirectionalLight` intensity | `1.0` | |

Keep the existing `(-100, -100, 200)` offset direction for the moon. It is a
reasonable raking angle and changing it is a separate argument.

**The arithmetic, so this can be checked without opening a browser.** three.js
r181 computes diffuse as `irradiance × albedo / π`; the snow bed's albedo is a
flat linear white, and the moon's direction gives `dot(N, L) = 0.8165` on a
level surface:

| Surface | Rendered sRGB |
|---|---|
| Snow, moonlit and level | **rgb(117, 133, 142)** |
| Snow, vertical and facing away from the moon | **rgb(47, 55, 68)** |
| An underside, lit only by bounce off the snow | **rgb(67, 72, 91)** |

Three properties of that table are the point of these numbers:

1. **The lit snow is around 130**, against about 239 today. Dim enough to be
   night, bright enough to play on.
2. **Shadow is 2.5× darker than light, and bluer** — blue/red is 1.45 in shadow
   against 1.21 in light.
3. **The underside is brighter than a shaded vertical face** (67 against 47),
   because snow bounces light upward, but well below the moonlit top. Get this
   backwards — a hemisphere ground colour that is too strong — and the scene
   lights from below and reads as uncanny rather than dark.

#### What must not change, and why

**The snow's albedo stays pure white `0xffffff`.** This matters more than it
looks, and it is the one instruction most likely to be "improved" by whoever
implements this.

`visual/snow_ground` went through two passes of tinting the snow a cool white
over a blue-grey hollow, on the correct observation that snow in shadow is blue.
It was then deliberately reverted to flat white to match the house roof. Night
is what vindicates that: **blue shadows are a property of the light, not of the
snow.** The table above produces them from a cool moon and a cool sky fill
acting on a white albedo. Tint the albedo blue as well and the two multiply —
the night tint is applied twice, and the ground goes muddy and over-saturated
while losing the contrast that makes it read as snow at all.

White albedo under coloured light is right. Coloured albedo under coloured light
is the same mistake twice.

#### Snowfall has to be dimmed by hand

`Snow.js` uses a `PointsMaterial`, which is **unlit**. Every other surface in the
game darkens when the lights come down; the 900 flakes will not. Left alone they
stay at `opacity: 0.85` of a white gradient against a near-black sky, which is
the brightest thing in the scene after the windows and reads as static.

- Set the material's `color` to `0xaebfd6` — flakes take the moonlight like
  everything else.
- Drop `FLAKE_OPACITY` from `0.85` to `0.55`.
- Leave `FLAKE_COUNT`, `FLAKE_SIZE` and the whole band geometry alone. Those
  numbers are a function of the camera's height, pitch and field of view, which
  this task does not touch, and `Snow.js` says so at length.

#### Smaller consequences, all worth checking

- **The water becomes the one glint in the scene.** Its material is
  `metallicFactor 0.05, roughnessFactor 0.15` — far smoother than anything else
  — so it will catch a moon specular where the matte snow cannot. This is a
  gift, not a problem. Leave it.
- **Tode must stay readable.** He is lit by the same rig as everything else, and
  the hemisphere ground bounce is what keeps his underside off black. Check him
  against the snow before adding anything; if he genuinely disappears, the fix
  is a single dim warm `PointLight` parented to the player group, not a general
  lift of the rig, which would undo the night.
- **The mountains keep `SNOW = 0xf2f4f7` against the ground's `0xffffff`.** Both
  take the same light, so that relationship survives the change untouched.
- **`.game-over`'s `rgba(0, 0, 0, 0.6)` overlay** has far less to darken now.
  Raise it to `0.75` or the dimmed scene still shows through the text.
- **`.score` is `#ffffff` with a dark text shadow** and needs nothing.
- Enemy spawning is currently off behind `SPAWN_ENABLED` in `Enemies.js`,
  unrelated to this task. Turn it back on to judge how the monsters read at
  night, which is a real question this task cannot answer on its own.

#### Out of scope

- **Shadows.** `skeleton/atmosphere` owns them and should keep them. But that
  spec needs a correction before it is implemented, and this is the place it was
  found: its shadow camera is sized `±400` on the argument that "enemies spawn
  at a radius of 220 and houses are placed within 170". Houses are now on an arc
  at **480** with plots reaching **605**. A `±400` box misses the entire town,
  so every house would cast nothing. It wants `±700` to match `WORLD_RADIUS`,
  with the resolution cost that implies.
- **Bloom.** Lit windows against a dark scene is exactly where a bloom pass
  earns its keep, and it is the obvious next thing to want. It also means
  introducing `EffectComposer` and a post-processing chain to a game that
  currently renders in one call, which is its own task.
- **A moon in the sky.** The gradient has no disc in it. Drawing one is cheap
  and placing one consistently with the directional light's angle is not.
- **Time of day as a variable.** This is night, fixed. Nothing here should take
  a parameter.

#### Verification

1. No white flash on load — `body` is dark before the first frame renders.
2. The sky is a gradient, and the far edge of the landscape dissolves into it
   rather than ending on a line. Check the corners specifically: 2319 units
   against a fog `far` of 2300 is deliberately tight.
3. Five houses with lit windows, visible from across the field. If they are not
   obvious, the emissive retint did not take — check it was applied to the
   shared source material and not to a clone.
4. Moonlit snow lands near rgb(117, 133, 142) and shaded snow near
   rgb(47, 55, 68). A screenshot and a colour picker settle this; it is the
   quickest way to tell a correct rig from one that merely looks dark.
5. Nothing lights from below. If undersides are brighter than tops, the
   hemisphere ground colour or its intensity is too strong.
6. The snowfall reads as snow and not as static.
7. Tode is clearly visible against the snow at every point in a hop.

#### Research

The emissive materials in the house are a reminder worth generalising: this
asset was inspected twice before — once for the diorama inventory, once for the
specular-glossiness conversion — and both times the material list was read for
*colour* and the `emissiveFactor` column went unnoticed. The windows were
sitting in the file through the whole winter-town task. When a model is
inventoried, the lighting properties deserve a column of their own.

The open question is whether night wants the rest of the scene rebalanced. The
palette in `generate_river_landscape.mjs` was chosen for daylight: `EARTH`,
`ROCK` and `SAND` are mid-tone minerals picked to sit under a white snow bed in
a bright scene, and under a moon they may all collapse into the same near-black.
If they do, the fix is in the generator rather than the lighting, and it is a
colour pass of its own — not a reason to lift the rig and lose the night.
