import {fresh,git,check,NOW} from "./harness.ts";
import {mkdirSync,writeFileSync,readFileSync} from "node:fs";
import {join,dirname,relative} from "node:path";
import {snapshot} from "../../packages/core/src/history.ts";
import {addText} from "../../packages/core/src/ingest/index.ts";
import {setNotes} from "../../packages/core/src/notes.ts";
import {cutText} from "../../packages/core/src/cut.ts";
import {queueLink,queueFile,removeQueuedLink} from "../../packages/core/src/inbox.ts";
import {startSession} from "../../packages/core/src/sessions.ts";
const lib=await fresh("inventory");
const item=await addText(lib,"# Title\n\nFirst paragraph.\n\nRemoved paragraph.\n\nLast paragraph.\n");
await setNotes(lib,item.meta.id,"My own note.");
const cut=await cutText(lib,item.meta.id,item.body.indexOf("Removed"),item.body.indexOf("Removed")+5);
queueLink(lib,"https://example.com/queued"); const f=queueFile(lib,join(item.dir,"source.md"),[],"shared.md");removeQueuedLink(lib,f.id,true);
await startSession(lib,new Date(NOW));
// Shape-only coverage for the remaining kinds; no media decoding or domain-reader claims.
const visible=["topics/test.md","cards/test.md","cards/test.variants.jsonl","reviews/2026-11.iphone.jsonl","chats/test.json","skills/learning/notes.md","skills/learning/digs.json","skills/learning/images/test.png","feeds.yaml","feeds/read.iphone.jsonl","fsrs-params.json",...['thumbnail.png','map.excalidraw','diagrams/test.excalidraw','images/test.png','assets/test.png','source.pdf','source.mp3','source.mp4','transcript.vtt','source.vtt','tables.json'].map(f=>relative(lib.root,join(item.dir,f)))];
const ignored=[".index/library.sqlite",".index/feeds.json",".ore/logs/test.log",".ore/tutor/test.json",".ore/reimport/test/doc.md",".ore/catch-up"];
for(const r of [...visible,...ignored]){const p=join(lib.root,r);mkdirSync(dirname(p),{recursive:true});writeFileSync(p,"SCOUT shape-only inventory\n");}
snapshot(lib,{force:true,now:NOW});
const tracked=git(lib,"ls-tree","-r","--name-only","HEAD").split("\n");
console.log("TRACKED\n"+tracked.map(x=>x.replaceAll(item.meta.id,"<item>").replaceAll(cut.id,"<cut>")).join("\n"));
console.log("IGNORED\n"+git(lib,"ls-files","--others","--ignored","--exclude-standard"));
check(visible.every(x=>tracked.includes(x)),"all visible layout families are committed, including original media bytes");
check(!tracked.some(x=>x.startsWith(".ore/")||x.startsWith(".index/")),".ore and .index are excluded");
check(tracked.some(x=>x.startsWith("inbox/removed/"))&&tracked.some(x=>x.endsWith("/shared.md")),"queued and removed-for-Undo inbox attachments are committed");
console.log("cut record present locally:",!!readFileSync(join(lib.root,".ore/cuts",item.meta.id,cut.id+".json"),"utf8"));
check(git(lib,"show","HEAD:"+relative(lib.root,join(item.dir,"source.md"))).includes("Removed paragraph."),"kept original retains removed text even though cut receipt is ignored");
