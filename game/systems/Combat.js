import { overlaps } from '../engine/Physics.js';

export class FloatingText {
  constructor(x, y, text, color = '#fff') {
    this.x = x; this.y = y;
    this.text  = text;
    this.color = color;
    this.life  = 1.0;
    this.vy    = -80;
  }

  update(dt) {
    this.y    += this.vy * dt;
    this.vy   *= 0.92;
    this.life -= dt * 1.2;
  }

  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, this.life);
    ctx.font = 'bold 20px monospace';
    ctx.fillStyle   = this.color;
    ctx.strokeStyle = '#000';
    ctx.lineWidth   = 3;
    ctx.textAlign   = 'center';
    ctx.strokeText(this.text, this.x, this.y);
    ctx.fillText(this.text, this.x, this.y);
    ctx.restore();
  }
}

export class Combat {
  constructor() {
    this.floatingTexts = [];
    this.pendingSounds = []; // drained by GameScene each frame
  }

  /** Check player attack vs enemies */
  resolvePlayerAttack(player, enemies) {
    const atk = player.getAttackBox();
    if (!atk) return;

    for (const enemy of enemies) {
      if (enemy.dead) continue;
      if (overlaps(atk, enemy)) {
        enemy.takeDamage(player.attackDamage);
        this.floatingTexts.push(
          new FloatingText(
            enemy.x + enemy.w / 2,
            enemy.y - 10,
            `-${player.attackDamage}`,
            '#ff4'
          )
        );
        if (enemy.dead) {
          this.pendingSounds.push('enemyDie');
          player.gainExp(enemy.exp);
          this.floatingTexts.push(
            new FloatingText(
              enemy.x + enemy.w / 2,
              enemy.y - 32,
              `+${enemy.exp} EXP`,
              '#4ef'
            )
          );
        } else {
          this.pendingSounds.push('hitEnemy');
        }
      }
    }
  }

  /** Check enemy contact / attack vs player */
  resolveEnemyAttack(player, enemies) {
    for (const enemy of enemies) {
      if (enemy.dead || enemy.hurtTimer > 0) continue;
      if (overlaps(player, enemy.getContactBox())) {
        // Only deal damage once per enemy state = 'attack' cycle
        if (enemy.state === 'attack') {
          player.takeDamage(enemy.dmg);
          if (player.hp > 0) {
            this.floatingTexts.push(
              new FloatingText(
                player.x + player.w / 2,
                player.y - 10,
                `-${enemy.dmg}`,
                '#f44'
              )
            );
          }
        }
      }
    }
  }

  /** Check a single projectile against all enemies; marks proj.hit on contact. */
  resolveProjectile(proj, enemies, player) {
    for (const enemy of enemies) {
      if (enemy.dead) continue;
      if (overlaps(proj, enemy)) {
        enemy.takeDamage(proj.damage);
        this.floatingTexts.push(
          new FloatingText(enemy.x + enemy.w / 2, enemy.y - 10, `-${proj.damage}`, '#ff4')
        );
        if (enemy.dead) {
          this.pendingSounds.push('enemyDie');
          player.gainExp(enemy.exp);
          this.floatingTexts.push(
            new FloatingText(enemy.x + enemy.w / 2, enemy.y - 32, `+${enemy.exp} EXP`, '#4ef')
          );
        }
        proj.hit = true;
        return;
      }
    }
  }

  /** Apply instant lightning damage to a bolt's target enemy. */
  resolveLightning(bolt, player) {
    const enemy = bolt.targetEnemy;
    if (!enemy || enemy.dead) return;
    enemy.takeDamage(bolt.damage);
    this.floatingTexts.push(
      new FloatingText(enemy.x + enemy.w / 2, enemy.y - 10, `-${bolt.damage}`, '#a5f3fc')
    );
    if (enemy.dead) {
      this.pendingSounds.push('enemyDie');
      player.gainExp(enemy.exp);
      this.floatingTexts.push(
        new FloatingText(enemy.x + enemy.w / 2, enemy.y - 32, `+${enemy.exp} EXP`, '#4ef')
      );
    }
  }

  update(dt) {
    for (const ft of this.floatingTexts) ft.update(dt);
    this.floatingTexts = this.floatingTexts.filter(ft => ft.life > 0);
  }

  draw(ctx) {
    for (const ft of this.floatingTexts) ft.draw(ctx);
  }
}
