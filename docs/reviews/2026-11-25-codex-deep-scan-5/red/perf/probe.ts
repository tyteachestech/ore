// Boundary instrumentation installed before dynamically importing core/CLI.
import fs from 'node:fs';
import {mock} from 'bun:test';
import {syncBuiltinESMExports, createRequire} from 'node:module';
import {join,relative} from 'node:path';
const lib=process.env.ORE_LIBRARY!;
if(!lib?.includes('/codex-out/perf/libs/'))throw Error('scratch library required');
process.env.ORE_NO_ENRICH='1';
if(process.env.DEEP_NOW){const RealDate=Date;const time=RealDate.parse(process.env.DEEP_NOW);globalThis.Date=class extends RealDate{constructor(...args:any[]){super(...(args.length?args:[time]) as [any]);}static now(){return time;}} as DateConstructor;}
const trace:{op:string,path:string,bytes?:number,stack?:string}[]=[];
const subprocess:any[]=[];
let active=false;
for(const op of ['readFileSync','writeFileSync','appendFileSync','readdirSync','statSync','existsSync','renameSync','unlinkSync','mkdirSync','openSync','closeSync']){
 const original=(fs as any)[op];
 (fs as any)[op]=function(...args:any[]){
  const p=String(args[0]);const included=active&&p.startsWith(lib);
  const entry:any={op,path:relative(lib,p)};
  if(included){if(process.env.DEEP_STACK==='1')entry.stack=new Error().stack?.split('\n').slice(2,8).join('\n'); trace.push(entry);}
  const out=original.apply(this,args);
  if(included&&op==='readFileSync')entry.bytes=typeof out==='string'?Buffer.byteLength(out):out.byteLength;
  return out;
 };
}
syncBuiltinESMExports();
mock.module('node:fs',()=>({...fs,default:fs}));
for(const op of ['spawn','spawnSync'] as const){const orig=Bun[op];(Bun as any)[op]=function(...args:any[]){if(active)subprocess.push({op,args:args[0]});return (orig as any)(...args);};}
const {commands}=await import('../../packages/cli/src/commands.ts');
const {parseArgs}=await import('node:util');
const args=process.argv.slice(2),name=args.shift()!,cmd=commands[name];
const parsed=parseArgs({args,options:cmd.options,allowPositionals:true});
active=true;const t=performance.now();
let answer:any,error:string|undefined;
try{answer=(await cmd.run(parsed.positionals,parsed.values)).data;}catch(e){error=String(e);}
const ms=performance.now()-t;active=false;
const byOp:Record<string,number>={},byKind:Record<string,number>={};
for(const e of trace){byOp[e.op]=(byOp[e.op]??0)+1;if(e.op==='readFileSync'){const k=e.path.endsWith('/doc.md')?'doc.md':e.path.startsWith('cards/')?'cards':e.path.startsWith('reviews/')?'reviews':e.path.endsWith('notes.md')?'notes':e.path;byKind[k]=(byKind[k]??0)+1;}}
console.log(JSON.stringify({command:[name,...args],ms,byOp,reads:byKind,readBytes:trace.reduce((s,e)=>s+(e.bytes??0),0),uniqueDocuments:new Set(trace.filter(e=>e.op==='readFileSync'&&e.path.endsWith('/doc.md')).map(e=>e.path)).size,subprocess,error,resultSize:JSON.stringify(answer)?.length,answer:process.env.DEEP_ANSWER==='1'?answer:undefined,trace:process.env.DEEP_TRACE==='1'?trace:undefined}));
if(error)process.exitCode=1;
