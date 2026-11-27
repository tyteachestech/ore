/** YouTube state 3 means buffering. Repeated reports keep its start time; leaving it or seeking
 *  starts a fresh wait. Use the player's state, never the app's extrapolated playback clock. */
export function bufferingState(since: number | null, state: number, now: number, seekedAt = 0): { since: number | null; stalled: boolean } {
  const start = state === 3 ? Math.max(since ?? now, seekedAt) : null;
  return { since: start, stalled: start !== null && now - start >= 5000 };
}
