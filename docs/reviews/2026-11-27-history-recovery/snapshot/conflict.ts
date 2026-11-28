import {fresh,git,check,NOW} from "./harness.ts";
import {writeFileSync} from "node:fs";
import {join} from "node:path";
import {snapshot} from "../../packages/core/src/history.ts";
import {setNotes,notesPath} from "../../packages/core/src/notes.ts";
import {addSnippet} from "../../packages/core/src/ingest/index.ts";
const lib=await fresh("conflict");
const {item}=await addSnippet(lib,{text:"Study a source."});
await setNotes(lib,item.meta.id,"Base note.\n"); snapshot(lib,{force:true,now:NOW});
const main=git(lib,"branch","--show-current");
git(lib,"checkout","-q","-b","recovery");
await setNotes(lib,item.meta.id,"Recovered branch note.\n"); snapshot(lib,{force:true,now:NOW+1});
git(lib,"checkout","-q",main); await setNotes(lib,item.meta.id,"Today note.\n"); snapshot(lib,{force:true,now:NOW+2});
git(lib,"checkout","-q","recovery");
try{git(lib,"rebase",main);}catch{}
const before=git(lib,"ls-files","--unmerged"); const head=git(lib,"rev-parse","HEAD");
const result=process.env.PROBE_ADD_ONLY ? (git(lib,"add","-A"),{committed:false}) : process.env.PROBE_COMMIT_ONLY ? (()=>{try{git(lib,"commit","-qm","probe");return {committed:true};}catch{return {committed:false};}})() : snapshot(lib,{force:true,now:NOW+3});
const after=git(lib,"ls-files","--unmerged");
const rel=notesPath(item).slice(lib.root.length+1);
const stored=git(lib,"show","HEAD:"+rel);
console.log(JSON.stringify({unmergedBefore:!!before,unmergedAfter:!!after,committed:result.committed,headChanged:git(lib,"rev-parse","HEAD")!==head,stored},null,2));
if(result.committed && !after){process.env.GIT_EDITOR="true";console.log("rebaseContinue:",git(lib,"rebase","--continue")||"success");}
check(!!after && !result.committed,"snapshot leaves unresolved recovery conflicts unmerged and uncommitted");
