import {fresh,git,check,NOW} from "./harness.ts";
import {writeFileSync,existsSync} from "node:fs";
import {join} from "node:path";
import {snapshot} from "../../packages/core/src/history.ts";
import {tryWithLock} from "../../packages/core/src/lock.ts";
import {paths} from "../../packages/core/src/library.ts";
const lib=await fresh("interleave");
const a=join(lib.root,"a.txt"), b=join(lib.root,"b.txt");
writeFileSync(a,"old"); writeFileSync(b,"old"); snapshot(lib,{force:true,now:NOW});
writeFileSync(a,"complete"); writeFileSync(b,"complete");
const spawn=Bun.spawnSync; let injected=false; let nested:any; let stageAfterRejected:any;
// One Bun process: pause snapshot A at its real git-diff boundary and run B's real snapshot
// while a third logical writer owns the library lock. No git results are mocked.
Bun.spawnSync=((argv:any,opts:any)=>{
 if(!injected && Array.isArray(argv) && argv.includes("diff")){
  injected=true;
  tryWithLock(paths.lock(lib),()=>{
   writeFileSync(a,"next");
   nested=process.env.PROBE_NO_NESTED ? {skipped:true} : snapshot(lib,{force:true,now:NOW+2});
   stageAfterRejected={a:git(lib,"show",":a.txt"),b:git(lib,"show",":b.txt"),lockHeld:existsSync(paths.lock(lib))};
   // Writer then finishes. B's rejected snapshot has already staged only its first half.
   writeFileSync(b,"next");
  });
 }
 return spawn(argv,opts);
}) as typeof Bun.spawnSync;
let outer:any; try{outer=snapshot(lib,{force:true,now:NOW+1});}finally{Bun.spawnSync=spawn;}
const savedA=git(lib,"show","HEAD:a.txt"),savedB=git(lib,"show","HEAD:b.txt");
console.log(JSON.stringify({nested,stageAfterRejected,outer,savedA,savedB},null,2));
check(savedA===savedB,"snapshot contains one complete write, never half of the next write (F643)");
