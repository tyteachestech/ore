import assert from 'node:assert/strict';
import { setup, snap, git, rel, history, pinClock, advance, run } from './support';
import { addHighlight, findAnnotation, readAnnotations, reviseAnnotation, annotationsPath } from '../../packages/core/src/annotations';
import { findItem } from '../../packages/core/src/items';
import { highlights } from '../../apps/desktop/src/highlights';
pinClock();
const {lib,item} = await setup('undo-highlight');
const phrase = item.body.trim().split('\n').find(l=>l.length>20 && !l.startsWith('#'))!;
const a = addHighlight(item,{exact:phrase, intent:'keep',note:'A: recovered note'});
const old = snap(lib);
advance();
reviseAnnotation(item,a,{note:'B: intermediate note'});
const h = history();
const hl = highlights({
 run,
 show(){}, landed(){}, notify:h.notify, label:i=>i, page:()=>({off(){},on(){}}), unsaved:new Map()
});
hl.read(readAnnotations(item),false);
advance();
await hl.setNote(a.id,'C: app edit');
await hl.allSaved();
await h.settle();
const mode=process.argv[2]??'checkout';
if(mode==='stash') git(lib,'stash','push','-m','scout restore','--',rel(lib,item.dir));
else {
  snap(lib);
  if(mode==='restore') git(lib,'restore','--source',old,'--',rel(lib,item.dir));
  else if(mode==='whole') git(lib,'checkout',old,'--','.');
  else if(mode==='revert') git(lib,'revert','--no-edit','HEAD');
  else if(mode!=='control') git(lib,'checkout',old,'--',rel(lib,item.dir));
}
console.log('restore mode:',mode);
if(mode==='control') {
  h.h.undo(); await h.settle();
  assert.equal(readAnnotations(findItem(lib,item.meta.id))[0]!.note,'B: intermediate note');
  console.log('PASS: Undo without external restore returns the prior app value');
  process.exit(0);
}
assert.equal(readAnnotations(findItem(lib,item.meta.id))[0]!.note,'A: recovered note');
// A real completed refresh, no write or read in flight.
hl.read(readAnnotations(findItem(lib,item.meta.id)),true,hl.reading());
console.log('after restore:',hl.list()[0]!.note);
console.log('core revision before Undo:',findAnnotation(lib,a.id).annotation.rev);
console.log('captured undo still present:',h.h.canUndo);
h.h.undo();
await h.settle();
console.log('after Undo:',readAnnotations(findItem(lib,item.meta.id))[0]!.note);
console.log('errors:',JSON.stringify(h.errors));
assert.equal(readAnnotations(findItem(lib,item.meta.id))[0]!.note,'A: recovered note','app-01: old Undo must not replace the recovered note');
