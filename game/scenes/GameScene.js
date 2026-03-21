import { Camera }   from '../engine/Camera.js';
import { integrate, overlaps } from '../engine/Physics.js';
import { Tilemap, TILE } from '../systems/Tilemap.js';
import { Combat, FloatingText } from '../systems/Combat.js';
import { Renderer } from '../systems/Renderer.js';
import { Player, WEAPONS }   from '../entities/Player.js';
import { Enemy }    from '../entities/Enemy.js';
import { Drop }        from '../entities/Drop.js';
import { Projectile }  from '../entities/Projectile.js';
import { LEVEL1 }        from '../../assets/maps/level1.js';
import { generateLevel }  from '../../assets/maps/generator.js';
import { BOSS_ARENA }     from '../../assets/maps/bossArena.js';
import { TOWN }           from '../../assets/maps/town.js';
import { WORLDS }     from '../../assets/worlds.js';
import { CHANGELOG }  from '../../assets/changelog.js';
import { CLASSES }    from '../assets/classes.js';
import { Boss, BOSS_SHIELD_LEVEL } from '../entities/Boss.js';
import { Audio } from '../systems/Audio.js';

// Items available in the Mulletville shop
const SHOP_ITEMS = [
  { id: 'potion',     name: 'Health Potion', cost:  20, desc: 'Restores HP  (+1 potion)',   icon: '#f0abfc' },
  { id: 'maxhp',      name: 'HP Crystal',    cost:  80, desc: 'Max HP +50',                 icon: '#ff5555' },
  { id: 'atk',        name: 'Power Scroll',  cost: 120, desc: 'Attack +15',                 icon: '#ffd700' },
  { id: 'iron_sword', name: 'Iron Sword',    cost: 200, desc: 'Equip: +20 damage bonus',    icon: '#e8c84a' },
  { id: 'magic_wand', name: 'Magic Wand',    cost: 300, desc: 'Equip: +45 damage bonus',    icon: '#c084fc' },
];

