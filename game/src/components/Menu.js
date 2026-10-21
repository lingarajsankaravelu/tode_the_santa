// One keyboard menu, used by both screens that have one: the title screen and
// the Game Over screen.
//
// A leaf. This module imports nothing and knows nothing about the game -- no
// player, no scene, no flags -- which is what lets `GameState.js` use it
// without breaking the rule in its header. That rule exists to stop import
// cycles, and a module with no imports cannot be in one; what it forbids is
// `GameState.js` learning what a gift or a house is, and a list of labels with
// a selection on it is neither.
//
// **One listener for every menu.** The keyboard is held by at most one menu at
// a time (`active`), so the two screens cannot both answer the same Enter --
// which is the whole reason this is a module rather than a function each
// screen calls. Nothing is listening while a run is being played, which is
// also what lets W and S be menu keys without touching the flight controls.

const LIST_CLASS = 'menu';
const ITEM_CLASS = 'menu-item';
const SELECTED_CLASS = 'selected';
const HINT_CLASS = 'menu-hint';
const HINT_TEXT = 'Up / Down to choose · Enter to confirm';

// W and S alongside the arrows because that is where the hands already are --
// the run that just ended was flown on WASD, and a player reaching for the
// arrow keys has to look down to find them.
const UP_KEYS = ['ArrowUp', 'KeyW'];
const DOWN_KEYS = ['ArrowDown', 'KeyS'];
// Space is kept as a confirm alias. It used to be the only way off the Game
// Over screen -- "Press Space to try again" -- and the first item there is
// still Try again, so every hand that learned that key gets what it expects.
// `Delivery.js` listens for Space too and stands down whenever the run is
// over, so there is no chance of restarting and dropping a gift on one press.
const CONFIRM_KEYS = ['Enter', 'NumpadEnter', 'Space'];

let active = null;
let listening = false;

function render(menu) {
  menu.items.forEach((item, index) => {
    item.element.classList.toggle(SELECTED_CLASS, index === menu.index);
  });
}

function move(step) {
  const { items } = active;

  // Wrapping rather than clamping: these lists are two items long and do not
  // scroll, so Down twice from the top is a round trip and never a dead key.
  active.index = (active.index + step + items.length) % items.length;
  render(active);
}

function onKey(event) {
  if (!active) return;

  if (UP_KEYS.includes(event.code)) {
    event.preventDefault();
    move(-1);
    return;
  }

  if (DOWN_KEYS.includes(event.code)) {
    event.preventDefault();
    move(1);
    return;
  }

  if (!CONFIRM_KEYS.includes(event.code)) return;

  event.preventDefault();

  // Read before it runs: `run` usually ends by taking the keyboard away from
  // this menu, and on a restart it clears `active` altogether.
  const { run } = active.items[active.index];

  run();
}

/**
 * Builds a menu element: one row per item, and the line naming the keys.
 *
 * `items` is `{ label, run }`. The row elements are kept on the items
 * themselves rather than looked up by index afterwards, so the selection
 * cannot drift out of step with the DOM.
 */
export function createMenu(items) {
  if (!listening) {
    listening = true;
    window.addEventListener('keydown', onKey);
  }

  const element = document.createElement('div');
  const hint = document.createElement('p');

  element.className = LIST_CLASS;

  items.forEach((item) => {
    const row = document.createElement('div');

    row.className = ITEM_CLASS;
    row.textContent = item.label;
    element.appendChild(row);
    item.element = row;
  });

  hint.className = HINT_CLASS;
  hint.textContent = HINT_TEXT;
  element.appendChild(hint);

  return { element, items, index: 0 };
}

/** Hands this menu the keyboard, selection back at the top. */
export function openMenu(menu) {
  active = menu;
  // The selection is not a preference to remember: the player has just arrived
  // at this screen, and the first item is the one the screen is for.
  menu.index = 0;
  render(menu);
}

/** Nothing is listening. Called when a screen closes without another opening. */
export function closeMenu() {
  active = null;
}

/** Which menu has the keyboard, or null while the run is being played. */
export function activeMenu() {
  return active;
}
