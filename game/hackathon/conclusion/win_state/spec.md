### Specification for AI agent: Win state

> **Promoted from outline.** The outline recorded the scope and one open
> question — *"What does winning look like? Worth deciding whether this is a
> text overlay, a camera move, or something the town itself does, before
> writing the spec."* That question is answered below, and the answer is
> the third option plus the first: **the town comes on, and an overlay says
> so.** The reasoning is in "What winning looks like".

The end of the story. Five gifts caught, five houses served, and the run is
over in the good way.

#### Depends on

`core_loop/gift_delivery/spec.md`, for `allDelivered()`. Neither it nor
`core_loop/gift_catch` is implemented yet. **This is the last of the three
and should be built last**, but it is specified now because it owns one
decision the other two have to be written around, and that decision is in
"Space, and the two ways a run can end" below.

#### Why this needs its own task

**The game currently has no way to be won.** `GameState.js` owns exactly one
terminal state — Game Over — reached from `triggerGameOver()` and cleared by
Space. A story that ends with all five presents delivered needs a second
ending, and "you win" is not a flag that can be bolted onto the existing one:
a won run and a lost run freeze the same systems but must say different
things, and only one of them should offer "try again" in the same tone.

It is also, today, the **only** ending. `triggerGameOver()` has no live
caller: both of its callers were the monster collisions, and the monsters are
commented out of `main.js`. So for the moment this spec does not add a second
ending to a game that has one — it adds the first ending to a game that has
none, and leaves the lost path wired and dormant for whoever adds a fail
state.

#### The constraint that makes this delicate

`GameState.js` **imports nothing, on purpose.** Movement, Score and the rest
read its flags, so any import back out of it is a cycle. The existing design
solves this by having `main.js` — which already imports everything — pass the
teardown and rebuild work in as `onGameOver` / `onRestart` callbacks.

A win state has to follow the same discipline. **`GameState.js` must not learn
what a gift is.** `Delivery.js` decides the run is won and calls in;
`GameState.js` owns the flag, the overlay and the restart; `main.js` wires the
two together. Importing `Delivery.js` or `House.js` into `GameState.js` would
be the quickest route and would reintroduce exactly the cycle the module's
header comment warns about.

#### The shape of it

Three additions to `GameState.js`, and nothing else in that file changes:

| Export | Does |
|---|---|
| `triggerWin()` | Sets the won flag, shows the win overlay, calls `handlers.onWin()`. Idempotent, the way `triggerGameOver` is — the delivery of the fifth gift can only happen once, but the guard costs a line and the lost path already has it for a reason. |
| `isWon()` | For anything that wants to know which ending it was. |
| `isRunOver()` | `gameOver \|\| won`. **This is the one the render loop reads.** |

And `initGameState` takes `onWin` alongside `onGameOver` and `onRestart`.

##### `isRunOver()` is the important one

The outline asked for "a single *is the run over, by either route?* question
for the systems that freeze, so `main.js`'s animation loop does not grow a
second condition in front of every update". That is `isRunOver()`.

Every current reader of `isGameOver()` wants `isRunOver()` instead — the
render loop's freeze, and the Space guard inside `GameState.js` itself. Keep
`isGameOver()` exported, because "which ending was it" is a real question and
the win overlay is not the Game Over overlay, but **no caller outside this
module should be asking it to decide whether to run.** If a reviewer finds
`isGameOver()` in a condition that guards an update, that is the bug this
section exists to prevent.

#### God mode does not block winning

`triggerGameOver()` opens with `if (godMode) return;`, which is the whole of
what god mode is: the run cannot end. **`triggerWin()` must not copy that
line.** God mode exists so you can fly around without dying, not so you can
be denied the ending after delivering five presents; a god-mode run that
cannot be finished is a god-mode run that is broken.

Note also what `setGodMode` does today: switching god mode **on** calls
`restartGame()` if a Game Over has already landed, so the toggle rescues you
from the overlay. It must not do that for a win. Guard that line on
`gameOver` specifically rather than on `isRunOver()`, or pressing G on the win
screen silently throws the finished run away.

#### What winning looks like

The losing overlay is a title and "Press Space to try again". A win deserves
more than the same box with different words, and the outline was right to
hold the spec until someone decided what.

**The town answers.** On the final delivery every Christmas light in the
village comes up to full and stays there — the twinkle stops and the five
plots hold steady and bright. Then the overlay fades in over it.

Three reasons this is the right answer rather than a camera move:

- It is the story. Tode's round is finished; the houses being lit and awake is
  what finishing it means. A camera move says "the game is over"; the town
  lighting up says "Christmas happened".
- It is nearly free. `ChristmasLights.js` already runs all five plots off one
  shared colour buffer, so one pass brightens the entire town — this is the
  module's existing `updateChristmasLights()` with its floor raised, not a new
  system.
- A camera move fights the camera the game has. The lens is a child of the
  player group under pointer lock; taking it somewhere means taking it off its
  parent, restoring it on restart, and deciding what happens if the player
  moves the mouse mid-move. That is a real piece of work for a two-second
  flourish, and it can be added later on top of this without undoing it.

