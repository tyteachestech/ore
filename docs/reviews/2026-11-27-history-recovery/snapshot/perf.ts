import {fresh,git,NOW} from "./harness.ts";
import {snapshot} from "../../packages/core/src/history.ts";
import {createItem} from "../../packages/core/src/items.ts";
import {setNotes} from "../../packages/core/src/notes.ts";
import {addHighlight} from "../../packages/core/src/annotations.ts";
import {writeNewCard} from "../../packages/core/src/cards.ts";
import {writeFileSync,existsSync,readdirSync,statSync} from "node:fs";
import {join} from "node:path";
function measure(lib:{root:string},label:string,beforeSecond?:()=>void){
 const own=Bun.spawnSync; const rows:any[]=[]; let adds=0;
 Bun.spawnSync=((args:any,opts:any)=>{
  if(args[0]!=="git")return own(args,opts);
  if(args.includes("add")&&++adds===2)beforeSecond?.();
  const locked=existsSync(join(lib.root,".ore/lock")), t=performance.now(); const r=own(args,opts);
  rows.push({git:args.slice(5).join(" "),locked,ms:+(performance.now()-t).toFixed(2)});return r;
 }) as typeof Bun.spawnSync;
 const t=performance.now();let result;try{result=snapshot(lib,{force:true,now:NOW});}finally{Bun.spawnSync=own;}
 const out={label,...result,totalMs:+(performance.now()-t).toFixed(2),commands:rows};console.log(JSON.stringify(out));return out;
}
for(const n of [25,100]){
 const lib=await fresh("perf-"+n);git(lib,"config","gc.auto","0");const items=[];
 for(let i=0;i<n;i++){
  const item=await createItem(lib,{type:"markdown",title:"Study source "+i,body:("Source "+i+": retrieval and practice.\n\n").repeat(100),skills:["learning"]});items.push(item);
  addHighlight(item,{exact:"retrieval and practice.",intent:"keep"});await setNotes(lib,item.meta.id,"My note on source "+i);
  for(let k=0;k<2;k++)writeNewCard(lib,{kind:"card",item:item.meta.id,skills:["learning"],topics:[],content_type:"fact",question:"Question "+k+"?",answer:"An answer.",rubric:[]});
 }
 measure(lib,n+" sources first");measure(lib,n+" sources clean");await setNotes(lib,items[0]!.meta.id,"One edited note.");measure(lib,n+" sources one-note");
 console.log(JSON.stringify({n,trackedFiles:git(lib,"ls-files").split("\n").length}));
 if(n===100){
  let seed=42;function bytes(size:number){const b=Buffer.allocUnsafe(size);for(let i=0;i<b.length;i++){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;b[i]=seed&255;}return b;}
  const dir=items[0]!.dir;
  for(const ext of ["mp3","pdf","mp4"])writeFileSync(join(dir,"source."+ext),bytes(1024*1024));
  measure(lib,"three 1 MiB incompressible media-shaped files (not decoded)");
  const old=git(lib,"ls-tree","-r","HEAD").split("\n").filter(l=>/source\.(mp3|pdf|mp4)$/.test(l));
  writeFileSync(join(dir,"source.mp4"),bytes(1024*1024));measure(lib,"replace 1 MiB video-shaped file");
  console.log(JSON.stringify({oldBlobsStillReadable:old.every(l=>{git(lib,"cat-file","-s",l.split(/\s+/)[2]!);return true;}),objects:git(lib,"count-objects","-v")}));
  // Worst placement: another process finishes a large file between the first and second add.
  const changed=bytes(8*1024*1024);
  measure(lib,"8 MiB arrives between adds",()=>writeFileSync(join(dir,"source.mp4"),changed));
 }
}
