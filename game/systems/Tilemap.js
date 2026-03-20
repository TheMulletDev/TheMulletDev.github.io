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
//  Tile drawing  —  Henesys (MapleStory) style
// ─────────────────────────────────────────────────────────────────────────────
function _drawTile(ctx, id, x, y, row, col, topOpen) {
  if (id === 1) {
    // ── Henesys grass tile ───────────────────────────────────────────────────
    // Warm tan earth base
    ctx.fillStyle = '#c49a5a';
    ctx.fillRect(x, y, TILE, TILE);
    // Lighter earth mid-layer
    ctx.fillStyle = '#d4aa6a';
    ctx.fillRect(x + 2, y + Math.floor(TILE * 0.35), TILE - 4, Math.floor(TILE * 0.52));

    // Deterministic earth texture flecks
    const s1 = (col * 7  + row * 13) % (TILE - 8);
    const s2 = (col * 11 + row *  5) % (TILE - 12);
    ctx.fillStyle = '#b08040';
    ctx.fillRect(x + s1 + 2, y + 22, 4, 3);
    ctx.fillStyle = '#e8c080';
    ctx.fillRect(x + s2 + 4, y + 34, 3, 2);

    if (topOpen) {
      // Rounded grass cap (bezier dome)
      ctx.fillStyle = '#3aad28';
      ctx.beginPath();
      ctx.moveTo(x, y + 14);
      ctx.bezierCurveTo(x + TILE * 0.25, y, x + TILE * 0.75, y, x + TILE, y + 14);
      ctx.lineTo(x + TILE, y); ctx.lineTo(x, y);
      ctx.closePath(); ctx.fill();

      // Bright grass mid-layer
      ctx.fillStyle = '#4ec832';
      ctx.beginPath();
      ctx.moveTo(x, y + 10);
      ctx.bezierCurveTo(x + TILE * 0.25, y - 1, x + TILE * 0.75, y - 1, x + TILE, y + 10);
      ctx.lineTo(x + TILE, y); ctx.lineTo(x, y);
      ctx.closePath(); ctx.fill();

      // Specular highlight strip
      ctx.fillStyle = '#72e850';
      ctx.fillRect(x + 4, y, TILE - 8, 3);
      ctx.fillStyle = '#9aff7a';
      ctx.fillRect(x + 8, y, TILE - 16, 1);

      // Grass tufts (deterministic)
      const tuftBase = (col * 3 + row * 17) % 8;
      ctx.fillStyle = '#58e038';
      for (const tp of [6, 18, 30, 42]) {
        const tx2 = x + tp + (tuftBase % 4) - 2;
        if (tx2 < x || tx2 + 6 > x + TILE) continue;
        ctx.fillRect(tx2,     y - 5, 2, 6);
        ctx.fillRect(tx2 + 3, y - 4, 2, 5);
        ctx.fillRect(tx2 + 1, y - 7, 2, 7);
      }

      // Pink flower (every 5th tile)
      if ((col * 3 + row) % 5 === 0) {
        const fx = x + 10 + (col * 9) % (TILE - 20);
        ctx.fillStyle = '#28801a'; ctx.fillRect(fx + 1, y - 9, 1, 6);
        ctx.fillStyle = '#ff6e9a';
        ctx.fillRect(fx,     y - 12, 3, 1);
        ctx.fillRect(fx + 1, y - 13, 1, 3);
        ctx.fillStyle = '#ffe060'; ctx.fillRect(fx + 1, y - 12, 1, 1);
      }

      // White daisy variation
      if ((col + row * 2) % 7 === 0) {
        const dx = x + 28 + (col * 13) % (TILE - 36);
        ctx.fillStyle = '#28801a'; ctx.fillRect(dx + 1, y - 8, 1, 5);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(dx,     y - 11, 3, 1);
        ctx.fillRect(dx + 1, y - 12, 1, 3);
        ctx.fillStyle = '#ffe060'; ctx.fillRect(dx + 1, y - 11, 1, 1);
      }
    } else {
      // Underground top — darker border cap
      ctx.fillStyle = '#8a6030';
      ctx.fillRect(x, y, TILE, 8);
    }

    // Subtle edge shadow for depth
    ctx.fillStyle = 'rgba(0,0,0,0.10)';
    ctx.fillRect(x + TILE - 2, y, 2, TILE);
    ctx.fillRect(x, y + TILE - 2, TILE, 2);

  } else if (id === 2) {
    // ── Henesys rope platform ────────────────────────────────────────────────
    // Plank occupies only the top ~20 px; below is transparent (sky shows through)
    const plankY = y + 2;
    const plankH = 20;

    // Wood body
    ctx.fillStyle = '#8b5a2b';
    ctx.fillRect(x, plankY, TILE, plankH);

    // Wood grain lines
    ctx.fillStyle = '#7a4e22';
    for (let gx = x + 6; gx < x + TILE - 4; gx += 10) {
      ctx.fillRect(gx, plankY + 4, 1, plankH - 6);
    }

    // Plank top highlight
    ctx.fillStyle = '#c48840';
    ctx.fillRect(x + 2, plankY, TILE - 4, 5);
    ctx.fillStyle = '#e8aa58';
    ctx.fillRect(x + 4, plankY, TILE - 8, 2);

    // Rope knot — left end
    ctx.fillStyle = '#d4a030';
    ctx.fillRect(x, plankY, 6, plankH);
    ctx.fillStyle = '#b88820';
    ctx.fillRect(x + 1, plankY + 3,  4, 3);
    ctx.fillRect(x + 1, plankY + 10, 4, 3);
    ctx.fillRect(x + 1, plankY + 16, 4, 2);

    // Rope knot — right end
    ctx.fillStyle = '#d4a030';
    ctx.fillRect(x + TILE - 6, plankY, 6, plankH);
    ctx.fillStyle = '#b88820';
    ctx.fillRect(x + TILE - 5, plankY + 3,  4, 3);
    ctx.fillRect(x + TILE - 5, plankY + 10, 4, 3);
    ctx.fillRect(x + TILE - 5, plankY + 16, 4, 2);

    // Bottom drop-shadow
    ctx.fillStyle = 'rgba(0,0,0,0.20)';
    ctx.fillRect(x + 2, plankY + plankH - 2, TILE - 4, 3);

    // One-way glow (soft green)
    ctx.fillStyle = 'rgba(100,255,80,0.50)';
    ctx.fillRect(x, plankY, TILE, 2);

  } else if (id === 3) {
    // ── Henesys stone wall ───────────────────────────────────────────────────
    // Light gray-blue mortar
    ctx.fillStyle = '#8a8898';
    ctx.fillRect(x, y, TILE, TILE);

    // Three rows of staggered bricks
    const brickH = Math.floor(TILE / 3) - 1;
    for (let br = 0; br < 3; br++) {
      const by2     = y + br * Math.floor(TILE / 3);
      const xOffset = (row + br) % 2 === 0 ? 0 : TILE / 4;

      for (let bx = x - xOffset; bx < x + TILE; bx += TILE / 2) {
        const bLeft  = Math.max(x + 1, bx + 1);
        const bRight = Math.min(bx + TILE / 2 - 2, x + TILE - 1);
        const bw2 = bRight - bLeft;
        if (bw2 <= 0) continue;

        ctx.fillStyle = '#9e9cb0';
        ctx.fillRect(bLeft, by2 + 1, bw2, brickH);
        ctx.fillStyle = '#b8b6cc';           // top highlight
        ctx.fillRect(bLeft, by2 + 1, bw2, 2);
        ctx.fillStyle = '#6a6878';           // bottom shadow
        ctx.fillRect(bLeft, by2 + brickH - 1, bw2, 2);
      }
    }

    // Moss patches (deterministic)
    const mossSeed = (col * 5 + row * 9) % (TILE - 10);
    ctx.fillStyle = '#4aaa38';
    ctx.fillRect(x + mossSeed % (TILE - 8), y + TILE - 10, 6, 4);
    if ((col + row) % 3 === 0) {
      ctx.fillStyle = '#3a8a28';
      ctx.fillRect(x + (mossSeed + 12) % (TILE - 8), y + 4, 4, 3);
    }

    ctx.fillStyle = 'rgba(0,0,0,0.12)';
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
