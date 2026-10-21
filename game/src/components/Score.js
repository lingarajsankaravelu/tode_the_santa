// **Retired.** Nothing imports this any more -- see `Timer.js`, which
// replaces it.
//
// The score was a survival counter: a tenth of a point per second alive, plus
// ten for each monster killed. The monsters left the game, which took the
// second half; and the first half has the wrong sign for what the game became.
// Tode is racing to collect five gifts and deliver them, so time alive is the
// thing being minimised, not a reward being accumulated.
//
// Kept on disk rather than deleted, the same deal `Enemies.js` and `Attack.js`
// already have in this project: restoring a score is this file plus the three
// call sites commented out of `main.js`. Nothing below has changed.
import * as THREE from 'three';

// Points earned per second of staying alive: 1 point per 10 seconds.
const SCORE_PER_SECOND = 0.1;
// Points earned for each gift caught out of the storm. Was SCORE_PER_KILL,
// which had no caller once the monsters left the game; renamed rather than
// joined by a second function next to a dead one.
const SCORE_PER_CATCH = 10;

const clock = new THREE.Clock();

let scoreElement = null;
// Kept fractional so slow survival points accumulate; only the display floors.
let score = 0;
let displayedScore = null;

function render() {
  const floored = Math.floor(score);

  // The loop calls this every frame, so skip DOM writes that change nothing.
  if (floored === displayedScore) return;

  displayedScore = floored;
  scoreElement.textContent = `Score: ${floored}`;
}

export function initScore() {
  scoreElement = document.createElement('div');
  scoreElement.className = 'score';
  document.body.appendChild(scoreElement);

  // Discard the time spent loading models so survival points start at zero.
  clock.getDelta();
  render();
}

export function addCatchScore() {
  score += SCORE_PER_CATCH;
}

export function resetScore() {
  score = 0;
  clock.getDelta();
  render();
}

export function getScore() {
  return score;
}

export function updateScore() {
  score += clock.getDelta() * SCORE_PER_SECOND;
  render();
}
