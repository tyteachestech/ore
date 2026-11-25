const {execFileSync}=require('node:child_process');
exports.setup=async(s)=>{
 const p=s.page;
 s.fixture=(mode,id,arg)=>JSON.parse(execFileSync('bun',['codex-out/soak/fixture.ts',mode,id,arg],{cwd:s.root,env:{...process.env,ORE_LIBRARY:s.lib,ORE_NO_ENRICH:'1'},encoding:'utf8',timeout:20000}));
 s.measure=async(label)=>{const before=await p.evaluate(()=>({at:Date.now(),calls:{...window.__soak.calls}}));for(let i=0;i<30;i++){await p.clock.runFor(2000);await s.settle()}const snap=await p.evaluate(label=>({label,date:new Date().toISOString(),dom:document.querySelectorAll('*').length,heap:performance.memory?.usedJSHeapSize??null,timers:[...window.__soak.timers.values()],listeners:Object.fromEntries([...window.__soak.listeners].map(([k,v])=>[k,Object.fromEntries([...v].map(([t,x])=>[t,x.length]).filter(([t,n])=>n))])),calls:{...window.__soak.calls},text:document.body.innerText}),label);snap.seconds=(Date.parse(snap.date)-before.at)/1000;snap.minuteCommands=Object.fromEntries(Object.entries(snap.calls).map(([k,v])=>[k,v-(before.calls[k]||0)]).filter(([k,v])=>v));(s.metrics??=[]).push(snap);s.fs.writeFileSync(s.path.join(s.out,'metrics.json'),JSON.stringify(s.metrics,null,2));s.log({minute:label,date:snap.date,seconds:snap.seconds,calls:snap.minuteCommands,dom:snap.dom,timers:snap.timers.map(t=>[t.kind,t.delay]),listeners:snap.listeners});return snap};
 s.leaveReview=async()=>{for(let i=0;i<3&&await p.locator('.review').count();i++){const leave=p.getByRole('button',{name:'Leave review',exact:true});if(await leave.count())await leave.click({force:true});else await p.keyboard.press('Escape');await s.tick(600)}};
 s.review=async()=>{
   await s.home();
   if(s.homeCheck)await s.homeCheck();
   await p.getByRole('button',{name:/^(Start review|Keep going)$/,exact:false}).first().click({force:true});await s.tick(500);
   if(await p.getByRole('dialog',{name:'What to review',exact:true}).count()){await p.keyboard.press('Enter');await s.tick(500)}
   let rated=0;
   for(let n=0;n<2;n++){
     const no=p.getByRole('button',{name:'No idea',exact:true}),think=p.getByRole('radio',{name:'Think so',exact:true});
     if(await no.count())await no.click({force:true});else if(await think.count())await think.click({force:true});else {s.log({reviewStopped:await p.locator('.review').innerText()});break}
     await s.tick(600);let good=p.getByRole('button',{name:'Good',exact:true});if(!await good.count())break;await good.click({force:true});await s.tick(700);
     if(await p.locator('.review-guard').count()){await good.click({force:true});await s.tick(700)}rated++;
   }
   await s.leaveReview();s.log({ratings: rated});return rated;
 };
 s.runHours=async(start,end)=>{for(let n=start;n<=end;n++){
   const target=new Date('2026-11-24T08:00:00-08:00').getTime()+n*3600000;
   const now=await p.evaluate(()=>Date.now());if(target>now)await s.tick(target-now);
   const item=await s.addHour(n);await s.tutor();
   // Same persisted fields as a delayed or failed background job, with no AI process.
   await s.tick(8000);s.fixture('enrich',item.id,n%3===0?'fail':'ok');await s.tick(4000);
   s.cli(['edit',item.id,'--author',`Outside author ${n}`]);await s.focusBack();
   const shown=await p.locator('.reader').innerText();s.log({hour:n,externalAuthorRefreshed:shown.includes(`Outside author ${n}`),enrichment:n%3===0?'fail':'ok'});
   s.fixture('cards',item.id,String(n));await s.review();
   if(n%3!==0){await p.getByRole('button',{name:item.title,exact:true}).click({force:true});await s.tick(500);if(n%3===2){await p.getByRole('button',{name:'Open the tutor',exact:true}).click({force:true});await s.tick(500)}}
   await s.measure(`hour-${n}-${n%3===0?'home':n%3===1?'reader':'tutor'}`);
 }};
};
