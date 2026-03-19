export const GRAVITY = 1800; // px/s²
export const TERMINAL_VEL = 1200;

/**
 * Integrate velocity and position, apply gravity.
 */
export function integrate(entity, dt) {
  if (!entity.onGround) {
    entity.vy += GRAVITY * dt;
    if (entity.vy > TERMINAL_VEL) entity.vy = TERMINAL_VEL;
  }
  entity.x += entity.vx * dt;
  entity.y += entity.vy * dt;
}

/**
 * Resolve AABB collision between entity and a solid tile rect.
 * Mutates entity position and velocity.
 */
export function resolveAABB(entity, tile) {
  const ex = entity.x, ey = entity.y, ew = entity.w, eh = entity.h;
  const tx = tile.x,  ty = tile.y,  tw = tile.w,  th = tile.h;

  // Overlap test
  const overlapX = (ex + ew) - tx < tw + (ex - (tx + tw)) ? (ex + ew) - tx : tx + tw - ex;
  const overlapY = (ey + eh) - ty < th + (ey - (ty + th)) ? (ey + eh) - ty : ty + th - ey;

  if (overlapX <= 0 || overlapY <= 0) return;

  // Minimum penetration axis
  if (Math.abs(overlapX) < Math.abs(overlapY)) {
    entity.x += overlapX * (entity.x < tile.x ? -1 : 1);
    entity.vx = 0;
  } else {
    if (entity.vy > 0 && entity.y + entity.h - entity.vy * (1 / 60) <= tile.y + 1) {
      entity.y = tile.y - entity.h;
      entity.vy = 0;
      entity.onGround = true;
    } else if (entity.vy < 0) {
      entity.y = tile.y + tile.h;
      entity.vy = 0;
    }
  }
}

/**
 * One-way platform: only collide when falling onto the top surface.
 */
export function resolveOneWay(entity, tile) {
  const prevBottom = entity.y + entity.h - entity.vy * (1 / 60);
  const currBottom = entity.y + entity.h;

  if (
    entity.vy >= 0 &&
    prevBottom <= tile.y + 2 &&
    currBottom >= tile.y &&
    entity.x + entity.w > tile.x + 4 &&
    entity.x < tile.x + tile.w - 4
  ) {
    entity.y = tile.y - entity.h;
    entity.vy = 0;
    entity.onGround = true;
  }
}

/** Broad-phase: check if two rects overlap */
export function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x &&
         a.y < b.y + b.h && a.y + a.h > b.y;
}
