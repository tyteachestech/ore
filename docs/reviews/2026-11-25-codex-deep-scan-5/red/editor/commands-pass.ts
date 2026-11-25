import assert from 'node:assert/strict';
import {open,select,ops,history,key,dep} from './harness';
const fixtures=[
 'Before\n\n<details><summary>Title</summary>\n\n- Alpha\n- Beta\n\nBody\n\n</details>\n\nAfter\n',
 'Before\n\n> [!note]\n> Alpha\n>\n> Beta\n\nAfter\n',
 'Before\n\n- Alpha\n  - Nested\n- Beta\n\nAfter\n',
 'Before\n\n| H1 | H2 |\n|---|---|\n| Alpha | Beta |\n\nAfter\n',
 'Before\n\n$$\nx+1\n$$\n\nAfter\n',
];
let count=0;
for(const md of fixtures) {
 const probe=await open(md);const positions=ops.blocksOf(probe.view.state.doc).map(b=>b.from);await probe.close();
 for(const pos of positions)for(const action of ['up','down','duplicate','delete']){
 const h=await open(md);const v=h.view;const before=h.md();const b=ops.blockAt(v.state.doc,pos+1)!;
 const tr=action==='up'?ops.moveBy(v.state,b,-1):action==='down'?ops.moveBy(v.state,b,1):action==='duplicate'?ops.duplicate(v.state,b):ops.remove(v.state,b);
 if(tr){v.dispatch(tr);const out=h.md();const r=await open(out);assert.equal(r.md(),out,action+' must serialize stably');await r.close();assert.ok(history.undo(v.state,v.dispatch));assert.equal(h.md(),before,action+' undo must restore exact original markdown');count++;}
 await h.close();
 }
}
for(const [md,target] of [
 ['- Alpha\n- Beta\n','Beta'],
 ['<details><summary>Title</summary>\n\nBody\n\n</details>\n\nAfter\n','After'],
 ['- Alpha\n\nAfter\n','After'],
] as const){
 const h=await open(md);const before=h.md();select(h.view,target);key(h.view,'Tab');const nested=h.md();const r=await open(nested);assert.equal(r.md(),nested);await r.close();key(h.view,'Tab',{shiftKey:true});assert.equal(h.md(),before);await h.close();count++;
}
const t=await import('../../apps/desktop/src/editor/tables');
for(const action of ['row-above','row-below','row-up','row-down','row-delete','col-left','col-right','col-move-left','col-move-right','col-delete'] as const){
 const h=await open('| H1 | H2 | H3 |\n|---|---|---|\n| A1 | A2 | A3 |\n| B1 | B2 | B3 |\n| C1 | C2 | C3 |\n');const before=h.md();const tr=t.editTable(h.view.state,0,2,1,action);
 assert.ok(tr);h.view.dispatch(tr);const r=await open(h.md());assert.equal(r.md(),h.md());await r.close();history.undo(h.view.state,h.view.dispatch);assert.equal(h.md(),before);await h.close();count++;
}
console.log('[DEEP] PASS',count,'block move/duplicate/delete/indent and table command cases, stable serialization and exact undo');
