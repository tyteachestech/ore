const assert=require('node:assert/strict');
module.exports=async s=>{
 if(!s.home)await require('./actions.cjs').setup(s);
 if(!s.fixture)await require('./soak-day.cjs').setup(s);
 const p=s.page;
 const wait=async(f,label)=>{for(let i=0;i<140;i++){if(await f())return;await s.wait(30);await p.clock.runFor(50)}throw Error('Timed out: '+label)};
 const one=s.cli(['add','--stdin'],'# Soak live-poll Alpha\n\nAlpha discusses astronomy and distant galaxies.');
 const two=s.cli(['add','--stdin'],'# Soak live-poll Beta\n\nBeta discusses biology and living cells.');
 const at=await p.evaluate(()=>new Date().toISOString());s.fixture('pending',one.id,at);s.fixture('pending',two.id,at);
 await s.home();await s.focusBack();
 const open=async title=>{await p.getByRole('button',{name:'All sources',exact:true}).click({force:true});await p.clock.runFor(300);await p.locator('.row').filter({hasText:title}).first().click({force:true});await p.clock.runFor(400);await wait(async()=>(await p.locator('.doc-head').innerText()).includes(title),'source opens')};
 await open('Soak live-poll Alpha');await s.settle();
 let evidence;
 try{
   await p.evaluate(()=>{window.__ORE_SLOW={ls:3600000}});
   s.fixture('question',one.id,'Which galaxy belongs only to Alpha?');
   await p.clock.fastForward(4000);
   await wait(()=>p.evaluate(()=>window.__ORE_HELD.includes('ls')),'Alpha poll captured');
   await p.evaluate(()=>{window.__ORE_SLOW={}});
   await open('Soak live-poll Beta');
   await wait(()=>p.evaluate(()=>window.__ORE_PENDING===1),'Beta reads complete except old poll');
   const before=await p.locator('.reader').innerText();
   await p.evaluate(()=>window.__ORE_RELEASE('ls'));await s.tick(500);
   const after=await p.locator('.reader').innerText();
   evidence={test:'poll-race',before,after,foreignQuestion:after.includes('Which galaxy belongs only to Alpha?'),disk:s.cli(['show',two.id]).prequestions};s.log(evidence);
 }finally{await p.evaluate(()=>{window.__ORE_SLOW={};window.__ORE_RELEASE('ls')});await s.settle()}
 assert.equal(evidence.foreignQuestion,false,'A closed source poll puts its prequestion into the next source');
};