##### The light change

`ChristmasLights.js` computes `TWINKLE_FLOOR + (1 - TWINKLE_FLOOR) * wave`
per bulb, with `TWINKLE_FLOOR = 0.6`. Winning raises that floor to 1 over
`CELEBRATE_SECONDS`, at which point `wave` has no effect and every bulb sits
at its base colour, steady.

| Constant | Value | Why |
|---|---|---|
| `CELEBRATE_SECONDS` | `1.6` | Long enough to read as the town coming on rather than as a light switch, short enough to be finished before the overlay has faded in. |

- Add `celebrate()` and reset-to-twinkling to `ChristmasLights.js`, and keep
  `updateChristmasLights()` argument-free. It already takes no arguments
  because the five plots share one buffer; a win is a module-level flag in
  the same spirit.
- `updateChristmasLights()` is called **outside** the freeze in `main.js`,
  with a comment saying a town going dark on the Game Over frame would read
  as the lights being part of the failure. That placement is what makes this
  work at all — the celebration runs while everything else is frozen. Do not
  move the call inside the guard.
- The star and the door lanterns are separate geometries with their own
  materials and do not twinkle. Leave them. Steady things getting steadier is
  not a change anyone sees.
- The house **windows** are emissive at `0xffcc77` on a shared material, set
  once in `lightTheWindows`. Brightening those is tempting and should be
  resisted for one version: the material is shared across all five clones, so
  it is a single assignment, but it is also shared with whatever the
  decoration specs do next and a win state silently rewriting a material at
  runtime is a trap for them.

##### The overlay

Reuse the `.game-over` pattern in `style.css` — kept in the DOM and toggled,
so showing it again costs nothing. A second class, `.win`, sharing the layout
and differing in two things:

- **It is lighter.** `.game-over` sits on `rgba(0, 0, 0, 0.75)`, chosen so the
  snowfield does not read through the wording. The win overlay's whole point
  is that the town behind it is lit, so it wants about `0.45` and a short
  fade-in rather than an instant toggle. If the wording stops being readable
  at 0.45, add a text shadow rather than taking the background back up.
- **It says something different.** Title "Merry Christmas", and beneath it the
  run's result rather than a bare instruction — the elapsed time from
  `Score.js` is the one number worth showing, because with the monsters gone
  the score *is* a clock and this is the first thing in the game that gives it
  a meaning. Then "Press Space to play again", which is the same key as the
  lost path and deliberately so.

#### Space, and the two ways a run can end

This is the decision the other two specs need from this one.

`Movement.js` currently maps `Space` to climb, as an alias for `Q`.
`gift_delivery` takes it for the drop and deletes that alias. `GameState.js`
claims it on keydown **only while the run is over**, to restart.

That three-way works, and the guard inside `GameState.js` is the whole of it:

```
if (event.code !== 'Space' || !isRunOver()) return;
```

`isRunOver()`, not `gameOver`. If it stays as `gameOver`, Space on the win
screen falls through to `Delivery.js`, which is still listening, and the
player taps their way through a finished run dropping gifts they do not have.

#### Restart

`restartGame()` clears both flags, hides both overlays, and calls
`handlers.onRestart()`. `main.js`'s `onRestart` grows the two new systems
alongside the ones it already handles:

- `resetGifts(scene)` and `resetDelivery(scene)` — removing every gift in the
  air, on the ground, and delivered at a door.
- Return the twinkle to `ChristmasLights.js`.
- `resetMovement(player)`, `resetScore()`, `setPlayerVisible(true)`, all as
  they are today.
- **Every timed system burns `clock.getDelta()` on reset.** `Gifts.js`,
  `Delivery.js` and the celebration all need it, for the reason every other
  reset in this project does: the clock banks the wall time spent on the
  overlay and pays it out as one enormous first frame.

A restart must leave the town the way the first frame found it. The delivered
presents are the easy half to remember; the lights are the half that will be
forgotten, because nothing visibly breaks — the second run simply starts with
the village already celebrating and the ending has nothing left to give.

#### Constraints

- `GameState.js` imports nothing. If this task adds an import to that file,
  it has been done wrong.
- No phase machine. Catching, delivering and won run strictly in order, each
  gated on the previous one's predicate; that is two conditions in the render
  loop. `isRunOver()` is a flag about whether anything runs at all, which is
  a different question and the only one this module owns.
- God mode does not prevent a win and does not clear one.
- The win is triggered exactly once per run.

#### What this does not do

- **No fail state.** The game still has no way to lose, and this spec does not
  add one — it wires the won path and leaves `triggerGameOver()` dormant and
  intact. Whoever adds a fail state inherits a `GameState.js` that already
  holds two endings and an `isRunOver()` that already covers both, which is
  most of the work.
- **No camera move, no music change, no snowfall change.** All three are
  reasonable and all three are separable; the town and the overlay are the
  ending. `Music.js` loops one element across a Game Over today and should
  keep doing exactly that until someone specifies otherwise.
