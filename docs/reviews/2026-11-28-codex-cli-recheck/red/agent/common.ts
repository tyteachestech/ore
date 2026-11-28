import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { initLibrary } from '../../packages/core/src/init.ts';
import { addText } from '../../packages/core/src/ingest/index.ts';
import { writeNewCard } from '../../packages/core/src/cards.ts';
import { commands } from '../../packages/cli/src/commands.ts';
export const out = resolve(import.meta.dir);
process.env.ORE_NO_ENRICH = '1';
process.env.ORE_DEVICE = 'agent-scout';
process.env.PATH = join(out,'bin') + ':' + process.env.PATH;
process.env.TMPDIR = join(out,'tmp');
mkdirSync(process.env.TMPDIR,{recursive:true});
export const stamp = {vendor:'claude', model:'fixture-original', prompt_version:'enrich@fixture'};
export async function seed(name: string) {
 const root=join(out,'libs',name); rmSync(root,{recursive:true,force:true});
 process.env.ORE_LIBRARY=root;
 await initLibrary(root);
 const lib={root};
 const item=await addText(lib,'# Spaced practice\n\nSpacing retrieval across days strengthens later recall. Retrieval makes the memory accessible.\n\n| Technique | Interval |\n| --- | --- |\n| Spacing | days |\n',{skills:['learning']});
 const card=writeNewCard(lib,{item:item.meta.id,kind:'prompt',content_type:'concept',question:'Why space retrieval?',answer:'It strengthens later recall.',rubric:['Retrieval strengthens recall.','Space attempts across days.'],skills:['learning'],topics:[],ai:stamp});
 return {lib,item,card};
}
export async function ore(...argv:string[]) {
 const [name,...args]=argv; const c=commands[name!]!;
 if(!c)throw new Error('unknown command '+name);
 const {positionals,values}=parseArgs({args,allowPositionals:true,strict:true,options:{json:{type:'boolean'},...c.options}});
 const r=await c.run(positionals,values);
 return r.data as any;
}
export function fixtureReply(data:unknown){
 process.env.SCOUT_REPLY=join(out,'reply.json');
 writeFileSync(process.env.SCOUT_REPLY,JSON.stringify(data));
 process.env.ORE_AI='claude';
}
