/**
 * Pixel-art sprite renderer — procedural canvas drawing, no external assets.
 * Sprites use S=4 px "pixel scale" for a chunky retro look.
 *
 * Coordinate convention for entity sprites:
 *   Origin (0,0) = top-left of bounding box.
 *   Sprites are designed facing RIGHT; the ctx is pre-scaled by (facing, 1).
 */

const S = 4; // logical pixel → screen pixel scale

// ── Colour palette ────────────────────────────────────────────────────────────
const C = {
  // Player
  hairD:  '#4a7a00', hairM:  '#7cb342', hairL: '#c5e1a5',
  skin:   '#ffcc80', skinD:  '#c8956a',
  eye:    '#111122',
  shirtD: '#b71c1c', shirtM: '#e53935',
  pantsD: '#1a237e', pantsM: '#3949ab',
  bootD:  '#3e2723', bootM:  '#6d4c41',
  belt:   '#212121',
  // Slime
  slimeD: '#006064', slimeM: '#00acc1', slimeL: '#80deea',
  // Mushroom
  capD:   '#bf360c', capM:   '#f4511e', capL:  '#ff8a65',
  stemM:  '#fff9c4', stemD:  '#f9a825',
  spot:   '#fffde7',
};

/** Fill one logical pixel cell at grid position (col, row). */
function p(ctx, col, row, cols = 1, rows = 1) {
  ctx.fillRect(col * S, row * S, cols * S, rows * S);
}

// ─────────────────────────────────────────────────────────────────────────────
export class Renderer {
  constructor() {
    this._attackParticles = [];
    this._lastTime        = Date.now();
    this._wasAttacking    = false;
    this._dt              = 0;
    this._fireworkQueue   = []; // pending burst { x, y, fireAt, colors }
    this._fireworks       = []; // active sparkle particles
  }

  drawPlayer(ctx, player) {
    const { x, y, w, h, facing, state, invincible, attackTimer, weapon, playerClass } = player;

    const now = Date.now();
    const dt  = Math.min((now - this._lastTime) / 1000, 0.05);
    this._lastTime = now;
    this._dt = dt;

    // Class + weapon-aware colours for arc and particles
    const clsId = playerClass?.id ?? 'warrior';
    const CLASS_WEAPON_COLORS = { warrior: '#ef4444', mage: '#818cf8', thief: '#4ade80', bowman: '#fb923c' };
    const weaponColor = clsId === 'warrior'
      ? '#ef4444'
      : (weapon?.color ?? CLASS_WEAPON_COLORS[clsId] ?? '#a78bfa');

    const CLASS_PARTICLES = {
      warrior: ['#ef4444', '#f97316', '#fbbf24', '#ffffff', '#fca5a5'],
      mage:    ['#818cf8', '#a5f3fc', '#c084fc', '#e879f9', '#ffffff'],
      thief:   ['#4ade80', '#22d3ee', '#a3e635', '#ffffff', '#bbf7d0'],
      bowman:  ['#fb923c', '#fbbf24', '#84cc16', '#ffffff', '#fed7aa'],
    };
    const WEAPON_PARTICLES = {
      iron_sword: ['#e8c84a', '#ffd700', '#fff9a0', '#fbbf24', '#ffffff'],
      magic_wand: ['#c084fc', '#e879f9', '#818cf8', '#a5f3fc', '#ffffff'],
    };
    const particleColors = WEAPON_PARTICLES[weapon?.id] ?? CLASS_PARTICLES[clsId] ?? ['#a78bfa', '#c4b5fd', '#7dd3fc', '#f0abfc', '#ffffff'];

    // ── Spawn attack particles on rising edge (warrior + mage only) ──────────
    const isAttacking = state === 'attack';
    const spawnParticles = clsId !== 'thief' && clsId !== 'bowman';
    if (isAttacking && !this._wasAttacking && spawnParticles) {
      const cx = x + (facing === 1 ? w + 10 : -10);
      const cy = y + h * 0.35;
      const COLORS = particleColors;
      for (let i = 0; i < 16; i++) {
        const baseAngle = facing === 1 ? 0 : Math.PI;
        const angle     = baseAngle + (Math.random() - 0.5) * 2.2;
        const speed     = 80 + Math.random() * 160;
        this._attackParticles.push({
          x:     cx + (Math.random() - 0.5) * 28,
          y:     cy + (Math.random() - 0.5) * 30,
          vx:    Math.cos(angle) * speed,
          vy:    Math.sin(angle) * speed - 40,
          life:  1.0,
          decay: 1.5 + Math.random() * 2.0,
          size:  2 + Math.random() * 5,
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
        });
      }
    }
    this._wasAttacking = isAttacking;

    // ── Update & draw particles (world space) ────────────────────────────────
    if (this._attackParticles.length > 0) {
      ctx.save();
      for (let i = this._attackParticles.length - 1; i >= 0; i--) {
        const pk = this._attackParticles[i];
        pk.x   += pk.vx * dt;
        pk.y   += pk.vy * dt;
        pk.vy  += 220 * dt;
        pk.life -= pk.decay * dt;
        if (pk.life <= 0) { this._attackParticles.splice(i, 1); continue; }
        const s = pk.size * (0.4 + pk.life * 0.6);
        ctx.globalAlpha  = pk.life * 0.9;
        ctx.fillStyle    = pk.color;
        ctx.shadowColor  = pk.color;
        ctx.shadowBlur   = 8;
        ctx.fillRect(pk.x - s / 2, pk.y - s / 2, s, s);
      }
      ctx.restore();
    }

    if (invincible && Math.floor(now / 80) % 2 === 0) return;

    ctx.save();
    ctx.translate(x + w / 2, y + h);
    ctx.scale(facing, 1);
    ctx.translate(-w / 2, -h);

    const frame = state === 'walk' ? Math.floor(now / 110) % 4 : 0;
    _player(ctx, state, frame, attackTimer, weaponColor, playerClass?.id ?? 'warrior');

    ctx.restore();
  }

  drawEnemy(ctx, enemy) {
    const { x, y, w, h, type, facing, hurtTimer, dead, deathTimer, spawnFlash } = enemy;

    // Invisible while waiting to respawn
    if (dead && deathTimer <= 0) return;

    // Death animation: progress 1→0 over DEATH_DURATION
    const DEATH_DUR = 0.7;
    const deathProgress = dead ? Math.max(0, deathTimer / DEATH_DUR) : 1;
    const floatUp = dead ? (1 - deathProgress) * 28 : 0;  // float 28 px upward

    ctx.save();
    ctx.globalAlpha = deathProgress;

    if (hurtTimer > 0 || spawnFlash > 0) ctx.filter = 'brightness(3)';

    // Translate to bottom-centre of sprite, apply float-up offset
    ctx.translate(x + w / 2, y + h - floatUp);
    // Scale in facing direction, and shrink to 0 on death
    ctx.scale(facing * deathProgress, deathProgress);
    ctx.translate(-w / 2, -h);

    const frame = Math.floor(Date.now() / 250) % 2;
    if (type === 'slime')         _slime(ctx, w, h, frame, enemy.skin);
    else if (type === 'mushroom') _mushroom(ctx, w, h, frame, enemy.skin);

    ctx.restore();
  }

  drawBackground(ctx, camera, worldW, worldH, world) {
    _background(ctx, camera, worldW, worldH, world);
  }

  // ── Portal ────────────────────────────────────────────────────────────────

