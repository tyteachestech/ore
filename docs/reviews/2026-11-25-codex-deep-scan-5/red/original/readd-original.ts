import { fresh, log } from './harness';
import { copyFileSync, readFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const { addSource, reimportSource, canReimport } = await import('../../packages/core/src/ingest/index');
const { sourceFile, setItemArchived, findItem } = await import('../../packages/core/src/items');
const lib = fresh('readd-original');
const input = join(lib.root, 'notes.docx'); copyFileSync('packages/core/test/fixtures/intake/files/notes.docx', input);
const item = await addSource(lib, input);
if (process.argv.includes('--archived')) await setItemArchived(lib, item.meta.id, true);
if (!process.argv.includes('--intact')) unlinkSync(sourceFile(item)!);
let refusal = '';
try { await reimportSource(lib, item.meta.id); } catch (e) { refusal = (e as Error).message; }
const again = await addSource(lib, input);
const now = findItem(lib, again.meta.id);
log('readd', { refusal, kept: again.kept, restored: again.restored, sameId: now.meta.id === item.meta.id, originalKept: !!sourceFile(now), canReimport: canReimport(now), archived: !!now.meta.archived_at });
assert(sourceFile(now), 'Following Add the file again must restore a usable kept original');
assert(readFileSync(sourceFile(now)!).equals(readFileSync(input)), 'The restored original is the supplied file');
