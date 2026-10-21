### Specification for AI agent: The sleigh, and flight

> **Rewritten.** The outline this replaces described a sleigh parked in a
> field as a landmark, and recommended *cutting* driving: "a second movement
> model on top of the hop queue, and a large task."
>
> That recommendation is overruled, and the reason it was made no longer
> applies. It assumed flight would be a **second** movement model. It is now
> the **only** one: Tode rides the sleigh for the whole game, catching gifts
> in the air and dropping them over the houses, and the hop is removed rather
> than kept alongside. One model to build, not two — which was the outline's
> actual objection.

The player is the sleigh. Tode and his sack ride in it, and it flies.

#### What this replaces

`Movement.js` today is a discrete hop queue: one key press is one 80-unit
arc, `sin(progress × π) × 25` high, resolved against the camera. That whole
model goes. Keep the file and the name — `initInput`, `updateMovement(player,
enemies, obstacles)` and `resetMovement(player)` are called from `main.js` and
should keep their signatures — but the body becomes continuous flight.

What survives, and must not be re-derived:

- **Camera-relative input.** `MOVE_KEYS` maps W/S/A/D to forward and strafe in
  the camera's frame, and the direction is resolved against `getCameraYaw()`.
  This is already exactly what a flight model wants. Keep it verbatim.
- **`facingFor(direction)`**, which turns a ground direction into a model yaw,
  and `MODEL_BASE_ROTATION` with it.
- **`WORLD_RADIUS = 700`**. See the constraint below; it stays, for now.

#### The player becomes the sleigh

`Player.js` currently loads `tode.glb` into a `THREE.Group` and exposes
`player.model`. It now loads `snow_sleigh.glb` into that group, and Tode and
the sack become children of the sleigh model.

| Constant | Value | Why |
|---|---|---|
| `MODEL_PATH` | `/models/snow_sleigh.glb` | |
| `START_ALTITUDE` | `200` | Where a run opens. Mid-band rather than on the floor, so the first thing the player does is fly rather than climb, and inside the 140–360 band the gifts hang in so the first one needs no change of altitude to reach. |
| `MODEL_SCALE` | `16` | The file is 4.638 × 1.552 × 1.669 in its own units, so this makes it **74.2 long × 24.8 tall × 26.7 wide**, of which the carriage is 31.3 × 20.0 × 20.1. Corrected up from the 9.7 this spec first asked for, in two steps: at 45 long Tode was taller than the whole vehicle, and at 60 he fitted but was the only thing in it. The length is what the final figure is set by — Tode is 8.3 deep and the sack 6.7, so the pair take 15 of the carriage's 31.3 and ride one behind the other with room to spare. |
| `TODE_SCALE` | `11` | Down from the 16 he had as the player. 11.0 wide and 11.0 tall to the hat, in a carriage 20.1 across whose floor-to-top is 14.1 — comfortably inside, hat below the rim line. A passenger is smaller than what carries them. |
| `SACK_SCALE` | `4.4` | `empty_christmas_sack.glb` is 1.5647 × 1.7185 × 1.5298 in its own units, so this is **6.9 × 7.6 × 6.7**: about two thirds of Tode's height, which is the size a sack reads as when it belongs to someone rather than being cargo. |

Tode takes the front of the carriage and the sack rides behind him — forward
is +X, and the two sit at `-3.3` and `-4.1` in the sleigh's own units, 12.8
world units apart against the 7.5 their half-depths need. Both are stood on
the carriage floor by their own measured box, which is safe for these two and
not for the sleigh: neither carries a skin.

The sack is the **empty** one, and that is the story rather than a
placeholder — the storm took the gifts before the game starts, so it stays
empty until Tode catches them back.

> **Do not measure the sleigh with `Box3.setFromObject`.** Twelve of its
> meshes are skinned, and glTF requires a skinned mesh node's own transform to
> be ignored, so three.js leaves that geometry in bind space at a matrix that
> has nothing to do with where it draws. Asked for this model's box, three.js
> answers **241.5 × 593.3 × 138.2 centred at (−102.3, 355.6, 59.4)**; the
> truth, from walking the node transforms of the unskinned geometry, is
> **min (−4.5788, 5.8243, −0.4744), max (0.059, 7.3768, 1.1942)**. Recentring
> on the former puts the sleigh several hundred units from the player, where
> it is simply never on screen while flight carries on working normally.
> `Player.js` carries those bounds as a constant. This is the same trap as the
> note in `game_story.md` about raw accessor numbers lying on multi-node
> models — they lie differently again on skinned ones.

