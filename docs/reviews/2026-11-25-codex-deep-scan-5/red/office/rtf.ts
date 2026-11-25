import {run,imported,check} from './harness.ts';
await run(async()=>{
 const bytes=Buffer.concat([Buffer.from('{\\rtf1\\ansi\\ansicpg1251 '),Buffer.from([0xcf,0xf0,0xe8,0xe2,0xe5,0xf2]),Buffer.from('}')]);
 const {item}=await imported('rtf-cp1251','rtf',bytes);
 check(item.body.includes('Привет'),'literal RTF bytes must use declared windows-1251 code page');
});
