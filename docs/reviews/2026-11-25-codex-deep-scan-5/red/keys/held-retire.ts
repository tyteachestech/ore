import {ReviewSession} from '../../apps/desktop/src/review-session';
import {is} from '../../apps/desktop/src/keys';
import {handler,event} from './extract';
const calls:string[]=[];
const s=new ReviewSession(false,(async (...args:string[])=>{calls.push(args.join(' '));return null}) as never);
s.queue=['A','B','C'].map(id=>({id,state:'live',kind:'card',skills:[]})) as never;
s.screen={notify(){return Object.assign(()=>{}, {undo(){},hold(){}})},shown:()=>null,unrated(){},press(){},onClose(){}};
const surface={contains(){return false}};
async function press(repeat:boolean){
 const card={id:s.queue![0]!.id,state:'live'};
 let write=Promise.resolve(false);
 const on=handler('apps/desktop/src/Review.tsx','s.holdUndo({ code:',{
 paused:false,under:false,root:{current:surface},document:{querySelectorAll(){return []}},is,s,phase:'answer',end:null,card,
 retire(){write=s.retire(card,false)}
 });
 on(event('Backspace',{code:'Backspace',metaKey:true,shiftKey:true,repeat,target:{}}));
 await write;
}
await press(false);
await press(true);
console.log('[DEEP] one press then its repeat, each after prior save:',JSON.stringify(calls));
console.log('[DEEP] remaining due:',JSON.stringify(s.queue?.map(x=>x.id)));
console.log('[DEEP] expected: only card retire A; B and C remain due');
const failed=calls.length!==1||s.queue?.[0]?.id!=='B';
if(process.argv.includes('--probe')) {
 s.busy=true; await press(true);
 console.log('[DEEP] repeat while session busy: total retire calls=',calls.length,'remaining=',s.queue?.map(x=>x.id));
 s.busy=false;
}
process.exitCode=failed?1:0;
