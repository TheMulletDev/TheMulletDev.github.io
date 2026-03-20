import { Entity } from './Entity.js';

const PATROL_SPEED    = 80;
const AGGRO_RANGE     = 300;
const ATTACK_RANGE    = 60;
const ATTACK_COOLDOWN = 1.2;
const KNOCKBACK       = 180;
const DEATH_DURATION  = 0.7;  // seconds the death animation plays
const RESPAWN_DELAY   = 5.0;  // seconds after death anim before respawn

const STATS = {
  slime:    { hp: 40, maxHp: 40,  dmg: 12, exp: 15 },
  mushroom: { hp: 80, maxHp: 80,  dmg: 20, exp: 30 },
};

// Loot tables — each entry rolls independently.
// weapon drops use weaponId matching the WEAPONS map in Player.js.
const DROP_TABLES = {
  slime: [
    { type: 'coin',   chance: 0.90, valueMin: 1, valueMax: 3 },
    { type: 'potion', chance: 0.10 },
  ],
  mushroom: [
    { type: 'coin',   chance: 1.00, valueMin: 4, valueMax: 8 },
    { type: 'potion', chance: 0.20 },
    { type: 'weapon', chance: 0.06, weaponId: 'iron_sword' },
  ],
};

export class Enemy extends Entity {
  constructor(x, y, type = 'slime') {
    const sizes = { slime: [32, 28], mushroom: [34, 42] };
    const [w, h] = sizes[type] || [32, 32];
    super(x, y, w, h);

    this.type  = type;
    this.spawnX = x;
    this.spawnY = y;
    this.startX = x;
    this.patrolRange = 120;
    this.dir   = 1;
    this.state = 'patrol'; // patrol | chase | attack | hurt | dead
    this.attackCooldown = 0;
    this.hurtTimer  = 0;
    this.deathTimer = 0;
    this.respawnTimer = 0;
    this.spawnFlash   = 0;  // counts down after respawning for a flash effect
    this.pendingDrops = []; // filled on death, drained by GameScene

    Object.assign(this, STATS[type] || STATS.slime);
  }

  update(dt, player, tilemap) {
    if (this.dead) {
      // Both timers count down in parallel; respawnTimer is longer.
      if (this.deathTimer  > 0) this.deathTimer  -= dt;
      if (this.respawnTimer > 0) {
        this.respawnTimer -= dt;
        if (this.respawnTimer <= 0) this._respawn();
      }
      return;
    }

    if (this.spawnFlash > 0) this.spawnFlash -= dt;

    if (this.hurtTimer > 0) {
      this.hurtTimer -= dt;
      return;
    }

    if (this.attackCooldown > 0) this.attackCooldown -= dt;

    const dx   = player.x - this.x;
    const dist = Math.abs(dx);

    if (dist < AGGRO_RANGE) {
      this.state  = 'chase';
      this.facing = Math.sign(dx);
      if (dist > ATTACK_RANGE) {
        this.vx = this.facing * PATROL_SPEED * 1.4;
      } else {
        this.vx = 0;
        if (this.attackCooldown <= 0) {
          this.state = 'attack';
          this.attackCooldown = ATTACK_COOLDOWN;
        }
      }
    } else {
      this.state = 'patrol';
      this.vx = this.dir * PATROL_SPEED;
      if (this.x > this.startX + this.patrolRange) { this.dir = -1; this.facing = -1; }
      if (this.x < this.startX - this.patrolRange) { this.dir =  1; this.facing =  1; }
    }

    // Edge detection: stop before walking off a platform.
    if (tilemap && this.onGround && this.vx !== 0) {
      const lookX = this.vx > 0 ? this.x + this.w + 2 : this.x - 2;
      const lookY = this.y + this.h + 4;
      if (!tilemap.hasSolidGround(lookX, lookY)) {
        if (this.state === 'patrol') {
          this.dir    = -this.dir;
          this.facing = -this.facing;
          this.vx     = this.dir * PATROL_SPEED;
        } else {
          // During chase, stop at the edge rather than fall off.
          this.vx = 0;
        }
      }
    }
  }

  takeDamage(amount) {
    this.hp -= amount;
    this.hurtTimer = 0.15;
    this.vx = -this.facing * KNOCKBACK;
    if (this.hp <= 0) {
      this.dead         = true;
      this.deathTimer   = DEATH_DURATION;
      this.respawnTimer = DEATH_DURATION + RESPAWN_DELAY;
      this.vx           = 0;
      this._rollDrops();
    }
  }

  _rollDrops() {
    this.pendingDrops = [];
    const cx = this.x + this.w / 2;
    const cy = this.y + this.h / 2;
    for (const entry of (DROP_TABLES[this.type] ?? [])) {
      if (Math.random() >= entry.chance) continue;
      const drop = { type: entry.type, x: cx, y: cy };
      if (entry.type === 'coin') {
        drop.value = entry.valueMin + Math.floor(Math.random() * (entry.valueMax - entry.valueMin + 1));
      }
      if (entry.weaponId) drop.weaponId = entry.weaponId;
      this.pendingDrops.push(drop);
    }
  }

  _respawn() {
    Object.assign(this, STATS[this.type] || STATS.slime);
    this.x    = this.spawnX;
    this.y    = this.spawnY;
    this.vx   = 0;
    this.vy   = 0;
    this.dead = false;
    this.deathTimer   = 0;
    this.respawnTimer = 0;
    this.hurtTimer    = 0;
    this.attackCooldown = 0;
    this.state  = 'patrol';
    this.dir    = 1;
    this.facing = 1;
    this.startX = this.spawnX;
    this.spawnFlash   = 0.5;  // triggers a brief flash in the renderer
    this.pendingDrops = [];
  }

  /** Returns contact hitbox for touching the player */
  getContactBox() {
    return { x: this.x, y: this.y, w: this.w, h: this.h };
  }
}
