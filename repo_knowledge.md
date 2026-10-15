# Repo Knowledge — `tod_the_frog`

Orientation doc for the next AI agent working in this repo. Read this before touching anything.

---

## 1. Why this repo exists

This is **not** a normal application repo. It is a **JetBrains Academy course project**:
*"Build a Game with an AI Coding Agent"* (marketplace plugin id `30327`, also on Coursera).

The repo has two halves with completely different purposes:

| Half | Purpose | Who edits it |
|---|---|---|
| `Introduction/`, `Skeleton/`, `Core_loop/`, `Visual/`, `Conclusion/` | **Course content** — lesson text, screenshots, and the per-task `spec.md` prompt files | Course authors (JetBrains). **Do not edit.** |
| `game/` | **The learner's deliverable** — a 3D browser game built with Three.js + Vite | The learner *and the AI agent* |

The pedagogical premise: the learner never writes the game by hand. Each task hands them a
`spec.md` written as a prompt for an AI coding agent. They feed it to the agent, review the
output, run the game, and keep what works. So the *real* product of this repo is the learner's
judgment — the game is the artifact that proves it.

**The story**: Tode the Frog is brewing morning tea when monsters swarm his home. The player
helps Tode fight them off and survive.

---

## 2. Hard constraints (from `AGENTS.md` and `.junie/guidelines.md`)

Both files say exactly the same two things, and they are the operating rules:

1. **Make changes in the `game` directory only.**
2. **Don't look for or run tests.**

Rule 1 exists because edits outside `game/` corrupt course state (task metadata, progress
tracking) and conflict with upstream course updates. Rule 2 exists because the Jest harness
(`jest.config.js`, `utils.js`, `__mocks__/`, `run/`) belongs to the course validation
infrastructure, not to the learner's workflow — chasing tests is a dead end here.

*Exception*: the learner can of course explicitly ask for a root-level file (this document and
`.gitignore` were requested that way). Treat an explicit user request as overriding rule 1, but
say so out loud; never wander outside `game/` on your own initiative.

---

## 3. Layout

```
tod_the_frog/
├── AGENTS.md                 # agent rules (2 lines, see above)
├── .junie/guidelines.md      # same rules, for JetBrains Junie
├── course-info.yaml          # course manifest: lesson order + file visibility
├── course-remote-info.yaml   # marketplace id / version
├── package.json              # ROOT: course test harness deps (jest, babel, express…)
├── jest.config.js            # course validation harness — do not run
├── utils.js, __mocks__/, run/# course test plumbing
│
├── Introduction/             # lesson 1: Welcome, Working on the project
├── Skeleton/                 # lesson 2: Scene_setup → Player_movement → Adding_enemies
│                             #           → Collision_detection → Attack
├── Core_loop/                # lesson 3: Score → Start_play_game_over → Increasing_complexity
├── Visual/                   # lesson 4: Game_world
├── Conclusion/               # lesson 5: Summary
│
└── game/                     # ← THE WORK AREA
    ├── package.json          # vite + three; scripts: dev / build / preview
    ├── index.html            # <canvas class="game">, loads /src/main.js
    ├── public/
    │   ├── tode.svg
    │   └── models/           # tode.glb, enemy.glb, small_house.glb
    └── src/
        ├── main.js           # entry point: scene, lights, wiring, the one animation loop
        ├── style.css         # body reset + .score and .game-over overlay
        └── components/       # twelve single-purpose modules (see §4)
```

Each task directory contains `task.md` (prose explanation for the human), `spec.md` (the prompt
for the agent), `task-info.yaml` (file visibility + `status:` progress), and `images/`.

---

## 4. Current state

**The game is finished.** Every implementation task in the course has been built, run-tested in
the browser, and merged. `Conclusion/Summary` is the only task left and it is pure theory —
there is nothing to implement for it.

20 commits, 9 merged PRs, one per task, in course order:

| PR | Task |
|---|---|
| #1 | `Skeleton/Scene_setup` — give Tode a world to stand in |
| #2 | `Skeleton/Player_movement` — Tode learns to hop |
| #3 | `Skeleton/Adding_enemies` — Tode acquires a monster problem |
| #4 | `Skeleton/Collision_detection` — monsters learn about personal space |
| #5 | `Skeleton/Attack` — Tode fights back |
| #6 | `Core_loop/Score` — Tode gets a scoreboard |
| #7 | `Core_loop/Start_play_game_over` — Tode can now lose |
| #8 | `Core_loop/Increasing_complexity` — the monsters get ideas |
| #9 | `Visual/Game_world` — Tode gets a lawn and neighbours |

`game/src/` is about 1000 lines across twelve components plus `main.js` and `style.css`:

