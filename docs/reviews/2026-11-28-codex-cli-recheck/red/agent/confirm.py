import json,subprocess,pathlib,resource,time
out=pathlib.Path('codex-out/agent');results=[]
reds=['red-heredoc.ts','red-answer-id.ts','red-guide-stamp.ts','red-guide-review.ts','red-guide-figure.ts','red-inbox-retry.ts','red-guide-finish.ts','red-dig-note.ts']
def limit():resource.setrlimit(resource.RLIMIT_CPU,(25,25))
for name in reds:
 for n in range(1,4):
  start=time.monotonic();p=subprocess.run(['bun',str(out/name)],capture_output=True,text=True,timeout=28,preexec_fn=limit);log=p.stdout+p.stderr;(out/'logs'/f'{name[:-3]}-confirm-{n}.log').write_text(log);assert p.returncode==1 and 'AssertionError' in log,(name,p.returncode,log);results.append({'script':name,'run':n,'exit':p.returncode,'seconds':round(time.monotonic()-start,3),'signal':[x for x in log.splitlines() if x.startswith('[DEEP]')]})
for name in ['probe-causes.ts','probe-review-inbox.ts','probe-finish-figure.ts','probe-dig.ts','probe-heredoc.ts']:
 p=subprocess.run(['bun',str(out/name)],capture_output=True,text=True,timeout=28,preexec_fn=limit);log=p.stdout+p.stderr;(out/'logs'/f'{name[:-3]}-confirmed.log').write_text(log);assert p.returncode==0,(name,log);results.append({'script':name,'exit':p.returncode,'signal':log.splitlines()})
(out/'confirmation.json').write_text(json.dumps(results,indent=2));print('PASS: 8 red scripts each reproduced their intended assertion 3/3; 5 causal-control scripts passed. No fixes applied.')
