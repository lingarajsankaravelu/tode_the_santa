### Specification for AI agent: Gift delivery

> **Second revision.** The first promoted this from an outline on the strength
> of one sentence: *"He cannot walk up to a house — `MIN_ALTITUDE = 100` keeps
> the sleigh clear of the 80-unit ridges, so he never gets near a wall.
> Delivery is a drop."*
>
> That sentence is now false in both halves. `skeleton/sleigh` shipped with
> `Q`/`E` and the sleigh lands on the snow; there is no `MIN_ALTITUDE`, and
> `Collision.js` is back in the flight model below the ridge. The player can
> fly to a house, descend, and park beside it.
>
> **Delivery is still a drop**, and the rest of this spec is mostly intact —
> but it is a drop by choice now rather than by impossibility, and the choice
> has to be argued rather than asserted. That argument is the new section
> below, and it changes one constant and one key.

The second half of the story: five gifts in the sack, five houses, one each,
dropped from the air as Tode passes over.

#### Depends on

- `skeleton/sleigh/spec.md` — **implemented and merged.**
- `core_loop/gift_catch/spec.md` — for the five gifts, the shared
  `a_gift_box.glb` loader, the counter and `allCaught()`. **Not implemented.**
  Build it first; this spec reads its `MODEL_SCALE` and its counter element.

#### Why it is a drop, now that landing exists

Landing does not make hand delivery possible, and this is worth checking
rather than assuming, because it nearly is.

Houses stand at `TOWN_RADIUS = 480`. A house's measured radius is 45.7, up to
about 65 for one whose yaw puts its axis-aligned box on the diagonal. The
sleigh's is 37.10 and `Collision.js` adds 8 of clearance, so the keep-out disc
around a house centre is **90.8 to 110.1 units**, and below `HOUSE_RIDGE + 
restAltitude = 92.42` the sleigh is held outside it.

The doorstep is 51.2 units inside the house centre. **The sleigh physically
cannot be parked at a door**: it is stopped 40 to 59 units short of one, by
the same collision that stops it flying through the wall. Hand delivery would
mean either shrinking the keep-out until the sleigh clips porches, or giving
the player a detach-and-walk mode for a character who has no walk animation
and whose model is a single fused mesh.

So: a drop, for a reason that holds. What landing *does* change is the bottom
of the difficulty range — see the table below — and it makes an approach at
low altitude a real tactic rather than an unreachable one.

#### Where a gift has to land

Each house has one target: a point on the ground, on that house's own angle,
at a fixed radius from the origin.

| Constant | Value | Why |
|---|---|---|
| `DOORSTEP_RADIUS` | `428.8` | The centre of the house's path spur, which `SnowRoads.js` already puts there. Walking out from the middle of the town the plot reads: lantern 407.7, **path 428.8**, lantern 433.7, porch column 437.5, front door 453.7. So 428.8 is the one patch in the corridor clear of the lanterns, clear of the porch, and still unmistakably at the door. A gift landing there sits on the snow path, which also looks deliberate. |
| `DELIVERY_RADIUS` | `70` | How close the landing has to be. Adjacent doorsteps are `2 × 428.8 × sin(13.75°) = 203.8` apart — the town spans 110° over five houses, so 27.5° between neighbours — leaving 64 units of gap between two 70-unit circles. A drop can never be ambiguous about which house it was meant for. |

Derive the angle with `houseAngle(index)` from `House.js`, which already
exists and which `SnowRoads.js` already uses for exactly this. Do not restate
the five angles; the snow roads spec learned that lesson and says so.

#### Dropping, and why altitude is the difficulty dial

A press of the drop key releases a gift from the sleigh. It keeps the
sleigh's horizontal velocity and falls.

| Constant | Value | Why |
|---|---|---|
| `GRAVITY` | `420` units/sec² | About three times real gravity at this project's scale — roughly 2.7 inches per world unit, so true g would be about 143. Exaggerated on purpose: at 143 a drop from 400 hangs for 2.4 seconds, which is a long time to watch a box. |
| `DROP_COOLDOWN` | `0.5` sec | Stops the whole sack being emptied onto one roof in a single pass. |
| `RETURN_DELAY` | `3.5` sec | How long a missed gift lies in the snow before the wind takes it back. |
| `RETURN_SPEED` | `260` units/sec | It rises, and is removed once it passes `MAX_ALTITUDE`. |

