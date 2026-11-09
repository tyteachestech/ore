/** Which list reads may land, against the writes around them.
 *
 *  Only the newest read lands: an older one answering late would put back what came after it. Nor
 *  does a read land when a write started, or settled, while it was out: one begun after a row's
 *  optimistic write would put the row back (a second A then archives it again), and one begun while
 *  an earlier write was still saving may have read the library before that write reached it (an Undo
 *  pressed while its archive still saved: the read shows the row gone, and the selection moves off it).
 *  Each write reads the list again once it settles, so the newer read brings the truth; a write that
 *  hangs never settles, so a read begun after it still lands and never freezes the list. */
export const readGuard = () => {
  let reads = 0;
  let writes = 0;
  const bump = () => void writes++;
  return {
    /** Counts a write, when it starts and when it settles; returns the same promise. */
    writing<T>(p: Promise<T>): Promise<T> {
      writes++;
      p.then(bump, bump);
      return p;
    },
    /** Starts a read: `newest()` says no later read began; `lands()` also says no write started or settled since. */
    begin() {
      const n = ++reads;
      const w = writes;
      return { newest: () => n === reads, lands: () => n === reads && w === writes };
    },
  };
};
