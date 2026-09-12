# Refly — Design Spec

This is the authoritative spec for the game. Both the `game-developer` and
`playtester` subagents read this file fresh every time they run — it is the
only shared memory between rounds, so it must stay accurate. If an
implementation has to deviate from this spec, update this file to match in
the same change.

## Concept

Refly is a flap-through-gaps browser game with one twist: dying in
the main flight mode does not end the run. Instead the player drops into a
short, mechanically distinct mini-game ("the Hop"). Clearing it resumes the
flight exactly where they left off — same score, same pipe layout, same
difficulty. Failing the Hop is the real game over.

No third-party game name, branding, or bird-silhouette sprite anywhere. No
code or assets copied or adapted from any existing flap-through-gaps game or
clone of it. All art is drawn with Canvas 2D primitives (circles, triangles,
rounded rects) in a non-default color palette — not the classic
blue-sky/green-pipe look.

## State machine

```
MENU
  --(action)--> FLIGHT_PLAYING            [create fresh flight session]

FLIGHT_PLAYING
  --(collision)--> DEATH_TRANSITION        [snapshot flight state]

DEATH_TRANSITION   (timed, ~0.7s, input ignored)
  --(timer done)--> MINIGAME_PLAYING       [create minigame session, difficulty scaled from saved score]

MINIGAME_PLAYING
  --(cleared N obstacles)--> RESUME_TRANSITION
  --(hit obstacle)--> GAME_OVER            [finalScore = saved flight score]

RESUME_TRANSITION  (timed, ~0.6s, input ignored)
  --(timer done)--> FLIGHT_PLAYING         [restore flight state, bird reset + grace period]

GAME_OVER
  --(action)--> MENU
```

This cycle can repeat indefinitely within one run: die → Hop → resume → die
again → Hop again → resume again, etc. Only a Hop **loss** ends the run.

## What's preserved across the flight → Hop → flight transition

Captured in a snapshot object the instant the bird dies:

```js
snapshot = {
  score,              // integer, untouched by the Hop
  pipes: [ {x, gapY, gapHeight, scored}, ... ],  // deep copy, not a reference
  pipeSpeed,
  pipeSpawnTimer,
  pipeSpawnInterval,
}
```

Difficulty (`pipeSpeed`, gap size, `pipeSpawnInterval`) is a **pure function
of `score`** (recomputed whenever score changes), never a separately tracked
variable — nothing can drift out of sync on restore.

On restore: the bird is rebuilt at a neutral position (`x` unchanged,
`y = canvas height / 2`, `vy = 0`) with a ~1 second collision-immunity grace
period (bird renders semi-transparent/flashing, all collision checks
skipped while grace is active). `score`/`pipes`/`pipeSpeed`/
`pipeSpawnTimer`/`pipeSpawnInterval` are restored unchanged from the
snapshot. Restoring the bird's exact death position/velocity is
deliberately NOT done — it would usually re-kill the player on frame one.

## Game loop

Single `requestAnimationFrame` loop, delta-time based (not frame-locked):

```js
let lastTime = 0;
function loop(timestamp) {
  const dt = Math.min((timestamp - lastTime) / 1000, CONFIG.MAX_DT); // clamp vs. spiral of death
  lastTime = timestamp;
  const action = consumeAction();   // edge-triggered: true once per press, then cleared
  update(dt, action);
  render();
  requestAnimationFrame(loop);
}
```

Input (`consumeAction`) is **edge-triggered** — one flap/jump per keypress or
tap, not continuous while held. The pending action is also forcibly cleared
when entering `DEATH_TRANSITION` or `RESUME_TRANSITION`, so a keypress that
caused death (or was buffered during a transition) can't leak into the next
state as a free extra input.

`update()` dispatches by `game.state`:

```js
switch (game.state) {
  case MENU:
    if (action) {
      game.flight = Flight.createSession();
      game.secondChanceCount = 0;
      game.state = FLIGHT_PLAYING;
    }
    break;
  case FLIGHT_PLAYING: {
    const result = Flight.update(game.flight, dt, action);
    if (result === 'dead') {
      game.savedFlight = Flight.snapshot(game.flight);
      game.stateTimer = 0;
      game.state = DEATH_TRANSITION;
    }
    break;
  }
  case DEATH_TRANSITION:
    game.stateTimer += dt;
    if (game.stateTimer >= CONFIG.DEATH_TRANSITION_DURATION) {
      game.secondChanceCount += 1;
      game.minigame = Minigame.createSession(game.savedFlight.score, game.secondChanceCount - 1);
      game.state = MINIGAME_PLAYING;
    }
    break;
  case MINIGAME_PLAYING: {
    const result = Minigame.update(game.minigame, dt, action);
    if (result === 'win') { game.stateTimer = 0; game.state = RESUME_TRANSITION; }
    else if (result === 'dead') {
      game.finalScore = game.savedFlight.score;
      game.savedFlight = null;
      game.state = GAME_OVER;
    }
    break;
  }
  case RESUME_TRANSITION:
    game.stateTimer += dt;
    if (game.stateTimer >= CONFIG.RESUME_TRANSITION_DURATION) {
      game.flight = Flight.restore(game.savedFlight);
      game.savedFlight = null;
      game.state = FLIGHT_PLAYING;
    }
    break;
  case GAME_OVER:
    if (action) game.state = MENU;
    break;
}
```

