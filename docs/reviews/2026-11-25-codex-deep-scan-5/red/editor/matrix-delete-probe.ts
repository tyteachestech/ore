import * as m from '../../apps/desktop/src/draw/model';
const matrix=m.addMatrix([],[0,0],2,2,m.DEFAULT_STYLE).els;const id=matrix[3]!.id;const mid=m.cellOf(matrix[0]!)!.matrix;
const els=m.remove(matrix,new Set([id]));
try {console.log('[DEEP]',JSON.stringify(m.growMatrix(els,mid,'row')));}catch(e){console.log('[DEEP] error',String(e));}
