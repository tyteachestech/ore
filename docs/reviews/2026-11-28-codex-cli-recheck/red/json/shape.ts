import assert from 'node:assert/strict';
import { setup, call } from './common.ts';
const { lib } = await setup('shape');
const added = await call('try', [], { skill: 'learning', plan: 'Recall one idea after reading' });
const id = added.data.id;
const edited = await call('try', [id], { when: 'After coffee' });
const tried = await call('tried', [id]);
const listed = await call('tries', [], { skill: 'learning' });
const rows = [['try-add', added], ['try-plan', edited], ['tried', tried], ['tries', { code: listed.code, data: listed.data[0] }]] as const;
const bad: string[] = [];
for (const [name, r] of rows) {
  const keys = { id: 'string', item: 'string', item_title: 'string', exact: 'string', intent: 'string', status: 'string', rev: 'number', start: 'number', end: 'number' };
  const missing = Object.entries(keys).filter(([k,t]) => typeof r.data[k] !== t).map(([k]) => k);
  console.log('[DEEP]', JSON.stringify({ name, code: r.code, missing, data: r.data }));
  if (missing.length) bad.push(`${name}: ${missing.join(', ')}`);
}
assert.deepEqual(bad, [], 'answers.ts Try promises item_title for try and tried');
