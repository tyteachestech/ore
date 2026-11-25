import {handler,event} from './extract';
import {is,inTextField,rebind,resetKeys} from '../../apps/desktop/src/keys';
let edited=0,retired=0,rated=0,later=0;
Date.now=()=>10000;
const surface={tagName:'DIV',contains(){return false},closest(){return null}};
function key(phase='checked') {return handler('apps/desktop/src/Review.tsx','s.holdUndo({ code:',{
 paused:false,under:false,root:{current:surface},document:{querySelectorAll(){return []},body:surface},is,inTextField,
 s:{busy:false},phase,asking:false,end:null,card:{id:'A',kind:'card'},shownAnswerAt:{current:0},suggested:3,
 edit(){edited++},retire(){retired++},rate(){rated++},later(){later++},PHONE:false,passage:null
});}
resetKeys();
console.log('[DEEP] Edit exercise rebind Meta+KeyE:',rebind('edit-card','Meta+KeyE'));
const on=key();
on(event('e',{code:'KeyE',metaKey:true,target:surface}));
console.log(`[DEEP] accepted shortcut Edit exercise: edited=${edited}; expected=1`);
const failed=edited!==1;
if(process.argv.includes('--probe')) {
 resetKeys(); on(event('e',{code:'KeyE',target:surface}));console.log(`[DEEP] same handler with default E: edited=${edited}; expected=1`);
 rebind('edit-card','Shift+KeyE');on(event('E',{code:'KeyE',shiftKey:true,target:surface}));console.log(`[DEEP] Shift-only rebind: edited=${edited}; expected=2`);
 resetKeys();on(event('3',{code:'Digit3',repeat:true,target:surface}));console.log(`[DEEP] held rating ignored: rated=${rated}; expected=0`);
 on(event('l',{code:'KeyL',metaKey:true,repeat:true,target:surface}));console.log(`[DEEP] held Later ignored: later=${later}; expected=0`);
 on(event('3',{code:'Digit3',target:{tagName:'TEXTAREA'}}));console.log(`[DEEP] rating key in answer field ignored: rated=${rated}; expected=0`);
}
resetKeys();process.exitCode=failed?1:0;
