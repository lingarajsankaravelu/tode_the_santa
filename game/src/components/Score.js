import * as THREE from 'three';

// Points earned per second of staying alive: 1 point per 10 seconds.
const SCORE_PER_SECOND = 0.1;
// Points earned for each enemy defeated.
const SCORE_PER_KILL = 10;

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

export function addKillScore() {
  score += SCORE_PER_KILL;
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
