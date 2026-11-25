import { join, resolve, sep } from "node:path";
import { z } from "zod";
import { paths, type Library } from "./library.ts";

// Generated ids include Unicode letters and combining marks; paths and empty ids
// are never skills. Validate both saved YAML and callers constructing a path.
export const SkillId = z.string().regex(/^[\p{L}\p{N}\p{M}]+(?:-[\p{L}\p{N}\p{M}]+)*$/u, "skill id must be a nonempty slug (letters, numbers and hyphens); fix skills.yaml");

export function skillDir(lib: Library, id: string): string {
  SkillId.parse(id);
  const root = resolve(paths.skillNotes(lib));
  const dir = resolve(join(root, id));
  if (!dir.startsWith(root + sep)) throw new Error("skill folder must stay inside skills/");
  return dir;
}
