import assert from 'node:assert/strict';
import * as m from '../../apps/desktop/src/draw/model';
let seed=42;Math.random=()=>((seed=(seed*1664525+1013904223)>>>0)/2**32);
const all=m.addMatrix([],[0,0],2,2,m.DEFAULT_STYLE).els;const mid=m.cellOf(all[0]!)!.matrix;
const hole=m.remove(all,new Set([all[3]!.id]));
const layout=m.layoutMatrix(hole,mid);
const grow=m.growMatrix(hole,mid,'row');
console.log('[DEEP]',JSON.stringify({layoutOnlyFinite:layout.every(e=>Number.isFinite(e.width)),lastCornerPresent:hole.some(e=>m.cellOf(e)?.row===1&&m.cellOf(e)?.col===1),growMissingTypes:grow.filter(e=>!e.type).length,growNonFiniteWidths:grow.filter(e=>!Number.isFinite(e.width)).length}));
assert.ok(layout.every(e=>Number.isFinite(e.width)));
