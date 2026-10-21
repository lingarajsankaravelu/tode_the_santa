// The sleigh's boost, and the tank it comes out of.
//
// The flight model in `Movement.js` has one speed: 200 units a second, reached
// in half a second and held until the keys go. That is the right cruise for
// lining a sleigh up under a falling present, and it is the wrong speed for
// the thing the player spends most of a run doing -- crossing open country to
// a gift that spawned 700 units away on a bearing they have just turned onto.
// The clock in `Timer.js` is the score, so that crossing is dead time being
// charged to the run.
//
// So: hold Shift for a push to 1.8x cruise, out of a tank that holds a couple
// of seconds of it.
//
// **The tank is the whole mechanic, not the speed.** A boost with no bottom to
// it is just a higher cruise speed and the player would hold it permanently.
// What makes it a decision is that it refills slowly on its own and quickly
// on a catch: a present in the sack pays for the chase to the next one, so the
// fast line through a run is to spend the tank getting to a gift and earn it
// back by catching it. Sitting on an empty tank is the cost of having spent it
// on the wrong bearing.
//
// Structurally this follows `Timer.js`: owns a readout, owns nothing else,
// one update call a frame, and the modules that care read it through
// functions rather than reaching at a variable.
import { play } from './Sound.js';

// How much faster than cruise, at full thrust. 1.8 and not 3: the sleigh has
// to stay catchable-with, and `CATCH_RADIUS` in Gifts.js is 49 units -- at
// three times cruise the sleigh crosses that radius in a sixth of a second and
// the catch becomes a reflex test rather than a line to fly.
const BOOST_MULTIPLIER = 1.8;

// Seconds of thrust in a full tank.
const BURN_SECONDS = 2.2;
// Seconds to refill it from empty, unaided. Deliberately four times the burn:
// the trickle is there so a run cannot soft-lock into never having a boost
// again, not as the way you are meant to get one.
const RECHARGE_SECONDS = 9;
// A beat before the trickle starts, so tapping Shift on and off does not drain
// and refill in the same breath. This is what stops the mechanic degenerating
// into a stutter.
const RECHARGE_DELAY = 0.8;
// What catching a gift puts back: half a tank. The intended rhythm of a run --
// spend, catch, spend -- is this number next to BURN_SECONDS.
const CATCH_REFILL = 0.5;
// Below this the boost will not light at all. A tenth of a second of thrust is
// not a boost, it is a cough, and letting the player buy one teaches them the
// tank is unreliable rather than empty.
const MIN_ENGAGE = 0.15;

// Thrust eases in and out rather than switching, so the push has a shove at
// the front of it and does not cut to nothing when the tank runs dry. Per
// second, applied to the gap -- the same easing idiom as the camera's
// smoothing and the sleigh's bank, with a rise faster than the fall because a
// boost should feel immediate and release should feel like coasting.
const THRUST_RISE = 9;
const THRUST_FALL = 3.4;

// Either Shift. Both, because this is a key that gets held for seconds at a
// time and which hand is free depends on whether the player is also changing
// height.
const BOOST_KEYS = new Set(['ShiftLeft', 'ShiftRight']);

const BAR_CLASS = 'boost-bar';
const ICON_CLASS = 'boost-bar-icon';
const TRACK_CLASS = 'boost-bar-track';
const FILL_CLASS = 'boost-bar-fill';
const SPENT_CLASS = 'spent';

// What the gauge is a gauge of, said in one character so the bar needs no
// label. An emoji rather than an SVG or an icon font for the same reason the
// compass mark in `GiftBeacon.js` is a glyph: it inherits the font size, costs
// no asset, and there is nothing to load before it draws.
const ICON = '\u{1F680}';

// A full tank, as a fraction of one. The run starts with it.
let charge = 1;
// Smoothed 0..1, and the number everything else reads. Not the same as "the
// key is down": it is what the engine is actually doing.
let thrust = 0;
let held = false;
// True between lighting the boost and it going out. Separate from `held`
// because an empty tank ends the burn while the key is still down, and
// re-lighting then has to wait for MIN_ENGAGE rather than resuming.
let burning = false;
let sinceRelease = 0;

let barElement = null;
let fillElement = null;
let renderedWidth = null;
let renderedSpent = null;

