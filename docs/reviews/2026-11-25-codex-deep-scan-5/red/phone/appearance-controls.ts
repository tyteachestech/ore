import assert from 'node:assert/strict';
const values=new Map<string,string>(process.argv[2]==='seeded' ? [
 ['ore.width','wide'],['ore.size','24'],['ore.page','light'],['ore.font','geist'],['ore.spacing','loose']
]:[]);
const painted=new Map<string,string>();
globalThis.localStorage={getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>values.set(k,v)} as any;
globalThis.document={documentElement:{dataset:{},style:{setProperty:(k:string,v:string)=>painted.set(k,v)}}} as any;
process.env.VITE_PHONE='1';
const reading=await import('../../apps/desktop/src/reading');
const before=reading.readingNow();
if(process.argv[2]==='seeded') assert.deepEqual(before,{width:'wide',size:24,page:'light',font:'geist',spacing:'loose'});
else assert.equal(before.size,20);
reading.setWidth('narrow');reading.setSize(22);reading.setPage('auto');reading.setFont('charter');reading.setSpacing('tight');
reading.setSystemDark(false);
assert.equal(reading.pageShown(),'light');assert.equal(values.get('ore.page'),'auto');
reading.setSystemDark(true);assert.equal(reading.pageShown(),'dark');
for(const [key,value] of [['width','narrow'],['size','22'],['page','auto'],['font','charter'],['spacing','tight']]) assert.equal(values.get('ore.'+key),value);
console.log('[DEEP]',JSON.stringify({before,after:reading.readingNow(),persisted:Object.fromEntries(values),painted:Object.fromEntries(painted)}));
