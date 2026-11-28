import { mkdirSync, rmSync, writeFileSync, chmodSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { initLibrary } from '../../packages/core/src/init.ts';
import { snapshot } from '../../packages/core/src/history.ts';
import { addText } from '../../packages/core/src/ingest/index.ts';
import { writeNewCard } from '../../packages/core/src/cards.ts';
export const out = resolve(import.meta.dir);
const bin = join(out, 'bin');
mkdirSync(bin, {recursive:true});
for (const name of ['claude', 'codex']) {
  writeFileSync(join(bin,name), '#!/bin/sh\necho "AI_DISABLED_RESTORE_SCOUT" >&2\nexit 91\n');
  chmodSync(join(bin,name),0o755);
}
process.env.PATH = bin + ':' + process.env.PATH;
process.env.ORE_NO_ENRICH = '1';
export const at = (day:number, minute=0) => new Date(Date.UTC(2026,10,20+day,12,minute));
export async function fresh(name:string) {
  const root = join(out,'libs',name);
  rmSync(root,{recursive:true,force:true});
  await initLibrary(root);
  process.env.ORE_LIBRARY = root;
  return {root};
}
export function git(lib:{root:string}, ...args:string[]) {
  const r = Bun.spawnSync(['git','-c','user.name=Scout','-c','user.email=scout@localhost',...args],{cwd:lib.root,stdout:'pipe',stderr:'pipe'});
  if(r.exitCode) throw new Error(`git ${args.join(' ')}: ${r.stderr.toString()}`);
  return r.stdout.toString().trim();
}
export function snap(lib:{root:string}, day=0) {
  if(!snapshot(lib,{force:true,now:at(day).getTime()}).committed) throw new Error('Expected a snapshot commit');
  return git(lib,'rev-parse','HEAD');
}
export const source = (lib:{root:string}) => addText(lib,'# Restore source\n\nAlpha paragraph.\n\nBeta paragraph.\n\nGamma paragraph.\n');
export async function sourceCard(lib:{root:string}) {
  const item = await source(lib);
  const card = writeNewCard(lib,{kind:'card',item:item.meta.id,skills:['learning'],topics:[],content_type:'fact',question:'What is the first paragraph?',answer:'Alpha',rubric:[]});
  return {item,card};
}
export function check(ok:unknown, label:string, actual?:unknown) {
  console.log(`${ok?'PASS':'FAIL'} ${label}${actual === undefined?'':': '+JSON.stringify(actual)}`);
  if(!ok) process.exitCode = 1;
}
