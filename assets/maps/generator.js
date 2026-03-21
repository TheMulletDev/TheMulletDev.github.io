/**
 * Procedural level generator for The Tower.
 *
 * Tile IDs:  0 = empty, 1 = solid ground, 2 = one-way platform
 * Map size:  28 cols × 44 rows  (TILE = 48 px)
 *
 * Jump physics: JUMP_FORCE = -620 px/s, GRAVITY = 1800 px/s²
 *   max rise ≈ 107 px ≈ 2.22 tiles
 *   All vertical gaps = 2 rows (96 px) — guaranteed reachable.
 *
 * Floor rows (platforms, ascending order — row 35 = near bottom, row 7 = top):
 *   [35, 31, 27, 23, 19, 15, 11, 7]
 * Step rows (bridge between each pair of adjacent floors):
 *   [37, 33, 29, 25, 21, 17, 13, 9]
 *   step[i] sits 2 rows above floor[i-1] (or ground) and 2 rows below floor[i],
 *   so it is always reachable from both sides.
 */

const COLS       = 28;
const ROWS       = 44;
const TILE       = 48;
const GROUND_ROW = 39;

// 8 platform tiers, ascending height in the world (lower row number = higher up)
const FLOOR_ROWS = [35, 31, 27, 23, 19, 15, 11, 7];

// One step row between each pair: step[i] bridges ground/floor[i-1] → floor[i]
const STEP_ROWS  = [37, 33, 29, 25, 21, 17, 13, 9];

// How many pixels a decoration type extends above the platform surface
const DECO_RISE = {
  flowers:   20,
  toadstool: 20,
  barrel:    30,
  stump:     22,
  crate:     28,
  haybale:   28,
  fence:     24,
  signpost:  56,
};

// ── PRNG ─────────────────────────────────────────────────────────────────────

