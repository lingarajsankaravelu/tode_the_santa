// The run clock, and the best time so far.
//
// This replaces `Score.js`, which is retired rather than extended. The score
// was a survival counter: a tenth of a point per second alive plus ten per
// monster killed. Both halves of that are gone -- the monsters left the game,
// and staying alive longer is now the thing the player is trying NOT to do.
// A game about how fast Santa can collect five gifts and deliver them wants
// the opposite sign on the same clock, which is a different readout rather
// than a renamed one.
//
// The structure is still Score.js's, because it was the right one: own a div,
// own a clock, write to the DOM only when the rendered text changes.
import * as THREE from 'three';

// Where the best time is kept between sessions. Namespaced, because an
// artifact origin or a dev server is shared with whatever else has been built
// at the same address.
const BEST_KEY = 'tode.bestTime';

// Tenths. Hundredths invite a precision the game does not have -- the clock
// advances in whole frames -- and they make the readout flicker too fast to
// read at a glance while flying.
const DECIMALS = 1;

const clock = new THREE.Clock();

let timeElement = null;
let bestElement = null;

let elapsed = 0;
// The clock stops when the run ends, won or lost, and a stopped clock must not
// bank the wall time it is not counting.
let running = true;
let renderedTime = null;
let renderedBest = null;

/** `1:24.6`, and `0:09.4` rather than `9.4` so the field does not change width. */
function format(seconds) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds - minutes * 60;
  // padStart on the seconds only: a run over ten minutes may have the minutes
  // column grow, which is a problem the player has earned.
  const whole = Math.floor(rest).toString().padStart(2, '0');
  const fraction = Math.floor((rest % 1) * 10 ** DECIMALS)
    .toString()
    .padStart(DECIMALS, '0');

  return `${minutes}:${whole}.${fraction}`;
}

/**
 * Reads the stored best. Wrapped because localStorage throws rather than
 * returning null in a few real cases -- Safari's private mode, and any
 * embedding that blocks storage access -- and a game that will not start
 * because it could not read a leaderboard is worse than one with no
 * leaderboard.
 */
function loadBest() {
  try {
    const stored = Number(window.localStorage.getItem(BEST_KEY));

    return Number.isFinite(stored) && stored > 0 ? stored : null;
  } catch {
    return null;
  }
}

function saveBest(seconds) {
  try {
    window.localStorage.setItem(BEST_KEY, String(seconds));
  } catch {
    // Nothing to do and nothing worth logging: the run still had a time, it
    // just will not outlive the tab.
  }
}

let best = null;

function render() {
  const time = format(elapsed);

  // Called every frame, so skip DOM writes that change nothing.
  if (time !== renderedTime) {
    renderedTime = time;
    timeElement.textContent = time;
  }

  const bestText = best === null ? 'Best  --:--.-' : `Best  ${format(best)}`;

  if (bestText !== renderedBest) {
    renderedBest = bestText;
    bestElement.textContent = bestText;
  }
}

export function initTimer() {
  timeElement = document.createElement('div');
  timeElement.className = 'run-time';
  document.body.appendChild(timeElement);

  bestElement = document.createElement('div');
  bestElement.className = 'best-time';
  document.body.appendChild(bestElement);

  best = loadBest();

  // Discard the time spent loading 10 MB of glTF, the way every timed system
  // here does. Without it the clock opens at eight seconds and no run can ever
  // look fast.
  clock.getDelta();
  render();
}

/**
 * Stops the clock and banks the time if it is the best one.
 *
 * Called when the run is COMPLETE -- not when it is lost. A crash does not
 * earn a best time, so `resetTimer` throws that run away without this.
 *
 * `conclusion/win_state/spec.md` owns the real completion: `allDelivered()`.
 * **Nothing calls this yet.** `Gifts.js` used to, on the fifth catch, as a
 * placeholder for an ending the game did not have; that went out when the
 * Game Over screen started showing the time, because a clock stopped at the
 * end of the catching phase reported the flight to town and the five drops as
 * free. Losing deliberately does not come through here -- a crash does not
 * earn a best time -- so the one caller this is waiting for is the win.
 */
export function stopTimer() {
  if (!running) return;

  running = false;

  if (best === null || elapsed < best) {
    best = elapsed;
    saveBest(elapsed);
  }

  render();
}

/** The run's time, in seconds. For whatever wants to announce it. */
export function getElapsed() {
  return elapsed;
}

/**
 * The same time, formatted the way the readout formats it -- `1:24.6`.
 *
 * Exported so the Game Over screen can show the run's time without owning a
 * second opinion about how a time is written. `GameState.js` imports nothing,
 * so `main.js` hands this in as a callback rather than that module reaching
 * for it.
 */
export function getElapsedText() {
  return format(elapsed);
}

export function isTimerRunning() {
  return running;
}

/**
 * Whether the run that just finished is the best one yet.
 *
 * Only meaningful after `stopTimer`, which is what banks it: before that the
 * best is a previous run's and this is false. For the win screen, which has
 * the one number in the game worth being proud of.
 */
export function isBestRun() {
  return best !== null && best === elapsed;
}

export function resetTimer() {
  elapsed = 0;
  running = true;
  clock.getDelta();
  render();
}

export function updateTimer() {
  // The delta is read whether or not the clock is running, so a stopped clock
  // does not bank the seconds it spent stopped and hand them over in one lump
  // if something restarts it.
  const delta = clock.getDelta();

  if (!running) return;

  elapsed += delta;
  render();
}
