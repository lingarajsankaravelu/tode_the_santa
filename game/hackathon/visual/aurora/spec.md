### Specification for AI agent: Aurora borealis

The northern lights over the valley. A band of moving colour above the
mountains, there for the whole run, and the reason the ceiling moved.

> **Written after the open world, not before it.** This task would have been
> decoration three commits ago. `Movement.js` now holds `MAX_ALTITUDE = 900`
> and `WORLD_RADIUS = 1600`, up from 400 and 700, because `Terrain.js` can
> answer where the ground is and the sleigh was let out over the hills. The
> note that used to justify the old ceiling said that past 400 "the ground
> leaves the frame and the player is flying over an empty backdrop". Flying up
> is now a thing the player can do, and that sentence is the problem this spec
> exists to solve: **give the top of the world something to be.**

#### What is actually there now

- **`Sky.js` is a two-stop vertical gradient**, rendered into a 2 x 256 canvas
  and assigned to `scene.background`. `ZENITH_COLOR = 0x060b18` over
  `HORIZON_COLOR = 0x1d2b47`, uploaded as `SRGBColorSpace`.
- **`HORIZON_COLOR` has three consumers and `Sky.js` says so in its header**:
  the gradient's lower stop, `scene.fog` in `main.js`, and the `body`
  background in `style.css`. It is the single source of truth for where the sky
  meets the ground. **Do not touch it.** The aurora goes above the horizon, not
  at it, and nothing in this task has a reason to change that colour.
- `scene.fog = new THREE.Fog(HORIZON_COLOR, 600, 2300)` in `main.js`.
- `Camera.js`: `NEAR_PLANE = 10`, `FAR_PLANE = 9000`, 60-degree default FOV,
  sitting 409 units behind the sleigh and 26 degrees above it, free to orbit on
  the mouse.
- `Renderer.js` sets **no tone mapping and no explicit output colour space**,
  so it is three.js's defaults: `NoToneMapping` and `SRGBColorSpace`. An
  additive colour written in the shader is close to the colour that lands on
  screen, and there is no exposure control to balance it against.
- `Lighting.js` puts the moon — a `DirectionalLight`, `MOON_COLOR = 0xd6e4ff`
  at intensity 1.0 — at `(-100, -100, 200)`, which is the **south-west** sky.
- `Snow.js` keeps its flakes in a box that follows the player, so snowfall
  always passes in front of whatever the backdrop is doing.

#### Which way is north, and why it matters

The aurora is a polar phenomenon and should not be in an arbitrary part of the
sky. There is a correct answer available, from the landscape generator:

`tools/generate_river_landscape.mjs` puts its main range of 14 peaks at model
`z = -SIZE - rng(1.5, 7)`, and `Landscape.js` tips the model by
`rotation.x = PI / 2`, which sends model `(x, y, z)` to world `(x, -z, y)`. So
model `-z` is world **+Y**: the fourteen-peak range runs along the **+Y
horizon**, at a radius of 1702 to 1927 and about 435 units tall. The second,
seven-peak range is along +X.

**The aurora belongs over +Y**, behind the big range. Two things fall out of
that for free: it reads as "over the mountains" rather than floating in open
sky, and it is on the opposite side of the valley from the moon, so the
brightest thing in the sky and the second brightest are never in the same
frame fighting each other.

#### Why this cannot be done in `Sky.js`

The obvious move is to paint the aurora into the gradient canvas and animate
the canvas. It does not work, for three separate reasons, and it is worth
recording all three because each one alone would be arguable:

1. **`scene.background` has no perspective.** A background texture is drawn
   flat across the frame. It does not move when the camera orbits, does not
   shift when the sleigh climbs 700 units, and cannot sit *behind* the
   mountains. The aurora would be a sticker on the lens.
2. **It would cost a full canvas redraw and texture upload every frame.** The
   gradient is 2 x 256 because only the vertical axis carries anything; an
   aurora needs horizontal detail, so the canvas would have to grow by two or
   three orders of magnitude and be re-uploaded at 60Hz.
3. **The gradient is the one asset-free thing holding the horizon together.**
   Three consumers agree on `HORIZON_COLOR`, and adding an animated second
   concern to that file is how that agreement gets broken by accident.

So the aurora is **geometry in the scene**, and `Sky.js` is left exactly as it
is. The gradient stays the sky; the aurora is drawn over it.

#### The shape

A **cylindrical shell**, open at both ends, seen from the inside. Not a plane
and not a dome:

