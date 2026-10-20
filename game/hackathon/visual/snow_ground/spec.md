### Specification for AI agent: Snow ground

Turns the landscape from summer to winter, so the ground matches the story the
rest of the game is now telling.

As it stands the game has falling snow, a winter country house, five snowmen and
a Christmas delivery to make — standing on a green summer lawn with 170
wildflowers in it. This task fixes the ground under all of that.

The trees stay as they are. Snow-dusted pines would be an improvement and are
explicitly **not** part of this task.

#### Two settings outside the generator

The task is otherwise confined to the generator, but the snow bed cannot be
made to render correctly without one change in `game/src/`, and it is the more
important of the two fixes here.

**`Camera.js`: `NEAR_PLANE` goes from `0.1` to `10`.** A 24-bit depth buffer
resolves roughly `z² / (near × 2²⁴)` at distance `z`, so at 0.1 this scene was
working with:

| Distance | Resolution at `near = 0.1` | at `near = 10` |
|---|---|---|
| 1000 units | 0.60 | 0.0060 |
| 2000 units | 2.38 | 0.0238 |
| 2600 units (the mountains) | **4.03** | 0.0403 |

Four world units of uncertainty is coarser than the gaps between surfaces that
are meant to be in front of each other. Two things were visibly failing: the
mountains overlap each other out at the far edge, and the snow bed lies a few
units above the ground it covers. Both lost the depth test in patches, and the
patches flipped as the camera moved — so the whole scene flickered whenever Tode
jumped.

Nothing is clipped by the new plane. The camera sits about 368 units from Tode,
and the nearest thing to the lens is the snowfall, whose band geometry in
`Snow.js` puts its closest flake roughly 53 units out — five times the new
plane. Nothing in this game is ever drawn close to the lens.

This is the one-line change `visual/snow_roads` identified in its own Research
section and deferred as "the real fix" for coplanar scenery. It is no longer
deferred, which also means that spec's `polygonOffset` workaround is now
belt-and-braces rather than load-bearing.

**`Enemies.js`: `SPAWN_ENABLED = false`.** Not part of this task's intent, but
recorded because it is in the same commit: you cannot stand still long enough to
judge the ground with monsters arriving every few seconds. Set it back to `true`
to restore the chase. An empty `enemies` array is a state every other system
already handles, since it is what the first seconds of a run look like anyway.

#### This is otherwise a tools change, not a code change

The ground is `/models/river_landscape.glb`, and it has no textures: every
colour is baked into vertex data by `game/tools/generate_river_landscape.mjs`.
So the whole task is editing that generator and re-running it:

```bash
cd game
node tools/generate_river_landscape.mjs
```

The generator takes no dependencies and uses a fixed seed, so the terrain comes
back the same shape with new colours. **Nothing in `game/src/` changes.**
`Landscape.js` keys off the material names `Landscape` and `Water`, and a colour
change does not touch those.

#### The palette is already half built

The generator has these constants at the top, and two of them are the ones we
need:

```js
const GRASS = 0x6ead4a
const GRASS_DARK = 0x4e8c3a
const SAND = 0xc2b280
const ROCK = 0x8a8577
const SNOW = 0xf2f4f7        // already used, for the mountain caps
const SNOW_SHADE = 0xd4e0ec  // already used, for the mountain caps
const PETAL_P = 0x9b5fc0
const PETAL_Y = 0xe8c54a
```

Do **not** simply point the ground at `SNOW` and `SNOW_SHADE`. The mountains
along the far edge already use those above their snow line, and if the fields
are the same white the horizon dissolves — the mountains stop reading as
distance and become a pale smear. Add two cooler, darker constants for
the ground so the caps still separate from it:

```js
const GROUND_SNOW = 0xe6eef8
const GROUND_SNOW_SHADE = 0xb8cadf
```

The hollow colour is a definite blue-grey, not a slightly grey white. Snow in
shadow is blue, because what lights a hollow is the sky rather than the sun, and
that blue is most of what tells the eye it is looking at snow at all. An earlier
pass used `0xcfdceb` here and the fields read as white paper.

#### The terrain colouring

