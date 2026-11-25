import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import * as fs from '../../apps/desktop/src/phone/fs';
const e=new EventTarget();
globalThis.addEventListener=e.addEventListener.bind(e); globalThis.dispatchEvent=e.dispatchEvent.bind(e);
Date.now=()=>1795521600000;
let disk='Old note';
let release!:()=>void;
const held=new Promise<void>(r=>release=r);
let began!:()=>void;
const started=new Promise<void>(r=>began=r);
await fs.mountDisk('/lib','/scratch',async(cmd,args:any)=>{
 if(cmd==='library_scan') return {files:[['skills/learning/notes.md',1,'1:8']],waiting:[],other:[]} as any;
 if(cmd==='library_read') return [disk] as any;
 if(cmd==='library_apply') { began(); await held; disk=args.ops[0][1]; return [['skills/learning/notes.md',2,'2:8']] as any; }
 throw new Error(cmd);
});
fs.writeFileSync('/lib/skills/learning/notes.md','New note');
const saving=fs.flush();
await started;
const mode=process.argv[2]??'inflight';
if(mode==='complete') {release();await saving;}
const s=fs.syncState();
// Evaluate the real Settings status expression against its own real fs state.
const source=readFileSync(join(import.meta.dir,'../../apps/desktop/src/phone/Settings.tsx'),'utf8');
const start=source.indexOf('  const line = !s.icloud');
const end=source.indexOf('\n  return (',start);
const status=new Function('s','ago',source.slice(start,end)+';return line;')(s,()=> 'just now');
console.log('[DEEP]',JSON.stringify({mode,state:s,status,disk,saveStillHeld:mode!=='complete'}));
release(); await saving;
assert.ok(mode==='complete' ? status.startsWith('Up to date') : !status.startsWith('Up to date'),'Settings must not say Up to date while its new note has not reached the folder');
