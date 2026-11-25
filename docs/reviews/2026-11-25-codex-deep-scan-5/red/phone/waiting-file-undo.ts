import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { queueFile, queueLink, queuedLinks, removeQueuedLink } from '../../packages/core/src/inbox';
const root = join(import.meta.dir,'libs/waiting-file-undo');
rmSync(root,{recursive:true,force:true});
mkdirSync(root,{recursive:true});
const bytes = Buffer.from('%PDF-1.7\noriginal learning source\n');
const input = join(root,'paper.pdf');
writeFileSync(input,bytes);
const mode = process.argv[2] ?? 'file';
const l = mode === 'link' ? queueLink({root},'https://example.com/article') : queueFile({root},input);
rmSync(input); // a share extension's temporary input no longer exists after the callback
const original = l.file ? join(root,'inbox',l.file) : input;
console.log('[DEEP] before', JSON.stringify({mode,originalBytesExist:existsSync(original)}));
const ore = async (...args: string[]) => {
 if(args[0]==='inbox' && args[1]==='--remove') return removeQueuedLink({root},args[2]!);
 if(args[0]==='inbox' && args[1]==='--add') return queueLink({root},args[2]!,l.skills);
 throw new Error('Unexpected '+args.join(' '));
};
// Extract the actual component callback without mounting React or creating a window.
const source = readFileSync(join(import.meta.dir,'../../apps/desktop/src/phone/PhoneApp.tsx'),'utf8');
const start = source.indexOf('  const removeWaiting = (l: Waiting) => {');
const end = source.indexOf('\n\n  return (',start);
assert.ok(start >= 0 && end > start,'PhoneApp callback extraction boundaries');
const js = new Bun.Transpiler({loader:'tsx'}).transformSync(source.slice(start,end));
let action: any;
const change = async (_notify: unknown,c: any) => { action=c; c.show(true); await c.write(true); return true; };
const removeWaiting = new Function('change','notify','ore','removing','setWaiting','refresh',js+'; return removeWaiting;')(
 change,()=>{},ore,{current:new Set()},()=>{},async()=>{});
await removeWaiting(l);
await action.write(false);
const restored = queuedLinks({root});
console.log('[DEEP]',JSON.stringify({originalFile:l.file,afterUndo:restored.map(({url,file})=>({url,file:file??null})),originalBytesExist:existsSync(original)}));
if(mode==='link') { assert.equal(restored[0]?.url,l.url); process.exit(0); }
assert.ok(restored[0]?.file && existsSync(join(root,'inbox',restored[0].file)), 'Undo of removing a waiting shared file must restore its file, not queue its filename as a website');
assert.deepEqual(readFileSync(join(root,'inbox',restored[0].file!)),bytes);
