import * as THREE from 'three';

// Clip playback and facial expressions for the loaded character models.
//
// Written against any glTF rather than against Tode specifically: enemy.glb
// already ships eight named clips that nothing has ever played, and the list
// below will take them the day something asks.
//
// The important property is that this module does nothing at all to a model
// that carries neither clips nor shape keys -- which is exactly what
// `tode.glb` is today. `createAnimator` returns null for such a model and
// every call site skips through it, so the game looks precisely as it does
// now until the rigged asset lands and then needs no second round of wiring.
// The asset it is waiting for is specified in
// `hackathon/skeleton/tode_the_santa/appearance/spec.md`.

// One clock for the whole module, the way Score.js and Attack.js each own
// theirs rather than taking a delta from the render loop.
const clock = new THREE.Clock();

// The first frame after the models finish loading carries every second spent
// loading them, and the first frame back from a backgrounded tab carries the
// whole time away. Either one would run a one-shot clip past its end before
// it drew a single frame. 0.1s is six frames at 60Hz: longer than any hitch
// worth smoothing over, short enough that nothing visibly jumps.
const MAX_DELTA = 0.1;

// Seconds a crossfade takes when one body clip replaces another. Shorter than
// the 0.21s hop at full difficulty, or the fade would still be running when
// the hop it belongs to is over.
const FADE_SECONDS = 0.12;

// How fast an expression travels toward the weight asked for, in influence
// per second. 6 crosses the full 0..1 range in 170ms -- a smile arriving,
// rather than a face being switched between two frames.
const EXPRESSION_SPEED = 6;

// The one expression this module drives by itself, when the model has it.
const BLINK = 'blink';
// 0.12s lid-down-to-open, every 2.4 to 6.8 seconds. Both are the ordinary
// human figures. A real frog blinks far slower, but Tode reads as a cartoon
// and at cartoon scale a slow blink looks like a model that has hung.
const BLINK_DURATION = 0.12;
const BLINK_MIN_GAP = 2.4;
const BLINK_MAX_GAP = 6.8;

// Every animator built so far, advanced by the single updateAnimations() call
// in the render loop.
const animators = [];

/**
 * Finds a clip by the name the game uses for it, ignoring the armature prefix
 * Blender's exporter puts on. enemy.glb carries `CharacterArmature|Flying_Idle`
 * and seven more like it, so matching on the tail lets a spec name a clip
 * `Idle` without having to know what the armature ended up being called.
 */
function findClip(clips, name) {
  const wanted = name.toLowerCase();

  return clips.find((clip) => clip.name.split('|').pop().toLowerCase() === wanted) ?? null;
}

/**
 * Gathers every shape key in the model as name -> the meshes carrying it.
 * A list rather than a single mesh because a face split across several
 * primitives -- which is what a multi-material head exports as -- repeats the
 * same key on each one, and all of them have to move together.
 */
function collectExpressions(model) {
  const expressions = new Map();

  model.traverse((node) => {
    if (!node.morphTargetDictionary || !node.morphTargetInfluences) return;

    Object.entries(node.morphTargetDictionary).forEach(([name, index]) => {
      const key = name.toLowerCase();

      if (!expressions.has(key)) expressions.set(key, []);
      expressions.get(key).push({ node, index });
    });
  });

  return expressions;
}

function randomBlinkGap() {
  return BLINK_MIN_GAP + Math.random() * (BLINK_MAX_GAP - BLINK_MIN_GAP);
}

/**
 * Builds the playback layer for one loaded model.
 *
 * Returns null when the model has nothing to drive, so callers can hold the
 * result and reach through it with `?.` rather than testing for a rig.
 */
