import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { queueFile, queueLink, queuedLinks } from "../../../packages/core/src/inbox";
import { itemCommands } from "../../../packages/cli/src/cmd-items";
import { change } from "../src/change";
import type { Notify } from "../src/util";

for (const file of [false, true]) {
  test(`waiting ${file ? "file" : "link"}: the screen's Remove, Undo and Redo keep the original entry (PHONE-02)`, async () => {
    const root = mkdtempSync(join(tmpdir(), "ore-waiting-undo-"));
    const previous = process.env.ORE_LIBRARY;
    process.env.ORE_LIBRARY = root;
    try {
      writeFileSync(join(root, "skills.yaml"), "skills: []\n");
      const input = join(root, "paper.pdf");
      const bytes = Buffer.from([0x25, 0x50, 0x44, 0x46, 0xff, 0x00]);
      writeFileSync(input, bytes);
      const entry = file ? queueFile({ root }, input) : queueLink({ root }, "https://example.com/paper");
      unlinkSync(input);
      const source = readFileSync(new URL("../src/phone/PhoneApp.tsx", import.meta.url), "utf8");
      const start = source.indexOf("  const removeWaiting = (l: Waiting) => {");
      const end = source.indexOf("\n\n  return (", start);
      if (start < 0 || end < 0) throw new Error("Waiting callback not found");
      const js = new Bun.Transpiler({ loader: "tsx" }).transformSync(source.slice(start, end));
      let undo!: () => unknown;
      let redo!: () => unknown;
      const notify: Notify = (_message, _kind, u, r) => {
        if (u) undo = u;
        if (r) redo = r;
        return Object.assign(() => {}, { undo() {}, hold() {} });
      };
      const ore = async (_cmd: string, flag: string, id: string, keep?: string) => {
        const result = await itemCommands.inbox!.run([], { [flag.slice(2)]: id, ...(keep === "--keep" ? { keep: true } : {}) });
        return result?.data;
      };
      const remove = new Function("change", "notify", "ore", "removing", "setWaiting", "refresh", js + "; return removeWaiting;")(
        change, notify, ore, { current: new Set() }, () => {}, async () => {},
      );
      expect(await remove(entry)).toBe(true);
      expect(queuedLinks({ root })).toEqual([]);
      await undo();
      expect(queuedLinks({ root })).toEqual([entry]);
      if (entry.file) expect(readFileSync(join(root, "inbox", entry.file))).toEqual(bytes);
      await redo();
      expect(queuedLinks({ root })).toEqual([]);
      await undo();
      expect(queuedLinks({ root })).toEqual([entry]);
    } finally {
      if (previous === undefined) delete process.env.ORE_LIBRARY;
      else process.env.ORE_LIBRARY = previous;
      rmSync(root, { recursive: true, force: true });
    }
  });
}
