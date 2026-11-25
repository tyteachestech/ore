import {run,imported,unzipSync,zipSync,readFileSync,fix,join,strToU8,strFromU8,check} from './harness.ts';
const mode=process.argv[2]??'table';
await run(async()=>{
 const files=unzipSync(readFileSync(join(fix,'deck.pptx')));
 if(mode!=='order') {
 files['ppt/presentation.xml']=strToU8(strFromU8(files['ppt/presentation.xml']!).replace(/<p:sldIdLst>[\s\S]*?<\/p:sldIdLst>/,'<p:sldIdLst><p:sldId id="256" r:id="rId7"/></p:sldIdLst>'));
 files['ppt/slides/_rels/slide1.xml.rels']=strToU8('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>');
 }
 if(mode==='table') {
 const cell=(s:string)=>`<a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>${s}</a:t></a:r></a:p></a:txBody><a:tcPr/></a:tc>`;
 const tbl='<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="20" name="Study results"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr><p:xfrm><a:off x="0" y="0"/><a:ext cx="2000000" cy="1000000"/></p:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table"><a:tbl><a:tblPr/><a:tblGrid><a:gridCol w="1000000"/><a:gridCol w="1000000"/></a:tblGrid><a:tr h="500000">'+cell('Method')+cell('Score')+'</a:tr><a:tr h="500000">'+cell('Practice')+cell('92')+'</a:tr></a:tbl></a:graphicData></a:graphic></p:graphicFrame>';
 files['ppt/slides/slide1.xml']=strToU8(strFromU8(files['ppt/slides/slide1.xml']!).replace(/<p:sp>[\s\S]*?<\/p:sp>/g,'').replace('</p:spTree>',tbl+'</p:spTree>'));
 const {item}=await imported('slides-table','pptx',zipSync(files));
 check(item.body.includes('Practice')&&item.body.includes('92'),'slide table content must survive import');
 } else if(mode==='missing') {
 delete files['ppt/slides/slide1.xml'];
 let accepted=false;
 try {await imported('slides-missing','pptx',zipSync(files));accepted=true} catch(e){check(/damaged|missing|download|save/i.test(String(e)),'refusal must explain how to recover')}
 check(!accepted,'deck with referenced missing slide must be refused, not saved with an empty slide');
 } else if(mode==='order') {
 files['ppt/presentation.xml']=strToU8(strFromU8(files['ppt/presentation.xml']!).replace(/<p:sldIdLst>[\s\S]*?<\/p:sldIdLst>/,'<p:sldIdLst><p:sldId id="258" r:id="rId10"/><p:sldId id="256" r:id="rId7"/><p:sldId id="257" r:id="rId9"/></p:sldIdLst>'));
 const {item}=await imported('slides-order','pptx',zipSync(files));
 check(item.body.indexOf('## Retrieval')<item.body.indexOf('## Encoding'),'slide order must follow presentation relationships');
 }
});
