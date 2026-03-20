/**
 * Level 1 — The Tower
 *
 * Tile IDs:
 *   0 = empty
 *   1 = solid (grass/ground)
 *   2 = one-way platform
 *   3 = solid brick/wall
 *
 * Layout: 28 cols × 44 rows (1344 × 2112 px, TILE = 48)
 * Player starts at the bottom and climbs upward through 8 platform tiers.
 * Enemies get progressively harder the higher you go.
 *
 * Jump physics: v0 = -620 px/s, g = 1800 px/s² → max rise ≈ 107px (2.2 tiles)
 * All vertical gaps between adjacent platforms = 2 rows (96px) to keep
 * every tier reachable with a normal jump.
 *
 * Floor guide (platform row → difficulty):
 *   Row 39 — ground     — slimes
 *   Row 35 — floor 1    — slimes
 *   Row 31 — floor 2    — slimes + light mushrooms
 *   Row 27 — floor 3    — mushrooms
 *   Row 23 — floor 4    — mushrooms
 *   Row 19 — floor 5    — mushrooms (wide center)
 *   Row 15 — floor 6    — mushrooms
 *   Row 11 — floor 7    — hard mushrooms
 *   Row  7 — top floor  — hardest mushrooms
 *
 * Step platforms between each main floor at rows 37, 33, 29, 25, 21, 17, 13, 9
 * (alternating left/right so the player must traverse the width to ascend).
 */

