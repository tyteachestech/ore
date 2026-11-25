import {handler,event} from './extract';
import {is,inTextField,resetKeys} from '../../apps/desktop/src/keys';
resetKeys();Date.now=()=>10000;
let sure:number[]=[],rates:number[]=[];
const surface={tagName:'DIV',contains(){return false},closest(){return null}};
function key(phase:string){return handler('apps/desktop/src/Review.tsx','s.holdUndo({ code:',{
 paused:false,under:false,root:{current:surface},document:{body:surface,querySelectorAll(){return []}},is,inTextField,
 s:{busy:false},phase,asking:false,end:null,card:{id:'A',kind:'card'},shownAnswerAt:{current:0},suggested:3,
 pickSure(n:number){sure.push(n)},rate(n:number){rates.push(n)},PHONE:false,passage:null
});}
const answer=key('answer'), checked=key('checked');
answer(event('3',{code:'Numpad3',location:3,target:surface}));
checked(event('3',{code:'Numpad3',location:3,target:surface}));
console.log(`[DEEP] Numpad3: confidence=${JSON.stringify(sure)} ratings=${JSON.stringify(rates)}; expected [3], [3]`);
const failed=sure.length!==1||rates.length!==1;
if(process.argv.includes('--probe')) {
 answer(event('3',{code:'Digit3',location:0,target:surface})); checked(event('3',{code:'Digit3',location:0,target:surface}));
 console.log(`[DEEP] same key, code Digit3: confidence=${JSON.stringify(sure)} ratings=${JSON.stringify(rates)}`);
 checked(event('Enter',{code:'NumpadEnter',location:3,target:surface}));
 console.log(`[DEEP] NumpadEnter does accept suggested rating: ratings=${JSON.stringify(rates)}`);
}
process.exitCode=failed?1:0;
