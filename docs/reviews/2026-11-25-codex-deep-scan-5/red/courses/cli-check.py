from pathlib import Path
import json,os,subprocess
state=json.loads(Path('codex-out/courses/lifecycle.json').read_text())
env={**os.environ,'ORE_LIBRARY':state['root'],'ORE_NO_ENRICH':'1','PATH':str(Path('codex-out/courses/bin').resolve())+':'+os.environ['PATH']}
base=['bun','packages/cli/src/ore.ts']
def run(name,args,ok=0):
 r=subprocess.run(base+args+['--json'],env=env,text=True,capture_output=True,timeout=15)
 Path(f'codex-out/courses/logs/cli-{name}.log').write_text('$ ORE_LIBRARY='+state['root']+' ORE_NO_ENRICH=1 '+' '.join(base+args+['--json'])+'\n'+r.stdout+r.stderr+f'\nexit={r.returncode}\n')
 assert r.returncode==ok,(name,r.returncode,r.stdout,r.stderr)
 print(name,'exit',r.returncode,r.stdout.strip()[:160])
 return json.loads(r.stdout) if ok==0 else None
rows=run('lessons',['course','lessons',state['course']]);assert [x['part'] for x in rows]==[1,2,3]
run('rename',['course','set',state['course'],'--title','CLI renamed'])
changes=run('archive',['course','archive',state['course']]);assert len(changes['lessons'])==2
run('archive-undo',['course','archive',state['course'],'--undo','--lessons',','.join(changes['lessons'])])
rows=run('lessons-after-undo',['course','lessons',state['course']]);assert [x['archived'] for x in rows]==[False,True,False]
run('stats',['stats','--skill',state['teaching']])
folder=Path('codex-out/courses/libs/folder-input');folder.mkdir(exist_ok=True)
(folder/'01.md').write_text('# First lesson\n\nA complete first lesson.\n')
(folder/'02.md').write_text('# Second lesson\n\nA complete second lesson.\n')
run('folder-course',['add',str(folder.resolve()),'--course','--no-enrich'],1)
print('[DEEP] PASS CLI lesson order, rename, selective archive inverse, skill stats; local-folder course refused (unsupported input)')
