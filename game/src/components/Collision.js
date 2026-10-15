import * as THREE from 'three';

// Extra clearance kept between two entity outlines, in world units.
// Raise it to make characters respect more personal space.
const MIN_COLLISION_DISTANCE = 8;

/**
 * Measures the entity's footprint on the ground plane as a circle.
 *
 * Not a box test: a box around a rounded character overestimates its reach by
 * up to sqrt(2) at the corners, so characters would collide while still
 * visibly apart. Averaging the model's measured X and Y extents gives a circle
 * that tracks the silhouette instead of the corners.
 *
 * The extents come from Box3.setFromObject, which is skinning-aware. Reading
 * geometry.attributes.position directly does not work here: enemy.glb is a
 * skinned mesh whose bones carry a scale of 100, so raw vertex positions are
 * off by orders of magnitude depending on whether the skeleton happens to be
 * in its bind pose when sampled. That produced radii anywhere from 12 to 1639
 * for the same model, and anything past ~300 silently froze every enemy where
 * it spawned.
 */
function measureGroundRadius(model) {
  const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());

  // Average half-extent across the two ground axes.
  return (size.x + size.y) / 4;
}

/**
 * Ground radius of an entity group, measured once and cached on the group.
 * Returns 0 while the GLB is still loading, which simply means the entity
 * blocks nothing yet.
 */
export function getCollisionRadius(entity) {
  if (entity.collisionRadius !== undefined) return entity.collisionRadius;
  if (!entity.model) return 0;

  entity.collisionRadius = measureGroundRadius(entity.model);

  return entity.collisionRadius;
}

/**
 * True when `entity` standing at (x, y) would keep clear of every entity in
 * `others`. The entity itself is skipped, so the caller can pass a list that
 * contains it.
 */
export function isPositionFree(entity, x, y, others) {
  const radius = getCollisionRadius(entity);

  return others.every((other) => {
    if (other === entity) return true;

    const clearance = radius + getCollisionRadius(other) + MIN_COLLISION_DISTANCE;
    const distance = Math.hypot(other.position.x - x, other.position.y - y);

    return distance >= clearance;
  });
}
