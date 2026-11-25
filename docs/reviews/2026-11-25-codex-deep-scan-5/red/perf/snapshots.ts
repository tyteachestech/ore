import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
for(const size of ['mini','base','large','twice-large']){const root=join(import.meta.dir,'libs',size),out:Record<string,string|null>={};
function walk(dir:string){for(const e of readdirSync(join(root,dir),{withFileTypes:true})){if(e.name.startsWith('.'))continue;const rel=dir?dir+'/'+e.name:e.name;if(e.isDirectory())walk(rel);else if(/\.(md|ya?ml|jsonl?|excalidraw|vtt)$/.test(e.name))out[rel]=readFileSync(join(root,rel),'utf8');else if(/^(thumbnail|course-cover)\.(jpe?g|png|webp|gif)$/.test(e.name))out[rel]=`data:image/${e.name.split('.').pop()};base64,${readFileSync(join(root,rel)).toString('base64')}`;else if(!e.isSymbolicLink())out[rel]=null;}}
walk('');writeFileSync(join(import.meta.dir,size+'-snapshot.json'),JSON.stringify(out));console.log('[DEEP]',size,Object.keys(out).length,'files');}
