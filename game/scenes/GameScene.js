import { Camera }   from '../engine/Camera.js';
import { integrate, overlaps } from '../engine/Physics.js';
import { Tilemap, TILE } from '../systems/Tilemap.js';
import { Combat, FloatingText } from '../systems/Combat.js';
import { Renderer } from '../systems/Renderer.js';
import { Player }   from '../entities/Player.js';
import { Enemy }    from '../entities/Enemy.js';
import { Drop }     from '../entities/Drop.js';
import { LEVEL1 }     from '../../assets/maps/level1.js';
import { WORLDS }     from '../../assets/worlds.js';
import { CHANGELOG }  from '../../assets/changelog.js';

export class GameScene {
  constructor(canvas, input) {
    this.canvas   = canvas;
    this.input    = input;
    this.tilemap  = new Tilemap(LEVEL1);
    this.combat   = new Combat();
    this.renderer = new Renderer();

    // World progression state
    this._worldIdx        = 0;           // index into WORLDS[]
    this._worldTransition = null;        // { phase, t, duration, targetIdx }

    const ps = LEVEL1.playerStart;
    this.player = new Player(ps.col * TILE, (ps.row - 1) * TILE);

    this.enemies = this._spawnEnemies(WORLDS[0]);

    this.camera = new Camera(
      canvas.width, canvas.height,
      this.tilemap.width, this.tilemap.height
    );

    // Active drops in the world
    this.drops = [];

    // Respawn timer
    this._deadTimer = 0;

    // Changelog overlay state
    this._changelogOpen        = false;
    this._changelogScroll      = 0;
    this._touchScrollStartY    = 0;
    this._touchScrollStart     = 0;
    this._touchMoved           = false;

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

    // Touch start — record position for drag-scroll
    this._handleTouchStart = (e) => {
      this._touchScrollStartY = e.touches[0].clientY;
      this._touchScrollStart  = this._changelogScroll;
      this._touchMoved        = false;
    };
    canvas.el.addEventListener('touchstart', this._handleTouchStart, { passive: true });

    // Touch move — drag to scroll the overlay
    this._handleTouchMove = (e) => {
      if (!this._changelogOpen) return;
      const dy = this._touchScrollStartY - e.touches[0].clientY;
      if (Math.abs(dy) > 6) this._touchMoved = true;
      if (!this._touchMoved) return;
      const r      = canvas.el.getBoundingClientRect();
      const scaleY = canvas.height / r.height;
      this._changelogScroll = Math.max(
        0,
        Math.min(this._changelogMaxScroll(), this._touchScrollStart + dy * scaleY)
      );
    };
    canvas.el.addEventListener('touchmove', this._handleTouchMove, { passive: true });

    // Touch end — treat as tap (close/open) only if finger barely moved
    this._handleTouchEnd = (e) => {
      if (this._touchMoved) { this._touchMoved = false; return; }
      const r     = canvas.el.getBoundingClientRect();
      const scaleX = canvas.width  / r.width;
      const scaleY = canvas.height / r.height;
      const t     = e.changedTouches[0];
      const mx    = (t.clientX - r.left) * scaleX;
      const my    = (t.clientY - r.top)  * scaleY;
      this._hitTestChangelog(mx, my);
    };
    canvas.el.addEventListener('touchend', this._handleTouchEnd, { passive: true });

    // Scroll wheel — normalize deltaMode so pixels/lines/pages all feel right
    this._handleWheel = (e) => {
      if (!this._changelogOpen) return;
      const LINE = 24, PAGE = 500;
      const delta = e.deltaMode === 2 ? e.deltaY * PAGE
                  : e.deltaMode === 1 ? e.deltaY * LINE
                  : e.deltaY;
      this._changelogScroll = Math.max(
        0,
        Math.min(this._changelogMaxScroll(), this._changelogScroll + delta * 0.6)
      );
    };
    canvas.el.addEventListener('wheel', this._handleWheel, { passive: true });
  }

