import {fresh,snap,git,at,check,sourceCard} from './helpers.ts';
import {startSession,openSessionId,endSession,readSessions} from '../../packages/core/src/sessions.ts';
import {recordReview} from '../../packages/core/src/study.ts';
import {rebuildIndex} from '../../packages/core/src/db.ts';
import {doctor} from '../../packages/core/src/doctor.ts';
import {paths} from '../../packages/core/src/library.ts';
import {unlinkSync} from 'node:fs';
const lib=await fresh('session-minimal');
const card=process.argv.includes('--probe')?(await sourceCard(lib)).card:null;
const sha=snap(lib);
await startSession(lib,at(1));
snap(lib,1);
git(lib,'reset','--hard',sha);
console.log('canonical session receipts:',readSessions(lib).length);
check(openSessionId(lib)===null,'restored library has no open nonexistent session');
if(process.argv.includes('--probe')) {
 rebuildIndex(lib);
 console.log('after rebuilding index: stale marker remains',openSessionId(lib)!==null);
 console.log('doctor:',JSON.stringify(await doctor(lib)));
 const review=await recordReview(lib,card!.meta.id,{rating:3,confidence:2,now:at(2)});
 console.log('new review attached to missing session:',!!review.session&&!readSessions(lib).some(s=>s.id===review.session));
 try {await endSession(lib,at(2,1));}catch(e){console.log('end error:',String(e).replace(/[0-9A-HJKMNP-TV-Z]{26}/g,'<id>'));}
 unlinkSync(paths.openSession(lib));
 const clean=await recordReview(lib,card!.meta.id,{rating:3,confidence:2,now:at(3)});
 console.log('after removing only the marker: review session',clean.session);
}
