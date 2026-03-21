/**
 * Boss Arena — "The Ancient Dungeon"
 *
 * A Zakum-inspired enclosed stone arena. No random generation — this is
 * hand-crafted to give the fight a specific rhythm.
 *
 * Tile IDs:  0 = empty, 1 = solid ground, 2 = one-way platform, 3 = solid wall
 * Map size:  28 cols × 13 rows  (TILE = 48 px → 1344 × 624 px)
 *
 * Layout:
 *   Row  0  — stone ceiling (type 3, solid)
 *   Rows 1–4 — open arena air (type 3 walls col 0 & 27)
 *   Row  5  — high dodge platforms [cols 3–7] and [cols 20–24]  (type 2)
 *   Rows 6–7 — open air (walls)
 *   Row  8  — mid-tier platforms [cols 2–9] and [cols 18–25]    (type 2)
 *   Row  9  — open air — player & boss fight at this level (walls)
 *   Rows 10–12 — solid ground (type 1)
 *
 * Reachability:
 *   Ground surface y = 10×48 = 480.  Player.y ≈ 428 standing.
 *   Mid-tier surface y = 8×48 = 384 → gap 96 px (2 rows) → single jump ✓
 *   High-tier surface y = 5×48 = 240 → gap from mid = 144 px (3 rows) → double jump ✓
 *
 * playerStart: { col: 2, row: 9 }  →  x = 96, y = (9-1)×48 = 384, falls to ground
 * Boss spawns at x = 13×48 = 624, y = 8×48 = 384  (centre of arena, on ground)
 * Portal spawned programmatically at boss death position.
 */

const COLS = 28;
const ROWS = 13;
const T    = 48; // TILE

// ── Tile array (COLS × ROWS = 364 entries) ────────────────────────────────

// prettier-ignore
const tiles = [
  // Row 0 — ceiling (all solid wall)
  3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,
  // Row 1 — open, walls on sides
  3,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,3,
  // Row 2
  3,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,3,
  // Row 3
  3,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,3,
  // Row 4
  3,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,3,
  // Row 5 — high dodge platforms [3-7] and [20-24]
  3,0,0,2,2,2,2,2,0,0,0,0,0,0,0,0,0,0,0,0,2,2,2,2,2,0,0,3,
  // Row 6
  3,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,3,
  // Row 7
  3,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,3,
  // Row 8 — mid-tier platforms [2-9] and [18-25]
  3,0,2,2,2,2,2,2,2,2,0,0,0,0,0,0,0,0,2,2,2,2,2,2,2,2,0,3,
  // Row 9 — open, player & boss level
  3,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,3,
  // Row 10 — solid ground
  1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
  // Row 11
  1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
  // Row 12
  1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
];

export const BOSS_ARENA = {
  cols: COLS,
  rows: ROWS,
  tiles,

  /** Player spawns near left wall, drops onto ground. */
  playerStart: { col: 2, row: 9 },

  /**
   * No portal at load time.
   * GameScene sets this to a real rect when the boss dies, which activates the
   * existing portal-collision and draw code automatically.
   */
  portal: null,

  /** No regular enemy spawns — the boss is created directly by GameScene. */
  enemySpawns: [],

  /**
   * Stone dungeon decorations: a few skull piles and bone totem props
   * placed along the walls for atmosphere. All are purely visual.
   */
  decorations: [
    // Ground level rubble (surface y = 10×48 = 480)
    { type: 'stump',     x:  80, y: 458 },
    { type: 'barrel',   x: 230, y: 450 },
    { type: 'crate',    x: 540, y: 452 },
    { type: 'barrel',   x: 820, y: 450 },
    { type: 'stump',    x: 1150, y: 458 },
    { type: 'crate',    x: 1240, y: 452 },
    // Mid platforms (surface y = 8×48 = 384)
    { type: 'toadstool', x: 130, y: 362 },
    { type: 'toadstool', x: 960, y: 362 },
  ],
};
