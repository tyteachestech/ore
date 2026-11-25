// The sources whose exercises are being drafted right now, after Finish (it can take a minute or two, with him
// already elsewhere). Review this source asks it, so "nothing is due" is never said of a source whose exercises
// are on their way (the newcomer of the 2026-11-25 simulated learner run looked for them for 82 s).
const out = new Map<string, number>();

/** `run` is this source's draft: it counts as being drafted until it settles. Returns `run`. */
export function drafting<T>(id: string, run: Promise<T>): Promise<T> {
  out.set(id, (out.get(id) ?? 0) + 1);
  const done = () => {
    const n = (out.get(id) ?? 1) - 1;
    if (n > 0) out.set(id, n);
    else out.delete(id);
  };
  run.then(done, done);
  return run;
}

export const isDrafting = (id: string) => out.has(id);
