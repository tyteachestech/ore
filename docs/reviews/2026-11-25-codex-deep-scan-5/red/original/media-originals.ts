import { fresh, log } from './harness';
import { mock } from 'bun:test';
import { readFileSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const vtt = readFileSync('packages/core/test/fixtures/intake/audio/sundial.vtt','utf8');
mock.module('../../packages/core/src/ingest/audio.ts', () => ({transcribe: async () => vtt, transcribeFile: async () => vtt}));
mock.module('../../packages/core/src/ingest/ocr.ts', () => ({scannedText: async () => ({title:'A fixture screenshot',body:'This is deterministic OCR text for the preservation check.\n'})}));
const { addSource, reimportSource } = await import('../../packages/core/src/ingest/index');
const { sourceFile } = await import('../../packages/core/src/items');
for (const fixture of ['files/screenshot.png','audio/sundial.wav','audio/chaptered.mp3','audio/chaptered.m4a']) {
 const name=fixture.split('/').pop()!; const lib=fresh('media-'+name);const input=join(lib.root,name);
 copyFileSync('packages/core/test/fixtures/intake/'+fixture,input);
 const i=await addSource(lib,input);const original=sourceFile(i)!;
 assert(readFileSync(input).equals(readFileSync(original)));
 const r=await reimportSource(lib,i.meta.id);assert(!r.changed);assert(readFileSync(input).equals(readFileSync(original)));
 log(name,{originalByteIdentical:true,unchangedReimport:true,speechOrOcr:'stubbed',thumbnail:'disabled'});
}
