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
distance and become a pale smear. Add two slightly cooler, darker constants for
the ground so the caps still separate from it:

```js
const GROUND_SNOW = 0xe9eef5
const GROUND_SNOW_SHADE = 0xcfdceb
```

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

Keep the `hex(base, 0.09)` jitter exactly as it is. It is doing more work on
white than it was on green — snow with no per-face variation reads as a void,
and this is the only thing giving the fields any texture at all.

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

1. Re-run the generator and check it still reports its two guarantees — the flat
   middle out to model radius 17, and the river's nearest water vertex no closer
   than about 26.6. Both are geometry and a colour change cannot move them, but
   the generator is being re-run and that is the moment to confirm the shape did
   not drift.
2. The `.glb` should come back at roughly 2.6 MB and ~25,000 triangles, slightly
   less with the flowers gone. A large change in either means something other
   than colour was edited.
3. In the browser: white fields, green pines, the river still blue, rocks and
   hill faces still visible as shape rather than flat white, and the mountains
   still readable as distant.
4. Check the horizon specifically. This is the thing most likely to go wrong, and
   the reason for the two new constants.

#### Research

The discarded `Snow` group in `winter_country_house.glb` was 29,760 triangles of
snow layer for the ground patch that came with it — thrown away by
`visual/winter_town` because the landscape is the ground. With the fields white,
that snow is not missed, which is a small retrospective confirmation that
dropping it was right.

The open question is depth rather than colour: real snow has drifts and the
grid here is a smooth heightfield. Whether the generator should raise snow
against the windward side of the hills and the houses is a much larger change —
it would alter the terrain the play area is guaranteed flat within — and belongs
nowhere near this task.
