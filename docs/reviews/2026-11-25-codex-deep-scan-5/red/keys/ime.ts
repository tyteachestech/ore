import { handler, event } from './extract';
import { is, keepKeysIn } from '../../apps/desktop/src/keys';
const probe = process.argv.includes('--probe');
let bad=0;
function check(name:string, got:unknown, expected:unknown){console.log(`[DEEP] ${name}: actual=${JSON.stringify(got)} expected=${JSON.stringify(expected)}`); if(JSON.stringify(got)!==JSON.stringify(expected)) bad++;}
let added=0;
const add=handler('apps/desktop/src/Add.tsx','skillsRef.current?.querySelector("button")?.click()', {go(){added++}, is, skillsRef:{current:null},onClose(){},following:false,pickFiles(){}});
add(event('Enter',{isComposing:true,keyCode:229}));
check('Add: composing Enter must not import unfinished text',added,0);
let sent:string[]=[];
const tutor=handler('apps/desktop/src/Tutor.tsx','if (at && !e.nativeEvent.isComposing)', {at:null,input:'日本',send(s:string){sent.push(s)}, files:[],busy:false,lastTurn:null});
tutor(event('Enter',{isComposing:false,keyCode:229}));
check('Tutor: WebKit composition-confirm Enter must not send',sent,[]);
let left=0;
const root={current:{contains(){return false}}};
const review=handler('apps/desktop/src/Review.tsx','s.holdUndo({ code:', {paused:false,under:false,root,document:{querySelectorAll(){return []}},is,s:{busy:false,finish(){left++}}, phase:'answer',asking:false,end:null,quick:false});
review(event('Escape',{isComposing:true,keyCode:229,target:{tagName:'TEXTAREA'}}));
check('Review: IME cancel must not finish session',left,0);
let saves=0,closed=0;
const title=handler('apps/desktop/src/TitleField.tsx','if (e.key !== "Enter" || e.nativeEvent.isComposing)', {keepKeysIn,busy:{current:false},settled:{current:false},onClose(){closed++},commit(){saves++}});
title(event('Enter',{isComposing:false,keyCode:229,currentTarget:{value:'日本'}}));
check('TitleField: WebKit composition-confirm must not save/close title',saves,0);
title(event('Escape',{isComposing:true,keyCode:229}));
check('TitleField: IME cancel must not discard rename',closed,0);
if(probe){
 added=0; add(event('Enter',{isComposing:false,keyCode:13})); check('control: ordinary Enter adds',added,1);
 sent=[]; tutor(event('Enter',{isComposing:true,keyCode:229})); check('control: Tutor guards isComposing=true',sent,[]);
 left=0; review(event('Escape',{isComposing:false,keyCode:27,target:{tagName:'TEXTAREA'}}));check('control: ordinary Escape leaves',left,1);
}
process.exitCode=bad?1:0;
