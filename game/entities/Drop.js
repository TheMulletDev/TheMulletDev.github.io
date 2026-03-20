/**
 * Drop — a collectible item that falls from a dead enemy.
 *
 * Types:
 *   'coin'   – gold currency (has .value)
 *   'potion' – restores HP on pickup (stacks in inventory)
 *   'weapon' – equippable weapon (has .weaponId)
 *
 * Drops are plain objects with the same interface as other entities so
 * Physics.integrate() and Tilemap.resolveEntity() work without changes.
 */
export class Drop {
  constructor(x, y, type, data = {}) {
    // Slight random spread so multiple drops from one enemy don't stack
    this.x = x + (Math.random() - 0.5) * 24;
    this.y = y;
    this.vx = (Math.random() - 0.5) * 70;
    this.vy = -190 - Math.random() * 80; // pop upward

    this.w = type === 'weapon' ? 20 : 14;
    this.h = type === 'weapon' ? 20 : 14;

    // Physics interface
    this.onGround = false;
    this.prevY    = y;
    this.facing   = 1;

    this.type     = type;
    this.life     = 12.0;                        // seconds before auto-despawn
    this.bobTimer = Math.random() * Math.PI * 2; // randomise bob phase

    // Type-specific payload
    this.value    = data.value    ?? 1;    // coin amount
    this.weaponId = data.weaponId ?? null; // e.g. 'iron_sword'
  }
}
