// Owns whether a run is being played, and the two screens that announce how
// it finished.
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

// The other ending. It shares the Game Over screen's layout -- the element
// carries both classes -- and differs in three things: it is lighter, because
// the whole point is that the town behind it is lit; it says what happened
// rather than what went wrong; and the first option is to play again rather
// than to try again, which is the same key and a different sentence.
const WIN_CLASS = 'win';
const WIN_TITLE = 'Merry Christmas';
const WIN_REASON = "Five presents, five doorsteps. Tode's round is finished.";
const WIN_BEST = 'Your best yet';
// Shown when a caller does not say why. Every caller does, but a run that ends
// with an empty line where the reason goes is worse than a vague one.
const DEFAULT_REASON = 'The run ended';

let overlayElement = null;
let reasonElement = null;
let resultElement = null;
let overlayMenu = null;
let winElement = null;
let winResultElement = null;
let winBestElement = null;
let winMenu = null;
let badgeElement = null;
let gameOver = false;
let won = false;
// False until something starts a run. The game opens on the title screen now,
// and the world has to hold still behind it -- without this the clock would be
// counting, the storm would be throwing gifts, and the run would be half over
// before the player had pressed anything.
let started = false;
let godMode = new URLSearchParams(window.location.search).has(GOD_MODE_PARAM);
// Free roam: the player is out looking at the town rather than playing a run.
// `FreeRoam.js` owns the screen and the way out of it; what lives here is the
// flag, because this module owns what state the world is in and is the one
// `Movement.js` can read without an import cycle.
//
// It is NOT a run: `started` stays false, so `isRunLive()` is false, the
// gifts, the clock and the deliveries are never updated, and `triggerGameOver`
// has already returned by the time god mode would have been asked about.
let freeRoam = false;
let handlers = {};

function showOverlay(visible) {
  overlayElement.classList.toggle(VISIBLE_CLASS, visible);
}

function showWin(visible) {
  winElement.classList.toggle(VISIBLE_CLASS, visible);
}

function showBadge(visible) {
  badgeElement.classList.toggle(VISIBLE_CLASS, visible);
}

export function isGodMode() {
  return godMode;
}

/** Whether the player is free roaming. Read by main.js's loop. */
export function isFreeRoam() {
  return freeRoam;
}

/**
 * Enters or leaves free roam. Called only by `FreeRoam.js`.
 *
 * Entering clears the run that ended, and that is not tidiness: "Main menu"
 * leaves `gameOver` standing on purpose, so the world stays frozen behind the
 * title screen -- and `updateMovement` returns early while it is set, so a
 * roam entered after a crash would be a sleigh that could not be flown.
 * Leaving does not put it back: the player is being handed the title screen,
 * and a frozen world is what `started` being false already gives.
 */
export function setFreeRoam(enabled) {
  freeRoam = enabled;

  if (!enabled) return;

  gameOver = false;
  won = false;
}

/**
 * Whether flying into something is survivable.
 *
 * The question `Movement.js` actually has at its two crash sites, and it has
 * two answers for the same reason: god mode is "this run cannot end", and
 * free roam is a sightseeing flight that has no run to end. Both want the
 * same behaviour -- the sleigh stops against a wall instead of being allowed
 * through it, and rests on ground that would otherwise be fatal.
 *
 * Distinct from `isGodMode()`, which is still what the badge and the G key
 * are about: free roam does not switch god mode on, and leaving free roam
 * must not switch it off under a player who asked for it.
 */
export function isCrashSafe() {
  return godMode || freeRoam;
}

/**
 * Turning god mode on clears a Game Over that has already landed, so the
 * toggle is useful from the overlay rather than only before dying.
 *
 * Gated on this overlay still holding the keyboard, which is the same question
 * as "is the player looking at the Game Over screen right now". On the title
 * screen the run is over too, and G there would launch one from a screen whose
 * only starting key should be Enter.
 *
 * And on `gameOver` rather than on any "is the run over" question, so that
 * pressing G on the win screen does not silently throw a finished run away.
 * God mode rescues you from a death; there is nothing to be rescued from
 * after five deliveries.
 */
