### Specification for AI agent: Christmas lights

Strings fairy lights through the conifers in every house's yard, so the five
plots read as decorated for Christmas Eve rather than as five winter cottages
that happen to have trees.

Depends on `visual/winter_town`, which puts the trees in the yards, and on
`visual/night`, which is what makes this worth doing at all — under the old day
rig a coloured bulb against snow rendering at 239 has nothing to be brighter
than. It is the second task to collect on that: `visual/night` found seven lit
window panes already sitting in the model, and this adds the one decoration the
asset does *not* already carry.

Purely decorative. The lights are parented inside each plot and must **not** go
into the `houses` obstacle list, and `Collision.js` must not learn about them.

#### What is already there, and why these must agree with it

`winter_country_house.glb` carries twelve small coloured bulbs on the house
itself, on four emissive materials that `visual/night` left alone:

| Material | `emissiveFactor` (linear) | As sRGB |
|---|---|---|
| `RedLight` | `[0.9815, 0, 0]` | `0xfd0000` |
| `BlueLight` | `[0.0410, 0, 1]` | `0x3900ff` |
| `YellowLight` | `[0.8413, 0.8413, 0]` | `0xecec00` |
| `GreenLight` | `[0, 0.6267, 0]` | `0x00cf00` |

**Use exactly these four colours, in this order, repeating.** Not a palette
chosen for this task: the house already has bulbs in these colours, and a
string in four different ones would read as two unrelated decorations on the
same plot. Repeating in a fixed cycle rather than picking at random is also the
point — a real light string alternates in a manufactured pattern, and random
colours along the wire read as confetti.

Each bulb's colour is `COLORS[index % 4]` over the whole plot's string, not
restarted per tree, so the cycle carries across from one tree to the next the
way one long wire would.

#### The trees, measured

`Trees1` holds 22 conifers and six clusters of pinecones (`Shishki`, 3–6 world
units tall), in a stand about 89 × 123 world units sitting (66, 72) from the
house. Measured from the file, at `MODEL_SCALE = 7.4`:

| | World units |
|---|---|
| Trees | **22** |
| Tree height | 35 to 71, mean 41 |
| Canopy height (the lit part) | 19 to 54 |
| Canopy radius | 4.2 to 11.2 |
| Trunk below the canopy | 20% to 41% of the tree |

That last row is the reason this task cannot simply wrap each tree's bounding
box: between a fifth and two fifths of every tree is bare trunk, and a helix
starting at the box's base would hang its first turns on thin air below the
lowest branches.

#### Derive the trees at load time; do not paste a table of 22

The positions above are stated so the result can be checked, **not** to be
typed into the source. Work them out from the model, in `createHouses`, once:

1. Walk `Trees1` and collect every descendant that has a mesh, with its own
   world `Box3` (`new THREE.Box3().setFromObject(mesh)`).
2. **Cluster those boxes by their XZ centre**, merging any two within `1.0`
   model units. This is the step that does the real work. The group's own child
   list is not one node per tree — three of its children are clusters of eight
   meshes covering several trees each, and conversely a single tree is often
   three or nine separate meshes (a trunk, and two or three canopy tiers with
   their own names). Clustering on position is what recovers "one tree".
3. Drop any cluster under **30 world units** tall. This removes the six
   `Shishki` pinecone clusters and nothing else — the shortest real tree is 35
   and the tallest pinecone cluster is 6, so the threshold sits in a wide gap
   and is not delicate.
4. Within each cluster, the **canopy** is the union of the boxes whose girth is
   at least half the cluster's own girth. The excluded part is the trunk, which
   is between a fifth and two fifths of the height and a tenth of the width.
   Wrap the canopy box, not the tree box.

Verified against the asset: this yields exactly 22 trees, and the canopy
heights, radii and trunk fractions in the table above.

Deriving beats pasting here for a specific reason, not on principle: the stand
is one cluster the artist modelled by hand, with trees at four different
heights and no grid to it, and a hand-typed table of 22 rows would be checked
once and then be wrong the first time anyone touches the model.

#### The string

A helix up each canopy, sampled at even arc length.

