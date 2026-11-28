import { fresh, sourceCard, snap, git, at, check } from './helpers.ts';
import { openIndex, rebuildIndex } from '../../packages/core/src/db.ts';
import { recordReview, dueQueue, libraryStats, cardHistory } from '../../packages/core/src/study.ts';
import { readReviews } from '../../packages/core/src/reviews.ts';
import { startSession, endSession, readSessions, openSessionId } from '../../packages/core/src/sessions.ts';
import { today, skillStrength } from '../../packages/core/src/today.ts';
import { doctor } from '../../packages/core/src/doctor.ts';
const mode = process.argv[2] ?? 'reset';
const lib = await fresh('day-'+mode);
const {card} = await sourceCard(lib);
const first = await startSession(lib,at(0));
await recordReview(lib,card.meta.id,{rating:3,confidence:2,elapsed_ms:60000,now:at(0,1)});
await endSession(lib,at(0,2));
function view() {
 const idx = openIndex(lib); const cards = idx.cards(); idx.close();
 return { cards, reviews:readReviews(lib), queue:dueQueue(lib,at(5)), stats:libraryStats(lib), strength:skillStrength(lib,'learning',at(5)), today:today(lib,at(5)), sessions:readSessions(lib), history:cardHistory(lib,card.meta.id,at(5)) };
}
const before=view(); const sha=snap(lib);
const second=await startSession(lib,at(2));
await recordReview(lib,card.meta.id,{rating:1,confidence:1,elapsed_ms:120000,now:at(2,1)});
view(); snap(lib,2);
if(mode==='checkout') git(lib,'checkout',sha,'--','.'); else git(lib,'reset','--hard',sha);
const restored=view();
for(const k of Object.keys(before) as (keyof typeof before)[]) check(JSON.stringify(restored[k])===JSON.stringify(before[k]),`restored ${k}`);
check(openSessionId(lib)===null,'restored session marker must not point to a nonexistent session',{open:openSessionId(lib),known:readSessions(lib).map(x=>x.id)});
try { await endSession(lib,at(5)); console.log('endSession succeeded'); } catch(e) { console.log('endSession error:',String(e)); }
const next=await recordReview(lib,card.meta.id,{rating:3,confidence:2,now:at(5)});
check(next.session===null,'new review does not attach to rolled-back session',next.session);
const d=await doctor(lib); console.log('doctor issues',JSON.stringify(d.issues));
rebuildIndex(lib); const idx=openIndex(lib); check(idx.cards()[0]?.fsrs?.reps===2,'rebuild matches current two reviews'); idx.close();
