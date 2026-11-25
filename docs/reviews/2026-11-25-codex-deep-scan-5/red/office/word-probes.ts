import {word,wp,log,readFileSync,root,join,check,run,unzipSync,zipSync,strToU8,strFromU8} from './harness.ts';
import {docxToDoc} from '../../packages/core/src/ingest/office.ts';
import mammoth from '../../packages/core/node_modules/mammoth/lib/index.js';
await run(async()=>{
 const bytes=readFileSync(join(root,'inputs/word-merged.docx'));
 log('mammoth HTML',(await mammoth.convertToHtml({buffer:bytes})).value);
 log('direct converter',(await docxToDoc(bytes)).body);
 const files=unzipSync(bytes);
 files['word/document.xml']=strToU8(strFromU8(files['word/document.xml']!).replace(/<w:vMerge[^>]*\/>/g,''));
 log('unmerged control',(await docxToDoc(zipSync(files))).body);
});
