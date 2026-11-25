import assert from 'node:assert/strict';
import {open} from './harness';
import {renderedLinks} from '../../packages/core/src/links';
import {parseSkillsFile} from '../../packages/core/src/skills';
const id=process.argv[2]??'A B';
const config=parseSkillsFile({skills:[{id,name:'Space skill',priority:'P2'}]});
assert.equal(config.file.skills[0]?.id,id,'Fixture id must be supported by core');
const h=await open('');const v=h.view;
// Same mark and insertion as the [[ picker in NoteEditor.tsx:400-401.
v.dispatch(v.state.tr.replaceSelectionWith(v.state.schema.text('Space skill',[v.state.schema.marks.link.create({href:'ore:skill/'+id})]),false).setStoredMarks([]));
const markdown=h.md();const reopened=await open(markdown);const href=reopened.view.state.doc.firstChild.firstChild.marks[0].attrs.href;
const links=renderedLinks(markdown);
console.log('[DEEP]',JSON.stringify({supportedId:config.file.skills[0]?.id,markdown,reopenedHref:href,coreLinks:links}));
await h.close();await reopened.close();assert.equal(links[0]?.target.id,id,'Core backlinks must see the supported skill link written by the picker');
