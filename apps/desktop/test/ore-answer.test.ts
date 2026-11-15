import { expect, test } from "bun:test";
import { answered } from "../src/ore";
import { errorText } from "../src/util";

// Codex sweep 6: an AI command that printed nothing came back as null, and the screen read its reply inside a
// state updater, where the throw escaped every catch: Ask took Review down ("null is not an object"), and the
// tutor's turn waited forever with Stop doing nothing.
test("F-new-ask-null: an AI reply, grade or check that comes back empty is a failure the screen can say, never a null to read", () => {
  for (const args of [["ask", "c1"], ["tutor", "Why?"], ["grade", "c1"], ["check", "s1", "1"], ["key-points", "s1"], ["explain", "s1"], ["research", "q1"], ["ask-library", "Why?"], ["recall", "s1", "--feedback"]]) {
    let e: unknown;
    try {
      answered(args, null);
    } catch (x) {
      e = x;
    }
    expect({ args, said: errorText(e, "answer that") }).toEqual({ args, said: "Couldn’t answer that: got an unexpected reply. Try again, or carry on without it." });
  }
  // Writes and reads that may print nothing stay as they were.
  expect(answered(["card", "retire", "c1"], null)).toBeNull();
  expect(answered(["recall", "s1", "--text=hi"], null)).toBeNull();
  expect(answered(["ask", "c1"], { reply: "Sure" })).toEqual({ reply: "Sure" });
});
