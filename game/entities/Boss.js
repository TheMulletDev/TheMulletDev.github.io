/**
 * Boss — "The Ancient One"
 *
 * A three-phase stone golem boss with Zakum-inspired mechanics.
 *
 * Phases (based on HP fraction):
 *   Phase 1  (100 % → 67 %)  patrol · attack · slam · summon
 *   Phase 2  (66  % → 34 %)  above + volley   (shield begins to crack)
 *   Phase 3  (33  % →  0 %)  patrol · attack · slam · volley · charge  (enraged)
 *
 * Shield mechanic:
 *   While the player is below BOSS_SHIELD_LEVEL, incoming damage is reduced
 *   by 90 %.  GameScene applies this before calling takeDamage() so the
 *   shield level can be surfaced in the HUD without coupling to Player.
 *
 * Pending arrays (drained by GameScene each frame):
 *   pendingMinions     — { type, x, y }  objects for summon action
 *   pendingProjectiles — { x, y, vx, vy, damage, life }  for volley action
 */

import { Entity } from './Entity.js';

export const BOSS_SHIELD_LEVEL = 7;  // player.level required to break the shield

const BOSS_HP = 4000;

const PHASE2_HP = BOSS_HP * 0.667;
const PHASE3_HP = BOSS_HP * 0.333;

// Per-phase config.
// Numeric values are cooldown seconds; null means that move is locked this phase.
const PHASE = [
  null, // index 0 unused
  { spd: 65,  attack: 3.5, slam: 7.5,  summon: 14.0, volley: null, charge: null  },
  { spd: 95,  attack: 2.5, slam: 5.5,  summon: 12.0, volley: 4.5,  charge: null  },
  { spd: 120, attack: 1.8, slam: 6.5,  summon: null,  volley: 3.5,  charge: 7.0  },
];

export class Boss extends Entity {
  constructor(x, y) {
    super(x, y, 96, 90);
    this.maxHp = BOSS_HP;
    this.hp    = BOSS_HP;
    this.dead  = false;
    this.facing = -1; // starts facing left

    // Damage dealt on contact in 'attack' and 'charge' states
    this.meleeDmg  = 80;
    this.chargeDmg = 110;

    // Shield state (set each frame by GameScene based on player.level)
    this.shieldActive = true;

    // AI state machine
    this._state     = 'spawn';
    this._stateTimer = 0;
    this._phase     = 1;

    // Per-action cooldowns (seconds remaining)
    this._cd = { attack: 0, slam: 0, summon: 0, volley: 0, charge: 0 };

    // Patrol direction (+1 = right, -1 = left)
    this._patrolDir = 1;

    // Sub-state for slam ('windup' | 'rise' | 'fall' | 'impact')
    this._slamPhase = 'windup';

    // One-shot flags reset in _setState()
    this._summonSpawned = false;
    this._volleyFired   = false;

    // Charge sub-state ('windup' | 'dash')
    this._chargePhase = 'windup';
    this._chargeDir   = 1;
    this._chargeTimer = 0;

    // Shockwave (ground-level AoE, driven by GameScene)
    this.shockwaveActive = false;
    this.shockwaveTimer  = 0;
    this.shockwaveDamage = 70;

    // Visual hurt flash
    this.hurtTimer = 0;

    // Phase-transition announcement shown in HUD
    this.phaseMessage     = null; // { text, color, timer }
    this._phase2Done      = false;
    this._phase3Done      = false;

    // Pending spawn data — drained by GameScene
    this.pendingMinions     = [];
    this.pendingProjectiles = [];

    // Death timer (counts up after dead = true)
    this.deadTimer = 0;
  }

  // ── Read-only computed phase ───────────────────────────────────────────────

