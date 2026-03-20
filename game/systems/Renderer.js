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
  drawPlayer(ctx, player) {
    const { x, y, w, h, facing, state, invincible } = player;
    if (invincible && Math.floor(Date.now() / 80) % 2 === 0) return;

    ctx.save();
    ctx.translate(x + w / 2, y + h);
    ctx.scale(facing, 1);
    ctx.translate(-w / 2, -h);

    const frame = state === 'walk' ? Math.floor(Date.now() / 110) % 4 : 0;
    _player(ctx, state, frame);

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
    const jumpX   = canvasW - btnSize * 2 - rpad * 2;
    const attackX = canvasW - btnSize - rpad;
    const rbtnY   = canvasH - btnSize - rpad;

    ctx.globalAlpha = 0.35;
    _drawBtn(ctx, leftX,   btnY,   btnW,    btnH,    '◀');
    _drawBtn(ctx, rightX,  btnY,   btnW,    btnH,    '▶');
    _drawBtn(ctx, jumpX,   rbtnY,  btnSize, btnSize, '↑', '#4af');
    _drawBtn(ctx, attackX, rbtnY,  btnSize, btnSize, 'A', '#fa4');
    ctx.globalAlpha = 1;
  }
}

// ═════════════════════════════════════════════════════════════════════════════
//   PLAYER   9 cols × 13 rows @ S=4  →  36 × 52 px
//
//   Left side (cols 0–1) = back of head  →  mullet lives here.
//   Right side (col 6–7) = front / face direction.
// ═════════════════════════════════════════════════════════════════════════════
function _player(ctx, state, frame) {

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
    ctx.save();
    ctx.strokeStyle = 'rgba(255,230,60,0.92)';
    ctx.lineWidth = 7;
    ctx.shadowColor = '#ffe000';
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(9 * S + 4, 5 * S, 34, -1.1, 0.7);
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#fffde7';
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(9 * S + 4, 5 * S, 28, -0.9, 0.5);
    ctx.stroke();
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
  const t = Date.now();

  // ── Sky gradient (fill visible area only) ────────────────────────────────
  const sky = ctx.createLinearGradient(cx, cy, cx, cy + vH);
  sky.addColorStop(0,    '#06061a');
  sky.addColorStop(0.45, '#1a237e');
  sky.addColorStop(1,    '#2e3f6f');
  ctx.fillStyle = sky;
  ctx.fillRect(cx - 2, cy - 2, vW + 4, vH + 4);

  // ── Stars ─────────────────────────────────────────────────────────────────
  // World-positioned so they don't shift as the camera moves.
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  for (let i = 0; i < 300; i++) {
    const sx = (i * 211.3 + 7)  % worldW;
    const sy = (i * 97.7  + 13) % (worldH * 0.40);
    ctx.fillRect(sx, sy, i % 4 === 0 ? 2 : 1, i % 4 === 0 ? 2 : 1);
  }
  // Twinkling accent stars
  ctx.fillStyle = 'rgba(255,255,200,0.95)';
  for (let i = 0; i < 18; i++) {
    if (Math.floor((t / 650 + i * 0.61) % 2) === 0) {
      const sx = (i * 347.1) % worldW;
      const sy = (i * 163.7) % (worldH * 0.35);
      ctx.fillRect(sx, sy, 2, 2);
    }
  }

  // ── Parallax layer helpers ────────────────────────────────────────────────
  // f = scroll speed factor: 0 = fixed to screen, 1 = fixed to world.
  // baseY is in world coordinates for the current camera view.

  // Layer 1 — very far mountains
  _parallax(ctx, camera, 0.08, 900, (c2, ox) => {
    c2.fillStyle = '#161840';
    _peaks(c2, ox, cy + vH * 0.50, vH * 0.22, 900, 7, 41);
  });

  // Layer 2 — mid mountains
  _parallax(ctx, camera, 0.16, 700, (c2, ox) => {
    c2.fillStyle = '#1e2d5e';
    _peaks(c2, ox, cy + vH * 0.60, vH * 0.18, 700, 9, 37);
  });

  // Layer 3 — rolling hills
  _parallax(ctx, camera, 0.30, 500, (c2, ox) => {
    c2.fillStyle = '#0f2a0f';
    _hills(c2, ox, cy + vH * 0.74, vH * 0.14, 500, 5, 29);
  });

  // Layer 4 — tree silhouettes
  _parallax(ctx, camera, 0.40, 400, (c2, ox) => {
    _treeLine(c2, ox, cy + vH * 0.80, vH * 0.15, 400, 4);
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

function _treeLine(ctx, ox, baseY, treeH, tileW, count) {
  const spacing = tileW / count;
  for (let i = 0; i < count; i++) {
    const tx = ox + i * spacing + ((i * 137) % (spacing * 0.6)) - spacing * 0.3;
    const th = treeH * (0.65 + 0.35 * ((i * 31) % 10) / 10);
    const tw = th * 0.55;
    // Trunk
    ctx.fillStyle = '#1a0f06';
    ctx.fillRect(tx - 3, baseY - th * 0.45, 6, th * 0.48);
    // Lower canopy
    ctx.fillStyle = '#0a1f0a';
    ctx.beginPath();
    ctx.moveTo(tx, baseY - th);
    ctx.lineTo(tx - tw * 1.1, baseY - th * 0.45);
    ctx.lineTo(tx + tw * 1.1, baseY - th * 0.45);
    ctx.closePath();
    ctx.fill();
    // Upper canopy (wider)
    ctx.fillStyle = '#0d2a0d';
    ctx.beginPath();
    ctx.moveTo(tx, baseY - th * 0.65);
    ctx.lineTo(tx - tw * 1.4, baseY - th * 0.20);
    ctx.lineTo(tx + tw * 1.4, baseY - th * 0.20);
    ctx.closePath();
    ctx.fill();
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
