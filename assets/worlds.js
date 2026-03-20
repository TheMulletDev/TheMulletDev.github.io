/**
 * WORLDS
 *
 * Each world has a tile palette, background colours, enemy stat multipliers,
 * enemy skin colour overrides, and a background style tag.
 *
 * To add more worlds just push to this array.  GameScene cycles through them
 * in order and loops back to World 1 after the last one.
 */
export const WORLDS = [
  // ── World 1 — Henesys Outskirts ──────────────────────────────────────────
  {
    id: 1,
    name: 'Henesys Outskirts',
    subtitle: 'Where every adventure begins...',
    bgStyle: 'henesys',

    sky:   { top: '#4ab8f8', mid: '#82d4fa', bot: '#c8ecff' },
    hills: { far: '#b0c4e8', mid1: '#5abe38', mid1h: '#72da50', near: '#3ea828' },

    tiles: {
      // Type 1 — grass / earth
      earthBase: '#c49a5a', earthMid: '#d4aa6a', earthDark: '#b08040', earthLight: '#e8c080',
      grassDark: '#3aad28', grassMid: '#4ec832', grassBright: '#72e850', grassTop: '#9aff7a',
      tuft: '#58e038', underground: '#8a6030',
      flowerStem: '#28801a', flower1: '#ff6e9a', flower2: '#ffffff',
      // Type 2 — wooden rope platform
      plankBody: '#8b5a2b', plankGrain: '#7a4e22', plankHi1: '#c48840', plankHi2: '#e8aa58',
      rope: '#d4a030', ropeDark: '#b88820', glow: 'rgba(100,255,80,0.50)',
      // Type 3 — stone wall
      mortar: '#8a8898', brick: '#9e9cb0', brickLight: '#b8b6cc', brickDark: '#6a6878',
      moss: '#4aaa38', mossDark: '#3a8a28',
    },

    enemyMult: { hp: 1.0, dmg: 1.0, exp: 1.0, spd: 1.0 },
    enemySkin: null,
    portalColor: '#9040e0',
  },

  // ── World 2 — Ellinia Forest ──────────────────────────────────────────────
  {
    id: 2,
    name: 'Ellinia Forest',
    subtitle: 'Ancient trees guard dark secrets.',
    bgStyle: 'ellinia',

    sky:   { top: '#080c1a', mid: '#10183a', bot: '#182050' },
    hills: { far: '#181e38', mid1: '#0c2c1c', mid1h: '#143a26', near: '#081a0e' },

    tiles: {
      // Type 1 — dark mossy forest floor
      earthBase: '#1a2a10', earthMid: '#243818', earthDark: '#14200c', earthLight: '#2e4a1a',
      grassDark: '#0e6a0e', grassMid: '#168c16', grassBright: '#20b020', grassTop: '#40cc40',
      tuft: '#18a218', underground: '#0e1c08',
      flowerStem: '#0a5a10', flower1: '#c040ff', flower2: '#70eeff',
      // Type 2 — glowing arcane platform
      plankBody: '#2a1248', plankGrain: '#200e38', plankHi1: '#6828b0', plankHi2: '#8848d0',
      rope: '#7018c8', ropeDark: '#480e90', glow: 'rgba(160,60,255,0.70)',
      // Type 3 — dark stone with arcane cracks
      mortar: '#0c0c1c', brick: '#1c1c30', brickLight: '#2c2c48', brickDark: '#080818',
      moss: '#0e7818', mossDark: '#095010',
    },

    enemyMult: { hp: 1.8, dmg: 1.6, exp: 1.8, spd: 1.15 },
    enemySkin: {
      slime:    { slimeD: '#38086a', slimeM: '#6828b8', slimeL: '#b870f0' },
      mushroom: { capD: '#084020', capM: '#126030', capL: '#24904c', stemD: '#3c5e1a', stemM: '#5a8828', spot: '#b8f030' },
    },
    portalColor: '#ff8040',
  },

  // ── World 3 — Perion Ruins ────────────────────────────────────────────────
  {
    id: 3,
    name: 'Perion Ruins',
    subtitle: 'The ancient warrior stronghold.',
    bgStyle: 'perion',

    sky:   { top: '#140200', mid: '#380a00', bot: '#541808' },
    hills: { far: '#2e1004', mid1: '#601c06', mid1h: '#7a2c10', near: '#3c1004' },

    tiles: {
      // Type 1 — volcanic rocky ground
      earthBase: '#3e2010', earthMid: '#4e2e1a', earthDark: '#301408', earthLight: '#5e3e24',
      grassDark: '#5a3818', grassMid: '#6e4c28', grassBright: '#866038', grassTop: '#9e7448',
      tuft: '#704428', underground: '#221008',
      flowerStem: '#5a2a08', flower1: '#ff3800', flower2: '#ff8000',
      // Type 2 — worn stone bridge slab
      plankBody: '#4e3018', plankGrain: '#3c2210', plankHi1: '#7e5830', plankHi2: '#9c7040',
      rope: '#aa4c10', ropeDark: '#7a2c08', glow: 'rgba(255,90,20,0.55)',
      // Type 3 — volcanic basalt
      mortar: '#200a04', brick: '#3c1c0c', brickLight: '#5a2e14', brickDark: '#180804',
      moss: '#b83008', mossDark: '#801808',
    },

    enemyMult: { hp: 3.2, dmg: 2.6, exp: 3.2, spd: 1.3 },
    enemySkin: {
      slime:    { slimeD: '#6e0e00', slimeM: '#c02000', slimeL: '#f05030' },
      mushroom: { capD: '#5e0c00', capM: '#981c00', capL: '#d03000', stemD: '#4a2408', stemM: '#724014', spot: '#ff6c00' },
    },
    portalColor: '#40b8ff',
  },
];
