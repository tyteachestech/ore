import {mkdirSync, readFileSync, writeFileSync, rmSync, existsSync, readdirSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {zipSync, unzipSync, strToU8, strFromU8} from '../../packages/core/node_modules/fflate/esm/index.mjs';
import {addSource} from '../../packages/core/src/ingest/index.ts';
import {initLibrary} from '../../packages/core/src/init.ts';
import {readItemDir, sourceFile, allItems} from '../../packages/core/src/items.ts';
export {zipSync, unzipSync, strToU8, strFromU8, readFileSync, writeFileSync, join, existsSync, readdirSync, allItems};
export const root = resolve(import.meta.dir);
process.env.ORE_NO_ENRICH = '1';
process.env.PATH = `${root}/bin:${process.env.PATH}`;
process.env.TMPDIR = `${root}/tmp`;
globalThis.fetch = (()=>{throw new Error('Unexpected network call in offline office probe')}) as typeof fetch;
export const fix = resolve('packages/core/test/fixtures/intake/files');
export const log = (label:string,value:unknown) => console.log(`[DEEP] ${label}: ${JSON.stringify(value)}`);
export function check(ok:unknown, message:string): asserts ok {if(!ok) throw new Error(`ASSERT: ${message}`)}
export function pack(parts:Record<string,string|Uint8Array>) {return zipSync(Object.fromEntries(Object.entries(parts).map(([k,v])=>[k, typeof v==='string'?strToU8(v):v])), {mtime:new Date('2020-01-01T00:00:00Z')})}
export function word(body:string) {
 const files=unzipSync(readFileSync(join(fix,'notes.docx')));
 files['word/document.xml']=strToU8(strFromU8(files['word/document.xml']!).replace(/<w:body>[\s\S]*?<\/w:body>/,`<w:body>${body}</w:body>`));
 return zipSync(files, {mtime:new Date('2020-01-01T00:00:00Z')});
}
export const wp=(text:string,prop='')=>`<w:p>${prop?`<w:pPr>${prop}</w:pPr>`:''}<w:r><w:t>${text}</w:t></w:r></w:p>`;
export async function imported(key:string, ext:string, bytes:string|Uint8Array) {
 const rootLib=join(root,'libs',key); rmSync(rootLib,{recursive:true,force:true});
 const lib={root:rootLib}; await initLibrary(rootLib);
 const file=join(root,'inputs',`${key}.${ext}`); writeFileSync(file,bytes);
 const item=readItemDir((await addSource(lib,file)).dir);
 const kept=sourceFile(item);
 log('saved',{title:item.meta.title,author:item.meta.author,published:item.meta.published,body:item.body,assets:existsSync(join(item.dir,'assets'))?readdirSync(join(item.dir,'assets')):[],original:kept?.split('/').pop(),originalExact:kept?Buffer.from(readFileSync(kept)).equals(Buffer.from(bytes)):false});
 return {item,lib,file};
}
export async function run(task:()=>Promise<void>) {try{await task();console.log('[DEEP] PASS')}catch(e){console.error(`[DEEP] FAIL: ${(e as Error).message}`);process.exitCode=1}}
