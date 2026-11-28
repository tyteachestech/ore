import {mkdirSync, rmSync, writeFileSync, utimesSync} from "node:fs";
import {resolve, join} from "node:path";
import {initLibrary} from "../../packages/core/src/init.ts";
export const BASE=resolve("codex-out/snapshot");
process.env.PATH=join(BASE,"bin")+":"+process.env.PATH;
process.env.ORE_NO_ENRICH="1";
process.env.ORE_NO_TOOLS="1";
process.env.GIT_CONFIG_NOSYSTEM="1";
process.env.GIT_CONFIG_GLOBAL="/dev/null";
process.env.GIT_AUTHOR_DATE="2026-11-27T12:00:00Z";
process.env.GIT_COMMITTER_DATE="2026-11-27T12:00:00Z";
export const NOW=Date.parse("2026-11-27T12:00:00Z");
export async function fresh(name:string) { const root=join(BASE,"libs",name); rmSync(root,{recursive:true,force:true}); mkdirSync(root,{recursive:true}); await initLibrary(root); return {root}; }
export function git(lib:{root:string},...args:string[]) { const r=Bun.spawnSync(["/usr/bin/git","-c","user.name=Scout","-c","user.email=scout@localhost",...args],{cwd:lib.root,stdout:"pipe",stderr:"pipe"}); if(r.exitCode) throw Error(r.stderr.toString()); return r.stdout.toString().trim(); }
export function age(lib:{root:string},at=NOW){utimesSync(join(lib.root,".ore/last-snapshot"),new Date(at),new Date(at));}
export function check(ok:unknown,message:string) { if(!ok){console.log("FAIL: "+message); process.exitCode=1;}else console.log("PASS: "+message); }
