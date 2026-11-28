// Explicit required-field checker transcribed from answers.ts and its referenced types.
// TypeScript 7 here has no legacy compiler API; no package downloads or compiler process used.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
type Rule=string|Record<string,unknown>|Rule[];
const annotation={id:'string',rev:'number',item:'string',ts:'string',intent:'string',exact:'string',prefix:'string',suffix:'string',start:'number',end:'number',status:'string'};
const item={id:'string',type:'string',title:'string',captured_at:'string',text_sha256:'string',status:'string',skills:['string'],topics:['string'],path:'string',dir:'string'};
const card={id:'string',kind:'string',item:'string',skills:['string'],topics:['string'],content_type:'string',state:'string',question:'string',answer:'string',rubric:['string'],path:'string',history:'object'};
const schemas:Record<string,Rule>={
 Item:item,Doc:{...item,prequestions:'array',body:'string',annotations:[annotation]},Annotation:annotation,
 Try:{...annotation,item_title:'string'},Question:{...annotation,item_title:'string',answers:'array',matches:[{item:'string',title:'string'}]},
 Notes:{text:'string',path:'string',dir:'string'},Diagram:{name:'string',path:'string',scene:'object|null'},
 CardFull:card,DueEntry:{id:'string',kind:'string',state:'string',content_type:'string',item:'string',skills:['string'],topics:['string'],priority:'string',question:'string',due:'string|null',retrievability:'number',relearn:'boolean'},
 SkillStats:{skill:'string',strength:'object',growth:'array'},
 Research:{sources:[{title:'string',url:'string',site:'string',type:'string',why:'string',minutes:'number|null'}]},
 Grade:{rating:'number',gaps:['string'],feedback:'string',ai:{vendor:'string',model:'string',prompt_version:'string'}},
};
function check(v:any,r:Rule,path='$'):string[]{
 if(typeof r==='string')return r.split('|').some(t=>t==='null'?v===null:t==='array'?Array.isArray(v):t==='object'?v!==null&&typeof v==='object'&&!Array.isArray(v):typeof v===t)?[]:[`${path}: expected ${r}, got ${JSON.stringify(v)}`];
 if(Array.isArray(r))return Array.isArray(v)?v.flatMap((x,i)=>check(x,r[0]!,`${path}[${i}]`)):[`${path}: expected array`];
 if(v===null||typeof v!=='object')return[`${path}: expected object`];
 return Object.entries(r).flatMap(([key,rule])=>key in v?check(v[key],rule as Rule,`${path}.${key}`):[`${path}.${key}: missing required property`]);
}
const rows=['matrix','more'].flatMap(file=>JSON.parse(readFileSync(join(import.meta.dir,file+'.json'),'utf8')).map((r:any)=>({...r,file})));
rows.push(...JSON.parse(readFileSync(join(import.meta.dir,'other.json'),'utf8')).map((r:any)=>({...r,args:[r.name,...r.args],exit:r.code,file:'other'})));
const results:any[]=[];
for(const r of rows){
 if(r.exit!==0||r.data==null)continue;
 const [cmd,sub]=r.args;let name:string|undefined,list=false;
 if(cmd==='ls'){name='Item';list=true;}else if(cmd==='show')name='Doc';
 else if(cmd==='card'&&['show','set'].includes(sub))name='CardFull';
 else if(cmd==='highlight'||cmd==='annotate')name='Annotation';
 else if(cmd==='tries'){name='Try';list=true;}else if(cmd==='try'||(cmd==='tried'&&!r.args.includes('--line')))name='Try';
 else if(cmd==='questions'){name='Question';list=true;}
 else if(cmd==='stats'&&r.args.includes('--skill')){name='SkillStats';list=true;}
 else if(cmd==='due'){name='DueEntry';list=true;}
 else if(cmd==='research')name='Research';else if(cmd==='notes')name='Notes';
 else if(cmd==='diagram')name=r.args.includes('--link')?'Notes':'Diagram';else if(cmd==='grade')name='Grade';
 if(!name)continue;
 const errors=list?(Array.isArray(r.data)?r.data.flatMap((v:any,i:number)=>check(v,schemas[name]!,`$[${i}]`)):['not array']):check(r.data,schemas[name]!);
 results.push({file:r.file,args:r.args,type:name,errors});
}
writeFileSync(join(import.meta.dir,'types.json'),JSON.stringify(results,null,2));
console.log(JSON.stringify({checked:results.length,failures:results.filter(r=>r.errors.length)},null,2));
assert.equal(results.filter(r=>r.errors.length).length,0,'required answer fields must match answers.ts');
