### Specification for AI agent: Tode the Santa — appearance

> **Half implemented.** The playback layer landed as
> `game/src/components/Animation.js`, wired into `Player.js`, `Movement.js`,
> `Attack.js` and `main.js`. **The asset does not exist.** Everything below the
> "What the game already does" section is an authoring brief for whoever opens
> Blender, and it is the half that is still outstanding.
>
> The code is deliberately inert until the asset arrives: `createAnimator`
> returns `null` for a model with no clips and no shape keys, which is exactly
> what `tode.glb` is, so the game today looks precisely as it did before. No
> second round of wiring is needed when the `.glb` is dropped in — only the
> names below have to match.

Dresses Tode as Santa and gives him a rig, so he can hop, idle and **smile**.

#### The current model cannot be animated, and this is why

`public/models/tode.glb` is not authored art. Its `asset.generator` reads
`THREE.GLTFExporter r174` and its root node is named
`f2547781-11e3-4883-ab56-ad17700da82c`, so it is a re-export of something that
passed through a three.js scene — probably via `tools/convert_specular_glossiness.mjs`.
What came out the other side:

| | `tode.glb` | `enemy.glb`, for contrast |
|---|---|---|
| File size | **1,885,796 bytes** | 194,404 bytes |
| Triangles | **10,740** | 3,200 |
| Vertices | 8,262 | 1,916 |
| Meshes | **1**, unnamed, fused | 1, 7 primitives |
| Materials | **1** | 7, named |
| `NORMAL` attribute | **absent** | present |
| Skin | **none** | `CharacterArmature` |
| Shape keys | **0** | 0 |
| Animations | **0** | 8, named |

Three of those rows are fatal on their own. There is no skeleton, so nothing
can move. There are no shape keys, so no face can change. And the mesh is a
single fused blob with one material, so there is not even a *head* to address
separately — no group, no material slot, no vertex set that corresponds to a
mouth.

Two more are worth knowing before anyone rebuilds it:

- **The face is painted into a texture, and the texture is the file.** The one
  material is `baseColorTexture` onto a 1024×1024 RGBA PNG of **1,589,980
  bytes — 84.3% of the whole model**. The unwrap is an automatic one: islands
  scattered across the sheet with no layout, the two eyes sitting as isolated
  black rounded squares near the middle of the lower half. It is a *bake*, not
  a hand-painted sheet, which is why 1 MB buys a frog with four colours on it.
- **He is flat-shaded, whether or not that was the intention.** With no
  `NORMAL` attribute, `GLTFLoader` takes the `useFlatShading` branch at
  `GLTFLoader.js:3583` and clones the material with `flatShading = true`. The
  hard facets visible in the baked texture are that decision, baked twice.

So this is a rebuild, not an edit. Nothing in the existing file is worth
carrying forward except the silhouette and the colours.

#### Measure the screen before authoring the face

The camera sits at `(260, -260, 180)` relative to Tode, which is **409.4 units**
from his feet, with a 45° vertical field of view. The visible vertical extent
at that distance is `2 × 409.4 × tan(22.5°) = 338.8` world units. Tode stands
**10.15 units** tall (local height 0.6345 × `MODEL_SCALE` 16). On a
1080-pixel-high viewport:

| | World units | Pixels at 1080p |
|---|---|---|
| Visible height at Tode's distance | 338.8 | 1080 |
| Tode, head to foot | 10.15 | **32** |
| Tode's head, roughly a third of him | 3.4 | **11** |
| His mouth, across | ~1.5 | **5** |

**The smile has about five pixels to happen in**, before the 26° downward pitch
foreshortens it further. That single number should govern the whole face:

- A subtle, anatomical blendshape is wasted work. It will not survive to the
  screen.
- The smile has to be **graphic** — a large, high-contrast change in shape,
  the way the mouth in `public/tode.svg` is a solid black bar. Think of the
  face as two or three flat shapes that swap, not as a surface that deforms.
- Do not spend triangles on the face. Spend them on the silhouette: the
  belly, the hat, the pompom, the beard. Those are what read at 32 pixels,
  and the belly reads first — see the costume section below.

#### What to author

