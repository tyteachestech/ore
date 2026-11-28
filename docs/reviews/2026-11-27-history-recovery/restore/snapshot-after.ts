import {fresh,snap,git,at,check} from './helpers.ts';
import {snapshot} from '../../packages/core/src/history.ts';
import {setNotes} from '../../packages/core/src/notes.ts';
import {sourceCard} from './helpers.ts';
import {writeFileSync,readFileSync,existsSync,unlinkSync,utimesSync} from 'node:fs';
import {join,relative} from 'node:path';
for(const mode of ['checkout','restore','revert','stash','detached','lock']) {
 const lib=await fresh('snapshot-after-'+mode),{item}=await sourceCard(lib);
 await setNotes(lib,item.meta.id,'Before\n');const base=snap(lib);
 await setNotes(lib,item.meta.id,'After\n');const head=snap(lib,1);
 const file=relative(lib.root,join(item.dir,'notes.md'));
 if(mode==='checkout')git(lib,'checkout',base,'--',file);
 if(mode==='restore')git(lib,'restore','--source',base,'--',file);
 if(mode==='revert')git(lib,'revert','--no-edit',head);
 if(mode==='stash'){await setNotes(lib,item.meta.id,'Scratch\n');git(lib,'stash','push','-m','temporary');git(lib,'stash','pop');}
 if(mode==='detached'){git(lib,'checkout','--detach',base);await setNotes(lib,item.meta.id,'Detached restored note\n');}
 if(mode==='lock'){await setNotes(lib,item.meta.id,'After lock\n');writeFileSync(join(lib.root,'.git/index.lock'),'');}
 const result=snapshot(lib,{force:true,now:at(2).getTime()});
 if(mode==='lock') {
   check(!result.committed && git(lib,'rev-parse','HEAD')===head,'index.lock prevents a commit without throwing');
   unlinkSync(join(lib.root,'.git/index.lock'));
   check(snapshot(lib,{force:true,now:at(2).getTime()}).committed,'snapshot succeeds once index.lock is removed');
 }else if(mode==='revert')check(!result.committed && git(lib,'status','--porcelain')==='','clean revert needs no extra snapshot');
 else check(result.committed && git(lib,'status','--porcelain')==='',`${mode}: post-recovery snapshot commits cleanly`);
 check(git(lib,'show',`HEAD:${file}`)===readFileSync(join(lib.root,file),'utf8').trim(),`${mode}: snapshot holds current note bytes`);
 if(mode==='detached') console.log('OBSERVED detached HEAD remains detached:',git(lib,'rev-parse','--abbrev-ref','HEAD'));
}
