/**
 * Draws all game entities using procedural pixel-art shapes.
 * Replace with spritesheet draws once assets exist.
 */
export class Renderer {
  drawPlayer(ctx, player) {
    const { x, y, w, h, facing, state, invincible } = player;
    const cx = x + w / 2;

    // Flicker when invincible
    if (invincible && Math.floor(Date.now() / 80) % 2 === 0) return;

    ctx.save();
    ctx.translate(cx, y + h);
    ctx.scale(facing, 1);
    ctx.translate(-w / 2, -h);

    // Body
    ctx.fillStyle = '#d44';
    ctx.fillRect(8, h * 0.35, w - 16, h * 0.42);

    // Head
    ctx.fillStyle = '#f9c';
    ctx.fillRect(6, 0, w - 12, h * 0.38);

    // Hair (mullet!)
    ctx.fillStyle = '#8b2';
    ctx.fillRect(4, 0, w - 8, h * 0.15);
    // The business in the front
    ctx.fillRect(4, 0, 8, h * 0.22);
    // The party in the back
    ctx.fillRect(w - 10, 0, 8, h * 0.42);

    // Eyes
    ctx.fillStyle = '#222';
    ctx.fillRect(w - 16, h * 0.12, 5, 5);

    // Legs
    ctx.fillStyle = '#448';
    const legAnim = state === 'walk' ? Math.sin(Date.now() / 120) * 6 : 0;
    ctx.fillRect(8,  h * 0.77, (w - 18) / 2, h * 0.23 + legAnim);
    ctx.fillRect(8 + (w - 18) / 2 + 2, h * 0.77, (w - 18) / 2, h * 0.23 - legAnim);

    // Attack slash
    if (state === 'attack') {
      ctx.strokeStyle = 'rgba(255,220,80,0.85)';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(w + 4, h * 0.4, 28, -0.9, 0.9);
      ctx.stroke();
    }

    ctx.restore();
  }

  drawEnemy(ctx, enemy) {
    if (enemy.dead && enemy.deathTimer <= 0) return;
    const { x, y, w, h, type, facing, hurtTimer, dead } = enemy;

    ctx.save();
    ctx.globalAlpha = dead ? Math.max(0, enemy.deathTimer * 2) : 1;

    if (hurtTimer > 0) {
      ctx.filter = 'brightness(3)';
    }

    if (type === 'slime') {
      // Body blob
      ctx.fillStyle = enemy.color;
      ctx.beginPath();
      ctx.ellipse(x + w / 2, y + h * 0.6, w * 0.5, h * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
      // Eyes
      ctx.fillStyle = '#fff';
      ctx.fillRect(x + w * 0.2, y + h * 0.3, 7, 7);
      ctx.fillRect(x + w * 0.55, y + h * 0.3, 7, 7);
      ctx.fillStyle = '#000';
      ctx.fillRect(x + w * 0.22 + (facing === 1 ? 2 : 0), y + h * 0.32, 4, 4);
      ctx.fillRect(x + w * 0.57 + (facing === 1 ? 2 : 0), y + h * 0.32, 4, 4);
    } else if (type === 'mushroom') {
      // Cap
      ctx.fillStyle = '#c84';
      ctx.beginPath();
      ctx.ellipse(x + w / 2, y + h * 0.35, w * 0.5, h * 0.38, 0, 0, Math.PI * 2);
      ctx.fill();
      // Spots
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.ellipse(x + w * 0.3, y + h * 0.22, 5, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(x + w * 0.65, y + h * 0.28, 4, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      // Stem / body
      ctx.fillStyle = '#f9c';
      ctx.fillRect(x + w * 0.2, y + h * 0.55, w * 0.6, h * 0.45);
      // Eyes
      ctx.fillStyle = '#222';
      const ex = facing === 1 ? x + w * 0.55 : x + w * 0.25;
      ctx.fillRect(ex, y + h * 0.6, 5, 5);
    }

    ctx.restore();
  }

  drawBackground(ctx, camera, worldW, worldH) {
    // Sky gradient
    const grad = ctx.createLinearGradient(0, 0, 0, worldH);
    grad.addColorStop(0, '#1a1a3e');
    grad.addColorStop(0.6, '#2d4a7a');
    grad.addColorStop(1, '#1e3a1e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, worldW, worldH);

    // Parallax stars (static layer)
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    for (let i = 0; i < 80; i++) {
      const sx = ((i * 173.7) % worldW);
      const sy = ((i * 97.3) % (worldH * 0.55));
      ctx.fillRect(sx, sy, 2, 2);
    }
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
    const btnW   = canvasW * 0.12;
    const btnH   = canvasH * 0.12;
    const padBot = canvasH * 0.04;
    const leftX  = canvasW * 0.04;
    const rightX = leftX + btnW + canvasW * 0.02;
    const btnY   = canvasH - btnH - padBot;

    const btnSize = Math.min(canvasW, canvasH) * 0.10;
    const rpad    = canvasH * 0.04;
    const jumpX   = canvasW - btnSize * 2 - rpad * 2;
    const attackX = canvasW - btnSize - rpad;
    const rbtnY   = canvasH - btnSize - rpad;

    ctx.globalAlpha = 0.35;

    _drawBtn(ctx, leftX,  btnY, btnW, btnH, '◀');
    _drawBtn(ctx, rightX, btnY, btnW, btnH, '▶');
    _drawBtn(ctx, jumpX,   rbtnY, btnSize, btnSize, '↑', '#4af');
    _drawBtn(ctx, attackX, rbtnY, btnSize, btnSize, 'A', '#fa4');

    ctx.globalAlpha = 1;
  }
}

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
