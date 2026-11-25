import {join} from 'node:path';import {writeFileSync} from 'node:fs';
import {initLibrary} from '../../packages/core/src/init.ts';import {snapshot} from '../../packages/core/src/history.ts';import {setNotes} from '../../packages/core/src/notes.ts';import {allItems} from '../../packages/core/src/items.ts';
const run=Bun.spawnSync;let active=false;const calls:any[]=[];
Bun.spawnSync=((...args:any[])=>{const t=performance.now();const r=(run as any)(...args);if(active)calls.push({argv:args[0],ms:performance.now()-t,code:r.exitCode});return r;}) as typeof Bun.spawnSync;
const out=[];for(const size of ['large','twice-large']){const lib={root:join(import.meta.dir,'libs',size)};await initLibrary(lib.root);
for(const mode of ['first','recent','one-note']){if(mode==='one-note')await setNotes(lib,allItems(lib)[0]!.meta.id,'One changed note before the scheduled snapshot.');calls.length=0;active=true;const t=performance.now();const result=snapshot(lib,{force:mode!=='recent'});const row={size,mode,ms:performance.now()-t,result,calls:[...calls]};active=false;out.push(row);console.log('[DEEP]',JSON.stringify(row));}}
writeFileSync(join(import.meta.dir,'history-cost.json'),JSON.stringify(out,null,2));
