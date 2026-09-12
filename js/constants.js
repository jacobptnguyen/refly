// All tunable numbers for Refly, grouped by system. Nothing gameplay-related
// should be a magic number outside this file.

export const CONFIG = {
  // Canvas / loop
  CANVAS_WIDTH: 480,
  CANVAS_HEIGHT: 640,
  MAX_DT: 1 / 30, // clamp vs. spiral of death on slow frames
  GROUND_HEIGHT: 48,

  // State-machine transitions
  DEATH_TRANSITION_DURATION: 0.7,
  RESUME_TRANSITION_DURATION: 0.6,
  GRACE_DURATION: 1.0, // post-resume collision immunity, seconds

  // Flight mode ("flight")
  BIRD_X: 120,
  BIRD_RADIUS: 14,
  GRAVITY: 900,
  FLAP_IMPULSE: -320,
  PIPE_WIDTH: 64,
  LEVEL_SCORE_STEP: 5, // every N points = one difficulty level
  PIPE_SPEED_BASE: 140,
  PIPE_SPEED_STEP: 14,
  PIPE_SPEED_MAX: 260,
  PIPE_GAP_BASE: 176,
  PIPE_GAP_STEP: 10,
  PIPE_GAP_MIN: 116,
  PIPE_SPAWN_BASE: 1.6,
  PIPE_SPAWN_STEP: 0.11,
  PIPE_SPAWN_MIN: 0.95,
  PIPE_GAP_Y_MARGIN: 60, // min clearance from ceiling/ground to gap edge

  // The Hop (mini-game)
  HOP_OBSTACLE_COUNT: 5,
  HOP_RUNNER_X: 90,
  HOP_RUNNER_SIZE: 28,
  HOP_GRAVITY: 2200,
  HOP_JUMP_IMPULSE: -700,
  HOP_SPEED_BASE: 220,
  HOP_SPEED_SCORE_FACTOR: 4,
  HOP_SPEED_SECOND_CHANCE_STEP: 55, // extra hopSpeed per consecutive Hop entry this run
  HOP_SPEED_SECOND_CHANCE_MILESTONE_ATTEMPT: 5, // secondChanceCount (0-indexed) at which the milestone bonus kicks in
  HOP_SPEED_SECOND_CHANCE_MILESTONE_BONUS: 120, // one-time flat bonus applied from the milestone attempt onward
  HOP_SPEED_MAX: 900,
  HOP_OBSTACLE_WIDTH_MIN: 26,
  HOP_OBSTACLE_WIDTH_MAX: 46,
  HOP_OBSTACLE_HEIGHT_MIN: 28,
  HOP_OBSTACLE_HEIGHT_MAX: 64,
  HOP_GAP_SAFETY_MARGIN: 1.25, // multiplier on the theoretical min clearable gap
  HOP_GAP_RANDOM_SPAN: 0.6, // extra randomized slack on top of the min gap
};
