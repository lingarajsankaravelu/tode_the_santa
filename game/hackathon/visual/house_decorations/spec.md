### Specification for AI agent: House decorations

Four decorations for the five houses: lights along the front eaves, a star on
the tallest tree in each yard, lanterns along the path to each door, and a
wreath on the door itself.

Depends on `visual/winter_town` for the plots, `visual/night` for there being a
dark scene worth putting lights in, and `visual/christmas_lights` for the
machinery — three of the four are the same `Points` pattern the tree strings
already use, and the fourth is the only thing in this list that needs geometry
built from nothing.

Each is independent and they are listed in the order they pay off. **Implement
them as separate commits**, because the eave lights and the lanterns are a few
dozen lines against known coordinates, the star is almost free, and the wreath
is the one that can turn into an afternoon.

All four are decorative. Nothing goes into the `houses` obstacle list and
`Collision.js` is not touched.

#### What they all share

Build them in **model units** as children of the `plot` group, exactly as
`ChristmasLights.js` does. The plot already carries `MODEL_SCALE = 7.4`, the
Z-up quarter turn and the house's yaw, so model-space coordinates land
correctly on all five plots with no world-space arithmetic. Two consequences
carry over and are easy to forget:

- **`gl_PointSize` ignores the object's scale.** A `PointsMaterial` `size` is
  in world units even though the positions around it are in model units.
- **Model `+Z` is the front of the house.** It transforms to world
  `(-1, 0, 0)` for the house at angle 0, which stands at world `(480, 0)`, so
  `+Z` points at the middle of the map. A negative z offset puts a decoration
  round the back, which is how the snowman spent several commits behind the
  building.

And the pixel-size formula, since all three light tasks need it: on-screen CSS
pixels are `0.5 * size * cssHeight / distance`. three.js leaves the field of
view out of `gl_PointSize` entirely, so this is **2.41× smaller** than the
geometrically correct size at this project's 45°. `Snow.js`'s "around 16
pixels" comment is wrong for that reason; do not size anything by copying it.

Reuse `COLORS` from `ChristmasLights.js` wherever a decoration is a coloured
bulb, rather than restating the four hexes. They came from the house's own
emissive materials and the whole point is that the town agrees with itself.

#### 1. Eave lights

A string along the front edge of the roof. The best value of the four: it is
the decoration people actually notice on a real house, and the geometry is a
straight line.

**The roofline is free, and my earlier claim that it was awkward was wrong.**
`visual/christmas_lights` said this meant picking an edge out of an
80,238-triangle mesh. It does not. `Snow1` — the roof snow, already kept by
`House.js` — is a single mesh of 5,866 vertices whose front edge is flat and
easy to find. Measured, plot-local, model units:

| | Value |
|---|---|
| `Snow1` box | x `-7.66 .. 7.85`, z `-4.57 .. 6.19`, y `1.93 .. 7.89` |
| Front edge (vertices within 0.08 of `z = 6.19`) | 45 vertices, x `-6.76 .. 6.73`, y `3.05 .. 3.49` |
| So the front eave is | **level**, at z `6.19`, y ≈ `3.27`, spanning **100 world units** at a height of **24 world units** |
| The ridge | x `-1.70 .. -1.21`, z `0.32 .. 1.05` — a short hip, not a long gable |

So the eave is one horizontal segment. Do **not** hard-code it: take `Snow1`'s
geometry, select the vertices within an epsilon of `box.max.z`, and use their
x range and mean y. Same reasoning as the trees — the numbers above are for
checking the result, not for pasting.

| Constant | Value | Why |
|---|---|---|
| `EAVE_SPACING` | `9` world units | The same as the tree strings, so one village has one kind of light string. 100 units of eave gives about 12 bulbs. |
| `EAVE_SAG` | `3` world units | Mid-span droop of a hanging string. Without it this is a ruler-straight line of dots, which is the one thing that will make it read as programmer art. Use `sag * sin(π * u)` along the span — a sine is indistinguishable from a catenary at this scale and needs no solving. |
| `EAVE_DROP` | `2` world units | Hangs the string just below the eave rather than exactly on it, so the bulbs are not half-buried in roof snow. |
| `EAVE_OUT` | `1.5` world units | Forward of the eave in `+Z`, for the same reason `BULB_OUTSET` exists. |

