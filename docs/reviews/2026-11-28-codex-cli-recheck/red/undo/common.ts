import {mkdirSync, rmSync, readFileSync, readdirSync, lstatSync, readlinkSync, writeFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import * as core from '../../packages/core/src/index.ts';
import {initLibrary} from '../../packages/core/src/init.ts';
export {core};
export const OUT=resolve(import.meta.dir);
process.env.ORE_NO_ENRICH='1';
process.env.ORE_DEVICE='undo-scout';
process.env.PATH=join(OUT,'bin')+':'+process.env.PATH;
const RealDate=Date;
let millis=Date.parse('2026-11-27T18:00:00.000Z');
export const tick=(n=1000)=>{millis+=n;};
globalThis.Date=class extends RealDate {
 constructor(...args:any[]){super(...(args.length?args:[millis]) as [any]);}
 static now(){return millis;}
} as DateConstructor;
export async function fresh(name:string){
 if(!/^[a-z0-9-]+$/.test(name))throw Error('unsafe scratch name');
 const root=join(OUT,'libs',name);rmSync(root,{recursive:true,force:true});
 await initLibrary(root);process.env.ORE_LIBRARY=root;
 return {root};
}
export function snap(root:string){
 const out:Record<string,string>={};
 function walk(p:string,rel=''){
 for(const n of readdirSync(p).sort()){
 if(!rel && n==='.index')continue;
 const r=rel?rel+'/'+n:n, f=join(p,n),st=lstatSync(f);
 if(st.isSymbolicLink())out[r]='symlink:'+readlinkSync(f);
 else if(st.isDirectory())walk(f,r);
 else out[r]=readFileSync(f).toString('base64');
 }}walk(root);return out;
}
export function diff(a:Record<string,string>,b:Record<string,string>){return [...new Set([...Object.keys(a),...Object.keys(b)])].sort().filter(k=>a[k]!==b[k]).map(path=>({path,before:a[path]??null,after:b[path]??null}));}
export function artifact(name:string,data:any){writeFileSync(join(OUT,name),JSON.stringify(data,null,2)+'\n');}
export async function seed(name:string){
 const lib=await fresh(name);
 const item=await core.addText(lib,'# Recall\n\nAlpha practice strengthens recall.\n\nBeta spacing helps learning.\n\nGamma sleep consolidates memory.\n',{skills:['learning']});
 const ann=core.addHighlight(item,{exact:'Beta spacing helps learning.',intent:'apply',note:'Try spacing',when:'After coffee'});
 const card=core.writeNewCard(lib,{kind:'card',item:item.meta.id,skills:['learning'],topics:[],content_type:'concept',question:'What helps learning?',answer:'Spacing.',rubric:[]});
 core.rebuildIndex(lib);
 return {lib,item,ann,card};
}
