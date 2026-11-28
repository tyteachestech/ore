import {fresh,git,check,age} from "./harness.ts";
import {snapshot} from "../../packages/core/src/history.ts";
import {addText} from "../../packages/core/src/ingest/index.ts";
import {setNotes,notesPath} from "../../packages/core/src/notes.ts";
import {statSync} from "node:fs";
import {join} from "node:path";
const lib=await fresh("clean-check"); const item=await addText(lib,"A source.");
await setNotes(lib,item.meta.id,"Old note.");
// All logical times are relative to one captured instant; no sleeps or clock races.
const t=Date.now(); snapshot(lib,{force:true,now:t-20*60000}); age(lib,t-20*60000);
const before=git(lib,"rev-parse","HEAD");
const clean=process.env.PROBE_NO_CLEAN?{skipped:true}:snapshot(lib,{now:t});
await setNotes(lib,item.meta.id,"New note.");
const result=snapshot(lib,{now:t+60000,force:!!process.env.PROBE_FORCE});
console.log(JSON.stringify({clean,result,minutesSinceLastCommit:21,dirty:!!git(lib,"status","--porcelain"),savedNote:git(lib,"show","HEAD:"+notesPath(item).slice(lib.root.length+1))},null,2));
check(result.committed,"first write after a 20-minute-old snapshot is captured even after a clean read");
