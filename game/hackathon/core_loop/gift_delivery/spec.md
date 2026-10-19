### Specification for AI agent: Gift delivery — OUTLINE ONLY

**This is not ready to implement.** It records scope and open questions. It depends on
`visual/winter_town` being built and on `core_loop/gift_catch` settling how many gifts
there are.

#### Scope

The second half of the story: carry the gifts from the sleigh to the town and leave one
beside each of the five houses.

- Consumes the `houses` array exported by `House.js`, which `visual/winter_town` makes
  stable and ordered — five fixed addresses rather than a fresh scatter per reload. This
  is the whole reason the town task replaced random placement with an arc.
- Per-house delivered state. It belongs here, not in `House.js`: the town is scenery and
  should not know about the game loop. A `Set` of delivered houses, or a `delivered` flag
  the delivery module sets, keyed off the array index.
- Delivery happens by proximity, reusing `wouldCollide` from `Collision.js` against the
  house's own footprint — which `visual/winter_town` deliberately sizes to the building
  rather than the whole plot, so "next to the house" means next to the walls and not
  somewhere out by the well.
- The story says *"By placing the gift next to the house"*, so a delivered gift should
  be visible on the ground where it was left. That makes progress legible without a UI:
  the player can see which houses are done by looking at them.
- Some indication of how many are left. `Score.js` is again the idiom.

#### Open questions

- **How are gifts carried?** Either Tode holds all five at once and drops one per house,
  or he ferries them one at a time from the sleigh. One-at-a-time makes the sleigh matter
  and gives the field crossing a purpose; all-at-once is one trip and much less walking.
  The story reads like all-at-once ("bring back to his vehicle… then drive to the five
  houses"), but it is also the less interesting of the two.
- **Does a carried gift show?** Parenting a gift model to the player group is the
  obvious move and the one trap to avoid: the camera is a child of that group, so
  anything parented to it is also in front of the lens. Parent to `player.model`
  instead — the same distinction that makes `Movement.js` rotate the model and not the
  group, and `main.js` hide the model and not the group.
- **Can a house be delivered to twice?** It must not count twice, or five gifts can be
  spent on one doorstep and the run becomes unwinnable.
- **What happens if a gift is lost?** If `gift_catch` allows a gift to be destroyed
  rather than dropped, the delivery target has to shrink to match or the run deadlocks.
  The two specs have to agree on this; it is the seam between them.
