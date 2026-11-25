import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { addSkill, setSkillLook, loadSkills, arrangeSkills } from '../../packages/core/src/skills.ts';
import { skillGroups, layoutOf } from '../../apps/desktop/src/Skills.tsx';
const mode=process.argv[2]??'add';
const root=resolve(`codex-out/courses/libs/collision-${mode}`);
rmSync(root,{recursive:true,force:true});mkdirSync(root,{recursive:true});
writeFileSync(`${root}/skills.yaml`,'skills: []\n');
const lib={root};
const a=await addSkill(lib,'Alpha',mode==='picker'?'Work Desk':'Work');
const b=await addSkill(lib,'Beta',mode==='add'?'work':'');
if(mode==='set') await setSkillLook(lib,b.id,{collection:'work'});
if(mode==='picker') {
 const typed='work   desk';const collections=['Work Desk'];
 const offered=!collections.some(c=>c.toLowerCase()===typed.toLowerCase());
 assert.ok(offered);console.log('[DEEP] picker offers',JSON.stringify(typed));
 await setSkillLook(lib,b.id,{collection:typed});
}
if(mode==='control') await setSkillLook(lib,b.id,{collection:'Work'});
const skills=loadSkills(lib).skills;
const layout=layoutOf(skillGroups(skills));
let error='';try{await arrangeSkills(lib,layout);}catch(e){error=(e as Error).message;}
console.log('[DEEP]',JSON.stringify({mode,skills:skills.map(s=>({name:s.name,collection:s.collection})),layout,error}));
assert.equal(error,'','a layout created by supported writes must remain rearrangeable');
console.log('[DEEP] PASS');