| Constant | Value | Why |
|---|---|---|
| `BULB_SPACING` | `9` world units | Along the wire. About 24 inches at this project's scale, which is a real string's spacing, and it keeps bulbs 8 px apart on screen at the furthest the town is ever seen from (see the table below). |
| `HEIGHT_PER_TURN` | `12` world units | Turns are **not** a fixed count. One turn per 12 units of canopy gives 1.6 turns on the shortest tree and 4.5 on the tallest, so every tree is wrapped at the same pitch instead of the short ones looking strangled and the tall ones barely laced. |
| `MIN_TURNS` | `1.5` | Below this the string reads as a stripe down one side rather than as wrapped. |
| `WRAP_TOP` | `0.88` | Fraction of the canopy climbed. Stopping short of the tip matters — see the snow caps below. |
| `BULB_OUTSET` | `1.5` world units | Pushes the helix just outside the needles. At zero the bulbs sit exactly on the cone and half of each sprite is swallowed by the geometry it is lying against. |

Radius at a height fraction `u` is `canopyRadius * (1 - u) + BULB_OUTSET`, and
height is `canopyBase + u * canopyHeight`, with `u` running from 0 to
`WRAP_TOP`. The angle is `u * turns * 2π`.

Space the bulbs by **arc length, not by `u`**. A cone's helix is much longer per
unit of height at the bottom than at the top, so stepping `u` evenly bunches the
bulbs towards the tip. Integrate the curve numerically — a few hundred samples
is ample and it runs once — then place bulbs at even distances along it.

This gives **5 to 22 bulbs per tree and 214 per plot**, so 1,070 bulbs across
the town. Against the town's 252,390 triangles that is nothing, and the wiring
below draws it in five calls.

**Five trees carry snow caps, and that is not a bug to chase.** The `Snow`
group that `House.js` keeps has six children; five of them are caps sitting on
specific trees, covering the upper 50–60% of the canopy at radii of 4.5 to 6.5
world units. On those trees the topmost bulb or two will be behind snow. That
is what a bulb under snow does. Do not inflate `BULB_OUTSET` to force them into
view — past about 3 units the whole string visibly floats off every tree in the
yard to fix five bulbs.

#### Draw it as one shared geometry and five `Points`

The five plots are **identical in model space**. `House.js` clones one loaded
scene five times and only the plot's own transform differs, so the string's
vertices are the same numbers five times over.

So: build **one** `BufferGeometry` in `createHouses`, before the clone loop, and
give each plot its own `THREE.Points` sharing that geometry and one material.
One geometry, one material, five draw calls — and, which is the part that pays
off, **one colour attribute to animate for the whole town**.

- Add the `Points` as a child of the **`plot`** group in `createHouse`, and put
  the vertices in **model units**. The plot already carries the scale, the Z-up
  quarter turn and the house's yaw, so model-space positions land correctly on
  all five plots with no world-space arithmetic in this file at all.
- **`BULB_SIZE` is in world units even so.** `gl_PointSize` is computed from the
  material's `size` and the view distance and is *not* affected by the object's
  scale, so the one number that does not go through the plot's 7.4 is this one.
  This is the trap in an otherwise free ride; say so in a comment.
- `frustumCulled` can stay on, unlike `Snow.js`. A plot's string is a compact
  object on the far side of the map, which is the case culling is for.

#### The material

```
new THREE.PointsMaterial({
  map: <a bulb gradient>,
  size: BULB_SIZE,          // 7
  sizeAttenuation: true,
  vertexColors: true,
  transparent: true,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
})
```

- **`PointsMaterial` is unlit, and here that is the whole point.** It is the
  same property `visual/night` had to work around for the snowfall, which had to
  be dimmed by hand because no light reaches it. A bulb is supposed to ignore
  the moon, so the thing that was a problem there is the mechanism here. It also
  means the rendered pixel is exactly the hex above, with nothing to compute.
- **`vertexColors`, and build the attribute with `THREE.Color`.** The `color`
  attribute is read as linear working-space values with no conversion, while
  `new THREE.Color(0xfd0000)` converts sRGB to linear on input — so
  `color.toArray(array, offset)` is correct and `((hex >> 16) & 255) / 255` is
  not. Done the second way the bulbs come out pale and milky, which looks like a
  blending mistake and is not one.
