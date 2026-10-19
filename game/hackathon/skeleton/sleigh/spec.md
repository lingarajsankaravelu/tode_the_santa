### Specification for AI agent: Sleigh — OUTLINE ONLY

**This is not ready to implement.** It records scope and open questions so the order of
work is clear. It needs a pass with exact constants before an agent should be pointed at
it, the way `visual/winter_town/spec.md` carries its numbers.

#### Why this comes first

`game_story.md` has Tode return to his vehicle, load it, then drive to the houses.
Everything downstream needs a thing to return *to*, and "Tode is next to the sleigh" is
the condition both the catching phase and the delivery phase end on. So the sleigh is
the first object to exist, before any gift logic.

#### Scope

- A new `Sleigh.js` in `game/src/components/`, following the shape `House.js` and
  `Landscape.js` already use: load a `.glb` through `GLTFLoader`, wrap it in a
  `THREE.Group`, expose `.model` for `Collision.js`, parent it to the map group so it
  travels with the ground.
- One sleigh, at a **fixed** position — the story has it crash-land, so it does not
  move in this task and its location is a landmark.
- A collision footprint, so Tode cannot walk through it. `Collision.js` needs no change;
  setting `.model` is enough.
- An exported predicate — `isAtSleigh(player)` or equivalent — built on the existing
  `wouldCollide` in `Collision.js` rather than a fresh distance test. Later tasks ask
  this question; nothing else should re-derive it.

#### Open questions, to settle before writing the real spec

- **There is no model yet.** Nothing in `game/public/models/` is a sleigh or a vehicle.
  Either one gets sourced — [KayKit Holiday Bits](https://kaylousberg.itch.io/holiday-bits)
  and [Kenney's Holiday Kit](https://kenney.nl/assets/holiday-kit) are both CC0 and both
  carry a toy train and sledges — or the diorama's own `Sanki` group (a sledge, 2,080
  triangles, discarded by the winter town task) gets reused. The second costs nothing to
  download and is already stylistically matched.
- **Where does it land?** It should be clear of the town arc and clear of the four
  `(±220, ±220)` spawn corners, and inside `WORLD_RADIUS = 700`. The −X side is empty
  now that the town occupies +X, which also puts the sleigh and the town at opposite
  ends of the field — a deliberate walk, which is the loop the story describes.
- **Does it get driven?** The story says drive it to the houses. That is a second
  movement model on top of the hop queue in `Movement.js`, and a large task. The
  recommendation is to cut it: Tode carries the gifts on foot, and the sleigh stays a
  depot. If driving survives, it needs its own spec, not a clause in this one.
