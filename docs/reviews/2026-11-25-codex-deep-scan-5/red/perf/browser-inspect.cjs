const {webkit}=require('playwright');
const fs=require('node:fs');
(async()=>{const browser=await webkit.connect('ws://[::1]:1760/');const context=await browser.newContext({viewport:{width:1280,height:800}});try{
const page=await context.newPage();await page.addInitScript(()=>window.__ORE_BRIDGE=1765);await page.addInitScript({path:process.cwd()+'/apps/desktop/scripts/mock/tauri.js'});
await page.addInitScript(()=>{window.__DEEP=[];const old=window.__TAURI_INTERNALS__.invoke;window.__TAURI_INTERNALS__.invoke=async function(cmd,args){const t=performance.now();try{return await old.apply(this,arguments);}finally{if(cmd==='ore')window.__DEEP.push({args:args.args,start:t,ms:performance.now()-t});}};});
await page.goto('http://localhost:1764/');await page.waitForTimeout(1600);console.log('MAC',await page.locator('body').innerText());console.log('CALLS',await page.evaluate(()=>window.__DEEP));console.log('LINKS',await page.locator('button').evaluateAll(es=>es.map(e=>({text:e.innerText,label:e.getAttribute('aria-label'),title:e.title})).slice(0,80)));
const phone=await context.newPage({viewport:{width:390,height:844}});await phone.addInitScript(()=>{window.__TAURI_INTERNALS__??={convertFileSrc:p=>'/library-file'+p,transformCallback:()=>0,invoke:()=>Promise.reject(Error('no Tauri here'))};});
phone.on('response',async r=>{if(r.url().includes('.js')){fs.appendFileSync('codex-out/perf/phone-assets.txt',r.url()+'\n');}});
await phone.goto('http://localhost:1766/');await phone.waitForTimeout(1600);console.log('PHONE',await phone.locator('body').innerText());console.log('PERF',await phone.evaluate(()=>PerformanceObserver.supportedEntryTypes));console.log('PHONE BUTTONS',await phone.locator('button').evaluateAll(es=>es.map(e=>({text:e.innerText,label:e.getAttribute('aria-label'),title:e.title})).slice(0,70)));
fs.writeFileSync('codex-out/perf/mac-dom.html',await page.content());fs.writeFileSync('codex-out/perf/phone-dom.html',await phone.content());
}finally{await context.close();await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
