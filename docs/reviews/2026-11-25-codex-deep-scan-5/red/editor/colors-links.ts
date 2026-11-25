import assert from 'node:assert/strict';
import {open} from './harness';
import {renderedLinks} from '../../packages/core/src/links';
const colors=await import('../../apps/desktop/src/editor/colors');
const names=['Source','Brackets [and] (parentheses)','日本語 café & < >','Back\\slash','A *bold* `code`'];
let checks=0;
for(const name of names)for(const color of colors.COLORS){
 const h=await open('');const v=h.view;const href='ore:skill/learning';
 v.dispatch(v.state.tr.insert(1,v.state.schema.text(name,[v.state.schema.marks.link.create({href})])));
 v.dispatch(colors.paint(v.state,1,name.length+1,{on:'text',color}));const md=h.md();const r=await open(md);
 assert.equal(r.view.state.doc.textContent,name);assert.equal(renderedLinks(md)[0]?.target.id,'learning');await h.close();await r.close();checks++;
}
console.log('[DEEP] PASS',checks,'colored internal links retain text, target, and core backlink visibility');
for(const id of ['A B','a(b)','日本語','Upper_Case']){
 const h=await open('');const v=h.view;const href='ore:skill/'+id;
 v.dispatch(v.state.tr.insert(1,v.state.schema.text('Link',[v.state.schema.marks.link.create({href})])));const md=h.md();const r=await open(md);
 console.log('[DEEP] special-skill',JSON.stringify({id,md,links:renderedLinks(md),reopened:r.view.state.doc.firstChild.firstChild.marks[0]?.attrs.href}));await h.close();await r.close();
}
