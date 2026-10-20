// OUT OF THE GAME. Nothing imports this file: the wiring is commented out in
// main.js. It existed to kill monsters, and `game_story.md` no longer has
// any -- Tode catches gifts and delivers them. Kept on disk rather than
// deleted, the same way Enemies.js and Enemy.js are, because the radius test
// in strikeEnemies below is the closest thing the project has to a worked
// example of "what is within reach of Tode right now", which is exactly the
// question gift-catching has to answer.
//
// The one piece that outlived it has already moved: holding an expression for
// a second or so and then releasing it is now `setExpression(name, weight,
// { seconds })` in Animation.js, so the gift systems get it without reviving
// anything here.

import * as THREE from 'three';
// Everything the strike needed -- the enemy list, the kill score, the radius
// measurement -- went with the monsters. The flash below is kept: it is the
// only part of the attack that was not about hitting something.
// import { enemies, removeEnemy } from './Enemies.js';
// import { getCollisionRadius } from './Collision.js';
// import { addKillScore } from './Score.js';
import { isGameOver } from './GameState.js';
import { getDifficulty } from './Difficulty.js';

// Seconds the flash stays on screen while fading out.
const FLASH_DURATION = 0.25;
// Superseded by the hold built into Animation.js's setExpression. 1.2s is
// still the figure worth passing as `seconds`: long enough that a grin reads
// at 32 pixels, short enough that Tode is not left wearing it.
// const SMILE_DURATION = 1.2;
// Lifts the flash just clear of the ground plane so it does not z-fight.
const FLASH_Z = 0.25;
const FLASH_SEGMENTS = 48;
const FLASH_COLOR = 0xffff00;

const clock = new THREE.Clock();

// Flashes still fading out, each { mesh, elapsed }.
const flashes = [];

// Starts ready: the cooldown it has to clear is no longer a fixed constant,
// so "long enough" is the only honest starting value.
let timeSinceAttack = Infinity;
let attackRequested = false;
// let timeSinceKill = Infinity;

export function initAttackInput() {
  window.addEventListener('keydown', (event) => {
    // Once the run is over, Space belongs to the restart instead. Bailing
    // here rather than at the cooldown check keeps the restart press from
    // being banked and fired as an attack on the first frame of the new run.
    if (event.code !== 'Space' || isGameOver()) return;

    // Stop the page scrolling out from under the canvas.
    event.preventDefault();
    attackRequested = true;
  });
}

function showFlash(scene, player, attackRadius) {
  // CircleGeometry already lies in the XY plane, which is this game's ground.
  const geometry = new THREE.CircleGeometry(attackRadius, FLASH_SEGMENTS);
  const material = new THREE.MeshBasicMaterial({
    color: FLASH_COLOR,
    transparent: true,
  });

  const mesh = new THREE.Mesh(geometry, material);

  // Pinned where the attack landed rather than parented to the player, so a
  // hop mid-flash does not drag the circle along with it.
  mesh.position.set(player.position.x, player.position.y, FLASH_Z);

  scene.add(mesh);
  flashes.push({ mesh, elapsed: 0 });
}

// Monsters are out of the game, so there is nothing for an attack to hit.
// Kept whole rather than deleted: this is the only worked example in the
// project of a radius test against a live entity list, and the gift-catch
// system needs the same shape of code.
//
// function strikeEnemies(scene, player, attackRadius) {
//   let killed = 0;
//
//   // Copied, because removeEnemy mutates the tracking array as we go.
//   [...enemies].forEach((enemy) => {
//     const distance = Math.hypot(
//       enemy.position.x - player.position.x,
//       enemy.position.y - player.position.y,
//     );
//
//     // The enemy's own footprint counts, so one clipping the edge of the circle
//     // still takes the hit.
//     if (distance <= attackRadius + getCollisionRadius(enemy)) {
//       removeEnemy(scene, enemy);
//       addKillScore();
//       killed += 1;
//     }
//   });
//
//   // One grin whether he cleared one monster or four: a weight that stacked
//   // would just saturate, and the face is already at full smile at one.
//   if (killed > 0) {
//     timeSinceKill = 0;
//     player.animator?.setExpression('smile', 1);
//   }
// }

function updateFlashes(scene, delta) {
  for (let i = flashes.length - 1; i >= 0; i -= 1) {
    const flash = flashes[i];

    flash.elapsed += delta;

    const remaining = 1 - flash.elapsed / FLASH_DURATION;

    if (remaining <= 0) {
      scene.remove(flash.mesh);
      flash.mesh.geometry.dispose();
      flash.mesh.material.dispose();
      flashes.splice(i, 1);
      continue;
    }

    flash.mesh.material.opacity = remaining;
  }
}

export function updateAttack(scene, player) {
  const { attackCooldown, attackRadius } = getDifficulty();
  const delta = clock.getDelta();

  timeSinceAttack += delta;

  if (attackRequested && timeSinceAttack >= attackCooldown) {
    timeSinceAttack = 0;
    // The flash is drawn at the current radius, so the growing reach is
    // visible rather than something the player has to infer.
    showFlash(scene, player, attackRadius);
    // strikeEnemies(scene, player, attackRadius);
  }

  // Presses during the cooldown are dropped rather than queued, so holding
  // Space cannot bank a volley of attacks.
  attackRequested = false;

  // The grin's decay lived here. It is Animation.js's job now -- see the note
  // at the top of this file.
  //
  // if (timeSinceKill < SMILE_DURATION) {
  //   timeSinceKill += delta;
  //
  //   if (timeSinceKill >= SMILE_DURATION) player.animator?.setExpression('smile', 0);
  // }

  updateFlashes(scene, delta);
}
