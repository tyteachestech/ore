import assert from 'node:assert/strict';
import * as m from '../../apps/desktop/src/draw/model';
let seed=20261125;Math.random=()=>((seed=(seed*1664525+1013904223)>>>0)/2**32);
Date.now=()=>1795550400000;
let els:m.El[]=[];const history:m.El[][]=[];let runs=0;
for(let i=0;i<180;i++){
 const before=JSON.stringify(els);const snapshot=els;history.push(snapshot);
 const nodes=els.filter(m.isNode);const node=nodes[Math.floor(Math.random()*nodes.length)];
 const choice=i%9;
 if(!node||choice===0)els=[...els,m.shape('rectangle',{x:Math.floor(Math.random()*800),y:Math.floor(Math.random()*600),w:160,h:64},m.DEFAULT_STYLE)];
 else if(choice===1)els=m.setLabel(els,node.id,'Words <>& " café 日本 😀 '+i,m.DEFAULT_STYLE);
 else if(choice===2)els=m.move(els,new Set([node.id]),13,-7);
 else if(choice===3&&nodes.length>1){const b=nodes.find(x=>x.id!==node.id)!;els=[...els,m.connect(els,node,b,m.DEFAULT_STYLE)];}
 else if(choice===4)els=m.duplicate(els,new Set([node.id])).els;
 else if(choice===5)els=m.group(els,new Set(nodes.slice(0,2).map(e=>e.id)));
 else if(choice===6)els=m.ungroup(els,new Set(nodes.map(e=>e.id)));
 else if(choice===7)els=m.remove(els,new Set([node.id]));
 else els=m.reorder(els,new Set([node.id]),'front');
 assert.equal(JSON.stringify(snapshot),before,'Model operation mutated an undo snapshot');
 const ids=new Set(els.map(e=>e.id));assert.equal(ids.size,els.length,'duplicate element id');
 for(const e of els){for(const b of [e.startBinding,e.endBinding])if(b)assert.ok(ids.has(b.elementId),'orphan arrow');if(e.containerId)assert.ok(ids.has(e.containerId),'orphan text');}
 const saved=m.toScene(els,null);const loaded=m.fromScene(JSON.parse(JSON.stringify(saved)));const savedAgain=m.toScene(loaded,saved);
 assert.deepEqual(savedAgain,saved,'Save/load changed diagram');
 const next=els;els=history.pop()!;assert.equal(JSON.stringify(els),before);els=next; // same immutable snapshot semantics as Editor.restore
 runs++;
}
console.log('[DEEP] PASS',JSON.stringify({runs,elements:els.length,seed:20261125,checks:['immutable undo snapshots','unique ids','bound targets survive','save/load idempotence','model snapshot undo/redo']}));