The thing that makes this a game rather than a button is that **the lead
depends on how high and how fast you are**, and the player controls both:

| Altitude | Fall time | Lead at cruise (200 u/s) |
|---|---|---|
| 92.4 — the lowest the sleigh can hold over a doorstep | 0.66 s | 133 units |
| 200 — where a run starts | 0.98 s | 195 units |
| 400 — the ceiling | 1.38 s | 276 units |

With `DELIVERY_RADIUS = 70` that is a window of ±0.35 seconds at cruise. Fly
low and fast and it is a genuine judgement call; come to a stop over the path
and the gift falls straight down and cannot miss. That self-levelling is
deliberate and is why there is no difficulty setting here — the player picks
their own by choosing their approach.

Note the floor of that table. 92.42 is not the sleigh's floor in general — on
open snow it is 12.42 — it is the floor *over a doorstep*, because the plot is
occupied and `floorFor` lifts to the ridge there. The player cannot descend
below it to shorten the drop further, which is what keeps the easy case
honest: hovering still costs the time it takes to stop and start again.

#### Nothing can be wasted

A gift that lands outside every undelivered house's circle is **not lost**.
It sits in the snow for `RETURN_DELAY`, then lifts off and blows back into
the sack, and the count of gifts in hand goes back up.

This is the same device the story already uses — the storm has been holding
gifts in the air since the crash — and it is doing real work. With exactly
five gifts and five houses there is no slack: one destroyed gift is an
unwinnable run, and the game still has no fail state, so a deadlock would
leave the player flying around an unfinishable field with no way to restart
into a fresh one. A miss should cost time, which it does: 3.5 seconds, plus
the trip back round.

Three consequences, all of which fall out of the same rule:

- **A house cannot be delivered to twice.** Its circle stops being a target
  the moment it is served, so a second gift dropped on it is simply a miss
  and blows back. No special case, no guard.
- **A gift dropped at altitude over open country** behaves the same way.
- **Dropping with an empty sack does nothing.** Gifts in hand is
  `5 − delivered − falling − returning`; at zero the key is ignored.

A gift that is lying in the snow is **not** an obstacle, including to a landed
sleigh. The player can drive straight over one, and it keeps its own timer and
blows away on schedule. Making it solid would mean the only way to recover a
miss is to not be standing where it fell.

#### What the player sees

- **The delivered gift stays.** It sits on the path where it landed, for the
  rest of the run. Progress is legible by looking at the town, with no UI at
  all. Use the same cloned `a_gift_box.glb` geometry the catching phase loads,
  at the same `MODEL_SCALE = 0.038`, resting on the ground — so centre it
  about 5.6 above the ground plane rather than at zero.
- **The sack swaps.** `christmas_gift_sack.glb` while any gift remains in
  hand, `empty_christmas_sack.glb` once the last one is out. Load both at
  startup and show one. `Player.js` already loads the empty one, rides it in
  the carriage behind Tode at `SACK_SCALE = 4.4`, and exposes it as
  `player.sack`.

  `christmas_gift_sack.glb` is **2.2821 × 2.2818 × 2.2883** and
  `empty_christmas_sack.glb` is **1.5647 × 1.7185 × 1.5298**, both in their
  own units. The full sack is **46% wider and 33% taller** than the empty one,
  so the swap is **not** a visibility toggle at one transform: the replacement
  has to be re-stood on the carriage floor by its own box, the way `Player.js`
  already stands the empty one. Reuse that code rather than restating the
  floor plane — `Player.js` has `FLOOR_Y`, `CENTRE_Z` and `SACK_X`, and a
  `standOn`-equivalent exported from there is better than a second copy of
  three constants.

  The full sack at 4.4 would be 10.0 × 10.0 × 10.1 against the empty one's
  6.9 × 7.6 × 6.7, in a carriage whose interior is 20.1 across and 14.1 deep.
  It fits, and it is 12.8 from Tode's seat against the 9.2 their half-depths
  now need. Check that gap again if either scale moves.
