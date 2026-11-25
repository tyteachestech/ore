const assert=require('node:assert/strict');
module.exports=async s=>{
 await s.home();
 const item=s.cli(['ls']).find(i=>i.title==='Soak hour 15');
 const title='Soak source renamed outside the page';
 s.cli(['edit',item.id,'--title',title]);
 s.fixture('cards',item.id,'outside-home');
 await s.focusBack();
 await s.page.locator('.home-go').hover({force:true});await s.tick(700);
 const disk=s.cli(['today']);
 const hint=await s.page.locator('.hint').allTextContents();
 const name=await s.page.locator(`.home-read[data-id="${item.id}"] .title`).innerText();
 s.log({test:'outside-home',diskDue:disk.due,hint,name,expectedName:title});
 s.cli(['edit',item.id,'--title',item.title]);await s.focusBack();
 await s.page.mouse.move(1200,700);await s.tick(300);
 assert.equal(name,title);assert.ok(hint.some(t=>t.includes(`${disk.due} due`)),'Home due hint differs from disk after returning');
};
