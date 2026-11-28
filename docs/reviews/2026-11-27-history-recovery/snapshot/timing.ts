import {fresh,git,check,NOW,age} from "./harness.ts";
import {snapshot} from "../../packages/core/src/history.ts";
import {addText} from "../../packages/core/src/ingest/index.ts";
import {setNotes,notesPath} from "../../packages/core/src/notes.ts";
const lib=await fresh("timing");const item=await addText(lib,"Source.");
await setNotes(lib,item.meta.id,"at zero"); snapshot(lib,{force:true,now:NOW});age(lib);
await setNotes(lib,item.meta.id,"at five minutes");
const five=snapshot(lib,{now:NOW+5*60000});
const saved=git(lib,"show","HEAD:"+notesPath(item).slice(lib.root.length+1));
check(!five.committed&&saved==="at zero","five-minute note edit has not entered git yet (designed interval)");
check(snapshot(lib,{now:NOW+10*60000}).committed,"exactly ten minutes is eligible");age(lib,NOW+10*60000);
check(!snapshot(lib,{now:NOW+20*60000}).committed,"clean eligible check creates no commit");
// snapshot's marker uses filesystem time. Pin its mtime to match this simulated command.
age(lib,NOW+20*60000);
await setNotes(lib,item.meta.id,"at twenty-one minutes");
check(!snapshot(lib,{now:NOW+21*60000}).committed,"clean check postpones a later edit until ten minutes after that CHECK");
check(snapshot(lib,{force:true,now:NOW+21*60000}).committed,"forced session-end-style snapshot bypasses interval");