function render() {
  // Rounded to whole percent: the track is 120px wide, so a percent is a
  // pixel and anything finer is a DOM write nobody can see.
  const width = Math.round(charge * 100);
  const spent = charge < MIN_ENGAGE;

  if (width !== renderedWidth) {
    renderedWidth = width;
    fillElement.style.width = `${width}%`;
  }

  if (spent !== renderedSpent) {
    renderedSpent = spent;
    barElement.classList.toggle(SPENT_CLASS, spent);
  }
}

export function initBoost() {
  barElement = document.createElement('div');
  barElement.className = BAR_CLASS;

  const iconElement = document.createElement('span');

  iconElement.className = ICON_CLASS;
  iconElement.textContent = ICON;

  // The track is its own element rather than the row itself, because the row
  // now holds the rocket beside it -- the fill is a percentage of the track,
  // and the track has to be the only thing that percentage is measured
  // against.
  const trackElement = document.createElement('div');

  trackElement.className = TRACK_CLASS;

  fillElement = document.createElement('div');
  fillElement.className = FILL_CLASS;

  trackElement.appendChild(fillElement);
  barElement.appendChild(iconElement);
  barElement.appendChild(trackElement);
  document.body.appendChild(barElement);

  window.addEventListener('keydown', (event) => {
    if (!BOOST_KEYS.has(event.code)) return;

    // Autorepeat fires keydown over and over while the key is held; without
    // this the engage sound would machine-gun.
    if (event.repeat) return;

    held = true;
  });

  window.addEventListener('keyup', (event) => {
    if (!BOOST_KEYS.has(event.code)) return;

    held = false;
  });

  // Same reason Movement.js clears its key set: a Shift held while the tab
  // loses focus never sends its keyup, and the sleigh would come back from a
  // backgrounded tab with the boost welded on.
  window.addEventListener('blur', () => {
    held = false;
  });

  render();
}

/**
 * `moving` is whether the player is asking to go somewhere.
 *
 * The boost pushes along the direction being flown, so there is nothing for it
 * to do when no movement key is down -- and draining the tank while parked
 * would be a tax on standing still. It is read rather than assumed because
 * `Movement.js` is the only thing that knows: W and S held together cancel to
 * no input, and that is a stationary sleigh with two keys down.
 */
export function updateBoost(delta, moving) {
  const wants = held && moving;

  if (burning) {
    // Out of fuel, or the key or the direction went.
    if (!wants || charge <= 0) burning = false;
  } else if (wants && charge >= MIN_ENGAGE) {
    burning = true;
    play('boost');
  }

  if (burning) {
    charge = Math.max(charge - delta / BURN_SECONDS, 0);
    sinceRelease = 0;
  } else if (held) {
    // **Holding Shift on a dry tank refills nothing.** This clause is the
    // whole reason the key state is read here and not just the burn state: the
    // burn ends on its own when the tank empties, so without it a player who
    // simply never let go would be trickling back up to MIN_ENGAGE and
    // coughing out a tenth of a second of thrust every two seconds, for ever.
    // Letting go is the price of refilling.
    sinceRelease = 0;
  } else {
    sinceRelease += delta;

    if (sinceRelease >= RECHARGE_DELAY) {
      charge = Math.min(charge + delta / RECHARGE_SECONDS, 1);
    }
  }

  const target = burning ? 1 : 0;
  // Clamped, because `delta * rate` past 1 would overshoot the target and
  // oscillate on a long frame. MAX_DELTA upstream makes that unreachable at
  // these rates; the clamp is so it stays unreachable if either is retuned.
  const ease = Math.min(delta * (target > thrust ? THRUST_RISE : THRUST_FALL), 1);

  thrust += (target - thrust) * ease;

  render();
}

/** Called when a gift is caught: the catch pays for the next chase. */
export function refillBoost() {
  charge = Math.min(charge + CATCH_REFILL, 1);
  render();
}

export function resetBoost() {
  charge = 1;
  thrust = 0;
  held = false;
  burning = false;
  sinceRelease = RECHARGE_DELAY;
  render();
}

/**
 * 0 to 1, smoothed. `Movement.js` blends its top speed and acceleration along
 * it; `Camera.js` widens the lens by it.
 */
export function boostThrust() {
  return thrust;
}

export { BOOST_MULTIPLIER };