- **The counter** is the one `gift_catch` already owns. Relabel it rather than
  adding a second: `Gifts 3 / 5` while catching, `Delivered 1 / 5` while
  delivering. Two counters in a column would be two places to read the same
  idea.
- **A smile per delivery**: `player.animator?.setExpression('smile', 1, {
  seconds: 1.2 })`, the same call the catch uses.

#### The parenting trap

Repeated because it has already caught this project once. **The camera is a
child of the player group.** Anything parented to that group is parented in
front of the lens. Parent the sack — and a gift mid-release, if it is briefly
attached — to the sleigh, not to `player`.

Specifically: `player.tilt`, which is where `Player.js` puts the sleigh, Tode,
the empty sack and the lights. `player.model` carries the yaw and the Z-up
quarter turn; `player.tilt` is its child and carries the bank as well, so
anything on the sleigh belongs there or it will not roll with it.

#### The drop key

**Not Space.** The previous draft said Space was free because `Attack.js` had
vacated it. `Movement.js` then took it: `CLIMB_KEYS` maps `Space` to +1, as an
alias for `Q`, with `ShiftLeft`/`ShiftRight` aliasing `E`.

Two ways out, and the second is better:

1. Give the drop a fresh key, `KeyF`. Costs nothing, reads as nothing.
2. **Take Space back for the drop and delete its `CLIMB_KEYS` entry.** Space
   is the most natural "release the thing you are carrying" key on a keyboard,
   `Q` already does exactly what the Space alias does, and the aliases exist
   only because they were the climb keys before `Q`/`E` were asked for. Drop
   the `Space` row, keep the Shift rows, and update the hint string in
   `Camera.js`.

Take the second. Then settle it with `GameState.js`, which claims Space on
keydown **while the run is over** to restart. That guard already exists and
already works — a drop during play and a restart from an overlay cannot both
be live — but the win state adds a second way for a run to be over, so the
guard has to ask the question `conclusion/win_state/spec.md` introduces rather
than reading `gameOver` directly.

#### Wiring

A new `Delivery.js` in `game/src/components/`, exporting
`initDeliveryInput()`, `updateDelivery(scene, player)`, `resetDelivery(scene)`,
`allDelivered()` and `getDelivered()`.

- Delivered state is a `Set` of house indices, owned here. **Not in
  `House.js`** — the town is scenery and should not know there is a game loop.
- Its own `THREE.Clock`, and **burn `getDelta()` on init and on reset**, like
  every other timed system here.
- Call `updateDelivery(scene, player)` from the render loop in `main.js`,
  inside the run-is-not-over guard, and only once `allCaught()` is true.
- `houses` is async and empty for the first few frames. `getDelivered()` must
  not index into it blind, and the drop must be inert until it is populated —
  which it will be long before the fifth gift is caught, but the spec for a
  thing that reads a list someone else fills should say so.

#### Phases

There are now three — catching, delivering, won — and nothing owns the idea.
The previous draft said not to build a phase machine for two and to let the
win state build one for three. **Still do not build one.** Three phases that
run strictly in order, each gated on the previous one's `allX()` predicate,
are two booleans in the render loop. A machine earns its place when a phase
can be re-entered or skipped, and none of these can.

What `conclusion/win_state/spec.md` does own is the *second* kind of state:
the run being over, by either route. That is a flag, not a phase.

#### What this hands over

`allDelivered()` returning true is the win condition, and
`conclusion/win_state/spec.md` owns what happens next. This spec does not show
a screen, stop the clock or end the run.

#### Constraints

- Neither a delivered gift, a gift in flight, nor a gift lying in the snow is
  an obstacle. `Collision.js` is untouched by this phase; it sees houses and
  the sleigh and nothing else.
- No house accepts two gifts. No gift is ever destroyed.
- The drop resolves against the flat ground plane at z = 0. It does not test
  what it lands on, which is the reason `DOORSTEP_RADIUS` is on the path at
  428.8 and not at the door at 453.7 — a target under the porch roof would
  need geometry the drop knows nothing about.
