# Sequential confirmations; each Bun process gets a 20-second wall timeout.
from pathlib import Path
import subprocess,time,json
root=Path(__file__).resolve().parents[2]
out=Path(__file__).resolve().parent
cases=[('turn-math',['turn-math.ts']),('paste-table',['paste-event.ts','table']),('matrix-duplicate',['matrix-duplicate.ts']),('paste-rowspan',['paste-table-shape.ts','rowspan']),('paste-paragraphs',['paste-table-shape.ts','paragraphs']),('matrix-delete',['matrix-delete.ts']),('link-space',['link-space.ts'])]
results=[]
import os
env={**os.environ,'ORE_NO_ENRICH':'1'}
for name,args in cases:
 for run in [2,3]:
  cmd=['bun',str(out/args[0]),*args[1:]]
  start=time.monotonic();p=subprocess.run(cmd,cwd=root,env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,timeout=20)
  log=out/'logs'/f'{name}-{run}.log';log.write_bytes(p.stdout)
  row={'name':name,'run':run,'command':cmd,'exit':p.returncode,'wall_ms':round((time.monotonic()-start)*1000),'log':str(log.relative_to(root))}
  results.append(row);print(json.dumps({k:row[k] for k in ['name','run','exit','wall_ms']}))
(out/'confirmations.json').write_text(json.dumps(results,indent=2)+'\n')
assert all(x['exit']==1 for x in results)
