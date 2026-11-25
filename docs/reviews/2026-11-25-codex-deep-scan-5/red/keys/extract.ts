import { parse } from '../../node_modules/.bun/@babel+parser@7.29.9/node_modules/@babel/parser';
import { readFileSync } from 'node:fs';
/** Executes an unmodified arrow function directly from production TSX with supplied closed-over state.
 * Re-reads source on every run; does not mount the app or run effects. */
export function handler(file: string, contains: string, scope: Record<string, unknown>) {
  const source = readFileSync(file, 'utf8');
  const ast = parse(source, {sourceType:'module',plugins:['typescript','jsx']});
  const matches: any[]=[];
  function walk(n:any) {
    if(!n || typeof n!=='object') return;
    if(n.type==='ArrowFunctionExpression' && source.slice(n.start,n.end).includes(contains)) matches.push(n);
    for(const [k,v] of Object.entries(n)) if(!['loc','tokens','comments'].includes(k)) {
      if(Array.isArray(v)) v.forEach(walk); else if(v && typeof v==='object') walk(v);
    }
  }
  walk(ast); matches.sort((a,b)=>(a.end-a.start)-(b.end-b.start));
  const node=matches[0]; if(!node) throw Error(`No handler: ${contains}`);
  const js=new Bun.Transpiler({loader:'tsx'}).transformSync(`const fn = ${source.slice(node.start,node.end)};`);
  console.log(`[DEEP] handler ${file}:${node.loc.start.line}`);
  return Function(...Object.keys(scope), `${js}; return fn;`)(...Object.values(scope));
}
export function event(key: string, extra: Record<string,unknown> = {}) {
  const e: any = {key, code:key, keyCode:0, repeat:false, metaKey:false, ctrlKey:false, altKey:false, shiftKey:false, isComposing:false, defaultPrevented:false, stopPropagation(){}, preventDefault(){this.defaultPrevented=true}, ...extra};
  e.nativeEvent=e;
  return e;
}
