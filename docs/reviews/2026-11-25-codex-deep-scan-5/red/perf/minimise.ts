import {cpSync,existsSync,mkdirSync,readdirSync} from 'node:fs';
import {join,basename} from 'node:path';
import {initLibrary} from '../../packages/core/src/init.ts';
import {allItems} from '../../packages/core/src/items.ts';
import {listCards} from '../../packages/core/src/cards.ts';
import {loadSkills,removeSkill} from '../../packages/core/src/skills.ts';
const lib={root:join(import.meta.dir,'libs/mini')};
if(existsSync(lib.root) && allItems(lib).length)process.exit(0);
await initLibrary(lib.root);
for(const s of loadSkills(lib).skills)if(!['ai','learning'].includes(s.id))await removeSkill(lib,s.id);
const from={root:join(import.meta.dir,'libs/base')};const cards=listCards(from);const a=(cards.find(c=>c.meta.state==='live')??cards[0])!, b=cards.find(c=>c.meta.item!==a.meta.item)!;
for(const c of [a,b]){const item=allItems(from).find(i=>i.meta.id===c.meta.item)!;const year=basename(join(item.dir,'..'));mkdirSync(join(lib.root,'items',year),{recursive:true});cpSync(item.dir,join(lib.root,'items',year,basename(item.dir)),{recursive:true});cpSync(c.path,join(lib.root,'cards',basename(c.path)));}
console.log('[DEEP] mini: 2 sources, 2 exercises, 2 skills, no reviews; created through init/skill core plus copies of seed sources');
