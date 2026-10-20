// Generic bounded undo/redo stack used by the blog canvas editor.
// Deliberately data-only (no React) so it's trivial to unit-reason about and
// to reuse for other future canvas-like features.

export const HISTORY_LIMIT = 15;

export function createHistory(present) {
  return { past: [], present, future: [] };
}

export function pushHistory(history, next, limit = HISTORY_LIMIT) {
  const past = [...history.past, history.present];
  // FIFO drop: once we're over the cap, the oldest snapshot goes first.
  while (past.length > limit) past.shift();
  return { past, present: next, future: [] };
}

export function undo(history) {
  if (history.past.length === 0) return history;
  const previous = history.past[history.past.length - 1];
  const past = history.past.slice(0, -1);
  return { past, present: previous, future: [history.present, ...history.future] };
}

export function redo(history) {
  if (history.future.length === 0) return history;
  const [next, ...rest] = history.future;
  return { past: [...history.past, history.present], present: next, future: rest };
}

export function canUndo(history) {
  return history.past.length > 0;
}

export function canRedo(history) {
  return history.future.length > 0;
}
