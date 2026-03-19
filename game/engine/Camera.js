export class Camera {
  constructor(viewW, viewH, worldW, worldH) {
    this.x = 0;
    this.y = 0;
    this.viewW = viewW;
    this.viewH = viewH;
    this.worldW = worldW;
    this.worldH = worldH;
  }

  follow(target) {
    // Center on target with lag
    const targetX = target.x + target.w / 2 - this.viewW / 2;
    const targetY = target.y + target.h / 2 - this.viewH / 2;
    this.x += (targetX - this.x) * 0.1;
    this.y += (targetY - this.y) * 0.1;

    // Clamp to world bounds
    this.x = Math.max(0, Math.min(this.x, this.worldW  - this.viewW));
    this.y = Math.max(0, Math.min(this.y, this.worldH - this.viewH));
  }

  apply(ctx) {
    ctx.save();
    ctx.translate(-Math.round(this.x), -Math.round(this.y));
  }

  restore(ctx) {
    ctx.restore();
  }

  resize(viewW, viewH) {
    this.viewW = viewW;
    this.viewH = viewH;
  }
}