Tode in a full Santa suit — red coat, belly, belt, red trousers, boots — while
staying unmistakably the same frog: flat green head, two big white eyes with
black rounded pupils, the wide mouth. `public/tode-santa.svg` is a sketch of the
whole costume — hat, beard, coat, belly, belt, buckle, fur hem, boots, bare
green hands — and it is the colour reference. It is **not** a proportion
reference: it is a flat front view built on `tode.svg`'s own shapes, and it
cheats the one thing that matters most. Head-on and flat there is nowhere for
a belly to bulge, because the arms already set the outer edge of the figure,
so the sketch carries the belly with a lighter red instead. **On the model the
belly is shape, not shading.**

**The belly is the most important item on this list.** At 32 pixels, colour is
the weaker channel and shape is the stronger one: a red coat is a red blob
until it has an outline, but a round belly changes the *silhouette*, and the
silhouette survives any amount of downscaling. A viewer reads "Santa" off the
profile of a wide middle and a pointed hat before they read any colour at all.
Make it generous and make it the widest part of him above the feet.

| Part | Colour | Notes |
|---|---|---|
| **Hat** | red, white brim, white pompom | Leaning back and to one side. Pompom on its own bone so it swings. |
| **Head and face** | green | Unchanged. This is the frog, and it is what keeps him Tode rather than a generic Santa. |
| **Beard** | white | Short enough that the mouth is still the widest shape on the face — the mouth carries the smile. |
| **Coat** | red, white fur trim at hem and cuffs | Over the torso and the belly. |
| **Belly** | red, under the coat | Round and wide. See above; this is the silhouette. |
| **Belt** | black, wide | Sits under the belly, not around its widest point. |
| **Buckle** | gold | Optional — see the pixel budget below. |
| **Trousers** | red, white cuff above the boot | Short; most of the leg is boot at this scale. |
| **Boots** | black | Replaces the green feet. |
| **Hands** | green | Left bare rather than mittened, so there is green low on the body as well as high. |

#### Why the red does not merge, and what makes sure of it

An earlier draft of this spec argued *against* the red coat, on the grounds
that a red hat above a red body merges into one mass at 32 pixels. The
observation was right; the conclusion was wrong. The fix is not to drop the
coat — it is to break the red into bands, which is exactly what a real Santa
suit does and exactly why one reads at a distance.

Running down him, the vertical bands at roughly 32 pixels:

| Band | Approx. pixels | Colour |
|---|---|---|
| Hat and pompom | 9 | red, white tip |
| Hat brim | 1–2 | **white** |
| Face | 8 | **green** |
| Beard | 2–3 | **white** |
| Coat and belly | 6 | red |
| Belt | 2 | **black** |
| Trousers | 2 | red |
| Boots | 3 | **black** |

No two red bands touch. Every one of them is separated by white, green or
black, and each separator is at least one pixel at the smallest size he is
ever drawn. That is the whole trick, and it is worth checking against rather
than eyeballing: **render him at 32 pixels tall, in greyscale, and confirm the
bands are still distinguishable.** If they are, the costume works; if the red
runs together, widen the separator rather than removing a red part.

Two consequences of the numbers above:

- **The buckle is sub-pixel.** Inside a 2-pixel belt there is no room for it to
  be anything but a lighter speck. Model it if the geometry is free, but do not
  spend triangles or a material on it, and do not let it drive the belt's size.
- **Do not put white fur trim on everything.** The hem, the cuffs and the hat
  brim are the three that do structural work. Fur on the coat's front placket
  as well would add a vertical white line through the one red mass that is
  supposed to read as solid.

**Drop the baked texture.** This is six or seven flat colours. Use one material
per colour — green, red, white, black, and gold if the buckle survives — with
no texture at all, or a single small palette strip if the pipeline prefers one
map. `enemy.glb` carries seven named materials in 194 KB total. There is no
reason for Tode to cost ten times that to say less.

#### The belly changes his collision footprint

Worth knowing before it is discovered in play. `Collision.js` measures an
entity as a circle, averaging the model's two ground extents:
`(size.x + size.y) / 4`. Today Tode is 16.02 × 12.14 on the ground, giving a
radius of **7.04**.

