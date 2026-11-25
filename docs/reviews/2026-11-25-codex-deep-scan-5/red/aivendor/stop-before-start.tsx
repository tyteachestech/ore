import { check } from './harness.ts';
import { mock } from 'bun:test';
import { Window } from 'happy-dom';
import { act,useState } from 'react';
const w=new Window();
for(const k of ['window','document','HTMLElement','Node','MutationObserver','ResizeObserver','getComputedStyle','navigator']){const v=(w as any)[k];(globalThis as any)[k]=typeof v==='function'&&/^[a-z]/.test(k)?v.bind(w):v;}
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
(globalThis as any).matchMedia=()=>({matches:true,addEventListener(){},removeEventListener(){}});
(globalThis as any).requestAnimationFrame=(f:any)=>setTimeout(()=>f(performance.now()),1);
(globalThis as any).cancelAnimationFrame=clearTimeout;
let listening!:()=>void;
const waiting=new Promise<()=>void>(r=>listening=()=>r(()=>{}));
const events:string[]=[];const ids:string[]=[];const normal=process.argv[2]==='normal';
mock.module('@tauri-apps/api/event',()=>({listen:()=>waiting}));
mock.module('../../apps/desktop/src/ore.ts',()=>({oreJob:async(job:string)=>{ids.push(job);events.push('START vendor job');return {reply:'Done.',proposal:null,session:'claude:fake'}},cancelOre:async(job:string)=>{ids.push(job);events.push('STOP vendor job')},opt:(k:string,v:string)=>`--${k}=${v}`}));
const {Ask,NO_ASK}=await import('../../apps/desktop/src/Ask.tsx');
const {createRoot}=await import('react-dom/client');
const {TooltipProvider}=await import('@radix-ui/react-tooltip');
let state:any;
function Host(){const [chat,setChat]=useState(NO_ASK);state=chat;return <TooltipProvider><Ask card={{id:'exercise',question:'What helps?',answer:'Recall.',rubric:[],kind:'card'} as any} answer="Recall" chat={chat} setChat={setChat} onApply={async()=>{}} onClose={()=>{}}/></TooltipProvider>}
const at=document.createElement('div');document.body.appendChild(at);const root=createRoot(at);
try{
 await act(async()=>root.render(<Host/>));
 await act(async()=>{[...document.querySelectorAll('button')].find(b=>b.textContent==='Why is this the answer?')!.click();});
 check(state.busy,'run is pending while progress listener registers');
 const stop=document.querySelector<HTMLButtonElement>('button[aria-label="Stop"]')??[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')?.includes('Stop'));
 if(!stop)throw Error('Stop not found: '+document.body.innerHTML);
 if(!normal)await act(async()=>stop.click());
 if(!normal)check(!state.busy,'Stop marks the request stopped before the vendor starts');
 await act(async()=>{listening();await new Promise(r=>setTimeout(r,10));});
 console.log('[DEEP]',JSON.stringify({events,error:state.error,turns:state.turns}));
 check(normal?events.join()==='START vendor job':ids.length===2&&ids[0]===ids[1],'the start and Stop use the same job ID, or the no-Stop control starts once');
 check(normal?state.turns.at(-1)?.text==='Done.':!events.includes('START vendor job'),'a stopped request must not start after its progress listener resolves');
}finally{await act(async()=>root.unmount());w.happyDOM.abort();}