export function createAnimator(model, clips = []) {
  const expressions = collectExpressions(model);

  if (clips.length === 0 && expressions.size === 0) return null;

  const mixer = new THREE.AnimationMixer(model);
  const actions = new Map();
  // name -> the weight it is heading for. The weight it is actually at lives
  // on the influence itself, so nothing has to be kept in step with it.
  const targets = new Map();
  // name -> seconds left before it is released back to 0. Only expressions
  // asked for with a `seconds` are in here; one set without a hold stays up
  // until something takes it down.
  const holds = new Map();

  let currentBody = null;
  let blinkGap = randomBlinkGap();
  // Below zero means the eyes are open and the gap is counting down; 0 to 1
  // is the progress of a blink in flight.
  let blinkPhase = -1;

  function action(name) {
    if (actions.has(name)) return actions.get(name);

    const clip = findClip(clips, name);
    const built = clip ? mixer.clipAction(clip) : null;

    // Cached either way, misses included: a hop asking for a clip the asset
    // does not carry should cost one lookup per run, not one per hop.
    actions.set(name, built);

    return built;
  }

  function setInfluence(name, weight) {
    const bound = expressions.get(name);

    if (!bound) return;

    bound.forEach(({ node, index }) => {
      node.morphTargetInfluences[index] = weight;
    });
  }

  function readInfluence(name) {
    const bound = expressions.get(name);

    return bound ? bound[0].node.morphTargetInfluences[bound[0].index] : 0;
  }

  function updateExpressions(delta) {
    const step = EXPRESSION_SPEED * delta;

    targets.forEach((target, name) => {
      const current = readInfluence(name);
      const gap = target - current;

      // Snap the last sliver rather than approaching it forever, and drop the
      // entry so a face that has arrived costs nothing to hold.
      if (Math.abs(gap) <= step) {
        setInfluence(name, target);
        targets.delete(name);
        return;
      }

      setInfluence(name, current + Math.sign(gap) * step);
    });
  }

  function updateHolds(delta) {
    holds.forEach((remaining, name) => {
      const left = remaining - delta;

      if (left > 0) {
        holds.set(name, left);
        return;
      }

      // Deleting the key being visited is safe on a Map, and the release is
      // handed to the easing above rather than snapping the face off.
      holds.delete(name);
      targets.set(name, 0);
    });
  }

  function updateBlink(delta) {
    if (!expressions.has(BLINK)) return;

    if (blinkPhase < 0) {
      blinkGap -= delta;

      if (blinkGap > 0) return;

      blinkPhase = 0;
    }

    blinkPhase += delta / BLINK_DURATION;

    if (blinkPhase >= 1) {
      blinkPhase = -1;
      blinkGap = randomBlinkGap();
      setInfluence(BLINK, 0);
      return;
    }

    // Shut at the middle of the phase and open at both ends, which is one
    // half-period of a sine -- closing and opening in a single term.
    setInfluence(BLINK, Math.sin(blinkPhase * Math.PI));
  }

  const animator = {
    /**
     * Starts a body clip, crossfading from whatever was playing.
     *
     * `loop` repeats the clip until something else replaces it; without it the
     * clip plays once and holds its last frame. `seconds` stretches the clip
     * to a length the game decides -- the hop is 0.42s at the start of a run
     * and 0.21s once difficulty tops out, so a `Hop` clip authored at any
     * length can be made to land with the landing.
     *
     * Asking for a clip the model does not carry does nothing, which is how a
     * part-finished asset behaves sensibly rather than throwing.
     */
    play(name, { loop = false, seconds = null } = {}) {
      const next = action(name);

      if (!next || next === currentBody) return;

      next.reset();
      next.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
      // A one-shot that snapped back to frame zero on its last frame would
      // flicker between the pose it ended on and the pose it started from.
      next.clampWhenFinished = !loop;
      next.timeScale = seconds ? next.getClip().duration / seconds : 1;

      if (currentBody) next.crossFadeFrom(currentBody, FADE_SECONDS, false);

      next.play();
      currentBody = next;
    },

    /**
     * Moves one shape key toward a weight, eased rather than set.
     *
     * Without `seconds` the weight stays until something asks for a different
     * one. With it, the face holds for that long and then eases back to 0 on
     * its own -- which is what a reaction is, and it means a caller that wants
     * Tode to grin at something does not have to own a timer to take the grin
     * away again. Asking twice inside a hold restarts it rather than stacking.
     *
     * Unknown keys are ignored, for the same reason unknown clips are.
     */
    setExpression(name, weight, { seconds = null } = {}) {
      const key = name.toLowerCase();

      if (!expressions.has(key)) return;

      targets.set(key, THREE.MathUtils.clamp(weight, 0, 1));

      if (seconds) holds.set(key, seconds);
      else holds.delete(key);
    },

    /**
     * Rescales the running clip's playback rate.
     *
     * For a clip whose motion belongs to something the game is already
     * driving -- the sleigh's `run`, which animates nothing but the legs of
     * the four pullers hauling it. A fixed rate has them sprinting on the
     * spot while the sleigh sits still. At 0 they stop, which freezes them
     * mid-stride, so callers should ease it rather than switch it.
     */
    setTimeScale(scale) {
      if (currentBody) currentBody.timeScale = scale;
    },

    update(delta) {
      mixer.update(delta);
      updateHolds(delta);
      updateExpressions(delta);
      updateBlink(delta);
    },
  };

  animators.push(animator);

  return animator;
}

/**
 * Advances every animator in the game. One call, from the render loop, the
 * way updateChristmasLights() covers the whole town in one pass.
 */
export function updateAnimations() {
  const delta = Math.min(clock.getDelta(), MAX_DELTA);

  animators.forEach((animator) => animator.update(delta));
}
