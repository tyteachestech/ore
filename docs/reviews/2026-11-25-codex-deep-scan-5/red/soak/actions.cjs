exports.setup=async function(s){
  const p=s.page;
  s.home=async()=>{const close=p.getByRole('button',{name:'Close the tutor',exact:true});if(await close.count())await close.click({force:true});await p.getByRole('button',{name:'Home',exact:true}).click({force:true});await s.tick(500)};
  s.focusBack=async()=>{await p.evaluate(()=>dispatchEvent(new Event('blur')));await s.tick(1);await s.tick(12000);await p.evaluate(()=>dispatchEvent(new Event('focus')));await s.tick(500)};
  s.highlight=async()=>{
    const phrase='Retrieval practice strengthens memory';
    const b=await p.evaluate(phrase=>{const w=document.createTreeWalker(document.querySelector('.doc'),NodeFilter.SHOW_TEXT);for(let n=w.nextNode();n;n=w.nextNode()){const i=n.data.indexOf(phrase);if(i<0)continue;n.parentElement.scrollIntoView({block:'center'});const r=document.createRange();r.setStart(n,i);r.setEnd(n,i+phrase.length);const rs=r.getClientRects(),a=rs[0],z=rs[rs.length-1];return{x1:a.left+1,y1:a.top+a.height/2,x2:z.right-1,y2:z.top+z.height/2}}},phrase);
    if(!b)throw Error('Missing highlight text');await p.mouse.move(b.x1,b.y1);await p.mouse.down();await p.mouse.move(b.x2,b.y2,{steps:5});await p.mouse.up();await s.tick(500);await p.keyboard.press('Enter');await s.tick(300);
  };
  s.addHour=async n=>{await s.home();await p.getByRole('button',{name:'+ Add',exact:true}).click({force:true});await s.tick(300);await p.getByLabel('Link, file path or text').fill(`# Soak hour ${String(n).padStart(2,'0')}\n\nRetrieval practice strengthens memory when the learner recalls an idea before seeing its answer.\n\nSpacing practice gives forgetting time to make the next retrieval useful.`);await p.keyboard.press('Enter');await s.tick(600);await s.highlight();const item=s.cli(['ls']).find(i=>i.title===`Soak hour ${String(n).padStart(2,'0')}`);const anns=s.cli(['show',item.id,'--annotations']).annotations;s.log({hour:n,added:item.id,highlights:anns.length});if(!anns.length)throw Error('Highlight not saved');return item};
  s.tutor=async()=>{await p.getByRole('button',{name:'Open the tutor',exact:true}).click({force:true});await s.tick(400);await p.getByRole('button',{name:'Close the tutor',exact:true}).click({force:true});await s.tick(400)};
};
