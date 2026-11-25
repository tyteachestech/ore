import { library,fake,check } from './harness.ts';
import { mock } from 'bun:test';
import { Window } from 'happy-dom';
import { act, useState } from 'react';
import { addText } from '../../packages/core/src/ingest/index.ts';
import { writeNewCard,findCard } from '../../packages/core/src/cards.ts';
import { askAboutCard } from '../../packages/core/src/ai/chat.ts';
import { studyCommands } from '../../packages/cli/src/cmd-study.ts';
const lib=await library('ask-provenance');
const item=await addText(lib,'# Learning\n\nRecall helps memory.');
const original={vendor:'claude',model:'first-author',prompt_version:'enrich@25'};
const card=writeNewCard(lib,{item:item.meta.id,kind:'card',skills:[],topics:[],content_type:'fact',question:'What helps?',answer:'Recall.',rubric:[],ai:original});
fake([{data:{reply:'Try this wording.',card:{question:'What strengthens memory?',answer:'Retrieval practice.'}}}],'codex');process.env.ORE_AI_MODEL='rewrite-author';
const result=await askAboutCard(lib,card.meta.id,{message:'Make this clearer.'});
const w=new Window();w.document.write('<!doctype html><html><body></body></html>');
for(const k of ['window','document','HTMLElement','Node','MutationObserver','ResizeObserver','getComputedStyle','navigator']){const v=(w as any)[k];(globalThis as any)[k]=typeof v==='function'&&/^[a-z]/.test(k)?v.bind(w):v;}
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
(globalThis as any).matchMedia=()=>({matches:true,addEventListener(){},removeEventListener(){}});
(globalThis as any).requestAnimationFrame=(f:any)=>setTimeout(()=>f(performance.now()),1);
(globalThis as any).cancelAnimationFrame=clearTimeout;
mock.module('../../apps/desktop/src/ore.ts',()=>({oreJob:async()=>result,cancelOre:async()=>{},opt:(k:string,v:string)=>`--${k}=${v}`}));
mock.module('@tauri-apps/api/event',()=>({listen:async()=>()=>{}}));
const {Ask,NO_ASK}=await import('../../apps/desktop/src/Ask.tsx');
const {createRoot}=await import('react-dom/client');
const {TooltipProvider}=await import('@radix-ui/react-tooltip');
let state:any;let apply:Promise<unknown>|undefined;let proposal:any;
function Host(){const [chat,setChat]=useState(NO_ASK);state=chat;return <TooltipProvider><Ask card={{...card.meta,question:card.question,answer:card.answer,rubric:[]} as any} answer="Recall" chat={chat} setChat={setChat} onApply={async p=>{proposal=p;apply=studyCommands.card!.run(['set',card.meta.id],{question:p.question,answer:p.answer} as any);await apply;}} onClose={()=>{}}/></TooltipProvider>}
const at=document.createElement('div');document.body.appendChild(at);const root=createRoot(at);
try{
 await act(async()=>root.render(<Host/>));
 const button=[...document.querySelectorAll('button')].find(b=>b.textContent==='Make this exercise clearer')!;
 await act(async()=>{button.click();await new Promise(r=>setTimeout(r,10));});
 const use=[...document.querySelectorAll('button')].find(b=>b.textContent==='Use this exercise')!;
 await act(async()=>{use.click();await apply;});
 const saved=findCard(lib,card.meta.id);
 console.log('[DEEP]',JSON.stringify({replyAI:result.ai,turn:state.turns.at(-1),proposal,savedQuestion:saved.question,savedAI:saved.meta.ai}));
 check(saved.meta.ai?.model==='rewrite-author','applying an AI rewrite must retain who wrote the new text');
}finally{await act(async()=>root.unmount());w.happyDOM.abort();}
