import { Entity } from './Entity.js';

const PATROL_SPEED = 80;
const AGGRO_RANGE  = 300;
const ATTACK_RANGE = 60;
const ATTACK_COOLDOWN = 1.2;
const KNOCKBACK = 180;

export class Enemy extends Entity {
  constructor(x, y, type = 'slime') {
    const sizes = { slime: [32, 28], mushroom: [34, 42] };
    const [w, h] = sizes[type] || [32, 32];
    super(x, y, w, h);

    this.type  = type;
    this.startX = x;
    this.patrolRange = 120;
    this.dir   = 1;
    this.state = 'patrol'; // patrol | chase | attack | hurt | dead
    this.attackCooldown = 0;
    this.hurtTimer = 0;
    this.deathTimer = 0;

    const stats = {
      slime:    { hp: 40,  maxHp: 40,  dmg: 12, exp: 15, color: '#3fa' },
      mushroom: { hp: 80,  maxHp: 80,  dmg: 20, exp: 30, color: '#c84' },
    };
    Object.assign(this, stats[type] || stats.slime);
  }

  update(dt, player) {
    if (this.dead) {
      this.deathTimer -= dt;
      return;
    }

    if (this.hurtTimer > 0) {
      this.hurtTimer -= dt;
      return;
    }

    if (this.attackCooldown > 0) this.attackCooldown -= dt;

    const dx = player.x - this.x;
    const dist = Math.abs(dx);

    if (dist < AGGRO_RANGE) {
      this.state = 'chase';
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
  }

  takeDamage(amount) {
    this.hp -= amount;
    this.hurtTimer = 0.15;
    this.vx = -this.facing * KNOCKBACK;
    if (this.hp <= 0) {
      this.dead = true;
      this.deathTimer = 0.5;
      this.vx = 0;
    }
  }

  /** Returns contact hitbox for touching the player */
  getContactBox() {
    return { x: this.x, y: this.y, w: this.w, h: this.h };
  }
}
