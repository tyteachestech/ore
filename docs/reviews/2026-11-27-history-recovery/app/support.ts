import { mkdirSync, rmSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { initLibrary } from '../../packages/core/src/init';
import { addSource } from '../../packages/core/src/ingest/index';
import { snapshot } from '../../packages/core/src/history';
import { History, type Step } from '../../apps/desktop/src/history';
import type { Notify } from '../../apps/desktop/src/util';
export const folder = resolve(import.meta.dir);
process.env.PATH = `${folder}/bin:${process.env.PATH}`;
process.env.ORE_NO_ENRICH = '1';
process.env.ORE_DEVICE = 'app-scout';
export let clock = Date.parse('2026-11-27T18:00:00Z');
const NativeDate = Date;
export function pinClock() {
  globalThis.Date = class extends NativeDate {
    constructor(...args: any[]) { super(...(args.length ? args : [clock]) as [any]); }
    static now() { return clock; }
  } as DateConstructor;
}
export const advance = (ms = 2000) => { clock += ms; };
export const tick = () => new Promise<void>(r => setTimeout(r, 0));
(globalThis as any).requestAnimationFrame ??= (f: any) => setTimeout(() => f(performance.now()), 0);
(globalThis as any).localStorage ??= {getItem: () => null, setItem() {}, removeItem() {}};
export async function setup(name: string) {
  const root = resolve(folder, 'libs', name);
  if (!root.startsWith(`${folder}/libs/`)) throw new Error('outside scout folder');
  rmSync(root, {recursive:true, force:true});
  mkdirSync(root, {recursive:true});
  process.env.ORE_LIBRARY = root;
  await initLibrary(root);
  const lib = { root };
  const item = await addSource(lib, resolve('packages/core/test/fixtures/intake/files/obsidian-note.md'));
  return {lib, item};
}
export function git(lib: {root:string}, ...args: string[]) {
  const r = Bun.spawnSync(['git', '-c', 'user.name=Ore scout', '-c', 'user.email=scout@localhost', ...args], {cwd:lib.root});
  if (r.exitCode) throw new Error(r.stderr.toString());
  return r.stdout.toString().trim();
}
export function snap(lib: {root:string}) {
  const r = snapshot(lib, {force:true, now:clock});
  if (!r.committed) throw new Error('snapshot did not commit');
  return git(lib, 'rev-parse', 'HEAD');
}
export const rel = (lib: {root:string}, path:string) => relative(lib.root, path);
export function history() {
  const errors: string[] = [];
  let landed = 0;
  const h = new History((_s,e) => errors.push(String(e)), () => landed++);
  const steps: Step[] = [];
  const notify: Notify = (message, kind, undo, redo) => {
    const step = {message, undo: undo ?? (()=>Promise.resolve()), redo};
    if (undo) { h.push(step); steps.push(step); }
    else if (kind === 'error') errors.push(message);
    return Object.assign(() => h.forget(step), {undo: () => h.take(step), hold: (p:Promise<unknown>)=>h.hold(step,p)});
  };
  const settle = async () => {for(let n=0;n<8;n++) await tick();};
  return {h, notify, errors, steps, settle, landed:()=>landed};
}
/** Same command dispatch as CLI, in-process so only one Bun process runs. Snapshots are explicit. */
export async function run<T>(...args:string[]): Promise<T> {
  const { commands } = await import('../../packages/cli/src/commands');
  const { parseArgs } = await import('node:util');
  const cmd = commands[args[0]!];
  if (!cmd) throw new Error(`unknown command ${args[0]}`);
  const {positionals,values} = parseArgs({args:args.slice(1), options:{json:{type:'boolean'},...cmd.options},allowPositionals:true,strict:true});
  const r = await cmd.run(positionals,values);
  if(r.exitCode) throw new Error(r.text);
  return r.data as T;
}
