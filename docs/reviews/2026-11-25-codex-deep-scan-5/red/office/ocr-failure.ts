import {run,root,join,writeFileSync,check,log,allItems} from './harness.ts';
import {initLibrary} from '../../packages/core/src/init.ts';
import {addSource} from '../../packages/core/src/ingest/index.ts';
import {chmodSync,rmSync} from 'node:fs';
await run(async()=>{
 const lib={root:join(root,'libs/ocr-failure')};rmSync(lib.root,{recursive:true,force:true});await initLibrary(lib.root);
 const file=join(root,'inputs/ocr-failure.png');writeFileSync(file,Buffer.from('89504e470d0a1a0a','hex'));
 const helper=join(root,'bin/ocr-failure');
 // Exactly the native helper's stderr when NSImage cannot decode the input (ocr.swift:89).
 writeFileSync(helper,'#!/bin/sh\nprintf "%s\\n" "can\x27t open the image" >&2\nexit 1\n');chmodSync(helper,0o755);process.env.ORE_OCR=helper;
 let message='';try{await addSource(lib,file)}catch(e){message=(e as Error).message}
 log('refusal',{message,items:allItems(lib).length});
 check(message&&allItems(lib).length===0,'failed OCR must refuse without a blank item');
 check(/paste|save|export|try again|add.*(?:copy|version)|download/i.test(message),'OCR failure must give a next step, not just native helper stderr');
});
