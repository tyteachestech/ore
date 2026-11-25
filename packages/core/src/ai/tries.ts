import { z } from "zod";
import { findAnnotation, reviseAnnotation, type TryLine } from "../annotations.ts";
import type { Library } from "../library.ts";
import { withLock } from "../lock.ts";
import { paths } from "../library.ts";
import { loadSkills } from "../skills.ts";
import { runAgent } from "./adapter.ts";

export const TryLineOutput = z.strictObject({ line: z.string().trim().min(1).max(300) });

/** The mole's one line on the latest use of a try (D324): what he wrote about how it went, read against
 *  his plan and the earlier rounds. Stored beside that use; never a grade. */
export async function tryLine(lib: Library, ref: string): Promise<{ id: string; line: TryLine }> {
  const { item, annotation: a } = findAnnotation(lib, ref);
  if (a.intent !== "apply") throw new Error(`${a.id} is a ${a.intent} highlight, not a try`);
  // The use he wrote last: a round still open on the try itself (it is his), else the last round he closed.
  const open = a.status === "done" && !!a.reflection;
  const last = a.uses?.at(-1);
  const went = open ? a.reflection : last?.reflection;
  if (!went) throw new Error("nothing to say yet: write how it went first");
  const skills = loadSkills(lib).skills.filter((s) => item.meta.skills.includes(s.id));
  const { data, ai } = await runAgent(lib, {
    prompt: "try-line",
    cwd: lib.root,
    schema: TryLineOutput,
    input: {
      skill: skills[0] ? { name: skills[0].name, goal: skills[0].goal ?? null } : null,
      passage: a.point ? null : a.exact,
      plan: (open ? a.note : last?.plan) ?? null,
      when: (open ? a.when : last?.when) ?? null,
      obstacle: a.obstacle ?? null,
      rounds: (open ? (a.uses ?? []) : (a.uses ?? []).slice(0, -1)).map((u) => ({ plan: u.plan ?? null, when: u.when ?? null, went: u.reflection ?? null })),
      went,
    },
  });
  const line: TryLine = { text: data.line.trim(), ai };
  return withLock(paths.lock(lib), () => {
    const now = findAnnotation(lib, ref);
    const cur = now.annotation;
    const same = open ? cur.status === "done" && cur.reflection === went : cur.uses?.length === a.uses?.length && cur.uses?.at(-1)?.reflection === went;
    if (!same) throw new Error("the try changed while the mole was thinking");
    reviseAnnotation(now.item, cur, open ? { line } : { uses: [...cur.uses!.slice(0, -1), { ...cur.uses!.at(-1)!, line }] });
    return { id: cur.id, line };
  });
}