  drawPortal(ctx, px, py, pw, ph, color) {
    const cx  = px + pw / 2;
    const ry  = ph * 0.46;        // half-height of oval
    const cy  = py + ph - ry;     // bottom of oval sits exactly at platform surface
    const rx  = pw * 0.40;
    const t   = Date.now() / 1000;
    const pulse = 0.72 + 0.28 * Math.sin(t * 2.4);

    ctx.save();

    // Glow shadow
    ctx.shadowColor = color;
    ctx.shadowBlur  = 28 * pulse;

    // Dark portal void
    ctx.fillStyle = '#04030e';
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Outer ring
    ctx.strokeStyle = color;
    ctx.lineWidth   = 4;
    ctx.globalAlpha = pulse;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Inner secondary ring
    ctx.strokeStyle = color;
    ctx.lineWidth   = 1.5;
    ctx.globalAlpha = pulse * 0.5;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx * 0.70, ry * 0.70, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Orbiting sparkles
    ctx.fillStyle = color;
    for (let i = 0; i < 12; i++) {
      const a     = (i / 12) * Math.PI * 2 + t * 1.4;
      const sx    = cx + Math.cos(a) * rx * 0.78;
      const sy    = cy + Math.sin(a) * ry * 0.78;
      const alpha = 0.35 + 0.65 * Math.abs(Math.sin(t * 2.2 + i * 0.52));
      ctx.globalAlpha = alpha;
      ctx.fillRect(sx - 2, sy - 2, i % 3 === 0 ? 4 : 3, i % 3 === 0 ? 4 : 3);
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur  = 0;

    // "NEXT WORLD" label above
    ctx.shadowColor = color;
    ctx.shadowBlur  = 10;
    ctx.fillStyle   = color;
    ctx.font        = 'bold 13px monospace';
    ctx.textAlign   = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = pulse;
    ctx.fillText('▲  NEXT WORLD  ▲', cx, py + 10);
    ctx.globalAlpha = 1;
    ctx.shadowBlur  = 0;
    ctx.textBaseline = 'alphabetic';

    ctx.restore();
  }

  // ── World transition splash ───────────────────────────────────────────────

  drawWorldTransition(ctx, canvasW, canvasH, transition, targetWorld) {
    const { phase, t, duration } = transition;
    const alpha = phase === 'fadeOut' ? t / duration
                : phase === 'fadeIn'  ? 1 - t / duration
                : 1;  // splash = fully black

    ctx.fillStyle = `rgba(0,0,0,${Math.min(1, alpha)})`;
    ctx.fillRect(0, 0, canvasW, canvasH);

    if (phase !== 'splash') return;

    const mid = canvasH / 2;
    ctx.textAlign = 'center';

    ctx.fillStyle   = '#c89a30';
    ctx.font        = 'bold 52px monospace';
    ctx.textBaseline = 'middle';
    ctx.fillText(`WORLD  ${targetWorld.id}`, canvasW / 2, mid - 48);

    ctx.fillStyle = '#ffffff';
    ctx.font      = 'bold 22px monospace';
    ctx.fillText(targetWorld.name, canvasW / 2, mid + 4);

    ctx.fillStyle = '#aaaaaa';
    ctx.font      = '14px monospace';
    ctx.fillText(targetWorld.subtitle, canvasW / 2, mid + 36);

    if (targetWorld.enemyMult.hp > 1) {
      const pct = Math.round(targetWorld.enemyMult.hp * 100);
      ctx.fillStyle = '#ff7070';
      ctx.font      = 'bold 13px monospace';
      ctx.fillText(`⚠  Enemies are ${pct}% stronger`, canvasW / 2, mid + 76);
    }

    ctx.textBaseline = 'alphabetic';
  }

  drawHUD(ctx, player, canvasW, canvasH) {
    const pad = 14;

    // HP bar
    const barW = Math.min(200, canvasW * 0.35);
    const barH = 16;
    ctx.fillStyle = '#222';
    ctx.fillRect(pad, pad, barW, barH);
    ctx.fillStyle = '#e33';
    ctx.fillRect(pad, pad, barW * (player.hp / player.maxHp), barH);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.strokeRect(pad, pad, barW, barH);
    ctx.font = '11px monospace';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'left';
    ctx.fillText(`HP  ${player.hp}/${player.maxHp}`, pad + 4, pad + 12);

    // EXP bar
    const expW = barW;
    const expH = 8;
    const expY = pad + barH + 4;
    ctx.fillStyle = '#111';
    ctx.fillRect(pad, expY, expW, expH);
    ctx.fillStyle = '#4ef';
    ctx.fillRect(pad, expY, expW * (player.exp / player.expToNext), expH);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.strokeRect(pad, expY, expW, expH);

    // Level
    ctx.font = 'bold 13px monospace';
    ctx.fillStyle = '#ff4';
    ctx.textAlign = 'left';
    ctx.fillText(`LV ${player.level}`, pad, expY + expH + 14);

    // ── Gold & Potions row ───────────────────────────────────────────────────
    const lootY = expY + expH + 30;
    ctx.font = '11px monospace';

    // Coin icon
    ctx.fillStyle = '#ffd700';
    ctx.shadowColor = '#ffd700';
    ctx.shadowBlur = 4;
    ctx.fillRect(pad, lootY - 8, 8, 8);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffd700';
    ctx.fillText(`${player.gold}g`, pad + 11, lootY);

    // Potion icon
    const potX = pad + 56;
    ctx.fillStyle = '#f0abfc';
    ctx.shadowColor = '#f0abfc';
    ctx.shadowBlur = 4;
    ctx.fillRect(potX, lootY - 8, 8, 8);
    ctx.shadowBlur = 0;
    ctx.fillStyle = player.potions > 0 ? '#f0abfc' : '#555';
    ctx.fillText(`${player.potions}/${player.maxPotions}`, potX + 11, lootY);

    // ── Weapon row ───────────────────────────────────────────────────────────
    const wepY = lootY + 14;
    const wepColor = player.weapon?.color ?? '#555';
    ctx.fillStyle = wepColor;
    ctx.shadowColor = wepColor;
    ctx.shadowBlur = player.weapon ? 4 : 0;
    ctx.fillRect(pad, wepY - 8, 8, 8);
    ctx.shadowBlur = 0;
    ctx.fillStyle = player.weapon ? '#ddd' : '#555';
    ctx.fillText(player.weapon?.name ?? 'Fists', pad + 11, wepY);
  }

  // ── Changelog helpers (used for both drawing and hit-testing) ──────────────

  /** Total pixel height of all changelog entries (for scroll capping). */
  changelogContentHeight(changelog) {
    const LINE_H = 19, VER_H = 34;
    let h = 18; // top pad
    for (const s of changelog) {
      h += VER_H + 6 + s.changes.length * LINE_H + 14;
    }
    return h;
  }

  changelogButtonRect(canvasW, canvasH) {
    const w = 112, h = 28, pad = 14;
    return { x: canvasW - w - pad, y: pad, w, h };
  }

  changelogPanelRect(canvasW, canvasH) {
    const w = Math.min(500, canvasW - 40);
    const h = Math.min(canvasH - 80, 540);
    return { x: (canvasW - w) / 2, y: (canvasH - h) / 2, w, h };
  }

  drawChangelogButton(ctx, canvasW, canvasH, isOpen) {
    const { x, y, w, h } = this.changelogButtonRect(canvasW, canvasH);
    ctx.save();
    ctx.globalAlpha = 0.92;

    // Background
    ctx.fillStyle = isOpen ? '#c89a30' : '#1a1a2e';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 6);
    ctx.fill();

    // Border
    ctx.strokeStyle = '#c89a30';
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 6);
    ctx.stroke();

