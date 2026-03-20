import { Entity } from './Entity.js';

// Weapon definitions — id must match the weaponId used in Enemy drop tables.
export const WEAPONS = {
  iron_sword: { id: 'iron_sword', name: 'Iron Sword', dmgBonus: 20, color: '#e8c84a' },
  magic_wand:  { id: 'magic_wand',  name: 'Magic Wand',  dmgBonus: 45, color: '#c084fc' },
};

const WALK_SPEED      = 220;
const JUMP_FORCE      = -620;
const JUMP_FORCE_2    = -460; // double-jump is slightly shorter
const ATTACK_DURATION = 0.25; // seconds
const ATTACK_COOLDOWN  = 0.3;
const INVINCIBLE_DURATION = 0.6;

export class Player extends Entity {
  constructor(x, y, playerClass = null) {
    super(x, y, 36, 52);
    this.playerClass = playerClass;
    const cs = playerClass?.stats ?? {};
    this.maxHp = cs.maxHp ?? 150;
    this.hp    = this.maxHp;
    this.exp   = 0;
    this.level = 1;
    this.expToNext = 100;

    // Inventory / currency
    this.gold       = 0;
    this.potions    = 0;
    this.maxPotions = 5;
    this.weapon     = null; // equipped WEAPONS entry, or null = fists

    // Pending UI events to be drained by GameScene each frame
    this.pendingTexts = []; // [{ text, color }]

    // Attack state
    this.attacking          = false;
    this.attackTimer        = 0;
    this.attackCooldown     = 0;
    this.attackDamage       = cs.attackDamage ?? 25;
    this._attackJustStarted = false; // rising-edge signal drained by GameScene

    // Invincibility frames
    this.invincible    = false;
    this.invincibleTimer = 0;

    // Potion use cooldown (prevents holding 'E' from draining all potions)
    this._potionCooldown = 0;

    // Jump buffer (forgiving input)
    this.jumpBufferTimer = 0;
    this.coyoteTimer     = 0;
    this.jumpsLeft       = 1;  // air jumps remaining (reset on landing)
    this._prevJump       = false; // edge-detection: was jump held last frame

    // Animation state
    this.state = 'idle'; // idle | walk | jump | fall | attack
  }

  update(dt, input) {
    this.onGround = false; // reset; physics/tilemap will set it

    // Timers
    if (this._potionCooldown > 0) this._potionCooldown -= dt;
    if (this.attackCooldown > 0)  this.attackCooldown  -= dt;
    if (this.attackTimer    > 0) {
      this.attackTimer -= dt;
      if (this.attackTimer <= 0) this.attacking = false;
    }
    if (this.invincibleTimer > 0) {
      this.invincibleTimer -= dt;
      if (this.invincibleTimer <= 0) this.invincible = false;
    }
    if (this.jumpBufferTimer > 0) this.jumpBufferTimer -= dt;
    if (this.coyoteTimer     > 0) this.coyoteTimer     -= dt;

    // Horizontal movement
    if (!this.attacking) {
      if (input.isLeft()) {
        this.vx = -WALK_SPEED;
        this.facing = -1;
      } else if (input.isRight()) {
        this.vx = WALK_SPEED;
        this.facing = 1;
      } else {
        this.vx = 0;
      }
    } else {
      this.vx *= 0.7; // slow down while attacking
    }

    // Rising-edge jump detection (prevent held key from re-triggering)
    const jumpHeld       = input.isJump();
    const jumpJustPressed = jumpHeld && !this._prevJump;
    this._prevJump = jumpHeld;

    if (jumpJustPressed) this.jumpBufferTimer = 0.12;

    // First jump — ground or coyote window
    if (this.jumpBufferTimer > 0 && this.coyoteTimer > 0) {
      this.vy = JUMP_FORCE;
      this.jumpBufferTimer = 0;
      this.coyoteTimer = 0;
    // Double jump — must be in the air, coyote expired, and have an air jump left
    } else if (jumpJustPressed && !this.onGround && this.coyoteTimer <= 0 && this.jumpsLeft > 0) {
      this.vy = JUMP_FORCE_2;
      this.jumpsLeft--;
    }

    // Potion use
    if (input.isUsePotion() && this.potions > 0 && this.hp < this.maxHp && this._potionCooldown <= 0) {
      this._usePotion();
    }

    // Attack
    if (input.isAttack() && this.attackCooldown <= 0 && !this.attacking) {
      this.attacking          = true;
      this.attackTimer        = ATTACK_DURATION;
      this.attackCooldown     = ATTACK_COOLDOWN;
      this._attackJustStarted = true;
    }

    // Animation state
    if (this.attacking) {
      this.state = 'attack';
    } else if (!this.onGround) {
      this.state = this.vy < 0 ? 'jump' : 'fall';
    } else if (this.vx !== 0) {
      this.state = 'walk';
    } else {
      this.state = 'idle';
    }
  }

  /** Call AFTER physics resolves onGround */
  postPhysics() {
    if (this.onGround) {
      this.coyoteTimer = 0.1;
      this.jumpsLeft   = 1; // restore air jump on landing
    }
  }

  /** Returns attack hitbox or null */
  getAttackBox() {
    if (!this.attacking) return null;
    const reach = 48;
    return {
      x: this.facing === 1 ? this.x + this.w : this.x - reach,
      y: this.y + 8,
      w: reach,
      h: this.h - 16,
    };
  }

  /** Pick up a dropped item. Returns false if the item was rejected (e.g. potions full). */
  pickupDrop(drop) {
    if (drop.type === 'coin') {
      this.gold += drop.value;
      this.pendingTexts.push({ text: `+${drop.value}g`, color: '#ffd700' });
      return true;
    }
    if (drop.type === 'potion') {
      if (this.potions >= this.maxPotions) return false;
      this.potions++;
      this.pendingTexts.push({ text: '+Potion', color: '#f0abfc' });
      return true;
    }
    if (drop.type === 'weapon') {
      const w = WEAPONS[drop.weaponId];
      if (!w) return false;
      if (this.weapon) this.attackDamage -= this.weapon.dmgBonus; // unequip old
      this.weapon = w;
      this.attackDamage += w.dmgBonus;
      this.pendingTexts.push({ text: w.name + '!', color: w.color });
      return true;
    }
    return false;
  }

  _usePotion() {
    if (this.potions <= 0) return;
    const healed = Math.min(60, this.maxHp - this.hp);
    this.hp = Math.min(this.maxHp, this.hp + 60);
    this.potions--;
    this._potionCooldown = 0.5;
    if (healed > 0) this.pendingTexts.push({ text: `+${healed} HP`, color: '#4ade80' });
  }

  takeDamage(amount) {
    if (this.invincible) return;
    this.hp = Math.max(0, this.hp - amount);
    this.invincible = true;
    this.invincibleTimer = INVINCIBLE_DURATION;
    if (this.hp <= 0) this.dead = true;
  }

  gainExp(amount) {
    this.exp += amount;
    while (this.exp >= this.expToNext) {
      this.exp -= this.expToNext;
      this.level++;
      this.expToNext = Math.floor(this.expToNext * 1.4);
      this.maxHp += 20;
      this.hp = this.maxHp;
      this.attackDamage += 5; // weapon bonus is already included in attackDamage
      this.leveledUp = true;  // drained each frame by GameScene → triggers fireworks
    }
  }
}