In the grid loop that emits the land triangles, the current cascade reads:

```js
let base = GRASS
if (my < WATER_Y + 0.35 && dist < BANK * 2.4) base = SAND            // riverbed
else if (dist < BANK * 2.9) base = rnd() < 0.4 ? SAND : GRASS_DARK   // banks
else if (my > 2.2) base = rnd() < 0.5 ? ROCK : GRASS_DARK            // high ground
else if (rnd() < 0.3) base = GRASS_DARK
tri(land, f[0], f[1], f[2], hex(base, 0.09))
```

Change it clause by clause, and keep the structure — each branch is a different
piece of ground and they should not all become the same white:

- **Default** → `GROUND_SNOW`. This is the flat basin and the open fields, which
  is the "area filled with snow" this task is for. The basin is part of the same
  grid, so the play area recolours with everything else and needs no special case.
- **Riverbed** (`SAND`) → leave as `SAND`. It is under the water, and a sandy bed
  seen through the surface is right in any season. Changing it to white would
  make the river look frozen, which it is not — the water ribbon is still there.
- **Banks** → `rnd() < 0.4 ? SAND : GROUND_SNOW_SHADE`. Snow lying to the
  water's edge with wet sand showing through where the bank is steep.
- **High ground** → keep the `ROCK` half and make the other half
  `GROUND_SNOW_SHADE`. Rock faces too steep to hold snow are what give the hills
  their shape; turning all of it white would flatten them.
- **The 30% scatter** → `GROUND_SNOW_SHADE`, so the fields keep the two-tone
  mottling that stops them reading as one flat sheet.

#### Recolouring the ground does not work at all — the snow is a second surface

**This is the heart of the task, and it took two failed attempts in the browser
to find it. Read this section before writing any code.**

The first attempt recoloured the terrain white. The result was "just white and
glossy". The second attempt added a drift field to the vertex colours and
mattened the material. The result was *still* "still white and glossy".

The colour was never the problem. **Snow is a layer**, with thickness, lying on
top of the ground — which is exactly what it is on the house, where `Snow1` and
its six `polySurface` caps are separate geometry over the roof and the trees, not
a white roof. That is the comparison that kept coming up, and it is the answer:
no amount of vertex colour makes a plane read as snow, because what identifies
snow is a surface of its own catching light at its own angles. The play area
makes this absolute — all 1,712 basin faces share the single normal `(0,-1,0)`,
so a recoloured basin has *no* shading information in it whatsoever.

So the generator emits **a third mesh**: `snow`, with its own material, laid over
the terrain. See "The snow bed" below. The colour work that follows is still
wanted, but it is a finish on that surface, not a substitute for it.

#### The colour groundwork (necessary, not sufficient)

The original text said to keep the `hex(base, 0.09)`
jitter as the thing "giving the fields any texture at all". It gives none.

Two measurements say why:

- The jitter is **high-frequency** noise — one random brightness per triangle.
  A grid triangle is 37 world units; the camera sits 400 units back and sees
  2500 units deep. At that density the noise averages back to flat white before
  the eye resolves it.
- The play area has **no geometric shading whatsoever**. `FLAT_R` guarantees the
  basin is dead flat, and all **1,712** basin faces share the single normal
  `(0,-1,0)`. Every face takes identical light, so colour is carrying the entire
  appearance of the ground Tode actually stands on.

Grass survives a flat colour because the eye accepts a flat green plane as a
lawn. It reads a flat white plane as paper. Snow reads through **broad form** —
a bright crest here, a cool hollow there — so the generator needs a smooth drift
field as well as the grain:

```js
const drift = (x, z) => {
  const d = 0.5
    + 0.30 * Math.sin(x * 0.38 + 0.4) * Math.cos(z * 0.32)
    + 0.13 * Math.sin(x * 0.78 - z * 0.63 + 1.1)
    + 0.07 * Math.cos(x * 1.55 + z * 1.24)
  return Math.max(0, Math.min(1, d))
}
const snowAt = (x, z) => mixHex(GROUND_SNOW_SHADE, GROUND_SNOW, drift(x, z))
```

with `mixHex` blending in sRGB byte space, where the palette is written.

