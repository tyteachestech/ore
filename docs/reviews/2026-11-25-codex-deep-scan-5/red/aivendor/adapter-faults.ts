import { library,fake,calls,check } from './harness.ts';
import { runAgent } from '../../packages/core/src/ai/adapter.ts';
import { z } from '../../packages/core/node_modules/zod';
const lib=await library('adapter-faults');
const task={prompt:'try-line' as const,input:{went:'Learned'},schema:z.strictObject({line:z.string().min(1)}),cwd:lib.root};
for(const vendor of ['claude','codex']){
 fake([{data:{line:'A partial candidate'},exit:1,stderr:'fatal: transport failed after output'}],vendor);
 let error='';let result:any;
 try{result=await runAgent(lib,task);}catch(e){error=(e as Error).message;}
 console.log('[DEEP]',JSON.stringify({vendor,error,accepted:result?.data,calls:calls().length}));
 check(!!error,`${vendor} rejects exit 1 even with a parseable candidate`);
}
