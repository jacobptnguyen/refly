// Game state enum + the shared top-level `game` object shape.

export const GameState = Object.freeze({
  MENU: 'MENU',
  FLIGHT_PLAYING: 'FLIGHT_PLAYING',
  DEATH_TRANSITION: 'DEATH_TRANSITION',
  MINIGAME_PLAYING: 'MINIGAME_PLAYING',
  RESUME_TRANSITION: 'RESUME_TRANSITION',
  GAME_OVER: 'GAME_OVER',
});

export function createGame() {
  return {
    state: GameState.MENU,
    flight: null, // active flight-mode session, or null
    minigame: null, // active Hop session, or null
    savedFlight: null, // snapshot captured at death, consumed on resume
    stateTimer: 0, // used by the two timed transition states
    finalScore: 0, // set when a Hop loss ends the run
    secondChanceCount: 0, // consecutive Hop entries this run; resets at MENU
  };
}