A belly that widens him by, say, 18% in both ground axes takes that to
**8.31** — so he is blocked about 1.3 units further out from every house and
every obstacle. Against a `JUMP_DISTANCE` of 80 that is under 2% of a hop and
nothing needs retuning, but it is not zero, and it is measured automatically
from the new model, so it will change the moment the asset lands rather than
when someone decides to look. If the belly ends up much larger than that,
check he can still reach the doorsteps the spurs in `SnowRoads.js` lead to.

| Budget | Target | Why |
|---|---|---|
| Triangles | **≤ 4,000** | `enemy.glb` is 3,200 and reads fine at a smaller scale. Today's 10,740 buys nothing at 32 pixels, and a denser mesh is slower to weight and messier to sculpt shape keys on. Spend what there is on the belly's roundness and the hat, which are silhouette. |
| File size | **≤ 300 KB** | Not a bandwidth target — see the note at the end. It is a proxy: a Santa frog that comes in far over this has a bake in it, and a bake is what makes a model unriggable. |
| Materials | ≤ 6 | One per flat colour. |
| Texture | **none preferred** | If one is unavoidable, 256×256 is ample. |
| Bones | ≤ 20 | See below; the list is 11, 12 with the optional belly bone. |

#### The rig

A minimal armature. Nothing here needs IK, and nothing needs fingers.

`Root`, `Hips`, `Torso`, `Head`, `Hat_Tip`, `Arm.L`, `Arm.R`, `Hand.L`,
`Hand.R`, `Leg.L`, `Leg.R` — eleven bones, plus an optional `Belly`.

`Belly` is worth the one bone it costs: weight the front of the coat to it and
the belly settles a frame or two after the feet on every landing. It is the
cheapest possible way to make a hop feel weighted, and it is the one piece of
secondary motion on this character that is guaranteed to read, because the
belly is already the widest thing in the silhouette.

`Hat_Tip` is the one that is not obvious and the one most worth having: parent
the floppy end of the hat and the pompom to it, and the hat trails on every hop
for free. At this screen size a swinging pompom communicates "hopping" better
than the legs do.

#### The smile is a shape key, not a clip

This is the one structural decision in the spec, so it is worth stating plainly:
**expressions must be shape keys (morph targets), and body motion must be
skeletal clips.** They are two different mechanisms and the code drives them
separately.

The reason is layering. A smile that was authored as an animation clip could
not play *during* a hop — the mixer would crossfade one into the other and the
game would have to choose between Tode hopping and Tode smiling. As a shape
key, the smile is a weight on the mesh that is completely independent of
whatever the skeleton is doing, so he grins mid-air. `Animation.js` eases that
weight on a 170 ms ramp rather than switching it, so the grin arrives rather
than appearing.

**Shape keys** — exact names, matched case-insensitively:

| Key | Driven by | Notes |
|---|---|---|
| `smile` | **nothing, yet** | The one the whole task is named for. Make it big. It was wired to a monster kill; the monsters have since left the story, so it is waiting on the gift-catch system — see below. |
| `blink` | `Animation.js`, automatically | Fires every 2.4–6.8s, 0.12s closed-to-open, no game event needed. Lids down over both pupils. |
| `surprise` | nothing yet | Optional. Eyes wide, mouth open. Wired the day something wants it. |

Author each at full strength at weight 1. The code never sends a weight above
1, and never sends two conflicting keys at once.

**Clips** — exact names. Blender's exporter prefixes these with the armature
name (`CharacterArmature|Idle`); that is fine, `findClip` in `Animation.js`
matches on the tail after the `|`.

| Clip | Loop | Authored length | Notes |
|---|---|---|---|
| `Idle` | yes | ~2.0s | Breathing and a slow sway. Plays whenever he is not mid-hop, which is most of the game. |
| `Hop` | no | **0.5s** | Crouch, launch, tuck, land. Length is a suggestion — see below. |
| `Cheer` | no | ~1.0s | Optional, not wired. |
| `Defeat` | no | ~1.0s | Optional, not wired, and see the open question below before authoring it. |

