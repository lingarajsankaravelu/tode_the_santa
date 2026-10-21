// The title screen, and the first thing the game shows.
//
// Implements `hackathon/opening_scene.md`'s "Game title screen": Tode and his
// sleigh down in the snow at the bottom left, the title in the middle, a
// Christmas candy as the selector, and the toy sack and the gifts swirling
// across the screen in the storm that took them.
//
// **Drawn in the page, not in the scene.** Everything here is DOM and CSS over
// an opaque backdrop, and the three.js world carries on behind it unseen. Two
// reasons, and the first is the spec's own picture: gifts tumbling across the
// SCREEN past a title is a screen-space drawing, and there is no camera angle
// that produces it. The second is what the 3D route would cost -- the lens is
// a child of the player group under pointer lock, so framing Tode into one
// corner means a view offset, a parked sleigh, a suppressed pointer lock and a
// hidden HUD, all of them to be undone again on the first frame of the run.
//
// The art is the game's own: `tode-title.svg` is `tode-santa.svg`, the
// favicon, with a wider viewBox so the whole frog fits instead of his face.
// The sleigh, the sack, the gifts and the tornado are flat SVG in the same
// palette -- #e3272f red, #21d789 green, #f2c14e gold -- because a
// photographic title screen in front of this game would be a different
// product's title screen.
//
// What this does NOT do: the four-shot animation under "Animation part" in the
// same file -- losing control, landing, the camera panning to the sack, the
// swirl. That is a cutscene, it wants the real models and a camera path, and
// it belongs in front of this screen rather than inside it. What is here is
// the still it would settle into, which is the half the spec draws.
import { createMenu, openMenu } from './Menu.js';

const SCREEN_CLASS = 'title-screen';
const VISIBLE_CLASS = 'visible';

const TITLE = 'Tode the Santa';
const TAGLINE = 'The storm took the presents. Catch five, deliver five.';

// How many gifts tumble past, not counting the sack. Five, and that is not
// decoration: five is how many the storm took and how many the run is about.
const GIFT_COUNT = 5;

// Each tumbling item gets its own lane, delay and speed, written onto the
// element as custom properties and read by one CSS animation. Hand-written
// rather than random so the screen looks the same every time it is opened --
// a title screen that is differently arranged on every visit reads as a bug
// in the one place where a player is forming their first impression.
//
// `top` is where the item crosses, in vh. `seconds` is how long the crossing
// takes, `delay` is negative so the stream is already mid-flight on the first
// frame rather than starting empty, and `scale` sells the depth.
const CARGO = [
  { top: 26, seconds: 13, delay: -1, scale: 0.8, spin: 5.5 },
  { top: 46, seconds: 17, delay: -6, scale: 1.15, spin: 7 },
  { top: 68, seconds: 15, delay: -11, scale: 0.95, spin: -6 },
  { top: 16, seconds: 19, delay: -4, scale: 0.65, spin: 8 },
  { top: 58, seconds: 11, delay: -8, scale: 0.75, spin: -4.5 },
];

// The sack goes on its own line, slower and larger than any gift: it is the
// thing the story is about losing, so it should be the one the eye follows.
const SACK = { top: 36, seconds: 23, delay: -14, scale: 1.4, spin: 9 };

const GIFT_SVG = `
  <svg viewBox="0 0 48 48" aria-hidden="true">
    <rect x="6" y="18" width="36" height="26" rx="3" fill="#e3272f"/>
    <rect x="4" y="12" width="40" height="9" rx="3" fill="#ef4049"/>
    <rect x="20" y="12" width="8" height="32" fill="#f2c14e"/>
    <path d="M24 13c-6-9-14-4-9 1 3 3 9 1 9-1zm0 0c6-9 14-4 9 1-3 3-9 1-9-1z"
          fill="#f2c14e"/>
  </svg>`;

const SACK_SVG = `
  <svg viewBox="0 0 56 56" aria-hidden="true">
    <path d="M12 26c-4 8-4 18 4 23 7 5 21 5 28 0 8-5 8-15 4-23z"
          fill="#c98b4b"/>
    <path d="M12 26c-1 9 4 15 16 15s17-6 16-15z" fill="#dda462"/>
    <rect x="14" y="20" width="28" height="9" rx="4.5" fill="#8f5f2f"/>
    <path d="M22 20l-3-9 6 4 5-6 5 6 6-4-3 9z" fill="#e3272f"/>
    <rect x="25" y="4" width="6" height="9" rx="3" fill="#8f5f2f"/>
  </svg>`;

