import assert from 'node:assert/strict';
import {appendFileSync,copyFileSync,readFileSync,writeFileSync,rmSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {Database} from 'bun:sqlite';
import {core,seed,snap,diff,artifact} from './common.ts';
import {commands} from '../../packages/cli/src/commands.ts';
const cases=['truncated-review','bad-card-frontmatter','orphan-highlight','missing-doc','unknown-skill','duplicate-card','truncated-chat','dangling-inbox','missing-variant-card','missing-image','bad-job','old-index'];
const selected=process.argv[2];
const results=[];
for(const name of selected?[selected]:cases){
 const {lib,item,ann,card}=await seed('doctor-'+name);
 let target='';
 switch(name){
 case 'truncated-review': await core.recordReview(lib,card.meta.id,{rating:3,confidence:2});target=core.reviewLogFiles(lib)[0]!;appendFileSync(target,'{"ts":"');break;
 case 'bad-card-frontmatter': target=card.path;writeFileSync(target,'---\nid: [\n---\nQuestion\n---\nAnswer\n');break;
 case 'orphan-highlight': target=item.docPath;writeFileSync(target,readFileSync(target,'utf8').replace('Beta spacing helps learning.','Entirely different passage now.'));break;
 case 'missing-doc': target=item.docPath;rmSync(target);break;
 case 'unknown-skill': target=item.docPath;await core.updateItemMeta(lib,item.meta.id,m=>({...m,skills:['missing']}));break;
 case 'duplicate-card': target=join(lib.root,'cards',card.meta.id+' copy.md');copyFileSync(card.path,target);break;
 case 'truncated-chat': await core.saveChat(lib,JSON.stringify({id:'chat-one',title:'My lesson',turns:[{id:'turn-one',message:'My valuable learning notes'}]}));target=core.paths.chat(lib,'chat-one');writeFileSync(target,readFileSync(target,'utf8').slice(0,-8));break;
 case 'dangling-inbox': {const q=core.queueFile(lib,item.docPath,[],'lesson.md');target=join(lib.root,'inbox',q.id+'.file.json');rmSync(join(lib.root,'inbox',q.file!));break;}
 case 'missing-variant-card': target=core.paths.variants(lib,'MISSING');writeFileSync(target,JSON.stringify({id:'v1',rev:1,card:'MISSING',type:'new-case',setting:'garden',question:'Why space?',answer:'Recall',rubric:['Recall'],maps:[0],status:'ready',created:new Date().toISOString(),ai:{vendor:'claude',model:'stub',prompt_version:'variant@1'}})+'\n');break;
 case 'missing-image': target=item.docPath;await core.addText; {const text=item.body+'\n![Critical learning diagram](assets/missing.png)\n'; writeFileSync(target,core.stringifyFrontmatter({...item.meta,text_sha256:core.sha256(text)},text));}break;
 case 'bad-job': target=core.paths.skills(lib);appendFileSync(target,'\njobs: { grade: { ai: gemini } }\n');break;
 case 'old-index': target=core.paths.index(lib);{const db=new Database(target);db.run("update meta set value='1' where key='schema'");db.close();}break;
 default:throw Error(name);
 }
 const before=snap(lib.root);
 const report=await commands.doctor!.run([],{});
 const access:any={};
 for(const c of ['ls','due','search','chat','inbox']){
 try{const r=await commands[c]!.run(c==='search'?['spacing']:[],{});access[c]={exit:r.exitCode??0,data:r.data};}catch(e){access[c]={error:String(e)};}
 }
 const fix=await commands.doctor!.run([],{fix:true});
 const after=await commands.doctor!.run([],{});
 const deltas=diff(before,snap(lib.root));
 const r={name,target:target.slice(lib.root.length+1),doctor:report.data,fix:fix.data,after:after.data,access,deltas};results.push(r);
 console.log('[DEEP]',JSON.stringify({name,doctor:r.doctor,fix:r.fix,changed:deltas.map(d=>d.path),counts:Object.fromEntries(Object.entries(access).map(([k,v]:any)=>[k,v.error??(Array.isArray(v.data)?v.data.length:'ok')]))}));
}
artifact(selected?'doctor-'+selected+'.json':'doctor-matrix.json',results);
if(selected && selected!=='old-index')assert.ok((results[0]!.doctor as any).issues.length>0,`Doctor must name ${selected}, not declare zero issues`);