    // Label
    ctx.globalAlpha = 1;
    ctx.fillStyle   = isOpen ? '#1a1a2e' : '#c89a30';
    ctx.font        = 'bold 11px monospace';
    ctx.textAlign   = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('📋  CHANGELOG', x + w / 2, y + h / 2);
    ctx.textBaseline = 'alphabetic';
    ctx.restore();
  }

  drawChangelogOverlay(ctx, canvasW, canvasH, changelog, scrollY) {
    const { x: px, y: py, w: pw, h: ph } = this.changelogPanelRect(canvasW, canvasH);
    const pad     = 18;
    const bodyY   = py + 48;         // below title bar
    const bodyH   = ph - 48 - 12;   // content height

    ctx.save();

    // Dim backdrop
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, canvasW, canvasH);

    // Panel background
    ctx.fillStyle = '#0d0d1e';
    ctx.beginPath();
    ctx.roundRect(px, py, pw, ph, 10);
    ctx.fill();

    // Panel border
    ctx.strokeStyle = '#c89a30';
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.roundRect(px, py, pw, ph, 10);
    ctx.stroke();

    // Title bar stripe
    ctx.fillStyle = '#1a1a3a';
    ctx.beginPath();
    ctx.roundRect(px, py, pw, 42, [10, 10, 0, 0]);
    ctx.fill();

    // Title text
    ctx.fillStyle   = '#c89a30';
    ctx.font        = 'bold 15px monospace';
    ctx.textAlign   = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('📋  CHANGELOG', px + pad, py + 21);
    ctx.textBaseline = 'alphabetic';

    // Close [X] button
    const xBtnX = px + pw - 36;
    const xBtnY = py + 8;
    ctx.fillStyle = '#333355';
    ctx.beginPath();
    ctx.roundRect(xBtnX, xBtnY, 24, 24, 5);
    ctx.fill();
    ctx.fillStyle   = '#aaa';
    ctx.font        = 'bold 13px monospace';
    ctx.textAlign   = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('✕', xBtnX + 12, xBtnY + 12);
    ctx.textBaseline = 'alphabetic';

    // Clip content region
    ctx.save();
    ctx.beginPath();
    ctx.rect(px, bodyY, pw, bodyH);
    ctx.clip();

    // Render entries
    const LINE_H   = 19;
    const VER_H    = 34;
    let   cursor   = bodyY + pad - scrollY;

    for (const section of changelog) {
      // Version header
      ctx.fillStyle = '#1e1e3a';
      ctx.fillRect(px + pad, cursor, pw - pad * 2, VER_H);
      ctx.strokeStyle = '#c89a30';
      ctx.lineWidth   = 1;
      ctx.strokeRect(px + pad, cursor, pw - pad * 2, VER_H);

      ctx.fillStyle   = '#c89a30';
      ctx.font        = 'bold 13px monospace';
      ctx.textAlign   = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(`v${section.version}`, px + pad + 10, cursor + VER_H / 2);
      ctx.fillStyle   = '#888';
      ctx.font        = '11px monospace';
      ctx.textAlign   = 'right';
      ctx.fillText(section.date, px + pw - pad - 10, cursor + VER_H / 2);
      ctx.textBaseline = 'alphabetic';
      cursor += VER_H + 6;

      // Change lines
      for (const line of section.changes) {
        ctx.fillStyle = line.startsWith('  ') ? '#888' : '#dde';
        ctx.font      = '12px monospace';
        ctx.textAlign = 'left';
        const prefix  = line.startsWith('  ') ? '' : '• ';
        ctx.fillText(prefix + line.trimStart(), px + pad + 12, cursor + LINE_H * 0.75);
        cursor += LINE_H;
      }
      cursor += 14; // gap between versions
    }

    ctx.restore(); // remove clip

    // Scrollbar
    const totalH = this.changelogContentHeight(changelog);
    if (totalH > bodyH) {
      const trackX = px + pw - 8;
      const trackW = 4;
      // Track
      ctx.fillStyle = '#222244';
      ctx.beginPath();
      ctx.roundRect(trackX, bodyY, trackW, bodyH, 2);
      ctx.fill();
      // Thumb
      const thumbH   = Math.max(24, bodyH * (bodyH / totalH));
      const maxScroll = totalH - bodyH;
      const thumbY   = bodyY + (scrollY / maxScroll) * (bodyH - thumbH);
      ctx.fillStyle = scrollY < maxScroll - 2 ? '#c89a30' : '#888';
      ctx.beginPath();
      ctx.roundRect(trackX, thumbY, trackW, thumbH, 2);
      ctx.fill();
    }

    ctx.restore();
  }

  // ── Projectiles ───────────────────────────────────────────────────────────

  drawProjectiles(ctx, projectiles) {
    if (!projectiles.length) return;
    for (const proj of projectiles) {
      const cx = proj.x + proj.w / 2;
      const cy = proj.y + proj.h / 2;
      ctx.save();
      ctx.translate(cx, cy);

      if (proj.type === 'star') {
        // Spinning shuriken
        ctx.rotate(proj.angle);
        ctx.shadowColor = '#4ade80';
        ctx.shadowBlur  = 12;
        ctx.fillStyle   = '#e2e8f0';
        // 4 blades, each a triangle pointing outward
        for (let i = 0; i < 4; i++) {
          ctx.save();
          ctx.rotate((i / 4) * Math.PI * 2);
          ctx.beginPath();
          ctx.moveTo(0, -8);
          ctx.lineTo(-3, -1);
          ctx.lineTo( 3, -1);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
        // Centre hub
        ctx.fillStyle = '#64748b';
        ctx.shadowBlur = 4;
        ctx.beginPath(); ctx.arc(0, 0, 2.8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#cbd5e1';
        ctx.beginPath(); ctx.arc(0, 0, 1.2, 0, Math.PI * 2); ctx.fill();

      } else if (proj.type === 'arrow') {
        // Arrow in flight
        const dir = proj.vx >= 0 ? 1 : -1;
        ctx.shadowColor = '#fb923c';
        ctx.shadowBlur  = 6;
        // Shaft
        ctx.strokeStyle = '#92400e';
        ctx.lineWidth   = 2;
        ctx.beginPath();
        ctx.moveTo(-dir * 11, 0);
        ctx.lineTo( dir *  4, 0);
        ctx.stroke();
        // Arrowhead
        ctx.fillStyle   = '#94a3b8';
        ctx.shadowColor = '#e2e8f0';
        ctx.shadowBlur  = 4;
        ctx.beginPath();
        ctx.moveTo( dir * 11,  0);
        ctx.lineTo( dir *  4, -3);
        ctx.lineTo( dir *  4,  3);
        ctx.closePath();
        ctx.fill();
        // Fletching
        ctx.strokeStyle = '#fb923c';
        ctx.lineWidth   = 1.5;
        ctx.shadowBlur  = 0;
        ctx.beginPath(); ctx.moveTo(-dir * 9, 0); ctx.lineTo(-dir * 13, -4); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-dir * 9, 0); ctx.lineTo(-dir * 13,  4); ctx.stroke();
      }

      ctx.restore();
    }
  }

  // ── Lightning bolts ────────────────────────────────────────────────────────

  drawLightning(ctx, lightningEffects) {
    if (!lightningEffects.length) return;
    for (const bolt of lightningEffects) {
      const alpha = bolt.life / bolt.maxLife;
      const pts   = bolt.branches;
      ctx.save();

      // Outer purple glow
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = '#818cf8';
      ctx.lineWidth   = 4;
      ctx.lineJoin    = 'round';
      ctx.shadowColor = '#818cf8';
      ctx.shadowBlur  = 22;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();

      // Bright cyan core
      ctx.strokeStyle = '#a5f3fc';
      ctx.lineWidth   = 2;
      ctx.shadowBlur  = 8;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();

      // White-hot centre
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth   = 1;
      ctx.shadowBlur  = 4;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();

      // Strike flash at target (fades as bolt dissipates)
      if (bolt.targetEnemy && alpha > 0.3) {
        const last = pts[pts.length - 1];
        const r    = 14 * alpha;
        ctx.fillStyle   = '#e0e7ff';
        ctx.shadowColor = '#818cf8';
        ctx.shadowBlur  = 28;
        ctx.globalAlpha = alpha * 0.7;
        ctx.beginPath(); ctx.arc(last.x, last.y, r, 0, Math.PI * 2); ctx.fill();
      }

      ctx.restore();
    }
  }

  // ── Class selection screen ────────────────────────────────────────────────

  /** Returns bounding rects for each class card (for hit-testing). */
  classSelectCardRects(canvasW, canvasH, count) {
    const sidePad = canvasW * 0.03;
    const gap     = canvasW * 0.015;
    const cardW   = (canvasW - sidePad * 2 - gap * (count - 1)) / count;
    const cardH   = canvasH * 0.70;
    const cardY   = canvasH * 0.17;
    return Array.from({ length: count }, (_, i) => ({
      x: sidePad + i * (cardW + gap), y: cardY, w: cardW, h: cardH,
    }));
  }

  /** Returns bounding rect for the PLAY button (for hit-testing). */
  classSelectPlayBtn(canvasW, canvasH) {
    const btnW = Math.min(180, canvasW * 0.22);
    const btnH = Math.min(38, canvasH * 0.09);
    return { x: (canvasW - btnW) / 2, y: canvasH * 0.90, w: btnW, h: btnH };
  }

  drawClassSelect(ctx, canvasW, canvasH, classes, selectedIdx) {
    // Background gradient
    const bg = ctx.createLinearGradient(0, 0, 0, canvasH);
    bg.addColorStop(0, '#07011a');
    bg.addColorStop(1, '#100830');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvasW, canvasH);

    // Stars
    const t = Date.now() / 1800;
    for (let i = 0; i < 70; i++) {
      const sx      = ((i * 137 + 41) % (canvasW + 100)) - 50;
      const sy      = ((i * 97  + 17) % (canvasH * 0.80));
      const twinkle = 0.2 + 0.8 * Math.abs(Math.sin(t + i * 0.63));
      ctx.globalAlpha = twinkle * 0.65;
      ctx.fillStyle   = i % 5 === 0 ? '#c0d8ff' : '#ffffff';
      ctx.fillRect(sx, sy, i % 4 === 0 ? 2 : 1, i % 4 === 0 ? 2 : 1);
    }
    ctx.globalAlpha = 1;

    // Title
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.font         = `bold ${Math.max(14, Math.floor(canvasH * 0.055))}px monospace`;
    ctx.shadowColor  = '#c89a30';
    ctx.shadowBlur   = 12;
    ctx.fillStyle    = '#c89a30';
    ctx.fillText('SELECT YOUR CLASS', canvasW / 2, canvasH * 0.09);
    ctx.shadowBlur   = 0;

    // Cards
    const sidePad = canvasW * 0.03;
    const gap     = canvasW * 0.015;
    const cardW   = (canvasW - sidePad * 2 - gap * 3) / 4;
    const cardH   = canvasH * 0.70;
    const cardY   = canvasH * 0.17;

    for (let i = 0; i < classes.length; i++) {
      const cls       = classes[i];
      const cardX     = sidePad + i * (cardW + gap);
      const isSel     = i === selectedIdx;

      // Card fill
      ctx.fillStyle = isSel ? '#1a1a3a' : '#0d0d1e';
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, cardW, cardH, 7);
      ctx.fill();

      // Card border
      ctx.strokeStyle = isSel ? cls.color : '#252545';
      ctx.lineWidth   = isSel ? 2.5 : 1.5;
      if (isSel) { ctx.shadowColor = cls.color; ctx.shadowBlur = 14; }
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, cardW, cardH, 7);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Character preview — sprite is 36×52 at S=4;
      // scale it to fill ~62% of card width, capped so it fits the preview area
      const previewAreaH = cardH * 0.58;
      const spriteW = 36, spriteH = 52;
      const scale   = Math.min(cardW * 0.62 / spriteW, previewAreaH / spriteH);
      const previewCX = cardX + cardW / 2;
      const previewBY = cardY + previewAreaH;  // bottom edge of preview area

      ctx.save();
      ctx.translate(previewCX, previewBY);
      ctx.scale(scale, scale);
      ctx.translate(-spriteW / 2, -spriteH);
      _player(ctx, 'idle', 0, 0, cls.color, cls.id);
      ctx.restore();

      // Class name
      const nameY    = cardY + cardH * 0.62;
      const nameSize = Math.max(8, Math.floor(cardW * 0.14));
      ctx.fillStyle    = isSel ? cls.color : '#cccccc';
      ctx.font         = `bold ${nameSize}px monospace`;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      if (isSel) { ctx.shadowColor = cls.color; ctx.shadowBlur = 8; }
      ctx.fillText(cls.name, cardX + cardW / 2, nameY);
      ctx.shadowBlur = 0;

      // Tagline
      const tagSize = Math.max(7, Math.floor(cardW * 0.092));
      ctx.fillStyle = '#888';
      ctx.font      = `${tagSize}px monospace`;
      ctx.fillText(cls.tagline, cardX + cardW / 2, nameY + cardH * 0.085);

      // Stats
      const statsY  = nameY + cardH * 0.175;
      const statSz  = Math.max(7, Math.floor(cardW * 0.088));
      ctx.font      = `${statSz}px monospace`;
      ctx.fillStyle = '#f87171';
      ctx.fillText(`HP  ${cls.stats.maxHp}`, cardX + cardW / 2, statsY);
      ctx.fillStyle = '#fbbf24';
      ctx.fillText(`ATK ${cls.stats.attackDamage}`, cardX + cardW / 2, statsY + cardH * 0.085);
    }

    // PLAY button
    const { x: bx, y: by, w: bw, h: bh } = this.classSelectPlayBtn(canvasW, canvasH);
    const selCol = classes[selectedIdx].color;
    ctx.fillStyle   = selCol;
    ctx.shadowColor = selCol;
    ctx.shadowBlur  = 14;
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, 8);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle    = '#000';
    ctx.font         = `bold ${Math.max(11, Math.floor(bh * 0.38))}px monospace`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('▶  PLAY  ◀', canvasW / 2, by + bh / 2);

    // Hint text
    ctx.fillStyle    = '#44445a';
    ctx.font         = `${Math.max(8, Math.floor(canvasH * 0.025))}px monospace`;
    ctx.textBaseline = 'middle';
    ctx.fillText('← → to browse   •   ENTER / tap card to confirm', canvasW / 2, canvasH * 0.965);

    ctx.textBaseline = 'alphabetic';
  }

  drawMobileControls(ctx, canvasW, canvasH) {
    const btnW   = canvasW * 0.16;
    const btnH   = canvasH * 0.16;
    const padBot = canvasH * 0.04;
    const leftX  = canvasW * 0.04;
    const rightX = leftX + btnW + canvasW * 0.02;
    const btnY   = canvasH - btnH - padBot;

    const btnSize = Math.min(canvasW, canvasH) * 0.19;
    const rpad    = canvasH * 0.04;
    const potionX = canvasW - btnSize * 3 - rpad * 3;
    const jumpX   = canvasW - btnSize * 2 - rpad * 2;
    const attackX = canvasW - btnSize - rpad;
    const rbtnY   = canvasH - btnSize - rpad;

    ctx.globalAlpha = 0.35;
    _drawBtn(ctx, leftX,   btnY,   btnW,    btnH,    '◀');
    _drawBtn(ctx, rightX,  btnY,   btnW,    btnH,    '▶');
    _drawBtn(ctx, potionX, rbtnY,  btnSize, btnSize, '', '#f0abfc');
    // Potion flask icon
    const pcx = potionX + btnSize / 2;
    const pcy = rbtnY   + btnSize / 2;
    const ps  = btnSize * 0.027;       // scale: 1 unit ≈ 2.7% of button
    ctx.save();
    ctx.translate(pcx, pcy - ps);      // nudge up slightly for visual balance
    ctx.scale(ps, ps);
    ctx.fillStyle = '#9c1db9';         // neck (dark purple)
    ctx.fillRect(-3, -10, 6, 9);
    ctx.fillStyle = '#c4830a';         // cork
    ctx.fillRect(-2, -13, 4, 3);
    ctx.fillStyle = '#d946ef';         // body
    ctx.fillRect(-7, -1, 14, 12);
    ctx.fillStyle = '#a21caf';         // body shadow
    ctx.fillRect(-7, 8, 14, 3);
    ctx.fillStyle = 'rgba(255,255,255,0.55)'; // shine
    ctx.fillRect(-5, 0, 2, 6);
    ctx.restore();
    _drawBtn(ctx, jumpX,   rbtnY,  btnSize, btnSize, '↑', '#4af');
    // Attack button — draw shell then overlay a sword icon
    _drawBtn(ctx, attackX, rbtnY, btnSize, btnSize, '', '#fa4');
    const scx = attackX + btnSize / 2;
    const scy = rbtnY   + btnSize / 2;
    const sz  = btnSize * 0.30;
    ctx.save();
    ctx.translate(scx, scy);
    ctx.rotate(-Math.PI / 4);
    ctx.fillStyle = '#f0f0ff';                                         // blade
    ctx.fillRect(-sz * 0.14, -sz * 1.1, sz * 0.28, sz * 1.55);
    ctx.beginPath();                                                    // tip
    ctx.moveTo(-sz * 0.14, -sz * 1.1);
    ctx.lineTo( sz * 0.14, -sz * 1.1);
    ctx.lineTo(0, -sz * 1.55);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffd700';                                         // crossguard
    ctx.fillRect(-sz * 0.55, sz * 0.08, sz * 1.10, sz * 0.22);
    ctx.fillStyle = '#92400e';                                         // grip
    ctx.fillRect(-sz * 0.11, sz * 0.30, sz * 0.22, sz * 0.52);
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  drawDecorations(ctx, decorations) {
    const t = Date.now() / 1000;
    for (const d of decorations) {
      ctx.save();
      ctx.translate(d.x, d.y);
      switch (d.type) {
        case 'haybale':   _decHaybale(ctx);                  break;
        case 'barrel':    _decBarrel(ctx);                   break;
        case 'signpost':  _decSignpost(ctx);                 break;
        case 'flowers':   _decFlowers(ctx, t, d.seed ?? 0); break;
        case 'stump':     _decStump(ctx);                    break;
        case 'fence':     _decFence(ctx);                    break;
        case 'toadstool': _decToadstool(ctx);                break;
        case 'crate':     _decCrate(ctx);                    break;
        case 'lantern':   _decLantern(ctx, t);               break;
      }
      ctx.restore();
    }
  }

  /** Queue 5 staggered firework bursts centred on the player. */
  triggerLevelUp(cx, cy) {
    const now = Date.now();
    // Each burst: world-offset from player centre, delay, colour palette
    const bursts = [
      { ox:   0, oy: -30,  delay:   0, colors: ['#ffd700', '#fff44f', '#ffffff', '#ffa500'] },
      { ox: -52, oy: -70,  delay: 200, colors: ['#ff69b4', '#00eeff', '#ff44cc', '#ccddff'] },
      { ox:  52, oy: -70,  delay: 200, colors: ['#00ff88', '#bf80ff', '#44ff44', '#dd44ff'] },
      { ox: -24, oy: -120, delay: 420, colors: ['#ffd700', '#ff8800', '#ffffff', '#ffee44'] },
      { ox:  24, oy: -120, delay: 420, colors: ['#88ffff', '#ff88ff', '#ffff88', '#ffffff'] },
    ];
    for (const b of bursts) {
      this._fireworkQueue.push({
        x:      cx + b.ox,
        y:      cy + b.oy,
        fireAt: now + b.delay,
        colors: b.colors,
      });
    }
  }

  /** Update and draw all active firework particles (call in world space). */
  drawFireworks(ctx) {
    const now = Date.now();
    const dt  = this._dt || 0.016;

    // Fire any queued bursts whose time has come
    for (let i = this._fireworkQueue.length - 1; i >= 0; i--) {
      const b = this._fireworkQueue[i];
      if (now < b.fireAt) continue;
      this._fireworkQueue.splice(i, 1);

      // Radial ring of 24 sparkles + 8 fast streaks
      for (let j = 0; j < 32; j++) {
        const angle = (j / 32) * Math.PI * 2;
        const fast  = j % 4 === 0;
        const speed = fast ? 160 + Math.random() * 80 : 60 + Math.random() * 90;
        this._fireworks.push({
          x:     b.x + (Math.random() - 0.5) * 10,
          y:     b.y + (Math.random() - 0.5) * 10,
          vx:    Math.cos(angle) * speed,
          vy:    Math.sin(angle) * speed - (fast ? 40 : 10),
          life:  1.0,
          decay: fast ? 0.9 + Math.random() * 0.4 : 0.5 + Math.random() * 0.3,
          size:  fast ? 2 + Math.random() * 2 : 3 + Math.random() * 3,
          color: b.colors[Math.floor(Math.random() * b.colors.length)],
        });
      }
    }

    if (this._fireworks.length === 0) return;

    ctx.save();
    for (let i = this._fireworks.length - 1; i >= 0; i--) {
      const p = this._fireworks[i];
      p.x   += p.vx * dt;
      p.y   += p.vy * dt;
      p.vy  += 180 * dt; // gravity
      p.life -= p.decay * dt;
      if (p.life <= 0) { this._fireworks.splice(i, 1); continue; }

      const s = p.size * (0.3 + p.life * 0.7);
      ctx.globalAlpha = Math.min(1, p.life * 1.2);
      ctx.fillStyle   = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur  = 10;
      // Star / sparkle shape: two overlapping rects (cross + diagonal)
      ctx.fillRect(p.x - s * 0.5, p.y - s * 2,   s,       s * 4);
      ctx.fillRect(p.x - s * 2,   p.y - s * 0.5, s * 4,   s);
    }
    ctx.restore();
  }

  drawDrops(ctx, drops) {
    for (const d of drops) {
      const bob = Math.sin(d.bobTimer) * 3;
      ctx.save();

      if (d.type === 'coin') {
        // Pulsing gold square with glow
        const pulse = 0.7 + 0.3 * Math.sin(d.bobTimer * 1.5);
        ctx.shadowColor = '#ffd700';
        ctx.shadowBlur  = 8 * pulse;
        ctx.fillStyle   = '#ffd700';
        ctx.fillRect(d.x, d.y - bob, d.w, d.h);
        // Shine pixel
        ctx.shadowBlur  = 0;
        ctx.fillStyle   = 'rgba(255,255,255,0.7)';
        ctx.fillRect(d.x + 2, d.y - bob + 2, 3, 3);

      } else if (d.type === 'potion') {
        // Pink flask: neck + body
        ctx.shadowColor = '#f0abfc';
        ctx.shadowBlur  = 8;
        // Body
        ctx.fillStyle = '#d946ef';
        ctx.fillRect(d.x + 2, d.y + 4 - bob, d.w - 4, d.h - 4);
        // Neck
        ctx.fillStyle = '#a21caf';
        ctx.fillRect(d.x + 4, d.y - bob, d.w - 8, 5);
        // Liquid shine
        ctx.shadowBlur = 0;
        ctx.fillStyle  = 'rgba(255,255,255,0.5)';
        ctx.fillRect(d.x + 3, d.y + 5 - bob, 2, 4);

      } else if (d.type === 'weapon') {
        // Small sword at 45° with crossguard
        ctx.shadowColor = '#e8c84a';
        ctx.shadowBlur  = 10;
        ctx.translate(d.x + d.w / 2, d.y + d.h / 2 - bob);
        ctx.rotate(Math.PI / 4);
        // Blade
        ctx.fillStyle = '#e8e8f0';
        ctx.fillRect(-2, -10, 4, 16);
        // Crossguard
        ctx.fillStyle = '#e8c84a';
        ctx.fillRect(-7, 2, 14, 3);
        // Grip
        ctx.fillStyle = '#92400e';
        ctx.fillRect(-1, 5, 3, 6);
      }

      ctx.restore();
    }
  }
}