  /** Max pixels the changelog can scroll before the last entry disappears. */
  _changelogMaxScroll() {
    const { renderer, canvas } = this;
    const { h: ph } = renderer.changelogPanelRect(canvas.width, canvas.height);
    const bodyH = ph - 48 - 12;
    return Math.max(0, renderer.changelogContentHeight(CHANGELOG) - bodyH);
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

  /** Spawn enemies for the given world, applying stat multipliers and skins. */
  _spawnEnemies(world) {
    const { enemyMult, enemySkin } = world;
    return LEVEL1.enemySpawns.map(s => {
      const e = new Enemy(s.col * TILE, (s.row - 1) * TILE, s.type);
      e.hp          = e.maxHp = Math.round(e.maxHp * enemyMult.hp);
      e.dmg         = Math.round(e.dmg   * enemyMult.dmg);
      e.exp         = Math.round(e.exp   * enemyMult.exp);
      e.patrolSpeed = e.patrolSpeed * enemyMult.spd;
      // Store scaled values so _respawn() re-applies them correctly
      e._baseStats  = { hp: e.hp, maxHp: e.maxHp, dmg: e.dmg, exp: e.exp, patrolSpeed: e.patrolSpeed };
      if (enemySkin) e.skin = enemySkin[s.type] ?? null;
      return e;
    });
  }

  /** Advance to the next world after the fade-out completes. */
  _loadNextWorld() {
    this._worldIdx = this._worldTransition.targetIdx;
    const world = WORLDS[this._worldIdx];
    // Move player back to spawn without resetting stats/gear/level
    const ps = LEVEL1.playerStart;
    this.player.x  = ps.col * TILE;
    this.player.y  = (ps.row - 1) * TILE;
    this.player.vx = 0;
    this.player.vy = 0;
    this.drops   = [];
    this.enemies = this._spawnEnemies(world);
  }

  update(dt) {
    const { player, enemies, tilemap, combat, camera, canvas } = this;

    // Resize camera if window changed
    camera.resize(canvas.width, canvas.height);

    // --- World transition timer ---
    if (this._worldTransition) {
      const tr = this._worldTransition;
      tr.t += dt;
      if (tr.t >= tr.duration) {
        if (tr.phase === 'fadeOut') {
          this._loadNextWorld();
          this._worldTransition = { phase: 'splash', t: 0, duration: 2.8, targetIdx: tr.targetIdx };
        } else if (tr.phase === 'splash') {
          this._worldTransition = { phase: 'fadeIn', t: 0, duration: 0.9, targetIdx: tr.targetIdx };
        } else {
          this._worldTransition = null;
        }
      }
      // Freeze gameplay during the splash screen only
      if (this._worldTransition?.phase === 'splash') return;
    }

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

    // --- Portal: advance to next world ---
    if (!player.dead && !this._worldTransition) {
      const portal = LEVEL1.portal;
      if (portal && overlaps(player, portal)) {
        const targetIdx = (this._worldIdx + 1) % WORLDS.length;
        this._worldTransition = { phase: 'fadeOut', t: 0, duration: 1.2, targetIdx };
      }
    }

    // --- Respawn ---
    if (player.dead) {
      this._deadTimer += dt;
      if (this._deadTimer > 2) this._respawn();
    }
  }

  _respawn() {
    this._deadTimer   = 0;
    this._worldIdx    = 0;  // send player back to World 1 on death
    this._worldTransition = null;
    this.drops = [];
    const ps = LEVEL1.playerStart;
    this.player  = new Player(ps.col * TILE, (ps.row - 1) * TILE);
    this.enemies = this._spawnEnemies(WORLDS[0]);
  }

  draw() {
    const { canvas, camera, tilemap, player, enemies, drops, combat, renderer } = this;
    const ctx   = canvas.ctx;
    const world = WORLDS[this._worldIdx];

    canvas.clear();

    // Background (world space)
    camera.apply(ctx);
    renderer.drawBackground(ctx, camera, tilemap.width, tilemap.height, world);
    tilemap.draw(ctx, camera, world.tiles);
    renderer.drawDecorations(ctx, LEVEL1.decorations);

    // Portal
    if (LEVEL1.portal && !this._worldTransition) {
      const { x, y, w, h } = LEVEL1.portal;
      renderer.drawPortal(ctx, x, y, w, h, world.portalColor);
    }

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

    // World transition overlay
    if (this._worldTransition) {
      const targetWorld = WORLDS[this._worldTransition.targetIdx];
      renderer.drawWorldTransition(ctx, canvas.width, canvas.height, this._worldTransition, targetWorld);
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
