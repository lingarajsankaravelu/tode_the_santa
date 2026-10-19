// Owns the single "is the run over?" flag and the overlay that announces it.
//
// Deliberately dependency-free: the pieces that need to freeze (movement,
// enemies, attack, score) only ever ask this module a question, and the work
// of tearing down and rebuilding a run is handed in as callbacks from main.js.
// Importing Enemies/Movement/Score here instead would make those imports
// circular, since they all need to read the flag.

// God mode: nothing can end the run. It does NOT lift the world bound --
// Tode stays at z = 0 while the ground outside the basin rises, so walking
// out of it reads as falling through the map. It lives here because "can this
// run end?" is exactly what this module owns, and because both death paths --
// Tode hopping into a monster, and a monster reaching Tode -- already funnel
// through triggerGameOver(), so one guard covers them and any future one.
//
// Off unless asked for: add ?god to the URL, or press G at any time.
const GOD_MODE_PARAM = 'god';
const GOD_MODE_KEY = 'KeyG';
const BADGE_CLASS = 'god-mode';
const BADGE_TEXT = 'GOD MODE · G to toggle';

const OVERLAY_CLASS = 'game-over';
const OVERLAY_TITLE = 'Game Over';
const OVERLAY_HINT = 'Press Space to try again';
const VISIBLE_CLASS = 'visible';

let overlayElement = null;
let badgeElement = null;
let gameOver = false;
let godMode = new URLSearchParams(window.location.search).has(GOD_MODE_PARAM);
let handlers = {};

function showOverlay(visible) {
  overlayElement.classList.toggle(VISIBLE_CLASS, visible);
}

function showBadge(visible) {
  badgeElement.classList.toggle(VISIBLE_CLASS, visible);
}

export function isGodMode() {
  return godMode;
}

/**
 * Turning god mode on clears a Game Over that has already landed, so the
 * toggle is useful from the overlay rather than only before dying.
 */
export function setGodMode(enabled) {
  godMode = enabled;
  showBadge(godMode);

  if (godMode && gameOver) restartGame();
}

export function initGameState({ onGameOver, onRestart }) {
  handlers = { onGameOver, onRestart };

  overlayElement = document.createElement('div');
  overlayElement.className = OVERLAY_CLASS;
  overlayElement.innerHTML = `<h1>${OVERLAY_TITLE}</h1><p>${OVERLAY_HINT}</p>`;
  document.body.appendChild(overlayElement);

  badgeElement = document.createElement('div');
  badgeElement.className = BADGE_CLASS;
  badgeElement.textContent = BADGE_TEXT;
  document.body.appendChild(badgeElement);
  showBadge(godMode);

  window.addEventListener('keydown', (event) => {
    if (event.code === GOD_MODE_KEY) {
      event.preventDefault();
      setGodMode(!godMode);
      return;
    }

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
  // The one guard that makes god mode work. Both callers -- Movement.js when
  // Tode hops into a monster, Enemies.js when a monster reaches him -- come
  // through here, so neither needs to know about it.
  if (godMode) return;

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
