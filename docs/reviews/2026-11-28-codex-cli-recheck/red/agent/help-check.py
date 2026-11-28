import json,pathlib,subprocess,resource,os
out=pathlib.Path('codex-out/agent'); inv=json.loads((out/'inventory.json').read_text()); logs=[]
def limit(): resource.setrlimit(resource.RLIMIT_CPU,(25,25))
for args in [['--help']]+[[r['name'],'--help'] for r in inv]:
 p=subprocess.run(['bun','packages/cli/src/ore.ts',*args],text=True,capture_output=True,timeout=28,preexec_fn=limit,env={**os.environ,'ORE_LIBRARY':str(out.resolve()/'libs/cli-day'),'ORE_NO_ENRICH':'1','PATH':str(out.resolve()/'bin')+':'+os.environ['PATH']})
 logs.append({'args':args,'exit':p.returncode,'stdout':p.stdout,'stderr':p.stderr})
 assert p.returncode==0,(args,p.stderr)
(out/'help-output.json').write_text(json.dumps(logs,indent=2)); print('PASS',len(logs),'help invocations')
