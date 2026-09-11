// Flight mode ("flight"): createSession/update/render/snapshot/restore.
// Difficulty is always a pure function of score — never a separately
// tracked variable — so nothing can drift out of sync on restore.

import { CONFIG } from './constants.js';
import { drawGround, drawHUD, PALETTE } from './render.js';

function computeDifficulty(score) {
  const level = Math.floor(score / CONFIG.LEVEL_SCORE_STEP);
  return {
    pipeSpeed: Math.min(CONFIG.PIPE_SPEED_MAX, CONFIG.PIPE_SPEED_BASE + level * CONFIG.PIPE_SPEED_STEP),
    gapHeight: Math.max(CONFIG.PIPE_GAP_MIN, CONFIG.PIPE_GAP_BASE - level * CONFIG.PIPE_GAP_STEP),
    pipeSpawnInterval: Math.max(CONFIG.PIPE_SPAWN_MIN, CONFIG.PIPE_SPAWN_BASE - level * CONFIG.PIPE_SPAWN_STEP),
  };
}

function makePipe(score) {
  const { gapHeight } = computeDifficulty(score);
  const margin = CONFIG.PIPE_GAP_Y_MARGIN;
  const playfieldBottom = CONFIG.CANVAS_HEIGHT - CONFIG.GROUND_HEIGHT;
  const minGapY = margin;
  const maxGapY = playfieldBottom - margin - gapHeight;
  const gapY = minGapY + Math.random() * Math.max(0, maxGapY - minGapY);
  return {
    x: CONFIG.CANVAS_WIDTH + CONFIG.PIPE_WIDTH,
    gapY,
    gapHeight,
    scored: false,
  };
}

export function createSession() {
  const difficulty = computeDifficulty(0);
  return {
    bird: { y: CONFIG.CANVAS_HEIGHT / 2, vy: 0 },
    pipes: [],
    score: 0,
    pipeSpeed: difficulty.pipeSpeed,
    pipeSpawnInterval: difficulty.pipeSpawnInterval,
    pipeSpawnTimer: difficulty.pipeSpawnInterval,
    graceTimer: 0,
  };
}

export function update(flight, dt, action) {
  const bird = flight.bird;

  if (action) {
    bird.vy = CONFIG.FLAP_IMPULSE;
  }
  bird.vy += CONFIG.GRAVITY * dt;
  bird.y += bird.vy * dt;

  // Ceiling blocks the bird rather than killing it.
  const r = CONFIG.BIRD_RADIUS;
  if (bird.y - r < 0) {
    bird.y = r;
    bird.vy = Math.max(bird.vy, 0);
  }

  if (flight.graceTimer > 0) {
    flight.graceTimer = Math.max(0, flight.graceTimer - dt);
  }

  // Spawn pipes.
  flight.pipeSpawnTimer -= dt;
  if (flight.pipeSpawnTimer <= 0) {
    flight.pipes.push(makePipe(flight.score));
    flight.pipeSpawnTimer += flight.pipeSpawnInterval;
  }

  // Move & prune pipes.
  for (const pipe of flight.pipes) {
    pipe.x -= flight.pipeSpeed * dt;
  }
  flight.pipes = flight.pipes.filter((p) => p.x + CONFIG.PIPE_WIDTH > 0);

  // Scoring.
  for (const pipe of flight.pipes) {
    if (!pipe.scored && pipe.x + CONFIG.PIPE_WIDTH < CONFIG.BIRD_X) {
      pipe.scored = true;
      flight.score += 1;
      const difficulty = computeDifficulty(flight.score);
      flight.pipeSpeed = difficulty.pipeSpeed;
      flight.pipeSpawnInterval = difficulty.pipeSpawnInterval;
    }
  }

  // Collision (skipped entirely during grace period).
  if (flight.graceTimer <= 0) {
    const groundY = CONFIG.CANVAS_HEIGHT - CONFIG.GROUND_HEIGHT;
    if (bird.y + r > groundY) {
      return 'dead';
    }
    for (const pipe of flight.pipes) {
      if (circleRectCollide(CONFIG.BIRD_X, bird.y, r, pipe.x, 0, CONFIG.PIPE_WIDTH, pipe.gapY)) {
        return 'dead';
      }
      if (
        circleRectCollide(
          CONFIG.BIRD_X,
          bird.y,
          r,
          pipe.x,
          pipe.gapY + pipe.gapHeight,
          CONFIG.PIPE_WIDTH,
          groundY - (pipe.gapY + pipe.gapHeight)
        )
      ) {
        return 'dead';
      }
    }
  }

  return undefined;
}

