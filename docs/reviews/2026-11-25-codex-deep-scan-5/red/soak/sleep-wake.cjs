const assert=require('node:assert/strict');
module.exports=async s=>{
 const p=s.page,item=s.cli(['ls']).find(i=>i.title==='Soak hour 23');
 const before=await p.evaluate(()=>({at:new Date().toISOString(),calls:{...window.__soak.calls}}));
 await p.evaluate(()=>dispatchEvent(new Event('blur')));await s.tick(1);
 s.cli(['edit',item.id,'--author','Changed during four-hour sleep']);
 await s.tick(4*3600000);
 await p.evaluate(()=>dispatchEvent(new Event('focus')));await s.tick(1000);
 const text=await p.locator('.doc-head').innerText();
 const after=await p.evaluate(()=>({at:new Date().toISOString(),calls:{...window.__soak.calls}}));
 s.log({test:'sleep-wake',before,after,head:text});
 assert.ok(text.includes('Changed during four-hour sleep'));
 await s.home();if(s.homeCheck)await s.homeCheck();await s.measure('home-after-four-hour-sleep');
};
