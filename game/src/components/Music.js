// The background theme.
//
// Deliberately an HTMLAudioElement rather than THREE.Audio. The three.js
// audio classes exist to place a sound in the scene -- panning it against an
// AudioListener on the camera, falling off with distance -- and a theme tune
// has no position in the world. Going through them would mean parenting a
// listener to the camera, which is already a child of the player group, and
// paying for a spatialisation that should never be heard. The browser's own
// element loops a file at a fixed volume, which is the entire requirement.

const TRACK_PATH = '/music/game_theme_trimmed.wav';

// Well below full. A short loop running under everything should sit behind the
// game, and there is no mixer to balance it against anything else.
const VOLUME = 0.35;

// Off unless asked for, same shape as god mode's G: press M at any time.
const MUTE_KEY = 'KeyM';
const BADGE_CLASS = 'music-muted';
const BADGE_TEXT = 'MUSIC MUTED · M to unmute';
const VISIBLE_CLASS = 'visible';

let audio = null;
let badgeElement = null;
let muted = true;

function showBadge(visible) {
  badgeElement.classList.toggle(VISIBLE_CLASS, visible);
}

/**
 * Asks the browser to play, and quietly accepts being told no.
 *
 * Autoplay is blocked until the page has seen a real user gesture, and the
 * promise play() returns rejects when it is. That rejection is expected on
 * load, not an error worth logging -- the listeners in initMusic try again on
 * the first key press or click, which is the gesture the policy wants. Left
 * unhandled it would surface as an uncaught rejection in the console on every
 * single load.
 */
function tryPlay() {
  if (muted) return;

  const played = audio.play();

  // Older browsers return undefined rather than a promise.
  if (played) played.catch(() => {});
}

export function setMuted(value) {
  muted = value;
  showBadge(muted);

  if (muted) {
    audio.pause();
    return;
  }

  tryPlay();
}

export function initMusic() {
  audio = new Audio(TRACK_PATH);

  // An 11.7-second phrase, 48 kHz 16-bit stereo, that runs for the whole
  // session. Uncompressed on purpose: a loop this short comes round some 300
  // times an hour, and WAV is the one common format that carries no encoder
  // padding, so the seam is wherever the trim was made and nowhere else. MP3
  // and AAC both prepend priming samples that no decoder can be told to skip
  // exactly, which puts a faint click at every repeat. The trade is file
  // size -- 2.2 MB against roughly 200 KB for the same audio as AAC -- paid
  // once on load, for a clean loop every time after.
  audio.loop = true;
  audio.volume = VOLUME;
  // Fetched up front rather than on demand. It is the largest asset in the
  // game and the loop must not stall at the seam, so the whole thing is in
  // memory before the first play.
  audio.preload = 'auto';

  badgeElement = document.createElement('div');
  badgeElement.className = BADGE_CLASS;
  badgeElement.textContent = BADGE_TEXT;
  document.body.appendChild(badgeElement);
  showBadge(muted);

  window.addEventListener('keydown', (event) => {
    if (event.code !== MUTE_KEY) return;

    event.preventDefault();
    setMuted(!muted);
  });

  // The autoplay gesture. Both listeners are registered once and removed the
  // first time either fires, so the ordinary arrow-key traffic does not keep
  // calling play() on an element that is already playing.
  const unlock = () => {
    window.removeEventListener('keydown', unlock);
    window.removeEventListener('pointerdown', unlock);
    tryPlay();
  };

  window.addEventListener('keydown', unlock);
  window.addEventListener('pointerdown', unlock);

  // Tried anyway, for the case where the browser does allow it -- a reload
  // of a page the user has already interacted with, or a relaxed autoplay
  // setting. If it is refused, the listeners above are still waiting.
  tryPlay();
}
