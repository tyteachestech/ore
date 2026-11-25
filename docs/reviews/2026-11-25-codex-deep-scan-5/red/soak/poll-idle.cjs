const assert=require('node:assert/strict');
module.exports=async s=>{
 const p=s.page;
 const item=s.cli(['add','--stdin'],'# Soak bounded poll\n\nA pending source used to count polling calls.');
 s.fixture('pending',item.id,await p.evaluate(()=>new Date().toISOString()));
 await s.home();await s.focusBack();await p.getByRole('button',{name:'All sources',exact:true}).click({force:true});await s.tick(300);await p.locator('.row').filter({hasText:item.title}).first().click({force:true});await s.tick(500);
 const before=await p.evaluate(()=>window.__soak.calls.ls||0),samples=[];
 for(let n=1;n<=50;n++){await s.tick(4000);if([15,30,45,46,50].includes(n))samples.push({tick:n,ls:await p.evaluate(()=>window.__soak.calls.ls||0),intervals:await p.evaluate(()=>[...window.__soak.timers.values()].filter(t=>t.kind==='interval').map(t=>t.delay))})}
 const count=(await p.evaluate(()=>window.__soak.calls.ls||0))-before;
 const noPoll=!(await p.evaluate(()=>[...window.__soak.timers.values()].some(t=>t.kind==='interval'&&t.delay===4000)));
 const after=await s.measure('pending-source-after-timeout');
 s.log({test:'poll-idle',count,samples,stopped:noPoll,idleCommands:after.minuteCommands});
 assert.equal(count,45);assert.ok(noPoll);assert.equal(after.minuteCommands.ls||0,0);
 // Retry has a real user-facing failure but no AI command reaches the bridge.
 const retry=p.getByRole('button',{name:'Try again',exact:true});
 await retry.click({force:true});await s.tick(400);
 const text=await p.locator('.reader').innerText();
 s.log({test:'enrich-retry',visibleFailure:text.includes('Soak: simulated enrichment unavailable'),text});
 assert.ok(text.includes('Soak: simulated enrichment unavailable'));
 await s.home();const home=await s.measure('home-after-poll-closed');assert.equal(home.minuteCommands.ls||0,0);
};
