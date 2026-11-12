// The iPhone's library is Ore's iCloud Drive folder (D222): the core's writes reach the folder, and the
// Mac's edits (arriving through iCloud) reach the core. The folder here is a map standing in for the
// phone shell's file commands (apps/phone/src-tauri/src/lib.rs).
import { expect, test } from "bun:test";
import fs, { flush, load, mountDisk, rescan } from "../src/phone/fs";

const P = "/icloud";
let clock = 1000;
const folder = new Map<string, { text: string; mtime: number }>();
const sent: [string, string | null, boolean?][] = [];
const stamp = (rel: string) => `${folder.get(rel)!.mtime}:${folder.get(rel)!.text.length}`;
let waiting: string[] = [];
let other: string[] = [];
/** Files the folder holds that the phone lists but doesn't load, as base64. */
const shared = new Map<string, string>();

const invoke = async <T,>(cmd: string, args: Record<string, unknown> | Uint8Array, options?: { headers: Record<string, string> }): Promise<T> => {
  // A binary file goes as its raw bytes (lib.rs `library_write`); kept here as base64 to compare.
  if (cmd === "library_write") {
    const rel = decodeURIComponent(options!.headers["x-path"]!);
    const text = Buffer.from(args as Uint8Array).toString("base64");
    sent.push([rel, text, true]);
    folder.set(rel, { text, mtime: ++clock });
    return [rel, clock, stamp(rel)] as T;
  }
  args = args as Record<string, unknown>;
  if (cmd === "library_scan") return { files: [...folder.keys()].map((r) => [r, folder.get(r)!.mtime, stamp(r)]), waiting, other } as T;
  if (cmd === "library_read") return (args.paths as string[]).map((r) => folder.get(r)?.text ?? null) as T;
  if (cmd === "library_bytes") return (shared.get(args.path as string) ?? null) as T;
  if (cmd === "library_apply") {
    const out: [string, number, string][] = [];
    for (const [rel, text, b64] of args.ops as [string, string | null, boolean][]) {
      sent.push(b64 ? [rel, text, true] : [rel, text]);
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

  // A file deleted while its first write is still on its way is deleted from the folder too.
  fs.writeFileSync(`${P}/new.md`, "x");
  const first = flush();
  fs.unlinkSync(`${P}/new.md`);
  await first;
  await flush();
  expect(folder.has("new.md")).toBe(false);

  // A pasted picture reaches the folder as its bytes, and isn't dropped later as gone.
  sent.length = 0;
  fs.writeFileSync(`${P}/items/a-01/images/p.png`, new Uint8Array([137, 80, 78, 71]));
  await flush();
  expect(sent).toEqual([["items/a-01/images/p.png", "iVBORw==", true]]);
  await rescan();
  expect(fs.existsSync(`${P}/items/a-01/images/p.png`)).toBe(true);

  // A source deleted on the phone goes from the folder whole, with files the phone never loaded.
  sent.length = 0;
  fs.rmSync(`${P}/items/a-01`, { recursive: true });
  await flush();
  expect(sent[0]).toEqual(["items/a-01", null]);

  // A file iCloud is still downloading can't be written over with what the phone wrongly thinks it holds.
  waiting = ["reviews/2026-10.iphone.jsonl"];
  await rescan();
  expect(() => fs.appendFileSync(`${P}/reviews/2026-10.iphone.jsonl`, "{}\n")).toThrow(/still downloading/);
  waiting = [];
});

test("a picture saved with an atomic write reaches the folder byte for byte", async () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0xff, 0xd8, 0x00, 0x80]);
  sent.length = 0;
  fs.writeFileSync(`${P}/items/c-03/assets/.x.png.tmp`, png);
  fs.renameSync(`${P}/items/c-03/assets/.x.png.tmp`, `${P}/items/c-03/assets/x.png`);
  await flush();
  expect(sent).toEqual([["items/c-03/assets/x.png", Buffer.from(png).toString("base64"), true]]);
});

test("a file the phone lists but doesn't load (audio, a PDF) is found, never copied as empty, and goes when the Mac deletes it", async () => {
  other = ["items/c-03/source.m4a"];
  await rescan();
  expect(fs.existsSync(`${P}/items/c-03/source.m4a`)).toBe(true);
  expect(() => fs.readFileSync(`${P}/items/c-03/source.m4a`)).toThrow(/not loaded/);
  sent.length = 0;
  expect(() => fs.renameSync(`${P}/items/c-03/source.m4a`, `${P}/items/c-03/moved.m4a`)).toThrow(/not loaded/);
  await flush();
  expect(sent).toEqual([]);
  other = [];
  await rescan();
  expect(fs.existsSync(`${P}/items/c-03/source.m4a`)).toBe(false);
});

test("a launch doesn't wait for transcripts iCloud is still bringing", async () => {
  waiting = ["items/c-03/source.vtt"];
  const t0 = Date.now();
  await mountDisk(P, "/root", invoke);
  expect(Date.now() - t0).toBeLessThan(900);
  waiting = [];
});

test("a file the share sheet saved to the inbox is loaded when asked for, read as its bytes, and copied whole", async () => {
  const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0xff, 0x00, 0x80]);
  other = ["inbox/01X/paper.pdf"];
  shared.set("inbox/01X/paper.pdf", Buffer.from(pdf).toString("base64"));
  await rescan();
  expect(() => fs.readFileSync(`${P}/inbox/01X/paper.pdf`)).toThrow(/not loaded/);
  expect(await load(`${P}/inbox/01X/paper.pdf`)).toBe(true);
  expect(new Uint8Array(fs.readFileSync(`${P}/inbox/01X/paper.pdf`) as unknown as Uint8Array)).toEqual(pdf);
  sent.length = 0;
  fs.copyFileSync(`${P}/inbox/01X/paper.pdf`, `${P}/items/d-04/source.pdf`);
  await flush();
  expect(sent).toEqual([["items/d-04/source.pdf", Buffer.from(pdf).toString("base64"), true]]);
  // A shared text file reads as its text too.
  other = ["inbox/01X/paper.pdf", "inbox/01Z/notes.txt"];
  shared.set("inbox/01Z/notes.txt", Buffer.from("Spacing works.").toString("base64"));
  await rescan();
  await load(`${P}/inbox/01Z/notes.txt`);
  expect(fs.readFileSync(`${P}/inbox/01Z/notes.txt`, "utf8")).toBe("Spacing works.");
  // One that isn't in the folder (not downloaded yet) says so.
  expect(await load(`${P}/inbox/01Y/gone.pdf`)).toBe(false);
  // Imported and removed: it leaves the listing.
  other = [];
  await rescan();
  expect(fs.existsSync(`${P}/inbox/01X/paper.pdf`)).toBe(false);
});
