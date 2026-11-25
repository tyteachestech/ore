import {open,select,ops,history,core,ed,key} from './harness';
const cases = [
 ['toggle-list','<details><summary>Title</summary>\n\n- Alpha\n- Beta\n\n</details>\n','Alpha'],
 ['callout-list','> [!note]\n> - Alpha\n> - Beta\n','Alpha'],
 ['nested-toggle','<details><summary>Title</summary>\n\n<details><summary>Inner</summary>\n\nBody\n\n</details>\n\n</details>\n','Inner'],
 ['inline-math','Alpha $$x+1$$ Omega\n','Alpha'],
 ['image','![figure](assets/a.png)\n',''],
 ['list','- Alpha\n  - Nested\n- Beta\n','Alpha'],
 ['table','| Alpha | Beta |\n|---|---|\n| One | Two |\n','Alpha'],
];
for(const [label,md,target] of cases)for(const kind of ops.KINDS){
 const h=await open(md!);const v=h.view;select(v,target!);const before=v.state.doc.textContent; const initial=h.md();const b=ops.selectedBlock(v.state)!;
 try {
 const tr=ops.turnInto(v.state,b,kind.kind);if(!tr){await h.close();continue;}
 v.dispatch(tr);const after=v.state.doc.textContent;const out=h.md();const r=await open(out);const loaded=r.view.state.doc.textContent;
 const lost=[...before.replace(/\s/g,'')].some(c=>!after.includes(c));
 if(lost||after!==loaded||(label==='inline-math'&&!out.includes('x+1'))||(label==='image'&&!out.includes('assets/a.png')))console.log('[DEEP]',JSON.stringify({label,kind:kind.kind,before,after,loaded,out}));
 history.undo(v.state,v.dispatch);if(h.md()!==initial)console.log('[DEEP] UNDO',label,kind.kind,h.md());
 await r.close();
 }catch(e){console.log('[DEEP] ERROR',label,kind.kind,String(e));}
 await h.close();
}
