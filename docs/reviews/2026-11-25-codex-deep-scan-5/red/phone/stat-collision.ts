import assert from 'node:assert/strict';
import { fs, ready, syncIndex } from './built/core-entry.js';
let clock = 1795521600000;
const mode=process.argv[2]??'same';
if(!mode.startsWith('natural')) Date.now=()=>clock;
const config='skills:\n  - id: learning\n    name: Learning\n    priority: P2\n';
fs.writeFileSync('/lib/skills.yaml',config);
fs.writeFileSync('/lib/skills/learning/notes.md','alpha');
await ready(Bun.resolveSync('sql.js/dist/sql-wasm.wasm',import.meta.dir+'/../../apps/desktop'));
let first=syncIndex({root:'/lib'});
assert.equal(first.index.search('alpha').length,1);
first.index.close();
if(mode==='natural-burst') {
  let missed=0;
  for(let i=0;i<80;i++) {
    const word=i%2?'alpha':'bravo';
    fs.writeFileSync('/lib/skills/learning/notes.md',word);
    const result=syncIndex({root:'/lib'});
    if(result.index.search(word).length!==1) missed++;
    result.index.close();
  }
  console.log('[DEEP]',JSON.stringify({mode,writes:80,missed}));
  process.exit(missed?1:0);
}
if(mode==='later') clock++;
fs.writeFileSync('/lib/skills/learning/notes.md',mode==='longer'?'bravo!':'bravo');
const second=syncIndex({root:'/lib'});
const got=second.index.search('bravo');
console.log('[DEEP]',JSON.stringify({mode,mtime:fs.statSync('/lib/skills/learning/notes.md').mtimeMs,report:second.report,canonical:fs.readFileSync('/lib/skills/learning/notes.md'),oldHits:second.index.search('alpha').length,newHits:got.length}));
second.index.close();
assert.equal(got.length,1,'A changed phone note should be reindexed even when both writes share one millisecond');
