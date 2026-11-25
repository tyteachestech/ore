// The supplied bridge keeps real wall time. For this boundary only, return production core's
// Today calculated at the browser's pinned date; every other request still uses the real bridge.
const {execFileSync}=require('node:child_process');
const assert=require('node:assert/strict');
module.exports=async s=>{
 await s.home();
 const p=s.page;
 const at='2026-11-24T23:59:00-08:00',after='2026-11-25T00:01:00-08:00';
 const core=date=>JSON.parse(execFileSync('bun',['codex-out/soak/today-at.ts',date],{cwd:s.root,env:{...process.env,TZ:'America/Los_Angeles',ORE_LIBRARY:s.lib,ORE_NO_ENRICH:'1'},encoding:'utf8'}));
 const beforeToday=core(at),afterToday=core(after);
 const now=await p.evaluate(()=>Date.now());await s.tick(Date.parse(at)-now);
 await p.evaluate(({beforeToday,afterToday})=>{window.__ORE_EDIT={today:()=>new Date().getDate()===24?beforeToday:afterToday}},{beforeToday,afterToday});
 await s.focusBack();
 const before=await p.locator('.home-goal').innerText(),calls=await p.evaluate(()=>window.__soak.calls.today);
 await s.tick(Date.parse(after)-await p.evaluate(()=>Date.now()));
 await s.tick(1500); // Let the number transition finish before reading its text nodes.
 const afterText=await p.locator('.home-goal').innerText(),reads=(await p.evaluate(()=>window.__soak.calls.today))-calls;
 s.log({test:'midnight',before,after:afterText,reads,coreBefore:{active_ms:beforeToday.active_ms,due:beforeToday.due},coreAfter:{active_ms:afterToday.active_ms,due:afterToday.due}});
 await p.evaluate(()=>{window.__ORE_EDIT={}});
 assert.ok(reads>=1,'Home did not reread Today across midnight');assert.match(afterText,/0 of 10 min/,'Home kept yesterday minutes');
};
