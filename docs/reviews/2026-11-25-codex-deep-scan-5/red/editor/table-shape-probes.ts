import {open,dep} from './harness';
const {DOMParser}=await dep('@milkdown/kit/prose/model');
for(const [label,html] of [
 ['paragraphs','<table><tr><th>Title</th></tr><tr><td><p>Alpha</p><p>Beta</p></td></tr></table>'],
 ['flattened','<table><tr><th>Title</th></tr><tr><td>Alpha Beta</td></tr></table>'],
 ['rowspan','<table><tr><th>Group</th><th>Value</th></tr><tr><td rowspan="2">Alpha</td><td>Beta</td></tr><tr><td>Gamma</td></tr></table>'],
 ['expanded','<table><tr><th>Group</th><th>Value</th></tr><tr><td>Alpha</td><td>Beta</td></tr><tr><td>Alpha</td><td>Gamma</td></tr></table>'],
]){
 const h=await open('');const dom=document.createElement('div');dom.innerHTML=html!;
 const slice=DOMParser.fromSchema(h.view.state.schema).parseSlice(dom);
 const describe=(n:any):any=>n.type.name==='text'?n.text:{type:n.type.name,...(n.type.name.includes('cell')||n.type.name==='table_header'?{span:[n.attrs.rowspan,n.attrs.colspan]}:{}),children:n.content.content.map(describe)};
 console.log('[DEEP] dom-parse',label,JSON.stringify(slice.content.content.map(describe)));
 const e=new window.Event('paste',{bubbles:true,cancelable:true});Object.defineProperty(e,'clipboardData',{value:{getData:(t:string)=>t==='text/html'?html:'',files:[]}});h.view.dom.dispatchEvent(e);
 console.log('[DEEP] paste-and-save',label,JSON.stringify(h.md()));await h.close();
}