| File | Role |
|---|---|
| `main.js` | scene, lights, wiring, the one `setAnimationLoop` |
| `Renderer.js` | `WebGLRenderer` on `canvas.game` |
| `Camera.js` | 30° perspective camera, **added as a child of the player group** |
| `Player.js` | `tode.glb` in a Group, exposes `.model` |
| `Enemy.js` | `enemy.glb` in a Group, exposes `.model` |
| `Enemies.js` | spawn cycle, chase, the enemy array |
| `Movement.js` | arrow-key hop queue and jump arc |
| `Collision.js` | circular ground footprints, `wouldCollide` / `isPositionFree` |
| `Attack.js` | Space, cooldown, the yellow flash, kills |
| `Score.js` | `div.score`, survival + kill points |
| `GameState.js` | the Game Over flag and overlay |
| `Difficulty.js` | the difficulty table, recomputed per frame |
| `Map.js` | checkerboard floor |
| `House.js` | the three houses and their placement |

### A caveat about task status

Course metadata marks tasks `status: Solved`, but that flag only means the learner clicked
through the theory page. It is **not** evidence that game code exists. Trust `game/src/` over
task status.

### The modified course files

The IDE rewrites `task-info.yaml` (and once `Core_loop/Score/spec.md`) as the learner moves
through the course. Nine such files show as modified and have been **deliberately left unstaged
and uncommitted** across all nine PRs, under rule 1 above. Leave them alone; do not "tidy" them
into a commit.

---

## 5. What each task asked for

The specs are still the authority — read the relevant `spec.md` verbatim, it carries exact
constants. This is the map of what ended up where.

