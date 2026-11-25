import { join, resolve, sep } from "node:path";
import { z } from "zod";
import { paths, type Library } from "./library.ts";

// A skill's id names its folder under skills/ (its note, its digs). Ore writes slugs, but a hand-written id
// (spaces, underscores, capitals) worked before and must keep working, so only an id that could name another
// folder is refused: empty, `.` or `..`, or holding a slash (deep scan 4, EDGES-03).
export const SkillId = z.string().refine((id) => id.trim() !== "" && id !== "." && id !== ".." && !/[\/\\\0]/.test(id), "skill id can't be empty or hold a slash; fix skills.yaml");

export function skillDir(lib: Library, id: string): string {
  SkillId.parse(id);
  const root = resolve(paths.skillNotes(lib));
  const dir = resolve(join(root, id));
  if (!dir.startsWith(root + sep)) throw new Error("skill folder must stay inside skills/");
  return dir;
}
