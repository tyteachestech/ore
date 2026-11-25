import json, os, subprocess, time, resource
from pathlib import Path
out = Path('codex-out/original')
cases = {
 'recovery-version': 'Doctor recovery must restore doc.md and the original from the same version',
 'slides-reimport': 'Reimport of equivalent PowerPoint relationships must preserve a highlight',
 'original-charset': 'The kept HTML original must remain readable in its own declared encoding',
 'passage-columns': 'Clicking the left-column passage must never mark unrelated words',
 'readd-original': 'Following Add the file again must restore a usable kept original',
 'original-assets': 'Open original must resolve the saved HTML figure',
 'doctor-original': 'Doctor must name the missing kept original and its recovery step',
 'reimport-handedit': 'Reimport must report and remove an ordinary highlight',
}
results=[]
def limit(): resource.setrlimit(resource.RLIMIT_CPU,(20,20))
for name, expected in cases.items():
 for n in range(1,4):
  start=time.monotonic(); before=resource.getrusage(resource.RUSAGE_CHILDREN)
  p=subprocess.run(['bun',str(out/(name+'.ts'))],env={**os.environ,'ORE_NO_ENRICH':'1'},stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,timeout=25,preexec_fn=limit)
  after=resource.getrusage(resource.RUSAGE_CHILDREN)
  (out/'logs'/f'confirm-{name}-{n}.log').write_text(p.stdout)
  row={'case':name,'run':n,'exit':p.returncode,'expected_red':p.returncode==1 and expected in p.stdout,'wall_ms':round((time.monotonic()-start)*1000),'cpu_ms':round(((after.ru_utime+after.ru_stime)-(before.ru_utime+before.ru_stime))*1000)}
  results.append(row)
(out/'confirmation.json').write_text(json.dumps(results,indent=2)+'\n')
print(json.dumps({'runs':len(results),'expected_red':sum(x['expected_red'] for x in results),'max_wall_ms':max(x['wall_ms'] for x in results),'max_cpu_ms':max(x['cpu_ms'] for x in results)},indent=2))
assert all(x['expected_red'] for x in results)
