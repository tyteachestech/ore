import subprocess,json,pathlib,time
root=pathlib.Path(__file__).resolve().parent
cases=[('cut',['cut-question.ts','inside','none'],1),('author',['reimport-overwrite.ts','author','none'],1),('highlight',['reimport-overwrite.ts','highlight','none'],1),('suggested',['suggested-archive.ts','archived'],1),*[(f'doctor-{m}',['doctor-blindspots.ts',m],1) for m in ['chat','inbox','variant','image']],('duplicate',['doctor-duplicate.ts','prefix'],1),('session',['session-reopen.ts','reopen'],1),('cut-after',['cut-question.ts','after'],0),('cut-keep',['cut-question.ts','keep'],0),('title',['reimport-overwrite.ts','title'],0),('active-skill',['suggested-archive.ts','active'],0),('suffix',['doctor-duplicate.ts','suffix'],0),('session-reend',['session-reopen.ts','reend'],0),('session-no-end',['session-reopen.ts','no-end'],0)]
results=[]
for name,args,expected in cases:
 for run in range(1,4 if expected else 2):
  cmd=['bun',str(root/args[0]),*args[1:]]; t=time.monotonic()
  p=subprocess.run(cmd,capture_output=True,text=True,timeout=25)
  log=root/'logs'/f'confirm-{name}-{run}.log';log.write_text(p.stdout+p.stderr)
  row=dict(case=name,run=run,command=cmd,expectedExit=expected,exit=p.returncode,seconds=round(time.monotonic()-t,3),log=str(log.relative_to(root)))
  results.append(row);print(json.dumps(row),flush=True)
(root/'confirmation.json').write_text(json.dumps(results,indent=2)+'\n')
assert all(r['exit']==r['expectedExit'] for r in results)
