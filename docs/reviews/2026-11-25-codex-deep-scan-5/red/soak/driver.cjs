const {webkit}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const readline=require('node:readline');
const root=process.cwd(), out=path.join(root,'codex-out/soak');
const lib=path.join(root,'codex-out/libs/soak');
const log=(v)=>{console.log('[DEEP]',JSON.stringify(v));fs.appendFileSync(path.join(out,'session.jsonl'),JSON.stringify(v)+'\n')};
function instrumentation(){
  const timers=new Map(), calls={}, events=[], listeners=new Map();
  const setT=window.setTimeout.bind(window),setI=window.setInterval.bind(window),clearT=window.clearTimeout.bind(window),clearI=window.clearInterval.bind(window);
  for(const [kind,set] of [['timeout',setT],['interval',setI]])window[kind==='timeout'?'setTimeout':'setInterval']=function(fn,delay,...args){let id;const at=new Error().stack?.split('\n').slice(2,5).join('\n');id=set(typeof fn==='function'?function(...a){if(kind==='timeout')timers.delete(id);return fn(...a)}:fn,delay,...args);timers.set(id,{kind,delay,at});return id};
  window.clearTimeout=function(id){timers.delete(id);clearT(id)};window.clearInterval=function(id){timers.delete(id);clearI(id)};
  for(const [target,label] of [[window,'window'],[document,'document']]){
    const add=target.addEventListener.bind(target),remove=target.removeEventListener.bind(target);const byType=new Map();listeners.set(label,byType);
    target.addEventListener=function(type,fn,options){if(!options?.once){let list=byType.get(type);if(!list)byType.set(type,list=[]);const capture=typeof options==='boolean'?options:!!options?.capture;if(!list.some(e=>e.fn===fn&&e.capture===capture))list.push({fn,capture})}return add(type,fn,options)};
    target.removeEventListener=function(type,fn,options){const list=byType.get(type)||[],capture=typeof options==='boolean'?options:!!options?.capture;const i=list.findIndex(e=>e.fn===fn&&e.capture===capture);if(i>=0)list.splice(i,1);return remove(type,fn,options)};
  }
  const original=window.__TAURI_INTERNALS__.invoke;
  window.__TAURI_INTERNALS__.invoke=async function(cmd,args){if(cmd==='ore'){const key=args.args[0];calls[key]=(calls[key]||0)+1;events.push({at:Date.now(),args:args.args});if(events.length>300)events.shift()}return original.call(this,cmd,args)};
  window.__soak={timers,calls,events,listeners};
}
(async()=>{
  const browser=await webkit.connect('ws://[::1]:1760/');
  const context=await browser.newContext({viewport:{width:1280,height:800},timezoneId:'America/Los_Angeles'});
  const page=await context.newPage();
  page.setDefaultTimeout(6000);
  await page.clock.install({time:new Date('2026-11-24T08:00:00-08:00')});
  await page.clock.pauseAt(new Date('2026-11-24T08:00:00-08:00'));
  await page.addInitScript(()=>{window.__ORE_BRIDGE=1762;window.__ORE_FAIL={enrich:'Soak: simulated enrichment unavailable',tutor:'Soak: no real AI',remix:'Soak: no real AI',grade:'Soak: no real AI',dig:'Soak: no real AI'}});
  await page.addInitScript({path:path.join(root,'apps/desktop/scripts/mock/tauri.js')});
  await page.addInitScript(instrumentation);
  const errors=[];page.on('pageerror',e=>{errors.push(e.message);log({pageerror:e.message})});
  const s={page,context,browser,root,out,lib,fs,path,errors,log};
  s.cli=(args,stdin)=>{const text=execFileSync('bun',['packages/cli/src/ore.ts',...args,'--json'],{cwd:root,env:{...process.env,ORE_LIBRARY:lib,ORE_NO_ENRICH:'1'},input:stdin,encoding:'utf8',timeout:20000});return JSON.parse(text)};
  s.wait=ms=>new Promise(r=>setTimeout(r,ms));
  s.settle=async()=>{for(let i=0;i<120;i++){await s.wait(50);if(!await page.evaluate(()=>window.__ORE_PENDING||0)){await page.clock.runFor(60);await s.wait(60);if(!await page.evaluate(()=>window.__ORE_PENDING||0))return}}throw Error('inflight '+await page.evaluate(()=>JSON.stringify(window.__ORE_INFLIGHT)))};
  s.tick=async(ms)=>{await page.clock.fastForward(ms);await s.settle()};
  s.snapshot=async(label)=>{const v=await page.evaluate(label=>({label,date:new Date().toISOString(),dom:document.querySelectorAll('*').length,heap:performance.memory?.usedJSHeapSize??null,timers:[...window.__soak.timers.values()],listeners:Object.fromEntries([...window.__soak.listeners].map(([k,v])=>[k,Object.fromEntries([...v].map(([t,x])=>[t,x.length]).filter(([t,n])=>n))])),calls:{...window.__soak.calls},pending:window.__ORE_INFLIGHT,text:document.body.innerText}),label);log(v);return v};
  s.click=async(selector)=>{await page.locator(selector).first().click({force:true});await page.clock.runFor(400);await s.settle()};
  await page.goto('http://localhost:1761/');await s.settle();await s.snapshot('initial');
  if(process.argv[2]){try{await require('./'+process.argv[2]+'.cjs')(s)}finally{await context.close();await browser.close()}return}
  const lines=readline.createInterface({input:process.stdin,crlfDelay:Infinity});
  for await(const line of lines){try{const input=JSON.parse(line);if(input.close){await context.close();await browser.close();break}const result=await new (Object.getPrototypeOf(async function(){}).constructor)('s',input.code)(s);if(result!==undefined)log({result});console.log('READY')}catch(e){log({error:e.message,stack:e.stack});console.log('READY')}}
})().catch(e=>{console.error(e);process.exitCode=1});
