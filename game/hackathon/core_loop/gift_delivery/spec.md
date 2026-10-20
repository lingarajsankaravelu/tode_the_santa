### Specification for AI agent: Gift delivery

> **Promoted from outline.** All four of its open questions are now answered,
> three of them by the flight model and one by the gift catch rewrite:
>
> - **How are gifts carried?** All five, in the sack, aboard the sleigh. The
>   outline's "one at a time, to make the sleigh matter" is moot — the sleigh
>   is the player now.
> - **Does a carried gift show?** The sack shows; individual gifts do not. The
>   outline's trap still stands and is repeated below, because it has bitten
>   this project before.
> - **Can a house be delivered to twice?** No, and the rule below makes it
>   impossible rather than merely discouraged.
> - **What if a gift is lost?** None can be. `gift_catch` guarantees it on its
>   side, and the wind rule below guarantees it on this one.
>
> What the outline got right and is kept: delivered state lives here and not
> in `House.js`, the delivered gift stays visible on the ground, and `Score.js`
> is the idiom for the counter.
>
> What has changed is the verb. The outline had Tode walk up to a house and
> deliver by proximity against its footprint. He cannot: `MIN_ALTITUDE = 100`
> keeps the sleigh clear of the 80-unit ridges, so he never gets near a wall.
> **Delivery is a drop.**

The second half of the story: five gifts in the sack, five houses, one each,
dropped from the air as Tode passes over.

#### Depends on

`skeleton/sleigh/spec.md` for flight, and `core_loop/gift_catch/spec.md` for
the five gifts and `allCaught()`. Neither is implemented yet. This spec is
written against their numbers and will be wrong if they move.

#### Where a gift has to land

Each house has one target: a point on the ground, on that house's own angle,
at a fixed radius from the origin.

| Constant | Value | Why |
|---|---|---|
| `DOORSTEP_RADIUS` | `428.8` | The centre of the house's path spur, which `SnowRoads.js` already puts there. Walking out from the middle of the town the plot reads: lantern 407.7, **path 428.8**, lantern 433.7, porch column 437.5, front door 453.7. So 428.8 is the one patch in the corridor that is clear of the lanterns, clear of the porch, and still unmistakably at the door. A gift landing there sits on the snow path, which also looks deliberate. |
| `DELIVERY_RADIUS` | `70` | How close the landing has to be. Adjacent doorsteps are `2 × 428.8 × sin(13.75°) = 203.8` units apart — the town spans 110° over five houses, so 27.5° between neighbours — which leaves 64 units of gap between two 70-unit circles. A drop can never be ambiguous about which house it was meant for. |

Derive the angle with `houseAngle(index)` from `House.js`, which already
exists and which `SnowRoads.js` already uses for exactly this. Do not restate
the five angles; the snow roads spec learned that lesson and says so.

#### Dropping, and why altitude is the difficulty dial

A press of the drop key releases a gift from the sleigh. It keeps the
sleigh's horizontal velocity and falls.

| Constant | Value | Why |
|---|---|---|
| `GRAVITY` | `420` units/sec² | About three times real gravity at this project's scale — roughly 2.7 inches per world unit, so true g would be about 143. Exaggerated on purpose: at 143 a drop from 400 hangs in the air for 2.4 seconds, which is a long time to watch a box. |
| `DROP_COOLDOWN` | `0.5` sec | Stops the whole sack being emptied onto one roof in a single pass. |
| `RETURN_DELAY` | `3.5` sec | How long a missed gift lies in the snow before the wind takes it back. |
| `RETURN_SPEED` | `260` units/sec | It rises, and is removed once it passes `MIN_ALTITUDE`. |

The thing that makes this a game rather than a button is that **the lead
depends on how high and how fast you are**, and the player controls both:

| Altitude | Fall time | Lead at cruise (200 u/s) |
|---|---|---|
| 100 (the floor) | 0.69 s | 138 units |
| 200 | 0.98 s | 195 units |
| 400 (the ceiling) | 1.38 s | 276 units |