  get phase() {
    if (this.hp > PHASE2_HP) return 1;
    if (this.hp > PHASE3_HP) return 2;
    return 3;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /** Called by GameScene with damage already adjusted for shield. */
  takeDamage(amount) {
    if (this.dead || this._state === 'spawn') return;
    this.hp        = Math.max(0, this.hp - amount);
    this.hurtTimer = 0.12;
    if (this.hp <= 0) {
      this.hp   = 0;
      this.dead = true;
      this._setState('dead');
    }
  }

  // ── Main update ────────────────────────────────────────────────────────────

  update(dt, player) {
    this._stateTimer += dt;
    this.hurtTimer    = Math.max(0, this.hurtTimer - dt);

    // Shockwave countdown
    if (this.shockwaveActive) {
      this.shockwaveTimer -= dt;
      if (this.shockwaveTimer <= 0) this.shockwaveActive = false;
    }

    if (this.dead) {
      this.deadTimer += dt;
      this.vx = 0;
      this.vy = 0;
      return;
    }

    // Phase transition messages
    const newPhase = this.phase;
    if (newPhase !== this._phase) {
      this._phase = newPhase;
      if (newPhase === 2 && !this._phase2Done) {
        this._phase2Done = true;
        this.phaseMessage = {
          text:  '⚡  THE SHIELD IS WEAKENING!',
          color: '#88aaff',
          timer: 3.5,
        };
        this._setState('patrol'); // interrupt current action
      }
      if (newPhase === 3 && !this._phase3Done) {
        this._phase3Done = true;
        this.phaseMessage = {
          text:  '☠  THE ANCIENT ONE IS ENRAGED!',
          color: '#ff5500',
          timer: 4.0,
        };
        this._setState('patrol');
      }
    }
    if (this.phaseMessage) {
      this.phaseMessage.timer -= dt;
      if (this.phaseMessage.timer <= 0) this.phaseMessage = null;
    }

    // Tick action cooldowns
    for (const k of Object.keys(this._cd)) {
      this._cd[k] = Math.max(0, this._cd[k] - dt);
    }

    // Face player (except while charging)
    if (this._state !== 'charge') {
      const pdx = (player.x + player.w / 2) - (this.x + this.w / 2);
      if (pdx !== 0) this.facing = pdx > 0 ? 1 : -1;
    }

    switch (this._state) {
      case 'spawn':  this._spawn(dt);           break;
      case 'patrol': this._patrol(dt, player);  break;
      case 'attack': this._attack(dt, player);  break;
      case 'slam':   this._slam(dt);            break;
      case 'summon': this._summon(dt);          break;
      case 'volley': this._volley(dt, player);  break;
      case 'charge': this._charge(dt);          break;
      case 'dead':                              break;
    }
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  _setState(state) {
    this._state     = state;
    this._stateTimer = 0;
    // Reset all per-state temporaries
    this._slamPhase     = 'windup';
    this._summonSpawned = false;
    this._volleyFired   = false;
    this._chargePhase   = 'windup';
    this._chargeTimer   = 0;
  }

  _availableActions() {
    const def  = PHASE[this._phase];
    const list = [];
    if (this._cd.attack <= 0) list.push('attack');
    for (const k of ['slam', 'summon', 'volley', 'charge']) {
      if (def[k] !== null && this._cd[k] <= 0) list.push(k);
    }
    return list;
  }

  _pickAction(list, player) {
    const dist = Math.abs((player.x + player.w / 2) - (this.x + this.w / 2));
    // Prefer melee if player is close
    if (list.includes('attack') && dist < 220) return 'attack';
    // Otherwise pick randomly from the special moves
    const specials = list.filter(a => a !== 'attack');
    if (specials.length) return specials[Math.floor(Math.random() * specials.length)];
    return list[0];
  }

  _startAction(action) {
    const def = PHASE[this._phase];
    if (def[action] !== null && def[action] !== undefined) {
      this._cd[action] = def[action];
    }
    if (action === 'charge') this._chargeDir = this.facing;
    this._setState(action);
  }

  // ── State handlers ─────────────────────────────────────────────────────────

  _spawn(dt) {
    this.vx = 0;
    // Intro roar lasts 2.8 s, then start patrolling
    if (this._stateTimer >= 2.8) this._setState('patrol');
  }

  _patrol(dt, player) {
    const def = PHASE[this._phase];
    this.vx = this._patrolDir * def.spd * 0.35;

    // Bounce off arena side-walls (keep 80 px buffer from col 0 / col 27 walls)
    const leftBound  = 80;
    const rightBound = 27 * 48 - 80 - this.w;
    if (this.x <= leftBound)   this._patrolDir =  1;
    if (this.x >= rightBound)  this._patrolDir = -1;

    // After patrol delay, choose next action
    const delay = this._phase === 3 ? 0.7 : this._phase === 2 ? 1.1 : 1.6;
    if (this._stateTimer >= delay) {
      const actions = this._availableActions();
      if (actions.length) {
        this._startAction(this._pickAction(actions, player));
      } else {
        this._stateTimer = 0; // nothing ready — keep patrolling
      }
    }
  }

  _attack(dt, player) {
    const def  = PHASE[this._phase];
    const pdx  = (player.x + player.w / 2) - (this.x + this.w / 2);
    const dist = Math.abs(pdx);

    if (dist > 85) {
      // Advance toward player
      this.vx = Math.sign(pdx) * def.spd;
    } else {
      // In melee range — stop and swing
      // (damage resolution happens in GameScene: overlaps(player, boss) + state === 'attack')
      this.vx = 0;
      if (this._stateTimer > 0.9) this._setState('patrol');
    }
    if (this._stateTimer > 5.0) this._setState('patrol'); // safety timeout
  }

  _slam(dt) {
    switch (this._slamPhase) {
      case 'windup':
        this.vx = 0;
        // 0.7 s crouch telegraphs the jump
        if (this._stateTimer >= 0.7) {
          this._slamPhase = 'rise';
          this.vy = -880; // leap!
        }
        break;

      case 'rise':
        // Wait until gravity pulls vy back positive (apex reached)
        if (this.vy >= 0) {
          this._slamPhase = 'fall';
          this.vy = 1500; // override — crash down
        }
        break;

      case 'fall':
        // Detect landing
        if (this.onGround) {
          this._slamPhase      = 'impact';
          this.shockwaveActive = true;
          this.shockwaveTimer  = 0.85;
        }
        break;

      case 'impact':
        this.vx = 0;
        // Hold briefly for the shockwave to play, then resume patrol
        if (this._stateTimer >= 1.4) this._setState('patrol');
        break;
    }
  }

  _summon(dt) {
    this.vx = 0;
    if (this._stateTimer >= 1.0 && !this._summonSpawned) {
      this._summonSpawned = true;
      // Spawn two slimes near the arena walls at ground level
      const groundY = this.y + this.h; // approximate ground y
      this.pendingMinions.push(
        { type: 'slime', x: 2 * 48,  y: groundY - 28 },
        { type: 'slime', x: 23 * 48, y: groundY - 28 },
      );
    }
    if (this._stateTimer >= 2.0) this._setState('patrol');
  }

  _volley(dt, player) {
    this.vx = 0;
    if (this._stateTimer >= 0.6 && !this._volleyFired) {
      this._volleyFired = true;
      const cx  = this.x + this.w / 2;
      const cy  = this.y + this.h * 0.3;
      const pdx = (player.x + player.w / 2) - cx;
      const pdy = (player.y + player.h / 2) - cy;
      const ang = Math.atan2(pdy, pdx);
      const spd = 360;
      // Three boulders: aimed + ±22° spread
      for (let i = -1; i <= 1; i++) {
        const a = ang + i * 0.38;
        this.pendingProjectiles.push({
          x: cx - 12, y: cy - 12,
          vx: Math.cos(a) * spd,
          vy: Math.sin(a) * spd,
          damage: 35,
          life: 3.0,
        });
      }
    }
    if (this._stateTimer >= 1.5) this._setState('patrol');
  }

  _charge(dt) {
    if (this._chargePhase === 'windup') {
      this.vx = 0;
      // 0.6 s flash-and-roar telegraph
      if (this._stateTimer >= 0.6) {
        this._chargePhase = 'dash';
        this._chargeTimer = 0;
      }
    } else {
      this._chargeTimer += dt;
      this.vx = this._chargeDir * 640;
      if (this._chargeTimer >= 1.0) {
        this.vx = 0;
        this._setState('patrol');
      }
    }
  }
}
