from pathlib import Path
import subprocess, os, json
out=Path('codex-out/courses/logs')
out.mkdir(exist_ok=True)
cases=[
 ('playlist-insert',['bun','codex-out/courses/playlist.ts','insert'],1,3,{}),
 ('playlist-append',['bun','codex-out/courses/playlist.ts','append'],0,1,{}),
 ('playlist-private',['bun','codex-out/courses/playlist.ts','private'],0,1,{}),
 ('playlist-two-courses',['bun','codex-out/courses/playlist.ts','two-courses'],0,1,{}),
 ('reimport-remove',['bun','codex-out/courses/reimport.ts','remove'],1,1,{}),
 ('reimport-reorder',['bun','codex-out/courses/reimport.ts','reorder'],1,1,{}),
 ('filter',['bun','codex-out/courses/filtered-course.ts'],1,3,{}),
 ('filter-control',['bun','codex-out/courses/filtered-course.ts','control'],0,1,{}),
 ('collection',['bun','codex-out/courses/collection-collision.ts','add'],1,3,{}),
 ('collection-set',['bun','codex-out/courses/collection-collision.ts','set'],1,1,{}),
 ('collection-picker',['bun','codex-out/courses/collection-collision.ts','picker'],1,1,{}),
 ('collection-control',['bun','codex-out/courses/collection-collision.ts','control'],0,1,{}),
 ('questions',['bun','test','codex-out/courses/course-questions.test.tsx'],1,3,{}),
 ('questions-source',['bun','test','codex-out/courses/course-questions.test.tsx'],0,1,{'COURSES_PROBE':'source'}),
 ('questions-wake',['bun','test','codex-out/courses/course-questions.test.tsx'],0,1,{'COURSES_PROBE':'wake'}),
 ('add-undo',['bun','codex-out/courses/add-undo.ts'],1,3,{}),
 ('add-undo-control',['bun','codex-out/courses/add-undo.ts','control'],0,1,{}),
 ('position',['bun','codex-out/courses/course-position.ts'],1,3,{}),
 ('position-control',['bun','codex-out/courses/course-position.ts','control'],0,1,{}),
 ('lifecycle',['bun','codex-out/courses/lifecycle.ts'],0,1,{})]
results=[]
for name,cmd,want,n,env in cases:
 for run in range(1,n+1):
  r=subprocess.run(cmd,env={**os.environ,'ORE_NO_ENRICH':'1',**env},text=True,capture_output=True,timeout=15)
  log=out/f'{name}-{run}.log';log.write_text('$ '+(' '.join(f'{k}={v}' for k,v in env.items())+' ' if env else '')+' '.join(cmd)+'\n'+r.stdout+r.stderr+f'\nexit={r.returncode}\n')
  results.append({'name':name,'run':run,'exit':r.returncode,'expected':want,'log':str(log)})
 print(f'{name}: {n} runs, expected exit {want}, actual '+','.join(str(x['exit']) for x in results if x['name']==name))
Path('codex-out/courses/confirmations.json').write_text(json.dumps(results,indent=2)+'\n')
assert all(x['exit']==x['expected'] for x in results),'a control or red loop did not behave as expected'
