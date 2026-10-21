// The Controls screen: every key the game answers, written for a player.
//
// Implements `hackathon/menu/controls/spec.md`. The main menu's third option,
// and the one thing in the game that has no gameplay in it at all -- it is a
// page to be read, and the only input it takes is the way back out.
//
// **Layman's terms, as the spec asks.** Nothing on this screen says yaw,
// pitch, altitude, pointer lock or god mode without saying what it does: the
// reader is someone who has just opened a Christmas sleigh game, not someone
// who has read `Movement.js`. The code names each row by its key and leaves
// the plain-English half to the data below, so adding a binding means adding
// one line here rather than editing a paragraph of HTML.
//
// **It sits over the title screen rather than replacing it.** The storm, the
// aurora and Tode in the corner carry on behind a scrim, so choosing Controls
// reads as a panel opening on the menu the player is already looking at --
// and there is nothing to rebuild when they go back. The keyboard is what
// actually changes hands: `Menu.js` holds one menu at a time, so opening this
// one takes Up / Down and Enter off the main menu for as long as it is up.
import { createMenu, openMenu } from './Menu.js';

const SCREEN_CLASS = 'controls-screen';
const VISIBLE_CLASS = 'visible';

const TITLE = 'Controls';
const BLURB = 'Everything the sleigh answers to.';

// Esc and B as well as the Back row, for the same reason `FreeRoam.js` offers
// both: this is a screen a player opens by accident and wants out of, and the
// two keys they will try first are the ones that hand a screen back. The
// mouse is never locked while the title screen is up, so Esc is heard on the
// first press here, unlike out in the world.
const EXIT_KEYS = ['Escape', 'KeyB'];

// The groups, in the order a player meets them: steering first, because that
// is what they will be doing a second after they leave this screen; the
// presents next, because that is the game; the view after that; and the
// switches last, because none of them are needed to play.
//
// `keys` is what is printed in the key cap -- the label the player sees on
// their own keyboard, so `Left Shift` and `Space bar` rather than key codes.
const GROUPS = [
  {
    name: 'Flying the sleigh',
    rows: [
      { keys: ['W'], text: 'Fly forward' },
      { keys: ['S'], text: 'Fly backward' },
      { keys: ['A'], text: 'Slide to the left' },
      { keys: ['D'], text: 'Slide to the right' },
      // Q climbs and E drops, which is the way round `Movement.js` has them.
      { keys: ['Q'], text: 'Go up -- climb higher into the sky' },
      { keys: ['E'], text: 'Go down -- drop closer to the ground' },
      {
        keys: ['Left Shift'],
        // Held, not tapped, and worth saying: a boost that is pressed once
        // does nothing a player would notice.
        text: 'Hold for a speed boost -- the sleigh goes fast',
      },
    ],
  },
  {
    name: 'Presents',
    rows: [
      { keys: ['Space bar'], text: 'Drop a present on the house below you' },
    ],
  },
  {
    name: 'Looking around',
    rows: [
      {
        // The spec says right click. It is any click: the browser only hands
        // the mouse over on a plain click of the game window, so that is what
        // this says rather than naming a button that does not work.
        keys: ['Click the game'],
        text: 'Take hold of the mouse, then move it to look around',
      },
      { keys: ['C'], text: 'Change the camera -- behind, high up, or at the sky' },
      { keys: ['Esc'], text: 'Give the mouse back to your desktop' },
    ],
  },
  {
    name: 'Other things',
    rows: [
      { keys: ['M'], text: 'Turn the music off and on' },
      { keys: ['G'], text: 'God mode -- nothing can knock you out of the sky' },
      { keys: ['B', 'Esc'], text: 'Leave Free Roam and come back to this menu' },
    ],
  },
  {
    name: 'Menus',
    rows: [
      { keys: ['W', 'S'], text: 'Choose an option (the arrow keys work too)' },
      { keys: ['Enter'], text: 'Pick the option you have chosen' },
    ],
  },
];

let screenElement = null;
let menu = null;
let handlers = {};
let open = false;

function keyCap(label) {
  return `<kbd class="controls-key">${label}</kbd>`;
}

function rowHtml({ keys, text }) {
  return (
    '<div class="controls-row">' +
    // Joined with "or" rather than a slash: two keys on one row always mean
    // either will do, and a slash reads as both at once.
    `<div class="controls-keys">${keys.map(keyCap).join('<span class="controls-or">or</span>')}</div>` +
    `<div class="controls-text">${text}</div>` +
    '</div>'
  );
}

function groupHtml({ name, rows }) {
  return (
    '<section class="controls-group">' +
    `<h3>${name}</h3>` +
    rows.map(rowHtml).join('') +
    '</section>'
  );
}

/**
 * Builds the screen and binds the two keys that also leave it.
 *
 * `onExit` is the main menu, handed in from main.js the way `FreeRoam.js` is
 * wired -- without it this module would have to import `TitleScreen.js`,
 * which imports this one, and that is a cycle.
 */
export function initControls({ onExit }) {
  handlers = { onExit };

  screenElement = document.createElement('div');
  screenElement.className = SCREEN_CLASS;

  const panel = document.createElement('div');

  panel.className = 'controls-panel';
  panel.innerHTML =
    `<h2>${TITLE}</h2>` +
    `<p class="controls-blurb">${BLURB}</p>` +
    `<div class="controls-list">${GROUPS.map(groupHtml).join('')}</div>`;

  // One option, and it is the spec's "option for them to go back to the main
  // menu". A menu rather than a plain line of text so the candy selector and
  // Enter mean here what they mean on every other screen.
  menu = createMenu([{ label: 'Back to main menu', run: () => closeControls() }]);
  panel.appendChild(menu.element);
  screenElement.appendChild(panel);
  document.body.appendChild(screenElement);

  window.addEventListener('keydown', (event) => {
    // Gated on `open`, so B does not start meaning "main menu" during a run
    // just because this module was initialised.
    if (!open || !EXIT_KEYS.includes(event.code)) return;

    event.preventDefault();
    closeControls();
  });
}

/** Opens the screen over the title screen. Takes the keyboard with it. */
export function openControls() {
  open = true;
  screenElement.classList.add(VISIBLE_CLASS);
  openMenu(menu);
}

/** Back to the main menu, which takes the keyboard back in `onExit`. */
export function closeControls() {
  open = false;
  screenElement.classList.remove(VISIBLE_CLASS);
  handlers.onExit();
}
