import { resolveAABB, resolveOneWay } from '../engine/Physics.js';

export const TILE = 48; // px per tile

/**
 * Tile type IDs:
 *  0 = empty
 *  1 = solid ground
 *  2 = one-way platform
 *  3 = solid wall / brick
 */
export class Tilemap {
  constructor(data) {
    this.cols   = data.cols;
    this.rows   = data.rows;
    this.tiles  = data.tiles;  // flat array [row * cols + col]
    this.width  = this.cols * TILE;
    this.height = this.rows * TILE;

    // Build solid tile cache once
    this._solidRects    = [];
    this._oneWayRects   = [];
    this._buildCache();
  }

  _buildCache() {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const id = this.tiles[r * this.cols + c];
        if (id === 0) continue;
        const rect = { x: c * TILE, y: r * TILE, w: TILE, h: TILE };
        if (id === 2) {
          this._oneWayRects.push(rect);
        } else {
          this._solidRects.push(rect);
        }
      }
    }
  }

  /** Returns true if the world-space point is inside any solid or one-way tile. */
  hasSolidGround(wx, wy) {
    const col = Math.floor(wx / TILE);
    const row = Math.floor(wy / TILE);
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return false;
    return this.tiles[row * this.cols + col] !== 0;
  }

  resolveEntity(entity) {
    entity.onGround = false;

    for (const rect of this._solidRects) {
      if (!_broadphase(entity, rect)) continue;
      resolveAABB(entity, rect);
    }
    for (const rect of this._oneWayRects) {
      if (!_broadphase(entity, rect)) continue;
      resolveOneWay(entity, rect);
    }
  }

  draw(ctx, camera) {
    const startCol = Math.max(0, Math.floor(camera.x / TILE));
    const endCol   = Math.min(this.cols - 1, Math.ceil((camera.x + camera.viewW) / TILE));
    const startRow = Math.max(0, Math.floor(camera.y / TILE));
    const endRow   = Math.min(this.rows - 1, Math.ceil((camera.y + camera.viewH) / TILE));

    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        const id = this.tiles[r * this.cols + c];
        if (id === 0) continue;
        const topOpen = r === 0 || this.tiles[(r - 1) * this.cols + c] === 0;
        _drawTile(ctx, id, c * TILE, r * TILE, r, c, topOpen);
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Tile drawing
// ─────────────────────────────────────────────────────────────────────────────
function _drawTile(ctx, id, x, y, row, col, topOpen) {
  if (id === 1) {
    // ── Ground / grass tile ──────────────────────────────────────────────────
    // Soil base
    ctx.fillStyle = '#3e2723';
    ctx.fillRect(x, y, TILE, TILE);
    // Earth layers
    ctx.fillStyle = '#5d4037';
    ctx.fillRect(x, y + 8, TILE, TILE - 8);
    ctx.fillStyle = '#6d4c41';
    ctx.fillRect(x, y + 16, TILE, TILE - 22);

    if (topOpen) {
      // Grass (bright top, darker sub-layer)
      ctx.fillStyle = '#2e7d32';
      ctx.fillRect(x, y, TILE, 9);
      ctx.fillStyle = '#43a047';
      ctx.fillRect(x, y, TILE, 6);
      ctx.fillStyle = '#66bb6a';
      ctx.fillRect(x, y, TILE, 2);
      // Grass blade tips
      ctx.fillStyle = '#81c784';
      for (let bx = x + 4; bx < x + TILE - 2; bx += 7) {
        ctx.fillRect(bx,     y - 2, 2, 3);
        ctx.fillRect(bx + 4, y - 1, 1, 2);
      }
    } else {
      // Underground top edge — no grass
      ctx.fillStyle = '#4e342e';
      ctx.fillRect(x, y, TILE, 8);
    }

    // Deterministic dirt / rock speckles
    const h1 = (col * 7  + row * 13) % (TILE - 6);
    const h2 = (col * 11 + row *  7) % (TILE - 8);
    ctx.fillStyle = '#4a2e28';
    ctx.fillRect(x + h1,     y + 18, 3, 2);
    ctx.fillStyle = '#795548';
    ctx.fillRect(x + h2 + 4, y + 28, 4, 3);

    // Right and bottom edge shadow
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(x + TILE - 2, y, 2, TILE);
    ctx.fillRect(x, y + TILE - 2, TILE, 2);

  } else if (id === 2) {
    // ── One-way wooden platform ──────────────────────────────────────────────
    ctx.fillStyle = '#3e2723';
    ctx.fillRect(x, y, TILE, TILE);

    ctx.fillStyle = '#795548';
    ctx.fillRect(x + 1, y + 2, TILE - 2, TILE - 8);

    // Top highlight edge
    ctx.fillStyle = '#a1887f';
    ctx.fillRect(x + 1, y + 2, TILE - 2, 3);

    // Wood grain vertical lines
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(x + Math.round(TILE * 0.25), y + 2, 1, TILE - 8);
    ctx.fillRect(x + Math.round(TILE * 0.50), y + 2, 1, TILE - 8);
    ctx.fillRect(x + Math.round(TILE * 0.75), y + 2, 1, TILE - 8);

    // Glowing top edge (indicates one-way passable)
    ctx.fillStyle = 'rgba(255,210,80,0.38)';
    ctx.fillRect(x, y, TILE, 3);

  } else if (id === 3) {
    // ── Brick / wall tile ────────────────────────────────────────────────────
    // Mortar background
    ctx.fillStyle = '#3e2723';
    ctx.fillRect(x, y, TILE, TILE);

    const brickH = TILE / 2 - 1;
    // Even rows offset every other brick row for a classic stagger
    const rowOffset = row % 2 === 0;

    for (let br = 0; br < 2; br++) {
      const by      = y + br * (TILE / 2);
      const xOffset = rowOffset ? (br === 0 ? 0 : TILE / 4) : (br === 0 ? TILE / 4 : 0);

      for (let bx = x - xOffset; bx < x + TILE; bx += TILE / 2) {
        const bLeft  = Math.max(x, bx + 1);
        const bRight = Math.min(bx + TILE / 2 - 1, x + TILE);
        const bw = bRight - bLeft;
        if (bw <= 0) continue;

        // Brick face
        ctx.fillStyle = '#6d4c41';
        ctx.fillRect(bLeft, by + 1, bw, brickH);
        // Top highlight
        ctx.fillStyle = '#8d6e63';
        ctx.fillRect(bLeft, by + 1, bw, 2);
        // Bottom shade
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.fillRect(bLeft, by + brickH - 1, bw, 2);
      }
    }

    // Right edge shadow
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(x + TILE - 2, y, 2, TILE);
  }
}

function _broadphase(entity, rect) {
  const pad = TILE * 2;
  return entity.x - pad < rect.x + rect.w &&
         entity.x + entity.w + pad > rect.x &&
         entity.y - pad < rect.y + rect.h &&
         entity.y + entity.h + pad > rect.y;
}
