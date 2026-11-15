module.exports=async()=>{
for(let round=1;round<=2;round++){
 writeOriginal(baseMd);await cli(['reimport',itemid]);for(const a of annotations().filter(a=>a.status==='deleted'))await cli(['annotate',a.id,'--status','open']);
 await page.reload();await idle();await openSource('Anchor study');
 await page.locator('.doc p').first().click();
 const before={body:JSON.parse((await cli(['show',itemid])).body).body,annotations:annotations()};
 const first=baseMd.replace('The copper kettle whistles before the water boils.\n\n','');
 writeOriginal(first);await reimport();
 await page.locator('.toast').filter({hasText:/^Reimported\./}).waitFor();
 const v1={body:JSON.parse((await cli(['show',itemid])).body).body,annotations:annotations()};
 writeOriginal(first.replace('## First section','## Updated first section'));await reimport();
 const v2={body:JSON.parse((await cli(['show',itemid])).body).body,annotations:annotations()};
 await page.locator('.doc p').first().click();await page.keyboard.press('Meta+z');await idle();
 const undo1={body:JSON.parse((await cli(['show',itemid])).body).body,annotations:annotations(),ui:await page.locator('body').innerText()};
 await page.keyboard.press('Meta+z');await idle();
 const undo2={body:JSON.parse((await cli(['show',itemid])).body).body,annotations:annotations(),ui:await page.locator('body').innerText()};
 await page.getByRole('tab',{name:'Collected',exact:true}).click();await idle();
 await page.screenshot({path:path.join(out,`double-undo-${round}.png`)});
 fs.writeFileSync(path.join(out,`double-undo-${round}.json`),JSON.stringify({before,v1,v2,undo1,undo2},null,2));
 console.log('double undo',round,'first restored V1',undo1.body===v1.body,'second restored V0',undo2.body===before.body,'second returned V2',undo2.body===v2.body,'kettle',undo2.annotations.find(a=>a.note==='Keep this kettle note.'));
}
};