The riders stay. `snow_sleigh.glb` carries four skinned humanoid characters —
61 joints each, `Bip002`-named, with facial bones — and they are 12,288 of
its 99,163 triangles. They are a style collision with a flat-shaded cartoon
frog and that is accepted: the alternative is a static sleigh, because **the
`run` clip animates the riders and nothing else**. 495 channels over 233
nodes, all of it their skeletons.

Play it through the layer that already exists:

```js
player.animator = createAnimator(model, gltf.animations);
player.animator?.play('Run', { loop: true });
```

`Animation.js` matches on the tail after `|`, so the clip resolves whatever
the exporter called it. This is the first real user of that module.

**And drive its rate off the sleigh's speed**, which is not optional once you
see it: at a fixed rate the four pullers sprint on the spot every time the
sleigh stops. `Animation.js` gained a `setTimeScale` for this, called each
frame with `speed / CRUISE_SPEED`. They slow as the sleigh slows and settle
when it settles, which is the nearest this asset gets to a standing pose —
there is no second clip to cut to, and at a time scale of 0 they freeze
mid-stride, so it has to be eased rather than switched.

**One animator covers both models.** It is built over the group holding the
sleigh and Tode together, so it finds `run` among the sleigh's clips and will
find Tode's shape keys in the same pass whenever the rigged asset lands. The
`setExpression('smile')` calls the gift specs make therefore land on the same
object as the clip above, with no second animator and no second wiring.

#### Flight

Continuous, not stepped. Each frame the input gives a desired direction in the
camera's frame; the sleigh accelerates toward it and drags toward rest when
nothing is held.

| Constant | Value | Why |
|---|---|---|
| `CRUISE_SPEED` | `200` units/sec | The hop covered 80 units in 0.417s, which is 192 units/sec. Matching it means the field keeps the size it has always had and none of the placement numbers in the other specs need revisiting. |
| `ACCELERATION` | `420` units/sec² | Half a second from rest to cruise. Enough weight that the sleigh reads as a vehicle rather than a cursor, little enough that catching a gift is not a planning exercise. |
| `DRAG` | `2.2` per sec | Coasts to a near stop in about a second and a half once the keys are released. |
| `LIFT_SPEED` | `120` units/sec | **Q climbs, E descends** — they sit beside WASD, so a hand on the movement keys changes height without leaving them. Space and Shift are kept as aliases, and Space's binding here is temporary: `core_loop/gift_delivery/spec.md` wants it for the drop and `GameState.js` claims it for restart, and now that Q and E exist nothing is lost by unbinding it. Slower than cruise on purpose: altitude is the axis the gifts are spread along, so it should cost something to change. |
| ~~`MIN_ALTITUDE`~~ | **gone** | See the section below. The sleigh lands now, so there is no floor. |
| `HOUSE_RIDGE` | `80` | What the old floor was justified against, and now the altitude at which the collision test switches on rather than a limit on where the sleigh may go. |
| `MAX_ALTITUDE` | `400` | The camera sits 409 behind and 26° above; past about this the ground leaves the frame and the player is flying over an empty backdrop. |
| `BANK_ANGLE` | `0.45` rad max | Rolled into turns, proportional to how far the current heading is from the one asked for. The single cheapest thing that makes flight feel like flight. |
| `BANK_SMOOTHING` | `0.1` per frame | Same easing idiom as the camera's `FOLLOW_SMOOTHING`. |

Altitude is `player.position.z`, the same field the hop used to write.

#### Landing, and the floor that is no longer there

**This overrules the `MIN_ALTITUDE = 100` above, and the saving it bought.**
Q climbs and **E lands the sleigh on the snow**, which the first draft of this
spec did not allow for: it kept a hard floor at 100 precisely so that nothing
in the flight model would ever need to know about scenery.

What replaces it is the same saving under a narrower rule — collision is
conditional on altitude rather than absent:

| | |
|---|---|
| **Resting altitude** | Half the sleigh's own height, `10.09`. `player.position` is its centre, so this puts the runners on the ground. Measured onto `player.restAltitude` in `Player.js` rather than written here as a number, because it is a function of `MODEL_SCALE`. |
| **Above `HOUSE_RIDGE + 10.09`** | Nothing is tested. There is nothing in the sky, which is what the old floor was really asserting. |
| **Below it** | `isPositionFree` blocks horizontal movement into a plot, and the sleigh stops rather than sliding along. A vehicle is not a character squeezing past a wall, and the player has the whole vertical axis available to go over it instead. |
| **Descending onto a plot** | The floor rises to the ridge. Without this the player could fly high over the town, press E, and descend straight through a roof — the horizontal test cannot catch that, because it only refuses movement *across* the ground. |

**`player.collisionRadius` is set in `Player.js`, not measured.** Two reasons,
and both are traps:

- `Collision.js` measures with `Box3.setFromObject`, which cannot measure this
  model at all — see the warning above. It would return a radius in the
  hundreds and the sleigh would be stopped by houses it was nowhere near.
- Its convention is the average of the two ground half-extents, which is a
  good circle for a roughly round character and a poor one for something 2.8
  times longer than it is wide. The average gives 20.5 against a nose that
  reaches 30.1, so the sleigh would clip roofs lengthwise. The **half-length,
  30.15**, is used instead; it stops the sleigh slightly early side-on, which
  is the right way round for a vehicle.

**What this costs the other specs.** `core_loop/gift_delivery/spec.md` opens
by arguing that delivery must be a drop because "`MIN_ALTITUDE = 100` keeps
the sleigh clear of the 80-unit ridges, so he never gets near a wall". That
premise is now false. The drop is still the better mechanic and the rest of
that spec stands, but its reasoning needs rewriting and the possibility of
landing at a doorstep has to be either used or ruled out deliberately.

Face the model along its velocity with the existing `facingFor`, not along the
key that was pressed — with momentum those differ, and following the velocity
is what makes a drifting turn look right.

#### What this deletes

- The hop: `JUMP_HEIGHT`, `JUMP_DISTANCE`, the `inputQueue`, `currentMove`,
  `startMove`, `cancelMove` and the per-frame progress walk.
- The `Hop` and `Idle` clips in the appearance spec have nothing to play on a
  frog who is sitting down. **Leave them in that spec** — the rigged model
  still wants them for the title screen and for any later scene where Tode is
  on his feet — but nothing in the running game will call them, and
  `Movement.js` should stop asking for them.
- `getDifficulty().moveSpeed`. The difficulty table ramped it from 0.04 to
  0.08 to make the monsters harder to escape; the monsters are gone and
  flight is a fixed-speed vehicle. Drop the row.

#### Constraints

- **The snowfall band moves with the player.** `Snow.js` built its field from
  z = 0 up to about 150, which was the same thing as "around the player" while
  Tode stood on the ground. It is not any more: at `START_ALTITUDE` the whole
  snowfall would be a mat two hundred units below the sleigh. The band is now
  anchored to `player.position.z`, so the sleigh flies *through* the weather.
  This is a change to `visual/snowfall/spec.md`'s territory, made here because
  flight is what broke it.
- **`WORLD_RADIUS = 700` stays.** It is tempting to lift it now that height is
  available — the bound exists only because Tode was pinned at z = 0 and the
  ground rises outside the basin, which flight makes irrelevant. But nothing
  in this project samples terrain height, and `river_landscape.glb` is a mesh,
  not a heightfield. Flying out over the hills needs a height query written
  first, and that is its own task. Clamp the horizontal position to 700 as
  `Movement.js` already does.
- **No scenery collision.** `MIN_ALTITUDE` is doing that job. If the floor is
  ever lowered, this stops being true and `Collision.js` needs an altitude
  term — it measures ground circles and knows nothing about Z.
- **The sleigh is not an obstacle to anything.** Nothing else moves.

#### Research

99,163 triangles is the heaviest thing in the game and it is on screen every
frame, which the town at 252,390 is not — the town is partly behind the
camera most of the time. Of that, 51,935 is a single mesh called
`Polygon_Reduction_1_Material_0_0`, which is the sleigh body and is named
after a decimation that evidently did not go far enough.

Not a download question; this runs locally. But it is the one asset whose
triangle count is paid on every single frame, and if the frame rate becomes a
problem this is the first place to look, well before the gift boxes.
