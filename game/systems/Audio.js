/**
 * Audio — procedural sound effects via the Web Audio API.
 * No external assets required; every sound is synthesized at runtime.
 *
 * Usage:
 *   const audio = new Audio();
 *   audio.jump();
 *   audio.swing('mage');
 *
 * All sounds are fire-and-forget. The AudioContext is lazily created on the
 * first call so the browser autoplay policy is never violated.
 */

export class Audio {
  constructor() {
    this._ctx    = null;
    this._master = null;
  }

  // ── Lazy init ──────────────────────────────────────────────────────────────

  _init() {
    if (this._ctx) {
      if (this._ctx.state === 'suspended') this._ctx.resume();
      return;
    }
    this._ctx    = new (window.AudioContext || window.webkitAudioContext)();
    this._master = this._ctx.createGain();
    this._master.gain.value = 0.38;

    // Light compressor to prevent clipping when multiple sounds overlap
    const comp = this._ctx.createDynamicsCompressor();
    comp.threshold.value = -20;
    comp.knee.value      =  6;
    comp.ratio.value     =  4;
    comp.attack.value    =  0.003;
    comp.release.value   =  0.12;
    this._master.connect(comp);
    comp.connect(this._ctx.destination);
  }

  // ── Primitive helpers ──────────────────────────────────────────────────────

  /** Oscillator with exponential pitch sweep and amplitude envelope. */
  _tone(type, hz, dur, peak, hzEnd = null, delay = 0) {
    const ctx = this._ctx;
    const t   = ctx.currentTime + delay;
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(hz, t);
    if (hzEnd !== null) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(hzEnd, 1), t + dur);
    }
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(peak, t + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(this._master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  /** White noise burst, optionally bandpass-filtered. */
  _noise(dur, peak, filterHz = null, filterQ = 1, delay = 0) {
    const ctx = this._ctx;
    const t   = ctx.currentTime + delay;
    const len = Math.ceil(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d   = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src  = ctx.createBufferSource();
    src.buffer = buf;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(peak, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    if (filterHz) {
      const flt = ctx.createBiquadFilter();
      flt.type            = 'bandpass';
      flt.frequency.value = filterHz;
      flt.Q.value         = filterQ;
      src.connect(flt);
      flt.connect(gain);
    } else {
      src.connect(gain);
    }
    gain.connect(this._master);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  // ── Sound definitions ──────────────────────────────────────────────────────

  jump() {
    this._init();
    this._tone('triangle', 340, 0.13, 0.45, 560);
  }

  doubleJump() {
    this._init();
    this._tone('triangle', 460, 0.07, 0.38, 700);
    this._tone('triangle', 620, 0.07, 0.38, 900, 0.07);
  }

  land() {
    this._init();
    this._tone('sine', 95, 0.08, 0.55, 32);
    this._noise(0.05, 0.3, 160, 2);
  }

  /** Attack swing — sound varies by player class. */
  swing(cls = 'warrior') {
    this._init();
    if (cls === 'warrior') {
      // Heavy whoosh + low impact
      this._noise(0.13, 0.55, 650, 1.2);
      this._tone('sawtooth', 135, 0.09, 0.28, 50);
    } else if (cls === 'mage') {
      // Magic zap
      this._tone('sine', 900, 0.07, 0.38, 360);
      this._tone('triangle', 1250, 0.06, 0.22, 480, 0.03);
    } else if (cls === 'thief') {
      // Quick blade flick
      this._noise(0.07, 0.5, 2400, 3);
    } else {
      // Bowman — string twang
      this._tone('triangle', 330, 0.14, 0.38, 80);
      this._noise(0.05, 0.22, 480, 2);
    }
  }

  hitEnemy() {
    this._init();
    this._noise(0.07, 0.5, 420, 2);
    this._tone('square', 175, 0.05, 0.22, 75);
  }

  enemyDie() {
    this._init();
    this._noise(0.1, 0.6, 260, 1.5);
    this._tone('sine', 210, 0.13, 0.32, 45);
  }

  playerHurt() {
    this._init();
    this._tone('sawtooth', 240, 0.22, 0.5, 110);
    this._noise(0.12, 0.28, 270, 1);
  }

  coinPickup() {
    this._init();
    this._tone('sine', 1046, 0.07, 0.42);          // C6
    this._tone('sine', 1318, 0.08, 0.42, null, 0.065); // E6
  }

  itemPickup() {
    this._init();
    this._tone('triangle',  880, 0.07, 0.32);
    this._tone('triangle', 1108, 0.07, 0.32, null, 0.07);
    this._tone('triangle', 1318, 0.09, 0.38, null, 0.14);
  }

  potionPickup() {
    this._init();
    this._tone('sine', 660, 0.12, 0.3, 880);
    this._noise(0.1, 0.12, 900, 3);
  }

  /** Potion used (drinking sound). */
  potion() {
    this._init();
    this._tone('sine', 370, 0.22, 0.32, 760);
    this._noise(0.18, 0.14, 800, 3);
  }

  levelUp() {
    this._init();
    // Ascending arpeggio: C5 E5 G5 C6
    [523, 659, 784, 1046].forEach((hz, i) => {
      this._tone('triangle', hz, 0.2, 0.48, null, i * 0.1);
    });
  }

  bossHurt() {
    this._init();
    this._tone('sine', 52, 0.25, 0.65, 25);
    this._noise(0.15, 0.42, 130, 1);
  }

  bossPhase() {
    this._init();
    // Dissonant chord crash
    this._tone('sawtooth', 110, 0.6, 0.48);
    this._tone('sawtooth', 138, 0.6, 0.32);
    this._tone('sawtooth', 165, 0.6, 0.25);
    this._noise(0.38, 0.38, 170, 0.8);
  }

  bossDie() {
    this._init();
    // Impact burst
    this._tone('sine', 52, 0.65, 0.75, 20);
    this._noise(0.5, 0.65, 150, 0.7);
    // Victory arpeggio (delayed): C4 E4 G4 C5 E5
    [262, 330, 392, 523, 659].forEach((hz, i) => {
      this._tone('triangle', hz, 0.24, 0.42, null, 0.4 + i * 0.1);
    });
  }

  portal() {
    this._init();
    this._tone('sine',     500, 0.42, 0.32, 1150);
    this._tone('triangle', 330, 0.42, 0.2,   850);
    this._noise(0.3, 0.14, 1100, 2);
  }
}
