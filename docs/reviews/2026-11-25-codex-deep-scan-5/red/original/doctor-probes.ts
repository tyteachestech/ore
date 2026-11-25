import { fresh, log } from './harness';
import { unlinkSync, rmSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
const { addSource, addText } = await import('../../packages/core/src/ingest/index');
const { sourceFile } = await import('../../packages/core/src/items');
const { doctor } = await import('../../packages/core/src/doctor');
for (const file of ['notes.docx', 'paper.pdf', 'deck.pptx']) {
  const lib = fresh('doctor-' + file);
  const item = await addSource(lib, resolve('packages/core/test/fixtures/intake/files/' + file));
  const original = sourceFile(item)!;
  unlinkSync(original);
  rmSync(join(lib.root, '.index'), { recursive: true, force: true });
  log(file, { type: item.meta.type, missingOriginal: original.split('/').pop(), report: await doctor(lib) });
}
const lib = fresh('doctor-controls');
const item = await addText(lib, '# Pasted words\n\nThere is no external file to check.');
log('text-control', await doctor(lib));
unlinkSync(item.docPath);
log('missing-doc-control', await doctor(lib));