export class GameScene {
  constructor(canvas, input) {
    this.canvas   = canvas;
    this.input    = input;
    this.combat   = new Combat();
    this.renderer = new Renderer();
    this.audio    = new Audio();

    // Both tilemaps pre-built; this.tilemap always points to the active one
    this._currentLevelData = LEVEL1;       // replaced each Tower entry
    this._runCount         = 0;
    this._tilemapLevel1    = new Tilemap(LEVEL1);
    this._tilemapTown      = new Tilemap(TOWN);
    this.tilemap           = this._tilemapLevel1;

    // State machine:  'classSelect' | 'town' | 'playing'
    this._state     = 'classSelect';
    this._classIdx  = 0;
    this._prevCsLeft    = false;
    this._prevCsRight   = false;
    this._prevCsConfirm = false;

    // World progression state
    this._worldIdx        = 0;
    this._worldTransition = null;

    // Player and enemies — created when class is selected
    this.player  = null;
    this.enemies = [];

    this.camera = new Camera(
      canvas.width, canvas.height,
      this.tilemap.width, this.tilemap.height
    );

    // Active drops in the world
    this.drops = [];

    // Boss fight state
    this._boss            = null;   // Boss instance, or null when not in boss fight
    this._bossProjectiles = [];     // { x, y, vx, vy, damage, life }  boulder shots
    this._bossMode        = false;  // true while in the boss arena
    this._bossMeleeCd     = 0;      // cooldown to avoid stacking boss melee hits
    this._bossHitThisSwing   = false; // prevent warrior swing from hitting boss every frame
    this._bossDieSoundPlayed = false;

    // Respawn timer
    this._deadTimer = 0;

    // Town / shop state
    this._shopOpen        = false;
    this._shopIdx         = 0;
    this._prevInteract    = false;   // edge-detect for E key in town
    this._prevShopUp      = false;
    this._prevShopDown    = false;
    this._prevShopConfirm = false;
    this._prevShopClose   = false;
    this._nearNPC         = false;

    // Changelog overlay state
    this._changelogOpen        = false;
    this._changelogScroll      = 0;
    this._touchScrollStartY    = 0;
    this._touchScrollStart     = 0;
    this._touchMoved           = false;

    // Click — dispatch to the active state's hit-tester
    this._handleClick = (e) => {
      const r      = canvas.el.getBoundingClientRect();
      const scaleX = canvas.width  / r.width;
      const scaleY = canvas.height / r.height;
      const mx     = (e.clientX - r.left) * scaleX;
      const my     = (e.clientY - r.top)  * scaleY;
      if (this._state === 'classSelect') {
        this._hitTestClassSelect(mx, my);
      } else if (this._state === 'town') {
        this._hitTestTown(mx, my);
      } else {
        this._hitTestPlayingHUD(mx, my);
      }
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

    // Touch end — treat as tap only if finger barely moved
    this._handleTouchEnd = (e) => {
      if (this._touchMoved) { this._touchMoved = false; return; }
      const r      = canvas.el.getBoundingClientRect();
      const scaleX = canvas.width  / r.width;
      const scaleY = canvas.height / r.height;
      const t      = e.changedTouches[0];
      const mx     = (t.clientX - r.left) * scaleX;
      const my     = (t.clientY - r.top)  * scaleY;
      if (this._state === 'classSelect') {
        this._hitTestClassSelect(mx, my);
      } else if (this._state === 'town') {
        this._hitTestTown(mx, my);
      } else {
        this._hitTestPlayingHUD(mx, my);
      }
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
  /** Hit-test clicks on the playing-state HUD (changelog + return-to-town). */
  _hitTestPlayingHUD(mx, my) {
    const { canvas, renderer } = this;

    // Return-to-town button (only when not dead)
    if (this.player && !this.player.dead && !this._changelogOpen) {
      const townBtn = renderer.returnToTownBtnRect(canvas.width, canvas.height);
      if (mx >= townBtn.x && mx <= townBtn.x + townBtn.w &&
          my >= townBtn.y && my <= townBtn.y + townBtn.h) {
        this._returnToTown();
        return;
      }
    }

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
    if (mx < panel.x || mx > panel.x + panel.w || my < panel.y || my > panel.y + panel.h) {
      this._changelogOpen = false;
    }
  }

  /** Hit-test clicks in the town (shop overlay + NPC tap to open). */
  _hitTestTown(mx, my) {
    const { canvas, renderer } = this;

    // ── Shop closed: check tap on NPC (world-space, with generous hit area) ──
    if (!this._shopOpen) {
      const npc    = TOWN.shopNPC;
      const worldX = mx + this.camera.x;
      const worldY = my + this.camera.y;
      const pad    = 28; // extra finger-friendly padding
      if (worldX >= npc.x - pad && worldX <= npc.x + npc.w + pad &&
          worldY >= npc.y - pad && worldY <= npc.y + npc.h + pad) {
        this._shopOpen = true;
        this._shopIdx  = 0;
      }
      return;
    }

    // ── Shop open ────────────────────────────────────────────────────────────

    // Close [X] button
    const p     = renderer.shopPanelRect(canvas.width, canvas.height);
    const xBtnX = p.x + p.w - 28;
    const xBtnY = p.y + 8;
    const xBtnS = 24;
    if (mx >= xBtnX && mx <= xBtnX + xBtnS && my >= xBtnY && my <= xBtnY + xBtnS) {
      this._shopOpen = false;
      return;
    }

    // Click outside panel closes it
    if (mx < p.x || mx > p.x + p.w || my < p.y || my > p.y + p.h) {
      this._shopOpen = false;
      return;
    }

    // Item rows — first tap selects, second tap buys
    const rects = renderer.shopItemRects(canvas.width, canvas.height, SHOP_ITEMS.length);
    for (let i = 0; i < rects.length; i++) {
      const r = rects[i];
      if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) {
        if (i === this._shopIdx) {
          this._buyShopItem(SHOP_ITEMS[i]);
        } else {
          this._shopIdx = i;
        }
        return;
      }
    }
  }

  /** Hit-test taps/clicks on the class selection screen. */
  _hitTestClassSelect(mx, my) {
    const { canvas, renderer } = this;
    const rects   = renderer.classSelectCardRects(canvas.width, canvas.height, CLASSES.length);
    for (let i = 0; i < rects.length; i++) {
      const r = rects[i];
      if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) {
        if (i === this._classIdx) {
          this._startGame(CLASSES[i]);  // second tap on selected card confirms
        } else {
          this._classIdx = i;           // first tap selects
        }
        return;
      }
    }
    const btn = renderer.classSelectPlayBtn(canvas.width, canvas.height);
    if (mx >= btn.x && mx <= btn.x + btn.w && my >= btn.y && my <= btn.y + btn.h) {
      this._startGame(CLASSES[this._classIdx]);
    }
  }

  /** Begin the game with the chosen class — spawn the player in Mulletville. */
  _startGame(cls) {
    this._worldIdx        = 0;
    this._worldTransition = null;
    this.drops            = [];
    this.projectiles      = [];
    this.lightningEffects = [];
    this.enemies          = [];
    this._deadTimer       = 0;
    this._shopOpen        = false;
    this._shopIdx         = 0;
    this._switchToMap(this._tilemapTown);
    const ps     = TOWN.playerStart;
    this.player  = new Player(ps.col * TILE, (ps.row - 1) * TILE, cls);
    this._state  = 'town';
  }

  /** Switch the active tilemap and update camera world bounds. */
  _switchToMap(tm) {
    this.tilemap       = tm;
    this.camera.worldW = tm.width;
    this.camera.worldH = tm.height;
    this.camera.x      = 0;
    this.camera.y      = 0;
  }

  /** Player enters a town portal → generate and load a fresh combat map. */
  _enterCombatFromPortal(portalId) {
    if (portalId !== 'tower') return;   // only The Tower is implemented
    this._runCount++;
    this._currentLevelData = generateLevel((Date.now() >>> 0) ^ (this._runCount * 0x9e3779b9));
    this._tilemapLevel1    = new Tilemap(this._currentLevelData);
    this._switchToMap(this._tilemapLevel1);
    this._worldIdx        = 0;
    this._worldTransition = null;
    this.drops            = [];
    this.projectiles      = [];
    this.lightningEffects = [];
    this.enemies          = this._spawnEnemies(WORLDS[0]);
    this._boss            = null;
    this._bossProjectiles = [];
    this._bossMode        = false;
    const ps = this._currentLevelData.playerStart;
    this.player.x  = ps.col * TILE;
    this.player.y  = (ps.row - 1) * TILE;
    this.player.vx = 0;
    this.player.vy = 0;
    this._state = 'playing';
  }

  /** Return to Mulletville from combat (keeps stats / gold / level). */
  _returnToTown() {
    this._switchToMap(this._tilemapTown);
    this._worldIdx        = 0;
    this._worldTransition = null;
    this.drops            = [];
    this.projectiles      = [];
    this.lightningEffects = [];
    this.enemies          = [];
    this._boss            = null;
    this._bossProjectiles = [];
    this._bossMode        = false;
    this._shopOpen        = false;
    const ps = TOWN.playerStart;
    this.player.x  = ps.col * TILE;
    this.player.y  = (ps.row - 1) * TILE;
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.hp = Math.min(this.player.hp, this.player.maxHp);
    this._state = 'town';
  }

  /** Attempt to purchase a shop item; returns true on success. */
  _buyShopItem(item) {
    const p = this.player;
    if (!p || p.gold < item.cost) return false;

    switch (item.id) {
      case 'potion':
        if (p.potions >= p.maxPotions) return false;
        p.potions = Math.min(p.maxPotions, p.potions + 1);
        break;
      case 'maxhp':
        p.maxHp += 50;
        p.hp    += 50;
        break;
      case 'atk':
        p.attackDamage += 15;
        break;
      case 'iron_sword':
        p.weapon = WEAPONS['iron_sword'];
        break;
      case 'magic_wand':
        p.weapon = WEAPONS['magic_wand'];
        break;
      default:
        return false;
    }
    p.gold -= item.cost;
    return true;
  }

  /** Spawn enemies for the given world, applying stat multipliers and skins. */
  _spawnEnemies(world) {
    const { enemyMult, enemySkin } = world;
    return this._currentLevelData.enemySpawns.map(s => {
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

  // ── Boss fight helpers ────────────────────────────────────────────────────

  /** Play hurt or die sound on boss after a takeDamage() call. */
  _playBossHitSound(boss) {
    if (boss.dead && !this._bossDieSoundPlayed) {
      this._bossDieSoundPlayed = true;
      this.audio.bossDie();
    } else if (!boss.dead) {
      this.audio.bossHurt();
    }
  }

  /** Floating damage number above the boss (colour-coded for shield state). */
  _spawnBossDmgText(boss, dmg, shielded) {
    const color = shielded ? '#888888' : '#ff4';
    const text  = shielded ? `-${dmg} ⬡` : `-${dmg}`;
    this.combat.floatingTexts.push(
      new FloatingText(boss.x + boss.w / 2, boss.y - 12, text, color)
    );
  }

  /**
   * All boss AI / physics / combat resolution for one frame.
   * Called from the main update() loop when this._boss is set.
   */
  _updateBoss(dt, player) {
    const boss = this._boss;

    // ── Update boss AI ───────────────────────────────────────────────────────
    boss.shieldActive = player.level < BOSS_SHIELD_LEVEL;
    const _prevPhaseMsg = boss.phaseMessage;
    boss.update(dt, player);
    if (!_prevPhaseMsg && boss.phaseMessage) this.audio.bossPhase();

    if (!boss.dead) {
      // Physics (same pipeline as enemies)
      integrate(boss, dt);
      this.tilemap.resolveEntity(boss);
      // Keep boss inside arena walls
      boss.x = Math.max(0, Math.min(boss.x, this.tilemap.width - boss.w));
    }

    // ── Drain pending minion spawns ──────────────────────────────────────────
    if (boss.pendingMinions.length) {
      const world = WORLDS[2]; // Perion stats for minions
      for (const s of boss.pendingMinions) {
        const e = new Enemy(s.x, s.y, s.type);
        e.hp = e.maxHp = Math.round(e.maxHp * world.enemyMult.hp);
        e.dmg         = Math.round(e.dmg         * world.enemyMult.dmg);
        e.exp         = Math.round(e.exp         * world.enemyMult.exp);
        e.patrolSpeed = e.patrolSpeed * world.enemyMult.spd;
        e._baseStats  = { hp: e.hp, maxHp: e.maxHp, dmg: e.dmg, exp: e.exp, patrolSpeed: e.patrolSpeed };
        e.skin        = world.enemySkin?.slime ?? null;
        e._bossMinion = true;
        this.enemies.push(e);
      }
      boss.pendingMinions = [];
    }

    // ── Drain pending boulder projectiles ────────────────────────────────────
    if (boss.pendingProjectiles.length) {
      for (const bp of boss.pendingProjectiles) this._bossProjectiles.push(bp);
      boss.pendingProjectiles = [];
    }

    // ── Update boulder projectiles ───────────────────────────────────────────
    for (let i = this._bossProjectiles.length - 1; i >= 0; i--) {
      const bp = this._bossProjectiles[i];
      bp.life -= dt;
      bp.x    += bp.vx * dt;
      bp.y    += bp.vy * dt;
      bp.vy   += 900 * dt; // gentle gravity so boulders arc downward
      if (bp.life <= 0 || bp.y > this.tilemap.height + 100) {
        this._bossProjectiles.splice(i, 1);
        continue;
      }
      // Player collision
      const bpRect = { x: bp.x, y: bp.y, w: 24, h: 24 };
      if (!player.dead && overlaps(player, bpRect)) {
        player.takeDamage(bp.damage);
        if (player.hp > 0) {
          this.combat.floatingTexts.push(
            new FloatingText(player.x + player.w / 2, player.y - 20, `-${bp.damage}`, '#f44')
          );
        }
        this._bossProjectiles.splice(i, 1);
      }
    }

    // ── Boss melee damage to player ──────────────────────────────────────────
    this._bossMeleeCd = Math.max(0, this._bossMeleeCd - dt);
    if (!boss.dead && !player.dead && this._bossMeleeCd <= 0) {
      const isAttacking = boss._state === 'attack';
      const isCharging  = boss._state === 'charge' && boss._chargePhase === 'dash';
      if ((isAttacking || isCharging) && overlaps(player, boss)) {
        const dmg = isCharging ? boss.chargeDmg : boss.meleeDmg;
        player.takeDamage(dmg);
        if (player.hp > 0) {
          this.combat.floatingTexts.push(
            new FloatingText(player.x + player.w / 2, player.y - 20, `-${dmg}`, '#f44')
          );
        }
        this._bossMeleeCd = 0.9; // prevent rapid stacking
      }
    }

    // ── Shockwave damage to player (slam impact) ─────────────────────────────
    if (boss.shockwaveActive && !player.dead) {
      const dx = Math.abs((player.x + player.w / 2) - (boss.x + boss.w / 2));
      if (dx < 340 && player.onGround && this._bossMeleeCd <= 0) {
        player.takeDamage(boss.shockwaveDamage);
        if (player.hp > 0) {
          this.combat.floatingTexts.push(
            new FloatingText(player.x + player.w / 2, player.y - 20,
              `-${boss.shockwaveDamage}`, '#f44')
          );
        }
        this._bossMeleeCd = 0.6;
      }
    }

    // ── Player attacks boss ──────────────────────────────────────────────────
    if (!boss.dead) {
      const cls = player.playerClass?.id;

      // Warrior melee (one hit per swing — reset flag when swing ends)
      if (!cls || cls === 'warrior') {
        const atk = player.getAttackBox();
        if (!atk) {
          this._bossHitThisSwing = false; // swing ended, allow next swing to hit
        } else if (atk && overlaps(atk, boss) && !this._bossHitThisSwing) {
          this._bossHitThisSwing = true;
          const raw = player.attackDamage;
          const dmg = boss.shieldActive ? Math.max(1, Math.round(raw * 0.10)) : raw;
          boss.takeDamage(dmg);
          this._spawnBossDmgText(boss, dmg, boss.shieldActive);
          this._playBossHitSound(boss);
        }
      }

      // Projectile hits (thief star / bowman arrow)
      for (let i = this.projectiles.length - 1; i >= 0; i--) {
        const proj = this.projectiles[i];
        if (!proj.hit && overlaps(proj, boss)) {
          proj.hit = true;
          const raw = proj.damage ?? player.attackDamage;
          const dmg = boss.shieldActive ? Math.max(1, Math.round(raw * 0.10)) : raw;
          boss.takeDamage(dmg);
          this._spawnBossDmgText(boss, dmg, boss.shieldActive);
          this._playBossHitSound(boss);
        }
      }
    }

    // ── Boss death: spawn rewards and portal ─────────────────────────────────
    if (boss.dead && boss.deadTimer > 2.2 && !this._currentLevelData.portal) {
      // Grant massive XP directly
      player.gainExp(600);
      this.combat.floatingTexts.push(
        new FloatingText(boss.x + boss.w / 2, boss.y - 40, '+600 EXP', '#4ef')
      );

      // Drop a gold pile and magic wand near boss centre
      const bx = boss.x + boss.w / 2 - 16;
      const by = boss.y;
      this.drops.push(new Drop(bx,      by, 'coin',   { valueMin: 500, valueMax: 500 }));
      this.drops.push(new Drop(bx + 40, by, 'weapon', { weaponId: 'magic_wand' }));

      // Kill all boss-summoned minions
      for (const e of this.enemies) {
        if (e._bossMinion) { e.hp = 0; e.dead = true; }
      }

      // Activate escape portal (centred in arena, at ground level)
      this._currentLevelData.portal = {
        x: 11 * TILE, y: 7 * TILE, w: 6 * TILE, h: 4 * TILE,
      };
    }
  }

  /** Find nearest enemy (or boss) and fire an instant lightning bolt at it. */
  _spawnLightning(player, enemies) {
    const RANGE = 340;
    let nearest = null, nearestDist = Infinity;
    // Include boss as a valid target
    const targets = (this._boss && !this._boss.dead)
      ? [...enemies, this._boss]
      : enemies;
    for (const e of targets) {
      if (e.dead) continue;
      const dx = (e.x + e.w / 2) - (player.x + player.w / 2);
      const dy = (e.y + e.h / 2) - (player.y + player.h / 2);
      const d  = Math.sqrt(dx * dx + dy * dy);
      if (d < RANGE && d < nearestDist) { nearest = e; nearestDist = d; }
    }
    const sx = player.x + player.w / 2;
    const sy = player.y + player.h * 0.25;
    const tx = nearest ? nearest.x + nearest.w / 2 : sx + player.facing * 200;
    const ty = nearest ? nearest.y + nearest.h / 2 : sy + 80;
    const bolt = {
      x1: sx, y1: sy, x2: tx, y2: ty,
      life: 0.45, maxLife: 0.45,
      targetEnemy: nearest,
      branches: this._makeLightningPath(sx, sy, tx, ty),
      damage: player.attackDamage,
    };
    this.lightningEffects.push(bolt);
    if (nearest === this._boss) {
      // Boss is the lightning target — apply shield-adjusted damage directly
      if (nearest && !nearest.dead) {
        const raw = bolt.damage;
        const dmg = nearest.shieldActive ? Math.max(1, Math.round(raw * 0.10)) : raw;
        nearest.takeDamage(dmg);
        this._spawnBossDmgText(nearest, dmg, nearest.shieldActive);
        this._playBossHitSound(nearest);
      }
    } else if (nearest) {
      this.combat.resolveLightning(bolt, player);
    }
  }

  _makeLightningPath(x1, y1, x2, y2) {
    const SEGS = 7;
    const pts  = [{ x: x1, y: y1 }];
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const px  = -dy / len, py = dx / len;   // perpendicular unit vector
    for (let i = 1; i < SEGS; i++) {
      const t = i / SEGS;
      const jitter = (Math.random() - 0.5) * Math.min(len * 0.40, 65);
      pts.push({ x: x1 + dx * t + px * jitter, y: y1 + dy * t + py * jitter });
    }
    pts.push({ x: x2, y: y2 });
    return pts;
  }

  /** Advance to the next world after the fade-out completes. */
  _loadNextWorld() {
    // Boss fight (targetIdx === -1) — handled separately
    if (this._worldTransition.targetIdx === -1) {
      this._enterBossArena();
      return;
    }

    this._worldIdx = this._worldTransition.targetIdx;
    const world = WORLDS[this._worldIdx];
    // Move player back to spawn without resetting stats/gear/level
    const ps = this._currentLevelData.playerStart;
    this.player.x  = ps.col * TILE;
    this.player.y  = (ps.row - 1) * TILE;
    this.player.vx = 0;
    this.player.vy = 0;
    this.drops            = [];
    this.projectiles      = [];
    this.lightningEffects = [];
    this.enemies          = this._spawnEnemies(world);
  }

  /** Load the boss arena and spawn the boss. */
  _enterBossArena() {
    // Clone the arena data so we can mutate portal without touching the original
    this._currentLevelData = {
      ...BOSS_ARENA,
      portal:       null,        // portal spawns only after boss dies
      decorations:  BOSS_ARENA.decorations,
      enemySpawns:  [],
    };
    this._tilemapLevel1 = new Tilemap(this._currentLevelData);
    this._switchToMap(this._tilemapLevel1);
    this._worldIdx = 2;           // reuse Perion palette for rendering
    this._bossMode = true;

    this.drops            = [];
    this.projectiles      = [];
    this.lightningEffects = [];
    this.enemies          = [];
    this._bossProjectiles = [];
    this._bossMeleeCd        = 0;
    this._bossHitThisSwing   = false;
    this._bossDieSoundPlayed = false;

    // Spawn boss at centre-arena ground level
    this._boss = new Boss(12 * TILE, 8 * TILE);

    // Move player to arena start
    const ps = this._currentLevelData.playerStart;
    this.player.x  = ps.col * TILE;
    this.player.y  = (ps.row - 1) * TILE;
    this.player.vx = 0;
    this.player.vy = 0;
  }

  update(dt) {
    const { camera, canvas } = this;

    // Resize camera if window changed
    camera.resize(canvas.width, canvas.height);

    // ── Class selection input ─────────────────────────────────────────────────
    if (this._state === 'classSelect') {
      const kLeft    = this.input.isLeft();
      const kRight   = this.input.isRight();
      const kConfirm = this.input.isJump() || this.input.isAttack()
                     || this.input.keys['Enter'] || this.input.keys['Space'];

      if (kLeft  && !this._prevCsLeft)    this._classIdx = (this._classIdx - 1 + CLASSES.length) % CLASSES.length;
      if (kRight && !this._prevCsRight)   this._classIdx = (this._classIdx + 1) % CLASSES.length;
      if (kConfirm && !this._prevCsConfirm) this._startGame(CLASSES[this._classIdx]);

      this._prevCsLeft    = kLeft;
      this._prevCsRight   = kRight;
      this._prevCsConfirm = kConfirm;
      return;
    }

    // ── Town update ───────────────────────────────────────────────────────────
    if (this._state === 'town') {
      this._updateTown(dt);
      return;
    }

    const { player, enemies, tilemap, combat } = this;

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
    const _wasOnGround = player.onGround;
    player.update(dt, this.input);
    integrate(player, dt);
    tilemap.resolveEntity(player);
    player.postPhysics();
    if (!_wasOnGround && player.onGround) this.audio.land();

    // Drain player sound signals
    for (const s of player.pendingSounds) {
      if      (s === 'jump')         this.audio.jump();
      else if (s === 'doubleJump')   this.audio.doubleJump();
      else if (s === 'playerHurt')   this.audio.playerHurt();
      else if (s === 'potion')       this.audio.potion();
      else if (s === 'coinPickup')   this.audio.coinPickup();
      else if (s === 'potionPickup') this.audio.potionPickup();
      else if (s === 'itemPickup')   this.audio.itemPickup();
      else if (s === 'levelUp')      this.audio.levelUp();
    }
    player.pendingSounds.length = 0;

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

    // --- Boss update (physics, AI, combat) ---
    if (this._boss) {
      this._updateBoss(dt, player);
    }

    // --- Combat ---
    const cls = player.playerClass?.id;

    // Warrior uses melee hitbox; other classes rely on projectiles / lightning
    if (!cls || cls === 'warrior') combat.resolvePlayerAttack(player, enemies);
    combat.resolveEnemyAttack(player, enemies);
    combat.update(dt);

    // Drain combat sound signals
    for (const s of combat.pendingSounds) {
      if      (s === 'hitEnemy')  this.audio.hitEnemy();
      else if (s === 'enemyDie')  this.audio.enemyDie();
    }
    combat.pendingSounds.length = 0;

    // --- Class-specific attack spawning (rising-edge of attack input) ---
    if (player._attackJustStarted) {
      player._attackJustStarted = false;
      this.audio.swing(cls);
      const ox = player.facing === 1 ? player.x + player.w : player.x;
      if (cls === 'thief') {
        this.projectiles.push(
          new Projectile(ox - 7, player.y + player.h * 0.35 - 7, player.facing * 700, 0, 'star', player.attackDamage)
        );
      } else if (cls === 'bowman') {
        this.projectiles.push(
          new Projectile(ox - 11, player.y + player.h * 0.28 - 3, player.facing * 560, 0, 'arrow', player.attackDamage)
        );
      } else if (cls === 'mage') {
        this._spawnLightning(player, enemies);
      }
    }

    // --- Projectile movement + collision ---
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      proj.life -= dt;
      proj.x    += proj.vx * dt;
      proj.y    += proj.vy * dt;
      if (proj.type === 'star') proj.angle += dt * Math.PI * 9;
      const outOfBounds = proj.x < -120 || proj.x > tilemap.width + 120;
      if (proj.life <= 0 || outOfBounds || proj.hit) { this.projectiles.splice(i, 1); continue; }
      combat.resolveProjectile(proj, enemies, player);
      if (proj.hit) this.projectiles.splice(i, 1);
    }

    // --- Lightning effect timers ---
    for (let i = this.lightningEffects.length - 1; i >= 0; i--) {
      this.lightningEffects[i].life -= dt;
      if (this.lightningEffects[i].life <= 0) this.lightningEffects.splice(i, 1);
    }

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

    // --- Portal: advance to next world (or exit boss arena) ---
    if (!player.dead && !this._worldTransition) {
      const portal = this._currentLevelData.portal;
      if (portal && overlaps(player, portal)) {
        this.audio.portal();
        if (this._bossMode) {
          // Boss arena exit → return to town
          this._bossMode = false;
          this._boss     = null;
          this._bossProjectiles = [];
          this._returnToTown();
        } else if (this._worldIdx === WORLDS.length - 1) {
          // Completed last world → boss fight!
          this._worldTransition = { phase: 'fadeOut', t: 0, duration: 1.2, targetIdx: -1 };
        } else {
          const targetIdx = this._worldIdx + 1;
          this._worldTransition = { phase: 'fadeOut', t: 0, duration: 1.2, targetIdx };
        }
      }
    }

    // --- Respawn ---
    if (player.dead) {
      this._deadTimer += dt;
      if (this._deadTimer > 2) this._respawn();
    }
  }

  // ── Town update ─────────────────────────────────────────────────────────────

  _updateTown(dt) {
    const { player, tilemap, camera } = this;

    // ── Shop keyboard navigation (freezes player movement while open) ─────────
    if (this._shopOpen) {
      const kUp      = this.input.isJump() || this.input.keys['ArrowUp']   || this.input.keys['KeyW'];
      const kDown    = this.input.keys['ArrowDown'] || this.input.keys['KeyS'];
      const kConfirm = this.input.isUsePotion() || this.input.keys['Enter'];
      const kClose   = this.input.keys['Escape'];

      if (kUp    && !this._prevShopUp)      this._shopIdx = (this._shopIdx - 1 + SHOP_ITEMS.length) % SHOP_ITEMS.length;
      if (kDown  && !this._prevShopDown)    this._shopIdx = (this._shopIdx + 1) % SHOP_ITEMS.length;
      if (kConfirm && !this._prevShopConfirm) this._buyShopItem(SHOP_ITEMS[this._shopIdx]);
      if (kClose && !this._prevShopClose)   this._shopOpen = false;

      this._prevShopUp      = kUp;
      this._prevShopDown    = kDown;
      this._prevShopConfirm = kConfirm;
      this._prevShopClose   = kClose;
      this._prevInteract    = this.input.isUsePotion(); // keep in sync while shop is open
      // Still update camera but skip movement
      camera.follow(player);
      return;
    }

    // ── Player movement (no combat in town) ───────────────────────────────────
    player.update(dt, this.input);
    player._attackJustStarted = false; // no projectiles / lightning in town
    integrate(player, dt);
    tilemap.resolveEntity(player);
    player.postPhysics();
    player.x = Math.max(0, Math.min(player.x, tilemap.width - player.w));
    if (player.y > tilemap.height) {
      // Fell off world edge — teleport back to spawn
      const ps = TOWN.playerStart;
      player.x = ps.col * TILE;
      player.y = (ps.row - 1) * TILE;
      player.vx = 0;
      player.vy = 0;
    }

    // ── Camera ────────────────────────────────────────────────────────────────
    camera.follow(player);

    // ── Portal detection ─────────────────────────────────────────────────────
    for (const portal of TOWN.portals) {
      if (portal.disabled) continue;
      if (overlaps(player, portal)) {
        this._enterCombatFromPortal(portal.id);
        return;
      }
    }

    // ── NPC proximity ─────────────────────────────────────────────────────────
    const npc      = TOWN.shopNPC;
    const playerCx = player.x + player.w / 2;
    const npcCx    = npc.x + npc.w / 2;
    this._nearNPC  = Math.abs(playerCx - npcCx) < npc.interactRange;

    const kInteract = this.input.isUsePotion();
    if (this._nearNPC && kInteract && !this._prevInteract) {
      this._shopOpen = !this._shopOpen;
      if (this._shopOpen) this._shopIdx = 0;
    }
    this._prevInteract = kInteract;
  }

  _respawn() {
    this._deadTimer       = 0;
    this._worldIdx        = 0;
    this._worldTransition = null;
    this.drops            = [];
    this.projectiles      = [];
    this.lightningEffects = [];
    this.player           = null;
    this.enemies          = [];
    this._boss            = null;
    this._bossProjectiles = [];
    this._bossMode        = false;
    this._shopOpen        = false;
    this._switchToMap(this._tilemapLevel1); // reset for next run
    // Return to class select; _classIdx stays so the last-used class is pre-highlighted
    this._state           = 'classSelect';
    this._prevCsLeft    = false;
    this._prevCsRight   = false;
    this._prevCsConfirm = false;
  }

  // ── Town draw ────────────────────────────────────────────────────────────────

  _drawTown() {
    const { canvas, renderer, camera, tilemap, player } = this;
    const ctx   = canvas.ctx;
    const world = WORLDS[0]; // town uses Henesys Outskirts palette

    // World space
    camera.apply(ctx);
    renderer.drawBackground(ctx, camera, tilemap.width, tilemap.height, world);
    tilemap.draw(ctx, camera, world.tiles);
    renderer.drawDecorations(ctx, TOWN.decorations);

    // Town portals (arch style)
    for (const portal of TOWN.portals) {
      renderer.drawTownPortal(ctx, portal);
    }

    // Shop NPC
    const npc = TOWN.shopNPC;
    renderer.drawShopNPC(ctx, npc.x, npc.y, this._nearNPC && !this._shopOpen);

    // Player
    renderer.drawPlayer(ctx, player);

    camera.restore(ctx);

    // HUD (shows HP, gold, potions etc.)
    renderer.drawHUD(ctx, player, canvas.width, canvas.height);
    renderer.drawMobileControls(ctx, canvas.width, canvas.height);

    // Town label (screen space)
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.font         = 'bold 14px monospace';
    ctx.fillStyle    = '#c89a30';
    ctx.shadowColor  = '#c89a30';
    ctx.shadowBlur   = 8;
    ctx.fillText('✦  MULLETVILLE  ✦', canvas.width / 2, 20);
    ctx.shadowBlur   = 0;
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign    = 'left';

    // Shop overlay
    if (this._shopOpen) {
      renderer.drawShopOverlay(ctx, canvas.width, canvas.height, SHOP_ITEMS, this._shopIdx, player.gold);
    }
  }

  draw() {
    const { canvas, renderer } = this;
    const ctx = canvas.ctx;

    canvas.clear();

    // ── Class selection screen ────────────────────────────────────────────────
    if (this._state === 'classSelect') {
      renderer.drawClassSelect(ctx, canvas.width, canvas.height, CLASSES, this._classIdx);
      return;
    }

    // ── Town screen ───────────────────────────────────────────────────────────
    if (this._state === 'town') {
      this._drawTown();
      return;
    }

    const { camera, tilemap, player, enemies, drops, combat } = this;
    const world = WORLDS[this._worldIdx];

    // Background (world space)
    camera.apply(ctx);
    renderer.drawBackground(ctx, camera, tilemap.width, tilemap.height, world);
    tilemap.draw(ctx, camera, world.tiles);
    renderer.drawDecorations(ctx, this._currentLevelData.decorations);

    // Portal
    if (this._currentLevelData.portal && !this._worldTransition) {
      const { x, y, w, h } = this._currentLevelData.portal;
      renderer.drawPortal(ctx, x, y, w, h, world.portalColor);
    }

    // Enemies
    for (const e of enemies) renderer.drawEnemy(ctx, e);

    // Boss (drawn with enemies, behind the player)
    if (this._boss) {
      renderer.drawBossShockwave(ctx, this._boss);
      renderer.drawBossProjectiles(ctx, this._bossProjectiles);
      renderer.drawBoss(ctx, this._boss);
    }

    // Drops (below player so they don't obscure combat)
    renderer.drawDrops(ctx, drops);

    // Projectiles (in front of enemies, behind player)
    renderer.drawProjectiles(ctx, this.projectiles);

    // Player
    renderer.drawPlayer(ctx, player);
    renderer.drawFireworks(ctx);

    // Lightning (on top of everything in world space)
    renderer.drawLightning(ctx, this.lightningEffects);

    // Floating damage numbers (world space)
    combat.draw(ctx);

    camera.restore(ctx);

    // HUD (screen space)
    renderer.drawHUD(ctx, player, canvas.width, canvas.height);
    renderer.drawMobileControls(ctx, canvas.width, canvas.height);
    renderer.drawReturnToTownButton(ctx, canvas.width, canvas.height);
    renderer.drawChangelogButton(ctx, canvas.width, canvas.height, this._changelogOpen);

    // Boss HUD (overlaid on top of normal HUD)
    if (this._boss) {
      renderer.drawBossHPBar(ctx, this._boss, canvas.width, canvas.height);
      renderer.drawBossPhaseMessage(ctx, this._boss.phaseMessage, canvas.width, canvas.height);
    }
    if (this._changelogOpen) {
      renderer.drawChangelogOverlay(ctx, canvas.width, canvas.height, CHANGELOG, this._changelogScroll);
    }

    // World transition overlay
    if (this._worldTransition) {
      // targetIdx === -1 means boss intro (pass null so renderer shows boss splash)
      const targetWorld = this._worldTransition.targetIdx >= 0
        ? WORLDS[this._worldTransition.targetIdx]
        : null;
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
