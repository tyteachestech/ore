import { fresh, log } from './harness';
import { unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const { addSource, reimportSource } = await import('../../packages/core/src/ingest/index');
const { sourceFile } = await import('../../packages/core/src/items');
const { doctor } = await import('../../packages/core/src/doctor');
const lib = fresh('doctor-original');
const item = await addSource(lib, resolve('packages/core/test/fixtures/intake/files/notes.docx'));
const before = await doctor(lib);
unlinkSync(sourceFile(item)!);
const after = await doctor(lib);
const fixed = await doctor(lib, { fix: true });
let error = '';
try { await reimportSource(lib, item.meta.id); } catch (e) { error = (e as Error).message; }
log('missing-original', { before: before.issues, after: after.issues, fix: fixed, reimportError: error });
assert(after.issues.some(i => /original|source\.docx|kept.*file|file.*kept/i.test(i.message + i.path)), 'Doctor must name the missing kept original and its recovery step');
