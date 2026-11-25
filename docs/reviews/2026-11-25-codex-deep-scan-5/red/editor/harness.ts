// Headless DOM setup matches apps/desktop/test/blockops.test.ts. No app, server or AI.
const base = new URL('../../apps/desktop/', import.meta.url).pathname;
export const dep = (name: string) => import(Bun.resolveSync(name, base));
const { Window } = await dep('happy-dom');
const w = new Window();
for (const k of ['window','document','HTMLElement','Node','MutationObserver','getComputedStyle']) {
  const v = w[k];
  (globalThis as any)[k] = typeof v === 'function' && /^[a-z]/.test(k) ? v.bind(w) : v;
}
(globalThis as any).requestAnimationFrame = (f: () => void) => setTimeout(f, 0);
export const ed = await import('../../apps/desktop/src/editor/editor');
export const core = await dep('@milkdown/kit/core');
export const pm = await dep('@milkdown/kit/prose/state');
export const history = await dep('@milkdown/kit/prose/history');
export const ops = await import('../../apps/desktop/src/editor/blockops');
export async function open(md: string) {
 const root = document.createElement('div'); document.body.append(root);
 const editor = await ed.createEditor(root, md, () => {});
 const view = editor.action((ctx:any) => ctx.get(core.editorViewCtx));
 return {editor,view, md:()=>ed.markdownOf(editor), close:async()=>{await editor.destroy();root.remove();}};
}
export function at(v:any, text:string) {
 let p=-1;v.state.doc.descendants((n:any,pos:number)=>{if(p<0&&n.isTextblock&&n.textContent.startsWith(text))p=pos+1; return p<0;});
 if(p<0)throw new Error('missing '+text);return p;
}
export function select(v:any,text:string){const p=at(v,text);v.dispatch(v.state.tr.setSelection(pm.TextSelection.create(v.state.doc,p)));return p;}
export function key(v:any,key:string, opts:any={}) {return v.someProp('handleKeyDown',(f:any)=>f(v,{key,code:key,metaKey:false,ctrlKey:false,altKey:false,shiftKey:false,preventDefault(){},stopPropagation(){},...opts}));}
export function paste(v:any, plain:string, html?:string) {
 const e={clipboardData:{getData:(t:string)=> t==='text/plain'?plain:t==='text/html'?html??'':'',files:[],items:[],types:html?['text/plain','text/html']:['text/plain']},preventDefault(){}};
 return html?v.pasteHTML(html,e as any):v.pasteText(plain,e as any);
}
