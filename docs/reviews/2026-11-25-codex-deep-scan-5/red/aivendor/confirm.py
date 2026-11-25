from pathlib import Path
import subprocess,json,time,sys
base=Path(__file__).resolve().parent
root=base.parent.parent
logs=base/'logs';logs.mkdir(exist_ok=True)
cases=[
 ('ask-stamp',['ask-provenance.tsx'],1),
 ('dig-stamp',['small-paths.ts','dig-stamps'],1),
 ('stop',['stop-before-start.tsx'],1),
 ('recall-race',['small-paths.ts','recall-race'],1),
 ('check-race',['small-paths.ts','check-race'],1),
 ('dig-close',['small-paths.ts','dig-close'],1),
 ('exit',['adapter-faults.ts'],1),
 ('blank',['reply-edges.ts','blank'],1),
]
controls=[('stop-normal',['stop-before-start.tsx','normal'],0),('recall-unchanged',['small-paths.ts','recall-race','control'],0),('check-unchanged',['small-paths.ts','check-race','control'],0),('dig-open',['small-paths.ts','dig-close','control'],0),('dig-same-model',['small-paths.ts','dig-stamps','control'],0),('line-text',['reply-edges.ts','blank','control'],0),('sessions',['reply-edges.ts','sessions'],0),('precedence',['matrix.ts','precedence'],0),('transport',['matrix.ts','transport'],0)]
results=[]
for name,args,expected in cases+controls:
 for n in range(1,4 if expected else 2):
  cmd=['bun',str(Path('codex-out/aivendor')/args[0]),*args[1:]]
  start=time.monotonic();r=subprocess.run(cmd,cwd=root,capture_output=True,text=True,timeout=15)
  output=r.stdout+r.stderr;(logs/f'{name}-{n}.txt').write_text(output)
  valid=r.returncode==expected and ('[DEEP] FAIL' in output if expected else '[DEEP] FAIL' not in output)
  results.append({'case':name,'run':n,'command':' '.join(cmd),'exit':r.returncode,'expected':expected,'ok':valid,'seconds':round(time.monotonic()-start,3)})
  print(f'[DEEP] {name} {n}: exit {r.returncode}, expected {expected}, {"confirmed" if valid else "UNEXPECTED"}')
(base/'confirm-results.json').write_text(json.dumps(results,indent=2)+'\n')
sys.exit(0 if all(r['ok'] for r in results) else 1)
