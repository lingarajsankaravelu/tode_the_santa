### Specification for AI agent: Gift catching — OUTLINE ONLY

**This is not ready to implement.** It records scope and open questions. It needs a pass
with exact constants, and it needs the contradiction in the story resolved first.

#### Scope

The first phase of the story: the gifts are scattered in the air after the crash, and
Tode has to catch them before he can deliver anything.

- A new `Gifts.js`. `Enemies.js` is the pattern to copy, not to import: it already has a
  spawn cycle driven by its own `THREE.Clock`, a tracking array, a per-frame update over
  that array, and a `remove` that mutates the array safely while iterating. A gift is
  that same shape with falling instead of chasing.
- Gifts fall from above and land on the ground plane. Tode catches one by being close to
  where it lands — reuse `wouldCollide` from `Collision.js`.
- A counter in the UI. `Score.js` is the idiom: own a `div`, write to it only when the
  rendered value changes, and let `style.css` position it.
- Burn `clock.getDelta()` on init and on reset. Every timed system in this project does,
  because the wall time spent loading models or sitting on the Game Over screen
  otherwise gets paid out in one frame — as an instant spawn, or a counter that jumps.
- A missed gift needs a defined outcome: it either lands and waits to be picked up, or it
  is lost. "Lands and waits" is kinder and avoids an unwinnable run.

#### The story contradicts itself, and this has to be settled first

`game_story.md` says *"the no. of gifts need to be caught is 5/5"* and then, two lines
later, *"After catching 10 it has to jump back"*. Five and ten cannot both be the target.

Five is the better number, and not only because it is stated first: there are five
houses in the town, so five gifts means one per house and the delivery phase needs no
separate arithmetic. Ten would mean either two per house or five spare, and both need
explaining to the player. **Recommendation: five, and amend `game_story.md`** rather than
letting the code pick a winner.

#### Open questions

- **No gift model exists.** `game/public/models/` has no present.
  [KayKit Holiday Bits](https://kaylousberg.itch.io/holiday-bits) is CC0 and includes
  presents, which is the cheapest route and matches the untextured flat-colour look of
  the landscape and the winter house.
- **What do the monsters do during this phase?** They currently spawn on a timer and
  chase, and contact ends the run. A catching phase under attack is a real game; a
  catching phase with monsters that were themed as "monsters swarming Tode's home" is a
  story mismatch. Either they are re-themed as a hazard that fits bad weather, or they
  are suspended during this phase, or they stay and the story absorbs them. This is a
  story decision and should be made before the spec is written.
- **Does the attack still exist?** If the monsters stay, `Attack.js` and the difficulty
  ramp in `Difficulty.js` stay with them, and the gift phase has to coexist with both.
