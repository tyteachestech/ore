import {run,imported,check,log,root,join,writeFileSync,readFileSync,fix,allItems,existsSync,unzipSync,zipSync,strToU8,strFromU8,word,wp} from './harness.ts';
import {addSource} from '../../packages/core/src/ingest/index.ts';
import {initLibrary} from '../../packages/core/src/init.ts';
import {docxToDoc,pptxToDoc} from '../../packages/core/src/ingest/office.ts';
import {csvToDoc} from '../../packages/core/src/ingest/sheets.ts';
import {notebookToDoc} from '../../packages/core/src/ingest/notebook.ts';
import {rtfToDoc} from '../../packages/core/src/ingest/rtf.ts';
import {chmodSync,rmSync} from 'node:fs';
const mode=process.argv[2]??'text';
await run(async()=>{
 if(mode==='text') {
 const text='# Encoded lesson\r\n\r\nCafé déjà vu.\r\n';
 for(const [encoding,bytes] of [['utf16le',Buffer.concat([Buffer.from([0xff,0xfe]),Buffer.from(text,'utf16le')])],['cp1252',Buffer.from(text,'latin1')],['utf8bom',Buffer.concat([Buffer.from([0xef,0xbb,0xbf]),Buffer.from(text)])]] as const) {
 const {item}=await imported(`control-${encoding}`,'txt',bytes);check(item.body.includes('Café déjà vu.'),'text must decode');check(item.meta.title==='Encoded lesson','heading title must decode');
 }
 for(const [key,text,tsv] of [['quoted','\uFEFFword;meaning\r\n"cocinar";"to cook; bake"\r\n',false],['tsv','word\tmeaning\r\n"hello"\t"a greeting\nquoted ""hello"""\r\n',true]] as const) {
 const d=csvToDoc(text,tsv);log(key,d);check(d.body.includes(key==='quoted'?'to cook; bake':'a greeting quoted "hello"'),'quoted field preserved');
 }
 try {csvToDoc('heading\n'+'row\n'.repeat(5000));throw new Error('accepted large CSV')}catch(e){check(/5,001 rows, too many/.test(String(e)),'large CSV gives refusal')}
 log('row limit','5001 nonempty rows refused');
 } else if(mode==='office') {
 const doc=await docxToDoc(readFileSync(join(fix,'word-code.docx')));check(doc.body.includes('COMMENT EVIDENCE')&&doc.body.includes('```\ndef learn():\n    return 42\n```'),'Word comments and code');log('Word comments/code','kept');
 const rtf=rtfToDoc(readFileSync(join(fix,'word.rtf')));check(rtf.author==='Ada Learner'&&rtf.published&&rtf.body.includes('[^1]')&&rtf.assets.length>0,'RTF metadata, footnote and image');log('RTF sample',{title:rtf.title,author:rtf.author,published:rtf.published,assets:rtf.assets.map(a=>a.name)});
 const nb=(source:string|string[])=>notebookToDoc(JSON.stringify({cells:[{cell_type:'markdown',source},{cell_type:'code',source:['print(1)'],outputs:[{output_type:'stream',text:['1','\n']}]}]}));
 check(nb('# Title\nBody').body===nb(['# Title\n','Body']).body,'source string/list equivalent');log('notebook source string/list','same Markdown and code');
 const img=await docxToDoc(readFileSync(join(fix,'figure.docx')));check(img.assets?.length&&img.body.includes('assets/'),'inline Word images kept');log('Word inline images','kept');
 } else if(mode==='refusals') {
 const lib={root:join(root,'libs/control-refusals')};rmSync(lib.root,{recursive:true,force:true});await initLibrary(lib.root);
 for(const ext of ['pages','key','numbers','doc','docx','pptx','xlsx']) {
 const f=join(root,'inputs',`bad.${ext}`);writeFileSync(f,'damaged');
 try {await addSource(lib,f);throw new Error(`accepted ${ext}`)}catch(e){log(ext,String(e));check(/export|save|download/i.test(String(e)),`${ext} refusal offers recovery`)}
 }
 check(allItems(lib).length===0,'refusals create no items');
 } else if(mode==='ocr') {
 const lib={root:join(root,'libs/control-ocr')};rmSync(lib.root,{recursive:true,force:true});await initLibrary(lib.root);
 const file=join(root,'inputs','ocr.png');writeFileSync(file,Buffer.from('89504e470d0a1a0a','hex'));
 const helper=join(root,'bin','ocr-standin');
 for(const [key,script] of [['empty',"printf '%s' '{\"pages\":[{\"lines\":[]}]}'"],['failed',"echo 'Vision failed to load this image' >&2; exit 4"],['malformed',"printf '%s' '{\"pages\":null}'"]] as const) {
 writeFileSync(helper,`#!/bin/sh\n${script}\n`);chmodSync(helper,0o755);process.env.ORE_OCR=helper;
 try {await addSource(lib,file);throw new Error(`accepted ${key}`)}catch(e){log(`ocr ${key}`,String(e));check(!String(e).includes('accepted'),'OCR failure refused')}
 check(allItems(lib).length===0,'no blank source on OCR failure');
 }
 delete process.env.ORE_OCR;
 const orig=Object.getOwnPropertyDescriptor(process,'platform')!;
 Object.defineProperty(process,'platform',{value:'linux'});
 try {await addSource(lib,file);throw new Error('accepted off Mac')}catch(e){log('ocr off Mac',String(e));check(/Mac only.*paste/i.test(String(e)),'off Mac gives next step')}
 finally{Object.defineProperty(process,'platform',orig)}
 check(allItems(lib).length===0,'off Mac creates no item');
 }
});
