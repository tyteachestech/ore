module.exports=async()=>{
page.setDefaultTimeout(6000);
global.lib ??= path.resolve('codex-out/libs/reimport');
global.openSource=async title=>{await page.getByRole('button',{name:/^All sources/}).click();await page.locator('.row').filter({hasText:title}).first().click();await page.locator('.doc-head').filter({hasText:title}).waitFor();await idle()};
global.select=async phrase=>{
 const b=await page.evaluate(phrase=>{const w=document.createTreeWalker(document.querySelector('.doc'),NodeFilter.SHOW_TEXT);for(let n=w.nextNode();n;n=w.nextNode()){const i=n.data.indexOf(phrase);if(i<0)continue;n.parentElement.scrollIntoView({block:'center'});const r=document.createRange();r.setStart(n,i);r.setEnd(n,i+phrase.length);const rs=r.getClientRects(),a=rs[0],z=rs[rs.length-1];return {x1:a.left+1,y1:a.top+a.height/2,x2:z.right-1,y2:z.top+z.height/2}}},phrase);
 if(!b)throw Error('Missing selection text: '+phrase);await page.mouse.move(b.x1,b.y1);await page.mouse.down();await page.mouse.move(b.x2,b.y2,{steps:5});await page.mouse.up();await page.getByRole('dialog',{name:'Highlight',exact:true}).waitFor();
};
global.saveState=name=>{const data={};function walk(dir){for(const x of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,x.name);if(x.isDirectory()){if(!x.name.startsWith('.'))walk(p)}else if(/(doc\.md|notes\.md|annotations.*\.jsonl)$/.test(x.name)||dir.endsWith('/cards'))data[path.relative(lib,p)]=fs.readFileSync(p,'utf8')}}walk(lib);fs.writeFileSync(path.join(out,name+'.json'),JSON.stringify(data,null,2));return data};

global.reimport=async()=>{await page.getByRole('button',{name:'Source actions',exact:true}).click();await page.getByRole('menuitem',{name:'Reimport',exact:true}).click();await idle()};
global.mark=async(phrase,type,note)=>{await select(phrase);if(type)await page.getByRole('button',{name:type,exact:true}).click();if(note)await page.getByRole('textbox',{name:'Note',exact:true}).fill(note);await page.keyboard.press(note?'Escape':'Enter');await idle()};
global.run=async name=>{delete require.cache[require.resolve('./'+name+'.cjs')]; await require('./'+name+'.cjs')()};
};
