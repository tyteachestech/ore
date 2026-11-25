import {run,imported,check,readFileSync,fix,join} from './harness.ts';
const mode=process.argv[2]??'attachment';
const nb=(cells:any[])=>JSON.stringify({nbformat:4,nbformat_minor:5,metadata:{language_info:{name:'python'}},cells:cells.map((c,i)=>({id:`cell${i}`,...c}))});
await run(async()=>{
 if(mode==='attachment') {
 const svg='<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"><text x="10" y="50">Left ventricle</text></svg>';
 const {item}=await imported('notebook-attachment','ipynb',nb([{cell_type:'markdown',metadata:{},source:'![Diagram](attachment:heart.svg)',attachments:{'heart.svg':{'image/svg+xml':svg}}}]));
 check(/!\[Diagram\]\(assets\/.+\.svg\)/.test(item.body),'notebook attachment must be saved as a usable image');
 } else if(mode==='error') {
 const {item}=await imported('notebook-error','ipynb',nb([{cell_type:'code',metadata:{},execution_count:1,source:'1 / 0',outputs:[{output_type:'error',ename:'ZeroDivisionError',evalue:'division by zero',traceback:['ZeroDivisionError: division by zero']}]}]));
 check(item.body.includes('ZeroDivisionError'),'the error output that teaches the failed operation must survive');
 } else if(mode==='html') {
 const {item}=await imported('notebook-html','ipynb',nb([{cell_type:'code',metadata:{},execution_count:1,source:'show_results()',outputs:[{output_type:'display_data',metadata:{},data:{'text/html':'<table><tr><th>Outcome</th></tr><tr><td>Improved</td></tr></table>'}}]}]));
 check(item.body.includes('Improved'),'HTML-only output must survive');
 } else if(mode==='ordered') {
 const base=JSON.parse(readFileSync(join(fix,'plot.ipynb'),'utf8'));
 const plot=base.cells.find((c:any)=>c.outputs?.some((o:any)=>o.data?.['image/png']||o.data?.['image/svg+xml'])).outputs.find((o:any)=>o.data?.['image/png']||o.data?.['image/svg+xml']);
 const {item}=await imported('notebook-order','ipynb',nb([{cell_type:'code',metadata:{},execution_count:1,source:'plot_then_explain()',outputs:[plot,{output_type:'stream',name:'stdout',text:'AFTER FIGURE'}]}]));
 check(item.body.indexOf('![](')<item.body.indexOf('AFTER FIGURE'),'outputs must stay in execution order');
 } else if(mode==='v3') {
 await imported('notebook-v3','ipynb',JSON.stringify({nbformat:3,nbformat_minor:0,metadata:{},worksheets:[{cells:[{cell_type:'markdown',metadata:{},source:['# Old lesson\n','Important archived teaching notes.']}]}]}));
 }
});
