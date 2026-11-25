import {writeFileSync,appendFileSync} from 'node:fs';
import {join} from 'node:path';
import {allItems} from '../../packages/core/src/items.ts';
import {listCards} from '../../packages/core/src/cards.ts';
const root=import.meta.dir, rows:any[]=[];
const file=join(root,'matrix.jsonl');writeFileSync(file,'');
for (const size of ['large','twice-large']) {
 const lib={root:join(root,'libs',size)},items=allItems(lib),cards=listCards(lib);
 const card=cards.find(c=>c.meta.state==='live')??cards[0]!;const id=card.meta.item;
 const commands=[['skills'],['ls'],['ls','--archived'],['today'],['stats'],['stats','--skill','ai'],['due'],['due','--all','--skill','ai'],['show',id,'--annotations'],['cards','--item',id],['card','show',card.meta.id,'--review'],['notes',id],['backlinks',id],['questions','--skill','ai'],['tries','--skill','ai'],['tries','--now'],['dig','ai'],['dig','--ready'],['search','learning','--sources'],['settings'],['goal'],['inbox'],['chat'],['feed']];
 for(let run=0;run<2;run++)for(const args of commands){
  const env={...process.env,ORE_LIBRARY:lib.root,ORE_NO_ENRICH:'1'};
  const t=performance.now();const p=Bun.spawn(['bun',join(root,'probe.ts'),...args],{env,stdout:'pipe',stderr:'pipe'});const output=await new Response(p.stdout).text();const err=await new Response(p.stderr).text();const code=await p.exited;
  let row:any;try{row=JSON.parse(output);}catch{row={error:err,command:args};}row={size,n:items.length,run,wallMs:performance.now()-t,code,...row};rows.push(row);appendFileSync(file,JSON.stringify(row)+'\n');
  console.log('[DEEP]',size,run,args.join(' '),Math.round(row.ms??row.wallMs)+'ms','docs='+row.reads?.['doc.md'],'cardReads='+row.reads?.cards,'stats='+row.byOp?.statSync,code?'ERROR '+err:'');
 }
}
