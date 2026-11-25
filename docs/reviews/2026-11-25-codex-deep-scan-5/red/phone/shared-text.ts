import assert from 'node:assert/strict';
import { fs, addSource, importQueued, queuedLinks } from './built/core-entry.js';
const events = new EventTarget();
globalThis.addEventListener = events.addEventListener.bind(events);
globalThis.dispatchEvent = events.dispatchEvent.bind(events);
globalThis.fetch = async () => { throw new Error('No network in scout'); };
Bun.spawn = (()=> { throw new Error('No processes or AI in scout'); }) as any;
Bun.spawnSync = (()=> { throw new Error('No processes or AI in scout'); }) as any;
process.env.ORE_DEVICE = 'iphone';
process.env.ORE_NO_TOOLS = '1';
const mode = process.argv[2] ?? 'md';
const ext = mode === 'bytes' ? 'md' : mode;
const path = `inbox/01KE0000000000000000000000/note.${ext}`;
const text = ext === 'vtt' ? 'WEBVTT\n\n00:00:00.000 --> 00:00:04.000\nSpaced retrieval strengthens memory.\n' : '# My learning note\n\nSpaced retrieval strengthens memory.\n';
const queue = JSON.stringify({id:'01KE0000000000000000000000', file: path.slice(6), url:`note.${ext}`, skills:[], device:'iphone', added:'2026-11-24T12:00:00Z'});
const listed = new Map([['skills.yaml','skills: []\n'], ['inbox/01KE0000000000000000000000.file.json', queue]]);
if (mode !== 'bytes' && ext !== 'txt') listed.set(path,text);
await fs.mountDisk('/lib', '/scratch', async (cmd, args: any, options: any) => {
  if(cmd==='library_scan') return {files:[...listed].map(([p,t])=>[p,1,`1:${t.length}`]),waiting:[],other:ext==='txt'?[path]:[]} as any;
  if(cmd==='library_read') return args.paths.map((p: string)=>listed.get(p)??null);
  if(cmd==='library_bytes') return Buffer.from(text).toString('base64') as any;
  if(cmd==='library_apply') return args.ops.filter((o:any)=>o[1]!==null).map(([p,t]:any)=>[p,2,`2:${t.length}`]);
  if(cmd==='library_write') return [decodeURIComponent(options.headers['x-path']),2,'2:1'] as any;
  throw new Error(cmd);
});
if(mode==='bytes') fs.writeFileSync('/lib/'+path,new TextEncoder().encode(text));
await fs.load('/lib/'+path); // exact loadShared boundary: already-listed text is considered loaded
const rawType = typeof fs.readFileSync('/lib/'+path);
console.log('[DEEP] before', fs.readdirSync('/lib/inbox'), queuedLinks({root:'/lib'}));
const got = await importQueued({root:'/lib'}, async (input,skills)=>{
 const item=await addSource({root:'/lib'},input,{skills});
 return {id:item.meta.id,title:item.meta.title};
});
await fs.flush();
console.log('[DEEP]',JSON.stringify({mode,originalLength:text.length,rawType,added:got.added.length,failed:got.failed.map(f=>f.error)}));
assert.equal(got.added.length,1,'A shared text file must import the text the phone already loaded');
