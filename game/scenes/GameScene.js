import { Camera }   from '../engine/Camera.js';
import { integrate, overlaps } from '../engine/Physics.js';
import { Tilemap, TILE } from '../systems/Tilemap.js';
import { Combat, FloatingText } from '../systems/Combat.js';
import { Renderer } from '../systems/Renderer.js';
import { Player }   from '../entities/Player.js';
import { Enemy }    from '../entities/Enemy.js';
import { Drop }     from '../entities/Drop.js';
import { LEVEL1 }     from '../../assets/maps/level1.js';
import { CHANGELOG }  from '../../assets/changelog.js';

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

    // Active drops in the world
    this.drops = [];

    // Respawn timer
    this._deadTimer = 0;

    // Changelog overlay state
    this._changelogOpen   = false;
    this._changelogScroll = 0;

    // Click — toggle changelog or close it
    this._handleClick = (e) => {
      const r   = canvas.el.getBoundingClientRect();
      const scaleX = canvas.width  / r.width;
      const scaleY = canvas.height / r.height;
      const mx  = (e.clientX - r.left) * scaleX;
      const my  = (e.clientY - r.top)  * scaleY;
      this._hitTestChangelog(mx, my);
    };
    canvas.el.addEventListener('click', this._handleClick);

    // Touch — same, using first changed touch
    this._handleTouch = (e) => {
      const r     = canvas.el.getBoundingClientRect();
      const scaleX = canvas.width  / r.width;
      const scaleY = canvas.height / r.height;
      const t     = e.changedTouches[0];
      const mx    = (t.clientX - r.left) * scaleX;
      const my    = (t.clientY - r.top)  * scaleY;
      this._hitTestChangelog(mx, my);
    };
    canvas.el.addEventListener('touchend', this._handleTouch, { passive: true });

    // Scroll wheel — scroll the overlay content
    this._handleWheel = (e) => {
      if (!this._changelogOpen) return;
      this._changelogScroll = Math.max(0, this._changelogScroll + e.deltaY * 0.4);
    };
    canvas.el.addEventListener('wheel', this._handleWheel, { passive: true });
  }

  /** Button / overlay hit-testing used by both click and touch handlers. */
  _hitTestChangelog(mx, my) {
    const { canvas, renderer } = this;
    const btnRect = renderer.changelogButtonRect(canvas.width, canvas.height);

    if (!this._changelogOpen) {
      if (mx >= btnRect.x && mx <= btnRect.x + btnRect.w &&
          my >= btnRect.y && my <= btnRect.y + btnRect.h) {
        this._changelogOpen   = true;
        this._changelogScroll = 0;
      }
      return;
    }

    // While open: check if click lands on the close [X] or outside the panel
    const panel = renderer.changelogPanelRect(canvas.width, canvas.height);
    const xBtnX = panel.x + panel.w - 36;
    const xBtnY = panel.y + 8;
    const xBtnS = 24;
    if (mx >= xBtnX && mx <= xBtnX + xBtnS && my >= xBtnY && my <= xBtnY + xBtnS) {
      this._changelogOpen = false;
      return;
    }
    // Click outside panel closes it
    if (mx < panel.x || mx > panel.x + panel.w || my < panel.y || my > panel.y + panel.h) {
      this._changelogOpen = false;
    }
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
      e.update(dt, player, tilemap); // always called — handles death/respawn timers when dead
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

    // --- Drops: spawn from freshly killed enemies ---
    for (const e of enemies) {
      if (!e.pendingDrops.length) continue;
      for (const d of e.pendingDrops) this.drops.push(new Drop(d.x, d.y, d.type, d));
      e.pendingDrops = [];
    }

    // --- Drops: physics, pickup, despawn ---
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.life -= dt;
      d.bobTimer += dt * 3;
      if (d.life <= 0) { this.drops.splice(i, 1); continue; }
      integrate(d, dt);
      tilemap.resolveEntity(d);
      d.x = Math.max(0, Math.min(d.x, tilemap.width - d.w));
      if (!player.dead && overlaps(player, d)) {
        if (player.pickupDrop(d)) this.drops.splice(i, 1);
      }
    }

    // --- Drain player pending UI texts ---
    for (const ft of player.pendingTexts) {
      combat.floatingTexts.push(
        new FloatingText(player.x + player.w / 2, player.y - 20, ft.text, ft.color)
      );
    }
    player.pendingTexts = [];

    // --- Level-up fireworks ---
    if (player.leveledUp) {
      this.renderer.triggerLevelUp(player.x + player.w / 2, player.y + player.h / 2);
      player.leveledUp = false;
    }

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
    this.drops = [];
    const ps = LEVEL1.playerStart;
    this.player = new Player(ps.col * TILE, (ps.row - 1) * TILE);
    this.enemies = LEVEL1.enemySpawns.map(s =>
      new Enemy(s.col * TILE, (s.row - 1) * TILE, s.type)
    );
  }

  draw() {
    const { canvas, camera, tilemap, player, enemies, drops, combat, renderer } = this;
    const ctx = canvas.ctx;

    canvas.clear();

    // Background (world space)
    camera.apply(ctx);
    renderer.drawBackground(ctx, camera, tilemap.width, tilemap.height);
    tilemap.draw(ctx, camera);
    renderer.drawDecorations(ctx, LEVEL1.decorations);

    // Enemies
    for (const e of enemies) renderer.drawEnemy(ctx, e);

    // Drops (below player so they don't obscure combat)
    renderer.drawDrops(ctx, drops);

    // Player
    renderer.drawPlayer(ctx, player);
    renderer.drawFireworks(ctx);

    // Floating damage numbers (world space)
    combat.draw(ctx);

    camera.restore(ctx);

    // HUD (screen space)
    renderer.drawHUD(ctx, player, canvas.width, canvas.height);
    renderer.drawMobileControls(ctx, canvas.width, canvas.height);
    renderer.drawChangelogButton(ctx, canvas.width, canvas.height, this._changelogOpen);
    if (this._changelogOpen) {
      renderer.drawChangelogOverlay(ctx, canvas.width, canvas.height, CHANGELOG, this._changelogScroll);
    }

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