The frequencies are chosen by measurement, not by eye: they put a light-to-dark
patch every **174** world units across X and **349** across Z, so two to four of
Tode's 80-unit hops cross one. They are deliberately anisotropic — equal
frequencies gave an even blotch, and drifts lie along a wind direction. A first
attempt at a third of these frequencies fitted only two patches across the whole
basin, which is one gradient rather than snow.

The cascade then takes `snowAt(mx, mz)` wherever it took a flat snow constant,
and the old `else if (rnd() < 0.3)` scatter is **removed** — it was more of the
same per-face noise, and the drift field now supplies both tones as form.

Keep the per-face jitter, but drop it to `hex(base, 0.06)`. Its job is now a
finishing grain that stops the blend banding across the flat basin, not the
only source of variation.

`drift` is reused by the snow bed below, which is its real purpose.

#### Roughness, or why it looked glossy

Both the `Landscape` material and the new `Snow` material take
`roughnessFactor: 1`, not `0.95`.

At 0.95 a near-white surface 3,280 units across keeps a broad specular sheen,
and that sheen is why the snowfield read as glossy white plastic next to the
house — whose own `Snow2` material is `roughnessFactor: 1`, which is exactly the
comparison that exposed it. There is no sun disc in this scene for a highlight
to catch, so the sheen buys nothing and costs the matte surface snow needs.

#### The snow bed

A third mesh in the generator, `snow`, emitted from the same 88×88 grid as the
land and given its own material:

```js
json.materials.push({ name: 'Snow', doubleSided: true,
  pbrMetallicRoughness: { baseColorFactor: [1,1,1,1], metallicFactor: 0, roughnessFactor: 1 } })
```

**The trick that makes this safe.** Snow is laid on the ground by *lowering the
terrain* by `SNOW_DEPTH` and putting the snow surface at the old terrain line —
not by stacking snow on top of it. The snow goes in **under** Tode's feet rather
than on top of them, so the level he walks on never moves and the flat-basin
agreement `Landscape.js` has with `WORLD_RADIUS` survives untouched. Stacking it
on top would raise the floor by 12 world units and leave him walking in mid-air.

```js
const SNOW_DEPTH = 0.30          // 12.3 world units, about a foot of snow
const SNOW_RELIEF_BASIN = 0.06   // 2.5 world units
const SNOW_RELIEF_HILLS = 0.55   // 22.6 world units
const landY = (x, z) => height(x, z) - SNOW_DEPTH
```

**Relief is what actually reads, and it is bounded by where Tode can walk.**
Both terms are *subtracted*, so the snow surface can never rise above the old
terrain line — that is what keeps the basin a floor rather than a hazard. The
amplitude is then scaled by the existing `basinWeight`, which is the key
observation: `WORLD_RADIUS` is **exactly** the basin edge, so outside `FLAT_R`
Tode cannot go at all and the drifts out there are free to be real geometry.
Inside the basin the relief may only dip slightly below the walk plane, because
he has no ground-following and every unit of hollow is a unit he hovers over.

```js
function snowY (x, z) {
  const cover = snowCover(x, z)
  const amp = SNOW_RELIEF_BASIN +
    (SNOW_RELIEF_HILLS - SNOW_RELIEF_BASIN) * basinWeight(x, z)
  const dip = (1 - drift(x, z)) + 0.18 * crunch(x, z)
  return height(x, z) - SNOW_DEPTH * (1 - cover) - amp * dip * cover
}
```

**`snowCover` keeps the hills' shape.** Snow does not lie on water and slides
off anything steep, so coverage is zero over the channel and falls off with
slope. Without it the snow layer shrink-wraps the terrain and erases every
silhouette on it; with it the rock faces stay bare, which is what reads as a
hill under snow. Where cover reaches zero the surface tapers to meet the land
and **no face is emitted at all** — a degenerate face lying in the ground would
simply z-fight it.