Rendering mirrors this switch — each state draws its own scene; the two
transition states render the frozen last frame plus a short overlay message
(e.g. "Uh oh!" for death, "Back in the air!" for resume).

## Flight mode ("flight") mechanics

- Fixed bird x-position; circle hitbox (radius ~14px).
- Gravity + a fixed upward flap impulse applied to `vy`, integrated with `dt`.
- Pipes are rectangle pairs; each has `gapY`/`gapHeight`; they scroll left at
  `pipeSpeed * dt`.
- Scoring: when a pipe's right edge passes the bird's x and it isn't already
  `scored`, increment `score`, mark `scored = true`, recompute difficulty.
- Difficulty ramps with score (e.g. every 5 points = one level):
  `pipeSpeed = min(MAX, BASE + level*STEP)`,
  `gapHeight = max(MIN, BASE - level*STEP)`,
  `spawnInterval = max(MIN, BASE - level*STEP)`.
- Collision: circle-vs-rect test against each pipe's top/bottom rects, plus
  ceiling/ground bounds. Skipped entirely while the post-resume grace period
  is active.

## The Hop (mini-game) mechanics

- Single input = jump (only usable while grounded); gravity brings the
  runner back down.
- Fixed-length session: `HOP_OBSTACLE_COUNT = 5` obstacles, generated fresh
  per session with randomized (but bounded, always-clearable) spacing.
- Runner is fixed at a screen x-position; ground-level rectangular obstacles
  scroll left at `hopSpeed`.
- `hopSpeed = clamp(BASE + score * SCORE_FACTOR + secondChanceCount * SECOND_CHANCE_STEP + milestoneBonus, BASE, MAX)`,
  where `milestoneBonus = secondChanceCount >= SECOND_CHANCE_MILESTONE_ATTEMPT ? SECOND_CHANCE_MILESTONE_BONUS : 0`
  — a harder flight run (higher score at death) produces a faster, harder
  Hop, and **each consecutive Hop entry within the same run ramps the speed
  further still**, with a distinct extra jump ("gap") once the player has
  reached their `SECOND_CHANCE_MILESTONE_ATTEMPT`'th consecutive Hop, on
  top of the steady per-attempt ramp. `secondChanceCount` lives on the
  top-level `game` object (not the flight snapshot): it starts at 0, is
  incremented by 1 immediately before every `Minigame.createSession` call
  (so the first Hop of a run uses `secondChanceCount = 0`, the next one
  after another death uses `1`, and so on), and resets to 0 whenever a
  fresh run starts from MENU. It is untouched by winning or losing a Hop
  attempt itself — only by starting a new run.
- Obstacle spacing is always derived from `hopSpeed` (`minGap = hopSpeed *
  jumpAirTime * HOP_GAP_SAFETY_MARGIN`, see `generateObstacles`), so gaps
  widen automatically in lockstep with any speed increase — including the
  per-second-chance ramp above — keeping every session's obstacles
  physically clearable no matter how fast `hopSpeed` gets. What actually
  gets harder as speed rises is the real-time reaction window for each
  jump's timing, not raw unfairness.
- AABB collision runner-vs-obstacle → immediate loss. An obstacle's x
  passing the runner's x with no collision → `cleared++`.
  `cleared >= HOP_OBSTACLE_COUNT` **and the runner is grounded** → win. The
  grounded requirement matters because clearing the final obstacle
  horizontally typically happens mid-air (the player is still airborne over
  it); without it the win would fire — and the game would cut to
  `RESUME_TRANSITION` — before the player visibly lands, robbing the clear
  of its feedback. The win check simply re-evaluates every frame once
  `cleared` hits the count, so it fires the instant the runner's next
  landing occurs.

## Visual style

Canvas 2D primitives only, no image or audio assets:
- Bird/glider: a simple circle or triangle shape — never a bird silhouette.
- Pipes: plain rounded-rect bars in a non-green palette.
- Background: a flat or gradient scheme — explicitly not the classic
  blue-sky-with-clouds look.
- Hop runner/obstacles: plain rectangles.
- No text anywhere references any existing game by name.

## File layout

```
index.html            # loads js/main.js as an ES module (<script type="module">)
style.css
js/
  constants.js         # all tunable numbers (physics, pipe/obstacle config, timings)
  state.js             # GameState enum + shared `game` object shape
  input.js             # keyboard/pointer/touch -> single edge-triggered action
  render.js            # shared draw helpers (menu/HUD/game-over/overlay text)
  flight.js            # createSession/update/render/snapshot/restore for flight mode
  minigame.js          # createSession/update/render for the Hop
  main.js              # canvas setup, game loop, state-machine dispatch (glue only)
README.md
bugs.md
```

Served via `python3 -m http.server` from the project root — no build step,
no framework, no dependencies. `index.html` must be loaded over HTTP (ES
modules don't work over `file://`).

## Bug tracking protocol

See `bugs.md` for the live log and its entry template. Playtester appends;
developer fixes and checks off. Neither agent deletes or rewords another's
entries.
