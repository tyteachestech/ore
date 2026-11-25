import {run,imported,root,join,writeFileSync,check,log} from './harness.ts';
await run(async()=>{
 const mode=process.argv[2]??'relative';
 if(mode==='relative') {
 writeFileSync(join(root,'inputs/diagram.svg'),'<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"><text x="10" y="50">Left ventricle</text></svg>');
 const {item}=await imported('text-relative','md','![Diagram](diagram.svg)\n');
 check(/!\[Diagram\]\(assets\/.+\.svg\)/.test(item.body),'relative Markdown picture must be copied and linked to the saved asset');
 } else if(mode==='html') {
 const {item}=await imported('text-html','md','# A lesson\n\n<div>First paragraph.\n\nSecond paragraph.</div>\n');
 check(item.body.includes('First paragraph.')&&item.body.includes('Second paragraph.'),'both HTML paragraphs survive');
 } else if(mode==='metadata') {
 const {item}=await imported('filename-different','md','---\ntitle: Own title\nauthor: Ada Learner\ndate: 2025-04-03\n---\n# Heading title\n\nA lesson with [[Other note]] and `code` and $x^2$.\n');
 check(item.meta.title==='Own title'&&item.meta.author==='Ada Learner'&&item.meta.published?.startsWith('2025-04-03'),'own frontmatter kept');
 check(item.body.includes('[[Other note]]')&&item.body.includes('$x^2$'),'wiki and math text kept');
 }
});
