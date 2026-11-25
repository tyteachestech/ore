import assert from 'node:assert/strict';
import {open,select,history} from './harness';
function eventPaste(v:any,text:string,html='') {const e=new window.Event('paste',{bubbles:true,cancelable:true});Object.defineProperty(e,'clipboardData',{value:{getData:(t:string)=>t==='text/plain'?text:t==='text/html'?html:'',files:[],types:html?['text/plain','text/html']:['text/plain']}});v.dom.dispatchEvent(e);}
let count=0;
for(const [label,html] of [
 ['Safari','<meta charset="utf-8"><h2>Alpha</h2><p><b>Beta</b></p><ul><li>Gamma</li></ul>'],
 ['Chrome','<meta charset="utf-8"><span style="font-weight:bold">Alpha</span><div>Beta</div><div>Gamma</div>'],
 ['Notes','<div><b>Alpha</b></div><div><br></div><div>Beta</div><div>Gamma</div>'],
 ['Word','<p class="MsoNormal">Alpha<o:p></o:p></p><p class="MsoListParagraph" style="mso-list:l0 level1 lfo1"><span style="mso-list:Ignore">1. </span>Beta</p><p>Gamma</p>'],
 ['GoogleDocs','<b id="docs-internal-guid-a"><p dir="ltr"><span style="white-space:pre-wrap">Alpha</span></p><p dir="ltr">Beta</p><p>Gamma</p></b>'],
 ['Notion','<div><h2>Alpha</h2><ul><li>Beta</li><li>Gamma</li></ul></div>'],
 ['hostile','<p onclick="alert(1)">Alpha<script>alert(2)</script></p><p onmouseenter="alert(3)">Beta</p><div>Gamma</div>'],
]){
 const h=await open('');eventPaste(h.view,'Alpha\nBeta\nGamma',html);const out=h.md();for(const word of ['Alpha','Beta','Gamma'])assert.ok(out.includes(word),label+word);assert.ok(!out.includes('<script')&&!out.includes('onclick=')&&!out.includes('onmouseenter='));const r=await open(out);assert.equal(r.view.state.doc.textContent,h.view.state.doc.textContent);await h.close();await r.close();count++;
}
for(const [label,plain,html] of [['plain','## Literal\n- Text',''],['rich','First\nSecond','<p>First</p><p>Second</p>'],['url','https://example.test/x','']]){
 const h=await open('```\nKEEP\n```\n');select(h.view,'KEEP');eventPaste(h.view,plain,html);assert.equal(h.view.state.doc.childCount,1);assert.equal(h.view.state.doc.firstChild.type.name,'code_block');assert.equal(h.view.state.doc.firstChild.textContent,plain+'KEEP');await h.close();count++;
}
const h=await open('');const large='START '+ 'word '.repeat(20000)+'END';eventPaste(h.view,large);assert.equal(h.view.state.doc.textContent,large);const r=await open(h.md());assert.equal(r.view.state.doc.textContent,large);await h.close();await r.close();count++;
console.log('[DEEP] PASS',JSON.stringify({cases:count,largePasteCharacters:large.length,scope:'sample words, event attribute/script stripping, real code paste, 100KB plain text; no claim of full Word list fidelity'}));
