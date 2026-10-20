### Specification for AI agent: Winter town

Replaces the three scattered cottages with a five-house town on the far side of the
field, between the play area and the river.

This is the first task driven by `game_story.md` rather than by the course: Tode is
Santa, and the story ends with him delivering a present to each of five houses. Five
houses that stay where they are is the thing the delivery task will need, and three
cottages landing somewhere different on every reload is the thing it cannot use. So
this task is about *identity* as much as scenery — the town is a place, with five
addresses.

The model is `/models/winter_country_house.glb`.

#### What the model actually is

It is not a house. It is a 5.75 MB Sketchfab diorama: 1,441 nodes, 679 meshes,
124,005 triangles and 31 materials. Read that before writing any code, because
dropping it in whole is wrong in three separate ways.

It carries **no image textures at all** — every material is flat colour, which is
exactly the look `river_landscape.glb` has, so the two sit together with no style
clash and nothing to load alongside the `.glb`.

**But the colours do not survive the loader as shipped.** All 31 materials keep their
colour in `extensions.KHR_materials_pbrSpecularGlossiness.diffuseFactor`, none has a
`baseColorFactor`, and the extension is listed in `extensionsRequired`. three.js
removed support for that extension, so `GLTFLoader` falls back to a default
metallic-roughness material — and the glTF default for `baseColorFactor` is opaque
white. The whole diorama renders white, with every colour sitting unread in the file.

Convert the asset once, offline, with `tools/convert_specular_glossiness.mjs`:
`diffuseFactor` becomes `baseColorFactor`, `roughnessFactor` becomes
`1 - glossinessFactor`, `metallicFactor` is pinned to 0 (the glTF default of 1 would
render everything as a black mirror under this scene's two lights), and the extension
comes out of the material and both extension lists. Every material in this model has
`specularFactor [0,0,0]`, so nothing is lost in the mapping. Do not work around this
at load time: the fix belongs in the asset, not the render path.

Measured per top-level group, in the model's own units (the `.glb` is Y-up):

| Group | Size (X × Y × Z) | Triangles | Centre | What to do |
|---|---|---|---|---|
| `House` | 14.6 × 10.85 × 10.1 | 36,604 | (0.1, 1.9, 0.8) | keep — the building |
| `Trees1` | 18.7 × 9.2 × 20.3 | 5,574 | (8.9, 2.8, 9.7) | keep, do **not** move |
| `SnowMan` | 16.2 × 4.7 × 43.0 | 5,182 | (6.7, 1.1, 19.8) | keep **one child** — see below |
| `Kolodec` (a well) | 57.4 × 14.2 × 119.0 | 6,888 | (−13.0, −0.2, −58.2) | keep **minus one child** — see below |
| `Ground` | 31.7 × 6.7 × 43.2 | 27,595 | — | **discard** |
| `Snow` | 25.3 × 6.2 × 21.0 | 29,760 | — | **keep** — lying snow, not ground |
| `Brigde`, `Smoke`, `Fishes`, `Sanki`, `Sanki1`, `Shovel`, `Shovel1`, `Shovel2` | — | ~12,400 | — | **discard** |
| `ambientLight1`, `directionalLight1` | — | 0 | — | empty nodes; `GLTFLoader` ignores them |

- **`Ground` must be discarded, not hidden.** It is a 31.7 × 43.2 ground patch, and
  the landscape already provides the ground. Two ground surfaces at the same height
  is the coplanar case `GROUND_Z = -0.05` in `Landscape.js` exists to avoid; five of
  them would shimmer across the whole town.
- **`Snow` is lying snow and must be kept.** The name invites the assumption that
  it belongs to the discarded `Ground`; it does not. Every child sits above the
  ground plane and uses the `Snow2` material: `Snow1` is 15.5 × 10.8 at roof
  height, which is the house's own footprint, and the six `polySurface5xx`
  children are caps on the trees and posts. It is 29,760 triangles, the single
  largest kept piece, and it is also the entire winter character of the model —
  without it this is a brown cabin standing in a Christmas scene. The `snowfall`
  task provides *falling* snow, which is a different thing.
- **The props are scattered across the plot, not arranged on it.** `Kolodec` sits 58
  units from the house — nearly six house-depths away — because the original diorama
  is a wide scene. Left alone, each plot's well would land in the next plot's garden.
- **Two of the prop groups are misleading when measured whole**, and this matters more
  than the scattering. Measure their children:
  - `Kolodec`'s 119-unit span is almost entirely **one child, `pCylinder14`** —
    42.7 × 14.2 × 118.6, centred 58 units off, 2,544 triangles. It is a pond or a path,
    not part of the well. Drag it into every plot and the town gets a 878-unit slab
    through it. **Exclude it by name.** What remains is a tidy well cluster at
    (14.4, −1) of about 8.7 × 3 × 5.
  - `SnowMan`'s actual snowman is **`polySurface538`** (2.9 × 4.7 × 2.8, 3,956
    triangles), standing 39.9 units away. The group's other children are a bucket and
    a couple of small plates near the diorama origin. **Take that one child**, not the
    group.

  Pulling in a group *centre* is not enough for either of these — the centre is an
  average over objects that do not belong together.

