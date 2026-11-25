import {handler,event} from './extract';
import {keepKeysIn,is,inTextField,resetKeys} from '../../apps/desktop/src/keys';
import assert from 'node:assert/strict';
resetKeys();
let actions=0;
const questions=handler('apps/desktop/src/Questions.tsx','// Enter that picks a word', {keepKeysIn,is,send(){actions++},commitPieces(){actions++;return Promise.resolve(true)},onClose(){actions++}});
const drawing=handler('apps/desktop/src/draw/Editor.tsx','return endEdit("dir", dirs[e.key])', {live:{current:{editing:{kind:'label'}}},endEdit(){actions++}});
for(const fn of [questions,drawing]) for(const composing of [true,false]) for(const key of ['Enter','Escape','ArrowDown']) {
 const e=event(key,{isComposing:composing,keyCode:229});fn(e);assert.equal(e.defaultPrevented,false);
}
assert.equal(actions,0);
console.log('[DEEP] Question and diagram text handlers preserve composition keys: 12 cases passed');
for(const target of [{tagName:'INPUT'},{tagName:'TEXTAREA'},{isContentEditable:true},{closest:()=>({})}]) assert.equal(inTextField(event('3',{target})),true);
console.log('[DEEP] text-field guard recognises input, textarea, note editor, own-key panel: 4 cases passed');
