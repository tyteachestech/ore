import {open,paste,select,pm} from './harness';
const samples:[string,string,string][]=[
 ['Safari','Heading\nAlpha\nBeta','<meta charset="utf-8"><h2>Heading</h2><p><b>Alpha</b></p><ul><li>Beta</li></ul>'],
 ['Chrome','Alpha\nBeta','<meta charset="utf-8"><span style="font-weight:bold">Alpha</span><div>Beta</div>'],
 ['Notes','Alpha\nBeta','<div><b>Alpha</b></div><div><br></div><div>Beta</div>'],
 ['Word','Alpha\nBeta','<html xmlns:o="urn:schemas-microsoft-com:office:office"><body><!--StartFragment--><p class="MsoNormal">Alpha<o:p></o:p></p><p class="MsoListParagraph" style="mso-list:l0 level1 lfo1"><span style="mso-list:Ignore">1. </span>Beta</p><!--EndFragment--></body></html>'],
 ['GoogleDocs','Alpha\nBeta','<b id="docs-internal-guid-a"><p dir="ltr"><span style="font-weight:700;white-space:pre-wrap">Alpha</span></p><p dir="ltr"><span style="white-space:pre-wrap">Beta</span></p></b>'],
 ['Notion','Alpha\nBeta','<div><h2>Alpha</h2><ul><li>Beta</li></ul></div>'],
 ['mergedTable','Alpha\nBeta\nGamma','<table><tbody><tr><th colspan="2">Alpha</th></tr><tr><td>Beta</td><td>Gamma</td></tr></tbody></table>'],
 ['rowspanTable','Alpha\nBeta\nGamma','<table><tbody><tr><th>H1</th><th>H2</th></tr><tr><td rowspan="2">Alpha</td><td>Beta</td></tr><tr><td>Gamma</td></tr></tbody></table>'],
 ['tableParagraphs','Alpha\nBeta','<table><tr><th>Title</th></tr><tr><td><p>Alpha</p><p>Beta</p></td></tr></table>'],
 ['dataImage','Figure','<p>Figure</p><img alt="diagram" src="data:image/png;base64,aGVsbG8=">'],
 ['fileImage','Figure','<p>Figure</p><img alt="diagram" src="file:///tmp/diagram.png">'],
 ['unsafe','Alpha','<p onclick="alert(1)">Alpha<script>alert(2)</script></p><img src="x" onerror="alert(3)"><a href="javascript:alert(4)">Beta</a>'],
 ['color','Alpha','<p><span data-color="red">Alpha</span></p>'],
 ['math','Alpha x+1 Beta','<p>Alpha <span data-math="x+1">x+1</span> Beta</p>'],
];
for(const [label,plain,html] of samples){
 const h=await open('');paste(h.view,plain,html);const out=h.md();const r=await open(out);
 console.log('[DEEP]',JSON.stringify({label,out,text:h.view.state.doc.textContent,reloaded:r.view.state.doc.textContent,sameDoc:h.view.state.doc.eq(r.view.state.doc)}));
 await h.close();await r.close();
}
for(const [label,md,target] of [['code','```\nCODE\n```\n','CODE'],['cell','| H |\n|---|\n| CELL |\n','CELL'],['toggle','<details><summary>TITLE</summary>\n\nBody\n\n</details>\n','TITLE']]) {
 for(const [kind,plain,html] of [['plain','First\nSecond',undefined],['markdown','## First\n\n- Second',undefined],['rich','First\nSecond','<h2>First</h2><p>Second</p>'],['url','https://example.test/x',undefined]]){
 const h=await open(md!);select(h.view,target!);paste(h.view,plain!,html);const out=h.md();const r=await open(out);
 console.log('[DEEP]',JSON.stringify({label,kind,out,text:h.view.state.doc.textContent,reloaded:r.view.state.doc.textContent}));await h.close();await r.close();
 }
}
