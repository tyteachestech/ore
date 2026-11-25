const assert=require('node:assert/strict');
module.exports=async s=>{
 if(!s.home)await require('./actions.cjs').setup(s);
 if(!s.fixture)await require('./soak-day.cjs').setup(s);
 const p=s.page;
 const wait=async(f,label)=>{for(let i=0;i<140;i++){if(await f())return;await s.wait(30);await p.clock.runFor(50)}throw Error('Timed out: '+label)};
 const focus=async()=>{await p.evaluate(()=>dispatchEvent(new Event('blur')));await p.clock.runFor(1);await p.clock.fastForward(12000);await p.evaluate(()=>dispatchEvent(new Event('focus')));await p.clock.runFor(100)};
 const item=s.cli(['add','--stdin'],'# Soak delayed enrichment poll\n\nRetrieval practice strengthens memory through recall.');
 s.cli(['edit',item.id,'--skills','']);
 const at=await p.evaluate(()=>new Date().toISOString());s.fixture('pending',item.id,at);
 await s.home();await s.focusBack();
 await p.getByRole('button',{name:'All sources',exact:true}).click({force:true});await s.tick(300);
 await p.locator('.row').filter({hasText:item.title}).first().click({force:true});await s.tick(500);
 let evidence;
 try{
   await p.evaluate(()=>{window.__ORE_SLOW={ls:3600000}});
   s.fixture('question',item.id,'What makes recall helpful?');
   await p.clock.fastForward(4000);
   await wait(()=>p.evaluate(()=>window.__ORE_HELD.includes('ls')),'poll captured');
   await p.evaluate(()=>{window.__ORE_SLOW={}});
   if(s.control==='serial'||process.env.SOAK_CONTROL==='serial'){await p.evaluate(()=>window.__ORE_RELEASE('ls'));await s.tick(300)}
   s.cli(['edit',item.id,'--skills','learning']);
   await focus();
   await wait(async()=>(await p.locator('.doc-head').innerText()).includes('Learning'),'fresh source filing displayed');
   const fresh=await p.locator('.doc-head').innerText();
   await p.evaluate(()=>window.__ORE_RELEASE('ls'));await s.tick(500);
   const after=await p.locator('.doc-head').innerText();
   evidence={test:'reader-poll',control:s.control||process.env.SOAK_CONTROL||'held',id:item.id,fresh,after,disk:s.cli(['show',item.id]).skills};s.log(evidence);
   await p.screenshot({path:s.path.join(s.out,'reader-poll.png')});
 }finally{await p.evaluate(()=>{window.__ORE_SLOW={};window.__ORE_RELEASE('ls')});await s.settle()}
 assert.ok(evidence.after.includes('Learning'),'A stale enrichment poll removes the newer source filing from the header');
};
