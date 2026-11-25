// Run with: node codex-out/soak/driver.cjs home-race
const assert=require('node:assert/strict');
module.exports=async s=>{
  if(!s.home)await require('./actions.cjs').setup(s);
  await s.home();
  const p=s.page, original=s.cli(['today']).goal_minutes, next=original===15?10:15;
  const wait=async(f,label)=>{for(let i=0;i<100;i++){if(await f())return;await s.wait(30);await p.clock.runFor(50)}throw Error('Timed out: '+label)};
  const focus=async()=>{await p.evaluate(()=>dispatchEvent(new Event('blur')));await p.clock.runFor(1);await p.clock.fastForward(12000);await p.evaluate(()=>dispatchEvent(new Event('focus')));await p.clock.runFor(100)};
  let evidence;
  try{
    await p.evaluate(()=>{window.__ORE_SLOW={today:3600000}});
    await focus();
    await wait(()=>p.evaluate(()=>window.__ORE_HELD.includes('today')),'old Today reply captured');
    await p.evaluate(()=>{window.__ORE_SLOW={}});
    if(s.control==='serial'||process.env.SOAK_CONTROL==='serial'){await p.evaluate(()=>window.__ORE_RELEASE('today'));await s.tick(300)}
    s.cli(['goal','--minutes',String(next)]);
    await focus();
    await wait(async()=>new RegExp(`of ${next} min`).test(await p.locator('.home-goal').innerText()),'new goal on Home');
    const fresh=await p.locator('.home-goal').innerText();
    await p.evaluate(()=>window.__ORE_RELEASE('today'));
    await s.tick(500);
    const afterOld=await p.locator('.home-goal').innerText();
    const disk=s.cli(['today']).goal_minutes;
    evidence={test:'home-race',control:s.control||process.env.SOAK_CONTROL||'held',original,next,fresh,afterOld,disk};s.log(evidence);
    await p.screenshot({path:s.path.join(s.out,'home-race.png')});
  }finally{
    await p.evaluate(()=>{window.__ORE_SLOW={};window.__ORE_RELEASE('today')});
    s.cli(['goal','--minutes',String(original)]);await s.focusBack();
  }
  assert.match(evidence.afterOld,new RegExp(`of ${next} min`),'An older Today response replaces the newer goal on Home');
};
