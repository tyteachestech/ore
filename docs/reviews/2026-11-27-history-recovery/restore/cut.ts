import { fresh, source, snap, git, check } from './helpers.ts';
import { findItem } from '../../packages/core/src/items.ts';
import { cutText, restoreCut } from '../../packages/core/src/cut.ts';
import { relative } from 'node:path';
const lib=await fresh('cut');
const item=await source(lib);
const sha=snap(lib);
await cutText(lib,item.meta.id,item.body.indexOf('Alpha'),item.body.indexOf('Alpha')+1);
const mid=findItem(lib,item.meta.id);
const beta=await cutText(lib,item.meta.id,mid.body.indexOf('Beta'),mid.body.indexOf('Beta')+1);
git(lib,'checkout',sha,'--',relative(lib.root,item.docPath));
let error='';
try { await restoreCut(lib,item.meta.id,beta.id); } catch(e) { error=String(e); }
const now=findItem(lib,item.meta.id).body;
console.log(JSON.stringify({before:item.body,after:now,error},null,2));
check(now===item.body,'Undo after git restore never duplicates already-restored text');
