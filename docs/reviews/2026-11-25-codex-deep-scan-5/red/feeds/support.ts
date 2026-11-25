import { mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { initLibrary } from '../../packages/core/src/init.ts';
import { setSystemTime } from 'bun:test';
setSystemTime(new Date('2026-11-24T12:00:00.000Z'));
process.env.ORE_DEVICE = 'feeds-scout';
process.env.ORE_NO_ENRICH = '1';
// No path from this harness can launch an actual vendor CLI.
const bin = fileURLToPath(new URL('./bin/', import.meta.url));
mkdirSync(bin, {recursive:true});
for (const vendor of ['claude','codex']) {
  const p = join(bin, vendor);
  await Bun.write(p, '#!/bin/sh\necho "AI forbidden in feeds scout" >&2\nexit 99\n');
  const {chmodSync} = await import('node:fs'); chmodSync(p, 0o755);
}
process.env.PATH = bin + ':' + process.env.PATH;
globalThis.fetch = (async () => {throw new Error('network must be stubbed')}) as typeof fetch;
export async function scratch(name: string) {
  const root = fileURLToPath(new URL(`./libs/${name}/`, import.meta.url));
  rmSync(root, {recursive:true, force:true});
  await initLibrary(root);
  process.env.ORE_LIBRARY = root;
  return {root};
}
export const rss = (name: string, posts: string[] = [name]) => `<rss version="2.0"><channel><title>${name}</title><link>https://example.test/</link>${posts.map(p => `<item><title>${p}</title><link>https://example.test/${p}</link></item>`).join('')}</channel></rss>`;
export const response = (text:string, url?:string) => {
  const r = new Response(text, {headers:{'content-type':'application/rss+xml'}});
  if (url) Object.defineProperty(r, 'url', {value:url});
  return r;
};
export function deferred<T>() { let resolve!: (v:T)=>void; const promise=new Promise<T>(r=>resolve=r); return {resolve,promise}; }