Same material as the tree lights, same bulb texture, same twinkle — and
**share them**. Put the eave bulbs in the same geometry as that plot's tree
string if that can be done without contortion: it is one more run of points on
one more string, the colour cycle should continue across it, and
`updateChristmasLights` then covers it for free. If the two must be separate
objects, have `ChristmasLights.js` export the twinkle so there is still one
timer.

The verification that matters: the lights follow the roof edge and sag
slightly, and no bulb is inside the roof snow.

#### 2. A star on the tallest tree

Almost free, and the thing that makes a yard read as decorated rather than
merely lit.

`ChristmasLights.js` already finds every tree's canopy box and already sorts
them tallest-first in `build()`. The tip is `canopy.max.y` of the first tree.
Measured: the tallest tree's top is at model y `7.41`, which is **55 world
units** above the plot — the same height as the house — and it stands at model
`(12.5, 4.4)`.

- One extra point at the tip, in the same geometry as the string.
- `STAR_SIZE = 16` world units, against the bulbs' 7. At the town's distance
  that is 15 px with Tode on the doorstep and 7 px from across the field: the
  brightest single thing in the yard, which is the point.
- Colour `0xfff4d0`, a warm white. Not one of the four `COLORS` — a star that
  is the same red or green as the string is not a star.
- Exempt it from the twinkle, or give it a much slower and shallower one. A
  twinkling star reads as a faulty bulb; a steady one reads as the top of the
  tree.
- Give it its own gradient, or reuse the bulb's. If the star needs to look
  like a star rather than a dot, a four-point gradient drawn into the same
  32px canvas is the cheap version; actual star geometry is not worth it at 15
  pixels.

The one thing to check: it sits **above** the highest bulb, which is at model
y `6.67`. If the star and the top bulb overlap, the canopy box and the string's
`WRAP_TOP` disagree, and the string is the one that is right.

#### 3. Path lanterns

Low lights along the path to each door. These are what make the town look
inhabited at ground level, where everything else in this list is up high.

**This one has a dependency that is not yet built.** `visual/snow_roads`
specifies the road and the spurs and has not been implemented. Its numbers:
`ROAD_RADIUS = 390`, `ROAD_WIDTH = 50`, spurs centred at radius **428.8**,
`SPUR_LENGTH = 34`, `SPUR_WIDTH = 36`, one per house on the house's own angle.

Two ways to go, and the spec picks the second:

- Wait for `snow_roads`, and line the lanterns along the spur edges. Correct,
  but blocked.
- **Build them against the house's own axis now**, which is what the spur is
  derived from anyway. The path runs radially inward from the door, so in
  model space it runs along `+Z` from the façade. That needs nothing from
  `snow_roads` and will still line up when it lands.

| Constant | Value | Why |
|---|---|---|
| `LANTERN_COUNT` | `4` | Two a side. More reads as an airport runway. |
| `LANTERN_SPACING` | `26` world units | Along the path, starting 20 units out from the façade, so the furthest is 98 out — short of the road's inner edge at 365, which is 78 units from the façade. They line the path without standing in the road. |
| `LANTERN_OFFSET` | `±13` world units | Either side of the house's axis, which keeps them clear of a 36-wide spur by a few units. |
| `LANTERN_HEIGHT` | `11` world units | Head height for a path light, and the same height as the door centre. |
| `LANTERN_SIZE` | `9` world units | Between a bulb and the star. |
| `LANTERN_COLOR` | `0xffcc77` | The window amber from `visual/night`, deliberately — a lantern is a lamp, not a Christmas bulb, and matching the windows is what makes it read as the house's own light. |

**Measure against the snowman before placing these.** It stands at model
`(3.8, 10.8)`, which is 26 world units off the façade and 28 to one side of the
axis — so the first pair of lanterns is in its neighbourhood. A lantern inside
the snowman is the obvious failure here.

A real improvement over bare points, if it is cheap: a very dim `PointLight` at
one lantern per plot would put a pool of warm light on the snow and is the
single most atmospheric thing available in this whole list. It is also the
first light in the game outside the global rig, which is why
`visual/christmas_lights` ruled it out. Try it as a last step with a measured
`distance` and `decay`, against `visual/night`'s colour table, and drop it
without argument if it lifts the night.

#### 4. A wreath on the door

The only one needing real geometry, and the only one that can go wrong in a way
that is hard to back out of. Do it last.

