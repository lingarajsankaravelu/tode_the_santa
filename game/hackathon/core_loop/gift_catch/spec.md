### Specification for AI agent: Gift catching

> **Third amendment, after play. Three changes, one of them a correction.**
>
> - **The drop is slow.** `FALL_SPEED` is `11`, not `28`, so a fall lasts 25 to
>   50 seconds instead of 10 to 20. The clock is the score, so the fall is not
>   a race the player runs against — it is the margin before a mistake becomes
>   fatal, and a wide margin costs a fast player nothing. What it removes is
>   the run that ended because a gift spawned astern while the sleigh was
>   pointed the other way.
> - **Each gift comes down under a handkerchief parachute**, with a blinking
>   beacon at the top of the canopy. New module `Parachute.js`, asset-free:
>   a displaced `PlaneGeometry` square, four `LineSegments` strings to a knot
>   above the lid, and one additive `fog: false` bulb strobing at 1.5 Hz. The
>   chute is what makes an 11-unit-per-second descent read as deliberate
>   rather than as broken physics, and the strobe is now the long-range cue in
>   its own right: `GiftBeacon.js`'s beam was removed once this landed, because
>   a light that belongs to the gift beats a light painted under it. Consequence for the implementation:
>   a gift is now a `THREE.Group` holding `gift.box` (the cloned model, with
>   the 0.038 scale and the Z-up quarter turn) and the chute, which must not
>   inherit either. `gift.position` is unchanged and is still the only thing
>   any other module reads.
> - **Only the ground loses a gift.** The fail test was `crashFloorAt`, which
>   lifts to the treetops outside `PLANTED_RADIUS`, so a present drifting over
>   the forest was lost 130 units up with clear air beneath it. It is
>   `groundHeightAt` now — the same line `GiftBeacon.js` already stands its
>   beam and its ring on, so what the player is shown and what ends the run
>   agree. The *sleigh* still crashes against the canopy; it is a vehicle.
>
> `URGENCY_HEIGHT` in `GiftBeacon.js` dropped from 420 to 160 to follow the
> slower fall: a ring that spends 38 seconds quickening is weather, not a
> warning.

> **Overruled on one point, after shipping. Read this first.**
>
> This document's central rule — "the gifts never land, and that is still the
> design", and the constraint "no gift can be lost, expire, or become
> unreachable" — **is no longer what the game does.** The theme changed from a
> collection to a race: `Score.js` is retired, `Timer.js` counts the run, and
> the game is how fast Santa can catch five gifts and deliver them. A gift that
> hangs in the air indefinitely has no stake in a clock, so they fall, and one
> reaching the ground ends the run.
>
> Everything else below still stands and is still implemented: five gifts, one
> in the air at a time, `Enemies.js` as the structural pattern, the model
> loaded once and cloned, the 3D catch test at `CATCH_RADIUS = 49`, the smile,
> the counter, and burning the delta on init and reset.
>
> Two sections are superseded outright. **"Where they hang"**: gifts now spawn
> in a band measured from the *sleigh* rather than from the origin, because
> `WORLD_RADIUS` went from 700 to 1600 and a fixed band around the centre could
> put a gift sixteen seconds away from a fall that lasts ten. **The `MIN_HEIGHT`
> / 92.42 argument**: still correct about the house keep-out disc, but the fix
> is now `PLOT_KEEPOUT = 160` in the spawn — the alternative this spec named
> and rejected, "exclude the five plots from the spawn circle" — because a
> falling gift passes through the keep-out band wherever it is and cannot be
> kept above it. `BOB_AMPLITUDE` and `BOB_PERIOD` are gone; the fall is the
> vertical motion now.

> **Second revision, and this one is against shipped code.** The first draft
> had Tode hopping under falling gifts. The second was rewritten for flight
> while flight was still a spec, and it guessed one number wrong in a way that
> runs through the whole document: it assumed a hard floor of
> `MIN_ALTITUDE = 100`, and reasoned from it four separate times.
>
> **There is no such constant.** `skeleton/sleigh` is implemented now and the
> sleigh lands. The floor is `restAltitude = 12.42` over open snow, rising to
> `HOUSE_RIDGE + restAltitude = 92.42` over an occupied plot, and `Q`/`E` take
> the sleigh between the snow and the ceiling at 400. Everything below has
> been re-derived from the constants in `Movement.js` as it stands.
>
> What survived all three passes, because none of it was ever about the floor:
> five gifts, one in the air at a time, `Enemies.js` as the structural
> pattern, a `Score.js`-style counter, burning the delta on init and reset,
> and a run that cannot become unwinnable.

