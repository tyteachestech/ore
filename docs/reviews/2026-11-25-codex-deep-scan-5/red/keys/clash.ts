import {BINDINGS, rebind, resetKeys, is, clash} from '../../apps/desktop/src/keys';
import {handler,event} from './extract';
resetKeys();
console.log('[DEEP] first conflict:',clash('section','KeyK')?.id);
console.log('[DEEP] replace result:',rebind('section','KeyK',true));
const e=event('k',{code:'KeyK', target:{closest(){return null},tagName:'DIV'}});
console.log('[DEEP] active commands:',BINDINGS.filter(b=>is(e,b.id)).map(b=>b.id));
let play=0,recall=0;
const reader=handler('apps/desktop/src/Reader.tsx','const inNote = t === noteRef.current',{
 p:{blocked:false},closedBook:false,noteRef:{current:null}, is, isLoose:()=>false,block:null,doc:{},PHONE:false,
 video:true,player:{ready:true,toggle(){play++}},ownsMediaKey:()=>false,
 popup:null,listen:null,focus:null,lookup:null,margin:{current:{focusNearest(){recall++}}}
});
reader(e);
console.log(`[DEEP] K on a video after assigning Recall this chapter: play=${play} recall=${recall}; expected play=0 recall=1`);
const failed=play!==0||recall!==1;
if(process.argv.includes('--probe')) {
 console.log('[DEEP] remaining conflict:',clash('section','KeyK')?.id);
 console.log('[DEEP] remove remaining Play/Pause binding:',rebind('play-alt',''));
 play=0; recall=0; reader(e);
 console.log(`[DEEP] with remaining conflict removed: play=${play} recall=${recall}`);
 resetKeys();
 console.log('[DEEP] control: K defaults active:',BINDINGS.filter(b=>is(e,b.id)).map(b=>b.id));
 console.log('[DEEP] default sound/silent collision:',clash('prev-post','KeyK')?.id ?? null);
}
resetKeys();
process.exitCode=failed?1:0;
