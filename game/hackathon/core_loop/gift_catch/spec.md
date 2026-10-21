### Specification for AI agent: Gift catching

> **Rewritten for flight.** An earlier pass of this spec had Tode hopping
> under falling gifts, with the catch resolved by a vertical reach band
> around a 25-unit hop arc. The game no longer works that way: Tode and his
> sack ride the sleigh for the whole run, and the hop is gone. See
> `skeleton/sleigh/spec.md`, which owns the flight model and is a
> **prerequisite for this task** — none of the numbers below mean anything
> until it lands.
>
> What survived the rewrite, because it was never about hopping: five gifts,
> one in the air at a time, `Enemies.js` as the structural pattern, a
> `Score.js`-style counter, burning the delta on init and reset, and a run
> that cannot become unwinnable.

The first phase of the story: the storm has taken Tode's gifts and is holding
them up there. He flies after them and catches all five.

#### The gifts never land, and that is the design

The storm will not let them fall — the story says so, and `opening_scene.md`
has them "swirling across the screen with cute tornado". That is not just
flavour, it is what makes the phase safe.

With flight the floor is `MIN_ALTITUDE = 100`, which is what keeps the sleigh
clear of the 80-unit house ridges without any scenery collision. A gift that
fell past 100 would be permanently out of reach, and with no fail state in
the game there is nothing to lose the run *to* — it would simply be a dead
end. So gifts hover, bob and drift, and the only way to miss one is to not go
and get it.

#### The model

`a_gift_box.glb` — **225 × 293.29 × 225** in its own units, Y up. One present
built from 16 primitives, normals, two materials, no texture.

| Constant | Value | Why |
|---|---|---|
| `MODEL_PATH` | `/models/a_gift_box.glb` | |
| `MODEL_SCALE` | `0.038` | **8.6 wide × 11.1 tall × 8.6 deep** in world units (the 293.29 axis is Y, which is up). Bigger than the hop version's 7, because it is now judged against a 45-unit sleigh rather than a 16-unit frog, and it has to be spottable at altitude across an open field. |
| `SPIN_SPEED` | `1.2` rad/s | About the up axis. A present turning in the wind, and it catches the light differently as it goes, which is most of what makes it visible at distance. |

Load the file **once and clone it**, not `loader.load` per gift the way
`Enemies.js` does. 123,440 triangles is too much to re-parse five times, and
`gltf.scene.clone()` shares the geometry so it uploads once.

Then the house pattern from `Player.js`: scale, `rotation.x = Math.PI / 2`
because this game is Z-up, and position from the spawn rules below. Do **not**
lift it by its bounding box — that step exists to rest things on the ground
and nothing here touches the ground.

#### Where they hang

| Constant | Value | Why |
|---|---|---|
| `GIFT_TOTAL` | `5` | The story, which now agrees with itself. One per house, so delivery needs no arithmetic of its own. |
| `MIN_RADIUS` | `120` | From the origin, horizontally. Closer than this and the first gift is on top of the sleigh's start. |
| `MAX_RADIUS` | `600` | Inside `WORLD_RADIUS = 700` with 100 units of margin, so a gift is never pinned against a bound the sleigh cannot cross. |
| `MIN_HEIGHT` | `140` | 40 clear of the `MIN_ALTITUDE` floor of 100. |
| `MAX_HEIGHT` | `360` | 40 under the `MAX_ALTITUDE` ceiling of 400. |
| `SPAWN_GAP` | `1.5` sec | Between one gift being caught and the next appearing. |

Pick the angle over the full circle, the radius in the band, and **the height
independently of both**. Spreading them across 140–360 is what makes climbing
and descending part of the game rather than decoration — it is the axis the
flight model's slower `LIFT_SPEED` was tuned for.

Only one gift exists at a time. The story asks for it ("one after the other"),
and it also caps a 123,440-triangle model at one instance on screen.

Each gift also drifts, so it is a moving target rather than a waypoint:

| Constant | Value | Why |
|---|---|---|
| `BOB_AMPLITUDE` | `14` units | Vertical, about its spawn height. Well inside the 40-unit margins above and below, so a bobbing gift can never cross the flight limits. |
| `BOB_PERIOD` | `3.2` sec | Slow enough to lead, fast enough to notice. |
| `DRIFT_SPEED` | `18` units/sec | A slow horizontal wander, re-aimed every few seconds. Under a tenth of the sleigh's 200 cruise, so it is a nudge, never a chase. |

Clamp the drift to `MAX_RADIUS` so a gift cannot wander out of the world.

#### The catch test

**`Collision.js` cannot do this one.** Its `wouldCollide` measures both bodies
as circles on the ground plane and knows nothing about Z — which was right for
a game where everything stood on the floor, and is wrong now that the whole
phase happens at altitude. A 2D test would let the sleigh collect a gift 200
units below it.

Use a straight 3D distance between the sleigh's position and the gift's:

