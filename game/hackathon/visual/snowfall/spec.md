### Specification for AI agent: Snowfall

Extends `river_landscape`. The mountains have snow on their caps and nothing
in the air, which makes the world read as a painted backdrop. This adds a
constant, slow snowfall around the player.

#### Where the snow can be, and why it is not on the horizon

The obvious build is a tall band out by the mountains, so the weather reads
as distant. It does not work, and the reason is worth stating because it is
easy to rediscover the hard way.

`Camera.js` sits 180 above Tode, pitched 26 degrees down, with a 45 degree
field of view. That puts the **top** edge of the frustum 3.6 degrees *below*
horizontal — so the edge begins at the camera's own height and only descends
from there. Nothing above 180 world units is ever on screen, at any distance.
A band out at 1100–2600 with a ceiling of 620 over the peaks is 86% invisible
at its near edge and 100% invisible at its far edge.

So the band hugs the ground and sits near the player instead:

- **Radius 120 to 900**, centred on Tode rather than on the world origin.
- **Ceiling tapering from 150 down to 93**, as `CEILING_NEAR -
  radius * CEILING_TAPER`, where the taper is `tan(3.6 degrees)`. A flat
  ceiling gets cropped past a few hundred units; this one tracks the frame's
  top edge the whole way out.

These numbers are a function of `Camera.js`. If its height, pitch or field of
view change, recompute them or the snow silently vanishes again. Say so in a
comment, because nothing will fail loudly.

#### Snow

In the `components` directory, add a `Snow.js` file:

- Export `createSnow()`, returning a single `THREE.Points`. One draw call for
  the lot; a mesh per flake would be nine hundred of them carrying the same
  sprite.
- Export `updateSnow(snow, player)`, stepping it one frame.
- Put the per-flake fall speed, sway phase and ceiling on the returned object,
  not in module state, so the thing that is drawn and the thing that is
  stepped cannot get out of sync.
- 900 flakes at `size: 6`, `opacity: 0.85`. With `sizeAttenuation` on, that is
  about 16 pixels near the player and six at the band's edge.
- Set `frustumCulled = false`. The band surrounds the camera, so its bounding
  sphere is always on screen and the cull test is wasted work.
- Set `depthWrite: false`. Flakes overlap each other and the terrain
  constantly, and writing depth lets whichever drew first punch a hole in the
  ones behind it.
- Distribute the radius as `sqrt(inner² + random() * (outer² - inner²))`.
  Taking it straight from a uniform number crowds the flakes at the inside
  edge, which is the one place they are least wanted.
- Seed the height across each flake's own ceiling, so the first frame shows a
  fall already in progress instead of a curtain dropping in.
- Recycle a flake that reaches the ground back to **its own** ceiling, in the
  **same column**. A shared ceiling puts outer flakes back above the frame
  edge; a fresh angle makes the whole band shimmer.
- Draw the flake into a 32px `CanvasTexture` radial gradient rather than
  shipping an image. `PointsMaterial` with no map draws a hard square, which
  at this size reads as grit. Same trade `Sky.js` makes for the backdrop.

#### Fall and drift

- Fall speed is `0.15` to `0.45` per frame. Over the ~150-unit fall that is
  six to seventeen seconds, which is deliberately slow: it is what lets the
  sway read as drift rather than as a twitch on the way past.
- Sway is `sin`/`cos` of a per-flake phase at `DRIFT = 0.45`. Because it is a
  sine of an advancing phase, it oscillates around where the flake started.
  Adding a constant instead would slide the whole band off in one direction
  over a long run.
- Per frame, not per second, matching `Movement.js`, which advances a hop by a
  per-frame fraction. The whole scene then speeds up or slows down together;
  converting only the snow to real time would make it the one thing in the
  game running at a fixed rate.

#### Main

In `main.js`:
- Create the snow **after** the player, since `updateSnow` needs him, and add
  it to **`scene`**, not to the map group. The map group is for ground scenery
  that travels with the floor it stands on; weather belongs with the lights.
- Call `updateSnow(snow, player)` from the animation loop **outside** the
  `isGameOver()` guard, next to `updateAttack`. The snow carries on over the
  Game Over screen, the same way the lighting stays up rather than cutting to
  black.
- `updateSnow` moves the band's x and y to the player's and leaves z alone.
  Following z as well would lift the whole band on every hop and the snow
  would bob with him.

#### Constraints

- The band is near the player, not on the horizon. That is forced by the
  camera, not chosen. If distant weather is wanted, it needs sky in frame
  first, which is a `Camera.js` task: the frustum's top edge has to clear
  horizontal, and at the current 26-degree pitch that means a field of view
  past 55.
- If the `atmosphere` task is applied, its fog will fade the band's outer edge
  for free, which is the right look. Do not also fade the material by
  distance; two mechanisms doing one job will drift apart.
