import {join} from 'node:path';import {writeFileSync,appendFileSync} from 'node:fs';
const file=join(import.meta.dir,'confirmation.jsonl');writeFileSync(file,'');let failures=0;
for(let run=0;run<3;run++)for(const [script,args,expected] of [
 ['red.ts',['tries','readiness-two'],1],['red.ts',['dig','readiness-two'],1],['red.ts',['cards','two-two'],1],['red.ts',['file','two-two'],1],['red.ts',['note','lookup-two'],1],['phone-directory-red.ts',['1'],1],
 ['red.ts',['tries','readiness-one'],0],['red.ts',['dig','readiness-one'],0],['red.ts',['cards','one-one'],0],['red.ts',['note','lookup-one'],0],['phone-directory-red.ts',['0'],0],
] as const){const p=Bun.spawn(['bun',join(import.meta.dir,script),...args],{env:{...process.env,ORE_NO_ENRICH:'1',DEEP_NOW:'2026-11-25T04:00:00.000Z'},stdout:'pipe',stderr:'pipe'});const output=await new Response(p.stdout).text(),err=await new Response(p.stderr).text(),code=await p.exited;const ok=code===expected&&!err;appendFileSync(file,JSON.stringify({run,script,args,expected,code,ok,output,err})+'\n');if(!ok)failures++;}
console.log('[DEEP] 18 expected-red runs; 15 control runs; unexpected results:',failures);process.exitCode=failures?1:0;
