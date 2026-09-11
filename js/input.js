// Keyboard/pointer/touch -> a single edge-triggered action.
// One flap/jump per keypress or tap, not continuous while held.

let pending = false;

function trigger() {
  pending = true;
}

export function initInput(target) {
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
      e.preventDefault(); // stop page scroll on space/arrow
      if (e.repeat) return; // ignore OS auto-repeat; one flap per physical press
      trigger();
    }
  });

  const el = target || window;
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    trigger();
  });
}

// Edge-triggered read: returns whether an action happened since the last
// call, then clears it.
export function consumeAction() {
  const action = pending;
  pending = false;
  return action;
}

// Forcibly clears any buffered action. Called the instant the state
// machine enters a transition state, so a keypress that caused death (or
// was buffered mid-transition) can't leak into the next state as a free
// extra input.
export function clearAction() {
  pending = false;
}