// The cute tornado. A funnel silhouette with five rings of churn over it,
// all in the white the snowfall already uses -- a spout of snow rather than a
// grey weather system, which is the "cute" the spec asks for. The rings are
// separate elements so the CSS can breathe them one at a time; a tornado
// whose whole body scales at once reads as a wobbling cone.
const TORNADO_SVG = `
  <svg viewBox="0 0 140 240" aria-hidden="true">
    <path d="M6 14c26-14 102-14 128 0l-46 196c-5 18-31 18-36 0z"
          fill="#ffffff" opacity="0.1"/>
    <ellipse cx="70" cy="26" rx="64" ry="12" fill="#ffffff" opacity="0.2"/>
    <ellipse cx="70" cy="74" rx="51" ry="10" fill="#ffffff" opacity="0.17"/>
    <ellipse cx="70" cy="122" rx="38" ry="9" fill="#ffffff" opacity="0.15"/>
    <ellipse cx="70" cy="166" rx="26" ry="7" fill="#ffffff" opacity="0.13"/>
    <ellipse cx="70" cy="204" rx="15" ry="6" fill="#ffffff" opacity="0.11"/>
  </svg>`;

// Tode's sleigh, nose up in the snow where it came down. Flat, two reds and
// the gold of the runner, read from the frog's own palette.
const SLEIGH_SVG = `
  <svg viewBox="0 0 220 120" aria-hidden="true">
    <path d="M30 74h150c10 0 16 8 14 18H26c-6 0-10-6-8-12z" fill="#e3272f"/>
    <path d="M44 48h120c10 0 16 10 16 26H34c-4-16 2-26 10-26z" fill="#ef4049"/>
    <rect x="52" y="60" width="112" height="7" rx="3" fill="#f2c14e"/>
    <path d="M24 100h162c8 0 12 4 20 2M24 100c-8 0-14-6-12-14 2-7 10-9 14-4"
          stroke="#f2c14e" stroke-width="7" stroke-linecap="round" fill="none"/>
  </svg>`;

let screenElement = null;
let menu = null;
let handlers = {};

function lane(element, { top, seconds, delay, scale, spin }) {
  element.style.setProperty('--top', `${top}vh`);
  element.style.setProperty('--seconds', `${seconds}s`);
  element.style.setProperty('--delay', `${delay}s`);
  element.style.setProperty('--scale', scale);
  // A negative `spin` means the other way round. CSS will not take a negative
  // duration -- it is the one number here that cannot carry its own sign --
  // so the direction comes out as a second property.
  element.style.setProperty('--spin', `${Math.abs(spin)}s`);
  element.style.setProperty('--spin-dir', spin < 0 ? 'reverse' : 'normal');
}

function createCargo() {
  const storm = document.createElement('div');

  storm.className = 'title-storm';
  storm.innerHTML = `<div class="title-tornado">${TORNADO_SVG}</div>`;

  [SACK, ...CARGO].forEach((row, index) => {
    const item = document.createElement('div');

    item.className = 'storm-item';
    // The sack is the first row by construction, so this is also the only
    // place that needs to know which of the two drawings to use.
    item.innerHTML = `<div class="storm-spin">${
      index === 0 ? SACK_SVG : GIFT_SVG
    }</div>`;
    lane(item, row);
    storm.appendChild(item);
  });

  return storm;
}

function createTode() {
  const corner = document.createElement('div');

  corner.className = 'title-tode';
  // Sleigh behind him, Tode in front of it, and the tear last so it is over
  // his cheek. He is slumped rather than redrawn: the artwork has one
  // expression and it is a straight line of a mouth, so the sadness is in the
  // posture and the tear, which is what a flat character has instead of a
  // face full of morph targets.
  corner.innerHTML =
    `<div class="title-sleigh">${SLEIGH_SVG}</div>` +
    '<img class="title-portrait" src="/tode-title.svg" alt="Tode the Santa" />' +
    '<span class="title-tear"></span>';

  return corner;
}

export function initTitleScreen({ onStart }) {
  handlers = { onStart };

  screenElement = document.createElement('div');
  screenElement.className = SCREEN_CLASS;

  // The backdrop first, so everything else paints over it: the night gradient
  // and its band of aurora, then the snow Tode came down in.
  screenElement.innerHTML =
    '<div class="title-aurora"></div><div class="title-ground"></div>';

  screenElement.appendChild(createCargo());
  screenElement.appendChild(createTode());

  const centre = document.createElement('div');

  centre.className = 'title-centre';
  centre.innerHTML = `<h1>${TITLE}</h1><p class="tagline">${TAGLINE}</p>`;

  menu = createMenu([{ label: 'Start game', run: () => start() }]);
  centre.appendChild(menu.element);
  screenElement.appendChild(centre);

  document.body.appendChild(screenElement);
}

function start() {
  screenElement.classList.remove(VISIBLE_CLASS);
  // Hands the keyboard back by starting the run: `restartGame` is what clears
  // the menu, and it is also what burns every clock's banked delta -- without
  // which the run would open having already spent however long the player
  // spent reading this screen.
  handlers.onStart();
}

/**
 * Shows the screen and gives it the keyboard.
 *
 * Called once at boot, and again whenever the Game Over screen is asked for
 * the main menu. Nothing here knows which of the two it is, because there is
 * nothing it would do differently.
 */
export function openTitleScreen() {
  screenElement.classList.add(VISIBLE_CLASS);
  openMenu(menu);
}
