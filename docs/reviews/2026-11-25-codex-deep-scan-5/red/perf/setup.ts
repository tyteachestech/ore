import {cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, statSync, rmSync} from 'node:fs';
import {join,relative} from 'node:path';
const root=import.meta.dir;
if(process.argv.includes('--reset'))for(const n of ['base','double','large','twice-large'])if(existsSync(join(root,'libs',n)))rmSync(join(root,'libs',n),{recursive:true});
const files=(p:string):string[]=>readdirSync(p,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(join(p,e.name)):[join(p,e.name)]);
for (const [size, fromSize] of [['base','seed'],['double','base'],['large','double'],['twice-large','large']]) {
 const seed=fromSize==='seed'?join(root,'../libs/perf'):join(root,'libs',fromSize);
 const dest=join(root,'libs',size); if(existsSync(dest)) continue;
 mkdirSync(dest,{recursive:true});
 for(const n of readdirSync(seed)) if(!['.git','.index','.ore','.DS_Store','CLAUDE.md'].includes(n)) cpSync(join(seed,n),join(dest,n),{recursive:true});
 mkdirSync(join(dest,'.ore'),{recursive:true});
 if(size!=='base') {
  const map=new Map<string,string>();
  const all=files(join(dest,'items')).concat(files(join(dest,'cards')),files(join(dest,'reviews')));
  const text=all.filter(p=>/\.(md|jsonl|json)$/.test(p));
  for(const p of text) for(const id of readFileSync(p,'utf8').match(/[0-9A-HJKMNP-TV-Z]{26}/g)??[]) if(!map.has(id)) map.set(id,({'double':'0ZZZ','large':'0ZZY','twice-large':'0ZZX'}[size])+String(map.size+1).padStart(22,'0'));
  const replace=(s:string)=>s.replace(/[0-9A-HJKMNP-TV-Z]{26}/g,id=>map.get(id)??id);
  for(const year of readdirSync(join(dest,'items')).filter(y=>statSync(join(dest,'items',y)).isDirectory())) for(const dir of readdirSync(join(dest,'items',year))) {
   const from=join(dest,'items',year,dir), to=join(dest,'items',year,replace(dir));
   if(!statSync(from).isDirectory() || from===to) continue;
   cpSync(from,to,{recursive:true});
   for(const p of files(to).filter(p=>/\.(md|jsonl|json)$/.test(p)))writeFileSync(p,replace(readFileSync(p,'utf8')));
  }
  for(const p of files(join(dest,'cards'))) { const to=join(dest,'cards',replace(relative(join(dest,'cards'),p)));if(to!==p)writeFileSync(to,replace(readFileSync(p,'utf8'))); }
  for(const p of files(join(dest,'reviews'))) if(p.endsWith('.jsonl'))writeFileSync(p.replace('.jsonl','.'+size+'.jsonl'),replace(readFileSync(p,'utf8')));
 }
 console.log('[DEEP] setup',size,files(join(dest,'items')).filter(p=>p.endsWith('/doc.md')).length,'sources',files(join(dest,'cards')).filter(p=>p.endsWith('.md')).length,'cards');
}