The first phase of the story: the storm has taken Tode's gifts and is holding
them up there. He flies after them and catches all five.

#### Prerequisite

`skeleton/sleigh/spec.md`, **implemented and merged**. The numbers this spec
reads from it:

| From `Movement.js` | Value |
|---|---|
| `CRUISE_SPEED` | 200 |
| `LIFT_SPEED` | 120 |
| `HOUSE_RIDGE` | 80 |
| `MAX_ALTITUDE` | 400 |
| `START_ALTITUDE` | 200 |
| `WORLD_RADIUS` | 700 |
| `player.restAltitude` (from `Player.js`) | 12.42 |
| `player.collisionRadius` (from `Player.js`) | 37.10 |

#### The gifts never land, and that is still the design

The storm will not let them fall — the story says so, and `opening_scene.md`
has them "swirling across the screen with cute tornado".

The old reasoning for this was that a gift below the hard floor would be
permanently out of reach. That reason is gone: the sleigh can now be put on
the snow, so a gift lying in a field would simply be driven to. The rule
stays anyway, for two better reasons. It is the story. And a gift on the
ground is a gift the player walks a 74-unit vehicle into at 200 units/sec,
which is a collision problem this phase does not otherwise have.

#### The model

`a_gift_box.glb` — **225 × 293.29 × 225** in its own units, Y up. One present
built from 16 primitives, normals, two materials, no texture.

| Constant | Value | Why |
|---|---|---|
| `MODEL_PATH` | `/models/a_gift_box.glb` | |
| `MODEL_SCALE` | `0.038` | **8.55 wide × 11.15 tall × 8.55 deep** in world units (the 293.29 axis is Y, which is up). Judged against a 74-unit sleigh, not a 16-unit frog, and it has to be spottable at altitude across an open field. |
| `SPIN_SPEED` | `1.2` rad/s | About the up axis. A present turning in the wind, catching the light differently as it goes, which is most of what makes it visible at distance. |

Load the file **once and clone it**, not `loader.load` per gift the way
`Enemies.js` does. 123,440 triangles is too much to re-parse five times, and
`gltf.scene.clone()` shares the geometry so it uploads once.

Then the house pattern from `Player.js`: scale, `rotation.x = Math.PI / 2`
because this game is Z-up, and position from the spawn rules below. Do **not**
lift it by its bounding box — that step exists to rest things on the ground
and nothing here touches the ground.

`a_gift_box.glb` has no skin, so `Box3.setFromObject` is safe on it. That is
worth saying out loud in a project where it is not safe on the sleigh.

#### Where they hang

| Constant | Value | Why |
|---|---|---|
| `GIFT_TOTAL` | `5` | The story. One per house, so delivery needs no arithmetic of its own. |
| `MIN_RADIUS` | `120` | From the origin, horizontally. Closer than this and the first gift is on top of the sleigh's start. |
| `MAX_RADIUS` | `600` | Inside `WORLD_RADIUS = 700` with 100 units of margin, so a gift is never pinned against a bound the sleigh cannot cross. |
| `MIN_HEIGHT` | `140` | **Re-derived.** See below — this is the one number the missing floor really moved. |
| `MAX_HEIGHT` | `360` | 40 under the ceiling at 400. |
| `SPAWN_GAP` | `1.5` sec | Between one gift being caught and the next appearing. |

Pick the angle over the full circle, the radius in the band, and **the height
independently of both**. Spreading them across 140–360 is what makes climbing
and descending part of the game rather than decoration — it is the axis the
slower `LIFT_SPEED` of 120 was tuned for. Crossing that band costs 2.6
seconds at full lift, against the 3 seconds it takes to fly 600 units.

##### Why `MIN_HEIGHT` is still 140, for a completely different reason

The old justification was "40 clear of the floor at 100". The floor over open
snow is 12.42, so by that argument 140 is now 128 units of wasted headroom and
the gifts could hang much lower.

They must not, and the reason is the floor that is *not* flat. Over an
occupied plot `floorFor` returns `HOUSE_RIDGE + restAltitude = 92.42`, and
below that height `Movement.js` blocks horizontally against the house. A
house's own radius is 45.7 — up to about 65 when its yaw puts the axis-aligned
box at a diagonal — so with the sleigh's 37.10 and the 8-unit clearance the
keep-out disc around a house centre runs **90.8 to 110.1 units**.

