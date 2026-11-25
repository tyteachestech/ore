import assert from 'node:assert/strict';
import {rmSync} from 'node:fs';
import {open,select,ops} from './harness';
import {keepUnedited} from '../../apps/desktop/src/editor/preserve';
import {initLibrary} from '../../packages/core/src/init';
import {addSkill} from '../../packages/core/src/skills';
import {setNotes,getNotes} from '../../packages/core/src/notes';
const root=new URL('./libs/save-boundary',import.meta.url).pathname;rmSync(root,{recursive:true,force:true});await initLibrary(root);const lib={root};const skill=await addSkill(lib,'Probe');
for(const kind of ['math','table']){
 const original=kind==='math'?'Equation $$x+1$$\n':'| H1 | H2 |\n|---|---|\n| KEEP | NEIGHBOR |\n';const h=await open(original);const base=h.md();
 await setNotes(lib,{skill:skill.id},original);
 if(kind==='math'){select(h.view,'Equation');h.view.dispatch(ops.turnInto(h.view.state,ops.selectedBlock(h.view.state)!,'toggle')!);}
 else {select(h.view,'KEEP');const e=new window.Event('paste',{bubbles:true,cancelable:true});Object.defineProperty(e,'clipboardData',{value:{getData:(t:string)=>t==='text/plain'?'First\nSecond':'',files:[]}});h.view.dom.dispatchEvent(e);}
 const save=keepUnedited(original,base,h.md());await setNotes(lib,{skill:skill.id},save,original);const saved=getNotes(lib,{skill:skill.id}).text;
 console.log('[DEEP] on-disk',JSON.stringify({kind,saveMatchesEditor:save===h.md(),savedMatchesRequested:saved===save,stillHasOldContent:saved.includes(kind==='math'?'x+1':'NEIGHBOR')}));assert.equal(saved,save);await h.close();
}
