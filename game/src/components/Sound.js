// The two sound effects: a gift caught, and a gift delivered.
//
// Synthesised rather than loaded. There is one audio file in the project, a
// 2.2 MB WAV theme, and two more for a 90ms blip apiece would be most of a
// megabyte of download for a tenth of a second of sound each. Two oscillators
// and a gain ramp cost nothing, load instantly, and are tunable in the two
// tables below rather than in an editor.
//
// **Written to be replaced.** Every sound is one row in CUES, and `play` is
// the only thing the game calls. Dropping real samples in means swapping the
// body of `play` for an HTMLAudioElement pool and keeping the keys -- no call
// site changes. That was the point of putting them behind this interface
// rather than calling the oscillators from Gifts.js directly.
//
// Like Music.js this does NOT go through THREE.Audio. These are UI feedback
// for something the player did, not sounds with a position in the world --
// panning the catch chime against the camera would be a spatialisation nobody
// asked to hear.
import { isMuted } from './Music.js';

/**
 * A cue is a short pitch sweep on one waveform, under one gain envelope.
 *
 * - `from` / `to`: the sweep, in Hz. Rising reads as a gain, falling as a
 *   release -- which is the whole distinction between the two cues below.
 * - `seconds`: total length. Both are under a fifth of a second; a reward
 *   sound the player hears five times a run must not outstay its welcome.
 * - `type`: the oscillator. `triangle` is a soft bell, `sine` a soft thud.
 * - `gain`: peak, well under 1 so two cues overlapping cannot clip.
 */
const CUES = {
  // Bright, rising, bell-like: a present snatched out of the storm. A fifth up
  // (880 -> 1320) rather than an octave, which at this length reads as a chime
  // rather than a slide-whistle.
  catch: { from: 880, to: 1320, seconds: 0.09, type: 'triangle', gain: 0.22 },
  // Lower and falling: something set down rather than picked up. Longer than
  // the catch, because a delivery is the heavier of the two events.
  deliver: { from: 440, to: 220, seconds: 0.14, type: 'sine', gain: 0.26 },
};

// Created on the first cue rather than at init. A context built before the
// page has seen a user gesture starts in the `suspended` state -- the same
// autoplay policy Music.js works around -- and by the time anything here plays
// the player has necessarily pressed a key to fly.
let context = null;

function audioContext() {
  if (context) return context;

  const Ctor = window.AudioContext ?? window.webkitAudioContext;

  // Older Safari and anything with audio disabled. A silent game is a fine
  // degradation; a crash in the middle of a catch is not.
  if (!Ctor) return null;

  context = new Ctor();

  return context;
}

/**
 * Plays one of the cues above. Unknown names, a missing AudioContext and a
 * muted game are all no-ops.
 *
 * Mute is read from Music.js rather than owned here, so M silences the whole
 * game and not just the theme. One key, one meaning.
 */
export function play(name) {
  const cue = CUES[name];

  if (!cue || isMuted()) return;

  const ctx = audioContext();

  if (!ctx) return;

  // A tab backgrounded mid-run comes back with the context suspended.
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});

  const now = ctx.currentTime;
  const oscillator = ctx.createOscillator();
  const envelope = ctx.createGain();

  oscillator.type = cue.type;
  oscillator.frequency.setValueAtTime(cue.from, now);
  // Exponential rather than linear: pitch is perceived logarithmically, so a
  // linear ramp sweeps audibly fast at the start and crawls at the end.
  oscillator.frequency.exponentialRampToValueAtTime(cue.to, now + cue.seconds);

  // Attack of 1% of the cue, then a decay to silence. The attack is not
  // decoration: starting a gain at full value is a step discontinuity, which
  // is a click, and that click is louder than the cue on most speakers.
  envelope.gain.setValueAtTime(0, now);
  envelope.gain.linearRampToValueAtTime(cue.gain, now + cue.seconds * 0.01);
  // Never to exactly zero -- exponentialRamp cannot reach it and throws.
  envelope.gain.exponentialRampToValueAtTime(0.0001, now + cue.seconds);

  oscillator.connect(envelope);
  envelope.connect(ctx.destination);

  oscillator.start(now);
  // Stopped explicitly, or the node stays alive and connected for the life of
  // the context. Five a run is nothing; a leak across a long session is not.
  oscillator.stop(now + cue.seconds);
}

export { CUES };