A gift hanging low over a plot is therefore reachable only from outside that
disc, and the catch radius is 49. Put a gift 50 units up over a house centre
and the nearest the sleigh can legally get is 90.8 away horizontally: the test
can never pass, the gift can never be caught, and the run is dead with no fail
state to end it.

140 with a 14-unit bob bottoms out at **126**, which is 33.6 clear of the
92.42 ceiling-of-the-floor. Above that height the keep-out disc does not
apply at all — `canHitScenery` is false — so the sleigh can sit directly over
a chimney. **This is the constraint that replaces the old floor, and it is a
hard one: `MIN_HEIGHT - BOB_AMPLITUDE` must stay above 92.42.** Anyone
lowering `MIN_HEIGHT` has to either keep that margin or exclude the five plots
from the spawn circle, and the margin is much cheaper.

Only one gift exists at a time. The story asks for it ("one after the other"),
and it also caps a 123,440-triangle model at one instance on screen.

Each gift also drifts, so it is a moving target rather than a waypoint:

| Constant | Value | Why |
|---|---|---|
| `BOB_AMPLITUDE` | `14` units | Vertical, about its spawn height. Inside the margins above and below, so a bobbing gift crosses neither the ceiling nor the 92.42 line. |
| `BOB_PERIOD` | `3.2` sec | Slow enough to lead, fast enough to notice. |
| `DRIFT_SPEED` | `18` units/sec | A slow horizontal wander, re-aimed every few seconds. Under a tenth of the 200 cruise, so it is a nudge, never a chase. |

Clamp the drift to `MAX_RADIUS` so a gift cannot wander out of the world. The
drift is horizontal only — if it ever gains a vertical term, that term has to
respect the 92.42 line too.

#### The catch test

**`Collision.js` cannot do this one.** Its `wouldCollide` measures both bodies
as circles on the ground plane and knows nothing about Z. It is in the flight
model now, but only for scenery below the ridge, and widening it to gifts
would put a vertical term into a module whose whole job is the ground plane.

Use a straight 3D distance between the sleigh's position and the gift's:

```
Math.hypot(gift.x - player.x, gift.y - player.y, gift.z - player.z) < CATCH_RADIUS
```

| Constant | Value | Why |
|---|---|---|
| `CATCH_RADIUS` | `49` | The sleigh is 74.2 long, so its nose reaches 37.1 from `player.position`; the gift is about 5.5 from its own centre to a corner. 49 leaves roughly 6 units of slack — generous enough that a near miss at 200 units/sec still counts, tight enough that you have to aim. |

The sleigh is 2.8 times longer than it is wide, and this test is a sphere. A
gift taken 40 units off the beam counts as caught while visibly beside the
sleigh rather than in it. That is the correct trade for a catching game and is
the same call `Player.js` makes when it uses the half-length for
`collisionRadius`: be generous lengthwise, and accept that the generosity is
isotropic.

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
- **On the fifth catch, swap the sack.** The details are in
  `gift_delivery/spec.md`, which owns both sack models; this phase owns only
  the moment. Doing it here rather than there is what makes the sleigh look
  loaded for the flight to town.

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
- Guard on `player.ready`. `Player.js` sets it once all three of its models
  are in, and `Movement.js` already holds its own clock still until then; a
  catch test against a sleigh whose position is still the construction default
  is a catch at the wrong place.

#### What this does not do

This spec ends at `allCaught()` returning true. The story then has Tode fly on
to the houses and drop a present over each, which is `gift_delivery`.

#### Constraints

- Gifts are not obstacles and nothing collides with them but the catch test.
- No gift can be lost, expire, or become unreachable. The 92.42 line above is
  the live half of that promise.
- No difficulty ramp. `Difficulty.js` existed to make monsters harder over a
  run; they are gone, its `moveSpeed` row went with the flight model, and five
  fixed gifts have no curve. Do not add a row.

#### Research

`a_gift_box.glb` is **123,440 triangles** for one present — eleven times the
whole frog. One at a time keeps that bounded, and cloning keeps it to a single
geometry upload, so it should not be the thing that hurts.

If the frame rate does suffer, the sleigh is the bigger target: 99,163
triangles, on screen every frame, 51,935 of them in one mesh named after a
polygon reduction that evidently did not go far enough. It also now carries
two point lights and a 5-bulb sprite string from `SleighLights.js`, which is
negligible beside the triangles but is the newest thing in the frame and
therefore the first thing anyone will blame.
