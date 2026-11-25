import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { mock } from 'bun:test';
export const OUT = resolve('codex-out/original');
process.env.ORE_NO_ENRICH = '1';
process.env.TMPDIR = join(OUT, 'tmp');
process.env.PATH = join(OUT, 'bin') + ':' + process.env.PATH;
for (const vendor of ['claude', 'codex']) writeFileSync(join(OUT, 'bin', vendor), '#!/bin/sh\necho "AI disabled for reading scout" >&2\nexit 97\n', {mode: 0o755});
globalThis.fetch = (async () => { throw new Error('Network disabled for reading scout'); }) as typeof fetch;
mock.module('../../packages/core/src/ingest/thumbnail.ts', () => ({
  makeThumbnail: async () => undefined, courseCoverFile: () => undefined,
  epubCover: () => undefined, makeCourseCover: async () => undefined,
  pageImage: () => undefined, thumbnailFile: () => undefined,
}));
export function fresh(name: string) {
  const root = join(OUT, 'libs', name);
  rmSync(root, { recursive: true, force: true });
  for (const dir of ['', 'items', 'cards', 'reviews', 'topics', 'sessions', '.ore', '.index']) mkdirSync(join(root, dir), { recursive: true });
  writeFileSync(join(root, 'skills.yaml'), 'skills: []\n');
  process.env.ORE_LIBRARY = root;
  return { root };
}
export function log(label: string, value: unknown) { console.log('[DEEP]', label, JSON.stringify(value)); }
