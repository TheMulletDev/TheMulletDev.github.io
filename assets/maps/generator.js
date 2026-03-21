/**
 * Procedural level generator for The Tower.
 *
 * Tile IDs:  0 = empty, 1 = solid ground, 2 = one-way platform
 * Map size:  28 cols × 44 rows  (TILE = 48 px)
 *
 * Jump physics: WALK_SPEED = 220 px/s, JUMP_FORCE = -620 px/s, GRAVITY = 1800 px/s²
 *   Ascending 2 rows (96 px) takes ≈ 0.235 s → horizontal reach ≈ 52 px ≈ 1 tile.
 *   This is very tight, so step platforms must overlap with the platform below/above,
 *   not just be "nearby".
 *
 * Connectivity guarantee:
 *   Each floor has ONE "primary" platform (the main path) plus an optional
 *   "bonus" platform on the opposite side for variety.  Each step is placed
 *   WITHIN the reachable range of the previous primary platform, and the next
 *   primary platform is centred around that step.  This creates an unbroken
 *   chain from ground to the exit portal.
 *
 * Floor rows (ascending — row 35 is near bottom, row 7 is top):
 *   [35, 31, 27, 23, 19, 15, 11, 7]
 * Step rows (one per floor gap):
 *   [37, 33, 29, 25, 21, 17, 13, 9]
 */

const COLS       = 28;
const ROWS       = 44;
const TILE       = 48;
const GROUND_ROW = 39;

const FLOOR_ROWS = [35, 31, 27, 23, 19, 15, 11, 7];
const STEP_ROWS  = [37, 33, 29, 25, 21, 17, 13, 9];

const DECO_RISE = {
  flowers: 20, toadstool: 20, barrel: 30,
  stump: 22,   crate: 28,     haybale: 28, fence: 24, signpost: 56,
};

// ── PRNG ─────────────────────────────────────────────────────────────────────