**No snow thinner than the depth buffer can resolve.** `COVER_MIN = 0.12` —
below that much cover the snow is not drawn at all, rather than drawn as a film
too thin to win a depth test. At `SNOW_DEPTH` that floor is 1.5 world units,
and the thickness is also clamped up to it inside the snow region so a boundary
vertex cannot thin out below it. Measured before this went in: **231** snow
faces were thinner than the resolution where they sat, which is what put
earth-coloured polygons in the middle of the snowfield. Now zero, with a 45×
worst-case margin. The `Camera.js` fix alone is enough to hide this, but a
surface this large should not depend on a single setting elsewhere to stay
visible.

**Fill single-cell holes.** A lone bare cell surrounded by snow is not rock
showing through, it is a stray earth triangle in a white field. `snowHere()`
keeps a cell if three or more of its four neighbours have snow. Two such holes
appeared at `COVER_MIN` before this went in; the measured count must be **zero**.
The larger bare region along the channel is coherent and wants no filling —
1,195 bare cells, none of them isolated.

**`crunch` must be a function of position, not of grid index.** Adjacent cells
share vertices, and a per-vertex value that disagreed between them would open
cracks straight through the surface. `0.5 + 0.5 * Math.sin(x * 12.9898 + z * 78.233)`
aliases to something effectively random at a wavelength below one cell, which is
what gives the snow its faceted crunch instead of a smooth skin.

**Wind the snow faces the opposite way to the land**, so its normals come out
facing the sky. The land grid's all point down and render correctly only because
its material is `doubleSided`; the surface the whole scene is lit through should
not be relying on that.

**The land becomes earth again.** It is now seen only where the snow is not — the
river bed, the wet bank, the steep faces — so its palette goes back to mineral
tones with a new `EARTH = 0x6a6355`. Green field showing through the gaps in a
snowfield is worse than no gaps at all. The two height thresholds in its cascade
must be tested against `my + SNOW_DEPTH`, since they were chosen against
`height()` and the whole grid now sits that far below it; left alone they quietly
widen the river bed and shrink the high ground.

**Scatters sit on the snow.** `pine` takes its base from `snowY` rather than
`height`, so trunks emerge from the snow instead of being buried a foot deep in
it. Shoreline rocks take `Math.max(snowY, landY)` — snow where it lies, bare bank
where it does not.

Measured result:

| | Basin (r < 17) | Hills (r > 21) |
|---|---|---|
| Mean face tilt | 0.7° | **20.6°** |
| Max face tilt | 12° | 55° |
| Rendered range | 169–221 | 148–229 |
| Std dev | 9.2 | 12.0 |

The hills column is the one that matters: 20.6° of mean tilt is real shading
that changes with the light, which is what no amount of vertex colour was ever
going to supply. The basin stays nearly flat because it must, and 12° of maximum
facet from `crunch` is as much as the walk plane can afford.

#### Wildflowers come out

The generator plants 170 wildflowers in `PETAL_P` and `PETAL_Y`:

```js
// Wildflowers.
for (let n = 0, guard = 0; n < 170 && guard < 16000; guard++) {
```

Purple and yellow flowers in snow is the single most obviously wrong thing left
once the ground is white. Remove the loop, and remove `PETAL_P` and `PETAL_Y`
with it rather than leaving two unused constants behind.

That is the one removal. Keep the rest of the scatters:

- **The 110 pines** — the trees stay, as specified. They are the only green left
  and they will carry the whole colour contrast of the scene, which is a good
  reason to leave them alone and a better one not to snow-dust them in the same
  task.
- **The 55 shoreline rocks and 7 boulders** — rocks standing out of snow is
  exactly right, and they mark the water's edge now that the bank is not a
  colour change.
- **The mountains** — untouched. They were already snow-capped; they are now the
  far end of a continuous snowfield rather than an odd white island.

#### Water

Leave `WATER = 0x3f8fd4` alone. A bright open river running through snow is a
deliberate look and the one strong colour in the scene besides the pines. A
frozen river is a different and larger idea — it would want ice geometry, not a
palette change — and `visual/river_landscape` keeps the water as scenery that
Tode cannot reach anyway.

#### This collided with `visual/snow_roads` — settled

`visual/snow_roads` specified a road in `ROAD_COLOR = 0xe8eef2`, chosen to
separate from a **green** field. On `GROUND_SNOW = 0xe9eef5` it is invisible —
the two differ by one or two values per channel.

