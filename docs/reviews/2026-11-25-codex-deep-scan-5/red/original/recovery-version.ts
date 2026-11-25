import { fresh, log } from './harness';
import { copyFileSync, mkdirSync, readFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const { addSource, reimportSource, reimportRecovery } = await import('../../packages/core/src/ingest/index');
const { findItem } = await import('../../packages/core/src/items');
const { doctor } = await import('../../packages/core/src/doctor');
const lib = fresh('recovery-version');
const v1 = 'Topic,Answer\nSpacing,Wait one day\n', v2 = 'Topic,Answer\nSpacing,Wait seven days\n';
let served = v1;
globalThis.fetch = (async () => new Response(served, { headers: {'content-type': 'text/csv'} })) as typeof fetch;
const item = await addSource(lib, 'https://original.invalid/lesson.csv');
served = v2;
const changed = await reimportSource(lib, item.meta.id);
assert(changed.changed && changed.step);
const stash = join(lib.root, '.ore', 'reimport', item.meta.id, changed.step);
const swap = stash + '.swap'; mkdirSync(swap);
// The real pre-#538 swapFiles (0f24ee6:index.ts:819-825) first copied the current
// version here, unlinked canonical files, then copied the target's original before doc.md.
for (const f of ['doc.md', 'source.csv']) copyFileSync(join(item.dir, f), join(swap, f));
unlinkSync(item.docPath);
copyFileSync(join(stash, 'source.csv'), join(item.dir, 'source.csv'));
if (process.argv.includes('--missing-original')) unlinkSync(join(item.dir, 'source.csv'));
log('before', { recovery: reimportRecovery(lib, item.dir)?.split('/').pop(), currentOriginal: process.argv.includes('--missing-original') ? 'missing' : readFileSync(join(item.dir, 'source.csv'), 'utf8') });
const fixed = await doctor(lib, { fix: true });
const recovered = findItem(lib, item.meta.id);
const original = readFileSync(join(item.dir, 'source.csv'), 'utf8');
log('after', { fixed: fixed.fixed.map(s => s.replace(item.dir.replace(lib.root + '/', ''), '<item>')), issues: fixed.issues, body: recovered.body, original, consistent: recovered.body.includes('seven days') === original.includes('seven days') });
assert(recovered.body.includes('seven days') === original.includes('seven days'), 'Doctor recovery must restore doc.md and the original from the same version');
