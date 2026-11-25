import {run,root,readFileSync,join,log,word,wp,unzipSync,zipSync,strFromU8,strToU8,check} from './harness.ts';
import {docxToDoc,pptxToDoc} from '../../packages/core/src/ingest/office.ts';
import {xlsxToDoc} from '../../packages/core/src/ingest/sheets.ts';
import {notebookToDoc} from '../../packages/core/src/ingest/notebook.ts';
import {rtfToDoc} from '../../packages/core/src/ingest/rtf.ts';
import {saveImages} from '../../packages/core/src/ingest/assets.ts';
import mammoth from '../../packages/core/node_modules/mammoth/lib/index.js';
import {book,inline} from './sheets.ts';
const summary=(n:any)=>({...n,assets:n.assets.map((a:any)=>({name:a.name,bytes:a.data.length}))});
const input=(name:string)=>readFileSync(join(root,'inputs',name));
await run(async()=>{
 const mode=process.argv[2];
 if(mode==='word') {
 for(const kind of ['equation','outline']) {
 const bytes=input(`word-${kind}.docx`); log(`${kind} mammoth`,await mammoth.convertToHtml({buffer:bytes}));
 log(`${kind} direct converter`,await docxToDoc(bytes));
 }
 log('heading style control',await docxToDoc(word(wp('Chapter one','<w:pStyle w:val="Heading1"/>'))));
 log('plain equation control',await docxToDoc(word(wp('Energy equation follows.')+wp('E=mc²'))));
 } else if(mode==='slides') {
 log('table direct',pptxToDoc(input('slides-table.pptx')).body);
 const files=unzipSync(input('slides-table.pptx'));
 let xml=strFromU8(files['ppt/slides/slide1.xml']!);
 const cells=[...xml.matchAll(/<a:tc>([\s\S]*?)<\/a:tc>/g)].map(m=>m[1]!.match(/<a:t>(.*?)<\/a:t>/)?.[1]);
 log('table XML cell texts',cells);
 files['ppt/slides/slide1.xml']=strToU8(xml.replace('</p:spTree>','<p:sp><p:txBody><a:p><a:r><a:t>Practice 92</a:t></a:r></a:p></p:txBody></p:sp></p:spTree>'));
 log('same text as shape control',pptxToDoc(zipSync(files)).body);
 const missing=unzipSync(input('slides-missing.pptx'));
 log('missing slide before',{present:!!missing['ppt/slides/slide1.xml'],body:pptxToDoc(zipSync(missing)).body});
 missing['ppt/slides/slide1.xml']=strToU8('<p:sld><p:sp><p:txBody><a:p><a:r><a:t>Restored slide</a:t></a:r></a:p></p:txBody></p:sp></p:sld>');
 log('missing slide restored control',pptxToDoc(zipSync(missing)).body);
 } else if(mode==='sheets') {
 log('uncached direct',xlsxToDoc(input('sheets-formula.xlsx')).body);
 const files=unzipSync(input('sheets-formula.xlsx'));files['xl/worksheets/sheet1.xml']=strToU8(strFromU8(files['xl/worksheets/sheet1.xml']!).replace('<v/>','<v>2</v>'));
 log('cached control',xlsxToDoc(zipSync(files)).body);
 for(const val of ['0.5','1.5']) log(`time ${val}`,xlsxToDoc(book(`<row r="1">${inline('A1','Clock')}${inline('B1','Duration')}</row><row r="2"><c r="A2" s="1"><v>${val}</v></c><c r="B2" s="2"><v>${val}</v></c></row>`)).body);
 const missing=unzipSync(input('sheets-missing.xlsx'));
 log('missing sheet direct',xlsxToDoc(zipSync(missing)).body);
 missing['xl/worksheets/sheet2.xml']=strToU8(`<worksheet><sheetData><row r="1">${inline('A1','Restored second sheet')}</row></sheetData></worksheet>`);
 log('restored sheet control',xlsxToDoc(zipSync(missing)).body);
 } else if(mode==='notebooks') {
 for(const mode of ['attachment','error','html','order']) {
 const nb=JSON.parse(input(`notebook-${mode}.ipynb`).toString());
 log(`${mode} direct`,summary(notebookToDoc(JSON.stringify(nb))));
 if(mode==='attachment') {
 const svg=nb.cells[0].attachments['heart.svg']['image/svg+xml'];
 nb.cells=[{cell_type:'code',source:'show_diagram()',outputs:[{output_type:'display_data',data:{'image/svg+xml':svg}}]}];
 log('same image as output control',summary(notebookToDoc(JSON.stringify(nb))));
 } else if(mode==='error'||mode==='html') {
 const o=nb.cells[0].outputs[0];
 nb.cells[0].outputs=[{output_type:'stream',text:mode==='error'?`${o.ename}: ${o.evalue}`:'Improved'}];
 log(`${mode} as stream control`,summary(notebookToDoc(JSON.stringify(nb))));
 } else {
 nb.cells[0].outputs.reverse(); log('reverse outputs control',notebookToDoc(JSON.stringify(nb)).body);
 }
 }
 } else if(mode==='rtf') {
 log('literal direct',rtfToDoc(input('rtf-cp1251.rtf')).body);
 log('escaped bytes control',rtfToDoc(Buffer.from("{\\rtf1\\ansi\\ansicpg1251 \\'cf\\'f0\\'e8\\'e2\\'e5\\'f2}")).body);
 log('cp1252 control',rtfToDoc(Buffer.concat([Buffer.from('{\\rtf1\\ansi\\ansicpg1252 Caf'),Buffer.from([0xe9]),Buffer.from('}')])).body);
 } else if(mode==='markdown') {
 for(const src of ['diagram.svg',`file://${root}/inputs/diagram.svg`]) {
 const got=await saveImages(`![Diagram](${src})`,{local:true});
 log(src,{body:got.body,assets:got.assets.map(a=>a.name)});
 }
 }
});
