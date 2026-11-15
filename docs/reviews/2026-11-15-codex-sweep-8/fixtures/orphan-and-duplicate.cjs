module.exports=async()=>{
for(let round=1;round<=2;round++){
 writeOriginal(baseMd);await cli(['reimport',itemid]);for(const a of annotations().filter(a=>a.status==='deleted'))await cli(['annotate',a.id,'--status','open']);await page.reload();await idle();await openSource('Anchor study');
 const north='A learner studies birds beside a quiet river.\n\nThe blue heron nests beside the river each spring.\n\nThis observation describes the northern habitat.';
 const south=north.replace('quiet','noisy').replace('northern','southern');
 writeOriginal(baseMd.replace(north,south).replace('## Final section',north+'\n\n## Final section'));
 await reimport();
 const data=JSON.parse((await cli(['show',itemid])).body),a=data.annotations.find(a=>a.note==='My observation: north habitat.');
 await page.locator('.doc p').filter({hasText:'This observation describes the southern habitat.'}).scrollIntoViewIfNeeded();
 fs.writeFileSync(path.join(out,`wrong-duplicate-${round}.json`),JSON.stringify({a,body:data.body,ui:await page.locator('body').innerText()},null,2));await page.screenshot({path:path.join(out,`wrong-duplicate-${round}.png`)});
 console.log('duplicate',round,a);
 writeOriginal(baseMd);await cli(['reimport',itemid]);await page.reload();await idle();await openSource('Anchor study');
 writeOriginal(baseMd.replace('Questions make learners examine the evidence carefully.\n\n',''));await reimport();await page.getByRole('tab',{name:'Collected',exact:true}).click();await idle();
 const beforeClick=await page.locator('body').innerText();console.log('ORPHAN UI',beforeClick.slice(-1800));
 fs.writeFileSync(path.join(out,`orphan-question-${round}.json`),JSON.stringify({shown:JSON.parse((await cli(['show',itemid])).body),ui:beforeClick},null,2));await page.screenshot({path:path.join(out,`orphan-question-${round}.png`)});
}
};
