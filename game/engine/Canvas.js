export class Canvas {
  constructor(id) {
    this.el = document.getElementById(id);
    this.ctx = this.el.getContext('2d');
    this.width = 0;
    this.height = 0;
    this.scale = 1;

    // Disable smoothing for crisp pixel art
    this.ctx.imageSmoothingEnabled = false;

    this._resize();
    window.addEventListener('resize', () => this._resize());
  }

  _resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.el.width = this.width;
    this.el.height = this.height;
    this.ctx.imageSmoothingEnabled = false;
  }

  clear() {
    this.ctx.clearRect(0, 0, this.width, this.height);
  }
}
