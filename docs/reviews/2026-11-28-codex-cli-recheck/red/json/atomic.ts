import assert from 'node:assert/strict';
import { setup, call, hashes, diff, updateItemMeta, addHighlight, findItem } from './common.ts';
import { findAnnotation } from '../../packages/core/src/annotations.ts';
import { loadSkills } from '../../packages/core/src/skills.ts';
const mode = process.argv[2] ?? 'course';
const { lib, item } = await setup(`atomic-${mode}`);
let args: string[], flags: Record<string,unknown>, command: string;
if (mode === 'course') {
  await updateItemMeta(lib, item.meta.id, m => ({ ...m, course: { id: 'course-scout', title: 'Original course', part: 1 } }));
  command = 'course'; args = ['set', 'course-scout']; flags = { title: 'Changed despite failure', skills: 'missing' };
} else if (mode === 'edit') {
  command = 'edit'; args = [item.meta.id]; flags = { title: 'Changed despite failure', skills: 'learning', cards: '{' };
} else if (mode === 'annotate') {
  const a = addHighlight(findItem(lib, item.meta.id), { exact: 'Recall improves memory.', intent: 'card' });
  command = 'annotate'; args = [a.id]; flags = { exact: 'Spacing practice helps retention.', status: 'invalid' };
} else if (mode === 'settings') {
  command = 'settings'; args = []; flags = { ai: 'codex', model: 'bad model name' };
} else throw Error('unknown mode');
const before = hashes(lib.root);
const state = () => mode === 'settings' ? loadSkills(lib).ai ?? 'claude' : mode === 'annotate' ? findAnnotation(lib, args[0]!).annotation.exact : mode === 'course' ? findItem(lib,item.meta.id).meta.course?.title : findItem(lib,item.meta.id).meta.title;
const beforeState = state();
const result = await call(command, args, flags);
const changed = diff(before, hashes(lib.root));
console.log('[DEEP]', JSON.stringify({ mode, command, args, flags, ...result, changed, beforeState, afterState:state() }));
assert.equal(result.code, 1, 'expected invalid input to fail');
assert.deepEqual(changed, [], `${mode}: rejected command changed canonical library files`);