/** mulberry32 — fast, seedable 32-bit PRNG. */
function mulberry32(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Inclusive integer in [min, max]. */
function ri(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

// ── Floor layout generators ───────────────────────────────────────────────────

/**
 * Returns an array of platform segments for one floor row.
 * Each segment: { start: col, end: col }  (both inclusive).
 *
 * floorIndex 0 = lowest (row 35), 7 = highest (row 7).
 * Higher floors skew toward wide single platforms to give more landing room.
 */
function genFloor(rng, floorIndex) {
  const splitChance = floorIndex <= 5 ? 0.65 : 0.30;

  if (rng() < splitChance) {
    // Two platforms: one on each side
    const w1     = ri(rng, 4, 8);
    const w2     = ri(rng, 4, 8);
    const l1     = ri(rng, 0, 3);
    const r2End  = COLS - 1 - ri(rng, 0, 3);
    const r2Strt = r2End - w2 + 1;

    // Confirm they don't overlap (should be fine for COLS = 28 and w ≤ 8)
    if (l1 + w1 - 1 < r2Strt) {
      return [
        { start: l1,     end: l1 + w1 - 1 },
        { start: r2Strt, end: r2End        },
      ];
    }
  }

  // Wide centre platform (fallback or chosen by chance)
  const w     = ri(rng, 10, 18);
  const sMin  = Math.max(0, Math.floor((COLS - w) / 2) - 2);
  const sMax  = Math.min(COLS - w, Math.floor((COLS - w) / 2) + 2);
  const start = ri(rng, sMin, sMax);
  return [{ start, end: Math.min(COLS - 1, start + w - 1) }];
}

/**
 * Returns one step segment { start, end } that overlaps horizontally with
 * at least one platform in lowerPlatforms AND at least one in upperPlatforms,
 * guaranteeing the player can reach it from below and jump to the upper floor.
 */
function genStep(rng, lowerPlatforms, upperPlatforms) {
  const stepW = ri(rng, 3, 6);
  const valid = [];

  for (let x = 0; x <= COLS - stepW; x++) {
    const xEnd     = x + stepW - 1;
    const hasLower = lowerPlatforms.some(p => x <= p.end && xEnd >= p.start);
    const hasUpper = upperPlatforms.some(p => x <= p.end && xEnd >= p.start);
    if (hasLower && hasUpper) valid.push(x);
  }

  if (valid.length === 0) {
    // Fallback: anchor to the first upper platform
    const up = upperPlatforms[0];
    const x  = ri(rng, up.start, Math.max(up.start, up.end - stepW + 1));
    return { start: x, end: Math.min(COLS - 1, x + stepW - 1) };
  }

  const x = valid[ri(rng, 0, valid.length - 1)];
  return { start: x, end: x + stepW - 1 };
}

// ── Decoration helpers ────────────────────────────────────────────────────────

const GROUND_DECO_TYPES   = ['flowers', 'haybale', 'stump', 'signpost', 'barrel', 'toadstool', 'crate', 'fence'];
const PLATFORM_DECO_TYPES = ['flowers', 'toadstool', 'barrel', 'stump', 'crate', 'haybale'];

function addDecorations(rng, decorations, platforms, surfaceRow, countMin, countMax, types, seedOffset) {
  const surfaceY = surfaceRow * TILE;
  for (const p of platforms) {
    const count = ri(rng, countMin, countMax);
    for (let k = 0; k < count; k++) {
      const col  = ri(rng, p.start, p.end - 1);
      const type = types[ri(rng, 0, types.length - 1)];
      const rise = DECO_RISE[type] ?? 20;
      decorations.push({
        type,
        x:    col * TILE + ri(rng, 0, 28),
        y:    surfaceY - rise,
        seed: seedOffset + k,
      });
    }
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Generate a full Tower level from a numeric seed.
 * Returns a plain object with the same shape as LEVEL1:
 *   { cols, rows, tiles, enemySpawns, playerStart, portal, decorations }
 */
export function generateLevel(seed) {
  const rng = mulberry32(seed);

  // ── Floor platforms ────────────────────────────────────────────────────────
  const floors = FLOOR_ROWS.map((_, i) => genFloor(rng, i));

  // ── Step platforms ────────────────────────────────────────────────────────
  const FULL_GROUND = [{ start: 0, end: COLS - 1 }];
  const steps = STEP_ROWS.map((_, i) => {
    const lower = i === 0 ? FULL_GROUND : floors[i - 1];
    return genStep(rng, lower, floors[i]);
  });

  // ── Tile array ────────────────────────────────────────────────────────────
  const tiles = new Array(COLS * ROWS).fill(0);

  // Solid ground rows 39–43
  for (let row = GROUND_ROW; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) tiles[row * COLS + col] = 1;
  }

  // One-way floor platforms
  FLOOR_ROWS.forEach((row, i) => {
    for (const p of floors[i]) {
      for (let col = p.start; col <= p.end; col++) tiles[row * COLS + col] = 2;
    }
  });

  // One-way step platforms
  STEP_ROWS.forEach((row, i) => {
    const s = steps[i];
    for (let col = s.start; col <= s.end; col++) tiles[row * COLS + col] = 2;
  });

  // ── Enemy spawns ──────────────────────────────────────────────────────────
  // Enemy type escalates as floor index increases
  const ENEMY_BY_FLOOR = ['slime', 'slime', 'slime', 'mushroom', 'mushroom', 'mushroom', 'mushroom', 'mushroom'];
  const enemySpawns = [];

  // Ground: 2 slimes
  enemySpawns.push({ type: 'slime', col: ri(rng,  3, 12), row: GROUND_ROW });
  enemySpawns.push({ type: 'slime', col: ri(rng, 14, 24), row: GROUND_ROW });

  FLOOR_ROWS.forEach((row, i) => {
    const type = ENEMY_BY_FLOOR[i] ?? 'mushroom';
    for (const p of floors[i]) {
      const w = p.end - p.start + 1;
      if (w < 4) continue;
      // One enemy per platform; two if the platform is wide
      enemySpawns.push({ type, col: ri(rng, p.start + 1, p.end - 1), row });
      if (w >= 8) {
        enemySpawns.push({ type, col: ri(rng, p.start + 2, p.end - 2), row });
      }
    }
  });

  // ── Portal ────────────────────────────────────────────────────────────────
  // Centered above the widest top-floor platform (row 7, 3 rows up = row 4)
  const topFloor = floors[floors.length - 1];
  const widest   = topFloor.reduce((a, b) => (b.end - b.start > a.end - a.start ? b : a));
  const pcx      = Math.floor((widest.start + widest.end) / 2);
  const portal   = {
    x: Math.max(0, (pcx - 1)) * TILE,
    y: 4 * TILE,     // row 4 = 3 rows above top floor (row 7)
    w: 3 * TILE,
    h: 3 * TILE,
  };

  // ── Decorations ───────────────────────────────────────────────────────────
  const decorations = [];

  // Ground decorations
  addDecorations(rng, decorations, FULL_GROUND, GROUND_ROW, 4, 7, GROUND_DECO_TYPES, 0);

  // Platform decorations
  FLOOR_ROWS.forEach((row, fi) => {
    addDecorations(rng, decorations, floors[fi], row, 1, 2, PLATFORM_DECO_TYPES, (fi + 1) * 20);
  });

  return {
    cols: COLS,
    rows: ROWS,
    tiles,
    enemySpawns,
    playerStart: { col: 3, row: 38 },
    portal,
    decorations,
  };
}