1. **Skeleton/Scene_setup** — `THREE.Scene`; AmbientLight + DirectionalLight (both intensity
   `1.5`, directional at `(-100,-100,200)`); `Player.js` (a `THREE.Group` wrapping `tode.glb`,
   scale `20`, `model.rotation.x = Math.PI/2`, Z-offset from the model's measured height);
   `Camera.js` (perspective, 30° FOV, far `9000`, pos `(300,-300,300)`, `up = (0,0,1)`, looking
   at origin, added as a *child of the player group*); `Renderer.js` (`WebGLRenderer` on
   `canvas.game`, `alpha` + `antialias`, window-sized).
2. **Skeleton/Player_movement** — arrow-key input queue, one press = one hop; jump arc via
   `Math.sin(progress * Math.PI)` on Z; `JUMP_HEIGHT = 25`, `JUMP_DISTANCE = 80`.
3. **Skeleton/Adding_enemies** — `Enemy.js` (`enemy.glb`, scale `5`); four corner spawn points
   at `SPAWN_DISTANCE = 220`; cycling periodic spawn; per-frame chase plus facing rotation.
4. **Skeleton/Collision_detection** — circular ground footprints, explicitly *not* raw bounding
   boxes; `MIN_COLLISION_DISTANCE = 8`; the intended next position is validated before it is
   committed.
5. **Skeleton/Attack** — Space with a cooldown; yellow `CircleGeometry` flash on the ground
   plane at `z = 0.25`, fading over `FLASH_DURATION = 0.25`; enemies inside the radius leave
   both the scene and the tracking array.
6. **Core_loop/Score** — `div.score`; `SCORE_PER_SECOND = 0.1`, `SCORE_PER_KILL = 10`; display
   floored.
7. **Core_loop/Start_play_game_over** — player↔enemy contact ends the run, and that check takes
   priority over normal collision handling; `div.game-over` overlay; Space restarts.
8. **Core_loop/Increasing_complexity** — a difficulty factor from the current score scales spawn
   delay ↓, enemy speed ↑, player speed ↑ slightly, attack cooldown ↓, attack range ↑ slightly,
   with enemy parameters ramping faster than the player's.
9. **Visual/Game_world** — `Map.js` checkerboard floor (`#228B22` / `#90EE90`); `House.js` with
   `small_house.glb` at scale `65`, 3 houses at random positions, random Y rotation in multiples
   of `Math.PI/2`, bounding-box grounding at Z = 0, and collision against both entities and the
   player.

---

## 6. Conventions worth preserving

- **Z is up.** Hence `camera.up = (0,0,1)` and `rotation.x = Math.PI/2` on every loaded model.
  The ground plane is XY. Do not silently switch to Three.js's default Y-up.
- **One component per file** in `game/src/components/`, each importable from `main.js`.
- **Tunables live in named constants**, not inline literals — every spec repeats this, because
  the learner is meant to experiment with the values.
- **`setAnimationLoop`** (not `requestAnimationFrame`) is the loop the specs build on. There is
  exactly one, at the bottom of `main.js`.
- ES modules throughout (`"type": "module"` in both package.json files).
- **Comments carry the reasoning, not the mechanics.** The existing code explains *why* a value
  or an ordering is what it is, often with the failure it prevents. Match that.

---

## 7. Traps that have already been hit

Each of these cost real debugging time. They are easy to walk back into.

1. **The camera is a child of the player group.** Two consequences, both load-bearing:
   - Facing rotation must go on `player.model.rotation.y`, never on the group — rotating the
     group swings the camera with it.
   - Hiding the player must hide `player.model`, not the group, or the camera goes with it.
2. **An empty scene makes movement invisible.** With the camera parented to the player and
   nothing static in the world, Tode moves, the view moves with him, and the screen does not
   change. This looked like broken movement twice before `Map.js` existed. If the floor is ever
   removed, expect the same report.
3. **`Box3.setFromObject` is skinning-aware; raw vertex reads are not.** `enemy.glb` is a
   skinned mesh whose bones carry a scale of 100, so reading `geometry.attributes.position`
   gave radii anywhere from 12 to 1639 for the same model depending on the pose sampled, and
   anything past ~300 silently froze every enemy where it spawned. Always measure through
   `Box3.setFromObject`.
4. **`clone()` is safe for the static models only.** `small_house.glb` and `tode.glb` are single
   static meshes; `enemy.glb` has 20 nodes, a skin and 8 animations, and clones would share the
   skeleton. Check before cloning.
5. **`GameState.js` must import nothing.** Movement, Enemies, Attack and Score all need to read
   the Game Over flag, so any import back out of `GameState` is a cycle. Reset is orchestrated
   from `main.js` instead, which already imports everything, and handed in as callbacks.
6. **Burn `clock.getDelta()` on every reset and init.** Otherwise the wall time spent loading
   models or sitting on the Game Over screen gets paid out at once — as an instant enemy spawn,
   or a score that jumps on restart. `clearEnemies`, `resetScore` and `initScore` all do this.
7. **Fractional score, floored only at render.** At 0.1 points per second, rounding every frame
   makes the increment zero and the counter never moves.
8. **The difficulty ramp must be clamped.** An unbounded linear ramp drives the spawn delay
   through zero and starts spawning a monster per frame. `Difficulty.js` holds each parameter at
   a stated limit.
9. **Game Over outranks collision handling.** These two spec clauses are one requirement: as
   long as the player sits in the enemies' obstacle list, enemies settle at exactly the clearance
   distance and contact is unreachable, so a naive "are they touching?" test is dead code. The
   player is kept *out* of the obstacle list, and each side tests its intended next position
   against the other before committing it.
10. **Nothing does pathfinding.** A monster blocked by a house would push at the near wall for
    the rest of the run, so a blocked step retries on each axis alone. If obstacles ever get
    bigger or more numerous, this is the first thing that will stop being good enough.
11. **`THREE.Color` converts sRGB to linear on the way in.** For a texture that must come out as
    a named hex colour, pull the bytes out of the hex with bit shifts and set
    `texture.colorSpace = THREE.SRGBColorSpace`.
12. **Keep the floor off the ground plane.** Models rest at exactly `z = 0`, so the floor sits at
    `-0.05`; coplanar surfaces shimmer.

---

## 8. Workflow the learner expects

Established over all nine tasks, and worth following:

1. *"create a branch and do @`<Lesson>`/`<Task>`/spec.md"* — branch as `feature/<task-name>`,
   read the spec verbatim, implement.
2. The learner run-tests in the browser themselves. Do not declare it working first.
3. *"raise a pr"* — commit, push, `gh pr create`. The house style for the description is
   **professional and light hearted**: a plain-language summary, the decisions that were
   judgement calls and why, and the traps avoided. Title as `<Lesson>/<Task>: <wry one-liner>`.
4. *"pr is merged, delete the branch and pull main"* — **verify the merged state first**
   (`gh pr view <n> --json state`), then checkout main, pull, delete local and remote branch,
   prune. A PR was once reported merged while `gh` still said `OPEN`; the branch was not deleted
   and the reason was explained, which is why verification comes first every time.

---

## 9. Running it

```bash
cd game
npm install      # if game/node_modules is absent
npm run dev      # vite dev server; open the printed URL
```

In the IDE the learner clicks the run icon next to the `dev` script in `game/package.json`.
Root-level `npm test` belongs to the course harness — per `AGENTS.md`, leave it alone.

---

## 10. Agent checklist

- [ ] Confine edits to `game/` unless the user explicitly asks otherwise — and say so out loud
      when they do.
- [ ] Leave the modified `task-info.yaml` files uncommitted.
- [ ] Don't run or fix tests.
- [ ] Read the task's `spec.md` for exact numbers rather than guessing.
- [ ] Keep Z-up and the per-model `rotation.x = Math.PI/2` offsets.
- [ ] Remember the camera is a child of the player group.
- [ ] Put new scene pieces in `game/src/components/` as single-purpose modules.
- [ ] Extract tunables as constants, and comment *why* the value is what it is.
- [ ] Read §7 before debugging anything that looks impossible.
- [ ] Verify by running `npm run dev` and looking at the browser, not by reasoning alone.
