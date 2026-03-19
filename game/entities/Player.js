import { Entity } from './Entity.js';

const WALK_SPEED   = 220;
const JUMP_FORCE   = -620;
const ATTACK_DURATION = 0.25; // seconds
const ATTACK_COOLDOWN  = 0.3;
const INVINCIBLE_DURATION = 0.6;

export class Player extends Entity {
  constructor(x, y) {
    super(x, y, 36, 52);
    this.maxHp = 150;
    this.hp    = 150;
    this.exp   = 0;
    this.level = 1;
    this.expToNext = 100;

    // Attack state
    this.attacking     = false;
    this.attackTimer   = 0;
    this.attackCooldown = 0;
    this.attackDamage  = 25;

    // Invincibility frames
    this.invincible    = false;
    this.invincibleTimer = 0;

    // Jump buffer (forgiving input)
    this.jumpBufferTimer = 0;
    this.coyoteTimer     = 0;

    // Animation state
    this.state = 'idle'; // idle | walk | jump | fall | attack
  }

  update(dt, input) {
    this.onGround = false; // reset; physics/tilemap will set it

    // Timers
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

    // Jump buffer
    if (input.isJump()) this.jumpBufferTimer = 0.12;

    // Actual jump (with coyote time)
    if (this.jumpBufferTimer > 0 && this.coyoteTimer > 0) {
      this.vy = JUMP_FORCE;
      this.jumpBufferTimer = 0;
      this.coyoteTimer = 0;
    }

    // Attack
    if (input.isAttack() && this.attackCooldown <= 0 && !this.attacking) {
      this.attacking    = true;
      this.attackTimer  = ATTACK_DURATION;
      this.attackCooldown = ATTACK_COOLDOWN;
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
    if (this.onGround) this.coyoteTimer = 0.1;
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
      this.attackDamage += 5;
    }
  }
}
