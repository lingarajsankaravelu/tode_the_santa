// The background theme.
//
// Deliberately an HTMLAudioElement rather than THREE.Audio. The three.js
// audio classes exist to place a sound in the scene -- panning it against an
// AudioListener on the camera, falling off with distance -- and a theme tune
// has no position in the world. Going through them would mean parenting a
// listener to the camera, which is already a child of the player group, and
// paying for a spatialisation that should never be heard. The browser's own
// element loops a file at a fixed volume, which is the entire requirement.

import { asset } from '../assets.js';

const TRACK_PATH = asset('music/game_theme_trimmed.wav');

// Far below full: the theme should read as music heard from the back of the
// room, something the player notices having heard rather than listens to. It
// sat at 0.35 while it was opt-in, where a player who pressed M had gone
// looking for music and wanted to hear it. Playing by default is the opposite
// job -- nobody asked for it, so it has to be quiet enough that nobody minds.
// Sound.js's cue levels are set against this number, so they now sit further
// above the theme than they used to.
const VOLUME = 0.12;

// On by default, and M turns it off -- the reverse of what this was, and of
// god mode's G. Starting muted meant the theme only ever reached players who
// found M in the controls list, which is a strange fate for the one asset that
// sets the mood of the game; starting it quiet instead is the setting that
// needs no discovery. The key still works at any time, so silence is one press
// away for anyone who wants it.
const MUTE_KEY = 'KeyM';
const BADGE_CLASS = 'music-muted';
const BADGE_TEXT = 'MUSIC MUTED · M to unmute';
const VISIBLE_CLASS = 'visible';

let audio = null;
let badgeElement = null;
let muted = false;

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

/**
 * Whether the game is muted. Read by `Sound.js`, so the M key silences the
 * effects along with the theme rather than only the music.
 */
export function isMuted() {
  return muted;
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
