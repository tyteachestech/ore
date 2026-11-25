import {run,imported,readFileSync,join,fix,unzipSync,zipSync,strToU8,strFromU8,check,log} from './harness.ts';
import {pptxToDoc} from '../../packages/core/src/ingest/office.ts';
export function deck(count=3,distinctPaths=false) {
 const files=unzipSync(readFileSync(join(fix,'deck-pictures.pptx')));
 const picture=strFromU8(files['ppt/slides/slide1.xml']!).match(/<p:pic>[\s\S]*?<\/p:pic>/)![0].replace('descr="image.png"','descr="Forgetting curve used in each worked example"');
 for(let i=1;i<=3;i++) {
 const p=`ppt/slides/slide${i}.xml`;
 files[p]=strToU8(strFromU8(files[p]!).replace(/<p:pic>[\s\S]*?<\/p:pic>/g,'').replace('</p:spTree>',picture+'</p:spTree>'));
 files[`ppt/slides/_rels/slide${i}.xml.rels`]=strToU8(`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${distinctPaths?`copy${i}`:'image1'}.png"/></Relationships>`);
 if(distinctPaths)files[`ppt/media/copy${i}.png`]=files['ppt/media/image1.png']!;
 }
 if(count===2) files['ppt/presentation.xml']=strToU8(strFromU8(files['ppt/presentation.xml']!).replace(/(<p:sldIdLst>)([\s\S]*?)(<\/p:sldIdLst>)/,(_,open,ids,close)=>open+ids.match(/<p:sldId\b[^>]*\/>/g).slice(0,2).join('')+close));
 return zipSync(files);
}
if(import.meta.main) await run(async()=>{
 if(process.argv[2]==='probes') {
 for(const [count,distinct] of [[2,false],[3,false],[3,true]] as const) {
 const d=pptxToDoc(deck(count,distinct));log(`${count} slides distinctPaths=${distinct}`,{pictures:(d.body.match(/!\[/g)??[]).length,assets:d.assets?.map(a=>a.name)});
 }
 } else {
 const {item}=await imported('slides-repeated','pptx',deck());
 check((item.body.match(/!\[/g)??[]).length===3,'a teaching figure reused on three slides must stay on those slides');
 }
});