With `DELIVERY_RADIUS = 70` that is a window of ±0.35 seconds at cruise. Fly
low and fast and it is a genuine judgement call; come to a stop over the path
and the gift falls straight down and cannot miss. That self-levelling is
deliberate and is why there is no difficulty setting here — the player picks
their own by choosing their approach.

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

#### What the player sees

- **The delivered gift stays.** It sits on the path where it landed, for the
  rest of the run. This is the outline's point and it is a good one: progress
  is legible by looking at the town, with no UI at all. Use the same cloned
  `a_gift_box.glb` geometry the catching phase loads, at the same
  `MODEL_SCALE = 0.038`, resting on the ground — so centre it about 5.6 above
  the ground plane rather than at zero.
- **The sack swaps.** `christmas_gift_sack.glb` while any gift remains in
  hand, `empty_christmas_sack.glb` once the last one is out. The two are the
  same size to within 3% — 2.34 × 2.36 × 2.57 against 2.34 × 2.29 × 2.57 — so
  this is a visibility toggle between two models at one transform, not a
  refit. Load both at startup and show one.
- **The counter** is the one `gift_catch` already owns. Relabel it rather than
  adding a second: `Gifts 3 / 5` while catching, `Delivered 1 / 5` while
  delivering. Two counters in a column would be two places to read the same
  idea.
- **A smile per delivery**: `player.animator?.setExpression('smile', 1, {
  seconds: 1.2 })`, the same call the catch uses.

#### The parenting trap

Repeated from the outline because it has already caught this project once.
**The camera is a child of the player group.** Anything parented to that group
is parented in front of the lens. Parent the sack — and a gift mid-release, if
it is briefly attached — to `player.model`, the sleigh, not to `player`.

This is the same distinction that makes `Movement.js` rotate `player.model`
rather than the group, and `main.js` hide the model rather than the group.
Both files say so in comments; the reason is this one.

#### Wiring

A new `Delivery.js` in `game/src/components/`, exporting
`initDeliveryInput()`, `updateDelivery(scene, player)`, `resetDelivery(scene)`,
`allDelivered()` and `getDelivered()`.

- Delivered state is a `Set` of house indices, owned here. **Not in
  `House.js`** — the town is scenery and should not know there is a game loop,
  which is the outline's call and still right.
- Its own `THREE.Clock`, and **burn `getDelta()` on init and on reset**, like
  every other timed system here.
- Call `updateDelivery(scene, player)` from the render loop in `main.js`,
  inside the `isGameOver()` guard, and only once `allCaught()` is true.

**The drop key is Space, and it is free — for now.** `Attack.js` owned it and
is commented out of `main.js`; `GameState.js` claims it only while
`gameOver` is true, which cannot currently happen. Both of those are
temporary. Whoever adds a fail state has to settle Space between restart and
drop, and the cheapest answer is to give the drop its own key then rather than
to unpick it later.

#### Phases

There are now two, and nothing owns the idea. For this task, gate
`updateDelivery` on `allCaught()` in `main.js` and leave it there — one
condition in the loop is honest and costs nothing.

Do not build a phase machine for two phases. It earns its place when the win
state lands and there are three, and `conclusion/win_state/spec.md` is the
task that should build it.

#### What this hands over

`allDelivered()` returning true is the win condition, and
`conclusion/win_state/spec.md` owns what happens next. This spec does not show
a screen, stop the clock or end the run.

#### Constraints

- Delivered gifts are **not** obstacles, and neither is a gift in flight.
  Nothing collides with anything in this phase; `Collision.js` is untouched,
  the same as in flight.
- No house accepts two gifts. No gift is ever destroyed.
- The drop resolves against the flat ground plane at z = 0. It does not test
  what it lands on, which is the reason `DOORSTEP_RADIUS` is on the path at
  428.8 and not at the door at 453.7 — a target under the porch roof would
  need geometry the drop knows nothing about.
