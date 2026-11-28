import assert from 'node:assert/strict';
import {existsSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {out} from './common.ts';
const marker=out+'/heredoc-executed.txt'; rmSync(marker,{force:true});
const guide=readFileSync('skills/ore/SKILL.md','utf8');
const template=guide.match(/  ```bash\n([\s\S]*?)  ```/)![1]!.replace(/^  /gm,'');
// This is answer text to store, including a code example; its printf may never execute.
const answer=`My code example:\nORE_EOF\nprintf '%s' 'EXECUTED' > '${marker}'\n# rest of the example`;
const command="ore() { printf 'grade called safely\\n'; }\n"+template.replace('<Tyler\'s answer, verbatim>',answer).replace('<card>','fixture');
writeFileSync(out+'/heredoc-command.zsh',command);
const p=spawnSync('/bin/zsh',['-f','-c',command],{encoding:'utf8',timeout:5000,env:process.env});
console.log('[DEEP] Exact guide heredoc; shell exit:',p.status,'answer text executed:',existsSync(marker));
console.log('[DEEP] stdout:',p.stdout.trim());console.log('[DEEP] stderr:',p.stderr.trim());
assert(!existsSync(marker),'the quoted-heredoc guide must keep all learner text as data, including its fixed delimiter');
