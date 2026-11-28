import assert from 'node:assert/strict';
import { setup, call, hashes, diff, updateItemMeta, addHighlight, findItem } from './common.ts';
const rows: any[]=[];
for (const mode of ['course','edit','annotate','settings']) {
  const {lib,item}=await setup(`probe-${mode}`);
  let name:string, args:string[], good:Record<string,unknown>, bad:Record<string,unknown>;
  if(mode==='course') {
    await updateItemMeta(lib,item.meta.id,m=>({...m,course:{id:'course-scout',title:'Original',part:1}}));
    name='course';args=['set','course-scout'];good={title:'Changed'};bad={skills:'missing'};
  } else if(mode==='edit') {name='edit';args=[item.meta.id];good={title:'Changed'};bad={skills:'learning',cards:'{'};}
  else if(mode==='annotate') {
    const a=addHighlight(findItem(lib,item.meta.id),{exact:'Recall improves memory.',intent:'card'});
    name='annotate';args=[a.id];good={exact:'Spacing practice helps retention.'};bad={status:'invalid'};
  } else {name='settings';args=[];good={ai:'codex'};bad={model:'bad model name'};}
  let before=hashes(lib.root);const rejected=await call(name,args,bad);const badChanges=diff(before,hashes(lib.root));
  assert.equal(rejected.code,1);assert.deepEqual(badChanges,[]);
  before=hashes(lib.root);const valid=await call(name,args,good);const goodChanges=diff(before,hashes(lib.root));
  assert.equal(valid.code,0);assert.ok(goodChanges.length);
  const row={mode,invalidAlone:rejected,invalidChanges:badChanges,validCode:valid.code,validChanges:goodChanges};rows.push(row);
  console.log('[DEEP]',JSON.stringify(row));
}
