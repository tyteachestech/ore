import {run,imported,pack,check,log,unzipSync,readFileSync,fix,join} from './harness.ts';
export function book(sheet:string,extra:Record<string,string>={}) {const base=unzipSync(readFileSync(join(fix,'vocab.xlsx')));
 for(const k of Object.keys(base)) if(k.startsWith('xl/worksheets/')) delete base[k];
 return pack({...base,
 '_rels/.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="r1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
 'xl/workbook.xml':'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Lesson" sheetId="1" r:id="r1"/></sheets></workbook>',
 'xl/_rels/workbook.xml.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="r1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="r2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
 'xl/styles.xml':'<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cellXfs count="3"><xf numFmtId="0"/><xf numFmtId="20"/><xf numFmtId="46"/></cellXfs></styleSheet>',
 'xl/worksheets/sheet1.xml':`<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheet}</sheetData></worksheet>`,...extra});}
export const inline=(ref:string,text:string)=>`<c r="${ref}" t="inlineStr"><is><t>${text}</t></is></c>`;
if(import.meta.main) await run(async()=>{
 const mode=process.argv[2]??'formula';
 if(mode==='formula') {
 const {item}=await imported('sheets-formula','xlsx',book(`<row r="1">${inline('A1','Result')}</row><row r="2"><c r="A2"><f>1+1</f><v/></c></row>`));
 check(item.body.includes('2')||item.body.includes('1+1'),'uncached formula must be represented or refused, not silently erased');
 } else if(mode==='time') {
 const {item}=await imported('sheets-time','xlsx',book(`<row r="1">${inline('A1','Clock')}${inline('B1','Duration')}</row><row r="2"><c r="A2" s="1"><v>1.5</v></c><c r="B2" s="2"><v>1.5</v></c></row>`));
 check(item.body.includes('| 12:00 | 36:00 |'),'Excel h:mm must wrap at 24h; only [h]:mm is elapsed duration');
 } else if(mode==='missing') {
 const bytes=book(`<row r="1">${inline('A1','Visible first sheet')}</row>`,{'xl/workbook.xml':'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Lesson" sheetId="1" r:id="r1"/><sheet name="Missing" sheetId="2" r:id="r3"/></sheets></workbook>','xl/_rels/workbook.xml.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="r1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="r3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/></Relationships>'});
 let accepted=false; try{await imported('sheets-missing','xlsx',bytes);accepted=true}catch(e){check(/missing|damaged|download|save/i.test(String(e)),'missing-sheet refusal must offer next step')}
 check(!accepted,'workbook with a referenced missing sheet must be refused');
 }
});
