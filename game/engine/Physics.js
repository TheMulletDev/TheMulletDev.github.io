export const GRAVITY = 1800; // px/s²
export const TERMINAL_VEL = 1200;

/**
 * Integrate velocity and position, apply gravity.
 */
export function integrate(entity, dt) {
  entity.prevY = entity.y;
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

  // Penetration depth from each side
  const fromLeft   = (ex + ew) - tx;   // entity right → tile left
  const fromRight  = (tx + tw) - ex;   // tile right → entity left
  const fromTop    = (ey + eh) - ty;   // entity bottom → tile top
  const fromBottom = (ty + th) - ey;   // tile bottom → entity top

  // No overlap on either axis → nothing to do
  if (fromLeft <= 0 || fromRight <= 0 || fromTop <= 0 || fromBottom <= 0) return;

  const minX = Math.min(fromLeft, fromRight);
  const minY = Math.min(fromTop, fromBottom);

  if (minX < minY) {
    // Resolve horizontally
    if (fromLeft < fromRight) {
      entity.x -= fromLeft;   // push entity left
    } else {
      entity.x += fromRight;  // push entity right
    }
    entity.vx = 0;
  } else {
    // Resolve vertically
    if (fromTop < fromBottom) {
      entity.y -= fromTop;    // land on top surface
      entity.vy = 0;
      entity.onGround = true;
    } else {
      entity.y += fromBottom; // hit underside of tile
      entity.vy = 0;
    }
  }
}

/**
 * One-way platform: only collide when falling onto the top surface.
 * Uses entity.prevY stored before integration.
 */
export function resolveOneWay(entity, tile) {
  const prevBottom = (entity.prevY ?? entity.y) + entity.h;
  const currBottom = entity.y + entity.h;

  if (
    entity.vy >= 0 &&
    prevBottom <= tile.y + 1 &&
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
