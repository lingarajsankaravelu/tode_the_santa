// The sound effects: a gift caught, a gift delivered, and the boost lighting.
//
// **Samples now, not oscillators.** Every cue used to be a pitch sweep built
// from two `OscillatorNode`s under a gain envelope, on the reasoning that two
// more audio files for a fifth of a second of sound each was not worth the
// download next to the 2.2 MB WAV theme. That reasoning was sound and the
// result still was not: a synthesised blip has one partial and no transient,
// so it reads as thin however much gain it is given, and raising the gain to
// compensate just makes a thin sound loud. The three files here are 83 KB
// together -- under 4% of the theme, and under 1% of the sleigh model -- and
// they have the attack and the overtones that make a cue land.
//
// They come from Kenney's "Digital Audio" pack, CC0, all three from the same
// pack so they sound like one set rather than three found sounds. See
// `public/sfx/LICENSE.txt` for provenance and the original filenames.
//
// Shipped as WAV rather than the .ogg they were downloaded as, for the same
// reason the theme is a WAV: Safari decodes no Ogg Vorbis at all, in an
// `<audio>` element or through `decodeAudioData`, so three ogg files would be
// three silent cues on every Mac and iPhone. At a third of a second each the
// uncompressed size is 28 KB apiece, which is not worth a second format and a
// `canPlayType` probe to avoid. Each is trimmed to its own attack and release
// with 4ms fades at both ends, so there is no leading silence delaying a cue
// and no trailing silence padding the file.
//
// The interface is unchanged: every sound is one row in CUES and `play` is the
// only thing the game calls, so the call sites in Gifts.js, Delivery.js and
// Boost.js did not move when the implementation did.
//
// Like Music.js this does NOT go through THREE.Audio. These are UI feedback
// for something the player did, not sounds with a position in the world --
// panning the catch chime against the camera would be a spatialisation nobody
// asked to hear.
import { isMuted } from './Music.js';

/**
 * A cue is one file and the level it plays at.
 *
 * - `path`: under `public/`, so it is served as-is and never bundled.
 * - `gain`: a per-cue trim, because the three samples are not equally loud at
 *   unity and "all at 1.0" is a mix only by accident. Levels are set against
 *   Music.js's 0.35 theme: a cue the player earned should sit clearly on top
 *   of it, and the one that fires constantly should not.
 */
const CUES = {
  // powerUp7: a short rising arpeggio, bright, with its energy up around
  // 3-4 kHz where the theme has almost none -- which is why it cuts through
  // without being loud. A present snatched out of the storm.
  catch: { path: '/sfx/catch.wav', gain: 0.9 },
  // pepSound1: the same synth, falling instead of rising. Something set down
  // rather than picked up, and the inverse of the catch on purpose -- the two
  // events are the two halves of the run and they should answer each other.
  // Equally loud, though: the delivery is not the lesser event, and when this
  // was a quieter, duller cue the second half of the run sounded like a worse
  // version of the first.
  deliver: { path: '/sfx/deliver.wav', gain: 0.9 },
  // phaseJump2: a rising whoosh, rougher and lower than the other two, which
  // is right for the one cue that is a machine doing something rather than a
  // reward being handed over. Trimmed well down because it fires whenever the
  // player reaches for speed -- far more often than five times a run -- and a
  // cue heard that often has to sit under the music rather than on top of it.
  boost: { path: '/sfx/boost.wav', gain: 0.35 },
};

// Created on the first cue rather than at init. A context built before the
// page has seen a user gesture starts in the `suspended` state -- the same
// autoplay policy Music.js works around -- and by the time anything here plays
// the player has necessarily pressed a key to fly.
let context = null;

// Decoded `AudioBuffer`s by cue name, and the in-flight fetches by cue name so
// five catches in four seconds cannot start five downloads of one file.
const buffers = new Map();
const loading = new Map();

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
 * Fetches and decodes one cue, caching the buffer. A failure is cached as a
 * null buffer rather than retried: a 404 on a sound file will still be a 404
 * on the fifth catch, and retrying would mean a fetch per catch forever.
 */
function load(ctx, name, cue) {
  if (buffers.has(name)) return Promise.resolve(buffers.get(name));

  let pending = loading.get(name);

  if (pending) return pending;

  pending = fetch(cue.path)
    .then((response) => {
      if (!response.ok) throw new Error(`${response.status} ${cue.path}`);

      return response.arrayBuffer();
    })
    // Promise form rather than the callback form: the callback signature is
    // the old Safari one and the promise is what every current browser wants.
    .then((bytes) => ctx.decodeAudioData(bytes))
    .catch((error) => {
      console.warn(`Sound: ${name} unavailable --`, error.message);

      return null;
    })
    .then((buffer) => {
      buffers.set(name, buffer);
      loading.delete(name);

      return buffer;
    });

  loading.set(name, pending);

  return pending;
}

/**
 * Warms the cache so the first catch of a run is not the download of its own
 * sound. Safe to call before any user gesture: it only decodes, and decoding
 * does not need a running context.
 *
 * Optional -- `play` loads on demand if this was never called -- which is why
 * nothing has to be sequenced around it.
 */
export function initSound() {
  const ctx = audioContext();

  if (!ctx) return;

  for (const [name, cue] of Object.entries(CUES)) load(ctx, name, cue);
}

/** Starts one decoded buffer at the cue's level, now. */
function emit(ctx, buffer, gain) {
  // A fresh source per hit, because an `AudioBufferSourceNode` is single-use
  // by spec -- it cannot be restarted once it has played. The buffer is the
  // expensive part and that is what gets reused; the node is a handle and it
  // is cheap. Two overlapping catches are two nodes on one buffer, which is
  // the whole reason this is the Web Audio path rather than an Audio element:
  // an element retriggered mid-sound cuts itself off.
  const source = ctx.createBufferSource();
  const level = ctx.createGain();

  source.buffer = buffer;
  level.gain.setValueAtTime(gain, ctx.currentTime);

  source.connect(level);
  level.connect(ctx.destination);

  source.start();
  // Both nodes are disconnected by the engine once the source ends, but only
  // if nothing holds a reference -- and nothing here does past this line.
  source.onended = () => {
    source.disconnect();
    level.disconnect();
  };
}

/**
 * Plays one of the cues above. Unknown names, a missing AudioContext, a cue
 * that failed to load and a muted game are all no-ops.
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

  const buffer = buffers.get(name);

  // The common case: decoded already, so the sound starts on this frame
  // rather than a promise tick later. A cue is feedback for something that
  // just happened and a late cue reads as a different event.
  if (buffer) {
    emit(ctx, buffer, cue.gain);

    return;
  }

  // First time, and `initSound` either was not called or has not finished.
  // Re-check mute after the await: a player who hit M during the decode meant
  // it, and 200ms later is still "during the catch".
  load(ctx, name, cue).then((loaded) => {
    if (loaded && !isMuted()) emit(ctx, loaded, cue.gain);
  });
}

export { CUES };
