### Specification for AI agent: Snow roads

Lays a snow road through the five-house town, with a short spur to each front
door.

Depends on `visual/winter_town`, which puts the houses on a fixed arc. The road
is the thing that makes the arc read as a street rather than five buildings
that happen to be the same distance from the middle of a field. It also earns
its place in the story: `game_story.md` has Santa *drive* to the houses, and
this is the route.

Purely decorative. The road is parented to the map group and must **not** be
added to the `houses` obstacle list — nothing drives over it yet and nothing
should be blocked by it.

#### The geometry is a ring segment, not a mesh to build

The town arc is centred on the world origin, which is exactly what
`THREE.RingGeometry` is for: it takes an inner and outer radius and a
`thetaStart` / `thetaLength`, and it already lies in the XY plane — this game's
ground plane. No custom `BufferGeometry`, and no rotation to fix up, which makes
this the one piece of scenery in the project that needs neither.

In the `components` directory, add a `SnowRoads.js` file exporting
`createSnowRoads()` and returning a `THREE.Group`.

| Constant | Value | Why |
|---|---|---|
| `ROAD_RADIUS` | `390` | Centre line. The houses sit at 480 with a 74.7-deep footprint, so their front walls are at **442.6**; a road centred at 390 runs *in front of* the doors rather than through the buildings. |
| `ROAD_WIDTH` | `50` | Spans 365 to 415, leaving a **27.6**-unit verge between the road edge and the front walls. About 11 ft wide at this project's scale — a lane, not a motorway. |
| `ROAD_SPREAD` | `130` degrees | The town spans 110°. Ten degrees past each end house stops the road from ending dead at the last doorstep. 885 units of road at this radius. |
| `ROAD_SEGMENTS` | `64` | `thetaSegments`. Over 130° that is one segment per 2°, which holds a smooth edge at the camera's distance. |
| `ROAD_COLOR` | `0xd2dae3` | Compacted snow: a shade darker and greyer than the fields, with the verges left bright. **Amended.** The original `0xe8eef2` was chosen to separate from a green field; `visual/snow_ground` has since landed and the ground is now `0xe9eef5`, which that value is invisible against — the two differ by one or two values per channel. |

`thetaStart` is `-ROAD_SPREAD / 2` in radians and `thetaLength` is the full
spread, measured from +X — which is the axis `visual/winter_town` centres the
town on.

Use `MeshBasicMaterial`, not `MeshStandardMaterial`. The scene's ambient and
directional lights are both at intensity 1.5, which together push a lit white
material past white and flatten the road into a glare. This is the same
reasoning the old `Map.js` floor used for the same reason.

`visual/snow_ground` is now implemented, so the collision it flagged is
resolved above and needs no further decision here.

#### The depth buffer is the real problem here

A flat road lying on flat ground is two parallel surfaces at almost the same
depth, which is the worst case for a depth buffer, and this project's camera
makes it worse than it looks. `Camera.js` has `NEAR_PLANE = 0.1` and
`FAR_PLANE = 9000`. For a 24-bit depth buffer the resolution at distance `z` is
roughly `z² / (near × 2²⁴)`:

| Distance from camera | Depth resolution |
|---|---|
| 300 units | 0.054 |
| 443 units (the front walls) | 0.117 |
| 500 units | 0.149 |
| 700 units | 0.292 |

The gap the rest of the game relies on — terrain at `GROUND_Z = -0.05`, models
at `0` — is **0.05 units**, which is *finer than the buffer can resolve* at town
distances. It has never mattered because the surfaces that meet there are a
house's hidden underside and the ground. Two visible parallel surfaces will
fight, and the result is the shimmer `GROUND_Z` was introduced to prevent,
appearing across 885 units of road.

So do not simply pick a small `ROAD_Z` and hope. Two measures, and the spec
wants both:

- **`polygonOffset` on the road material.** This is precisely the tool for a
  decal on a coplanar surface: set `polygonOffset = true`,
  `polygonOffsetFactor = -1`, `polygonOffsetUnits = -1`. It biases the road's
  depth in the hardware, independent of distance, which is what makes it robust
  where a fixed Z offset is not.
- **`ROAD_Z = 0.04`**, a little above the terrain's `-0.05` rather than squeezed
  between it and zero. At roughly 2.7 inches per world unit that is about a
  quarter of an inch of packed snow sitting on the ground, which is both
  physically sensible and far too small to read as floating.

Do **not** fix this with `depthWrite: false` and a render order. It appears to
work and then breaks the moment anything is drawn between the road and the
camera.

#### Spurs to the doors

One short path per house, from the road's outer edge to the doorstep.

- A `PlaneGeometry`, which also already lies in XY.
- `SPUR_LENGTH = 34` — the gap is 27.6, and the extra few units tuck under both
  the road edge and the doorstep. Butting them up exactly leaves a visible seam
  at the join; overlapping hides it.
- `SPUR_WIDTH = 36` — a footpath, about a third of the house's 108-unit frontage.
- Centre each at radius **428.8**, on its house's own angle, rotated so its
  length runs radially.
- Same material, same `polygonOffset`, same Z as the road.

The five angles are `-55°, -27.5°, 0°, +27.5°, +55°`, the same series
`visual/winter_town` places the houses on. Derive them from the same two
constants rather than writing the five numbers out, or the road and the houses
will drift apart the first time the town is re-tuned.

**The dependency that blocked the spurs is now settled.** The house model faces
**−Y** at a yaw of zero, so `visual/winter_town` carries
`MODEL_BASE_ROTATION = Math.PI` and the fronts do look onto the field. The spurs
can be built in the same pass as the arc, on the inward side of each house,
with no further checking.

Should that constant ever change, the spurs move with it — they sit on the door
side, and the door side is what it defines.

#### Wiring

- Call `createSnowRoads()` from `createMap()` in `Map.js` and add the result to
  the map group, the same way `createLandscape()` is already called there. The
  houses are parented to that group too, so the road travels with the ground and
  the town it belongs to.
- Add it **after** the landscape, so the road is drawn over it rather than under.
- Synchronous — there is no model to load — so unlike the houses and the
  landscape it is there on the first frame.

#### Constraints

- Not an obstacle. Not in the `houses` array, not tested by `Collision.js`.
- The road assumes the town's arc. If `TOWN_RADIUS` or `TOWN_SPREAD` in
  `House.js` change, `ROAD_RADIUS` and `ROAD_SPREAD` have to move with them.
  Worth importing the town's constants rather than restating them if that can be
  done without making `House.js` export its internals.
- Two draw calls for the arc and five for the spurs, with no textures and no
  transparency. Negligible against the town's 252,390 triangles.

#### Research

The depth-precision table above is a symptom of something larger: `NEAR_PLANE =
0.1` against a camera that sits 400 units from its subject is costing about two
decimal digits of depth precision everywhere in the scene. Raising it to 10
would take the resolution at 500 units from 0.149 to **0.0015** — a hundredfold
improvement — and nothing in this game is ever drawn closer than a few units to
the lens. It would make coplanar scenery straightforward rather than delicate,
and it is a one-line change. Out of scope here because it affects every pixel in
the game and deserves its own task, but it is the real fix and this spec is only
working around it.
