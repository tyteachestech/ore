// Work done in slices beside reading (a long text mounting): one pass a frame, sized to fit in it.
// Passes queued back to back starve the paint: Chromium and WebKit draw a frame only once a run of tasks
// stops, so slices of 10 ms in a row made frames of 100 to 250 ms while a book mounted (F737).

/** How many slices fit in one frame's `budget` (ms), from how long one took last time. At least one. */
export const slicesFor = (msPerSlice: number, budget = 8) => (Number.isFinite(msPerSlice) ? Math.max(1, Math.floor(budget / Math.max(msPerSlice, 0.1))) : 1);

/** Runs `fn` once the next frame is drawn, or after `late` ms when none comes (a hidden window draws no
 *  frames, and the work must still finish). Returns a cancel. */
export function afterPaint(fn: () => void, late = 100): () => void {
  let gone = false;
  let run: ReturnType<typeof setTimeout> | undefined;
  const go = () => {
    if (gone) return;
    gone = true;
    cancelAnimationFrame(frame);
    clearTimeout(timer);
    run = setTimeout(fn, 0); // after the frame's own work, not inside it
  };
  const frame = requestAnimationFrame(go);
  const timer = setTimeout(go, late);
  return () => {
    gone = true;
    cancelAnimationFrame(frame);
    clearTimeout(timer);
    clearTimeout(run);
  };
}
