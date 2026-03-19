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
        const x = c * TILE;
        const y = r * TILE;
        ctx.fillStyle = TILE_COLORS[id] || '#888';
        ctx.fillRect(x, y, TILE, TILE);

        // Simple highlight / depth line
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.fillRect(x, y, TILE, 3);
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fillRect(x, y + TILE - 3, TILE, 3);

        if (id === 2) {
          // One-way platform: draw a stripe pattern
          ctx.fillStyle = 'rgba(255,255,255,0.15)';
          for (let i = 0; i < TILE; i += 8) {
            ctx.fillRect(x + i, y, 4, TILE);
          }
        }
      }
    }
  }
}

const TILE_COLORS = {
  1: '#4a7c3f', // grass / ground
  2: '#8b6914', // platform wood
  3: '#5a4a3a', // brick / wall
};

function _broadphase(entity, rect) {
  const pad = TILE * 2;
  return entity.x - pad < rect.x + rect.w &&
         entity.x + entity.w + pad > rect.x &&
         entity.y - pad < rect.y + rect.h &&
         entity.y + entity.h + pad > rect.y;
}
