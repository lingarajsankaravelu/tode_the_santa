### Specification for AI agent: Win state — OUTLINE ONLY

**This is not ready to implement.** It records scope and the one real design problem.
It depends on `core_loop/gift_delivery`.

#### Why this needs its own task

**The game currently has no way to be won.** `GameState.js` owns exactly one terminal
state — Game Over — reached from two places and cleared by Space. A story that ends with
all five presents delivered needs a second ending, and "you win" is not a flag that can
be bolted onto the existing one: a won run and a lost run freeze the same systems but
must say different things, and only one of them should offer "try again" in the same tone.

#### The constraint that makes this delicate

`GameState.js` **imports nothing, on purpose.** Movement, Enemies, Attack and Score all
read its flags, so any import back out of it is a cycle. The existing design solves this
by having `main.js` — which already imports everything — pass the teardown and rebuild
work in as `onGameOver` / `onRestart` callbacks.

A win state has to follow the same discipline. `GameState.js` must not learn what a gift
is. The delivery module decides the run is won and tells `GameState`; `GameState` owns
the flag, the overlay and the restart, and `main.js` wires the two together. Importing
`Gifts.js` or `House.js` into `GameState.js` would be the quickest route and would
reintroduce exactly the cycle the module's header comment warns about.

#### Scope

- A second terminal flag and a second overlay, reusing the `.game-over` pattern in
  `style.css` — kept in the DOM and toggled, so showing it again costs nothing.
- A single "is the run over, by either route?" question for the systems that freeze, so
  `main.js`'s animation loop does not grow a second condition in front of every update.
  The existing `isGameOver()` is read in several places; whatever replaces it should keep
  one call site per reader.
- Restart has to clear both states and reset the gift and delivery systems alongside the
  ones `onRestart` already handles — and burn `clock.getDelta()` in each, for the same
  reason every other reset in this project does.
- God mode is a question here. It currently guards `triggerGameOver` so nothing can end
  the run; it should almost certainly *not* block winning.

#### Open question

- **What does winning look like?** The losing overlay is a title and "Press Space to try
  again". A win deserves more than the same box with different words — the story has
  Santa finish his round, and the snowfall and the lit town are already on screen. Worth
  deciding whether this is a text overlay, a camera move, or something the town itself
  does, before writing the spec.
