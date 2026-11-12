// Answer keys: display equations (LaTeX alttext) and tables (rows of cell text) from ar5iv HTML.
const { chromium } = require('playwright'); const fs=require('fs');
(async()=>{ const b=await chromium.launch(); const p=await b.newPage();
  for(const n of ['attention','bert','resnet','vae']){
    await p.setContent(fs.readFileSync(`${n}.html`,'utf8').replace(/<script[\s\S]*?<\/script>/g,''),{waitUntil:'domcontentloaded'});
    const k=await p.evaluate(()=>{
      const eq=[...document.querySelectorAll('table.ltx_equation, table.ltx_equationgroup, div.ltx_equation')].map(t=>[...t.querySelectorAll('math')].map(m=>m.getAttribute('alttext')).join(' '));
      const tab=[...document.querySelectorAll('figure.ltx_table')].map(f=>{
        const t=f.querySelector('table'); if(!t) return null;
        const txt=e=>{const c=e.cloneNode(true);c.querySelectorAll('math').forEach(m=>m.replaceWith(m.getAttribute('alttext')||''));c.querySelectorAll('annotation').forEach(a=>a.remove());return c.textContent.replace(/\s+/g,' ').trim();};
        return [...t.querySelectorAll('tr')].map(r=>[...r.querySelectorAll('td,th')].map(txt));
      }).filter(Boolean);
      return {eq,tab};});
    fs.writeFileSync(`${n}.keys.json`,JSON.stringify(k,null,1)); console.log(n,'eq',k.eq.length,'tables',k.tab.length);
  }
  await b.close();})();
