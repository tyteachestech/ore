// ORE_CLOCK_OFFSET_MS: run this `ore` that far from the real time (F739). A simulated learner moves the app's page
// clock a day ahead; the mock bridge passes the gap here, so due dates, the day's count and the new-exercise limit move
// with it. Imported first, before anything reads the time; whatever this run starts (background enrichment) inherits it.
const off = Number(process.env.ORE_CLOCK_OFFSET_MS ?? 0);
if (off) {
  const Real = Date;
  class Shifted extends Real {
    constructor(...a: unknown[]) {
      if (a.length) super(...(a as [number]));
      else super(Real.now() + off);
    }
    static override now() {
      return Real.now() + off;
    }
  }
  globalThis.Date = Shifted as DateConstructor;
}
export {};
