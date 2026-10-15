import { getScore } from './Score.js';

// The difficulty table. These five values used to be static constants in
// Enemies.js, Movement.js and Attack.js; they are gathered here now because
// they are no longer settings but curves, and a curve is only tunable next to
// the others it is balanced against.

// Score worth one full step of difficulty. At 0.005 the factor reaches 1.0 --
// every parameter pinned at its limit -- somewhere around a score of 200.
const COMPLEXITY_GROWTH_RATE = 0.005;

// How much of the factor each side actually feels. The monsters take the whole
// ramp, Tode a third of it, so the odds tilt against him as the run goes on.
const ENEMY_RAMP = 1;
const PLAYER_RAMP = 0.35;

// base: the value at score 0. limit: where the ramp stops. The clamp matters --
// an unbounded linear ramp drives the spawn delay through zero and starts
// spawning a monster per frame.
const PARAMETERS = {
  spawnDelay: { base: 2, limit: 0.35, ramp: ENEMY_RAMP },
  enemySpeed: { base: 1.5, limit: 6, ramp: ENEMY_RAMP },
  moveSpeed: { base: 0.04, limit: 0.08, ramp: PLAYER_RAMP },
  attackCooldown: { base: 1, limit: 0.3, ramp: PLAYER_RAMP },
  attackRadius: { base: 60, limit: 90, ramp: PLAYER_RAMP },
};

// Recomputed each frame and read by the systems above. Mutated in place rather
// than replaced, so it stays a single allocation across a long run.
const current = {};

function scale(parameter, factor) {
  // Linear in the difficulty factor, held at the limit once it arrives.
  const progress = Math.min(factor * parameter.ramp, 1);

  return parameter.base + (parameter.limit - parameter.base) * progress;
}

export function getDifficultyFactor() {
  return getScore() * COMPLEXITY_GROWTH_RATE;
}

export function updateDifficulty() {
  const factor = getDifficultyFactor();

  Object.entries(PARAMETERS).forEach(([name, parameter]) => {
    current[name] = scale(parameter, factor);
  });
}

export function getDifficulty() {
  return current;
}