- **`AdditiveBlending`**, because a light adds to what is behind it. The one
  risk is washing out where a bulb overlaps bright snow, and that risk is much
  smaller than it was: night took lit snow from 239 to 128. If a bulb against a
  snow cap does blow out, drop `BULB_SIZE` rather than reaching for
  `NormalBlending`, which flattens the glow everywhere to fix a few pixels.
- **`depthWrite: false` with depth testing left on**, the same split `Snow.js`
  uses. Testing on means the tree occludes the bulbs on its far side, which is
  what makes the string read as wrapped around something solid. Not writing
  means overlapping bulbs brighten each other instead of one punching a hole in
  the next.
- Give this file **its own** bulb gradient; do not export `Snow.js`'s. A bulb
  has a hot core and a tight falloff — about 35% white, then down to zero by the
  edge — where a flake is soft all the way through. The sprite is the glow, not
  the bulb, which is also what licenses a 7-unit sprite for a physically
  2-inch lamp.

#### On-screen size, and a correction to how `Snow.js` works this out

three.js computes `gl_PointSize = size * pixelRatio * (height * 0.5) / distance`
(`WebGLMaterials.refreshUniformsPoints`, and `points.glsl.js`). The pixel ratio
cancels against the canvas being scaled back down, so on-screen CSS pixels are
`0.5 * size * cssHeight / distance`. At a 900 px viewport:

| Distance from camera | `BULB_SIZE = 7` | 9 units of spacing |
|---|---|---|
| 480 (Tode at the doorstep) | 6.6 px | 16.9 px |
| 700 | 4.5 px | 11.6 px |
| 1000 (across the field) | 3.1 px | 8.1 px |

A point of light at every range, never a blob, and always clearly separated
from the next bulb.

**Note the formula.** `Snow.js` states that `FLAKE_SIZE = 6` "comes out around
16 pixels" near the player, which is what the *geometrically correct* size would
be: `size * cssHeight / (2 * distance * tan(fov / 2))`. three.js does not use
the field of view in this calculation at all, so at this project's 45° the real
size is **2.41× smaller** — a flake near Tode is about 6.6 px, not 16. Nothing
is wrong with the snowfall; its numbers were tuned until it looked right. But
anyone sizing these bulbs by copying that reasoning will be out by a factor of
two and a half, which is why it is written down here.

#### Twinkle

A slow brightness wobble, not a colour change and not a blink.

- One phase per bulb, `index * 2.399` (roughly the golden angle in radians) so
  neighbours are never in step and the pattern does not repeat down the string.
  A random phase works too but makes the look differ per reload for no gain.
- Multiply each bulb's base colour by `0.6 + 0.4 * (0.5 + 0.5 * sin(phase))`, so
  a bulb rides between 60% and 100% and none ever goes out. A string with bulbs
  going fully dark reads as faulty rather than as festive.
- Advance the phase **per frame**, by `0.03`. Per frame rather than per second
  to match `Snow.js` and `Movement.js`, so the whole scene speeds up and slows
  down together instead of the decoration drifting out of step with the game.
  At 60 fps that is a period of about 3.5 seconds.
- Export `updateChristmasLights()` taking **no arguments**, writing the shared
  colour attribute once and setting `needsUpdate`. All five plots are showing
  that one buffer, so the town costs exactly one 214-bulb update per frame
  rather than five.

This is the one place in the project where the shared state lives in the module
rather than on the object. `Snow.js` deliberately keeps its per-flake speeds and
phases on the returned object so that the thing drawn and the thing stepped
cannot get out of sync; here there is one buffer and five things drawing it, so
hanging it off any one of them would be the misleading arrangement. Say which
rule is being broken and why, in the file.

Call it from the animation loop in `main.js`, **outside** the `isGameOver()`
guard, the same way the snow and the lighting carry on over the Game Over
screen rather than the town going dark on the final frame.

#### Constraints

- Not an obstacle. Not in the `houses` array, not seen by `Collision.js`,
  nothing about `Movement.js` changes.
