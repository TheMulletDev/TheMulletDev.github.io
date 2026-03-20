export class Input {
  constructor(canvas) {
    this.keys = {};
    this.virtual = { left: false, right: false, jump: false, attack: false, usePotion: false };
    this._touches = new Map();

    // Keyboard
    window.addEventListener('keydown', e => { this.keys[e.code] = true; });
    window.addEventListener('keyup',   e => { this.keys[e.code] = false; });

    // Touch
    canvas.el.addEventListener('touchstart',  e => this._onTouch(e), { passive: false });
    canvas.el.addEventListener('touchmove',   e => this._onTouch(e), { passive: false });
    canvas.el.addEventListener('touchend',    e => this._onTouchEnd(e), { passive: false });
    canvas.el.addEventListener('touchcancel', e => this._onTouchEnd(e), { passive: false });

    this._canvas = canvas;
  }

  _onTouch(e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      this._touches.set(t.identifier, { x: t.clientX, y: t.clientY });
    }
    this._evalVirtual();
  }

  _onTouchEnd(e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      this._touches.delete(t.identifier);
    }
    this._evalVirtual();
  }

  _evalVirtual() {
    this.virtual.left      = false;
    this.virtual.right     = false;
    this.virtual.jump      = false;
    this.virtual.attack    = false;
    this.virtual.usePotion = false;

    const w = this._canvas.width;
    const h = this._canvas.height;

    for (const { x, y } of this._touches.values()) {
      // Left half = movement
      if (x < w / 2) {
        const btnW = w * 0.16;
        const btnH = h * 0.16;
        const btnY = h - btnH - h * 0.04;
        const leftX  = w * 0.04;
        const rightX = w * 0.04 + btnW + w * 0.02;

        if (y > btnY - btnH && x > leftX  && x < leftX  + btnW) this.virtual.left  = true;
        if (y > btnY - btnH && x > rightX && x < rightX + btnW) this.virtual.right = true;
      } else {
        // Right half = action buttons
        const btnSize = Math.min(w, h) * 0.14;
        const pad = h * 0.04;
        const potionX = w - btnSize * 3 - pad * 3;
        const jumpX   = w - btnSize * 2 - pad * 2;
        const attackX = w - btnSize - pad;
        const btnY    = h - btnSize - pad;

        if (x > potionX && x < potionX + btnSize && y > btnY && y < btnY + btnSize) this.virtual.usePotion = true;
        if (x > jumpX   && x < jumpX   + btnSize && y > btnY && y < btnY + btnSize) this.virtual.jump      = true;
        if (x > attackX && x < attackX + btnSize && y > btnY && y < btnY + btnSize) this.virtual.attack    = true;
      }
    }
  }

  isLeft()   { return this.keys['ArrowLeft']  || this.keys['KeyA'] || this.virtual.left;   }
  isRight()  { return this.keys['ArrowRight'] || this.keys['KeyD'] || this.virtual.right;  }
  isJump()   { return this.keys['ArrowUp'] || this.keys['KeyW'] || this.keys['Space'] || this.virtual.jump;  }
  isAttack()    { return this.keys['KeyZ'] || this.keys['KeyF'] || this.virtual.attack; }
  isUsePotion() { return this.keys['KeyE'] || this.virtual.usePotion; }

  /** Call once per frame after reading state — clears one-shot inputs */
  flush() {
    // nothing persistent to clear yet
  }
}
