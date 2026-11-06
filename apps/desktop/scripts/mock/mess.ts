// What a real library on a Mac picks up that our code never writes: Finder's .DS_Store in every
// folder it opens, AppleDouble "._" files from external drives and zips, the custom-icon "Icon\r"
// file, a stray text file and an empty "untitled folder". Both seeds add it so every mock run
// is against a messy library, not a clean one.
import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export function addMess(root: string) {
  const dirs = [root, ...["items", "cards", "reviews", "topics", "inbox"].map((d) => join(root, d))];
  const years = readdirSync(join(root, "items")).filter((d) => /^\d{4}$/.test(d)).map((y) => join(root, "items", y));
  const firstItem = years[0] ? readdirSync(years[0]).filter((d) => !d.startsWith("."))[0] : undefined;
  for (const d of [...dirs, ...years, ...(firstItem ? [join(years[0]!, firstItem)] : [])]) {
    mkdirSync(d, { recursive: true });
    writeFileSync(join(d, ".DS_Store"), Buffer.from([0, 0, 0, 1, 0x42, 0x75, 0x64, 0x31]));
  }
  for (const y of years) {
    writeFileSync(join(y, "._" + (firstItem ?? "x")), Buffer.from([0, 5, 22, 7]));
    writeFileSync(join(y, "Icon\r"), "");
    writeFileSync(join(y, "reading list.txt"), "things to add later\n");
    mkdirSync(join(y, "untitled folder"), { recursive: true });
  }
}