export function setGodMode(enabled) {
  godMode = enabled;
  showBadge(godMode);

  if (godMode && gameOver && activeMenu() === overlayMenu) restartGame();
}

export function initGameState({
  onGameOver,
  onWin,
  onRestart,
  onMainMenu,
  getTime,
  isBestRun,
}) {
  handlers = { onGameOver, onWin, onRestart, onMainMenu, getTime, isBestRun };

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

  winElement = document.createElement('div');
  // Both classes: the layout, the title size and the result line are the Game
  // Over screen's, and `.win` only changes what has to change.
  winElement.className = `${OVERLAY_CLASS} ${WIN_CLASS}`;
  winElement.innerHTML =
    `<h1>${WIN_TITLE}</h1>` +
    `<p class="reason">${WIN_REASON}</p>` +
    '<p class="result"></p>' +
    `<p class="best">${WIN_BEST}</p>`;
  winResultElement = winElement.querySelector('.result');
  winBestElement = winElement.querySelector('.best');

  winMenu = createMenu([
    { label: 'Play again', run: () => restartGame() },
    { label: 'Main menu', run: () => leaveToMainMenu() },
  ]);
  winElement.appendChild(winMenu.element);
  document.body.appendChild(winElement);

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
 * **This is the one the render loop reads**, and the only one anything
 * outside this module should be asking in order to decide whether to run.
 * `isGameOver()` and `isWon()` answer a different question -- which of the
 * three states the run is in -- and if a reviewer finds either of them
 * guarding an update, that is the bug this comment exists to prevent.
 *
 * `win_state/spec.md` asks for this as `isRunOver()`, the negation of three
 * quarters of this. It is not exported under that name because there is no
 * caller for it: a title screen is not an ending, so the loop needs the
 * "started" half as well, and one question with one answer is better than two
 * that have to agree.
 */
export function isRunLive() {
  return started && !gameOver && !won;
}

export function isGameOver() {
  return gameOver;
}

/** Which ending it was. The town is lit and the clock has stopped. */
export function isWon() {
  return won;
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
  // that includes which reason is shown. A won run is closed to this as well:
  // the fifth delivery and a crash cannot both be the ending, and the one that
  // got there first was the one that stopped the world. A run that has not
  // begun cannot end either -- the title screen freezes the world, and nothing
  // should be able to leave a Game Over waiting behind it.
  if (gameOver || won || !started) return;

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

/**
 * The run is won: five gifts caught, five houses served.
 *
 * **No god-mode guard, deliberately.** `triggerGameOver` opens with one,
 * because god mode is "the run cannot end badly"; being denied the ending
 * after delivering five presents is not that, it is a broken run.
 *
 * `handlers.onWin()` runs BEFORE the screen is filled in, and that order is
 * load-bearing: it is what stops the clock and banks the time, so the two
 * lines below are reading a result that has already been settled.
 */
export function triggerWin() {
  if (won || !started) return;

  won = true;
  handlers.onWin();

  winResultElement.textContent = handlers.getTime
    ? `Time ${handlers.getTime()}`
    : '';
  // Shown only when it is true, which on a first finished run it always is.
  winBestElement.style.display = handlers.isBestRun?.() ? '' : 'none';
  showWin(true);
  openMenu(winMenu);
}

/** Back to the title screen. The run stays over, so the world stays frozen. */
function leaveToMainMenu() {
  showOverlay(false);
  showWin(false);
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
  won = false;
  closeMenu();
}

/** Starts a run and rebuilds the world for it. Every other way in comes here. */
export function restartGame() {
  started = true;
  gameOver = false;
  won = false;
  closeMenu();
  showOverlay(false);
  showWin(false);
  handlers.onRestart();
}
