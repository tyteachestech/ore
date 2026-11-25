import {test, expect, mock} from 'bun:test';
import {mkdirSync, rmSync, writeFileSync, readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {Window} from 'happy-dom';
import {act, useState, useEffect, useRef, useCallback} from 'react';
import {createItem,setItemArchived} from '../../packages/core/src/items.ts';
import {setCourseArchived} from '../../packages/core/src/courses.ts';
import {addHighlight} from '../../packages/core/src/annotations.ts';
import {listQuestions} from '../../packages/core/src/questions.ts';
const w=new Window();for(const k of ['window','document','HTMLElement','Node','MutationObserver','getComputedStyle','navigator']){const v=(w as any)[k];(globalThis as any)[k]=typeof v==='function'&&/^[a-z]/.test(k)?v.bind(w):v;}
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true,matchMedia:()=>({matches:false,addEventListener(){},removeEventListener(){}}),requestAnimationFrame:(f:any)=>setTimeout(()=>f(0),0),cancelAnimationFrame:clearTimeout});
const root=resolve('codex-out/courses/libs/course-stats');
rmSync(root,{recursive:true,force:true});mkdirSync(`${root}/cards`,{recursive:true});
writeFileSync(`${root}/skills.yaml`,'skills:\n  - id: learn\n    name: Learn\n    priority: P2\n');
const lib={root};process.env.ORE_LIBRARY=root;process.env.ORE_NO_ENRICH='1';
const item=await createItem(lib,{type:'article',title:'Lesson',body:'Fixture body.',skills:['learn'],course:{id:'course',title:'Course',part:1,url:'https://fixture.test/course'}});
addHighlight(item,{exact:'Fixture',intent:'question',note:'What does this mean?'});
const calls:string[]=[];
const tauriActual=await import('@tauri-apps/api/core');
mock.module('@tauri-apps/api/core',()=>({...tauriActual,invoke:async(cmd:string,p:any)=>{
 if(cmd!=='ore')throw new Error('refused non-ore call');const a=p.args;calls.push(a.join(' '));
 if(a[0]==='questions')return listQuestions(lib,{skill:'learn'});
 if(a[0]==='course')return {lessons:await setCourseArchived(lib,a[2],!a.includes('--undo'))};
 if(a[0]==='archive')return setItemArchived(lib,a[1],!a.includes('--undo'));
 throw new Error(`refused ${a}`);
},convertFileSrc:(s:string)=>s}));
const {createRoot}=await import('react-dom/client');
const {ore,opt}=await import('../../apps/desktop/src/ore.ts');
const {useLibraryChanges,useFocusBack,wakeOpenScreens}=await import('../../apps/desktop/src/util.ts');
const {sourceActions}=await import('../../apps/desktop/src/list-actions.ts');
const {change}=await import('../../apps/desktop/src/change.ts');
const file=readFileSync('apps/desktop/src/SkillPage.tsx','utf8');

const qBody=file.slice(file.indexOf('function Questions({'),file.indexOf('  const { setStatus, remove } = useQuestionEdits'));
const useQuestions=new Function('useState','useEffect','useRef','useCallback','ore','opt','useLibraryChanges','useFocusBack',new Bun.Transpiler({loader:'ts'}).transformSync(qBody+'\nreturn qs; }\nreturn Questions;'))(useState,useEffect,useRef,useCallback,ore,opt,useLibraryChanges,useFocusBack);

test('Archive course refreshes the open skill page questions',async()=>{
 const el=document.createElement('div');document.body.append(el);const host=createRoot(el);
 let qs:any=null;const notify=(()=>()=>{}) as any;const Host=()=>{qs=useQuestions({skill:'learn',notify});return null;};
 await act(async()=>host.render(<Host/>));
 expect(qs.length).toBe(1);
 const actions=sourceActions({ore,skills:[],items(){},archived(){},setSkills(){},reloadSkills(){},change:c=>change((()=>()=>{}) as any,c),skillChange:c=>change((()=>()=>{}) as any,c)});
 await act(async()=>{if(process.env.COURSES_PROBE==='source') await actions.archive({...item.meta,dir:item.dir} as any); else await actions.archiveCourse({id:'course',title:'Course'},[{...item.meta,dir:item.dir} as any]); if(process.env.COURSES_PROBE==='wake') wakeOpenScreens();});
 const shownQuestions=qs.length;const savedQuestions=listQuestions(lib,{skill:'learn'}).length;
 console.log('[DEEP]',JSON.stringify({probe:process.env.COURSES_PROBE??"course",shownQuestions,savedQuestions,calls}));
 await act(async()=>host.unmount());el.remove();await w.happyDOM.close();
 expect(shownQuestions).toBe(savedQuestions);
});
