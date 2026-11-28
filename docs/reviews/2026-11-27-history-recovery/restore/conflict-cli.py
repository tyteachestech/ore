"""One Bun process at a time; a read-only CLI call must preserve an unresolved merge."""
import json, os, subprocess, sys
from pathlib import Path
out=Path(__file__).resolve().parent
repo=out.parent.parent
subprocess.run(['bun',str(out/'git-state.ts'),'merge','--prepare'],cwd=repo,check=True,timeout=20)
m=json.loads((out/'conflict-manifest.json').read_text())
env=dict(os.environ,ORE_LIBRARY=m['root'],ORE_NO_ENRICH='1',PATH=str(out/'bin')+':'+os.environ['PATH'])
cmd=['bun','packages/cli/src/ore.ts','notes',m['item'],'--json']
r=subprocess.run(cmd,cwd=repo,env=env,text=True,capture_output=True,timeout=20)
print('CLI: bun packages/cli/src/ore.ts notes <source-id> --json')
print('CLI exit:',r.returncode)
assert r.returncode==0,(r.stdout,r.stderr)
print('CLI returned conflict markers:', '<<<<<<< HEAD' in json.loads(r.stdout)['text'])
def git(*args):
 return subprocess.check_output(['git',*args],cwd=m['root'],text=True).strip()
print('HEAD advanced:',git('rev-parse','HEAD')!=m['head'])
print('Unmerged index entries:',len(git('ls-files','-u').splitlines()))
print('Conflict markers committed:', '<<<<<<< HEAD' in git('show','HEAD:'+m['path']))
ok=git('rev-parse','HEAD')==m['head'] and bool(git('ls-files','-u'))
print(('PASS' if ok else 'FAIL')+' reading a note must not resolve and commit a pending recovery conflict')
sys.exit(0 if ok else 1)
