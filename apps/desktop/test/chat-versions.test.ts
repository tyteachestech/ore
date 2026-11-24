import { expect, test } from "bun:test";
import { askAgain as again1, flip, shelve, versionCount, versionShown } from "../src/chat-versions";
import type { TutorTurn } from "../src/Tutor";

const turn = (message: string, reply?: string, more: Partial<TutorTurn> = {}): TutorTurn => ({ id: "t1", message, ...(reply === undefined ? {} : { reply }), ...more });
/** What Try another reply and Edit do: set the shown version aside, then a new reply lands. */
const again = (t: TutorTurn, message: string, reply: string): TutorTurn => ({ id: t.id, message, ...shelve(t), reply });

test("a turn with one reply has one version and no pager", () => {
  const t = turn("Why?", "Because.");
  expect(versionCount(t)).toBe(1);
  expect(versionShown(t)).toBe(0);
  expect(flip(t, 1)).toBe(t);
});

test("another reply is added last and shown; flipping back shows the first with everything it had", () => {
  const first = turn("Why?", "Because.", { citations: [], steps: ["a", "b"], kept: "card1" });
  const second = again(first, "Why?", "Since.");
  expect([versionCount(second), versionShown(second)]).toEqual([2, 1]);
  const back = flip(second, 0);
  expect(back).toMatchObject({ id: "t1", message: "Why?", reply: "Because.", steps: ["a", "b"], kept: "card1", alt: 0 });
  expect(back.alts).toEqual([{ message: "Why?", reply: "Since." }]);
  expect(flip(back, 1)).toMatchObject({ reply: "Since.", alt: 1, alts: [{ message: "Why?", reply: "Because.", citations: [], steps: ["a", "b"], kept: "card1" }] });
});

test("an edit keeps the old message with its reply, and a third version made from the first lands last", () => {
  const edited = again(turn("Why?", "Because."), "Why, simply?", "It just is.");
  expect(flip(edited, 0).message).toBe("Why?");
  const third = again(flip(edited, 0), "Why?", "Again.");
  expect([versionCount(third), versionShown(third)]).toEqual([3, 2]);
  expect([0, 1, 2].map((i) => flip(third, i).reply)).toEqual(["Because.", "It just is.", "Again."]);
});

test("a reply that failed is replaced where it stands, never kept as a version", () => {
  const failed = turn("Why?", undefined, { error: "No reply came." });
  expect(shelve(failed)).toEqual({});
  const second = again(turn("Why?", "Because."), "Why?", "Since.");
  const broke: TutorTurn = { id: "t1", message: "Why?", ...shelve(second), error: "Offline." };
  expect(versionCount({ id: "t1", message: "Why?", ...shelve(broke), reply: "Third." })).toBe(3);
});

test("a card still being added is not kept as added, and a reply being written is not part of a version", () => {
  const t = again(turn("Why?", "Because.", { kept: "adding", partial: "Bec" }), "Why?", "Since.");
  expect(t.alts).toEqual([{ message: "Why?", reply: "Because." }]);
});

// F319 and the review of #437: a turn asked again goes with what it first went with,
// less an @ he took out of the message by editing it.
test("asking a turn again keeps its source, section, @s and files; an @ edited out no longer points it", () => {
  const memory = { kind: "skill" as const, id: "memory", name: "Memory" };
  const paper = { kind: "source" as const, id: "s1", name: "The paper" };
  const page = { kind: "skill" as const, id: "ai", name: "AI" };
  const old = turn("Compare @Memory and @The paper", "Both.", { item: "s1", at: "The core idea", mentions: [memory, paper], pointed: [memory, paper, page], files: [{ name: "a.png", path: "chats/files/a.png", kind: "image" }] });
  expect(again1(old)).toMatchObject({ item: "s1", at: "The core idea", mentions: [memory, paper], pointed: [memory, paper, page], files: old.files });
  const edited = again1(old, "Explain @The paper");
  expect(edited.mentions).toEqual([paper]);
  expect(edited.pointed).toEqual([paper, page]);
});

test("flipping back to an earlier reply keeps the section he asked from, so Try another reply still sends it (F-new-chat-version-section)", () => {
  const first = turn("Explain this part", "First explanation.", { item: "s1", at: "The second chapter" });
  const second = { ...again1(first), reply: "Second explanation." };
  const back = flip(second, 0);
  expect(back.at).toBe("The second chapter");
  expect(again1(back).at).toBe("The second chapter");
});
