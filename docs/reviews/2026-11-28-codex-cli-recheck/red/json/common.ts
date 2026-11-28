import { readdirSync, readFileSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { initLibrary } from '../../packages/core/src/init.ts';
import { addText } from '../../packages/core/src/ingest/index.ts';
import { updateItemMeta, findItem } from '../../packages/core/src/items.ts';
import { addHighlight } from '../../packages/core/src/annotations.ts';
import { commands } from '../../packages/cli/src/commands.ts';
export { commands, updateItemMeta, findItem, addHighlight, addText };
export async function setup(name: string) {
  if (!/^[a-z0-9-]+$/.test(name)) throw Error('unsafe scratch name');
  const root = resolve(import.meta.dir, 'libs', name);
  process.env.ORE_LIBRARY = root;
  process.env.ORE_NO_ENRICH = '1';
  process.env.ORE_DEVICE = 'json-scout';
  delete process.env.ORE_AI; delete process.env.ORE_AI_MODEL;
  process.env.PATH = resolve(import.meta.dir, 'bin') + ':' + process.env.PATH;
  rmSync(root, { recursive: true, force: true });
  await initLibrary(root);
  const lib = { root };
  const item = await addText(lib, '# Learning\n\nRecall improves memory.\n\nSpacing practice helps retention.\n\n| Method | Benefit |\n| --- | --- |\n| Recall | Memory |\n', { skills: ['learning'] });
  return { lib, item };
}
export function hashes(root: string): Record<string,string> {
  const result: Record<string,string> = {};
  function walk(p: string, base = '') {
    for (const e of readdirSync(p, { withFileTypes: true })) {
      if (!base && ['.git', '.ore', '.index'].includes(e.name)) continue;
      const rel = join(base, e.name), full = join(p,e.name);
      if (e.isDirectory()) walk(full, rel);
      else result[rel] = createHash('sha256').update(readFileSync(full)).digest('hex');
    }
  }
  walk(root); return result;
}
export function diff(a: Record<string,string>, b: Record<string,string>) {
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].filter(k => a[k] !== b[k]);
}
export async function call(name: string, args: string[] = [], flags: Record<string,unknown> = {}) {
  try { const r = await commands[name]!.run(args, flags); return { code: r.exitCode ?? 0, data: JSON.parse(JSON.stringify(r.data)) }; }
  catch (e) { return { code: 1, data: { error: (e as Error).message } }; }
}