// ═════════════════════════════════════════════════════════════════════════════
//   PLAYER   9 cols × 13 rows @ S=4  →  36 × 52 px
//
//   Left side (cols 0–1) = back of head  →  mullet lives here.
//   Right side (col 6–7) = front / face direction.
// ═════════════════════════════════════════════════════════════════════════════
// ── Per-class body colour palettes ───────────────────────────────────────────
const CLASS_BODY = {
  warrior: {
    shirtD: '#37474f', shirtM: '#546e7a', collar: '#ef4444', belt: '#b71c1c',
    pantsD: '#1c2d36', pantsM: '#263238', bootD: '#1a0a00', bootM: '#2d1a0a',
  },
  mage: {
    shirtD: '#1e3a8a', shirtM: '#2563eb', collar: '#818cf8', belt: '#7c3aed',
    pantsD: '#1e3a8a', pantsM: '#2563eb', bootD: '#0c1442', bootM: '#1e3a8a',
  },
  thief: {
    shirtD: '#0f172a', shirtM: '#1e293b', collar: '#4ade80', belt: '#14532d',
    pantsD: '#0b1018', pantsM: '#0f172a', bootD: '#050810', bootM: '#0f172a',
  },
  bowman: {
    shirtD: '#365314', shirtM: '#4d7c0f', collar: '#84cc16', belt: '#78350f',
    pantsD: '#7c2d12', pantsM: '#9a3412', bootD: '#3f1407', bootM: '#6b2d0a',
  },
};

