import { fresh, log } from './harness';
import { copyFileSync, readFileSync, writeFileSync, openSync, ftruncateSync, closeSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const { addSource, reimportSource, canReimport } = await import('../../packages/core/src/ingest/index');
const { sourceFile, renameItem, setItemArchived, findItem, listItems } = await import('../../packages/core/src/items');
for (const name of ['paper.pdf','notes.docx','deck.pptx','word.rtf','vocab.xlsx','verbs.csv','numpy.ipynb','obsidian-note.md','lecture.srt']) {
 const lib = fresh('matrix-' + name);
 const input = join(lib.root, name); copyFileSync('packages/core/test/fixtures/intake/files/' + name, input);
 const initial = readFileSync(input); const item = await addSource(lib, input);
 const original = sourceFile(item)!; const bytes = readFileSync(original);
 await renameItem(lib, item.meta.id, 'Renamed source');
 const same = await addSource(lib, input);
 assert.equal(same.meta.id,item.meta.id);
 await setItemArchived(lib,item.meta.id,true);
 const back = await addSource(lib,input);
 assert.equal(back.meta.id,item.meta.id); assert(back.restored);
 assert(readFileSync(original).equals(bytes)); assert.equal(sourceFile(back),original);
 log(name, {sourceName: original.split('/').pop(), originalByteIdentical: initial.equals(bytes), stableThroughRenameDuplicateRestore:true});
}
const lib = fresh('oversized');
const input=join(lib.root,'too-large.pdf'); const fd=openSync(input,'w'); ftruncateSync(fd,201*1024*1024); closeSync(fd);
let refused=''; try {await addSource(lib,input)} catch(e){refused=(e as Error).message}
assert(/over 200 MB/.test(refused)); assert.equal(listItems(lib).length,0); assert(existsSync(input));
log('oversized-sparse-file',{refused,inputRetained:true,sources:0});
