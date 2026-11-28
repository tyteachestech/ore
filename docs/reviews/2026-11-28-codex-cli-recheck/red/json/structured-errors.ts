import assert from 'node:assert/strict';
import { setup,call,hashes,diff } from './common.ts';
const {lib}=await setup('structured-errors');
const errors:string[]=[];
for (const [command,flag,value] of [['tutor','earlier','{}'],['tutor','files','{}'],['tutor','earlier','[null]'],['ask-library','earlier','{}'],['ask-library','earlier','[null]']]) {
 const before=hashes(lib.root);
 const r=await call(command!,['Recall'],{[flag!]:value});
 const changes=diff(before,hashes(lib.root));
 console.log('[DEEP]',JSON.stringify({command,flag,value,...r,changed:changes}));
 assert.equal(r.code,1);assert.deepEqual(changes,[]);
 if(!r.data.error.includes('--'+flag)||!/(JSON|array|list|\[\{)/i.test(r.data.error))errors.push(`${command} --${flag}: ${r.data.error}`);
}
assert.deepEqual(errors,[],'malformed structured input needs an actionable flag/schema error');