export const LEVEL1 = {
  cols: 28,
  rows: 44,
  // prettier-ignore
  tiles: [
    // Row 0 — sky
    0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
    // Row 1
    0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
    // Row 2
    0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
    // Row 3
    0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
    // Row 4
    0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
    // Row 5
    0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
    // Row 6
    0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
    // Row 7 — top floor (cols 4–21)
    0,0,0,0,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,0,0,0,0,0,0,
    // Row 8
    0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
    // Row 9 — step (cols 10–16)
    0,0,0,0,0,0,0,0,0,0,2,2,2,2,2,2,2,0,0,0,0,0,0,0,0,0,0,0,
    // Row 10
    0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
    // Row 11 — floor 7 (cols 2–10, 16–24)
    0,0,2,2,2,2,2,2,2,2,2,0,0,0,0,0,2,2,2,2,2,2,2,2,2,0,0,0,
    // Row 12
    0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
    // Row 13 — step (cols 7–11, 16–20)
    0,0,0,0,0,0,0,2,2,2,2,2,0,0,0,0,2,2,2,2,2,0,0,0,0,0,0,0,
    // Row 14
    0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
    // Row 15 — floor 6 (cols 0–9, 18–27)
    2,2,2,2,2,2,2,2,2,2,0,0,0,0,0,0,0,0,2,2,2,2,2,2,2,2,2,2,
    // Row 16
    0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
    // Row 17 — step (cols 2–6, 21–25)
    0,0,2,2,2,2,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,2,2,2,2,0,0,
    // Row 18
    0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
    // Row 19 — floor 5 / wide centre (cols 7–20)
    0,0,0,0,0,0,0,2,2,2,2,2,2,2,2,2,2,2,2,2,2,0,0,0,0,0,0,0,
    // Row 20
    0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
    // Row 21 — step (cols 0–4, 23–27)
    2,2,2,2,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,2,2,2,2,
    // Row 22
    0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
    // Row 23 — floor 4 (cols 2–11, 16–25)
    0,0,2,2,2,2,2,2,2,2,2,2,0,0,0,0,2,2,2,2,2,2,2,2,2,2,0,0,
    // Row 24
    0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
    // Row 25 — step / centre bridge (cols 9–18)
    0,0,0,0,0,0,0,0,0,2,2,2,2,2,2,2,2,2,2,0,0,0,0,0,0,0,0,0,
    // Row 26
    0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
    // Row 27 — floor 3 (cols 1–9, 18–26)
    0,2,2,2,2,2,2,2,2,2,0,0,0,0,0,0,0,0,2,2,2,2,2,2,2,2,2,0,
    // Row 28
    0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
    // Row 29 — step (cols 1–5, 22–26)
    0,2,2,2,2,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,2,2,2,2,0,
    // Row 30
    0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
    // Row 31 — floor 2 (cols 4–12, 15–23)
    0,0,0,0,2,2,2,2,2,2,2,2,2,0,0,2,2,2,2,2,2,2,2,2,0,0,0,0,
    // Row 32
    0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
    // Row 33 — step (cols 0–4, 12–15, 23–27)
    2,2,2,2,2,0,0,0,0,0,0,0,2,2,2,2,0,0,0,0,0,0,0,2,2,2,2,2,
    // Row 34
    0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
    // Row 35 — floor 1 (cols 2–11, 16–25)
    0,0,2,2,2,2,2,2,2,2,2,2,0,0,0,0,2,2,2,2,2,2,2,2,2,2,0,0,
    // Row 36
    0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
    // Row 37 — step (cols 0–5, 22–27)
    2,2,2,2,2,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,2,2,2,2,2,
    // Row 38
    0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
    // Row 39 — ground surface
    1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
    // Row 40
    1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
    // Row 41
    1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
    // Row 42
    1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
    // Row 43
    1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
  ],

  enemySpawns: [
    // ── Ground (row 39) — slimes ────────────────────────────────────────────
    { type: 'slime',    col:  7, row: 39 },
    { type: 'slime',    col: 19, row: 39 },

    // ── Floor 1 (row 35) — slimes ───────────────────────────────────────────
    { type: 'slime',    col:  5, row: 35 },
    { type: 'slime',    col: 21, row: 35 },

    // ── Floor 2 (row 31) — slimes + mushroom ────────────────────────────────
    { type: 'slime',    col:  7, row: 31 },
    { type: 'mushroom', col: 19, row: 31 },

    // ── Floor 3 (row 27) — mushrooms ────────────────────────────────────────
    { type: 'mushroom', col:  4, row: 27 },
    { type: 'mushroom', col: 22, row: 27 },

    // ── Floor 4 (row 23) — mushrooms ────────────────────────────────────────
    { type: 'mushroom', col:  5, row: 23 },
    { type: 'mushroom', col: 20, row: 23 },

    // ── Floor 5 (row 19) — mushrooms ────────────────────────────────────────
    { type: 'mushroom', col: 10, row: 19 },
    { type: 'mushroom', col: 17, row: 19 },

    // ── Floor 6 (row 15) — mushrooms ────────────────────────────────────────
    { type: 'mushroom', col:  3, row: 15 },
    { type: 'mushroom', col: 22, row: 15 },

    // ── Floor 7 (row 11) — hard mushrooms ───────────────────────────────────
    { type: 'mushroom', col:  5, row: 11 },
    { type: 'mushroom', col: 18, row: 11 },

    // ── Top floor (row 7) — hardest mushrooms ───────────────────────────────
    { type: 'mushroom', col:  7, row:  7 },
    { type: 'mushroom', col: 18, row:  7 },
  ],

  playerStart: { col: 3, row: 38 },

  /**
   * Purely visual props — no collision. type + world-pixel (x, y) top-left.
   * flowers also carry a seed value to vary petal colours per cluster.
   *
   * Surface y for a platform at row R = R * 48.
   * Prop y = surface_y − prop_height (so the prop sits on top).
   */
  decorations: [
    // ── Ground (row 39, surface y = 1872) ──────────────────────────────────
    { type: 'flowers',   x:   36, y: 1852, seed: 0 },
    { type: 'haybale',  x:  211, y: 1844 },
    { type: 'stump',    x:  466, y: 1850 },
    { type: 'signpost', x:  576, y: 1816 },
    { type: 'barrel',   x:  674, y: 1842 },
    { type: 'flowers',  x:  763, y: 1852, seed: 2 },
    { type: 'toadstool',x: 1060, y: 1852 },
    { type: 'crate',    x: 1152, y: 1844 },
    { type: 'fence',    x: 1240, y: 1848 },

    // ── Step row 37 (cols 0-5, 22-27) ─────────────────────────────────────
    { type: 'toadstool', x: 144, y: 1756 },

    // ── Floor 1 (row 35, surface y = 1680) ─────────────────────────────────
    { type: 'toadstool', x: 168, y: 1660 },
    { type: 'barrel',    x: 432, y: 1650 },
    { type: 'flowers',   x: 840, y: 1660, seed: 1 },
    { type: 'crate',     x: 1152, y: 1652 },

    // ── Floor 2 (row 31, surface y = 1488) ─────────────────────────────────
    { type: 'flowers',   x:  240, y: 1468, seed: 3 },
    { type: 'stump',     x:  528, y: 1466 },
    { type: 'toadstool', x:  768, y: 1468 },
    { type: 'haybale',   x: 1056, y: 1461 },

    // ── Step row 29 (cols 1-5, 22-26) ─────────────────────────────────────
    { type: 'flowers',   x:   96, y: 1372, seed: 4 },
    { type: 'toadstool', x: 1152, y: 1372 },

    // ── Floor 3 (row 27, surface y = 1296) ─────────────────────────────────
    { type: 'toadstool', x:   96, y: 1276 },
    { type: 'barrel',    x:  384, y: 1266 },
    { type: 'flowers',   x:  912, y: 1276, seed: 5 },
    { type: 'fence',     x: 1200, y: 1272 },

    // ── Step row 25 (cols 9-18) ────────────────────────────────────────────
    { type: 'signpost',  x:  624, y: 1144 },

    // ── Floor 4 (row 23, surface y = 1104) ─────────────────────────────────
    { type: 'stump',     x:  144, y: 1082 },
    { type: 'toadstool', x:  480, y: 1084 },
    { type: 'haybale',   x:  816, y: 1077 },
    { type: 'lantern',   x: 1152, y: 1064 },

    // ── Step row 21 (cols 0-4, 23-27) ─────────────────────────────────────
    { type: 'flowers',   x:   48, y:  988, seed: 1 },
    { type: 'toadstool', x: 1200, y:  988 },

    // ── Floor 5 (row 19, surface y = 912) ──────────────────────────────────
    { type: 'flowers',   x:  384, y:  892, seed: 2 },
    { type: 'signpost',  x:  576, y:  856 },
    { type: 'crate',     x:  672, y:  884 },
    { type: 'toadstool', x:  912, y:  892 },

    // ── Step row 17 (cols 2-6, 21-25) ─────────────────────────────────────
    { type: 'barrel',    x:  192, y:  786 },
    { type: 'toadstool', x: 1104, y:  796 },

    // ── Floor 6 (row 15, surface y = 720) ──────────────────────────────────
    { type: 'barrel',    x:   48, y:  690 },
    { type: 'flowers',   x:  336, y:  700, seed: 0 },
    { type: 'haybale',   x:  912, y:  693 },
    { type: 'toadstool', x: 1248, y:  700 },

    // ── Step row 13 (cols 7-11, 16-20) ────────────────────────────────────
    { type: 'flowers',   x:  432, y:  604, seed: 3 },
    { type: 'toadstool', x:  816, y:  604 },

    // ── Floor 7 (row 11, surface y = 528) ──────────────────────────────────
    { type: 'stump',     x:  144, y:  506 },
    { type: 'toadstool', x:  432, y:  508 },
    { type: 'flowers',   x:  768, y:  508, seed: 4 },
    { type: 'barrel',    x: 1104, y:  498 },

    // ── Step row 9 (cols 10-16) ────────────────────────────────────────────
    { type: 'crate',     x:  576, y:  404 },

    // ── Top floor (row 7, surface y = 336) ─────────────────────────────────
    { type: 'flowers',   x:  240, y:  316, seed: 5 },
    { type: 'signpost',  x:  528, y:  280 },
    { type: 'toadstool', x:  720, y:  316 },
    { type: 'haybale',   x:  960, y:  309 },
  ],
};