function _player(ctx, state, frame, attackTimer = 0, weaponColor = '#a78bfa', cls = 'warrior') {
  const B = CLASS_BODY[cls] ?? CLASS_BODY.warrior;

  // ── Head (class-specific) ─────────────────────────────────────────────────
  if (cls === 'warrior') {
    // Steel helmet with red plume
    ctx.fillStyle = '#37474f';
    p(ctx, 0, 0, 8, 5);              // full helmet shell
    ctx.fillStyle = '#546e7a';
    p(ctx, 0, 0, 7, 4);              // lighter face panel
    ctx.fillStyle = '#78909c';
    p(ctx, 1, 0, 5, 2);              // steel sheen on top
    ctx.fillStyle = '#263238';
    p(ctx, 0, 4, 8, 1);              // visor rim (dark)
    // Face slit (narrow visible area)
    ctx.fillStyle = C.skin;
    p(ctx, 2, 2, 4, 2);
    ctx.fillStyle = C.skinD;
    p(ctx, 2, 3, 4, 1);
    ctx.fillStyle = C.eye;
    p(ctx, 5, 2, 1, 1);
    ctx.fillStyle = '#fff';
    ctx.fillRect(5 * S + 2, 2 * S, 1, 1);
    // Red plume above helmet
    ctx.fillStyle = '#b91c1c';
    p(ctx, 3, -2, 3, 3);
    ctx.fillStyle = '#ef4444';
    p(ctx, 3, -2, 2, 2);
    ctx.fillStyle = '#fca5a5';
    p(ctx, 3, -2, 1, 1);

  } else if (cls === 'mage') {
    // Pointed wizard hat (cone above sprite, brim at row 1)
    ctx.fillStyle = '#1e3a8a';
    // Hat cone — triangle path
    ctx.beginPath();
    ctx.moveTo(4.5 * S, -2 * S);   // tip
    ctx.lineTo(0,        2 * S);    // left base
    ctx.lineTo(9 * S,    2 * S);    // right base
    ctx.closePath();
    ctx.fill();
    // Cone highlight
    ctx.fillStyle = '#2563eb';
    ctx.beginPath();
    ctx.moveTo(4.5 * S, -2 * S);
    ctx.lineTo(0,        2 * S);
    ctx.lineTo(4.5 * S,  2 * S);
    ctx.closePath();
    ctx.fill();
    // Hat brim (wide)
    ctx.fillStyle = '#1e3a8a';
    p(ctx, 0, 1, 8, 1);
    ctx.fillStyle = '#2563eb';
    p(ctx, 0, 1, 7, 1);
    // Gold star on hat
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(4 * S, -1 * S, S, S);
    // Face
    ctx.fillStyle = C.skin;
    p(ctx, 2, 2, 5, 2);
    ctx.fillStyle = C.skinD;
    p(ctx, 2, 4, 5, 1);
    ctx.fillStyle = C.eye;
    p(ctx, 6, 2, 1, 1);
    ctx.fillStyle = '#fff';
    ctx.fillRect(6 * S + 2, 2 * S, 1, 1);

  } else if (cls === 'thief') {
    // Dark green hood + narrow face slit
    ctx.fillStyle = '#052e16';
    p(ctx, 0, 0, 8, 5);              // outer hood
    ctx.fillStyle = '#14532d';
    p(ctx, 0, 0, 7, 4);              // inner hood highlight
    ctx.fillStyle = '#166534';
    p(ctx, 1, 0, 4, 2);              // sheen
    // Narrow face slit
    ctx.fillStyle = C.skin;
    p(ctx, 4, 2, 3, 1);
    // Piercing single eye
    ctx.fillStyle = C.eye;
    p(ctx, 6, 2, 1, 1);
    ctx.fillStyle = '#fff';
    ctx.fillRect(6 * S + 2, 2 * S, 1, 1);
    // Shadow under brow
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    p(ctx, 0, 3, 4, 2);

  } else if (cls === 'bowman') {
    // Short hair peek (before hat hides it)
    ctx.fillStyle = '#7c3d12';
    p(ctx, 0, 2, 1, 2);             // tiny brown hair behind
    // Hat crown (brown)
    ctx.fillStyle = '#7c3d12';
    p(ctx, 1, 0, 6, 3);
    ctx.fillStyle = '#92400e';
    p(ctx, 1, 0, 5, 2);
    ctx.fillStyle = '#b45309';
    p(ctx, 2, 0, 3, 1);             // top highlight
    // Hat band
    ctx.fillStyle = '#3f1407';
    p(ctx, 1, 2, 6, 1);
    // Wide brim (extends beyond sprite edges)
    ctx.fillStyle = '#6b2d0a';
    ctx.fillRect(-S, 3 * S, 11 * S, S);
    ctx.fillStyle = '#78350f';
    ctx.fillRect(0, 3 * S, 9 * S, Math.ceil(S * 0.5));
    // Green feather in hat
    ctx.fillStyle = '#365314';
    p(ctx, 6, 0, 1, 2);
    ctx.fillStyle = '#4d7c0f';
    p(ctx, 6, 0, 1, 1);
    // Face (same as default)
    ctx.fillStyle = C.skin;
    p(ctx, 2, 1, 5, 3);
    ctx.fillStyle = C.skinD;
    p(ctx, 2, 4, 5, 1);
    ctx.fillStyle = C.eye;
    p(ctx, 6, 2, 1, 1);
    ctx.fillStyle = '#fff';
    ctx.fillRect(6 * S + 2, 2 * S, 1, 1);

  } else {
    // Default (original mullet look)
    ctx.fillStyle = C.hairD;
    p(ctx, 0, 1, 2, 2);
    p(ctx, 0, 3, 1, 3);
    ctx.fillStyle = C.hairM;
    p(ctx, 0, 0, 2, 2);
    p(ctx, 1, 3, 1, 2);
    ctx.fillStyle = C.hairL;
    p(ctx, 0, 2, 1, 1);
    ctx.fillStyle = C.hairD;
    p(ctx, 2, 0, 6, 1);
    ctx.fillStyle = C.hairM;
    p(ctx, 2, 0, 5, 1);
    ctx.fillStyle = C.hairL;
    p(ctx, 3, 0, 3, 1);
    ctx.fillStyle = C.skin;
    p(ctx, 2, 1, 6, 3);
    ctx.fillStyle = C.skinD;
    p(ctx, 2, 4, 6, 1);
    ctx.fillStyle = C.eye;
    p(ctx, 6, 2, 1, 1);
    ctx.fillStyle = '#fff';
    ctx.fillRect(6 * S + 2, 2 * S, 1, 1);
  }

  // ── Shirt ─────────────────────────────────────────────────────────────────
  ctx.fillStyle = B.shirtD;
  p(ctx, 2, 5, 6, 3);
  ctx.fillStyle = B.shirtM;
  p(ctx, 2, 5, 5, 3);
  ctx.fillStyle = B.collar;
  p(ctx, 2, 5, 1, 1);

  // Belt
  ctx.fillStyle = B.belt;
  p(ctx, 2, 8, 6, 1);

  // ── Legs ──────────────────────────────────────────────────────────────────
  // back leg: cols 2–3   front leg: cols 5–6
  // Walk cycle: 0=neutral 1=back up 2=neutral 3=front up
  if (state === 'jump') {
    ctx.fillStyle = B.pantsM;
    p(ctx, 2, 9,  2, 2);   // back leg tucked
    p(ctx, 5, 10, 2, 2);   // front leg tucked lower
    ctx.fillStyle = B.bootM;
    p(ctx, 2, 11, 2, 1);
    p(ctx, 5, 12, 2, 1);

  } else if (state === 'fall') {
    ctx.fillStyle = B.pantsM;
    p(ctx, 1, 9,  2, 3);   // legs spread
    p(ctx, 6, 9,  2, 3);
    ctx.fillStyle = B.bootM;
    p(ctx, 1, 12, 2, 1);
    p(ctx, 6, 12, 2, 1);

  } else {
    // idle / walk / attack
    const bOff = (state === 'walk' && (frame === 1)) ? 1 : 0;
    const fOff = (state === 'walk' && (frame === 3)) ? 1 : 0;
    const bLen = 3 - bOff;
    const fLen = 3 - fOff;

    ctx.fillStyle = B.pantsD;
    p(ctx, 2, 9 + bOff, 2, bLen);   // back leg (darker)
    ctx.fillStyle = B.pantsM;
    p(ctx, 5, 9 + fOff, 2, fLen);   // front leg

    ctx.fillStyle = B.bootD;
    p(ctx, 2, 9 + bOff + bLen, 2, 1);
    ctx.fillStyle = B.bootM;
    p(ctx, 5, 9 + fOff + fLen, 2, 1);
  }

  // ── Attack visuals (class-specific) ─────────────────────────────────────────
  if (state === 'attack') {
    const ATTACK_DUR = 0.25;
    const t     = 1 - Math.max(0, attackTimer / ATTACK_DUR); // 0→1
    const pulse = 0.5 + 0.5 * Math.sin(t * Math.PI);

    ctx.save();
    ctx.lineCap = 'round';

    if (cls === 'warrior') {
      // ── Big red sword slash ─────────────────────────────────────────────────
      const arcCx = 9 * S + 4;
      const arcCy = 4 * S;
      const startAngle = -1.6 + t * 0.4;
      const endAngle   = startAngle + 1.2 + t * 1.2;

      // Wide energy ring (outermost, very transparent)
      ctx.globalAlpha = 0.22 * pulse;
      ctx.strokeStyle = weaponColor;
      ctx.lineWidth   = 26;
      ctx.shadowColor = weaponColor;
      ctx.shadowBlur  = 36;
      ctx.beginPath(); ctx.arc(arcCx, arcCy, 62, startAngle, endAngle); ctx.stroke();

      // Main outer glow
      ctx.globalAlpha = 0.55 + 0.35 * pulse;
      ctx.lineWidth   = 18;
      ctx.shadowBlur  = 24 + 10 * pulse;
      ctx.beginPath(); ctx.arc(arcCx, arcCy, 52, startAngle, endAngle); ctx.stroke();

      // Mid arc
      ctx.globalAlpha = 0.7 + 0.25 * pulse;
      ctx.lineWidth   = 8;
      ctx.shadowBlur  = 12;
      ctx.beginPath(); ctx.arc(arcCx, arcCy, 44, startAngle + 0.08, endAngle - 0.05); ctx.stroke();

      // Bright white core
      ctx.globalAlpha = 0.85 * pulse;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth   = 3;
      ctx.shadowColor = '#fff';
      ctx.shadowBlur  = 8;
      ctx.beginPath(); ctx.arc(arcCx, arcCy, 36, startAngle + 0.15, endAngle - 0.1); ctx.stroke();

      // Leading-edge spark
      if (t > 0.05 && t < 0.92) {
        const tipX = arcCx + Math.cos(endAngle) * 50;
        const tipY = arcCy + Math.sin(endAngle) * 50;
        ctx.fillStyle   = 'rgba(255,255,255,0.95)';
        ctx.shadowColor = weaponColor;
        ctx.shadowBlur  = 18;
        ctx.beginPath(); ctx.arc(tipX, tipY, 5 + 3 * (1 - t), 0, Math.PI * 2); ctx.fill();
      }

    } else if (cls === 'mage') {
      // ── Magic casting pulse ────────────────────────────────────────────────
      const cx   = 4.5 * S;
      const cy   = 5 * S;
      const ring1 = 18 + t * 32;
      const ring2 = 10 + t * 20;

      // Expanding outer ring
      ctx.globalAlpha = Math.max(0, 0.7 - t * 0.8);
      ctx.strokeStyle = weaponColor;
      ctx.lineWidth   = 4;
      ctx.shadowColor = weaponColor;
      ctx.shadowBlur  = 18;
      ctx.beginPath(); ctx.arc(cx, cy, ring1, 0, Math.PI * 2); ctx.stroke();

      // Inner ring
      ctx.globalAlpha = Math.max(0, 0.9 - t * 0.9);
      ctx.strokeStyle = '#a5f3fc';
      ctx.lineWidth   = 2;
      ctx.shadowBlur  = 10;
      ctx.beginPath(); ctx.arc(cx, cy, ring2, 0, Math.PI * 2); ctx.stroke();

      // Centre glow
      ctx.globalAlpha = Math.max(0, 0.6 - t * 0.7) * pulse;
      ctx.fillStyle   = '#e0e7ff';
      ctx.shadowColor = weaponColor;
      ctx.shadowBlur  = 20;
      ctx.beginPath(); ctx.arc(cx, cy, 6 * (1 - t * 0.5), 0, Math.PI * 2); ctx.fill();

    }
    // Thief and Bowman: no sprite arc — projectile is the visual

    ctx.restore();
  }
}