function mulberry32(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function ri(rng, min, max) {
  if (max < min) return min;
  return min + Math.floor(rng() * (max - min + 1));
}

// ── Decoration helpers ────────────────────────────────────────────────────────

const GROUND_DECO_TYPES   = ['flowers', 'haybale', 'stump', 'signpost', 'barrel', 'toadstool', 'crate', 'fence'];
const PLATFORM_DECO_TYPES = ['flowers', 'toadstool', 'barrel', 'stump', 'crate', 'haybale'];

function addDecorations(rng, decorations, platforms, surfaceRow, countMin, countMax, types, seedOffset) {
  const surfaceY = surfaceRow * TILE;
  for (const p of platforms) {
    const count = ri(rng, countMin, countMax);
    for (let k = 0; k < count; k++) {
      const col  = ri(rng, p.start, Math.max(p.start, p.end - 1));
      const type = types[ri(rng, 0, types.length - 1)];
      decorations.push({
        type,
        x:    col * TILE + ri(rng, 0, 28),
        y:    surfaceY - (DECO_RISE[type] ?? 20),
        seed: seedOffset + k,
      });
    }
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Generate a full Tower level from a numeric seed.
 * Returns an object with the same shape as LEVEL1.
 */
export function generateLevel(seed) {
  const rng = mulberry32(seed);

  // reachable = the x-range the player can stand on right now.
  // Starts as the full ground width.
  let reachable = { start: 0, end: COLS - 1 };

  const primaryPlatforms = [];   // one per floor — guaranteed on the main path
  const allFloorPlatforms = [];  // primary + optional bonus
  const steps = [];

  for (let i = 0; i < FLOOR_ROWS.length; i++) {
    // ── Step[i] ─────────────────────────────────────────────────────────────
    // Width 4-6 tiles (min 4 so it's easy to land on).
    // Start and end must fall INSIDE the reachable range so the player can
    // jump straight up from below to reach it.
    const stepW     = ri(rng, 4, 6);
    const stepLoMin = reachable.start;
    const stepLoMax = Math.max(stepLoMin, reachable.end - stepW + 1);
    const stepStart = ri(rng, stepLoMin, stepLoMax);
    const step      = { start: stepStart, end: stepStart + stepW - 1 };
    steps.push(step);

    // ── Primary platform for floor[i] ────────────────────────────────────────
    // Centred over the step so the player can jump from step straight up.
    // Width: stepW+3 to min(stepW+9, COLS/2) — always wider than the step.
    const primW   = ri(rng, stepW + 3, Math.min(stepW + 9, 14));
    const stepCx  = Math.floor((step.start + step.end) / 2);
    const pOffset = ri(rng, -2, 2);
    const primStart = Math.max(0, Math.min(COLS - primW, stepCx - Math.floor(primW / 2) + pOffset));
    const primary   = { start: primStart, end: primStart + primW - 1 };
    primaryPlatforms.push(primary);

    // ── Bonus platform (optional) ─────────────────────────────────────────────
    // Placed on the side opposite the primary.  Not required for completion —
    // it's extra challenge/exploration.  Always separated from primary by ≥ 4 cols.
    const platforms = [primary];
    if (rng() < 0.55) {
      const bonusW  = ri(rng, 4, 7);
      const primCx  = primary.start + Math.floor(primW / 2);
      let   bonusStart;

      if (primCx <= COLS / 2) {
        // Primary left → bonus right
        const lo = Math.min(COLS - bonusW, primary.end + 4);
        const hi = COLS - bonusW;
        if (hi >= lo) bonusStart = ri(rng, lo, hi);
      } else {
        // Primary right → bonus left
        const hi = Math.max(0, primary.start - bonusW - 3);
        if (hi >= 0) bonusStart = ri(rng, 0, hi);
      }

      if (bonusStart !== undefined && bonusStart >= 0 && bonusStart + bonusW - 1 < COLS) {
        platforms.push({ start: bonusStart, end: bonusStart + bonusW - 1 });
      }
    }
    allFloorPlatforms.push(platforms);

    // After landing on primary, the player's reachable range = primary platform.
    reachable = primary;
  }

  // ── Tile array ────────────────────────────────────────────────────────────
  const tiles = new Array(COLS * ROWS).fill(0);

  for (let row = GROUND_ROW; row < ROWS; row++)
    for (let col = 0; col < COLS; col++) tiles[row * COLS + col] = 1;

  FLOOR_ROWS.forEach((row, i) => {
    for (const p of allFloorPlatforms[i])
      for (let col = p.start; col <= p.end; col++) tiles[row * COLS + col] = 2;
  });

  STEP_ROWS.forEach((row, i) => {
    const s = steps[i];
    for (let col = s.start; col <= s.end; col++) tiles[row * COLS + col] = 2;
  });

  // ── Enemy spawns ──────────────────────────────────────────────────────────
  // Enemies only on primary platforms — bonus platforms stay empty so the
  // player isn't punished for accidentally landing on one.
  const ENEMY_TYPE = ['slime', 'slime', 'slime', 'mushroom', 'mushroom', 'mushroom', 'mushroom', 'mushroom'];
  const enemySpawns = [];

  // Ground: 2 slimes
  enemySpawns.push({ type: 'slime', col: ri(rng, 3, 12), row: GROUND_ROW });
  enemySpawns.push({ type: 'slime', col: ri(rng, 14, 24), row: GROUND_ROW });

  FLOOR_ROWS.forEach((row, i) => {
    const type = ENEMY_TYPE[i] ?? 'mushroom';
    const p    = primaryPlatforms[i];
    const w    = p.end - p.start + 1;
    if (w < 4) return;
    enemySpawns.push({ type, col: ri(rng, p.start + 1, p.end - 1), row });
    if (w >= 10) {
      enemySpawns.push({ type, col: ri(rng, p.start + 2, p.end - 2), row });
    }
  });

  // ── Portal ────────────────────────────────────────────────────────────────
  const topPrimary = primaryPlatforms[primaryPlatforms.length - 1];
  const portalCx   = Math.floor((topPrimary.start + topPrimary.end) / 2);
  const portal = {
    x: Math.max(0, portalCx - 1) * TILE,
    y: 4 * TILE,
    w: 3 * TILE,
    h: 3 * TILE,
  };

  // ── Decorations ───────────────────────────────────────────────────────────
  const decorations = [];
  const FULL_GROUND = [{ start: 0, end: COLS - 1 }];
  addDecorations(rng, decorations, FULL_GROUND, GROUND_ROW, 4, 7, GROUND_DECO_TYPES, 0);
  FLOOR_ROWS.forEach((row, fi) => {
    addDecorations(rng, decorations, [primaryPlatforms[fi]], row, 1, 2, PLATFORM_DECO_TYPES, (fi + 1) * 20);
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
