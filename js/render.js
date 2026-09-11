// Shared draw helpers: background, ground, HUD, menu/game-over/transition
// overlays. Original dusk-purple/teal/coral palette — explicitly not the
// classic blue-sky/green-pipe look of the genre.

import { CONFIG } from './constants.js';

export const PALETTE = {
  skyTop: '#241b3d',
  skyBottom: '#124d52',
  ground: '#3a2a52',
  groundEdge: '#e8a13b',
  pipe: '#e8703a',
  pipeEdge: '#ffcf8f',
  glider: '#5fe3c4',
  gliderGrace: 'rgba(95, 227, 196, 0.45)',
  runner: '#ff5f8f',
  obstacle: '#2c2140',
  obstacleEdge: '#7a6aa8',
  text: '#f4ecff',
  textShadow: 'rgba(0, 0, 0, 0.35)',
  overlayPanel: 'rgba(18, 12, 32, 0.72)',
};

export function drawRoundedRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.arcTo(x + w, y, x + w, y + radius, radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius);
  ctx.lineTo(x + radius, y + h);
  ctx.arcTo(x, y + h, x, y + h - radius, radius);
  ctx.lineTo(x, y + radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.closePath();
}

export function drawBackground(ctx) {
  const { CANVAS_WIDTH, CANVAS_HEIGHT } = CONFIG;
  const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
  gradient.addColorStop(0, PALETTE.skyTop);
  gradient.addColorStop(1, PALETTE.skyBottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
}

export function drawGround(ctx) {
  const { CANVAS_WIDTH, CANVAS_HEIGHT, GROUND_HEIGHT } = CONFIG;
  const y = CANVAS_HEIGHT - GROUND_HEIGHT;
  ctx.fillStyle = PALETTE.ground;
  ctx.fillRect(0, y, CANVAS_WIDTH, GROUND_HEIGHT);
  ctx.fillStyle = PALETTE.groundEdge;
  ctx.fillRect(0, y, CANVAS_WIDTH, 4);
}

export function drawHUD(ctx, score) {
  ctx.save();
  ctx.font = 'bold 28px "Trebuchet MS", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.textShadow;
  ctx.fillText(String(score), CONFIG.CANVAS_WIDTH / 2 + 2, 84 + 2);
  ctx.fillStyle = PALETTE.text;
  ctx.fillText(String(score), CONFIG.CANVAS_WIDTH / 2, 84);
  ctx.restore();
}

function centeredText(ctx, text, y, size, color) {
  ctx.save();
  ctx.font = `${size}`;
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.textShadow;
  ctx.fillText(text, CONFIG.CANVAS_WIDTH / 2 + 2, y + 2);
  ctx.fillStyle = color || PALETTE.text;
  ctx.fillText(text, CONFIG.CANVAS_WIDTH / 2, y);
  ctx.restore();
}

export function drawMenuScreen(ctx) {
  centeredText(ctx, 'Refly', CONFIG.CANVAS_HEIGHT / 2 - 60, 'bold 56px "Trebuchet MS", sans-serif');
  centeredText(
    ctx,
    'press space to play',
    CONFIG.CANVAS_HEIGHT / 2 + 10,
    '20px "Trebuchet MS", sans-serif'
  );
  centeredText(
    ctx,
    'if you lose, you get a second chance',
    CONFIG.CANVAS_HEIGHT / 2 + 42,
    '15px "Trebuchet MS", sans-serif',
    '#cbb9ff'
  );
}

export function drawGameOverScreen(ctx, finalScore) {
  centeredText(ctx, 'Run over', CONFIG.CANVAS_HEIGHT / 2 - 40, 'bold 44px "Trebuchet MS", sans-serif');
  centeredText(
    ctx,
    `score: ${finalScore}`,
    CONFIG.CANVAS_HEIGHT / 2 + 6,
    '24px "Trebuchet MS", sans-serif'
  );
  centeredText(
    ctx,
    'press space / click / tap for menu',
    CONFIG.CANVAS_HEIGHT / 2 + 44,
    '16px "Trebuchet MS", sans-serif',
    '#cbb9ff'
  );
}

export function drawTransitionOverlay(ctx, message) {
  const { CANVAS_WIDTH, CANVAS_HEIGHT } = CONFIG;
  ctx.save();
  ctx.fillStyle = PALETTE.overlayPanel;
  ctx.fillRect(0, CANVAS_HEIGHT / 2 - 46, CANVAS_WIDTH, 92);
  ctx.restore();
  centeredText(ctx, message, CANVAS_HEIGHT / 2 + 12, 'bold 32px "Trebuchet MS", sans-serif');
}