function circleRectCollide(cx, cy, r, rx, ry, rw, rh) {
  const closestX = Math.max(rx, Math.min(cx, rx + rw));
  const closestY = Math.max(ry, Math.min(cy, ry + rh));
  const dx = cx - closestX;
  const dy = cy - closestY;
  return dx * dx + dy * dy < r * r;
}

export function render(ctx, flight) {
  for (const pipe of flight.pipes) {
    ctx.fillStyle = PALETTE.pipe;
    drawTopPipe(ctx, pipe);
    drawBottomPipe(ctx, pipe);
  }

  drawGround(ctx);

  const flashing = flight.graceTimer > 0 && Math.floor(flight.graceTimer * 10) % 2 === 0;
  ctx.save();
  ctx.globalAlpha = flashing ? 0.4 : 1;
  drawGlider(ctx, CONFIG.BIRD_X, flight.bird.y, flight.bird.vy);
  ctx.restore();

  drawHUD(ctx, flight.score);
}

function drawTopPipe(ctx, pipe) {
  ctx.fillStyle = PALETTE.pipe;
  ctx.fillRect(pipe.x, 0, CONFIG.PIPE_WIDTH, pipe.gapY);
  ctx.fillStyle = PALETTE.pipeEdge;
  ctx.fillRect(pipe.x, Math.max(0, pipe.gapY - 8), CONFIG.PIPE_WIDTH, 8);
}

function drawBottomPipe(ctx, pipe) {
  const groundY = CONFIG.CANVAS_HEIGHT - CONFIG.GROUND_HEIGHT;
  const top = pipe.gapY + pipe.gapHeight;
  ctx.fillStyle = PALETTE.pipe;
  ctx.fillRect(pipe.x, top, CONFIG.PIPE_WIDTH, groundY - top);
  ctx.fillStyle = PALETTE.pipeEdge;
  ctx.fillRect(pipe.x, top, CONFIG.PIPE_WIDTH, 8);
}

function drawGlider(ctx, x, y, vy) {
  // A small original glider shape: a rounded triangle, never a bird
  // silhouette. Tilts slightly with vertical velocity.
  const r = CONFIG.BIRD_RADIUS;
  const tilt = Math.max(-0.5, Math.min(0.8, vy / 500));
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  ctx.fillStyle = PALETTE.glider;
  ctx.beginPath();
  ctx.moveTo(r * 1.3, 0);
  ctx.lineTo(-r, -r * 0.9);
  ctx.lineTo(-r * 0.4, 0);
  ctx.lineTo(-r, r * 0.9);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function snapshot(flight) {
  return {
    score: flight.score,
    pipes: flight.pipes.map((p) => ({ ...p })),
    pipeSpeed: flight.pipeSpeed,
    pipeSpawnTimer: flight.pipeSpawnTimer,
    pipeSpawnInterval: flight.pipeSpawnInterval,
  };
}

export function restore(savedFlight) {
  return {
    bird: { y: CONFIG.CANVAS_HEIGHT / 2, vy: 0 },
    pipes: savedFlight.pipes.map((p) => ({ ...p })),
    score: savedFlight.score,
    pipeSpeed: savedFlight.pipeSpeed,
    pipeSpawnTimer: savedFlight.pipeSpawnTimer,
    pipeSpawnInterval: savedFlight.pipeSpawnInterval,
    graceTimer: CONFIG.GRACE_DURATION,
  };
}