- A **plane** has to be turned to face the camera or it foreshortens into a
  line, and the camera orbits freely on the mouse. A billboarded plane is a
  sticker again.
- A **dome** puts aurora directly overhead, where the default 26-degree camera
  pitch never looks, and spends most of its triangles on sky that is never in
  frame.
- A **shell** is right because the thing is a curtain: it hangs vertically,
  wraps part of the horizon, and looks correct from any yaw the mouse can
  reach.

| Constant | Value | Why |
|---|---|---|
| `RADIUS` | `2600` | Outside the 1640-unit edge of the landscape, so it rises from *behind* the mountain ranges at 1702-1927 rather than in front of them. Far outside `WORLD_RADIUS = 1600`, so the sleigh can never reach it, let alone fly through it. Well inside `FAR_PLANE = 9000`. |
| `BASE_Z` | `650` | The bottom of the band. Chosen against `MAX_ALTITUDE = 900`: at the ceiling the player is *level with the base of the aurora*, which is the whole reward for climbing. Also clears the 575-unit terrain peak, so the band never appears to grow out of a hillside. |
| `TOP_Z` | `2300` | A band 1650 tall at a radius of 2600 subtends about 32 degrees, so it fills the upper half of the frame without wrapping over the top of it. |
| `ARC_DEGREES` | `200` | Centred on +Y. More than half the horizon, so turning to look at it is rewarded and turning away from it still leaves colour at the edge of the frame; less than the full circle, so the valley has a dark side and the band has visible ends. |
| `RADIAL_SEGMENTS` | `160` | Across 200 degrees that is a segment every 1.25 degrees. The curtain's folds are a fragment-shader effect, so this only has to be fine enough that the silhouette does not polygonise. |
| `HEIGHT_SEGMENTS` | `1` | **One.** Nothing in the vertex stage varies with height — the vertical gradient and the rays are both computed per fragment — so extra rows would be 160 triangles each for no change in the image. |

160 x 1 segments is **640 triangles in one draw call**, against the sleigh's
99,163 and a gift's 123,440. The cost of this task is entirely in the fragment
shader, which is addressed below.

Build it as a `THREE.CylinderGeometry` with `openEnded: true` and a
`thetaLength` of `ARC_DEGREES`, then tip it with `rotation.x = Math.PI / 2`
like every other model in this Z-up game, and `rotation.z` to centre the arc on
+Y. Parent it to the **scene, not the player** — this is the same trap
`gift_delivery/spec.md` keeps repeating about the camera being a child of the
player group. The aurora is 2600 units out; if it travelled with the sleigh it
would be the one object in the world with no parallax, which is exactly the
sticker problem the shell exists to avoid.

#### The material

A `THREE.ShaderMaterial`, and every flag below is load-bearing:

| Setting | Value | Why |
|---|---|---|
| `transparent` | `true` | |
| `blending` | `THREE.AdditiveBlending` | Aurora is emitted light, not a surface. Additive over the `0x060b18` zenith is what makes it glow rather than sit on the sky like gauze. It also means the shader never needs a sensible alpha — brightness *is* the alpha. |
| `depthWrite` | `false` | Standard for additive: two overlapping fragments of the same band must both contribute. |
| `depthTest` | `true` | **Kept on**, so a mountain in front of the band still occludes it. At a radius of 2600 that is the correct and only relationship it has with the terrain. |
| `side` | `THREE.BackSide` | The camera is inside the cylinder. |
| `fog` | `false` | **The one that will be forgotten.** `scene.fog` ends at 2300 and the shell is at 2600, so a fog-aware material would render the aurora as flat `HORIZON_COLOR` — a dull blue-grey band, which is a bug that looks like a design choice. `ShaderMaterial` does not get fog unless asked, so this is a matter of not adding it, but say it in a comment or someone will. |

#### What the shader draws

Asset-free, like `Sky.js`'s gradient and `Snow.js`'s flake. No texture.

Pass `vUv` through from the vertex stage; on an open-ended cylinder `uv.x`
walks the arc and `uv.y` runs from the base to the top.

Four terms, multiplied and added in this order:

1. **Curtain folds.** Value noise in `uv.x` only, two or three octaves,
   scrolling in `uv.x` with time. This is the term that makes it an aurora
   rather than a glowing band: it decides where the curtain is bright and where
   it has thinned to nothing. Build it from a hash-free `sin`-based value noise
   — a dot-product hash into `fract(sin(...))` is the usual one-liner and is
   fine here, because the artefacts it is notorious for show up at high
   frequency and this noise is deliberately low.