The door exists as a named node. Measured, plot-local:

| | Value |
|---|---|
| `Door` node | x `-2.82 .. -0.87`, z `3.26 .. 3.56`, y `-0.10 .. 2.96` |
| Centre | model `(-1.84, 3.41)`, world height **11** |
| World size | **14 × 23 × 2** — about 38 by 62 inches, a real door |
| Materials | `WoodAdditional`, `Glass` |

Note that the façade is at z ≈ `3.4`, **not** at the house box's `z = 6.65`.
That 6.65 is something in front of the building — a porch or step — and
assuming it was the wall would hang the wreath three model units out in the
air. Find the door by name and measure it; do not derive it from the house box.

- `THREE.TorusGeometry(radius, tube, 8, 24)` — 8 radial segments, not 16. The
  rest of this town is flat-shaded low-poly and a smooth torus will look
  imported.
- `WREATH_RADIUS = 4.5` world units, `WREATH_TUBE = 1.2`. That is a 9-unit
  wreath on a 14-wide door, which is the right proportion.
- Centre it at the door's x and z, at **model y 2.2** — the upper third of the
  door, where a wreath hangs — with the torus rotated to lie in the façade
  plane (its default plane is XY and the façade is XY in model space, so the
  rotation needed is none; verify rather than assume).
- Push it `+Z` by `WREATH_TUBE` so it rests against the door rather than
  through it.
- `MeshStandardMaterial`, `0x2f6b3f` — the `PINE` green from
  `generate_river_landscape.mjs`, so the wreath matches the conifers. Roughness
  1, metalness 0, `flatShading: true`.
- Berries: four to six tiny emissive spheres, `0xfd0000`, radius `0.8` world
  units, spaced around the ring. `emissive` rather than lit, so they read at
  night like the windows do. This is the detail that makes it a Christmas
  wreath rather than a green ring.
- A bow is out of scope. There is no cheap bow.

#### Constraints

- Nothing is an obstacle, nothing joins `houses`, `Collision.js` is unchanged.
- Everything is a child of `plot`, in model units, and is therefore immune to
  `TOWN_RADIUS`, `TOWN_SPREAD_DEGREES` and `MODEL_SCALE` changing.
- The star and the eave lights should ride `ChristmasLights.js`'s shared
  geometry if they can. The town currently draws its 214 bulbs per plot from
  one buffer, and five plots twinkling from one update is the property worth
  keeping.
- Triangle budget: the wreath is the only one with any. A torus at 8 × 24 is
  384 triangles and six berries at low subdivision about 500, so roughly 900
  per house and 4,500 for the town, against the town's current 453,000. The
  three light tasks add vertices, not triangles.
- Do not add shadows to any of this. `skeleton/atmosphere` owns shadows and
  still needs its `±400` shadow camera corrected to `±700` before anyone
  implements it.

#### Verification

1. All four read correctly from across the field at 480 units, which is where
   the town is actually seen from. Anything that only works with Tode on the
   doorstep is mis-sized.
2. The eave string follows the roof edge, sags slightly, and has no bulb buried
   in roof snow.
3. The star is above the topmost tree bulb, is the brightest thing in the yard,
   and does not twinkle.
4. No lantern intersects the snowman at model `(3.8, 10.8)`, and none stands
   further out than 98 world units from the façade.
5. The wreath is on the door's own plane at z ≈ `3.5`, not floating at the
   house box's `6.65`, and its berries are visible at night.
6. One `BufferGeometry` for the lights of each plot if they were shared, and
   `renderer.info.memory.geometries` does not climb by five per decoration.
7. Frame rate unchanged.

#### Research

Three of these four exist because `visual/night` turned the lights down. That
is worth stating plainly as a pattern: the single highest-value change in this
project so far was not adding content, it was making the scene dark enough for
the content that was already there to be visible. The seven lit window panes
had been in the model through the whole winter-town task, and the snowman's
carrot nose and bucket hat had been discarded by name.

The open question is whether the town is now over-decorated. Five plots will
carry 214 tree bulbs, 12 eave bulbs, a star, four lanterns, a wreath, lit
windows and twelve house bulbs each. There is a point at which a village of
five cottages reads as a shopping centre, and the honest test is a screenshot
from Tode's starting position rather than a count. If it is too much, the eave
lights and the star are the two to keep: they are the ones that read at
distance.
