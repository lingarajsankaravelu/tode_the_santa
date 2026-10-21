// Owns whether a run is being played, and the screen that announces one
// ending.
//
// Deliberately almost dependency-free: the pieces that need to freeze
// (movement, enemies, attack, score) only ever ask this module a question, and
// the work of tearing down and rebuilding a run is handed in as callbacks from
// main.js. Importing Enemies/Movement/Score here instead would make those
// imports circular, since they all need to read the flags.
//
// `Menu.js` is the one import, and it is not the thing that rule forbids: it
// is a leaf that imports nothing and knows nothing about the game, so it
// cannot close a cycle. Its header has the longer version. The title screen is
// reached the same way everything else outside this file is -- a callback
// handed in by main.js -- so this module still does not know that one exists.
//
// The run's time arrives the same way, as a `getTime` callback, so this file
// does not learn that `Timer.js` exists either.
import { createMenu, openMenu, closeMenu, activeMenu } from './Menu.js';

// God mode: nothing can end the run. It does NOT lift the world bound, and it
// no longer needs the warning that used to sit here about walking out of the
// basin and falling through the map -- `Terrain.js` knows where the ground is
// everywhere now, and `Movement.js` rests the sleigh on it instead of killing
// it while this is on.
//
// It lives here because "can this run end?" is exactly what this module owns,
// and because every death path -- flying into a house, flying into the ground,
// letting a gift reach it, and dropping a present off a doorstep -- funnels
// through triggerGameOver(), so one guard covers them all.
//
// Off unless asked for: add ?god to the URL, or press G at any time.
const GOD_MODE_PARAM = 'god';
const GOD_MODE_KEY = 'KeyG';
const BADGE_CLASS = 'god-mode';
const BADGE_TEXT = 'GOD MODE · G to toggle';

const OVERLAY_CLASS = 'game-over';
const OVERLAY_TITLE = 'Game Over';
const VISIBLE_CLASS = 'visible';
// Shown when a caller does not say why. Every caller does, but a run that ends
// with an empty line where the reason goes is worse than a vague one.
const DEFAULT_REASON = 'The run ended';

let overlayElement = null;
let reasonElement = null;
let resultElement = null;
let overlayMenu = null;
let badgeElement = null;
let gameOver = false;
// False until something starts a run. The game opens on the title screen now,
// and the world has to hold still behind it -- without this the clock would be
// counting, the storm would be throwing gifts, and the run would be half over
// before the player had pressed anything.
let started = false;
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
 *
 * Gated on this overlay still holding the keyboard, which is the same question
 * as "is the player looking at the Game Over screen right now". On the title
 * screen the run is over too, and G there would launch one from a screen whose
 * only starting key should be Enter.
 */
export function setGodMode(enabled) {
  godMode = enabled;
  showBadge(godMode);

  if (godMode && gameOver && activeMenu() === overlayMenu) restartGame();
}

export function initGameState({ onGameOver, onRestart, onMainMenu, getTime }) {
  handlers = { onGameOver, onRestart, onMainMenu, getTime };

  overlayElement = document.createElement('div');
  overlayElement.className = OVERLAY_CLASS;
  overlayElement.innerHTML =
    `<h1>${OVERLAY_TITLE}</h1>` +
    '<p class="reason"></p>' +
    '<p class="result"></p>';
  reasonElement = overlayElement.querySelector('.reason');
  resultElement = overlayElement.querySelector('.result');

  overlayMenu = createMenu([
    { label: 'Try again', run: () => restartGame() },
    { label: 'Main menu', run: () => leaveToMainMenu() },
  ]);
  overlayElement.appendChild(overlayMenu.element);
  document.body.appendChild(overlayElement);

  badgeElement = document.createElement('div');
  badgeElement.className = BADGE_CLASS;
  badgeElement.textContent = BADGE_TEXT;
  document.body.appendChild(badgeElement);
  showBadge(godMode);

  window.addEventListener('keydown', (event) => {
    if (event.code !== GOD_MODE_KEY) return;

    event.preventDefault();
    setGodMode(!godMode);
  });
}

/**
 * Whether the world should be running this frame: a run has started and has
 * not ended.
 *
 * **This is the one the render loop reads.** `isGameOver()` answers a
 * different question -- which ending it was -- and a title screen is not an
 * ending. When `conclusion/win_state/spec.md` lands, winning is a third flag
 * in here and this is still the only line the loop needs.
 */
export function isRunLive() {
  return started && !gameOver;
}

export function isGameOver() {
  return gameOver;
}

/**
 * Ends the run, and says why on the overlay.
 *
 * `reason` is a short sentence in the player's terms -- "A gift reached the
 * snow", not "gift.z <= crashFloorAt". There are six ways to lose now and most
 * of them look alike from the cockpit, so an overlay that only says "Game
 * Over" leaves the player to infer the rules from silence. That is how
 * climbing to look for a gift gets blamed for a gift landing somewhere behind
 * them.
 */
export function triggerGameOver(reason = DEFAULT_REASON) {
  // The one guard that makes god mode work. Every caller comes through here,
  // so none of them needs to know about it.
  if (godMode) return;

  // Two systems can end the run on the same frame; only the first counts, and
  // that includes which reason is shown. A run that has not begun cannot end
  // either: the title screen freezes the world, and nothing should be able to
  // leave a Game Over waiting behind it.
  if (gameOver || !started) return;

  gameOver = true;
  reasonElement.textContent = reason;
  // The time the run took, which is what the clock in the corner has been
  // counting towards and the only number worth reading on this screen. Frozen
  // by the freeze itself: `updateTimer` is inside main.js's `isRunLive` guard,
  // so the clock stops on this frame and this reads the time it stopped at.
  resultElement.textContent = handlers.getTime
    ? `Time ${handlers.getTime()}`
    : '';
  showOverlay(true);
  openMenu(overlayMenu);
  handlers.onGameOver();
}

/** Back to the title screen. The run stays over, so the world stays frozen. */
function leaveToMainMenu() {
  showOverlay(false);
  // Let go of the keyboard before the title screen takes it, so there is never
  // a moment where two menus would answer the same Enter.
  closeMenu();
  handlers.onMainMenu();
}

/**
 * Starts a run without touching anything else.
 *
 * For the one case that needs it: `?deliver`, which opens straight into a run
 * at boot. A reset there would be a reset of systems whose models are still
 * loading, and there is nothing yet to reset.
 */
export function beginRun() {
  started = true;
  gameOver = false;
  closeMenu();
}

/** Starts a run and rebuilds the world for it. Every other way in comes here. */
export function restartGame() {
  started = true;
  gameOver = false;
  closeMenu();
  showOverlay(false);
  handlers.onRestart();
}
