// Free roam: the town, the sleigh, and nothing to do.
//
// Implements `hackathon/menu/free_roam/spec.md`. The main menu's second
// option. The player flies the sleigh anywhere in the world and looks at it --
// no gifts falling, no doorsteps, no clock, and nothing that can end it -- and
// leaves through the main menu when they are finished.
//
// **It is a state the world is in, not a second game.** The spec calls it "god
// mode without the gift, timer, delivery", and that is almost exactly how it
// is built: the run never starts, so `isRunLive()` in main.js is false and the
// three systems the spec names are simply not updated, while the flight model
// and the camera are. The one thing that needs saying out loud is crashing,
// which `Movement.js` asks `isCrashSafe()` about -- see `GameState.js`.
//
// This module owns the two things that are only true here: the line on screen
// that says where the player is, and the key that leaves. The flag itself
// lives in `GameState.js`, because that module owns "what state is the world
// in" and is the one `Movement.js` can import without a cycle.
import { setFreeRoam } from './GameState.js';
import { closeMenu } from './Menu.js';

const BANNER_CLASS = 'free-roam';
const VISIBLE_CLASS = 'visible';
// Set on the body while roaming. The HUD is three readouts about a run that is
// not happening -- the clock, the best time and the gift count -- and one CSS
// rule turning them off is better than four modules each learning that this
// screen exists. The boost gauge stays: the push is still flown, and the tank
// refills on its own without a catch to pay for it.
const BODY_CLASS = 'free-roaming';

const TITLE = 'Free Roam';
// Why they are here, in the spec's own terms: looking at the town.
const BLURB = 'Fly anywhere and look at the town. No presents, no clock, no way to crash.';
// Escape is the key a player will reach for, and it is also the key the
// browser uses to hand the mouse back out of pointer lock -- a press that is
// swallowed before any listener sees it. So while the mouse is locked the
// first Escape frees it and only the second one is heard here, which reads as
// a dead key. B is the way out that always works on the first press, and both
// are offered rather than picking one.
const EXIT_HINT = 'Press Esc or B for the main menu';
const EXIT_KEYS = ['Escape', 'KeyB'];

let bannerElement = null;
let handlers = {};
let roaming = false;

/**
 * Builds the banner and binds the way out.
 *
 * `onEnter` rebuilds the world for a fresh look at it -- the sleigh back at
 * the start, the sack empty, nothing left lying in the snow from the last run
 * -- and `onExit` is the main menu. Both are handed in from main.js, the way
 * `GameState.js` is wired, so this module does not learn what a gift is
 * either.
 */
export function initFreeRoam({ onEnter, onExit }) {
  handlers = { onEnter, onExit };

  bannerElement = document.createElement('div');
  bannerElement.className = BANNER_CLASS;
  bannerElement.innerHTML =
    `<h2>${TITLE}</h2>` +
    `<p class="free-roam-blurb">${BLURB}</p>` +
    `<p class="free-roam-exit">${EXIT_HINT}</p>`;
  document.body.appendChild(bannerElement);

  window.addEventListener('keydown', (event) => {
    // Gated on roaming rather than on the keys alone: B is unbound during a
    // run and Escape belongs to pointer lock, and neither should start
    // meaning "main menu" just because this module was initialised.
    if (!roaming || !EXIT_KEYS.includes(event.code)) return;

    event.preventDefault();
    leaveFreeRoam();
  });
}

/** Opens free roam. Called from the title screen's "Free Roam" option. */
export function enterFreeRoam() {
  roaming = true;
  setFreeRoam(true);
  // The title screen's menu is still holding the keyboard, and W, S and Space
  // are flight controls out here. Letting go is what stops a climb doubling as
  // a menu keypress.
  closeMenu();
  document.body.classList.add(BODY_CLASS);
  bannerElement.classList.add(VISIBLE_CLASS);
  handlers.onEnter();
}

/** Back to the main menu, and the world frozen behind it again. */
export function leaveFreeRoam() {
  roaming = false;
  setFreeRoam(false);
  document.body.classList.remove(BODY_CLASS);
  bannerElement.classList.remove(VISIBLE_CLASS);
  handlers.onExit();
}