// ═════════════════════════════════════════════════════════════════════════════
//   SLIME   32 × 28
// ═════════════════════════════════════════════════════════════════════════════
function _slime(ctx, w, h, frame, skin) {
  const slimeD = skin?.slimeD ?? C.slimeD;
  const slimeM = skin?.slimeM ?? C.slimeM;
  const slimeL = skin?.slimeL ?? C.slimeL;

  const bounce = frame === 0 ? 0 : -3;
  const squash = frame === 1 ? 3 : 0;
  const cy = h * 0.62 + bounce;
  const rx = w * 0.46;
  const ry = h * 0.40 + squash;

  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.ellipse(w / 2, h - 3, rx * 0.7, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = slimeD;
  ctx.beginPath();
  ctx.ellipse(w / 2 + 2, cy + 3, rx * 0.88, ry * 0.8, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = slimeM;
  ctx.beginPath();
  ctx.ellipse(w / 2, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = slimeL;
  ctx.beginPath();
  ctx.ellipse(w * 0.33, cy - ry * 0.28, rx * 0.28, ry * 0.22, -0.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = slimeM;
  ctx.fillRect(w * 0.45, cy - ry - 5, 4, 5);
  ctx.fillStyle = slimeL;
  ctx.fillRect(w * 0.44, cy - ry - 6, 5, 3);

  const eyeY = cy - ry * 0.25;
  ctx.fillStyle = '#fff';
  ctx.fillRect(w * 0.20, eyeY - 4, 8, 8);
  ctx.fillRect(w * 0.55, eyeY - 4, 8, 8);
  ctx.fillStyle = C.eye;
  ctx.fillRect(w * 0.22 + 2, eyeY - 2, 4, 4);
  ctx.fillRect(w * 0.57 + 2, eyeY - 2, 4, 4);
  ctx.fillStyle = '#fff';
  ctx.fillRect(w * 0.22 + 3, eyeY - 2, 1, 1);
  ctx.fillRect(w * 0.57 + 3, eyeY - 2, 1, 1);

  ctx.fillStyle = slimeM;
  ctx.fillRect(w * 0.58, cy + ry - 3, 3, 7);
  ctx.fillRect(w * 0.58 - 1, cy + ry + 3, 5, 3);
}

// ═════════════════════════════════════════════════════════════════════════════
//   MUSHROOM   34 × 42
// ═════════════════════════════════════════════════════════════════════════════
function _mushroom(ctx, w, h, frame, skin) {
  const capD = skin?.capD ?? C.capD;
  const capM = skin?.capM ?? C.capM;
  const capL = skin?.capL ?? C.capL;
  const stemD = skin?.stemD ?? C.stemD;
  const stemM = skin?.stemM ?? C.stemM;
  const spot  = skin?.spot  ?? C.spot;

  const bob = frame === 0 ? 0 : -1;

  const capCx = w / 2;
  const capCy = h * 0.30 + bob;
  const capRx = w * 0.50;
  const capRy = h * 0.33;

  ctx.fillStyle = capD;
  ctx.beginPath();
  ctx.ellipse(capCx + 2, capCy + 3, capRx, capRy, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = capM;
  ctx.beginPath();
  ctx.ellipse(capCx, capCy, capRx, capRy, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = capL;
  ctx.beginPath();
  ctx.ellipse(capCx - capRx * 0.22, capCy - capRy * 0.25, capRx * 0.28, capRy * 0.22, -0.3, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = spot;
  _oval(ctx, capCx - capRx * 0.35, capCy - capRy * 0.05, 5, 4);
  _oval(ctx, capCx + capRx * 0.25, capCy - capRy * 0.20, 4, 3);
  _oval(ctx, capCx + capRx * 0.05, capCy + capRy * 0.15, 3, 3);

  ctx.fillStyle = capD;
  ctx.fillRect(capCx - capRx * 0.9, capCy + capRy * 0.7, capRx * 1.8, 4);

  const stemX = w * 0.18;
  const stemW = w * 0.64;
  const stemY = h * 0.58 + bob;
  const stemH = h * 0.42;

  ctx.fillStyle = stemD;
  ctx.fillRect(stemX + 2, stemY + 2, stemW, stemH);
  ctx.fillStyle = stemM;
  ctx.fillRect(stemX, stemY, stemW, stemH);
  ctx.fillStyle = '#fffff0';
  ctx.fillRect(stemX + stemW * 0.15, stemY, stemW * 0.18, stemH);

  ctx.fillStyle = '#333';
  ctx.fillRect(w * 0.55, stemY + stemH * 0.20, 5, 5);
  ctx.fillStyle = '#fff';
  ctx.fillRect(w * 0.56, stemY + stemH * 0.20, 2, 2);

  const legW = stemW * 0.30;
  const legH = stemH * 0.28;
  const legY = stemY + stemH - 2;

  ctx.fillStyle = stemD;
  ctx.fillRect(stemX - 2,                legY + (frame === 0 ? 0 : 2), legW, legH - (frame === 0 ? 0 : 2));
  ctx.fillRect(stemX + stemW - legW + 2, legY + (frame === 1 ? 0 : 2), legW, legH - (frame === 1 ? 0 : 2));
}

function _oval(ctx, cx, cy, rx, ry) {
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

// ═════════════════════════════════════════════════════════════════════════════
//   BACKGROUND  (3-layer parallax, drawn in world-space coordinates)
// ═════════════════════════════════════════════════════════════════════════════
function _background(ctx, camera, worldW, worldH, world) {
  if (world?.bgStyle === 'ellinia') { _backgroundEllinia(ctx, camera, world); return; }
  if (world?.bgStyle === 'perion')  { _backgroundPerion(ctx, camera, world);  return; }
  _backgroundHenesys(ctx, camera, world);
}

// ── World 1: Henesys Outskirts — bright daytime ───────────────────────────────
function _backgroundHenesys(ctx, camera, world) {
  const { x: cx, y: cy, viewW: vW, viewH: vH } = camera;
  const s = world?.sky ?? { top: '#4ab8f8', mid: '#82d4fa', bot: '#c8ecff' };
  const h = world?.hills ?? { far: '#b0c4e8', mid1: '#5abe38', mid1h: '#72da50', near: '#3ea828' };

  const sky = ctx.createLinearGradient(cx, cy, cx, cy + vH);
  sky.addColorStop(0, s.top); sky.addColorStop(0.55, s.mid); sky.addColorStop(1, s.bot);
  ctx.fillStyle = sky;
  ctx.fillRect(cx - 2, cy - 2, vW + 4, vH + 4);

  _parallax(ctx, camera, 0.05, 800, (c2, ox) => { _clouds(c2, ox, cy + vH * 0.06, vH, 800, 4); });
  _parallax(ctx, camera, 0.12, 600, (c2, ox) => { _clouds(c2, ox, cy + vH * 0.20, vH, 600, 3); });

  _parallax(ctx, camera, 0.08, 900, (c2, ox) => {
    c2.fillStyle = h.far; _peaks(c2, ox, cy + vH * 0.55, vH * 0.20, 900, 7, 41);
  });
  _parallax(ctx, camera, 0.18, 700, (c2, ox) => {
    c2.fillStyle = h.mid1; _hills(c2, ox, cy + vH * 0.66, vH * 0.18, 700, 5, 29);
  });
  _parallax(ctx, camera, 0.18, 700, (c2, ox) => {
    c2.fillStyle = h.mid1h; _hills(c2, ox, cy + vH * 0.64, vH * 0.06, 700, 5, 29);
  });
  _parallax(ctx, camera, 0.30, 500, (c2, ox) => {
    c2.fillStyle = h.near; _hills(c2, ox, cy + vH * 0.77, vH * 0.14, 500, 4, 23);
  });
  _parallax(ctx, camera, 0.40, 400, (c2, ox) => {
    _henesysTrees(c2, ox, cy + vH * 0.81, vH * 0.18, 400, 4);
  });
}

// ── World 2: Ellinia Forest — night sky with stars ────────────────────────────
function _backgroundEllinia(ctx, camera, world) {
  const { x: cx, y: cy, viewW: vW, viewH: vH } = camera;
  const s = world.sky;
  const h = world.hills;

  const sky = ctx.createLinearGradient(cx, cy, cx, cy + vH);
  sky.addColorStop(0, s.top); sky.addColorStop(0.6, s.mid); sky.addColorStop(1, s.bot);
  ctx.fillStyle = sky;
  ctx.fillRect(cx - 2, cy - 2, vW + 4, vH + 4);

  // Stars
  const t = Date.now() / 1800;
  for (let i = 0; i < 70; i++) {
    const sx    = cx + ((i * 137 + 41) % (vW + 300)) - 150;
    const sy    = cy + ((i * 97  + 17) % (vH * 0.55));
    const twinkle = 0.25 + 0.75 * Math.abs(Math.sin(t + i * 0.63));
    ctx.globalAlpha = twinkle * 0.85;
    ctx.fillStyle   = i % 5 === 0 ? '#c0d8ff' : '#ffffff';
    ctx.fillRect(sx, sy, i % 4 === 0 ? 2 : 1, i % 4 === 0 ? 2 : 1);
  }
  ctx.globalAlpha = 1;

  _parallax(ctx, camera, 0.06, 1000, (c2, ox) => {
    c2.fillStyle = h.far; _peaks(c2, ox, cy + vH * 0.50, vH * 0.24, 1000, 9, 37);
  });
  _parallax(ctx, camera, 0.14, 800, (c2, ox) => {
    c2.fillStyle = h.mid1; _hills(c2, ox, cy + vH * 0.64, vH * 0.20, 800, 5, 23);
  });
  _parallax(ctx, camera, 0.14, 800, (c2, ox) => {
    c2.fillStyle = h.mid1h; _hills(c2, ox, cy + vH * 0.61, vH * 0.07, 800, 5, 23);
  });
  _parallax(ctx, camera, 0.26, 600, (c2, ox) => {
    c2.fillStyle = h.near; _hills(c2, ox, cy + vH * 0.76, vH * 0.15, 600, 4, 19);
  });
  _parallax(ctx, camera, 0.38, 450, (c2, ox) => {
    _elliniaTrees(c2, ox, cy + vH * 0.80, vH * 0.20, 450, 5);
  });
}

// ── World 3: Perion Ruins — volcanic haze ─────────────────────────────────────
function _backgroundPerion(ctx, camera, world) {
  const { x: cx, y: cy, viewW: vW, viewH: vH } = camera;
  const s = world.sky;
  const h = world.hills;

  const sky = ctx.createLinearGradient(cx, cy, cx, cy + vH);
  sky.addColorStop(0, s.top); sky.addColorStop(0.5, s.mid); sky.addColorStop(1, s.bot);
  ctx.fillStyle = sky;
  ctx.fillRect(cx - 2, cy - 2, vW + 4, vH + 4);

  // Floating embers
  const t = Date.now() / 1000;
  for (let i = 0; i < 30; i++) {
    const drift = (t * 0.18 + i * 0.3) % 1;
    const ex    = cx + ((i * 173) % (vW + 100)) - 50;
    const ey    = cy + vH * (1 - drift) - ((i * 67) % (vH * 0.4));
    const alpha = Math.max(0, Math.sin(drift * Math.PI) * 0.7);
    ctx.globalAlpha = alpha;
    ctx.fillStyle   = i % 3 === 0 ? '#ff8800' : '#ff4400';
    ctx.fillRect(ex, ey, 2, 2);
  }
  ctx.globalAlpha = 1;

  _parallax(ctx, camera, 0.05, 1000, (c2, ox) => {
    c2.fillStyle = h.far; _peaks(c2, ox, cy + vH * 0.50, vH * 0.26, 1000, 11, 53);
  });
  _parallax(ctx, camera, 0.11, 800, (c2, ox) => {
    c2.fillStyle = h.mid1; _peaks(c2, ox, cy + vH * 0.64, vH * 0.21, 800, 8, 31);
  });
  _parallax(ctx, camera, 0.11, 800, (c2, ox) => {
    c2.fillStyle = h.mid1h; _peaks(c2, ox, cy + vH * 0.60, vH * 0.08, 800, 8, 31);
  });
  _parallax(ctx, camera, 0.22, 600, (c2, ox) => {
    c2.fillStyle = h.near; _peaks(c2, ox, cy + vH * 0.76, vH * 0.16, 600, 6, 23);
  });
  _parallax(ctx, camera, 0.38, 500, (c2, ox) => {
    _perionRuins(c2, ox, cy + vH * 0.82, vH * 0.16, 500, 6);
  });
}

// ── Ellinia spooky trees with glowing tips ────────────────────────────────────
function _elliniaTrees(ctx, ox, baseY, maxH, tileW, count) {
  const spacing = tileW / count;
  for (let i = 0; i < count; i++) {
    const tx = ox + i * spacing + ((i * 137) % (spacing * 0.55));
    const th = maxH * (0.55 + (i * 41 % 45) / 100);

    // Trunk
    ctx.fillStyle = '#0e0a18';
    ctx.fillRect(tx - 4, baseY - th * 0.45, 8, th * 0.55);

    // Bare branches
    ctx.fillStyle = '#0e0a18';
    ctx.fillRect(tx - 22, baseY - th * 0.62, 18, 3);
    ctx.fillRect(tx +  4, baseY - th * 0.67, 20, 3);
    ctx.fillRect(tx - 12, baseY - th * 0.78, 12, 2);
    ctx.fillRect(tx +  2, baseY - th * 0.80, 14, 2);

    // Glowing canopy clumps (alternating purple/teal)
    const glows = ['#5010a0', '#3a0880', '#6828b0'];
    ctx.fillStyle   = glows[i % glows.length];
    ctx.shadowColor = '#9040e0';
    ctx.shadowBlur  = 10;
    ctx.beginPath();
    ctx.ellipse(tx - 12, baseY - th * 0.63, 12, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(tx + 14, baseY - th * 0.68, 14, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(tx -  6, baseY - th * 0.82, 10, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(tx +  8, baseY - th * 0.84, 11, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}

// ── Perion ruined stone columns ───────────────────────────────────────────────
function _perionRuins(ctx, ox, baseY, maxH, tileW, count) {
  const spacing = tileW / count;
  for (let i = 0; i < count; i++) {
    const rx = ox + i * spacing + ((i * 113) % (spacing * 0.55));
    const rh = maxH * (0.45 + (i * 37 % 55) / 100);
    const rw = 10 + (i * 23 % 14);

    ctx.fillStyle = '#2c1006';
    ctx.fillRect(rx - rw / 2, baseY - rh, rw, rh);
    ctx.fillStyle = '#4a2010';
    ctx.fillRect(rx - rw / 2, baseY - rh, rw * 0.28, rh);
    // Broken capital
    ctx.fillStyle = '#3a1808';
    ctx.fillRect(rx - rw / 2 - 3, baseY - rh, rw + 6, 5);
    // Glowing crack
    ctx.fillStyle = 'rgba(255,70,0,0.38)';
    ctx.fillRect(rx - 1, baseY - rh * 0.65, 2, rh * 0.32);
  }
}

/**
 * Draw one repeating parallax tile and enough neighbours to fill the viewport.
 * @param {number} f  Scroll speed (0=screen-fixed, 1=world-fixed).
 * @param {number} tW Tile width of the repeating background element.
 */
function _parallax(ctx, camera, f, tW, drawFn) {
  const cx = camera.x;
  const vW = camera.viewW;
  // Layer positions to draw (in "layer space"), then shifted to world space.
  const shift      = cx * (1 - f);          // world offset added to layer positions
  const layerStart = cx * f;                // leftmost layer coord that must be visible
  const startTile  = Math.floor(layerStart / tW) * tW;
  for (let L = startTile - tW; L < layerStart + vW + tW; L += tW) {
    drawFn(ctx, L + shift);
  }
}

function _peaks(ctx, ox, baseY, maxH, tileW, count, seed) {
  ctx.beginPath();
  ctx.moveTo(ox, baseY + maxH);
  for (let i = 0; i <= count; i++) {
    const px = ox + (i / count) * tileW;
    const h  = maxH * (0.45 + 0.55 * Math.abs(Math.sin(i * seed * 0.13 + seed)));
    ctx.lineTo(px, baseY - h + maxH);
    if (i < count) ctx.lineTo(px + tileW / count * 0.5, baseY + maxH);
  }
  ctx.lineTo(ox + tileW, baseY + maxH);
  ctx.closePath();
  ctx.fill();
}

function _hills(ctx, ox, baseY, maxH, tileW, count, seed) {
  ctx.beginPath();
  ctx.moveTo(ox, baseY + maxH);
  for (let i = 0; i <= count; i++) {
    const hx = ox + (i / count) * tileW;
    const h  = maxH * (0.5 + 0.5 * Math.sin(i * seed * 0.17 + seed));
    const nx = ox + ((i + 1) / count) * tileW;
    ctx.bezierCurveTo(
      hx + tileW / count * 0.25, baseY - h + maxH,
      nx - tileW / count * 0.25, baseY - h + maxH,
      nx, baseY + maxH,
    );
  }
  ctx.lineTo(ox + tileW, baseY + maxH);
  ctx.closePath();
  ctx.fill();
}

function _clouds(ctx, ox, baseY, vH, tileW, count) {
  const spacing = tileW / count;
  for (let i = 0; i < count; i++) {
    const cx2 = ox + i * spacing + ((i * 173) % (spacing * 0.5));
    const cy2 = baseY + ((i * 89) % (vH * 0.08));
    const cw  = 60 + (i * 37) % 80;
    const ch  = 18 + (i * 23) % 16;

    // Cloud shadow base
    ctx.fillStyle = 'rgba(190,215,255,0.55)';
    ctx.beginPath();
    ctx.ellipse(cx2 + 4, cy2 + ch * 0.45, cw * 0.52, ch * 0.48, 0, 0, Math.PI * 2);
    ctx.fill();
    // Main puff
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.beginPath();
    ctx.ellipse(cx2, cy2, cw * 0.50, ch, 0, 0, Math.PI * 2);
    ctx.fill();
    // Left bump
    ctx.beginPath();
    ctx.ellipse(cx2 - cw * 0.32, cy2 + ch * 0.22, cw * 0.30, ch * 0.75, 0, 0, Math.PI * 2);
    ctx.fill();
    // Right bump
    ctx.beginPath();
    ctx.ellipse(cx2 + cw * 0.30, cy2 + ch * 0.28, cw * 0.28, ch * 0.70, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function _henesysTrees(ctx, ox, baseY, treeH, tileW, count) {
  const spacing = tileW / count;
  for (let i = 0; i < count; i++) {
    const tx      = ox + i * spacing + ((i * 137) % (spacing * 0.6)) - spacing * 0.3;
    const th      = treeH * (0.65 + 0.35 * ((i * 31) % 10) / 10);
    const tw      = th * 0.65;
    const isSakura = i % 3 === 0;

    // Trunk
    ctx.fillStyle = '#7a5a30';
    ctx.fillRect(tx - 4, baseY - th * 0.50, 8, th * 0.52);

    if (isSakura) {
      // Cherry blossom — round pink canopy
      ctx.fillStyle = '#f880b0';
      ctx.beginPath();
      ctx.ellipse(tx, baseY - th * 0.75, tw * 0.70, th * 0.44, 0, 0, Math.PI * 2);
      ctx.fill();
      // Lighter highlight puff
      ctx.fillStyle = '#ffaad0';
      ctx.beginPath();
      ctx.ellipse(tx - tw * 0.22, baseY - th * 0.82, tw * 0.44, th * 0.28, -0.3, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Green tree — round canopy
      ctx.fillStyle = '#2e8c1e';
      ctx.beginPath();
      ctx.ellipse(tx, baseY - th * 0.72, tw * 0.65, th * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();
      // Highlight puff
      ctx.fillStyle = '#44aa30';
      ctx.beginPath();
      ctx.ellipse(tx - tw * 0.15, baseY - th * 0.78, tw * 0.42, th * 0.28, -0.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// ═════════════════════════════════════════════════════════════════════════════
//   WORLD DECORATIONS  (Henesys-style props, drawn in world space)
//   Each function draws relative to (0, 0) — caller does ctx.translate(d.x,d.y)
// ═════════════════════════════════════════════════════════════════════════════

// Hay bale — ~40 × 28 px
function _decHaybale(ctx) {
  // Drop shadow
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.ellipse(20, 27, 18, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  // Body
  ctx.fillStyle = '#c8901a';
  ctx.beginPath();
  ctx.ellipse(19, 14, 19, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  // Straw texture rings
  ctx.strokeStyle = '#a07010';
  ctx.lineWidth = 1.5;
  for (const oy of [-7, 0, 7]) {
    ctx.beginPath();
    ctx.ellipse(19, 14 + oy, 18, 2.5, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Top highlight
  ctx.fillStyle = '#e8b830';
  ctx.beginPath();
  ctx.ellipse(14, 9, 10, 6, -0.3, 0, Math.PI * 2);
  ctx.fill();
  // Rope band
  ctx.strokeStyle = '#7a5c10';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(19, 14, 19, 13, 0, 0, Math.PI * 2);
  ctx.stroke();
}

// Wooden barrel — ~24 × 30 px
function _decBarrel(ctx) {
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(12, 31, 10, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  // Body
  ctx.fillStyle = '#7a4a28';
  ctx.beginPath();
  ctx.roundRect(2, 2, 20, 28, [3, 3, 5, 5]);
  ctx.fill();
  // Wood stave highlights
  ctx.fillStyle = '#9a6038';
  ctx.fillRect(5, 4, 3, 24);
  ctx.fillRect(14, 4, 3, 24);
  // Metal bands
  ctx.fillStyle = '#3a2c18';
  ctx.fillRect(2, 5,  20, 3);
  ctx.fillRect(2, 13, 20, 3);
  ctx.fillRect(2, 21, 20, 3);
  // Top face
  ctx.fillStyle = '#6a3c20';
  ctx.beginPath();
  ctx.ellipse(12, 3, 10, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  // Band sheen
  ctx.fillStyle = '#5a4828';
  ctx.fillRect(3, 5,  3, 1.5);
  ctx.fillRect(3, 13, 3, 1.5);
  ctx.fillRect(3, 21, 3, 1.5);
}

// Wooden signpost — ~40 × 56 px (sign at top, post below)
function _decSignpost(ctx) {
  // Sign board
  ctx.fillStyle = '#b8842a';
  ctx.fillRect(0, 0, 40, 22);
  ctx.fillStyle = '#d4a040';
  ctx.fillRect(1, 1, 38, 20);
  ctx.fillStyle = '#e8be58';
  ctx.fillRect(2, 2, 36, 8);
  // Sign text
  ctx.fillStyle = '#3a2008';
  ctx.font = 'bold 9px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('▲  UP!', 20, 11);
  ctx.textBaseline = 'alphabetic';
  // Border
  ctx.strokeStyle = '#7a5018';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(0.75, 0.75, 38.5, 20.5);
  // Post
  ctx.fillStyle = '#8b6218';
  ctx.fillRect(17, 18, 7, 38);
  ctx.fillStyle = '#c89a30';
  ctx.fillRect(18, 18, 4, 38);
  // Post detail band
  ctx.fillStyle = '#7a5010';
  ctx.fillRect(16, 30, 9, 3);
}

// Flower cluster — ~42 × 20 px, seed varies petal colours
function _decFlowers(ctx, t, seed) {
  const COLORS = ['#ff80b0', '#ffe040', '#ffffff', '#ff60d0', '#ffa0f0', '#80e8ff'];
  const stems  = [{ bx: 5, by: 5 }, { bx: 15, by: 3 }, { bx: 26, by: 6 }, { bx: 36, by: 4 }];
  for (let i = 0; i < stems.length; i++) {
    const { bx, by } = stems[i];
    const sway = Math.sin(t * 1.4 + i * 1.7 + seed) * 1.5;
    const col  = COLORS[(seed * 3 + i * 2) % COLORS.length];
    // Stem
    ctx.strokeStyle = '#3a8a18';
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.moveTo(bx, 20);
    ctx.lineTo(bx + sway, by + 6);
    ctx.stroke();
    // Leaf
    ctx.fillStyle = '#50a828';
    ctx.beginPath();
    ctx.ellipse(bx + sway + 3, by + 10, 4, 2, 0.7, 0, Math.PI * 2);
    ctx.fill();
    // Petals
    ctx.fillStyle = col;
    for (let k = 0; k < 5; k++) {
      const ang = (k / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.ellipse(bx + sway + Math.cos(ang) * 4, by + 3 + Math.sin(ang) * 4, 3, 3, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // Centre
    ctx.fillStyle = '#ffee50';
    ctx.beginPath();
    ctx.arc(bx + sway, by + 3, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Tree stump — ~32 × 22 px
function _decStump(ctx) {
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.ellipse(16, 23, 14, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();
  // Body
  ctx.fillStyle = '#7a5828';
  ctx.fillRect(3, 11, 26, 11);
  // Bark texture
  ctx.fillStyle = '#5a3e18';
  ctx.fillRect(3,  13, 2, 7);
  ctx.fillRect(10, 13, 2, 7);
  ctx.fillRect(18, 13, 2, 7);
  ctx.fillRect(25, 13, 2, 7);
  // Top face
  ctx.fillStyle = '#b07838';
  ctx.beginPath();
  ctx.ellipse(16, 11, 13, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  // Growth rings
  ctx.strokeStyle = '#8a5c28';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(16, 11, 9, 3.5, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(16, 11, 5, 2, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#7a5020';
  ctx.beginPath();
  ctx.arc(16, 11, 1.5, 0, Math.PI * 2);
  ctx.fill();
  // Grass sprouts
  ctx.strokeStyle = '#50aa28';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(13, 7); ctx.lineTo(11, 3); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(16, 6); ctx.lineTo(16, 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(19, 7); ctx.lineTo(21, 3); ctx.stroke();
}

// Wooden fence — ~72 × 24 px (3 posts + 2 horizontal rails)
function _decFence(ctx) {
  for (const px of [0, 33, 66]) {
    ctx.fillStyle = '#a8822e';
    ctx.fillRect(px, 0, 6, 24);
    ctx.fillStyle = '#d4aa48';
    ctx.fillRect(px + 1, 0, 3, 22);
    ctx.fillStyle = '#c09838';
    ctx.fillRect(px, 0, 6, 3); // cap
  }
  // Rails
  ctx.fillStyle = '#b89038';
  ctx.fillRect(3, 5,  66, 4);
  ctx.fillRect(3, 15, 66, 4);
  // Rail highlights
  ctx.fillStyle = '#d8b050';
  ctx.fillRect(3, 5,  66, 1.5);
  ctx.fillRect(3, 15, 66, 1.5);
}

// Decorative toadstool — ~22 × 20 px (no eyes, not an enemy)
function _decToadstool(ctx) {
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.ellipse(11, 21, 9, 2.5, 0, 0, Math.PI * 2);
  ctx.fill();
  // Stem
  ctx.fillStyle = '#f0ead8';
  ctx.fillRect(7, 11, 8, 9);
  ctx.fillStyle = '#d8ceb8';
  ctx.fillRect(8, 11, 4, 8);
  // Cap shadow
  ctx.fillStyle = '#8a1c0e';
  ctx.beginPath();
  ctx.ellipse(12, 12, 12, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  // Cap main
  ctx.fillStyle = '#d82e18';
  ctx.beginPath();
  ctx.ellipse(11, 11, 12, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  // Highlight
  ctx.fillStyle = '#f04828';
  ctx.beginPath();
  ctx.ellipse(7, 8, 6, 4, -0.4, 0, Math.PI * 2);
  ctx.fill();
  // White spots
  ctx.fillStyle = '#fffff2';
  ctx.beginPath(); ctx.arc(6,  9, 2.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(15, 11, 2,   0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(11,  6, 1.5, 0, Math.PI * 2); ctx.fill();
  // Cap brim
  ctx.fillStyle = '#e8cec0';
  ctx.fillRect(1, 17, 20, 2.5);
}

// Wooden crate — 28 × 28 px
function _decCrate(ctx) {
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(2, 27, 26, 3);
  // Body
  ctx.fillStyle = '#9a7038';
  ctx.fillRect(0, 0, 28, 28);
  // Plank frames
  ctx.fillStyle = '#b88c50';
  ctx.fillRect(0,   0, 28,  6);
  ctx.fillRect(0,  22, 28,  6);
  ctx.fillRect(0,   0,  6, 28);
  ctx.fillRect(22,  0,  6, 28);
  // X brace
  ctx.strokeStyle = '#7a5828';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(6, 6); ctx.lineTo(22, 22); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(22, 6); ctx.lineTo(6, 22); ctx.stroke();
  // Border
  ctx.strokeStyle = '#6a4820';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, 26, 26);
  // Corner nails
  ctx.fillStyle = '#4a3010';
  for (const [nx, ny] of [[2, 2], [22, 2], [2, 22], [22, 22]]) {
    ctx.fillRect(nx, ny, 3, 3);
  }
}

// Glowing lantern on post — ~16 × 40 px
function _decLantern(ctx, t) {
  const flicker = 0.85 + 0.15 * Math.sin(t * 7.3 + 2.1);
  // Pole
  ctx.fillStyle = '#404040';
  ctx.fillRect(6, 12, 4, 28);
  ctx.fillStyle = '#686868';
  ctx.fillRect(7, 12, 2, 28);
  // Frame
  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(1,  0, 14,  4);   // top cap
  ctx.fillRect(1, 22, 14,  4);   // bottom cap
  ctx.fillRect(1,  4,  3, 18);   // left frame
  ctx.fillRect(12, 4,  3, 18);   // right frame
  ctx.fillRect(7,  4,  2, 18);   // centre mullion
  // Hook ring
  ctx.strokeStyle = '#484848';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(8, 1, 3, Math.PI, 0);
  ctx.stroke();
  // Amber glass + glow
  ctx.save();
  ctx.shadowColor = '#ff9820';
  ctx.shadowBlur  = 14 * flicker;
  ctx.globalAlpha = 0.75 * flicker;
  ctx.fillStyle   = '#ffaa30';
  ctx.fillRect(4, 5, 3, 16);
  ctx.fillRect(9, 5, 3, 16);
  ctx.globalAlpha = 1;
  ctx.shadowBlur  = 0;
  // Warm glow pool on ground below
  ctx.globalAlpha = 0.15 * flicker;
  ctx.fillStyle   = '#ffbb40';
  ctx.beginPath();
  ctx.ellipse(8, 44, 22, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
function _drawBtn(ctx, x, y, w, h, label, color = '#fff') {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#000';
  ctx.font = `bold ${Math.floor(h * 0.45)}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + w / 2, y + h / 2);
  ctx.textBaseline = 'alphabetic';
}
