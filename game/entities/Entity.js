export class Entity {
  constructor(x, y, w, h) {
    this.x = x; this.y = y;
    this.w = w; this.h = h;
    this.vx = 0; this.vy = 0;
    this.onGround = false;
    this.facing = 1; // 1 = right, -1 = left
    this.hp = 100;
    this.maxHp = 100;
    this.dead = false;
  }
}
