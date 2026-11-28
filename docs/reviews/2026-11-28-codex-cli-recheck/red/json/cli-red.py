"""Self-seeding actual CLI confirmations. One child at a time; each has a 15 s deadline."""
import os,sys,json,hashlib,subprocess
from pathlib import Path
BASE=Path(__file__).resolve().parent
REPO=BASE.parent.parent
mode=sys.argv[1]
p=subprocess.run(['bun',str(BASE/'confirm-seed.ts'),mode],cwd=REPO,capture_output=True,text=True,timeout=15)
assert p.returncode==0,p.stderr
ids=json.loads(p.stdout); root=Path(ids['root'])
env={**os.environ,'ORE_LIBRARY':str(root),'ORE_NO_ENRICH':'1','ORE_DEVICE':'json-scout','PATH':str(BASE/'bin')+':'+os.environ['PATH']}
for k in ['ORE_AI','ORE_AI_MODEL','ORE_CLOCK_OFFSET_MS']:env.pop(k,None)
args={
 'course':['course','set','scout-course','--title','Changed despite failure','--skills','missing'],
 'edit':['edit',ids['item'],'--title','Changed despite failure','--skills','learning','--cards','{'],
 'annotate':['annotate',ids['annotation'],'--exact','Spacing practice helps retention.','--status','invalid'],
 'settings':['settings','--ai','codex','--model','bad model name'],
 'cards-partial':['edit',ids['item'],'--skills','learning','--cards',json.dumps({ids['c1']:[],ids['c2']:'learning'})],
 'cards-empty':['edit',ids['item'],'--skills','learning','--cards',json.dumps({ids['c1']:['']})],
 'prefix':['cards','--item',ids['item'][:10]],
 'try':['try','--skill','learning','--plan','Recall one idea'],
 'variant':['variant','reject',ids['c1'],'00001'],
 'error':['tutor','Recall','--earlier','{}'],
}[mode]
def snap():
 # Canonical data plus operational metadata, excluding only Git and the disposable index.
 return {str(p.relative_to(root)):hashlib.sha256(p.read_bytes()).hexdigest() for p in root.rglob('*') if p.is_file() and p.relative_to(root).parts[0] not in ['.git','.index']}
before=snap()
p=subprocess.run(['bun','packages/cli/src/ore.ts',*args,'--json'],cwd=REPO,env=env,capture_output=True,text=True,timeout=15)
after=snap();data=json.loads(p.stdout)
changed=sorted(k for k in before.keys()|after.keys() if before.get(k)!=after.get(k))
result={'mode':mode,'args':args+['--json'],'exit':p.returncode,'stdout':p.stdout,'stderr':p.stderr,'data':data,'changed':changed}
(BASE/'logs'/('cli-'+mode+'.json')).write_text(json.dumps(result,indent=2))
print('[DEEP]',json.dumps(result),flush=True)
if mode in ['course','edit','annotate','settings','cards-partial']:
 assert p.returncode!=0 and isinstance(data.get('error'),str)
 assert changed==[], 'failed command wrote library files'
elif mode in ['cards-empty','variant']:
 assert p.returncode!=0, 'invalid or ambiguous input was accepted and saved'
elif mode=='prefix':
 assert len(data)==2, 'unique source prefix falsely returned zero exercises'
elif mode=='try':
 assert isinstance(data.get('item_title'),str), 'Try answer is missing required item_title'
else:
 assert '--earlier' in data['error'] and 'JSON' in data['error'], 'failure does not say how to correct the input'