Keeping only the wanted pieces takes a house from 124,005 triangles to **80,238**, so
five of them cost 401,190 rather than 620,025.

#### Model handling

In `House.js` — the file keeps its name, its exported `houses` array and its job as
the obstacle list that `Movement.js` and `Enemies.js` test against. Everything else in
it changes.

- Change `MODEL_PATH` to `/models/winter_country_house.glb`.
- Load it once and `clone()` per house. The model has no skins and no animations,
  which is the case `clone()` handles cleanly — the same reason the old
  `small_house.glb` could be cloned and `enemy.glb` cannot.
- Pull the four wanted groups out by name with `getObjectByName` and add only those to
  the house group. Do not load the scene and remove the unwanted parts; name the four
  you want, so a future version of the asset with extra props does not quietly start
  shipping them.
- Set `MODEL_SCALE = 7.4`.

  The `House` group is 10.85 model units tall, so 7.4 puts it at **80.3 world units** —
  the height `small_house.glb` had at its own scale of 65. That number is the anchor
  everything else in the project is sized against: `river_landscape/spec.md` works out
  that an 80-unit house reads as an 18 ft cottage, which makes one world unit about
  2.7 inches, Tode 2.3 ft tall and one hop 18 ft. Matching it means this task changes
  the architecture and nothing else about the game's sense of scale.

  The footprint does grow: **108.0 wide × 74.7 deep**, against the cottage's 58 × 54.
  That is correct — this is a country house with a porch, not a hut — but it is what
  drives the placement arithmetic below, so changing the scale means redoing it.
- Keep `model.rotation.x = Math.PI / 2`. Z is up in this game and the `.glb` is Y-up,
  the same quarter turn every other loaded model gets.
- **Do not use the measure-then-lift grounding** the old `createHouse` had
  (`model.position.z = -box.min.z`). That is right for a single model and wrong for a
  plot of several: the `House` group's lowest point is at model `y = −3.48`, so lifting
  the plot by it would raise everything and leave the trees and the snowman floating
  about 26 world units in the air.

  Ground on the diorama's own ground plane instead, which is model `y = 0` — the
  discarded `Ground` group tops out at `+0.52`. Place the plot at `z = 0` and every
  piece keeps the height the artist gave it, including the small amount the house
  foundation and the tree trunks are deliberately buried by. Keep it as a single
  `PLOT_Z` constant so a town that looks sunk or floating is one number to fix.

  Confirmed in the browser: at `PLOT_Z = 0` the houses sit on the ground. The
  reasoning above was sound, but it was reasoning — the diorama could have been
  authored against a ground surface at any height, and `+0.52` is the top of a
  mesh we throw away rather than a stated contract.
- Reposition the two strays, in model units, before scaling:
  - `SnowMan` from `z = 19.8` to `z ≈ 11` — about 81 world units from the house, so it
    reads as standing in the front garden.
  - `Kolodec` from `(−13.0, −58.2)` to `(−13, −12)` — about 96 × 89 world units off the
    house corner, which is a well at the side of the property.
  - `Trees1` must **not** be moved, and this is the one offset that looks harmless and
    is not. The snow sitting on these trees lives in the separate `Snow` group, not
    inside `Trees1`, so nudging the trees walks them out from under their own caps and
    leaves six white blobs hanging where they used to be. At (66, 72) world units from
    the house they already read as beside it. The `Snow` group stays unmoved for the
    same reason.

#### Collision measures the building, not the plot

This is the instruction most likely to be got wrong, and it is the one that decides
whether the town is playable.

`Collision.js` derives a circular footprint from `entity.model` by averaging its ground
extents, and it reads that property off the group. The existing `createHouse` sets
`house.model = model` for exactly this reason. If `house.model` is left pointing at the
whole plot, the footprint becomes a circle of radius ~92 covering the trees, the well
and the snowman, and Tode cannot walk through a garden — each plot becomes a solid
disc nearly a hundred units across.

- Set `house.model` to the extracted **`House` group alone**.
- Add `Trees1`, `SnowMan` and `Kolodec` to the house group as siblings of it, so they
  are drawn and moved with the house but take no part in collision.

The radius is then `(108.0 + 74.7) / 4 = 45.7`, which blocks the building and leaves
the garden walkable. Walking through a snowman is a much smaller lie than a hundred-unit
invisible wall around every house.

One wrinkle to state rather than discover: `Collision.js` measures an **axis-aligned**
box, so a yawed house reads slightly larger. Across the arc the radius runs from 45.7
for the house facing straight down −X to **63.6** for the two on the ends, yawed 35°.
The spacing below is checked against the worst case, not the best.

`Collision.js` itself is not touched.

#### Placement: an arc, not a scatter

