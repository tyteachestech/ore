module.exports=async()=>{
for(let round=1;round<=2;round++){
 writeOriginal(baseMd);await cli(['reimport',itemid]);await page.reload();await idle();await openSource('Anchor study');
 writeOriginal(baseMd.replace('Questions make learners examine the evidence carefully.\n\n',''));await reimport();await page.getByRole('tab',{name:'Collected',exact:true}).click();await idle();
 const q=page.getByText('How strong is the evidence?',{exact:true});await q.click({button:'right'});console.log('q menu',await page.getByRole('menu').innerText());
 const before=await page.locator('.reader-scroll').evaluate(e=>e.scrollTop);
 await page.getByRole('menuitem',{name:'Show where it was asked',exact:true}).click();await idle();
 const after=await page.locator('.reader-scroll').evaluate(e=>e.scrollTop);const ui=await page.locator('body').innerText();
 fs.writeFileSync(path.join(out,`orphan-jump-${round}.json`),JSON.stringify({before,after,ui,shown:JSON.parse((await cli(['show',itemid])).body)},null,2));await page.screenshot({path:path.join(out,`orphan-jump-${round}.png`)});console.log('orphan jump',round,before,after,ui.slice(-350));
}
};
