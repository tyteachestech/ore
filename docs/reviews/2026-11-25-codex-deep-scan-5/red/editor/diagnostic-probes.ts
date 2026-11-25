import {open,select,ops,history} from './harness';
import {addMatrix,duplicate,cellOf,layoutMatrix,setLabel,DEFAULT_STYLE,toScene} from '../../apps/desktop/src/draw/model';
// One-variable controls for turn-math.
for(const md of ['Equation $$x+1$$\n','Equation x+1\n'])for(const kind of ['toggle','h2','code'] as const){
 const h=await open(md);select(h.view,'Equation');h.view.dispatch(ops.turnInto(h.view.state,ops.selectedBlock(h.view.state)!,kind)!);
 console.log('[DEEP] turn',JSON.stringify({input:md,kind,doc:h.view.state.doc.toJSON(),markdown:h.md()}));await h.close();
}
// The native paste route, with only the plain string changed.
for(const text of ['First\nSecond','First Second','First\tSecond']){
 const h=await open('| A | B |\n|---|---|\n| KEEP | NEIGHBOR |\n');select(h.view,'KEEP');
 for(const p of h.view.state.plugins){const fn=p.props.handlePaste;if(fn)p.props.handlePaste=(v:any,e:any,s:any)=>{const out=fn(v,e,s);console.log('[DEEP] paste-handler',JSON.stringify({text,key:p.key,handled:!!out,slice:s.toJSON(),emptySelection:v.state.selection.empty}));return out;};}
 const ev=new window.Event('paste',{bubbles:true,cancelable:true});Object.defineProperty(ev,'clipboardData',{value:{getData:(t:string)=>t==='text/plain'?text:'',files:[],types:['text/plain']}});h.view.dom.dispatchEvent(ev);
 console.log('[DEEP] paste-result',JSON.stringify({text,out:h.md()}));await h.close();
}
let seed=42;Math.random=()=>((seed=(seed*1664525+1013904223)>>>0)/2**32);
for(const separateId of [false,true]){
 const base=addMatrix([],[0,0],2,2,DEFAULT_STYLE).els;const d=duplicate(base,new Set(base.map(e=>e.id)),500,0);let els=d.els;const copy=els.find(e=>d.ids.includes(e.id))!;
 if(separateId)els=els.map(e=>d.ids.includes(e.id)?{...e,customData:{...e.customData,oreCell:{...cellOf(e)!,matrix:copy.groupIds[0]!}}}:e);
 const mid=cellOf(els.find(e=>e.id===copy.id)!)!.matrix;
 els=setLabel(els,copy.id,'Copied notes',DEFAULT_STYLE);const before=els.find(e=>e.id===copy.id)!.x;els=layoutMatrix(els,mid);const after=els.find(e=>e.id===copy.id)!.x;
 console.log('[DEEP] matrix',JSON.stringify({separateId,afterSetLabel:before,afterLayout:after,savedX:(toScene(els,null).elements as any[]).find(e=>e.id===copy.id).x}));
}