Delete `findPlacement`, `randomCoordinate`, `PLACEMENT_RANGE`, `ORIGIN_CLEARANCE` and
`MAX_PLACEMENT_ATTEMPTS`. Random placement with a rejection loop was right for three
anonymous cottages; it is wrong for a town, and wrong for five delivery targets that
have to be in the same place on every run.

- `HOUSE_COUNT = 5`
- `TOWN_RADIUS = 480` — distance from the origin to each house centre.
- `TOWN_SPREAD = 110` degrees, centred on **+X**, with the five houses at equal
  angular steps across it: −55°, −27.5°, 0°, +27.5°, +55°.
- Yaw each house to face the origin, from `Math.atan2` on its own position, so the
  fronts look onto the field. This replaces the old random quarter-turn, which existed
  only to stop three identical cottages facing the same way; here the houses facing the
  same place *is* the point.

Every one of those numbers is forced by something, and the spec states which:

- **Why +X.** The river is on that side. `riverX(z) = 30.5 + …` in
  `game/tools/generate_river_landscape.mjs` puts the channel centre at model x ≈ 30.5,
  which at `Landscape.js`'s `MODEL_SCALE = 41` is **1251 world units**, with the
  nearest water vertex at **1091**. So the town faces the water across the fields and
  the river sits behind it from the camera's usual angle.

  Note the river cannot be reached, and the town cannot be put on its bank.
  `WORLD_RADIUS` in `Movement.js` is **700** and the nearest water is at 1091. Moving
  the channel inward would break the flat-basin guarantee the landscape depends on, and
  raising the world bound would let Tode hop into the hills at `z = 0` with the ground
  through his waist. A town *between* the field and the river is the version that works.

  (`visual/river_landscape/spec.md` states the river is "about 2657 world units out".
  That figure is stale — it was computed when `MODEL_SCALE` was 100. At 41 it is 1091.)
- **Why 480.** The plot reaches about 100 units beyond the house centre once the well
  and trees are counted, so the town's outer edge lands at 580 — inside `WORLD_RADIUS`
  of 700 with room to spare, which it must be, or Tode is stopped by the invisible
  world edge before he reaches the front doors. It also puts the nearest wall 443 units
  from his start, far enough that the town is somewhere he travels to rather than
  something he begins inside.
- **Why 110° across five houses.** That is 922 units of frontage and a 27.5° step,
  which puts adjacent house centres **228.2** units apart. The tightest pair needs
  `63.6 + 61.6 + MIN_COLLISION_DISTANCE(8) = 133.2` between them, so the arc clears it
  by 95 units and needs no rejection loop at all. The geometry replaces the retry logic
  rather than hiding it.
- **Why it is safe from the spawn corners.** Enemies spawn at the four `(±220, ±220)`
  points. The outermost house sits at (275, 393), which is **181.8** units from the
  nearest of them, against a required clearance of `45.7 + 7.9 + 8 = 61.6`. No monster
  can materialise inside a wall and spend the run shoving at it — the thing
  `PLACEMENT_RANGE = 170` was protecting against, now guaranteed by arithmetic.

**The model faces −Y at a yaw of 0**, not +Y like `tode.glb` and `enemy.glb`. So every
house needs `MODEL_BASE_ROTATION = Math.PI` folded into the facing above — the same
idiom `Movement.js` and `Enemies.js` already use for Tode and the monsters. This was
checked in the browser rather than assumed: at 0 the five fronts pointed out of the map
and the town showed the field its back walls.

Do not fix it by rotating the group. The group carries the house's position, so turning
it swings the whole plot around the world origin instead of turning the house on its
own spot.

#### Constraints

- **`small_house.glb` is retired, not deleted.** It is still referenced by
  `repo_knowledge.md` and by the original `Visual/Game_world` course spec, and the
  course files are not ours to edit.
- **Watch the triangle count.** 271,240 triangles of town against the landscape's
  24,982 makes these five houses, by a wide margin, the heaviest things in the scene.
  If the `atmosphere` task's shadows are also applied they are also the heaviest shadow
  casters. If the frame rate suffers, drop `Kolodec` from the kept groups first — it is
  6,888 triangles for a well that is mostly hidden behind the house — and `Trees1`
  second. Do not solve it by lowering `MODEL_SCALE`, which would break the scale anchor.
- **This task does not implement delivery.** It builds a town with five stable
  addresses and leaves `houses` exported in the order the arc was walked, which is what
  `gift_delivery` will index into. No gift, no carrying, no per-house state here.
- The enemies still spawn and still chase. Whether monsters belong in the Santa story
  at all is a question for the story, not for this task, and nothing here forecloses
  removing them later.

#### Research

Five houses in a neat arc is a compromise forced by the flat basin: a real town would
have a road through it, and a road implies the hills and the river bank are reachable,
which the planar movement model currently rules out. The open question from
`river_landscape/spec.md` — whether `Movement.js` could sample terrain height — is the
same question here, and answering it would turn this arc into a village with a street.
