import {fresh,source,snap,git,check} from './helpers.ts';
import {findItem} from '../../packages/core/src/items.ts';
import {cutText,restoreCut} from '../../packages/core/src/cut.ts';
import {readFileSync} from 'node:fs';
import {relative,join} from 'node:path';
for(const extra of [false,true]) {
 const lib=await fresh('cut-probe-'+extra),item=await source(lib),sha=snap(lib);
 if(extra) await cutText(lib,item.meta.id,item.body.indexOf('Alpha'),item.body.indexOf('Alpha')+1);
 const mid=findItem(lib,item.meta.id);
 const c=await cutText(lib,item.meta.id,mid.body.indexOf('Beta'),mid.body.indexOf('Beta')+1);
 git(lib,'checkout',sha,'--',relative(lib.root,item.docPath));
 check(readFileSync(item.docPath,'utf8').trim()===git(lib,'show',`${sha}:${relative(lib.root,item.docPath)}`),'checkout restored exact saved bytes');
 const body=findItem(lib,item.meta.id).body;
 const record=JSON.parse(readFileSync(join(lib.root,'.ore','cuts',item.meta.id,c.id+'.json'),'utf8'));
 console.log(JSON.stringify({twoCuts:extra,fullContextPresent:body.includes(record.before+record.text+record.after),textAndAfterPresent:body.includes(record.text+record.after),before:record.before,after:record.after,indexEverOpened:false}));
 let refused=false;try{await restoreCut(lib,item.meta.id,c.id);}catch{refused=true;}
 console.log('probe result',JSON.stringify({twoCuts:extra,refused,betaCopies:findItem(lib,item.meta.id).body.split('Beta paragraph.').length-1}));
}
