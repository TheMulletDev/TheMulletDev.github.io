import { Camera }   from '../engine/Camera.js';
import { integrate } from '../engine/Physics.js';
import { Tilemap, TILE } from '../systems/Tilemap.js';
import { Combat }   from '../systems/Combat.js';
import { Renderer } from '../systems/Renderer.js';
import { Player }   from '../entities/Player.js';
import { Enemy }    from '../entities/Enemy.js';
import { LEVEL1 }   from '../../assets/maps/level1.js';

export class GameScene {
  constructor(canvas, input) {
    this.canvas   = canvas;
    this.input    = input;
    this.tilemap  = new Tilemap(LEVEL1);
    this.combat   = new Combat();
    this.renderer = new Renderer();

    const ps = LEVEL1.playerStart;
    this.player = new Player(ps.col * TILE, (ps.row - 1) * TILE);

    this.enemies = LEVEL1.enemySpawns.map(s =>
      new Enemy(s.col * TILE, (s.row - 1) * TILE, s.type)
    );

    this.camera = new Camera(
      canvas.width, canvas.height,
      this.tilemap.width, this.tilemap.height
    );

    // Respawn timer
    this._deadTimer = 0;
  }

  update(dt) {
    const { player, enemies, tilemap, combat, camera, canvas } = this;

    // Resize camera if window changed
    camera.resize(canvas.width, canvas.height);

    // --- Player ---
    player.update(dt, this.input);
    integrate(player, dt);
    tilemap.resolveEntity(player);
    player.postPhysics();

    // Keep in world bounds
    player.x = Math.max(0, Math.min(player.x, tilemap.width - player.w));
    if (player.y > tilemap.height) {
      player.hp = 0;
      player.dead = true;
    }

    // --- Enemies ---
    for (const e of enemies) {
      e.update(dt, player); // always called — handles death/respawn timers when dead
      if (!e.dead) {
        integrate(e, dt);
        tilemap.resolveEntity(e);
        e.x = Math.max(0, Math.min(e.x, tilemap.width - e.w));
      }
    }

    // --- Combat ---
    combat.resolvePlayerAttack(player, enemies);
    combat.resolveEnemyAttack(player, enemies);
    combat.update(dt);

    // --- Camera ---
    camera.follow(player);

    // --- Respawn ---
    if (player.dead) {
      this._deadTimer += dt;
      if (this._deadTimer > 2) this._respawn();
    }
  }

  _respawn() {
    this._deadTimer = 0;
    const ps = LEVEL1.playerStart;
    this.player = new Player(ps.col * TILE, (ps.row - 1) * TILE);
    // Respawn dead enemies
    this.enemies = LEVEL1.enemySpawns.map(s =>
      new Enemy(s.col * TILE, (s.row - 1) * TILE, s.type)
    );
  }

  draw() {
    const { canvas, camera, tilemap, player, enemies, combat, renderer } = this;
    const ctx = canvas.ctx;

    canvas.clear();

    // Background (world space)
    camera.apply(ctx);
    renderer.drawBackground(ctx, camera, tilemap.width, tilemap.height);
    tilemap.draw(ctx, camera);

    // Enemies
    for (const e of enemies) renderer.drawEnemy(ctx, e);

    // Player
    renderer.drawPlayer(ctx, player);

    // Floating damage numbers (world space)
    combat.draw(ctx);

    camera.restore(ctx);

    // HUD (screen space)
    renderer.drawHUD(ctx, player, canvas.width, canvas.height);
    renderer.drawMobileControls(ctx, canvas.width, canvas.height);

    // Death overlay
    if (player.dead) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = 'bold 36px monospace';
      ctx.fillStyle = '#f44';
      ctx.textAlign = 'center';
      ctx.fillText('YOU DIED', canvas.width / 2, canvas.height / 2);
      ctx.font = '18px monospace';
      ctx.fillStyle = '#aaa';
      ctx.fillText('Respawning...', canvas.width / 2, canvas.height / 2 + 36);
    }
  }
}
