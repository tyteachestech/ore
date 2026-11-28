import {fresh,sourceCard,snap,git,at,check} from './helpers.ts';
import {openIndex,rebuildIndex} from '../../packages/core/src/db.ts';
import {dueQueue,recordReview} from '../../packages/core/src/study.ts';
import {doctor} from '../../packages/core/src/doctor.ts';
import {commands} from '../../packages/cli/src/commands.ts';
import {listItems} from '../../packages/core/src/items.ts';
import {rmSync} from 'node:fs';
import {relative} from 'node:path';
for(const missing of ['source','exercise']){
 const lib=await fresh('orphan-'+missing),{item,card}=await sourceCard(lib);
 await recordReview(lib,card.meta.id,{rating:3,confidence:2,now:at(0)});
 const sha=snap(lib);openIndex(lib).close();
 rmSync(missing==='source'?item.dir:card.path,{recursive:true});
 const d=await doctor(lib);
 if(missing==='source'){
  check(d.issues.some(i=>i.message.includes('source')&&i.message.includes('missing')),'doctor reports missing source with recovery step');
  const shown=await commands.card!.run(['show',card.meta.id],{review:true});check(!shown.exitCode,'orphan exercise remains readable for review');
  check(dueQueue(lib,at(7)).some(x=>x.id===card.meta.id),'reviewable exercise retained when only source is missing');
 }else{
  check(d.issues.some(i=>i.message.includes('not found')),'doctor reports review whose exercise file is missing');
  check(listItems(lib).some(x=>x.meta.id===item.meta.id),'source without its exercise remains readable');
  check(!dueQueue(lib,at(7)).some(x=>x.id===card.meta.id),'removed exercise leaves queue');
 }
 git(lib,'checkout',sha,'--',relative(lib.root,item.dir),relative(lib.root,card.path));
 check((await doctor(lib)).ok,'restored pair clears orphan issue');
 const index=openIndex(lib),state=index.cards();index.close();rebuildIndex(lib);const rebuilt=openIndex(lib);check(JSON.stringify(state)===JSON.stringify(rebuilt.cards()),'restored exercise state matches rebuilt index');rebuilt.close();
}