**`Hop` does not have to be 0.5s, because the game stretches it.** The hop
advances by `moveSpeed` of its arc per frame, and `Difficulty.js` ramps
`moveSpeed` from 0.04 to 0.08, so a hop is 25 frames at the start of a run and
12.5 once difficulty tops out — **0.42s falling to 0.21s** at 60Hz.
`Movement.js` passes that figure to `play('Hop', { seconds })` and
`Animation.js` sets `timeScale` to `clip.duration / seconds`. Author the clip at
whatever length makes it readable; it will be fitted to the hop. What matters
is that the **launch is at the very start and the landing at the very end** of
the clip, because the arc it is fitted to is `sin(progress × π)` and the feet
have to leave and meet the ground with it.

#### The conventions the game imposes

These are not negotiable without a code change, and getting them wrong is the
usual way a character arrives sideways.

- **Y-up.** Standard glTF; Blender's exporter default. `Player.js` tips every
  model by `rotation.x = Math.PI / 2` because this game is Z-up, so the
  model's local +Y becomes world up.
- **Forward is local −Z**, the glTF convention. **Today's model gets this
  wrong**, which was measured while fitting the stopgap: `tode.glb`'s face is
  on **+Z**. After the quarter turn that puts his face at world −Y while
  `ArrowUp` sends him to +Y, so he currently hops backwards in every
  direction. `MODEL_BASE_ROTATION` is carrying half a turn to compensate, and
  **that compensation must be removed when the new model lands** — a correct
  asset plus the correction would be backwards all over again. See the open
  question below. After the tip, local −Z maps to
  world +Y, which is the direction `ArrowUp` sends him at a yaw of zero. In
  Blender, with its Z-up axes, that means **Tode faces +Y** — so in Front
  Ortho you are looking at his back. This trips people up; `winter_town` hit
  exactly this and carries `MODEL_BASE_ROTATION = Math.PI` as a result. If he
  comes out backwards, set the same constant at `Movement.js:17` rather than
  re-exporting.
- **Origin between the feet**, on the floor, at the model's horizontal centre.
  `Player.js` lifts the model by its own measured bounding box, so resting on
  the ground is automatic at any scale — but only if the origin is not
  somewhere absurd.
- **Proportions, and the two places the suit changes them.** Today's model is
  `1.0010 × 0.6345 × 0.7589` local units (width × height × depth), which
  `MODEL_SCALE = 16` makes 16.0 × 10.15 × 12.1 in the world.

  The costume deliberately moves both figures. **The hat adds height**: at a
  local 0.75 Tode becomes 12 units tall, 18% taller than today. **The belly
  adds width**, with the footprint consequence set out in its own section
  above. Both are wanted — Santa should read taller and rounder than a frog —
  so the thing to avoid is not the growth but growing *by accident*.

  Decide which number is being held. Holding his **height** at today's 10.15
  means `MODEL_SCALE` drops to about 13.5 and he gains only girth; holding
  `MODEL_SCALE` at 16 means he gains both and stands 12 units tall against
  houses that are 80 to the ridge. The recommendation is to hold
  `MODEL_SCALE = 16` and let him grow: he is currently 32 pixels tall on a
  1080p screen, and he has no pixels to spare.
- **Export with normals.** Not optional. Without them `GLTFLoader` forces
  `flatShading` on the material, which is how the current model ended up
  faceted.

#### What the game already does

Implemented and on `main`'s branch, so the asset is the only missing piece.

- **`Animation.js`** — new. Owns a `THREE.AnimationMixer` per model, a clock of
  its own (the pattern `Score.js` and `Attack.js` already use), clip lookup
  that tolerates the `Armature|` prefix, crossfading, time-scaled one-shots,
  eased shape-key weights, and the automatic blink. Exports `createAnimator`
  and `updateAnimations`.
  - `setExpression(name, weight, { seconds })` holds a face for a while and
    then eases it back to 0 on its own. This came out of `Attack.js`, which
    owned a timer to take the post-kill grin off again; as a property of the
    animator it means a caller that wants Tode to grin at something does not
    have to own a timer at all. **This is the call the gift systems want.**
  - The delta is clamped to 0.1s. The frame after the models load carries the
    whole load time, and the frame after a backgrounded tab returns carries
    the whole absence; either would run a one-shot clip past its end before it
    drew once.
- **`Player.js`** — builds the animator on load, exposes `player.animator`,
  starts `Idle`.
