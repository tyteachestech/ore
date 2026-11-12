// The iPhone's library is Ore's iCloud Drive folder (D219): the core's writes reach the folder, and the
// Mac's edits (arriving through iCloud) reach the core. The folder here is a map standing in for the
// phone shell's file commands (apps/phone/src-tauri/src/lib.rs).
import { expect, test } from "bun:test";
import fs, { flush, mountDisk, rescan } from "../src/phone/fs";

const P = "/icloud";
let clock = 1000;
const folder = new Map<string, { text: string; mtime: number }>();
const sent: [string, string | null][] = [];
const stamp = (rel: string) => `${folder.get(rel)!.mtime}:${folder.get(rel)!.text.length}`;
let waiting: string[] = [];

const invoke = async <T,>(cmd: string, args: Record<string, unknown>): Promise<T> => {
  if (cmd === "library_scan") return { files: [...folder.keys()].map((r) => [r, folder.get(r)!.mtime, stamp(r)]), waiting } as T;
  if (cmd === "library_read") return (args.paths as string[]).map((r) => folder.get(r)?.text ?? null) as T;
  if (cmd === "library_apply") {
    const out: [string, number, string][] = [];
    for (const [rel, text] of args.ops as [string, string | null][]) {
      sent.push([rel, text]);
      if (text === null) folder.delete(rel);
      else {
        folder.set(rel, { text, mtime: ++clock });
        out.push([rel, clock, stamp(rel)]);
      }
    }
    return out as T;
  }
  throw new Error(cmd);
};
/** An edit on the Mac, as iCloud brings it to the phone's folder. */
const mac = (rel: string, text: string | null) => (text === null ? folder.delete(rel) : folder.set(rel, { text, mtime: ++clock }));

test("the phone reads the folder, writes back to it, and reads in the Mac's edits", async () => {
  folder.set("skills.yaml", { text: "skills: []\n", mtime: 1 });
  folder.set("items/a-01/doc.md", { text: "# A", mtime: 1 });
  await mountDisk(P, "/root", invoke);
  expect(fs.readFileSync(`${P}/items/a-01/doc.md`)).toBe("# A");
  expect(fs.statSync(`${P}/items/a-01/doc.md`).mtimeMs).toBe(1);

  // An atomic write sends the file once, never its temp file.
  fs.writeFileSync(`${P}/.skills.yaml.tmp`, "skills: [x]\n");
  fs.renameSync(`${P}/.skills.yaml.tmp`, `${P}/skills.yaml`);
  fs.appendFileSync(`${P}/reviews/2026-11.iphone.jsonl`, '{"a":1}\n');
  await flush();
  expect(sent).toEqual([
    ["skills.yaml", "skills: [x]\n"],
    ["reviews/2026-11.iphone.jsonl", '{"a":1}\n'],
  ]);
  expect(folder.get("skills.yaml")!.text).toBe("skills: [x]\n");
  // What the phone wrote itself isn't read back in as a change.
  expect(await rescan()).toBe(false);

  // The Mac edits a source and deletes another: both show after a rescan, and an emptied folder goes.
  mac("items/a-01/doc.md", "# A, edited");
  mac("items/b-02/doc.md", "# B");
  expect(await rescan()).toBe(true);
  expect(fs.readFileSync(`${P}/items/a-01/doc.md`)).toBe("# A, edited");
  mac("items/b-02/doc.md", null);
  expect(await rescan()).toBe(true);
  expect(fs.existsSync(`${P}/items/b-02`)).toBe(false);
  expect(fs.readdirSync(`${P}/items`)).toEqual(["a-01"]);

  // A file iCloud has evicted (a placeholder) is waiting, not gone.
  folder.delete("items/a-01/doc.md");
  waiting = ["items/a-01/doc.md"];
  expect(await rescan()).toBe(false);
  expect(fs.readFileSync(`${P}/items/a-01/doc.md`)).toBe("# A, edited");
  waiting = [];

  // Deleting a file the folder never had sends nothing.
  sent.length = 0;
  fs.writeFileSync(`${P}/scratch.md`, "x");
  fs.unlinkSync(`${P}/scratch.md`);
  await flush();
  expect(sent).toEqual([]);
});
