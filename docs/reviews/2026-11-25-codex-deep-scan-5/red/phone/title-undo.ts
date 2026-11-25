import assert from 'node:assert/strict';
import { mkdirSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createItem, renameItem, findItem } from '../../packages/core/src/items';
import { change } from '../../apps/desktop/src/change';
const root = join(import.meta.dir,'libs/title-undo');
rmSync(root,{recursive:true,force:true}); mkdirSync(root,{recursive:true});
const item = await createItem({root},{type:'snippet',title:'Original title',body:'Learning material.',skills:[]});
// A DOM stand-in only: no browser, render, app, server or watcher.
const { Window } = await import(Bun.resolveSync('happy-dom',join(import.meta.dir,'../../apps/desktop')));
const w = new Window();
Object.assign(globalThis,{document:w.document,Element:w.Element,HTMLElement:w.HTMLElement,matchMedia:()=>({matches:false,addEventListener(){},removeEventListener(){}})});
const { sourceActions } = await import('../../apps/desktop/src/list-actions');
let undo: (()=>Promise<unknown>)|undefined;
const notify = (_message: string,_kind: unknown,u?:()=>Promise<unknown>) => { if(u) undo=u; return Object.assign(()=>{},{undo(){},hold(){}}); };
const calls: string[][]=[];
const ore = async (...args: string[]) => {
 calls.push(args);
 if(args[0]==='edit') return renameItem({root},args[1]!,args[3]!);
 if(args[0]==='show') return findItem({root},args[1]!).meta;
 throw new Error('Unexpected command '+args);
};
const actions=sourceActions({ore:ore as any,skills:[],items:()=>{},archived:()=>{},setSkills:()=>{},change:c=>change(notify as any,c),skillChange:()=>Promise.resolve(true),reloadSkills:()=>{}});
const mode=process.argv[2]??'list';
if(mode==='reader') {
 const source=readFileSync(join(import.meta.dir,'../../apps/desktop/src/Reader.tsx'),'utf8');
 const start=source.indexOf('  async function retitle(id: string, before: string, t: string) {');
 const end=source.indexOf('\n\n  /** Sets the author',start);
 assert.ok(start>=0 && end>start);
 const js=new Bun.Transpiler({loader:'tsx'}).transformSync(source.slice(start,end));
 const retitle=new Function('change','ore','p','setDoc',js+'; return retitle;')(change,ore,{notify,onChanged(){}},()=>{});
 await retitle(item.meta.id,'Original title','Phone title');
} else await actions.retitle(item.meta.id,'Original title','Phone title');
await renameItem({root},item.meta.id,'Mac title');
let refused:string|null=null;
try { await undo!(); } catch(e) { refused=String(e); }
const actual=findItem({root},item.meta.id).meta.title;
console.log('[DEEP]',JSON.stringify({mode,actual,expected:'Mac title',refused,calls}));
await w.happyDOM.abort();
assert.equal(actual,'Mac title','F175 recurrence: list Rename Undo must preserve the newer title from another device');
