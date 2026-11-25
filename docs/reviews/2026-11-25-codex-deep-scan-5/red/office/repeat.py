from pathlib import Path
import subprocess, os, time, resource, json
root=Path(__file__).resolve().parent
repo=root.parent.parent
cases=[('word','merged'),('word','equation'),('word','outline'),('slides','table'),('slides','missing'),('sheets','formula'),('sheets','time'),('sheets','missing'),('notebooks','attachment'),('notebooks','error'),('notebooks','html'),('notebooks','ordered'),('text','relative'),('rtf',None),('ocr-failure',None)]
env=dict(os.environ,ORE_NO_ENRICH='1',PATH=str(root/'bin')+':'+os.environ['PATH'],TMPDIR=str(root/'tmp'))
def limit():resource.setrlimit(resource.RLIMIT_CPU,(25,25))
results=[]
for name,arg in cases:
 for turn in range(1,4):
  cmd=['bun',f'codex-out/office/{name}.ts']+([arg] if arg else [])
  start=time.monotonic();p=subprocess.run(cmd,cwd=repo,env=env,capture_output=True,text=True,timeout=25,preexec_fn=limit)
  duration=round((time.monotonic()-start)*1000)
  label=name+('-'+arg if arg else '')
  (root/'logs'/f'{label}-run{turn}.log').write_text('$ '+' '.join(cmd)+'\n'+p.stdout+p.stderr+f'[DEEP] exit={p.returncode} elapsed_ms={duration}\n')
  results.append(dict(case=label,run=turn,exit=p.returncode,ms=duration))
  print(label,turn,p.returncode,f'{duration}ms')
  if p.returncode!=1 or '[DEEP] FAIL: ASSERT:' not in p.stdout+p.stderr:raise SystemExit('Unexpected outcome; inspect log')
(root/'logs/repetitions.json').write_text(json.dumps(results,indent=2)+'\n')
