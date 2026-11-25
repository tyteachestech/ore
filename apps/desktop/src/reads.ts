/** Which list reads may land, against the writes around them.
 *
 *  Only the newest read lands: an older one answering late would put back what came after it. Nor
 *  does a read land when a write started, or settled, while it was out: one begun after a row's
 *  optimistic write would put the row back (a second A then archives it again), and one begun while
 *  an earlier write was still saving may have read the library before that write reached it (an Undo
 *  pressed while its archive still saved: the read shows the row gone, and the selection moves off it).
 *  Each write reads the list again once it settles, so the newer read brings the truth. A read
 *  begun with writes outstanding cannot prove what is saved, even if no counter changes during it. */
export const readGuard = () => {
  let reads = 0;
  let writes = 0;
  let pending = 0;
  const settled = () => { writes++; pending--; };
  return {
    /** Counts a write, when it starts and when it settles; returns the same promise. */
    writing<T>(p: Promise<T>): Promise<T> {
      writes++;
      pending++;
      p.then(settled, settled);
      return p;
    },
    /** Starts a read. `unchanged` protects individual fields without rejecting unrelated reads;
     *  `lands` also requires this to be the newest read of the whole list. */
    begin() {
      const n = ++reads;
      const w = writes;
      const out = pending;
      const unchanged = () => out === 0 && w === writes;
      return { newest: () => n === reads, unchanged, lands: () => n === reads && unchanged() };
    },
  };
};
