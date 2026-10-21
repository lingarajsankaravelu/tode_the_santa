// Owns the single "is the run over?" flag and the overlay that announces it.
//
// Deliberately dependency-free: the pieces that need to freeze (movement,
// enemies, attack, score) only ever ask this module a question, and the work
// of tearing down and rebuilding a run is handed in as callbacks from main.js.
// Importing Enemies/Movement/Score here instead would make those imports
// circular, since they all need to read the flag.

// God mode: nothing can end the run. It does NOT lift the world bound, and it
// no longer needs the warning that used to sit here about walking out of the
// basin and falling through the map -- `Terrain.js` knows where the ground is
// everywhere now, and `Movement.js` rests the sleigh on it instead of killing
// it while this is on.
//
// It lives here because "can this run end?" is exactly what this module owns,
// and because every death path -- flying into a house, flying into the ground,
// and letting a gift reach it -- funnels through triggerGameOver(), so one
// guard covers them all.
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
// Shown when a caller does not say why. Every caller does, but a run that ends
// with an empty line where the reason goes is worse than a vague one.
const DEFAULT_REASON = 'The run ended';

let overlayElement = null;
let reasonElement = null;
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
  overlayElement.innerHTML =
    `<h1>${OVERLAY_TITLE}</h1><p class="reason"></p><p>${OVERLAY_HINT}</p>`;
  reasonElement = overlayElement.querySelector('.reason');
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

    // Space is the climb key during play, so only claim it once the run is
    // over. Attack.js stands down for the same reason.
    if (event.code !== 'Space' || !gameOver) return;

    event.preventDefault();
    restartGame();
  });
}

export function isGameOver() {
  return gameOver;
}

/**
 * Ends the run, and says why on the overlay.
 *
 * `reason` is a short sentence in the player's terms -- "A gift reached the
 * snow", not "gift.z <= crashFloorAt". There are five ways to lose now and
 * four of them look alike from the cockpit, so an overlay that only says
 * "Game Over" leaves the player to infer the rules from silence. That is how
 * climbing to look for a gift gets blamed for a gift landing somewhere behind
 * them.
 */
export function triggerGameOver(reason = DEFAULT_REASON) {
  // The one guard that makes god mode work. Every caller comes through here,
  // so none of them needs to know about it.
  if (godMode) return;

  // Two systems can end the run on the same frame; only the first counts, and
  // that includes which reason is shown.
  if (gameOver) return;

  gameOver = true;
  reasonElement.textContent = reason;
  showOverlay(true);
  handlers.onGameOver();
}

export function restartGame() {
  gameOver = false;
  showOverlay(false);
  handlers.onRestart();
}
