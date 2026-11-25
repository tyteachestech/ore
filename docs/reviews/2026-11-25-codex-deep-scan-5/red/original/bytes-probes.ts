import { fresh, log } from './harness';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
const { addSource } = await import('../../packages/core/src/ingest/index');
const { sourceFile } = await import('../../packages/core/src/items');
const samples: [string, Buffer][] = [
 ['utf8.csv', Buffer.from('Term,Meaning\r\nCafé,Coffee\r\n')],
 ['utf16.csv', Buffer.concat([Buffer.from([255,254]), Buffer.from('Term,Meaning\r\nCafé,Coffee\r\n', 'utf16le')])],
 ['utf16.md', Buffer.concat([Buffer.from([255,254]), Buffer.from('# Café\r\n\r\nThe original words stay.\r\n', 'utf16le')])],
 ['bom.ipynb', Buffer.concat([Buffer.from([239,187,191]), readFileSync('packages/core/test/fixtures/intake/files/numpy.ipynb')])],
 ['lecture.srt', readFileSync('packages/core/test/fixtures/intake/files/lecture.srt')],
 ['notes.docx', readFileSync('packages/core/test/fixtures/intake/files/notes.docx')],
];
for (const [name, bytes] of samples) {
  const lib = fresh('bytes-' + name);
  const input = join(lib.root, name); writeFileSync(input, bytes);
  const item = await addSource(lib, input);
  const path = sourceFile(item)!;
  log(name, { saved: path.split('/').pop(), identical: bytes.equals(readFileSync(path)), inputBytes: bytes.length, savedBytes: readFileSync(path).length, sourceCount: 1 });
}
