import {run, imported, word, wp, check, log} from './harness.ts';
const test=process.argv[2]??'equation';
await run(async()=>{
 if(test==='equation') {
 const bytes=word(wp('Energy equation follows.')+'<w:p><m:oMath><m:r><m:t>E=mc²</m:t></m:r></m:oMath></w:p>');
 const {item}=await imported('word-equation','docx',bytes); check(item.body.includes('E=mc'),'Word equation must not vanish');
 } else if(test==='outline') {
 const {item}=await imported('word-outline','docx',word(wp('Chapter one','<w:outlineLvl w:val="0"/>')));
 check(/^# Chapter one$/m.test(item.body),'outline level zero must remain a heading');
 } else if(test==='merged') {
 const tc=(s:string,merge='')=>`<w:tc><w:tcPr>${merge}</w:tcPr>${wp(s)}</w:tc>`;
 const body='<w:tbl><w:tblGrid><w:gridCol w:w="1000"/><w:gridCol w:w="1000"/></w:tblGrid><w:tr>'+tc('Treatment')+tc('Outcome')+'</w:tr><w:tr>'+tc('Training','<w:vMerge w:val="restart"/>')+tc('Improved')+'</w:tr><w:tr>'+tc('','<w:vMerge/>')+tc('Retained')+'</w:tr></w:tbl>';
 const {item}=await imported('word-merged','docx',word(body));
 check(/\| (?:Training)? \| Retained \|/.test(item.body),'second outcome must stay under Outcome, not Treatment');
 } else if(test==='tracked') {
 const {item}=await imported('word-tracked','docx',word('<w:p><w:del w:id="1" w:author="Ada"><w:r><w:delText>WRONG_ANSWER</w:delText></w:r></w:del><w:ins w:id="2" w:author="Ada"><w:r><w:t>CORRECT_ANSWER</w:t></w:r></w:ins></w:p>'));
 check(item.body.includes('CORRECT\\_ANSWER')&&!item.body.includes('WRONG'),'tracked edits should read accepted text');
 }
});
