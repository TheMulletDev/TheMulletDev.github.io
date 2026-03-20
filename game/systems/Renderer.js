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
  }

  drawPlayer(ctx, player) {
    const { x, y, w, h, facing, state, invincible, attackTimer, weapon } = player;

    const now = Date.now();
    const dt  = Math.min((now - this._lastTime) / 1000, 0.05);
    this._lastTime = now;

    // Weapon-aware colours for arc and particles
    const weaponColor = weapon?.color ?? '#a78bfa';
    const PARTICLE_PALETTES = {
      iron_sword: ['#e8c84a', '#ffd700', '#fff9a0', '#fbbf24', '#ffffff'],
      magic_wand:  ['#c084fc', '#e879f9', '#818cf8', '#a5f3fc', '#ffffff'],
    };
    const particleColors = PARTICLE_PALETTES[weapon?.id] ?? ['#a78bfa', '#c4b5fd', '#7dd3fc', '#f0abfc', '#ffffff', '#818cf8'];

    // ── Spawn magic particles on attack start ────────────────────────────────
    const isAttacking = state === 'attack';
    if (isAttacking && !this._wasAttacking) {
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
    _player(ctx, state, frame, attackTimer, weaponColor);

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
    if (type === 'slime')         _slime(ctx, w, h, frame);
    else if (type === 'mushroom') _mushroom(ctx, w, h, frame);

    ctx.restore();
  }

  drawBackground(ctx, camera, worldW, worldH) {
    _background(ctx, camera, worldW, worldH);
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

  drawMobileControls(ctx, canvasW, canvasH) {
    const btnW   = canvasW * 0.16;
    const btnH   = canvasH * 0.16;
    const padBot = canvasH * 0.04;
    const leftX  = canvasW * 0.04;
    const rightX = leftX + btnW + canvasW * 0.02;
    const btnY   = canvasH - btnH - padBot;

    const btnSize = Math.min(canvasW, canvasH) * 0.14;
    const rpad    = canvasH * 0.04;
    const potionX = canvasW - btnSize * 3 - rpad * 3;
    const jumpX   = canvasW - btnSize * 2 - rpad * 2;
    const attackX = canvasW - btnSize - rpad;
    const rbtnY   = canvasH - btnSize - rpad;

    ctx.globalAlpha = 0.35;
    _drawBtn(ctx, leftX,   btnY,   btnW,    btnH,    '◀');
    _drawBtn(ctx, rightX,  btnY,   btnW,    btnH,    '▶');
    _drawBtn(ctx, potionX, rbtnY,  btnSize, btnSize, 'P', '#f0abfc');
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
function _player(ctx, state, frame, attackTimer = 0, weaponColor = '#a78bfa') {

  // ── Mullet (back of head, long hanging strand) ────────────────────────────
  ctx.fillStyle = C.hairD;
  p(ctx, 0, 1, 2, 2);   // dark base block
  p(ctx, 0, 3, 1, 3);   // long dark strand
  ctx.fillStyle = C.hairM;
  p(ctx, 0, 0, 2, 2);   // upper mullet body
  p(ctx, 1, 3, 1, 2);   // mid-strand highlight
  ctx.fillStyle = C.hairL;
  p(ctx, 0, 2, 1, 1);   // sheen fleck

  // ── Hair on top (business in front) ──────────────────────────────────────
  ctx.fillStyle = C.hairD;
  p(ctx, 2, 0, 6, 1);
  ctx.fillStyle = C.hairM;
  p(ctx, 2, 0, 5, 1);
  ctx.fillStyle = C.hairL;
  p(ctx, 3, 0, 3, 1);   // top highlight

  // ── Face ──────────────────────────────────────────────────────────────────
  ctx.fillStyle = C.skin;
  p(ctx, 2, 1, 6, 3);   // face block
  ctx.fillStyle = C.skinD;
  p(ctx, 2, 4, 6, 1);   // chin shadow

  // Eye — col 6 is near the front (right) when facing right
  ctx.fillStyle = C.eye;
  p(ctx, 6, 2, 1, 1);
  ctx.fillStyle = '#fff';
  ctx.fillRect(6 * S + 2, 2 * S, 1, 1);  // tiny pupil glint

  // ── Shirt ─────────────────────────────────────────────────────────────────
  ctx.fillStyle = C.shirtD;
  p(ctx, 2, 5, 6, 3);
  ctx.fillStyle = C.shirtM;
  p(ctx, 2, 5, 5, 3);
  ctx.fillStyle = '#ff6659';            // collar highlight pixel
  p(ctx, 2, 5, 1, 1);

  // Belt
  ctx.fillStyle = C.belt;
  p(ctx, 2, 8, 6, 1);

  // ── Legs ──────────────────────────────────────────────────────────────────
  // back leg: cols 2–3   front leg: cols 5–6
  // Walk cycle: 0=neutral 1=back up 2=neutral 3=front up
  if (state === 'jump') {
    ctx.fillStyle = C.pantsM;
    p(ctx, 2, 9,  2, 2);   // back leg tucked
    p(ctx, 5, 10, 2, 2);   // front leg tucked lower
    ctx.fillStyle = C.bootM;
    p(ctx, 2, 11, 2, 1);
    p(ctx, 5, 12, 2, 1);

  } else if (state === 'fall') {
    ctx.fillStyle = C.pantsM;
    p(ctx, 1, 9,  2, 3);   // legs spread
    p(ctx, 6, 9,  2, 3);
    ctx.fillStyle = C.bootM;
    p(ctx, 1, 12, 2, 1);
    p(ctx, 6, 12, 2, 1);

  } else {
    // idle / walk / attack
    const bOff = (state === 'walk' && (frame === 1)) ? 1 : 0;
    const fOff = (state === 'walk' && (frame === 3)) ? 1 : 0;
    const bLen = 3 - bOff;
    const fLen = 3 - fOff;

    ctx.fillStyle = C.pantsD;
    p(ctx, 2, 9 + bOff, 2, bLen);   // back leg (darker)
    ctx.fillStyle = C.pantsM;
    p(ctx, 5, 9 + fOff, 2, fLen);   // front leg

    ctx.fillStyle = C.bootD;
    p(ctx, 2, 9 + bOff + bLen, 2, 1);
    ctx.fillStyle = C.bootM;
    p(ctx, 5, 9 + fOff + fLen, 2, 1);
  }

  // ── Attack slash ──────────────────────────────────────────────────────────
  if (state === 'attack') {
    const ATTACK_DUR = 0.25;
    const t = 1 - Math.max(0, attackTimer / ATTACK_DUR); // 0 → 1 during attack

    const arcCx = 9 * S + 4; // 40
    const arcCy = 5 * S;     // 20

    // Arc sweeps from upper-right downward as t goes 0→1
    const startAngle = -1.5 + t * 0.5;
    const endAngle   = startAngle + 0.8 + t * 1.0;

    const pulse = 0.5 + 0.5 * Math.sin(t * Math.PI);

    ctx.save();
    ctx.lineCap = 'round';

    // Outer glow arc — colour driven by equipped weapon
    ctx.globalAlpha = 0.45 + 0.45 * pulse;
    ctx.strokeStyle = weaponColor;
    ctx.lineWidth   = 11;
    ctx.shadowColor = weaponColor;
    ctx.shadowBlur  = 20 + 8 * pulse;
    ctx.beginPath();
    ctx.arc(arcCx, arcCy, 38, startAngle, endAngle);
    ctx.stroke();

    // Mid arc
    ctx.globalAlpha = 0.65 + 0.3 * pulse;
    ctx.lineWidth   = 5;
    ctx.shadowBlur  = 10;
    ctx.beginPath();
    ctx.arc(arcCx, arcCy, 31, startAngle + 0.08, endAngle - 0.05);
    ctx.stroke();

    // Bright white core (always white)
    ctx.globalAlpha = 0.75 * pulse;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth   = 2;
    ctx.shadowColor = '#fff';
    ctx.shadowBlur  = 6;
    ctx.beginPath();
    ctx.arc(arcCx, arcCy, 25, startAngle + 0.15, endAngle - 0.1);
    ctx.stroke();

    // Leading-edge flash: small bright dot at the tip of the sweep
    if (t > 0.05 && t < 0.92) {
      const tipX = arcCx + Math.cos(endAngle) * 36;
      const tipY = arcCy + Math.sin(endAngle) * 36;
      ctx.fillStyle   = 'rgba(255,255,255,0.95)';
      ctx.shadowColor = '#c4b5fd';
      ctx.shadowBlur  = 14;
      ctx.beginPath();
      ctx.arc(tipX, tipY, 3 + 2 * (1 - t), 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}

// ═════════════════════════════════════════════════════════════════════════════
//   SLIME   32 × 28
// ═════════════════════════════════════════════════════════════════════════════
function _slime(ctx, w, h, frame) {
  const bounce = frame === 0 ? 0 : -3;
  const squash = frame === 1 ? 3 : 0;
  const cy = h * 0.62 + bounce;
  const rx = w * 0.46;
  const ry = h * 0.40 + squash;

  // Ground shadow
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.ellipse(w / 2, h - 3, rx * 0.7, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Body shadow layer
  ctx.fillStyle = C.slimeD;
  ctx.beginPath();
  ctx.ellipse(w / 2 + 2, cy + 3, rx * 0.88, ry * 0.8, 0, 0, Math.PI * 2);
  ctx.fill();

  // Main body
  ctx.fillStyle = C.slimeM;
  ctx.beginPath();
  ctx.ellipse(w / 2, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();

  // Sheen highlight
  ctx.fillStyle = C.slimeL;
  ctx.beginPath();
  ctx.ellipse(w * 0.33, cy - ry * 0.28, rx * 0.28, ry * 0.22, -0.4, 0, Math.PI * 2);
  ctx.fill();

  // Antenna nub
  ctx.fillStyle = C.slimeM;
  ctx.fillRect(w * 0.45, cy - ry - 5, 4, 5);
  ctx.fillStyle = C.slimeL;
  ctx.fillRect(w * 0.44, cy - ry - 6, 5, 3);

  // Eyes
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

  // Bottom drip
  ctx.fillStyle = C.slimeM;
  ctx.fillRect(w * 0.58, cy + ry - 3, 3, 7);
  ctx.fillRect(w * 0.58 - 1, cy + ry + 3, 5, 3);
}

// ═════════════════════════════════════════════════════════════════════════════
//   MUSHROOM   34 × 42
// ═════════════════════════════════════════════════════════════════════════════
function _mushroom(ctx, w, h, frame) {
  const bob = frame === 0 ? 0 : -1;

  // ── Cap ───────────────────────────────────────────────────────────────────
  const capCx = w / 2;
  const capCy = h * 0.30 + bob;
  const capRx = w * 0.50;
  const capRy = h * 0.33;

  ctx.fillStyle = C.capD;
  ctx.beginPath();
  ctx.ellipse(capCx + 2, capCy + 3, capRx, capRy, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = C.capM;
  ctx.beginPath();
  ctx.ellipse(capCx, capCy, capRx, capRy, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = C.capL;
  ctx.beginPath();
  ctx.ellipse(capCx - capRx * 0.22, capCy - capRy * 0.25, capRx * 0.28, capRy * 0.22, -0.3, 0, Math.PI * 2);
  ctx.fill();

  // Spots
  ctx.fillStyle = C.spot;
  _oval(ctx, capCx - capRx * 0.35, capCy - capRy * 0.05, 5, 4);
  _oval(ctx, capCx + capRx * 0.25, capCy - capRy * 0.20, 4, 3);
  _oval(ctx, capCx + capRx * 0.05, capCy + capRy * 0.15, 3, 3);

  // Cap brim edge
  ctx.fillStyle = C.capD;
  ctx.fillRect(capCx - capRx * 0.9, capCy + capRy * 0.7, capRx * 1.8, 4);

  // ── Stem ──────────────────────────────────────────────────────────────────
  const stemX = w * 0.18;
  const stemW = w * 0.64;
  const stemY = h * 0.58 + bob;
  const stemH = h * 0.42;

  ctx.fillStyle = C.stemD;
  ctx.fillRect(stemX + 2, stemY + 2, stemW, stemH);
  ctx.fillStyle = C.stemM;
  ctx.fillRect(stemX, stemY, stemW, stemH);
  ctx.fillStyle = '#fffff0';
  ctx.fillRect(stemX + stemW * 0.15, stemY, stemW * 0.18, stemH);  // highlight strip

  // Eyes (front = right side)
  ctx.fillStyle = '#333';
  ctx.fillRect(w * 0.55, stemY + stemH * 0.20, 5, 5);
  ctx.fillStyle = '#fff';
  ctx.fillRect(w * 0.56, stemY + stemH * 0.20, 2, 2);

  // ── Stumpy legs ───────────────────────────────────────────────────────────
  const legW = stemW * 0.30;
  const legH = stemH * 0.28;
  const legY = stemY + stemH - 2;

  ctx.fillStyle = C.stemD;
  ctx.fillRect(stemX - 2,             legY + (frame === 0 ? 0 : 2),  legW, legH - (frame === 0 ? 0 : 2));
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
function _background(ctx, camera, worldW, worldH) {
  const { x: cx, y: cy, viewW: vW, viewH: vH } = camera;

  // ── Bright Henesys daytime sky ────────────────────────────────────────────
  const sky = ctx.createLinearGradient(cx, cy, cx, cy + vH);
  sky.addColorStop(0,    '#4ab8f8');
  sky.addColorStop(0.55, '#82d4fa');
  sky.addColorStop(1,    '#c8ecff');
  ctx.fillStyle = sky;
  ctx.fillRect(cx - 2, cy - 2, vW + 4, vH + 4);

  // ── Fluffy clouds — two layers at different depths ────────────────────────
  _parallax(ctx, camera, 0.05, 800, (c2, ox) => {
    _clouds(c2, ox, cy + vH * 0.06, vH, 800, 4);
  });
  _parallax(ctx, camera, 0.12, 600, (c2, ox) => {
    _clouds(c2, ox, cy + vH * 0.20, vH, 600, 3);
  });

  // ── Distant mountains (soft periwinkle) ───────────────────────────────────
  _parallax(ctx, camera, 0.08, 900, (c2, ox) => {
    c2.fillStyle = '#b0c4e8';
    _peaks(c2, ox, cy + vH * 0.55, vH * 0.20, 900, 7, 41);
  });

  // ── Mid rolling hills (bright green) ─────────────────────────────────────
  _parallax(ctx, camera, 0.18, 700, (c2, ox) => {
    c2.fillStyle = '#5abe38';
    _hills(c2, ox, cy + vH * 0.66, vH * 0.18, 700, 5, 29);
  });
  // Hill highlight pass
  _parallax(ctx, camera, 0.18, 700, (c2, ox) => {
    c2.fillStyle = '#72da50';
    _hills(c2, ox, cy + vH * 0.64, vH * 0.06, 700, 5, 29);
  });

  // ── Near hills (vivid green) ──────────────────────────────────────────────
  _parallax(ctx, camera, 0.30, 500, (c2, ox) => {
    c2.fillStyle = '#3ea828';
    _hills(c2, ox, cy + vH * 0.77, vH * 0.14, 500, 4, 23);
  });

  // ── Henesys trees — mix of green round trees and pink sakura ─────────────
  _parallax(ctx, camera, 0.40, 400, (c2, ox) => {
    _henesysTrees(c2, ox, cy + vH * 0.81, vH * 0.18, 400, 4);
  });
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
