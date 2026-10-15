// Owns the single "is the run over?" flag and the overlay that announces it.
//
// Deliberately dependency-free: the pieces that need to freeze (movement,
// enemies, attack, score) only ever ask this module a question, and the work
// of tearing down and rebuilding a run is handed in as callbacks from main.js.
// Importing Enemies/Movement/Score here instead would make those imports
// circular, since they all need to read the flag.

const OVERLAY_CLASS = 'game-over';
const OVERLAY_TITLE = 'Game Over';
const OVERLAY_HINT = 'Press Space to try again';
const VISIBLE_CLASS = 'visible';

let overlayElement = null;
let gameOver = false;
let handlers = {};

function showOverlay(visible) {
  overlayElement.classList.toggle(VISIBLE_CLASS, visible);
}

export function initGameState({ onGameOver, onRestart }) {
  handlers = { onGameOver, onRestart };

  overlayElement = document.createElement('div');
  overlayElement.className = OVERLAY_CLASS;
  overlayElement.innerHTML = `<h1>${OVERLAY_TITLE}</h1><p>${OVERLAY_HINT}</p>`;
  document.body.appendChild(overlayElement);

  window.addEventListener('keydown', (event) => {
    // Space is the attack key during play, so only claim it once the run is
    // over. Attack.js stands down for the same reason.
    if (event.code !== 'Space' || !gameOver) return;

    event.preventDefault();
    restartGame();
  });
}

export function isGameOver() {
  return gameOver;
}

export function triggerGameOver() {
  // Several enemies can reach Tode on the same frame; only the first counts.
  if (gameOver) return;

  gameOver = true;
  showOverlay(true);
  handlers.onGameOver();
}

export function restartGame() {
  gameOver = false;
  showOverlay(false);
  handlers.onRestart();
}
