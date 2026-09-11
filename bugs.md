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

