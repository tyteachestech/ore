import { expect, test } from "bun:test";
import { RELEARN_GAP } from "../../../packages/core/src/queue";
import { AGAIN_GAP } from "../src/ore";

// One rule, two places: a miss comes back this many exercises later in the session (the app) and in the next session
// that day (core's rebuilt queue). Drifted apart, a retry would come back at one gap or the other depending on Esc.
test("the session's retry gap and the rebuilt queue's are the same", () => {
  expect(AGAIN_GAP).toBe(RELEARN_GAP);
});
