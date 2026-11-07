import { describe, expect, test } from "bun:test";

// Where a video picks up when its source opens again (D50): where he stopped, or the start once it
// played to the end, as YouTube resumes. Tyler 2026-11-07: a finished video starts over, paused.
describe("video resume", () => {
  test("picks up where he stopped", async () => {
    const { resumeAt } = await import("../src/Video");
    expect(resumeAt(125.7, 600, false)).toBe(125);
    expect(resumeAt(125.7, 0, false)).toBe(125); // length not known yet
  });
  test("a video played to its end starts over", async () => {
    const { resumeAt } = await import("../src/Video");
    expect(resumeAt(600, 600, true)).toBe(0);
    expect(resumeAt(599.5, 600, false)).toBe(0);
  });
});
