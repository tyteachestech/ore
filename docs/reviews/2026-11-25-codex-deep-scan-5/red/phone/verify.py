"""Run scout probes sequentially. Each child is one short-lived Bun process."""
import json, os, subprocess, time
from pathlib import Path
folder = Path(__file__).resolve().parent
repo = folder.parent.parent
cases = [
 ('storage-read-failure','failed',1),('storage-read-failure','healthy',0),('storage-read-failure','retry',0),
 ('waiting-file-undo','file',1),('waiting-file-undo','link',0),
 ('title-undo','list',1),('title-undo','reader',0),
 ('shared-text','md',1),('shared-text','vtt',1),('shared-text','txt',0),('shared-text','bytes',0),
 ('settings-failed-save','overlap',1),('settings-failed-save','serial',0),
 ('sync-inflight','inflight',1),('sync-inflight','complete',0),
 ('stat-collision','same',1),('stat-collision','later',0),('stat-collision','longer',0),
 ('stat-collision','natural-burst',1),
 ('reminder-controls','',0),('appearance-controls','seeded',0),('appearance-controls','default',0),
]
env = dict(os.environ, ORE_NO_ENRICH='1', TZ='America/Los_Angeles')
results=[]
for name, mode, expected in cases:
    codes=[]
    for run in range(1,4):
        command=['bun',f'codex-out/phone/{name}.ts']+([mode] if mode else [])
        start=time.monotonic()
        proc=subprocess.run(command,cwd=repo,env=env,text=True,capture_output=True,timeout=20)
        elapsed=round(time.monotonic()-start,3)
        log=folder/'logs'/f'{name}-{mode or "all"}-{run}.txt'
        log.write_text('$ TZ=America/Los_Angeles ORE_NO_ENRICH=1 '+' '.join(command)+'\n'+proc.stdout+proc.stderr+f'\nexit={proc.returncode}; wall_seconds={elapsed}\n')
        results.append(dict(name=name,mode=mode,run=run,expected=expected,exit=proc.returncode,seconds=elapsed,log=str(log.relative_to(repo))))
        codes.append(proc.returncode)
    print(f'{name} {mode or "all"}: {codes}; expected {expected}',flush=True)
(folder/'logs'/'verification.json').write_text(json.dumps(results,indent=2)+'\n')
assert all(r['exit']==r['expected'] for r in results), 'Unexpected probe result: inspect logs/verification.json'
print(f'All {len(results)} runs matched expected red/control results; max wall {max(r["seconds"] for r in results)}s')
