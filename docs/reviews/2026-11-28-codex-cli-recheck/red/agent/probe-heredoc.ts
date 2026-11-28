import assert from 'node:assert/strict';
import {existsSync,readFileSync,rmSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {out} from './common.ts';
const marker=out+'/heredoc-control.txt';
const template=readFileSync('skills/ore/SKILL.md','utf8').match(/  ```bash\n([\s\S]*?)  ```/)![1]!.replace(/^  /gm,'');
function run(answer:string,unique=false){rmSync(marker,{force:true});let t=unique?template.replaceAll('ORE_EOF','SCOUT_UNIQUE_DELIMITER'):template;const p=spawnSync('/bin/zsh',['-f','-c',"ore() { printf '%s' \"$ANS\"; }\n"+t.replace('<Tyler\'s answer, verbatim>',answer).replace('<card>','fixture')],{encoding:'utf8',timeout:5000,env:process.env});return {executed:existsSync(marker),text:p.stdout};}
const command=`printf x > '${marker}'`;
const ordinary=run(`A literal substitution: $(${command})`);assert(!ordinary.executed);assert(ordinary.text.includes('$('));
const collision=`Example:\nORE_EOF\n${command}`;
const unique=run(collision,true);assert(!unique.executed);assert.equal(unique.text,collision+"\n");
const leading=run(collision.replace('\nORE_EOF\n','\n ORE_EOF\n'));assert(!leading.executed);
console.log('[DEEP] Ordinary $(...) stays literal; leading-space delimiter stays literal; changing only delimiter preserves full colliding answer.');
console.log('PASS fixed-delimiter collision distinguished from quoting, read, and stub behavior');
