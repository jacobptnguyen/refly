# Bug Reports — Refly

Playtester appends new entries; developer fixes and flips the checkbox.
Never delete or reword existing entries — only toggle `[ ]`→`[x]` and add a
`Fix:` line.

Entry template:
```
- [ ] BUG-XXX: <short title> (Severity: Blocker|Major|Minor|Nitpick)
  - File(s): <path:line>
  - Repro: <steps derived from reading the code>
  - Expected: <per DESIGN.md / sane behavior>
  - Actual: <what the code does instead>
  - Fix: <filled in by developer when resolved>
```

`BUG-XXX` numbering is global and increases across rounds — check the
highest existing number before adding new ones. A round with nothing found
gets a single line: "No new bugs found." (this is the loop's stop signal).

---

## Round 1

- [x] BUG-001: Held flap key auto-repeats, breaking edge-triggered input and trivializing flight mode (Severity: Major)
  - File(s): js/input.js:10-16 (`initInput`'s `keydown` listener); consumed via js/flight.js:48-50 (`if (action) { bird.vy = CONFIG.FLAP_IMPULSE; }`)
  - Repro: Hold down the Space (or ArrowUp) key instead of tapping it while in FLIGHT_PLAYING. The browser's OS-level key-repeat fires repeated `keydown` events for the same physical press (subsequent events have `e.repeat === true`). The `keydown` listener in `input.js` calls `trigger()` (setting `pending = true`) on every one of these events with no `e.repeat` check and no matching `keyup` handling, so a single held press keeps re-arming the action flag frame after frame for as long as the key is held.
  - Expected: Per DESIGN.md ("Input (`consumeAction`) is edge-triggered — one flap/jump per keypress or tap, not continuous while held.") and input.js's own header comment ("One flap/jump per keypress or tap, not continuous while held."), holding the key should produce exactly one flap impulse per physical press, not a new one every repeat/frame.
  - Actual: Because `flight.js` unconditionally does `bird.vy = CONFIG.FLAP_IMPULSE` whenever `action` is true (no grounded/state gate the way the Hop's jump has via `runner.grounded`), a held key re-fires the flap impulse continuously, letting the player hover/ascend indefinitely just by holding the key down — trivializing flight-mode difficulty and diverging from the documented one-press-one-flap contract. (The Hop's jump is incidentally shielded from this because it also gates on `runner.grounded`, but the underlying input bug is the same for both modes.)
  - Fix: js/input.js — added `if (e.repeat) return;` in the keydown listener before `trigger()`, so OS auto-repeat events are ignored and only the initial physical keydown arms the pending action.

## Round 2

No new bugs found.

Independently re-read DESIGN.md and every file in js/ (constants.js, state.js,
input.js, flight.js, minigame.js, main.js, render.js) plus index.html and
style.css top to bottom, and mentally simulated: menu start; flight
physics/scoring/difficulty ramp; every death condition (ceiling, ground,
top-pipe, bottom-pipe rects via `circleRectCollide`); the death snapshot
(`Flight.snapshot` spreads each flat pipe object with `{...p}`, producing new
objects — verified not aliased, and `Flight.restore` likewise re-spreads
pipes into fresh objects rather than reusing the snapshot's array/objects);
Hop physics, obstacle spacing/clearability math, and win/loss; the resume
path (score/pipes/pipeSpeed/pipeSpawnTimer/pipeSpawnInterval restored
verbatim, bird reset to center with vy=0, 1s grace with collision skipped
until it hits exactly 0, no leftover death-position re-kill); repeated
death->Hop->resume cycles (each restore/snapshot allocates fresh objects, so
no cross-cycle aliasing or drift since difficulty stays a pure function of
score); true game over (`finalScore` is read from `savedFlight.score` before
it's nulled, then GAME_OVER -> MENU on next action, with a fresh
`Flight.createSession()` cleanly overwriting all prior-run state); input
edge-triggering (re-verified `js/input.js` directly — the BUG-001 fix's
`if (e.repeat) return;` sits before `trigger()` and correctly suppresses OS
key-repeat while still calling `preventDefault()` on every repeat to stop
page scroll; no stray `keyup` handling was (re)introduced) and its forced
clearing via `clearAction()` on entry to DEATH_TRANSITION and
RESUME_TRANSITION; and originality/NaN/unbounded-growth paths (no Flight
Bird branding/sprites, non-default palette, all Canvas 2D primitives; pipe
gap-Y math and Hop obstacle-height/apex math stay within positive bounds
across the full difficulty range; pipes array is pruned each frame so it
stays bounded; score/level are uncapped integers by design with no NaN
paths).

Nothing found diverges from DESIGN.md or looks like a logic/physics bug.

## Round 3

Focus of this round: the new `game.secondChanceCount` mechanic and its effect
on the Hop's `hopSpeed` (DESIGN.md "The Hop (mini-game) mechanics" + the
`MENU`/`DEATH_TRANSITION` pseudocode). Diffed against the prior committed
version to isolate exactly what changed (`DESIGN.md`, `js/constants.js`,
`js/main.js`, `js/minigame.js`, `js/state.js`).

Verified as correct (no bug): `secondChanceCount` lives only on `game`
(`js/state.js`), is absent from `Flight.snapshot`/`Flight.restore`
(`js/flight.js`), is incremented immediately before `Minigame.createSession`
and passed as `secondChanceCount - 1` (`js/main.js` DEATH_TRANSITION branch)
giving the documented 0,1,2,... sequence across consecutive Hops in one run,
resets to 0 only in the `MENU` branch, and is untouched by Hop win/loss.
`hopSpeed` in `js/minigame.js` correctly clamps to the new `HOP_SPEED_MAX =
640` and folds in `secondChanceCount * HOP_SPEED_SECOND_CHANCE_STEP` before
`generateObstacles` computes `minGap`, so obstacle spacing scales with the
actual (already-ramped, already-clamped) speed — algebraically, gap traversal
time stays constant regardless of `hopSpeed`, so sessions remain clearable
at the new higher max. Per-frame movement at `HOP_SPEED_MAX` under
`MAX_DT` stays well below obstacle/runner width sums, so no tunneling.

- [x] BUG-002: DESIGN.md pseudocode references a nonexistent single `CONFIG.TRANSITION_DURATION` for both transition states (Severity: Minor)
  - File(s): DESIGN.md:119, DESIGN.md:137 (pseudocode `if (game.stateTimer >= CONFIG.TRANSITION_DURATION)` in both the `DEATH_TRANSITION` and `RESUME_TRANSITION` cases); contrast with `js/constants.js` (`DEATH_TRANSITION_DURATION: 0.7`, `RESUME_TRANSITION_DURATION: 0.6`) and `js/main.js` (uses `CONFIG.DEATH_TRANSITION_DURATION` / `CONFIG.RESUME_TRANSITION_DURATION` respectively)
  - Repro: Read DESIGN.md's state-machine pseudocode block and compare the constant name used in both transition branches (`CONFIG.TRANSITION_DURATION`) against the actual `CONFIG` keys defined in `js/constants.js` and referenced in `js/main.js`.
  - Expected: Per DESIGN.md's own state-machine diagram just above the pseudocode ("DEATH_TRANSITION (timed, ~0.7s...)" / "RESUME_TRANSITION (timed, ~0.6s...)"), these are two different durations, and the real implementation correctly uses two distinctly-named, distinctly-valued constants. The pseudocode should reference `CONFIG.DEATH_TRANSITION_DURATION` and `CONFIG.RESUME_TRANSITION_DURATION` respectively to match reality and its own diagram.
  - Actual: The pseudocode uses the same identifier `CONFIG.TRANSITION_DURATION` in both branches, which does not exist anywhere in `js/constants.js`. Taken literally this pseudocode would compare `stateTimer` against `undefined` (always false), hanging in the transition state forever — the real code has no such bug since it uses the correct two-constant scheme, but the spec text is inaccurate/misleading as authoritative documentation for future implementers.
  - Fix: DESIGN.md:119,137 — replaced the single bogus `CONFIG.TRANSITION_DURATION` with `CONFIG.DEATH_TRANSITION_DURATION` in the `DEATH_TRANSITION` branch and `CONFIG.RESUME_TRANSITION_DURATION` in the `RESUME_TRANSITION` branch, matching `js/constants.js`/`js/main.js`. Documentation-only fix; no code changes.

No other new bugs found this round.

## Round 4

Focus of this round: the just-steepened Hop second-chance speed ramp.
`createSession(score, secondChanceCount)` in `js/minigame.js` implements
the clamp/milestone formula token-for-token as specified in DESIGN.md
("The Hop (mini-game) mechanics"). `js/constants.js` values at the time
(`HOP_SPEED_BASE=220`, `SCORE_FACTOR=4`, `SECOND_CHANCE_STEP=55`,
`MILESTONE_ATTEMPT=5`, `MILESTONE_BONUS=120`, `MAX=900`) were checked for
internal consistency — `MAX > BASE`, clamp math never inverts, milestone
jump (55 regular + 120 bonus = 175) lands well under `MAX` at realistic
`secondChanceCount` values. `generateObstacles`'s `minGap = hopSpeed *
jumpAirTime * HOP_GAP_SAFETY_MARGIN` keeps the gap-to-speed ratio constant
in time regardless of how high `hopSpeed` climbs, so sessions stay
algebraically clearable at `HOP_SPEED_MAX = 900`. Re-checked per-frame
movement vs. minimum obstacle+runner width at the new max speed
(`900 * 1/30 = 30px/frame` vs. minimum 54px needed to tunnel) — no
tunneling from raising `HOP_SPEED_MAX` from 640 to 900. `secondChanceCount`
plumbing in `js/main.js`/`js/state.js` re-verified: increments before each
`createSession` call, passed pre-decremented (0-indexed) exactly per spec,
resets only at MENU, untouched by Hop win/loss, and confirmed absent from
the flight snapshot in `js/flight.js`. Full standard checklist also re-run
with nothing new found.

No new bugs found this round.

(Note: this round's write was originally clobbered by a subsequent
playtest round reusing the same "Round 4" header before checking the
live file; reconstructed from that round's own reported findings so the
round history stays complete. No bug findings were actually lost — both
the original and the round that overwrote it reported zero bugs.)

## Round 5

Focus of this round: the just-changed Hop win condition. DESIGN.md's "The
Hop (mini-game) mechanics" section now requires `cleared >= HOP_OBSTACLE_COUNT`
**and** `runner.grounded` for a win (previously cleared-count alone), fixing
a bug where the cut to `RESUME_TRANSITION` used to fire the instant the 5th
obstacle's x passed the runner while still airborne. Diffed `js/minigame.js`
against the last commit to isolate the exact change (line 106:
`if (minigame.cleared >= CONFIG.HOP_OBSTACLE_COUNT && runner.grounded) return 'win';`).

Verified as correct (no bug):
1. The check re-evaluates every frame (it's a plain conditional inside
   `update()`, called once per frame during `MINIGAME_PLAYING`), not a
   one-shot latch. `cleared` only ever increases (each obstacle's `passed`
   flag prevents double counting), so once it reaches 5 the check simply
   waits for a later frame where `runner.grounded` is true — no permanent
   stall is possible.
2. `runner.grounded` cannot get stuck `false` forever: the physics block
   (`vy += HOP_GRAVITY * dt; y += vy * dt; if (runner.y >= groundY) { snap;
   grounded = true }`) runs unconditionally every frame before the win
   check. `HOP_GRAVITY` and `HOP_JUMP_IMPULSE` are fixed nonzero constants
   and `dt` is always positive and capped by `CONFIG.MAX_DT`, so `y` rises
   monotonically after a jump and the `>=` snap test (not an exact-equality
   test) always eventually catches and clamps it, regardless of overshoot
   magnitude — no infinite-fall or NaN path.
3. No regression to loss/bookkeeping: `if (obstacle.passed) continue;`
   still correctly skips already-cleared obstacles in the collision loop on
   every subsequent frame; `cleared` still increments exactly once per
   obstacle (the increment is only reachable before `passed` is set); a
   live collision on an unpassed obstacle still returns `'dead'`
   immediately before the win check runs, so death and win can never race
   in the same frame, and death becomes structurally impossible once all 5
   obstacles are `passed` (nothing left to collide with).
4. No interaction bug with transition-state input clearing or the
   resume/grace flow: `js/main.js`'s `MINIGAME_PLAYING` branch still calls
   `clearAction()` only on the `'win'` result exactly as before this
   change; the extra frame(s) now spent waiting for `runner.grounded`
   doesn't consume or leak any buffered input, since `action` is drained by
   `consumeAction()` every frame regardless of state and is only read at
   the top of `Minigame.update` for the jump gate. `Flight.restore`'s
   bird-reset-to-center + `GRACE_DURATION` grace period and grace-gated
   collision skip in `flight.js` are untouched by this change.

Also checked the interaction with the `HOP_SPEED_MAX` bump to 900 (from an
earlier round) for a tunneling regression that could indirectly threaten the
grounded win check's obstacle bookkeeping: worst-case obstacle displacement
per frame is `HOP_SPEED_MAX * CONFIG.MAX_DT = 900 * 1/30 = 30px`, versus a
minimum runner+obstacle contact-zone width of
`HOP_RUNNER_SIZE(28) + HOP_OBSTACLE_WIDTH_MIN(26) = 54px` — `30 < 54`
guarantees at least one sampled frame registers any true overlap, so no
obstacle can be skipped over entirely (no missed collision, no incorrect
`cleared++`).

Re-ran the full standard checklist (menu start; flight physics/scoring/
difficulty-as-pure-function-of-score; ceiling-blocks/ground-kills/pipe
collisions; snapshot deep-copy via fresh `{...p}` spreads in both
`snapshot()` and `restore()`; resume grace period and bird reset; repeated
death→Hop→resume cycles; true game-over score capture before `savedFlight`
is nulled; edge-triggered input with the `e.repeat` guard; `clearAction()`
on both `DEATH_TRANSITION`/`RESUME_TRANSITION` entries; originality/palette;
unbounded-array checks for pipes/obstacles) — nothing new diverges from
DESIGN.md or looks like a logic/physics bug.

No new bugs found.

