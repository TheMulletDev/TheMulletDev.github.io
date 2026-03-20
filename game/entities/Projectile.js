export class Projectile {
  constructor(x, y, vx, vy, type, damage) {
    this.x      = x;
    this.y      = y;
    this.vx     = vx;
    this.vy     = vy;
    this.type   = type;   // 'star' | 'arrow'
    this.damage = damage;
    this.life   = 1.8;    // seconds before auto-despawn
    this.hit    = false;  // true after striking an enemy
    this.angle  = 0;      // used for star rotation

    // Hitbox size
    if (type === 'arrow') { this.w = 22; this.h = 6; }
    else                  { this.w = 14; this.h = 14; }
  }
}
