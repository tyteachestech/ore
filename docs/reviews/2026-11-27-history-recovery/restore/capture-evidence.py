"""Capture final repro output. Red repros must exit 1; controls must exit 0."""
import json, resource, subprocess, time
from pathlib import Path
out=Path(__file__).resolve().parent
repo=out.parent.parent
cases=[
 ('conflict-cli',['python3','codex-out/restore/conflict-cli.py'],1),
 ('conflict-stash',['bun','codex-out/restore/git-state.ts','stash'],1),
 ('conflict-revert',['bun','codex-out/restore/git-state.ts','revert'],1),
 ('cut',['bun','codex-out/restore/cut.ts'],1),
 ('cut-probes',['bun','codex-out/restore/probes-cut.ts'],0),
 ('session-minimal',['bun','codex-out/restore/session-minimal.ts'],1),
 ('session-probes',['bun','codex-out/restore/session-minimal.ts','--probe'],1),
 ('agent-guidance',['bun','codex-out/restore/agent-guidance.ts'],1),
 ('day-reset',['bun','codex-out/restore/day.ts','reset'],1),
 ('day-checkout',['bun','codex-out/restore/day.ts','checkout'],1),
 ('membership-reset',['bun','codex-out/restore/membership.ts','reset'],0),
 ('membership-checkout',['bun','codex-out/restore/membership.ts','checkout'],0),
 ('snapshot-after',['bun','codex-out/restore/snapshot-after.ts'],0),
 ('orphans',['bun','codex-out/restore/orphans.ts'],0),
]
results=[]
for name,cmd,wanted in cases:
 before=resource.getrusage(resource.RUSAGE_CHILDREN);start=time.monotonic()
 r=subprocess.run(cmd,cwd=repo,text=True,capture_output=True,timeout=25)
 after=resource.getrusage(resource.RUSAGE_CHILDREN)
 cpu=(after.ru_utime+after.ru_stime)-(before.ru_utime+before.ru_stime)
 entry={'name':name,'command':cmd,'exit':r.returncode,'expected_exit':wanted,'wall_seconds':round(time.monotonic()-start,3),'cpu_seconds':round(cpu,3)}
 results.append(entry)
 (out/(name+'.log')).write_text('$ '+' '.join(cmd)+'\n'+r.stdout+r.stderr+f'\nexit: {r.returncode}\n')
 print(name,'expected',wanted,'actual',r.returncode,'CPU',round(cpu,3))
 assert r.returncode==wanted,entry
 assert cpu<30,entry
(out/'evidence-runs.json').write_text(json.dumps(results,indent=2)+'\n')
