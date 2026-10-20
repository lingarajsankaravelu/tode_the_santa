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
| `MODEL_SCALE` | `9.7` | The file is 4.64 × 1.55 × 1.67 in its own units, so this makes it **45.0 long × 15.0 tall × 16.2 wide**. Tode is 16.0 wide and 17.0 tall with the hat, so he fits the width exactly and stands proud of the sides, which is what riding in something looks like. |
| `TODE_SCALE` | `16` | Unchanged from today. He is a child now, so this is relative to the sleigh's own space — divide by `MODEL_SCALE` when parenting, or parent him to the group instead and move him with it. |

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

#### Flight

Continuous, not stepped. Each frame the input gives a desired direction in the
camera's frame; the sleigh accelerates toward it and drags toward rest when
nothing is held.

| Constant | Value | Why |
|---|---|---|
| `CRUISE_SPEED` | `200` units/sec | The hop covered 80 units in 0.417s, which is 192 units/sec. Matching it means the field keeps the size it has always had and none of the placement numbers in the other specs need revisiting. |
| `ACCELERATION` | `420` units/sec² | Half a second from rest to cruise. Enough weight that the sleigh reads as a vehicle rather than a cursor, little enough that catching a gift is not a planning exercise. |
| `DRAG` | `2.2` per sec | Coasts to a near stop in about a second and a half once the keys are released. |
| `LIFT_SPEED` | `120` units/sec | Space climbs, Shift descends. Slower than cruise on purpose: altitude is the axis the gifts are spread along, so it should cost something to change. |
| `MIN_ALTITUDE` | `100` | **This is the constant that keeps `Collision.js` untouched.** A house is 80 to the ridge, so a floor at 100 means the sleigh can never strike one, and no scenery collision is needed anywhere in the flight model. |
| `MAX_ALTITUDE` | `400` | The camera sits 409 behind and 26° above; past about this the ground leaves the frame and the player is flying over an empty backdrop. |
| `BANK_ANGLE` | `0.45` rad max | Rolled into turns, proportional to how far the current heading is from the one asked for. The single cheapest thing that makes flight feel like flight. |
| `BANK_SMOOTHING` | `0.1` per frame | Same easing idiom as the camera's `FOLLOW_SMOOTHING`. |

Altitude is `player.position.z`, the same field the hop used to write. Clamp
it to the two limits rather than letting input run past them.

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
