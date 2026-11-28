import assert from 'node:assert/strict';
import {writeFileSync,readFileSync,rmSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {core,fresh,snap,diff,artifact} from './common.ts';
import {VariantSchema} from '../../packages/core/src/remix.ts';
import {commands} from '../../packages/cli/src/commands.ts';
const mode=process.argv[2]??'chat';
const lib=await fresh('blindspot-'+mode);
let path='',reader:any;
if(mode==='chat'){
 await core.saveChat(lib,JSON.stringify({id:'chat-one',title:'Lesson',turns:[{id:'one',message:'My saved learning notes'}]}));
 path=core.paths.chat(lib,'chat-one');writeFileSync(path,readFileSync(path,'utf8').slice(0,-8));
 try{core.readChat(lib,'chat-one');}catch(e){reader={error:String(e),listed:core.listChats(lib)};}
}else if(mode==='inbox'){
 const q=core.queueFile(lib,core.paths.skills(lib),[],'learning-notes.md');
 path=join(lib.root,'inbox',q.id+'.file.json');rmSync(join(lib.root,'inbox',q.file!));
 reader={descriptorStillExists:existsSync(path),attachmentExists:existsSync(join(lib.root,'inbox',q.file!)),listed:core.queuedLinks(lib)};
}else if(mode==='variant'){
 path=core.paths.variants(lib,'MISSING');
 const v={id:'V1',rev:1,card:'MISSING',type:'new-case',setting:'garden',question:'Why space?',answer:'Recall.',rubric:['Recall'],maps:[0],status:'ready',created:new Date().toISOString(),ai:{vendor:'claude',model:'stub',prompt_version:'variant@1'}};
 writeFileSync(path,JSON.stringify(v)+'\n');reader={schemaValid:VariantSchema.safeParse(v).success,cardExists:existsSync(core.paths.card(lib,'MISSING')),readVariants:core.readVariants(lib,'MISSING').length};
}else if(mode==='image'){
 const i=await core.addText(lib,'# Lesson\n\nThe diagram explains the learning loop.');
 path=i.docPath;const body=i.body+'\n![Learning loop](assets/missing.png)\n';
 writeFileSync(path,core.stringifyFrontmatter({...i.meta,text_sha256:core.sha256(body)},body));
 reader={docRead:core.findItem(lib,i.meta.id).body,linkTargetExists:existsSync(join(i.dir,'assets','missing.png'))};
}else throw Error(mode);
const before=snap(lib.root);
const first=(await commands.doctor!.run([],{})).data;
const fix=(await commands.doctor!.run([],{fix:true})).data;
core.rebuildIndex(lib);
const rebuilt=(await commands.doctor!.run([],{})).data;
const changes=diff(before,snap(lib.root));
const result={mode,path:path.slice(lib.root.length+1),reader,doctor:first,fix,afterReindex:rebuilt,canonicalChanges:changes.map(c=>c.path)};
console.log('[DEEP]',JSON.stringify(result));artifact('blindspot-'+mode+'.json',result);
assert.ok((first as any).issues.some((i:any)=>i.path===result.path||mode==='image'&&i.message.includes('missing.png')),`Doctor must identify the broken ${mode} file and a next step`);
