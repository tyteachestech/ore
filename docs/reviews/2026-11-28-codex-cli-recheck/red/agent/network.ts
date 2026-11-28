import {readFileSync} from 'node:fs';
globalThis.fetch=async (input:any)=>{
 const url=String(input?.url??input);
 if(url==='https://scout.invalid/article')return new Response(readFileSync(new URL('./article.html',import.meta.url),'utf8'),{headers:{'content-type':'text/html; charset=utf-8'}});
 if(url==='https://scout.invalid/missing')return new Response('missing',{status:404});
 throw new Error('SCOUT: unfixtureed network disabled: '+url);
};
