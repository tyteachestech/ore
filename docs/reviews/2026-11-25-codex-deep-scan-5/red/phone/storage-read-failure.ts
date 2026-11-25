import assert from 'node:assert/strict';
import { fs, appendReview } from './built/core-entry.js';
const events = new EventTarget();
globalThis.addEventListener = events.addEventListener.bind(events);
globalThis.dispatchEvent = events.dispatchEvent.bind(events);
const path = 'reviews/2026-11.iphone.jsonl';
process.env.ORE_DEVICE = 'iphone';
const state = {due:'2026-11-24T12:00:00Z',stability:1,difficulty:5,elapsed_days:0,scheduled_days:1,reps:1,lapses:0,state:2};
const review = (card:string) => ({ts:'2026-11-24T12:00:00Z',card,confidence:2,rating:3,state_before:state,state_after:state});
const old = JSON.stringify(review('earlier-review'))+'\n';
let disk = old;
let reads = 0;
const calls: unknown[] = [];
const mode = process.argv[2] ?? 'failed';
await fs.mountDisk('/lib', '/scratch', async (cmd, args: any) => {
  if (cmd === 'library_scan') return {files: [[path, 1, `1:${disk.length}`]], waiting: [], other: []} as any;
  if (cmd === 'library_read') { reads++; return [mode !== 'healthy' && reads === 1 ? null : disk] as any; }
  if (cmd === 'library_apply') { for (const [p, text] of args.ops) { calls.push([p,text]); if (p === path) disk = text; } return [[path, 2, `2:${disk.length}`]] as any; }
  throw new Error(cmd);
});
if (mode === 'retry') await fs.rescan();
// The real core append helper, using the phone filesystem alias.
appendReview({root:'/lib'}, review('new-review'));
await fs.flush();
console.log('[DEEP]', JSON.stringify({mode, reads, reviewsOnDisk:disk.trim().split('\n').map(line=>JSON.parse(line).card),writeCalls:calls.length}));
assert.ok(disk.includes('earlier-review'), 'A failed initial read must not let the next review erase the earlier phone review log');
