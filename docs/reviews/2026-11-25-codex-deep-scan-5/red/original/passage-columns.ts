import { fresh, log } from './harness';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { pdfFixture } from './pdf-fixture';
import { passage } from '../../apps/desktop/src/original-match';
const { openPdf, pdfToDoc } = await import('../../packages/core/src/ingest/pdf');
const left = ['Spread your retrieval practice across several different days.', 'Retrieve the important idea before reading the explanation.', 'Wait a little longer after giving a completely correct answer.'];
const right = ['Unrelated weather station records.', 'Storms arrived on Tuesday evening.', 'Wind speeds decreased on Thursday.'];
let points = left.flatMap((text, i) => [{text, x: 40, y: 700 - i * 15}, {text: right[i]!, x: 350, y: 700 - i * 15}]);
if (process.argv.includes('--grouped')) points = [...points.filter(p => p.x === 40), ...points.filter(p => p.x === 350)];
const lib = fresh('passage-columns');
const bytes = pdfFixture(points); writeFileSync(join(lib.root, 'columns.pdf'), bytes);
const opened = openPdf(bytes); const pdf = await opened.promise;
const pg = await pdf.getPage(1);
const runs = (await pg.getTextContent()).items.flatMap(it => 'str' in it ? [it.str] : []);
const doc = await pdfToDoc(bytes, [
  {page: 1, kind: 'page', box: {l:0,b:0,r:612,t:792}},
  {page: 1, kind: 'text', text: left.join(' '), box: {l:35,b:665,r:320,t:712}},
  {page: 1, kind: 'text', head: true, text: right[0]!, box: {l:345,b:695,r:600,t:712}},
  {page: 1, kind: 'text', text: right.slice(1).join(' '), box: {l:345,b:665,r:600,t:690}},
]);
log('imported-body', doc.body);
assert(doc.body.split(/\n\n/).includes(left.join(' ')), 'The actual import contains the clicked left paragraph as its own block');
const result = passage(runs, left.join(' '));
const marked = result ? runs.slice(result[0], result[1] + 1).join(' ') : '';
await opened.destroy();
log('column-match', { runs, result, marked });
assert(!right.some(t => marked.includes(t)), 'Clicking the left-column passage must never mark unrelated words in the right column (D315)');