- **`Movement.js`** — plays `Hop` on each hop, stretched to that hop's length;
  returns to `Idle` when the hop ends, is refused at the world edge, or is
  blocked by a wall.
- **`Attack.js`** — carried the smile, on a monster kill. The whole file is
  **out of the game** now: the monsters it existed to fight left
  `game_story.md`, and the attack went with them. Its one lasting
  contribution moved into `Animation.js` before it went — see the hold below.
- **`main.js`** — one `updateAnimations()` per frame, outside the Game Over
  freeze. Outside it for a mechanical reason rather than an aesthetic one: the
  module reads a delta off its own clock, and a clock asked for a delta only
  on some frames banks the time in between.

Every one of those calls is `player.animator?.…` and every lookup misses
silently, so a partially finished asset — body clips but no face, say — works
for what it has.

#### Open questions

- **Tode hops backwards today, and the new asset is the fix.** Measured off
  the model: looking from −Z you see a blank slab with the eye blocks behind
  it, and from +Z you get the face, so the face is on +Z. With
  `rotation.x = π/2` the model's +Z maps to world −Y, while `ArrowUp` moves
  him to +Y — he faces the camera and travels away from it, and the same
  reversal applies to all four keys. Nobody noticed because a near-symmetrical
  green frog gives nothing away; a beard and a belly give it away immediately.
  **Fixed for now** by setting `MODEL_BASE_ROTATION = Math.PI` in
  `Movement.js`, the constant that exists for exactly this. That is a patch on
  the symptom: when the rebuilt model arrives facing −Z as this spec
  requires, the constant goes back to **0**. Anyone authoring the asset should
  treat that line as something they are expected to revert.

- **Do not author `Defeat` yet.** It was already awkward — `main.js` calls
  `setPlayerVisible(false)` on Game Over, so Tode is hidden on exactly the
  frame the clip would start. It is now moot as well: with the monsters
  commented out, **both** callers of `triggerGameOver` are gone and the run
  cannot end at all. The new story needs its own fail state before a defeat
  pose means anything.
- **The smile needs a trigger.** This is now the one thing standing between
  the rig and the feature it is named for. `game_story.md` offers two obvious
  hooks — catching a gift, and placing one by a house — and neither system
  exists yet (`core_loop/gift_catch/spec.md`, `core_loop/gift_delivery/spec.md`).
  Whichever lands first should call
  `player.animator?.setExpression('smile', 1, { seconds: 1.2 })`, which is the
  whole of it — the animator takes the grin back off by itself.
- **Does the Santa model replace `tode.glb` or sit beside it?** Replacing it is
  simpler and the story has him as Santa throughout. Keeping both means a
  second `MODEL_PATH` and a reason to choose. Recommendation: replace, and keep
  the old file in git history rather than in `public/`.
- **`enemy.glb` and its eight clips are now dead weight.** The monsters are
  commented out of `main.js`, `Movement.js` and `Attack.js`, so `Enemies.js`,
  `Enemy.js` and the 194 KB model are unreferenced. They are left in place
  deliberately — the chase is three uncommented lines away — but if the story
  is settled, deleting them is the honest cleanup, and `Difficulty.js` loses
  its `spawnDelay` and `enemySpeed` rows with them.

#### A note on the baked texture, which is not about file size

This project is developed and played locally and there is no plan to deploy
it, so nothing here is a download or bandwidth argument and the models being
25 MB costs nobody anything. Worth saying plainly, because the 1.59 MB PNG on
`tode.glb` invites that argument and it is the wrong one.

The reason it matters is what it says about how the model was made. A
1024×1024 bake for a frog with four flat colours is the output of an
automatic unwrap and a texture bake, and the same pass is what stripped the
normals and fused everything into one unnamed mesh. Those are the properties
that make the model impossible to rig, and they travel together: anything that
comes through `tools/convert_specular_glossiness.mjs` is likely to arrive in
the same state.

So the instruction in this spec is **author with flat materials, not a bake**
— not to save bytes, but because a model with named parts and real materials
is one you can select a jaw on, weight to a bone and give a shape key to. The
budget numbers above are there to keep the asset simple enough to rig and to
edit later, which is the only reason they are worth holding to.
