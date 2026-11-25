import {writeFileSync,appendFileSync} from 'node:fs';import {join} from 'node:path';
import {findItem,allItems,setItemArchived} from '../../packages/core/src/items.ts';import {listCards} from '../../packages/core/src/cards.ts';import {setItemSkills} from '../../packages/core/src/skills.ts';
const root=import.meta.dir,out=join(root,'actions.jsonl');writeFileSync(out,'');
for(const size of ['large','twice-large']){
 const lib={root:join(root,'libs',size)},card=listCards(lib)[0]!,id=card.meta.item,originalSkills=findItem(lib,id).meta.skills;
 const targetSkills=originalSkills.includes('learning')?['ai']:['learning'];
 const cases=[['rating',['review',card.meta.id,'--rating=3','--confidence=2','--elapsed-ms=1000']],['filing',['edit',id,'--skills='+targetSkills.join(',')]],['archive',['archive',id]],['rename-skill',['skills','set','ai','--name=AI performance probe']],['note-save',['notes',id,'--set=A bounded source note.','--base=']]] as const;
 for(let run=0;run<3;run++)for(const [name,args] of cases){if(name==='filing')await setItemSkills(lib,id,originalSkills);if(name==='archive')await setItemArchived(lib,id,false);
  const p=Bun.spawn(['bun',join(root,'probe.ts'),...args],{env:{...process.env,ORE_LIBRARY:lib.root,ORE_NO_ENRICH:'1',DEEP_TRACE:'1',DEEP_STACK:run===0?'1':'0',DEEP_NOW:'2026-11-25T04:00:00.000Z'},stdout:'pipe',stderr:'pipe'});const output=await new Response(p.stdout).text(),err=await new Response(p.stderr).text();if(await p.exited)throw Error(output+err);
  const row={size,name,run,...JSON.parse(output)};appendFileSync(out,JSON.stringify(row)+'\n');console.log('[DEEP]',size,name,run,Math.round(row.ms)+'ms',JSON.stringify(row.byOp));
 }
 await setItemSkills(lib,id,originalSkills);await setItemArchived(lib,id,false);
}
