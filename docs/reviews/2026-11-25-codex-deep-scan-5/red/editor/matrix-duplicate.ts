import assert from 'node:assert/strict';
import {addMatrix,duplicate,cellOf,setLabel,layoutMatrix,DEFAULT_STYLE,toScene,fromScene} from '../../apps/desktop/src/draw/model';
// Seed ids; no clock, network, library or UI.
let seed=42; Math.random=()=>((seed=(seed*1664525+1013904223)>>>0)/2**32);
let els=addMatrix([],[0,0],2,2,DEFAULT_STYLE).els;
const original=els[0]!;
const copied=duplicate(els,new Set(els.map(e=>e.id)));els=copied.els;
const copy=els.find(e=>copied.ids.includes(e.id))!;
const before=els.map(e=>({id:e.id,x:e.x,y:e.y}));
els=setLabel(els,copy.id,'Copied notes',DEFAULT_STYLE);
// Exactly the text commit path in draw/Editor.tsx:345-346.
els=layoutMatrix(els,cellOf(copy)!.matrix);
const saved=fromScene(JSON.parse(JSON.stringify(toScene(els,null))));
const after=saved.find(e=>e.id===copy.id)!;
console.log('[DEEP]',JSON.stringify({originalMatrix:cellOf(original)!.matrix,copyMatrix:cellOf(copy)!.matrix,differentGroups:original.groupIds[0]!==copy.groupIds[0],copyBefore:{x:copy.x,y:copy.y},copyAfter:{x:after.x,y:after.y},overlapsOriginal:after.x===original.x&&after.y===original.y}));
assert.equal(after.x,copy.x,'Editing a duplicated matrix must not move its cells onto the original matrix');
