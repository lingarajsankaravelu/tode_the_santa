### Specification for AI agent: Snow ground

Turns the landscape from summer to winter, so the ground matches the story the
rest of the game is now telling.

As it stands the game has falling snow, a winter country house, five snowmen and
a Christmas delivery to make — standing on a green summer lawn with 170
wildflowers in it. This task fixes the ground under all of that.

The trees stay as they are. Snow-dusted pines would be an improvement and are
explicitly **not** part of this task.

#### This is a tools change, not a code change

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

#### A flat colour is not enough, and the jitter does not save it

**This is the part the first implementation got wrong, and the correction is the
main content of this spec.** The original text said to keep the `hex(base, 0.09)`
jitter as the thing "giving the fields any texture at all". It gives none. In the
browser the result was, in the user's words, "just white and glossy".

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

Measured result: 43 levels of rendered crest-to-hollow contrast, and **20**
levels of variation surviving a 4-unit tile average — which is the number that
matters, because it is what the eye sees as drifts. Before the drift field that
figure was approximately zero.

#### Roughness, or why it looked glossy

Set the `Landscape` material's `roughnessFactor` to **`1`**, not `0.95`.

At 0.95 a near-white surface 3,280 units across keeps a broad specular sheen,
and that sheen is why the snowfield read as glossy white plastic next to the
house — whose own `Snow2` material is `roughnessFactor: 1`, which is exactly the
comparison that exposed it. There is no sun disc in this scene for a highlight
to catch, so the sheen buys nothing and costs the matte surface snow needs.

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
2. The `.glb` should come back at roughly 2.5 MB and **23,100** triangles, down
   from 24,982. The drop is 1,882, which is 170 flowers at 11 triangles each —
   so if the number lands there, nothing but the flowers left.
   Expect the pines, shoreline rocks and mountains to sit in slightly different
   places than before: removing the flower loop and the 30% scatter changes how
   many times `rnd()` is called before those scatters run. The terrain *shape*
   is unaffected, since `height()` does not draw on `rnd()` at all.
3. In the browser: white fields, green pines, the river still blue, rocks and
   hill faces still visible as shape rather than flat white, and the mountains
   still readable as distant.
4. Check the horizon specifically. This is the thing most likely to go wrong, and
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

The open question is depth rather than colour. The drift field fakes drifts with
shading, and it cannot do more than that: real drifts are geometry, and raising
the snow where Tode walks would push the ground up through his feet and break the
flat-basin agreement `Landscape.js` has with `WORLD_RADIUS`. Snow banked against
the windward side of the hills and the houses — *outside* the basin, where the
terrain is already free to move — is the real version of this and is a much
larger change.

One latent problem found while measuring, and deliberately **not** fixed here.
Every basin face has the normal `(0,-1,0)`: the terrain grid is wound so its
normals point down, away from the sky. It renders correctly today only because
the `Landscape` material is `doubleSided`, so three.js flips the normal for the
back-facing fragments the camera actually sees. Shadows are not enabled yet, and
when `skeleton/atmosphere` turns them on, a ground plane whose normals face away
from the light is the kind of thing that produces shadow acne across the whole
map. Fixing it means reversing the winding in the grid loop, which touches every
land triangle, and it belongs in the task that switches shadows on.
