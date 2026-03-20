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

  draw(ctx, camera, pal = _DEFAULT_PAL) {
    const startCol = Math.max(0, Math.floor(camera.x / TILE));
    const endCol   = Math.min(this.cols - 1, Math.ceil((camera.x + camera.viewW) / TILE));
    const startRow = Math.max(0, Math.floor(camera.y / TILE));
    const endRow   = Math.min(this.rows - 1, Math.ceil((camera.y + camera.viewH) / TILE));

    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        const id = this.tiles[r * this.cols + c];
        if (id === 0) continue;
        const topOpen = r === 0 || this.tiles[(r - 1) * this.cols + c] === 0;
        _drawTile(ctx, id, c * TILE, r * TILE, r, c, topOpen, pal);
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Default tile palette  (World 1 — Henesys)
// ─────────────────────────────────────────────────────────────────────────────
const _DEFAULT_PAL = {
  earthBase: '#c49a5a', earthMid: '#d4aa6a', earthDark: '#b08040', earthLight: '#e8c080',
  grassDark: '#3aad28', grassMid: '#4ec832', grassBright: '#72e850', grassTop: '#9aff7a',
  tuft: '#58e038', underground: '#8a6030', flowerStem: '#28801a', flower1: '#ff6e9a', flower2: '#ffffff',
  plankBody: '#8b5a2b', plankGrain: '#7a4e22', plankHi1: '#c48840', plankHi2: '#e8aa58',
  rope: '#d4a030', ropeDark: '#b88820', glow: 'rgba(100,255,80,0.50)',
  mortar: '#8a8898', brick: '#9e9cb0', brickLight: '#b8b6cc', brickDark: '#6a6878',
  moss: '#4aaa38', mossDark: '#3a8a28',
};

// ─────────────────────────────────────────────────────────────────────────────
//  Tile drawing  —  palette-driven for multi-world theming
// ─────────────────────────────────────────────────────────────────────────────
function _drawTile(ctx, id, x, y, row, col, topOpen, p) {
  if (id === 1) {
    // ── Ground tile ──────────────────────────────────────────────────────────
    ctx.fillStyle = p.earthBase;
    ctx.fillRect(x, y, TILE, TILE);
    ctx.fillStyle = p.earthMid;
    ctx.fillRect(x + 2, y + Math.floor(TILE * 0.35), TILE - 4, Math.floor(TILE * 0.52));

    const s1 = (col * 7  + row * 13) % (TILE - 8);
    const s2 = (col * 11 + row *  5) % (TILE - 12);
    ctx.fillStyle = p.earthDark;
    ctx.fillRect(x + s1 + 2, y + 22, 4, 3);
    ctx.fillStyle = p.earthLight;
    ctx.fillRect(x + s2 + 4, y + 34, 3, 2);

    if (topOpen) {
      ctx.fillStyle = p.grassDark;
      ctx.beginPath();
      ctx.moveTo(x, y + 14);
      ctx.bezierCurveTo(x + TILE * 0.25, y, x + TILE * 0.75, y, x + TILE, y + 14);
      ctx.lineTo(x + TILE, y); ctx.lineTo(x, y);
      ctx.closePath(); ctx.fill();

      ctx.fillStyle = p.grassMid;
      ctx.beginPath();
      ctx.moveTo(x, y + 10);
      ctx.bezierCurveTo(x + TILE * 0.25, y - 1, x + TILE * 0.75, y - 1, x + TILE, y + 10);
      ctx.lineTo(x + TILE, y); ctx.lineTo(x, y);
      ctx.closePath(); ctx.fill();

      ctx.fillStyle = p.grassBright;
      ctx.fillRect(x + 4, y, TILE - 8, 3);
      ctx.fillStyle = p.grassTop;
      ctx.fillRect(x + 8, y, TILE - 16, 1);

      const tuftBase = (col * 3 + row * 17) % 8;
      ctx.fillStyle = p.tuft;
      for (const tp of [6, 18, 30, 42]) {
        const tx2 = x + tp + (tuftBase % 4) - 2;
        if (tx2 < x || tx2 + 6 > x + TILE) continue;
        ctx.fillRect(tx2,     y - 5, 2, 6);
        ctx.fillRect(tx2 + 3, y - 4, 2, 5);
        ctx.fillRect(tx2 + 1, y - 7, 2, 7);
      }

      if ((col * 3 + row) % 5 === 0) {
        const fx = x + 10 + (col * 9) % (TILE - 20);
        ctx.fillStyle = p.flowerStem; ctx.fillRect(fx + 1, y - 9, 1, 6);
        ctx.fillStyle = p.flower1;
        ctx.fillRect(fx,     y - 12, 3, 1);
        ctx.fillRect(fx + 1, y - 13, 1, 3);
        ctx.fillStyle = '#ffe060'; ctx.fillRect(fx + 1, y - 12, 1, 1);
      }

      if ((col + row * 2) % 7 === 0) {
        const dx = x + 28 + (col * 13) % (TILE - 36);
        ctx.fillStyle = p.flowerStem; ctx.fillRect(dx + 1, y - 8, 1, 5);
        ctx.fillStyle = p.flower2;
        ctx.fillRect(dx,     y - 11, 3, 1);
        ctx.fillRect(dx + 1, y - 12, 1, 3);
        ctx.fillStyle = '#ffe060'; ctx.fillRect(dx + 1, y - 11, 1, 1);
      }
    } else {
      ctx.fillStyle = p.underground;
      ctx.fillRect(x, y, TILE, 8);
    }

    ctx.fillStyle = 'rgba(0,0,0,0.10)';
    ctx.fillRect(x + TILE - 2, y, 2, TILE);
    ctx.fillRect(x, y + TILE - 2, TILE, 2);

  } else if (id === 2) {
    // ── Platform tile ────────────────────────────────────────────────────────
    const plankY = y + 2;
    const plankH = 20;

    ctx.fillStyle = p.plankBody;
    ctx.fillRect(x, plankY, TILE, plankH);
    ctx.fillStyle = p.plankGrain;
    for (let gx = x + 6; gx < x + TILE - 4; gx += 10) {
      ctx.fillRect(gx, plankY + 4, 1, plankH - 6);
    }

    ctx.fillStyle = p.plankHi1;
    ctx.fillRect(x + 2, plankY, TILE - 4, 5);
    ctx.fillStyle = p.plankHi2;
    ctx.fillRect(x + 4, plankY, TILE - 8, 2);

    ctx.fillStyle = p.rope;
    ctx.fillRect(x, plankY, 6, plankH);
    ctx.fillStyle = p.ropeDark;
    ctx.fillRect(x + 1, plankY + 3,  4, 3);
    ctx.fillRect(x + 1, plankY + 10, 4, 3);
    ctx.fillRect(x + 1, plankY + 16, 4, 2);

    ctx.fillStyle = p.rope;
    ctx.fillRect(x + TILE - 6, plankY, 6, plankH);
    ctx.fillStyle = p.ropeDark;
    ctx.fillRect(x + TILE - 5, plankY + 3,  4, 3);
    ctx.fillRect(x + TILE - 5, plankY + 10, 4, 3);
    ctx.fillRect(x + TILE - 5, plankY + 16, 4, 2);

    ctx.fillStyle = 'rgba(0,0,0,0.20)';
    ctx.fillRect(x + 2, plankY + plankH - 2, TILE - 4, 3);
    ctx.fillStyle = p.glow;
    ctx.fillRect(x, plankY, TILE, 2);

  } else if (id === 3) {
    // ── Wall tile ────────────────────────────────────────────────────────────
    ctx.fillStyle = p.mortar;
    ctx.fillRect(x, y, TILE, TILE);

    const brickH = Math.floor(TILE / 3) - 1;
    for (let br = 0; br < 3; br++) {
      const by2     = y + br * Math.floor(TILE / 3);
      const xOffset = (row + br) % 2 === 0 ? 0 : TILE / 4;
      for (let bx = x - xOffset; bx < x + TILE; bx += TILE / 2) {
        const bLeft  = Math.max(x + 1, bx + 1);
        const bRight = Math.min(bx + TILE / 2 - 2, x + TILE - 1);
        const bw2 = bRight - bLeft;
        if (bw2 <= 0) continue;
        ctx.fillStyle = p.brick;
        ctx.fillRect(bLeft, by2 + 1, bw2, brickH);
        ctx.fillStyle = p.brickLight;
        ctx.fillRect(bLeft, by2 + 1, bw2, 2);
        ctx.fillStyle = p.brickDark;
        ctx.fillRect(bLeft, by2 + brickH - 1, bw2, 2);
      }
    }

    const mossSeed = (col * 5 + row * 9) % (TILE - 10);
    ctx.fillStyle = p.moss;
    ctx.fillRect(x + mossSeed % (TILE - 8), y + TILE - 10, 6, 4);
    if ((col + row) % 3 === 0) {
      ctx.fillStyle = p.mossDark;
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
