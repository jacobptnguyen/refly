// Canvas setup, game loop, state-machine dispatch. Glue only — all
// gameplay logic lives in flight.js / minigame.js.

import { CONFIG } from './constants.js';
import { GameState, createGame } from './state.js';
import { initInput, consumeAction, clearAction } from './input.js';
import { drawBackground, drawGround, drawMenuScreen, drawGameOverScreen, drawTransitionOverlay } from './render.js';
import * as Flight from './flight.js';
import * as Minigame from './minigame.js';

const canvas = document.getElementById('game');
canvas.width = CONFIG.CANVAS_WIDTH;
canvas.height = CONFIG.CANVAS_HEIGHT;
const ctx = canvas.getContext('2d');

initInput(canvas);

const game = createGame();
let lastTime = 0;

function update(dt, action) {
  switch (game.state) {
    case GameState.MENU: {
      if (action) {
        game.flight = Flight.createSession();
        game.secondChanceCount = 0;
        game.state = GameState.FLIGHT_PLAYING;
      }
      break;
    }
    case GameState.FLIGHT_PLAYING: {
      const result = Flight.update(game.flight, dt, action);
      if (result === 'dead') {
        game.savedFlight = Flight.snapshot(game.flight);
        game.stateTimer = 0;
        game.state = GameState.DEATH_TRANSITION;
        clearAction();
      }
      break;
    }
    case GameState.DEATH_TRANSITION: {
      game.stateTimer += dt;
      if (game.stateTimer >= CONFIG.DEATH_TRANSITION_DURATION) {
        game.secondChanceCount += 1;
        game.minigame = Minigame.createSession(game.savedFlight.score, game.secondChanceCount - 1);
        game.state = GameState.MINIGAME_PLAYING;
      }
      break;
    }
    case GameState.MINIGAME_PLAYING: {
      const result = Minigame.update(game.minigame, dt, action);
      if (result === 'win') {
        game.stateTimer = 0;
        game.state = GameState.RESUME_TRANSITION;
        clearAction();
      } else if (result === 'dead') {
        game.finalScore = game.savedFlight.score;
        game.savedFlight = null;
        game.state = GameState.GAME_OVER;
      }
      break;
    }
    case GameState.RESUME_TRANSITION: {
      game.stateTimer += dt;
      if (game.stateTimer >= CONFIG.RESUME_TRANSITION_DURATION) {
        game.flight = Flight.restore(game.savedFlight);
        game.savedFlight = null;
        game.state = GameState.FLIGHT_PLAYING;
      }
      break;
    }
    case GameState.GAME_OVER: {
      if (action) {
        game.state = GameState.MENU;
      }
      break;
    }
  }
}

function render() {
  drawBackground(ctx);

  switch (game.state) {
    case GameState.MENU: {
      drawGround(ctx);
      drawMenuScreen(ctx);
      break;
    }
    case GameState.FLIGHT_PLAYING: {
      Flight.render(ctx, game.flight);
      break;
    }
    case GameState.DEATH_TRANSITION: {
      Flight.render(ctx, game.flight);
      drawTransitionOverlay(ctx, 'Second chance!');
      break;
    }
    case GameState.MINIGAME_PLAYING: {
      Minigame.render(ctx, game.minigame);
      break;
    }
    case GameState.RESUME_TRANSITION: {
      Minigame.render(ctx, game.minigame);
      drawTransitionOverlay(ctx, 'Back in the air!');
      break;
    }
    case GameState.GAME_OVER: {
      drawGround(ctx);
      drawGameOverScreen(ctx, game.finalScore);
      break;
    }
  }
}

function loop(timestamp) {
  const dt = Math.min((timestamp - lastTime) / 1000, CONFIG.MAX_DT);
  lastTime = timestamp;
  const action = consumeAction();
  update(dt, action);
  render();
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