```
Math.hypot(gift.x - player.x, gift.y - player.y, gift.z - player.z) < CATCH_RADIUS
```

| Constant | Value | Why |
|---|---|---|
| `CATCH_RADIUS` | `49` | **Revised.** This was 34, from a sleigh 45 long with a half-extent of 22.5 at the nose. `MODEL_SCALE` is 16 now and the sleigh is 74.2 long, so the nose reaches 37.1; the gift is about 5.5, and 49 keeps the same ~6 units of slack the original figure was chosen for. Generous enough that a near miss at 200 units/sec still counts, tight enough that you have to aim. |

Do not add an altitude term to `Collision.js` for this. That module is for
things standing on the ground, and the delivery phase will still want it that
way.

#### On a catch

- Remove the gift from the scene and from the tracking array, the way
  `removeEnemy` does — splice by index, safe to call while iterating.
- Increment the count, and schedule the next spawn `SPAWN_GAP` later.
- **`player.animator?.setExpression('smile', 1, { seconds: 1.2 })`.** This is
  the line the appearance spec has been waiting for. The smile was wired to a
  monster kill and lost its trigger when the monsters left; catching a gift is
  its home. The animator holds the grin and takes it off itself, so there is
  no timer to own here. It does nothing until the rigged Tode lands, and costs
  nothing meanwhile.
- Award points. `Score.js` still exports `addKillScore` with no caller since
  the attack went dormant — rename it `addCatchScore` rather than adding a
  second function next to a dead one.

#### The counter

`Score.js` is the idiom: own a `div`, write to it only when the rendered value
changes, let `style.css` place it.

- Class `gift-count`, text `Gifts 3 / 5`.
- Styled like `.god-mode` and `.music-muted`, positioned **top centre at
  58px**, under the score, which sits at 16px and is 32px tall. With the
  monsters gone the score is a survival timer and little else; the gift count
  is the readout that matters now and belongs beside it.
- `pointer-events: none`, like every other readout. This matters more than it
  used to — the canvas needs its clicks for pointer lock.

#### Wiring

A new `Gifts.js` in `game/src/components/`, exporting `updateGifts(scene,
player)`, `resetGifts(scene)`, `allCaught()` and the `gifts` array. Follow
`Enemies.js`: its own `THREE.Clock`, a tracking array, one pass per frame, and
a remove that mutates safely while iterating.

- Call `updateGifts(scene, player)` from the render loop in `main.js`, inside
  the `isGameOver()` guard alongside `updateMovement`. No obstacle list — a
  gift in the air cannot hit anything.
- Call `resetGifts(scene)` from `onRestart`, next to `resetMovement`.
- **Burn `clock.getDelta()` on init and on reset.** Every timed system here
  does. The wall time spent loading a 3.5 MB model otherwise gets paid out on
  the first frame, as a gift that has already drifted halfway across the map.

#### What this does not do

This spec ends at `allCaught()` returning true. The story then has Tode fly on
to the houses and drop a present over each, which is `gift_delivery`.

Two notes for whoever writes that one:

- `christmas_gift_sack.glb` is **2.2821 × 2.2818 × 2.2883** and
  `empty_christmas_sack.glb` is **1.5647 × 1.7185 × 1.5298**, both in their
  own units. **An earlier draft of this spec said they matched to within 3%,
  at 2.34 × 2.36 × 2.57 against 2.34 × 2.29 × 2.57. That was wrong** — those
  were raw accessor numbers, the exact lie `game_story.md` warns about on
  multi-node models. The full sack is 46% wider and 33% taller than the empty
  one. That is not a problem and is arguably right, since a full sack should
  look full, but it does mean the swap is **not** a visibility toggle at one
  transform: the replacement has to be re-stood on the carriage floor by its
  own box, the way `Player.js` already stands the empty one.
  The obvious moment for the swap is the fifth catch.
- Delivery is the one phase that has to care about the ground again, since a
  present has to end up at a house. `MIN_ALTITUDE = 100` means the sleigh
  cannot descend to place one, so it is a drop — which is also the only thing
  that keeps `Collision.js` out of the flight model.

#### Constraints

- Gifts are not obstacles and nothing collides with them but the catch test.
- No gift can be lost, expire, or become unreachable.
- No difficulty ramp. `Difficulty.js` existed to make monsters harder over a
  run; they are gone, and five fixed gifts have no curve. Do not add a row.

#### Research

`a_gift_box.glb` is **123,440 triangles** for one present — eleven times the
whole frog. One at a time keeps that bounded, and cloning keeps it to a single
geometry upload, so it should not be the thing that hurts.

If the frame rate does suffer, the sleigh is the bigger target: 99,163
triangles, on screen every frame, 51,935 of them in one mesh named after a
polygon reduction that evidently did not go far enough. Neither of these is a
download concern — this project runs locally — but the sleigh is paid every
frame and the gift is not.
