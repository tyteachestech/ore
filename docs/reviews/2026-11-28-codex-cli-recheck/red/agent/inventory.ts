import {commands} from '../../packages/cli/src/commands.ts';
import {readFileSync,writeFileSync} from 'node:fs';
const spec=readFileSync('docs/SPEC.md','utf8').split('## 4. CLI')[1]!.split('## 5.')[0]!;
const entries=Object.entries(commands).map(([name,c])=>{
 const lines=spec.split('\n').filter(l=>l.startsWith('ore '+name+' ')||l.trim()==='ore '+name).join('\n');
 return {name,usage:c.usage,options:Object.keys(c.options??{}),specMissing:!lines,specMissingOptions:Object.keys(c.options??{}).filter(o=>!lines.includes('--'+o))};
});
writeFileSync('codex-out/agent/inventory.json',JSON.stringify(entries,null,2));
console.log(entries.filter(e=>e.specMissing||e.specMissingOptions.length).map(({name,specMissing,specMissingOptions})=>({name,specMissing,specMissingOptions})));
