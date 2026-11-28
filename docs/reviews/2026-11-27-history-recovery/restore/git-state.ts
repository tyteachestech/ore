import { fresh, snap, git, check, at, source, out } from './helpers.ts';
import { snapshot } from '../../packages/core/src/history.ts';
import { setNotes, getNotes } from '../../packages/core/src/notes.ts';
import { writeFileSync, readFileSync, existsSync, utimesSync } from 'node:fs';
import { join, relative } from 'node:path';
const mode=process.argv[2]??'merge';
const lib=await fresh('git-'+mode);
const item=await source(lib),note=join(item.dir,'notes.md'),path=relative(lib.root,note);
await setNotes(lib,item.meta.id,'Original note.\n'); const base=snap(lib);
if(mode==='merge') {
 git(lib,'checkout','-b','other'); await setNotes(lib,item.meta.id,'Other branch note.\n'); snap(lib,1);
 git(lib,'checkout','-b','main-recovery',base); await setNotes(lib,item.meta.id,'Current note.\n'); snap(lib,2);
 try { git(lib,'merge','other'); } catch {}
} else if(mode==='stash') {
 await setNotes(lib,item.meta.id,'Stashed note.\n'); git(lib,'stash','push','-m','saved');
 await setNotes(lib,item.meta.id,'Current note.\n'); snap(lib,2);
 try {git(lib,'stash','pop');} catch {}
} else if(mode==='revert') {
 await setNotes(lib,item.meta.id,'Bad replacement.\n'); const bad=snap(lib,1);
 await setNotes(lib,item.meta.id,'Later important note.\n'); snap(lib,2);
 try {git(lib,'revert','--no-edit',bad);} catch {}
}
const before=git(lib,'rev-parse','HEAD');
const conflicts=git(lib,'ls-files','-u');
check(!!conflicts,'precondition: recovery has an unresolved conflict');
console.log('working note before snapshot:',JSON.stringify(readFileSync(note,'utf8')));
if(process.argv.includes('--prepare')) {
 utimesSync(join(lib.root,'.ore/last-snapshot'),new Date(0),new Date(0));
 writeFileSync(join(out,'conflict-manifest.json'),JSON.stringify({root:lib.root,item:item.meta.id,path,head:before}));
 process.exit(0);
}
const r=snapshot(lib,{force:true,now:at(3).getTime()});
console.log('snapshot',JSON.stringify(r));
console.log('after snapshot:',JSON.stringify({unmerged:git(lib,'ls-files','-u'),head:git(lib,'show',`HEAD:${path}`),mergePending:existsSync(join(lib.root,'.git/MERGE_HEAD')),revertPending:existsSync(join(lib.root,'.git/REVERT_HEAD'))}));
check(git(lib,'rev-parse','HEAD')===before && !!git(lib,'ls-files','-u'),'snapshot leaves unresolved recovery for the agent to resolve');
