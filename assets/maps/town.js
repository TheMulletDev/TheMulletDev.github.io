/**
 * Mulletville — the player's home base town.
 *
 * Layout: 20 cols × 20 rows  (960 × 960 px, TILE = 48)
 * Compact zone — everything is a short walk from spawn.
 *
 * Ground surface: row 15 (y = 720)
 * Decorative elevated platforms: row 13 (y = 624)
 * Player start: col 3, row 15 → placed at y = (15-1)*48 = 672
 *
 * Portals:
 *   "The Tower"    — right side (cols 16-17)  → LEVEL1 combat
 *   "Coming Soon"  — left side  (cols 1-2)    → placeholder
 *
 * Shop NPC: col 9, standing on ground
 */

export const TOWN = {
  cols: 20,
  rows: 20,

  // prettier-ignore
  tiles: [
    // Rows 0-12: sky
    0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
    0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
    0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
    0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
    0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
    0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
    0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
    0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
    0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
    0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
    0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
    0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
    0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
    // Row 13 — decorative platforms: cols 4-7 and cols 12-15
    0,0,0,0,2,2,2,2,0,0,0,0,2,2,2,2,0,0,0,0,
    // Row 14 — sky
    0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
    // Row 15 — ground surface
    1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
    // Rows 16-19 — underground
    1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
    1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
    1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
    1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
  ],

  /** Player appears at this world position when entering town. */
  playerStart: { col: 3, row: 15 },

  /**
   * Portal zones — walking into one triggers a scene transition.
   * x, y, w, h are in world-pixel coordinates.
   * Portal bottom (y + h) sits flush with ground surface (row 15 = y 720).
   */
  portals: [
    {
      id:       'tower',
      label:    'The Tower',
      x:        16 * 48,        // col 16 = 768
      y:        15 * 48 - 144,  // 3 tiles above ground = 576
      w:        96,
      h:        144,
      color:    '#9040e0',
      disabled: false,
    },
    {
      id:       'coming_soon',
      label:    'Coming Soon',
      x:        1 * 48,         // col 1 = 48
      y:        15 * 48 - 144,  // 576
      w:        96,
      h:        144,
      color:    '#406080',
      disabled: true,
    },
  ],

  /**
   * Shop NPC — player walks near this and presses E to open the shop.
   * x, y = world-space top-left of the NPC bounding box.
   */
  shopNPC: {
    x:             9 * 48,         // col 9 = 432
    y:             15 * 48 - 44,   // ground surface − NPC height = 676
    w:             32,
    h:             44,
    interactRange: 96,
  },

  /**
   * Decorations — purely visual, no collision.
   * Ground surface y = 720.  Elevated platform surface y = 624.
   */
  decorations: [
    // Left area
    { type: 'flowers',   x:  192, y: 700, seed: 0 },
    { type: 'toadstool', x:  336, y: 700 },

    // Centre
    { type: 'barrel',    x:  576, y: 690 },
    { type: 'stump',     x:  672, y: 698 },
    { type: 'flowers',   x:  768, y: 700, seed: 1 },

    // Right area
    { type: 'haybale',   x:  912, y: 692 },
    { type: 'flowers',   x: 1008, y: 700, seed: 2 },

    // Elevated platform decorations (surface y = 624)
    { type: 'flowers',   x:  216, y: 604, seed: 3 },
    { type: 'toadstool', x:  312, y: 604 },
    { type: 'signpost',  x:  624, y: 568 },
    { type: 'flowers',   x:  672, y: 604, seed: 4 },
  ],
};