2. **Vertical falloff.** Brightest near the base, fading to zero by the top.
   `pow(1.0 - uv.y, 2.2)` or similar. Real aurora is brightest at its lower
   edge, where the curtain is densest, and a band that fades *upward* is the
   single strongest cue that it is hanging rather than painted. Fade the bottom
   few per cent too, so the base is a soft edge and not a cut line.
3. **Rays.** A higher-frequency noise in `uv.x`, stretched hard in `uv.y`, so
   it reads as vertical streaks. Scrolled at a different rate from the folds,
   which is what stops the whole band moving as one rigid object.
4. **Colour.** Mix along `uv.y`, not along the folds: `AURORA_LOW` at the base
   through `AURORA_HIGH` at the top.

| Constant | Value | Why |
|---|---|---|
| `AURORA_LOW` | `0x3cf0a0` | The green of atomic oxygen at 557.7nm, which is the colour everyone means by "northern lights". Kept bright and slightly blue of pure green so it reads as light rather than paint. |
| `AURORA_HIGH` | `0x7a4cff` | The violet-magenta upper fringe. Two hues rather than one is the difference between an aurora and a green stripe, and this is also the pair that sits best over `ZENITH_COLOR = 0x060b18`. |
| `FOLD_SPEED` | `0.035` | Slow. The band should be *noticeably* different thirty seconds later and never visibly crawl while the player is looking at it. |
| `RAY_SPEED` | `0.085` | Faster than the folds, for the reason in (3). |
| `BRIGHTNESS` | `0.55` | Peak additive contribution. Under 1 on purpose: there is no tone mapping in `Renderer.js`, so a term of 1.0 over the sky gradient clips to white and the two hues are lost exactly where the band is brightest. **Tune this first if it looks wrong.** |

Advance the time uniform from the module's **own `THREE.Clock`**, the way
`Snow.js`, `Score.js`, `Animation.js` and `Movement.js` each own theirs rather
than taking a delta from the render loop. Clamp the delta to `0.1` like
`Movement.js` and `Animation.js` do — not because a jump would break anything
visible, but because every other timed system here does it and the one that
does not is the one that gets debugged later.

#### Performance

The honest risk in this task is **fill rate, not triangles.** 640 triangles is
nothing; a band covering a third of the screen with a three-octave noise in the
fragment stage, at `devicePixelRatio` on a retina display, is not nothing.

- Keep the octave count at **three or fewer**. The folds are low-frequency by
  design, so a fourth octave contributes detail the band's own softness hides.
- The shell is `BackSide` and `openEnded`, so it is never drawn twice per
  pixel.
- `Renderer.js` calls `setPixelRatio(window.devicePixelRatio)` with no cap. If
  this task turns out to cost frames on a 3x display, **that line is the
  bigger lever and it is out of scope here** — note it and leave it.

#### Wiring

A new `Aurora.js` in `game/src/components/`, exporting `createAurora()` and
`updateAurora()`, following `Snow.js` — which is the closest existing module:
asset-free, scene-level, one object, its own clock, one update call per frame.

- `scene.add(createAurora())` in `main.js`, next to the snow.
- Call `updateAurora()` from the render loop **outside** the `isGameOver()`
  guard. The same reasoning `main.js` already applies to the snow, the lights
  and the smoke: the sky does not stop because the run ended, and a band of
  aurora freezing on the Game Over frame would read as part of the failure.
- Nothing to reset on restart. It has no state but its clock, and that clock
  should keep running across a restart for the same reason it keeps running
  across a Game Over.

#### Constraints

- **`Sky.js` is not modified**, and `HORIZON_COLOR` especially is not. The
  gradient is still the sky.
- **No second light.** It is tempting to add a faint green light to throw the
  aurora's colour onto the snowfield, and that is a real effect, but
  `Lighting.js` owns a balanced two-light night rig and this task has no
  business in it. If it is wanted later it is its own task.
- **Nothing the player can collide with.** The shell is at 2600 and
  `WORLD_RADIUS` is 1600. It carries no collider and is not in any obstacle
  list.
- **No ground reflection.** Aurora on the snow is a separate, larger task
  (it needs either a second surface or a shader on the landscape) and is not
  smuggled in here.
- The band must not be reachable, enterable, or occluded by the snowfall
  box — `Snow.js`'s flakes pass in front of it, which is correct.

#### What this does not do

It does not light the valley, reflect, or interact with the flight model
beyond being the thing worth climbing towards. `MAX_ALTITUDE = 900` is already
set in `Movement.js`, so no change there is part of this task.