Settled when this task was implemented, and in the direction this section
called for: the road changed, not the ground. `ROAD_COLOR` in that spec is now
`0xd2dae3` — compacted snow, a shade darker and greyer than the fields, with
the verges left bright.

#### Verification

1. Re-run the generator and confirm its two guarantees — the flat middle out to
   model radius 17, and the river's nearest water vertex no closer than about
   26.6. Both are geometry and a colour change cannot move them, but the
   generator is being re-run and that is the moment to confirm the shape did not
   drift. Note that the generator does **not** print these; it prints only
   triangles and bytes. They have to be read back out of the `.glb`.
2. The `.glb` should come back at roughly 3.9 MB and **36,197** triangles, of
   which **13,097** are the snow layer. That is up from 24,982, and the snow bed
   is what paid for it: against the winter town's 401,190 triangles it is not
   worth optimising, but the file is 1.4 MB larger to load and that is the real
   cost of this task.
   Expect the pines, shoreline rocks and mountains to sit in slightly different
   places than before: removing the flower loop and the 30% scatter changes how
   many times `rnd()` is called before those scatters run. The terrain *shape*
   is unaffected, since `height()` does not draw on `rnd()` at all.
3. In the browser: a snow *surface* with visible form, not a white floor — drifts
   catching the light across the middle distance, bare rock on the steep faces,
   the snow thinning out to bare bank at the water's edge. Green pines standing
   in it, the river still blue, the mountains still readable as distant.
4. Check the walk plane. The snow top inside the basin must be **≤ 0** at every
   vertex, or Tode is walking inside the ground. Measured: max `-0.0044`, min
   `-0.0830`, so he hovers at most 3.4 world units — against his own height of
   102, which is nothing. Also confirm **zero** snow faces over the channel and
   **zero** snow normals pointing down.
   Then check the two artifact counts that cost a browser round trip to find:
   **zero** snow faces thinner than the depth resolution where they sit, and
   **zero** isolated single-cell holes.
5. Check the horizon specifically. This is the thing most likely to go wrong, and
   the reason for the two new constants.

   Worth being honest about the margin: the brightest drift crest renders at 225
   against 227 for a flat-facing mountain cap, so the two are not separated at
   the top of the range. What carries the horizon is that the *average* field is
   near 200, and that the mountains' lower two-thirds are `ROCK` — so what
   actually meets the snowfield is grey, not white. If the horizon does dissolve,
   darken `GROUND_SNOW` rather than touching `SNOW`.

#### Research

The discarded `Snow` group in `winter_country_house.glb` was 29,760 triangles of
snow layer for the ground patch that came with it — thrown away by
`visual/winter_town` because the landscape is the ground. With the fields white,
that snow is not missed, which is a small retrospective confirmation that
dropping it was right.

The lesson worth carrying forward is that **a material change cannot substitute
for geometry**. Two passes were spent on colour — a cooler palette, then a
measured drift field with 20 levels of surviving broad-form variation — and
neither moved the browser result at all, because the basin has one normal and
flat shading of a flat plane is flat whatever its colour. The snow bed worked
immediately. When something is meant to read as a *material lying on* a surface,
the first question is whether it has a surface of its own, not what colour it is.

What is still missing is snow banked *against* things — drifts piled on the
windward side of the houses and the hills. The basin-weighted relief gives the
open ground its form, but the five houses sit in the snow without disturbing it.
That needs the snow layer to know where the town is, which means the generator
would need the town's arc, and `visual/winter_town` owns those constants.

One latent problem found while measuring, and deliberately **not** fixed here.
Every basin face has the normal `(0,-1,0)`: the terrain grid is wound so its
normals point down, away from the sky. It renders correctly today only because
the `Landscape` material is `doubleSided`, so three.js flips the normal for the
back-facing fragments the camera actually sees. Shadows are not enabled yet, and
when `skeleton/atmosphere` turns them on, a ground plane whose normals face away
from the light is the kind of thing that produces shadow acne across the whole
map. Fixing it means reversing the winding in the grid loop, which touches every
land triangle, and it belongs in the task that switches shadows on.
