// Run with: node codex-out/soak/driver.cjs focus-sidebar
const assert=require('node:assert/strict');
module.exports=async s=>{
  if(!s.home)await require('./actions.cjs').setup(s);
  await s.home();
  const name='Soak external skill';
  const old=s.cli(['skills']).find(k=>k.id==='creativity');
  const before=await s.page.evaluate(()=>({...window.__soak.calls}));
  s.cli(['skills','set','creativity','--name',name]);
  await s.focusBack();
  const seen=await s.page.locator('.side-main').allTextContents();
  const disk=s.cli(['skills']).find(k=>k.id==='creativity').name;
  const after=await s.page.evaluate(()=>({...window.__soak.calls}));
  s.log({test:'focus-sidebar',expected:disk,sidebar:seen,commands:Object.fromEntries(Object.entries(after).map(([k,v])=>[k,v-(before[k]||0)]).filter(([k,v])=>v))});
  await s.page.screenshot({path:s.path.join(s.out,'focus-sidebar.png')});
  s.cli(['skills','set','creativity','--name',old.name]);
  assert.ok(seen.includes(name),'Sidebar keeps the old skill name after returning from another app');
};
