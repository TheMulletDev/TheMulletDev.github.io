/**
 * CHANGELOG
 *
 * Add new entries at the TOP of the array so the latest is always shown first.
 * Each entry: { version, date, changes: string[] }
 */
export const CHANGELOG = [
  {
    version: '0.7',
    date: '2026-03-21',
    changes: [
      'Mulletville — a home-base town hub between runs',
      'Select your class, then spawn in town to prepare before entering combat',
      'Walk into "The Tower" arch portal to enter the combat map',
      'Shop NPC in the centre of town — press [E] to open the shop',
      'Shop: buy Health Potions, HP Crystals, Power Scrolls, and weapons',
      '"↩ TOWN" button in combat HUD returns you to Mulletville with your loot',
      'Gold earned in combat can now be spent on permanent upgrades',
    ],
  },
  {
    version: '0.6',
    date: '2026-03-20',
    changes: [
      'Class selection screen — choose your adventurer before each run',
      'Warrior: heavy armour, 200 HP, powerful melee sword swing with red energy trail',
      'Mage: wizard hat, 110 HP, instant lightning bolt strikes nearest enemy',
      'Thief: dark hood, 130 HP, throws a spinning throwing star',
      'Bowman: ranger hat, 150 HP, fires a fast arrow projectile',
      'Each class has a unique pixel-art look and tailored stats',
    ],
  },
  {
    version: '0.5',
    date: '2026-03-20',
    changes: [
      'World progression system — 3 worlds to conquer',
      'Climb to the top floor and walk into the portal to advance',
      'World 2: Ellinia Forest — night sky, arcane platforms,',
      '  purple slimes, dark mushrooms (1.8× enemy strength)',
      'World 3: Perion Ruins — volcanic haze, stone bridges,',
      '  fire slimes, lava mushrooms (3.2× enemy strength)',
      'Each world has a unique tile palette, background, and enemy skins',
      'Stats and gear carry over between worlds; death sends you back',
      '  to World 1',
    ],
  },
  {
    version: '0.4',
    date: '2026-03-20',
    changes: [
      'Changelog button — see what\'s new at any time',
      'Level-up firework celebration: 5 staggered colour bursts',
      'Henesys-style world decorations on every floor: hay bales,',
      '  barrels, signposts, toadstools, stumps, crates, fences,',
      '  flower clusters, and glowing lanterns',
      'Double jump — press jump again mid-air for a shorter hop',
    ],
  },
  {
    version: '0.3',
    date: '2026-03-20',
    changes: [
      'Two enemy types: Slimes and Mushrooms with patrol/chase AI',
      'Weapon drops: Iron Sword (+20 dmg) and Magic Wand (+45 dmg)',
      'Weapon-coloured attack arcs and particles',
      'Potion drops — heal 60 HP, hold up to 5 (press E)',
      'Coin drops with gold tracking',
      'Floating damage numbers on hit',
    ],
  },
  {
    version: '0.2',
    date: '2026-03-20',
    changes: [
      'Parallax background: sky, clouds, mountains, hills, trees',
      'Henesys-themed sakura + green trees in background',
      'Enemy respawn system (5 second cooldown)',
      'Death screen with 2-second auto-respawn',
      'Mobile on-screen touch controls',
    ],
  },
  {
    version: '0.1',
    date: '2026-03-20',
    changes: [
      'Initial game — 8-floor tower platformer',
      'Player movement with coyote time and jump buffer',
      'Melee attack with sweeping arc effect',
      'HP, EXP, and level-up system',
      'Procedural pixel-art sprites — no external assets',
    ],
  },
];