- **If anyone ever nudges `Trees1`, the lights move with it.** `House.js`
  deliberately leaves that group at `offset { x: 0, z: 0 }`, because the snow
  caps on the trees live in the separate `Snow` group and moving the trees would
  walk them out from under their own caps. The light string is measured in the
  same space and inherits exactly that fragility: it is a third thing that has
  to be moved in step, and it is now the cheapest of the three to get wrong
  quietly, because a bulb hanging in mid-air 30 units from a tree looks like a
  bug in this file rather than a mismatched offset.
- Build the geometry from `gltf.scene` **before** the clone loop, next to
  `lightTheWindows`. After a `clone()` the boxes are identical, so measuring per
  house is five times the work for the same answer.
- No `PointLight`s. See Out of scope.

#### Out of scope

- **Bulbs that actually light the snow.** 1,070 real lights is not a
  conversation, and even one `PointLight` per plot is a separate decision: it
  would be the first light in the game that is not part of the global rig, and
  `visual/night`'s whole case rests on the rendered values that rig produces.
  If a pool of warm light under the trees is wanted, it is one dim `PointLight`
  per plot with a measured `distance` and `decay`, specified against night's
  colour table.
- **Bloom.** Already recorded as its own task in `visual/night`, and 1,070
  additive sprites make the case for it stronger rather than different.
- **Lights on the house itself, its eaves or its fence.** The house's own twelve
  bulbs are there and lit. Running a string along the roofline means picking an
  edge out of an 80,238-triangle mesh by hand, which is a different kind of work
  from wrapping a cone.
- **Switching the lights off at any point in the game.** They are on.

#### Verification

1. 22 strings per plot, five plots. Log the derived tree count once — if it is
   28 the pinecone filter is off, and if it is 23 the clustering is returning
   `Trees1`'s children rather than position clusters.
2. 214 bulbs per plot, and **one** `BufferGeometry` and one material for the
   town. Check `renderer.info.memory.geometries` does not climb by five.
3. The bulbs follow the cones. A string that is a vertical stripe means the
   angle is not advancing; one that bunches near the tip means the spacing is
   stepping `u` instead of arc length; one that floats clear of every tree means
   the tree box was wrapped instead of the canopy box.
4. The four colours repeat in order along a string and carry over between trees.
5. Bulbs behind a trunk are hidden, and bulbs in front of one are not. If all of
   them show through, depth testing was turned off along with depth writing.
6. The colours are saturated — a full red at `rgb(253, 0, 0)`. Pale, milky
   bulbs mean the colour attribute was filled with sRGB bytes over 255 instead
   of through `THREE.Color`.
7. Twinkle is visible but no bulb goes dark, and the five plots do **not**
   twinkle in unison — they share one buffer, so they will, and that is the one
   consequence of the shared geometry worth looking at on screen before
   accepting it. At 22 trees' distance apart it should not read; if it does, the
   fix is a per-plot phase offset applied in the shader or a second buffer, not
   abandoning the sharing.
8. Frame rate unchanged. If it is not, the suspect is the per-frame attribute
   upload, not the draw calls.

#### Research

The `Snow.js` pixel-size discrepancy above is the reusable finding: a formula
that is geometrically correct is not necessarily the one the renderer uses, and
`gl_PointSize` is a place where three.js knowingly uses an approximation that
ignores the field of view. Anything else in this project that reasons about
on-screen size of a `Points` object — `Snow.js`'s `FLAKE_SIZE` and its whole
`CEILING_TAPER` argument, which is built on `tan(3.6°)` — is worth re-deriving
against it.

The open question is whether 22 trees per yard is too many to decorate. A real
household lights the two or three trees by the door, not the whole stand, and
1,070 bulbs across five plots may read as a fairground rather than a village.
The stand's trees are already measured and sorted by height by the time the
geometry is built, so the experiment is cheap: light the tallest six per plot
and compare. It is left on because the five plots are seen from across a field
at 480 units, where a decorated stand reads as one lit shape and a decorated
tree reads as nothing. That reasoning deserves a screenshot rather than
agreement.
