import {run as suite,root,join,log,check,readFileSync} from './harness.ts';
import {mock} from 'bun:test';
import {run as childRun} from '../../packages/core/src/ingest/swift.ts';
const helper=join(root,'bin/ocr-failure');
// Use the production recognize branch, stubbing only where the compiled binary is found.
mock.module('../../packages/core/src/ingest/swift.ts',()=>({run:childRun,swiftHelper:async()=>helper}));
const {scannedText}=await import('../../packages/core/src/ingest/ocr.ts');
await suite(async()=>{
 delete process.env.ORE_OCR;
 let defaultError='';try{await scannedText(readFileSync(join(root,'inputs/ocr-failure.png')),'png')}catch(e){defaultError=(e as Error).message}
 log('production recognize branch',defaultError);check(defaultError==="can't open the image",'same error without ORE_OCR override');
 let emptyError='';try{await scannedText(new Uint8Array(),'png',async()=>[{lines:[]}])}catch(e){emptyError=(e as Error).message}
 log('empty recognized text control',emptyError);check(/paste/.test(emptyError),'empty output gets a next step');
});
