import { Canvas }    from './engine/Canvas.js';
import { Input }     from './engine/Input.js';
import { GameScene } from './scenes/GameScene.js';

const canvas = new Canvas('gameCanvas');
const input  = new Input(canvas);
const scene  = new GameScene(canvas, input);

let lastTime = null;
const MAX_DT = 1 / 20; // cap at 50ms to avoid tunnelling on tab switch

function loop(ts) {
  if (lastTime === null) lastTime = ts;
  const dt = Math.min((ts - lastTime) / 1000, MAX_DT);
  lastTime = ts;

  scene.update(dt);
  scene.draw();
  input.flush();

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
