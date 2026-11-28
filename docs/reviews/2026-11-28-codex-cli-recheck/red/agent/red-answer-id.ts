import assert from 'node:assert/strict';
import {seed,ore} from './common.ts';
const {item}=await seed('answer-id');
const q=await ore('highlight',item.meta.id,'--exact','Spacing retrieval across days strengthens later recall.','--intent','question','--note','Why does spacing help?');
const NativeDate=Date;
const tick=Date.now();
globalThis.Date=class extends NativeDate {constructor(...a:any[]){super(...(a.length?a:[tick]) as [any]);} static now(){return tick;}} as DateConstructor;
try {
 await ore('answer',q.id,'--text','First explanation');
 await ore('answer',q.id,'--text','Second explanation');
} finally {globalThis.Date=NativeDate;}
const before=(await ore('questions')).find((x:any)=>x.id===q.id).answers;
await ore('answer',q.id,'--edit',before[1].ts,'--text','Second explanation corrected');
const after=(await ore('questions')).find((x:any)=>x.id===q.id).answers;
console.log('[DEEP] before',JSON.stringify(before.map((x:any)=>({ts:x.ts,text:x.text}))));
console.log('[DEEP] after',JSON.stringify(after.map((x:any)=>({ts:x.ts,text:x.text}))));
assert.deepEqual(after.map((x:any)=>x.text),['First explanation','Second explanation corrected'],'editing the second answer must not overwrite the first');
