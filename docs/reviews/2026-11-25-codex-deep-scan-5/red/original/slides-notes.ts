import { fresh, log } from './harness';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { unzipSync, zipSync, strFromU8, strToU8 } from '../../packages/core/node_modules/fflate';
const { addSource } = await import('../../packages/core/src/ingest/index');
const { pptxToDoc } = await import('../../packages/core/src/ingest/office');
const lib = fresh('slides-notes');
const files = unzipSync(readFileSync('packages/core/test/fixtures/intake/files/deck.pptx'));
const before = pptxToDoc(zipSync(files));
log('before', { body: before.body });
let changed = 0;
for (const name of Object.keys(files).filter(n => /^ppt\/slides\/_rels\/.+\.rels$/.test(n))) {
  const xml = strFromU8(files[name]!);
  const after = xml.replace(/Target="\.\.\/notesSlides\/([^"]+)"/g, (_, file) => { changed++; return `Target="/ppt/notesSlides/${file}"`; });
  files[name] = strToU8(after);
}
assert(changed > 0, 'Fixture has a notes relationship');
const path = join(lib.root, 'absolute-notes.pptx'); writeFileSync(path, zipSync(files));
const item = await addSource(lib, path);
const notes = before.body.match(/> \*\*Speaker notes:\*\* ([^\n]+)/)?.[1];
assert(notes, 'Original fixture includes speaker notes');
log('notes', { changed, expectedNotes: notes, actualHasNotes: item.body.includes(notes), importedBody: item.body });
assert(item.body.includes(notes), 'An absolute package relationship must retain the same speaker notes as its equivalent relative relationship (D122)');
