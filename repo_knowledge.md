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
        ├── main.js           # entry point — currently just imports three + style.css
        ├── style.css         # 4 lines, essentially empty
        └── components/       # readme.md only; Three.js components go here
```

Each task directory contains `task.md` (prose explanation for the human), `spec.md` (the prompt
for the agent), `task-info.yaml` (file visibility + `status:` progress), and `images/`.

---

## 4. Current state

**The game is a blank canvas.** `game/src/main.js` is two import lines. `game/src/components/`
holds nothing but a readme. Nothing from any `spec.md` has been implemented yet.

Course metadata shows tasks marked `status: Solved`, but that flag only means "the learner
clicked through the theory page" — it is *not* evidence that game code exists. Always trust
`game/src/` over task status.

Nothing is committed: the repo has **zero commits** and everything was untracked until the
`.gitignore` added in this session.

---

## 5. The build arc (what the specs ask for, in order)

Read the relevant `spec.md` verbatim before implementing — it carries exact constants. Summary:

1. **Skeleton/Scene_setup** — `THREE.Scene`; AmbientLight + DirectionalLight (both intensity
   `1.5`, directional at `(-100,-100,200)`); `components/Player.js` (a `THREE.Group` wrapping
   `tode.glb`, scale `20`, `model.rotation.x = Math.PI/2`, Z-offset from model height);
   `components/Camera.js` (perspective, 30° FOV, far `9000`, pos `(300,-300,300)`,
   `up = (0,0,1)`, looking at origin, added as a *child of the player group*);
   `components/Renderer.js` (`WebGLRenderer` on `canvas.game`, `alpha` + `antialias`, window-sized).
2. **Skeleton/Player_movement** — arrow-key input queue; jump arc via
   `Math.sin(progress * Math.PI)` on Z; constants for speed / jump height / jump distance;
   rotate the *loaded model*, not the group; driven from `setAnimationLoop`.
3. **Skeleton/Adding_enemies** — `components/Enemy.js` (`enemy.glb`, scale `5`, same X rotation,
   Z-offset); four corner spawn points; periodic spawn with a delay constant; per-frame chase
   toward the player plus XY-plane facing rotation.
4. **Skeleton/Collision_detection** — model-shape-based (explicitly *not* raw bounding boxes);
   enemy↔enemy and enemy↔player must not overlap; a min-distance constant; validate the
   intended next position inside the animation loop before committing it.
5. **Skeleton/Attack** — Space key with a cooldown constant (default 1s); yellow
   `CircleGeometry` + `MeshBasicMaterial` flash on the XY ground plane at `z = 0.25`; enemies
   inside the attack radius are removed from the scene and from the tracking array.
6. **Core_loop/Score** — `div.score` at the top of the screen; `SCORE_PER_SECOND` (0.1) and
   `SCORE_PER_KILL` (10); `THREE.Clock`-driven; display floored.
7. **Core_loop/Start_play_game_over** — player↔enemy collision triggers Game Over (this check
   takes priority over normal collision handling); `div.game-over` overlay; hide the player,
   freeze enemies, disable input; Space resets position, enemies, score, and overlay.
8. **Core_loop/Increasing_complexity** — difficulty factor from current score via a growth-rate
   constant; scales spawn delay ↓, enemy speed ↑, player speed ↑ slightly, attack delay ↓,
   attack range ↑ slightly; enemy params scale *faster* than player params; recomputed per
   frame; spawning uses an accumulated timer fed by `clock.getDelta()`.
9. **Visual/Game_world** — `components/Map.js` checkerboard floor (`#228B22` / `#90EE90`);
   `components/House.js` with `small_house.glb` at scale `65`, 3 houses at random positions,
   `rotation.x = Math.PI/2`, random Y rotation in multiples of `Math.PI/2`, bounding-box
   grounding at Z = 0, and collision for houses↔entities and houses↔player.

---

## 6. Conventions worth preserving

- **Z is up.** Hence `camera.up = (0,0,1)` and the `rotation.x = Math.PI/2` on every loaded
  model. Ground plane is XY. Do not silently switch to Three.js's default Y-up.
- **One component per file** in `game/src/components/`, each responsible for creating and
  configuring a single part of the scene and importable from `main.js` (per its readme).
- **Tunables live in named constants**, not inline literals — every spec repeats this, because
  the learner is meant to experiment with the values.
- **`setAnimationLoop`** (not `requestAnimationFrame`) is the loop the specs build on.
- ES modules throughout (`"type": "module"` in both package.json files).

---

## 7. Running it

```bash
cd game
npm install      # if game/node_modules is absent
npm run dev      # vite dev server; open the printed URL
```

In the IDE the learner clicks the run icon next to the `dev` script in `game/package.json`.
Root-level `npm test` belongs to the course harness — per `AGENTS.md`, leave it alone.

---

## 8. Agent checklist

- [ ] Confine edits to `game/` unless the user explicitly asks otherwise.
- [ ] Don't run or fix tests.
- [ ] Read the task's `spec.md` for exact numbers rather than guessing.
- [ ] Keep Z-up and the per-model `rotation.x = Math.PI/2` offsets.
- [ ] Put new scene pieces in `game/src/components/` as single-purpose modules.
- [ ] Extract tunables as constants.
- [ ] Verify by running `npm run dev` and looking at the browser, not by reasoning alone.
