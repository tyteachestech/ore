import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { setup, updateItemMeta, addHighlight, findItem, addText } from './common.ts';
import { writeNewCard } from '../../packages/core/src/cards.ts';
const {lib, item} = await setup(process.argv[2] ?? 'matrix');
const second = await addText(lib, '# Another lesson\n\nSecond lesson about attention.\n', {skills:['learning']});
const course = '01JCOURSE000000000000000000';
for (const [i,src] of [item,second].entries()) await updateItemMeta(lib,src.meta.id,m=>({...m,course:{id:course,title:'Original course',part:i+1}}));
await updateItemMeta(lib,item.meta.id,m=>({...m, prequestions:[{q:'Why recall?',points:[{text:'Recall helps memory.',evidence:[{exact:'Recall improves memory.',prefix:'',suffix:'',start:12,end:35}]}]}],suggested_skill:{name:'Memory methods',hook:'Learn the methods'}}));
const ann = addHighlight(findItem(lib,item.meta.id),{exact:'Recall improves memory.',intent:'card'});
const question = addHighlight(findItem(lib,item.meta.id),{exact:'Spacing practice helps retention.',intent:'question'});
const tried = addHighlight(findItem(lib,item.meta.id),{exact:'Recall improves memory.',intent:'apply',note:'Recall after reading'});
const card = writeNewCard(lib,{kind:'card',item:item.meta.id,annotation:ann.id,skills:['learning'],topics:[],content_type:'fact',question:'What helps memory?',answer:'Recall',rubric:[]});
const card2 = writeNewCard(lib,{kind:'prompt',item:item.meta.id,skills:['learning'],topics:[],content_type:'concept',question:'Why recall?',answer:'Recall improves memory.',rubric:['Recall strengthens memory.','Spacing supports retention.']});
mkdirSync(join(item.dir,'assets'),{recursive:true});
writeFileSync(join(item.dir,'assets','figure.svg'),'<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100"/></svg>');
// Locally authored page text; no server or network involved.
writeFileSync(join(item.dir,'page.html'),'<html><head><title>Learning page</title></head><body><article><h1>Page notes</h1><p>'+'Local original words for studying attention and recall. '.repeat(20)+'</p></article></body></html>');
console.log(JSON.stringify({root:lib.root,item:item.meta.id,second:second.meta.id,course,annotation:ann.id,question:question.id,tried:tried.id,card:card.meta.id,card2:card2.meta.id,dir:item.dir}));
