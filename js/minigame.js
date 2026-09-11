// The Hop: a side-scrolling, single-button jump-over-obstacles mini-game.
// createSession/update/render for the death "second chance" mode.

import { CONFIG } from './constants.js';
import { drawGround, PALETTE } from './render.js';

function groundedRunnerY() {
  return CONFIG.CANVAS_HEIGHT - CONFIG.GROUND_HEIGHT - CONFIG.HOP_RUNNER_SIZE;
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function generateObstacles(hopSpeed) {
  // Fixed jump arc (impulse + gravity are constant): air time and apex
  // height don't depend on hopSpeed, so a minimum horizontal gap keyed off
  // hopSpeed * airTime guarantees the player has time to land and react
  // before the next obstacle arrives, no matter how fast this session is.
  const jumpAirTime = (2 * Math.abs(CONFIG.HOP_JUMP_IMPULSE)) / CONFIG.HOP_GRAVITY;
  const minGap = hopSpeed * jumpAirTime * CONFIG.HOP_GAP_SAFETY_MARGIN;

  const obstacles = [];
  let x = CONFIG.CANVAS_WIDTH + 60;
  for (let i = 0; i < CONFIG.HOP_OBSTACLE_COUNT; i++) {
    const width = randomBetween(CONFIG.HOP_OBSTACLE_WIDTH_MIN, CONFIG.HOP_OBSTACLE_WIDTH_MAX);
    const height = randomBetween(CONFIG.HOP_OBSTACLE_HEIGHT_MIN, CONFIG.HOP_OBSTACLE_HEIGHT_MAX);
    obstacles.push({
      x,
      width,
      height,
      passed: false,
    });
    const gap = minGap + Math.random() * minGap * CONFIG.HOP_GAP_RANDOM_SPAN;
    x += width + gap;
  }
  return obstacles;
}

export function createSession(score) {
  const hopSpeed = Math.min(
    CONFIG.HOP_SPEED_MAX,
    Math.max(CONFIG.HOP_SPEED_BASE, CONFIG.HOP_SPEED_BASE + score * CONFIG.HOP_SPEED_SCORE_FACTOR)
  );
  return {
    hopSpeed,
    obstacles: generateObstacles(hopSpeed),
    runner: { y: groundedRunnerY(), vy: 0, grounded: true },
    cleared: 0,
  };
}

export function update(minigame, dt, action) {
  const runner = minigame.runner;
  const groundY = groundedRunnerY();

  if (action && runner.grounded) {
    runner.vy = CONFIG.HOP_JUMP_IMPULSE;
    runner.grounded = false;
  }

  runner.vy += CONFIG.HOP_GRAVITY * dt;
  runner.y += runner.vy * dt;
  if (runner.y >= groundY) {
    runner.y = groundY;
    runner.vy = 0;
    runner.grounded = true;
  }

  for (const obstacle of minigame.obstacles) {
    obstacle.x -= minigame.hopSpeed * dt;
  }

  const runnerLeft = CONFIG.HOP_RUNNER_X;
  const runnerRight = CONFIG.HOP_RUNNER_X + CONFIG.HOP_RUNNER_SIZE;
  const runnerTop = runner.y;
  const runnerBottom = runner.y + CONFIG.HOP_RUNNER_SIZE;

  for (const obstacle of minigame.obstacles) {
    if (obstacle.passed) continue;

    const obstacleTop = CONFIG.CANVAS_HEIGHT - CONFIG.GROUND_HEIGHT - obstacle.height;
    const obstacleBottom = CONFIG.CANVAS_HEIGHT - CONFIG.GROUND_HEIGHT;
    const overlapsX = runnerRight > obstacle.x && runnerLeft < obstacle.x + obstacle.width;
    const overlapsY = runnerBottom > obstacleTop && runnerTop < obstacleBottom;
    if (overlapsX && overlapsY) {
      return 'dead';
    }

    if (obstacle.x + obstacle.width < runnerLeft) {
      obstacle.passed = true;
      minigame.cleared += 1;
    }
  }

  if (minigame.cleared >= CONFIG.HOP_OBSTACLE_COUNT) {
    return 'win';
  }
  return undefined;
}

export function render(ctx, minigame) {
  for (const obstacle of minigame.obstacles) {
    const top = CONFIG.CANVAS_HEIGHT - CONFIG.GROUND_HEIGHT - obstacle.height;
    ctx.fillStyle = PALETTE.obstacle;
    ctx.fillRect(obstacle.x, top, obstacle.width, obstacle.height);
    ctx.fillStyle = PALETTE.obstacleEdge;
    ctx.fillRect(obstacle.x, top, obstacle.width, 4);
  }

  drawGround(ctx);

  ctx.fillStyle = PALETTE.runner;
  ctx.fillRect(CONFIG.HOP_RUNNER_X, minigame.runner.y, CONFIG.HOP_RUNNER_SIZE, CONFIG.HOP_RUNNER_SIZE);

  ctx.save();
  ctx.font = 'bold 28px "Trebuchet MS", sans-serif';
  ctx.textAlign = 'center';
  const label = `${minigame.cleared}/${CONFIG.HOP_OBSTACLE_COUNT}`;
  ctx.fillStyle = PALETTE.textShadow;
  ctx.fillText(label, CONFIG.CANVAS_WIDTH / 2 + 2, 84 + 2);
  ctx.fillStyle = PALETTE.text;
  ctx.fillText(label, CONFIG.CANVAS_WIDTH / 2, 84);
  ctx.restore();
}
