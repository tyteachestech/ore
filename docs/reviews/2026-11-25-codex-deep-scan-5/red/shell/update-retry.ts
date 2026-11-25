// Real updater pass + copied install hook; all processes, repo state and installs are scratch fakes.
import assert from 'node:assert/strict';
import {mkdirSync, readFileSync, writeFileSync, rmSync, existsSync} from 'node:fs';
import {resolve, join} from 'node:path';
import {spawnSync as realSpawnSync} from 'node:child_process';
import {mock} from 'bun:test';
const shellSpawn = realSpawnSync;
const base=resolve('codex-out/shell/libs/update-retry');rmSync(base,{recursive:true,force:true});
const cache=join(base,'cache'), bin=join(base,'bin');mkdirSync(cache,{recursive:true});mkdirSync(bin);mkdirSync(join(base,'repo'));
const mode=process.argv[2]??'transient-failure';
writeFileSync(join(base,'installed'),'old');
if(mode==='transient-failure')writeFileSync(join(base,'fail'),'1');
if(mode==='stale-lock')mkdirSync(join(cache,'app-install.lock'));
const executable=(name:string,body:string)=>writeFileSync(join(bin,name),'#!/bin/sh\n'+body,{mode:0o755});
executable('git',`case "$*" in
 'rev-parse --abbrev-ref HEAD') echo master;;
 'diff --name-only '*|'diff-tree '*) echo packages/core/src/queue.ts;;
 'rev-parse --show-toplevel') echo "$SHELL_CASE/repo";;
 'rev-parse HEAD'|'rev-parse --short HEAD') echo new;;
 *) exit 99;;
esac\n`);
executable('bun',`if [ "$*" = 'install --frozen-lockfile' ]; then exit 0; fi
if [ "$*" != 'run app:install' ]; then exit 99; fi
echo attempt >> "$SHELL_CASE/attempts"
if [ -f "$SHELL_CASE/fail" ]; then echo 'transient build failure'; exit 1; fi
echo new > "$SHELL_CASE/installed"\n`);
executable('lsappinfo','exit 0\n'); // no running app: never quit or open anything
// Redirect cache only, and await the otherwise detached subshell. No production files changed.
let hook=readFileSync('.githooks/post-commit','utf8').replace('cache="$HOME/Library/Caches/ore"',`cache='${cache}'`).replace(/2>&1 &\s*$/, '2>&1\n');
const hookPath=join(base,'post-commit');writeFileSync(hookPath,hook);
let head='old', pulls=0;
const ok=(out='')=>({status:0,stdout:out,stderr:''});
mock.module('node:child_process',()=>({spawnSync:(cmd:string,args:string[],opts:any)=>{
 if(cmd==='ps')return ok('');if(cmd==='memory_pressure')return ok('System-wide memory free percentage: 80%');
 if(cmd==='git'){
   const a=args.slice(2);
   if(a[0]==='fetch')return ok();
   if(a.join(' ')==='rev-parse --abbrev-ref HEAD')return ok('master');
   if(a.join(' ')==='rev-parse HEAD')return ok(head);
   if(a.join(' ')==='rev-parse origin/master')return ok('new');
   if(a.join(' ')==='rev-parse --short HEAD')return ok(head);
   if(a[0]==='pull'){
     head='new';pulls++;
     const r=shellSpawn('/bin/sh',[hookPath],{cwd:base,env:{...process.env,PATH:`${bin}:/usr/bin:/bin`,SHELL_CASE:base,ORE_HOOK_RANGE:'old..new'},encoding:'utf8',timeout:5000});
     assert.equal(r.status,0,`hook must end: ${r.stderr}`);return ok();
   }
 }
 if(cmd==='bun'&&args.join(' ')==='run phone:install --status')return {status:1,stdout:'',stderr:'offline fixture'};
 throw Error(`Unexpected subprocess: ${cmd} ${args.join(' ')}`);
}}));
const original=readFileSync('apps/desktop/scripts/auto-update.ts','utf8');
const copy=original.replace('function pass() {','export function pass() {')
 .replace('from "./mac-load"',`from "../../apps/desktop/scripts/mac-load"`)
 .replace('const cache = join(homedir(), "Library/Caches/ore");',`const cache = ${JSON.stringify(cache)};`);
const copyPath=resolve('codex-out/shell/update-copy.ts');writeFileSync(copyPath,copy);
const {pass}=await import(copyPath);
pass();rmSync(join(base,'fail'),{force:true});pass();pass();
const attempts=existsSync(join(base,'attempts'))?readFileSync(join(base,'attempts'),'utf8').trim().split('\n').length:0;
const installed=readFileSync(join(base,'installed'),'utf8').trim();
console.log(`[DEEP] mode=${mode}; passes=3; checkout=${head}; origin=new; pulls=${pulls}; install attempts=${attempts}; installed=${installed}`);
console.log('[DEEP] hook log: '+(existsSync(join(cache,'app-install.log'))?readFileSync(join(cache,'app-install.log'),'utf8').trim().replace(/.*: (installing|installed|FAILED)/g,'$1'):'<empty>'));
try{assert.equal(installed,'new','A later healthy updater pass must recover the failed/skipped Mac install');}
catch{console.error('[DEEP] FAIL: later healthy update passes never retry the Mac install');process.exit(1);}
console.log('[DEEP] PASS: Mac install reached current checkout');process.exit(0);
