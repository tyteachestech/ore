"""Actual CLI, sequential subprocesses only; every invocation has a 15s deadline."""
import os,sys,subprocess,json,hashlib,time
from pathlib import Path
BASE=Path(__file__).resolve().parent
REPO=BASE.parent.parent
def snap(root):
    return {str(p.relative_to(root)):hashlib.sha256(p.read_bytes()).hexdigest() for p in root.rglob('*') if p.is_file() and p.relative_to(root).parts[0] not in ['.git','.index','.ore']}
def seed(name):
    p=subprocess.run(['bun',str(BASE/'seed.ts'),name],cwd=REPO,text=True,capture_output=True,timeout=15)
    assert p.returncode==0,p.stderr
    return json.loads(p.stdout)
ids=seed('matrix')
root=Path(ids['root'])
env={**os.environ,'ORE_LIBRARY':str(root),'ORE_NO_ENRICH':'1','ORE_DEVICE':'json-scout','PATH':str(BASE/'bin')+':'+os.environ['PATH']}
for k in ['ORE_AI','ORE_AI_MODEL','ORE_CLOCK_OFFSET_MS']:env.pop(k,None)
records=[]
def run(args,stdin=None,expect=0,text=False,schema=None):
    before=snap(root); start=time.monotonic()
    p=subprocess.run(['bun','packages/cli/src/ore.ts',*args,*([] if text else ['--json'])],cwd=REPO,env=env,input=stdin,text=True,capture_output=True,timeout=15)
    after=snap(root); data=None; parse_error=None
    if not text:
        try:data=json.loads(p.stdout)
        except Exception as e:parse_error=str(e)
    problems=[]
    if (p.returncode==0)!=(expect==0):problems.append('exit mismatch')
    if parse_error:problems.append('invalid stdout JSON')
    changed=[k for k in before.keys()|after.keys() if before.get(k)!=after.get(k)]
    if expect!=0 and changed:problems.append('failure wrote canonical files')
    if schema and p.returncode==0:
        rows=data if isinstance(data,list) else [data]
        for row in rows:
            for key,typ in schema.items():
                if not isinstance(row.get(key),typ):problems.append('shape: '+key)
    r=dict(args=args,exit=p.returncode,stdout=p.stdout,stderr=p.stderr,data=data,changed=changed,problems=problems,seconds=round(time.monotonic()-start,3))
    records.append(r)
    (BASE/'matrix.json').write_text(json.dumps(records,indent=2))
    print(('FAIL ' if problems else 'PASS ')+json.dumps(args)+' '+str(problems),flush=True)
    return data
item=ids['item']; card=ids['card']; a=ids['annotation']; q=ids['question']; t=ids['tried']; course=ids['course']
doc={'id':str,'title':str,'type':str,'body':str,'prequestions':list,'annotations':list,'path':str,'dir':str}
cardshape={'id':str,'question':str,'answer':str,'rubric':list,'history':dict,'state':str}
tryshape={'id':str,'item':str,'item_title':str,'intent':str,'status':str}
for args,schema in [(['ls'],{'id':str,'dir':str,'path':str,'skills':list,'has_notes':bool}),(['show',item],doc),(['show',item,'--annotations'],doc),(['cards'],None),(['card','show',card],cardshape),(['card','show',card,'--review'],cardshape),(['card','set',card,'--question','What improves memory?'],cardshape),(['due','--all','--start'],{'id':str,'skills':list,'topics':list,'retrievability':(int,float)}),(['stats'],None),(['stats','--skill','learning'],{'strength':dict,'growth':list}),(['today'],None),(['goal'],None),(['settings'],None),(['models','claude'],{'id':str,'label':str}),(['usage'],{'months':dict}),(['inbox'],None),(['feed'],{'feeds':list,'posts':list}),(['course','lessons',course],{'id':str,'part':int,'archived':bool}),(['tries','--skill','learning'],tryshape),(['tries','--now'],tryshape),(['questions'],{'id':str,'answers':list,'matches':list}),(['notes',item],{'text':str,'path':str,'dir':str}),(['backlinks',item],None),(['dig','learning'],None),(['dig','--ready'],None),(['diagram',item,'scout'],{'name':str,'path':str}),(['diagram',item,'--new'],None),(['tables','--status'],None),(['tables',item,'--status'],None),(['remind'],None),(['search','Recall'],None),(['search','Recall','--sources'],None),(['optimize'],None),(['reindex'],None),(['doctor'],None)]:run(args,schema=schema)
run(['try',t,'--plan','Recall each evening'],schema=tryshape)
run(['tried',t,'--again','--text','Remembered one idea'],schema=tryshape)
run(['try','--skill','learning','--plan','Practice spacing'],schema=tryshape)
run(['settings','--job','grade','--ai','codex','--model','test-model'])
run(['settings','--job','grade','--ai','default'])
run(['settings','--ai','claude','--model','sonnet'])
run(['inbox','--add','https://example.invalid/article','--skill','learning'])
waiting=run(['inbox']); wid=waiting[0]['id']
run(['inbox','--remove',wid,'--keep']);run(['inbox','--restore',wid]);run(['inbox','--remove',wid])
run(['inbox','--add-file',str(BASE/'seed.ts'),'--name','code.ts'])
waiting=run(['inbox']);run(['inbox','--remove',waiting[0]['id']])
run(['notes',item,'--set','My observation.']);run(['notes',item,'--append','Another observation.','--heading','Practice']);run(['notes','--skill','learning','--set','A skill note'])
run(['diagram',item,'scout','--set'],stdin='{"type":"excalidraw","elements":[]}')
run(['diagram',item,'scout','--link']);run(['diagram',item,'scout','--rename','scout-two']);run(['diagram',item,'scout-two'])
run(['prequestion',item,'1','--before','Not sure']);run(['prequestion',item,'1','--after','Recall helps','--confidence','2'])
run(['recall',item,'--text','Recall improves memory.'])
run(['scope',item,'--reached','1000'])
run(['answer',q,'--text','Space practice','--item',item,'--quote','Spacing practice helps retention.'])
run(['match',ids['second'],q]);run(['questions','--item',ids['second']]);run(['match',ids['second'],q,'--drop'])
run(['card','cell',item,'--row','Recall','--column','Benefit','--answer','Memory'])
run(['card','figure',item,'--src','assets/figure.svg','--box','0,0,0.5,0.5','--answer','Rectangle'])
run(['course','set',course,'--title','New course title','--skills','learning'])
arch=run(['course','archive',course]);run(['course','archive',course,'--undo','--lessons',','.join(arch['lessons'])])
run(['skills','set','learning','--goal','Explain learning methods'])
run(['dig','learning','--text','Recall helps memory.']);run(['dig','learning','--done'])
ds=run(['dig','learning']);run(['dig','learning','--drop',ds['last']['id']])
s=run(['session','start']);r=run(['review',card,'--rating','3','--confidence','2','--session',s['id']]);run(['session','end',s['id']]);run(['session','reopen',s['id']]);run(['session','end',s['id']]);run(['review',card,'--undo',r['ts']])
run(['card','retire',card]);run(['card','show',card],schema=cardshape);run(['card','restore',card,'--state','draft'])
run(['status',item,'done']);run(['opened',item]);run(['pin',item]);run(['pin',item,'--undo']);run(['archive',item]);run(['show',item],schema=doc);run(['archive',item,'--undo'])
run(['edit',item,'--author','Scout','--priority','P1'])
run(['suggested-skill',item,'--dismiss'])
# Pure input errors, including newer flags/branches. No network or real AI.
for args in [
 ['due','--limit=-1'],['due','--limit','abc'],['due','--limit'],['due','--source','missing'],
 ['usage','--bad'],['course','set',course,'--skills','missing'],['course','set',course,'--title',''],
 ['try','--skill','missing','--plan','x'],['try','--skill','learning','--plan',' '],['tried',t,'--again','--next','new plan'],
 ['tried',t,'--line','--text','x'],['dig','missing'],['dig','learning','--text',''],
 ['settings','--job','missing','--ai','claude'],['settings','--job','grade'],['settings','--job','grade','--ai','codex','--model','bad model'],
 ['review',card,'--rating','0','--confidence','2'],['review',card,'--rating','9','--confidence','2'],['review',card,'--rating','3','--confidence','4'],
 ['prequestion',item,'1','--after','a','--confidence','4'],['goal','--reminder','25:90'],['pin',item,'--at','yesterday'],
 ['edit',item,'--skills','learning','--cards','{'],['edit',item,'--skills','learning','--cards','{"x":["missing"]}'],
 ['tutor','hi','--earlier','{'],['tutor','hi','--earlier','{}'],['tutor','hi','--earlier','[null]'],['tutor','hi','--files','{}'],
 ['ask-library','hi','--earlier','{}'],['ask-library','hi','--earlier','[null]'],
 ['diagram',item,'bad/name'],['diagram',item,'scout','--set'],['card','cell',item,'--row','Recall','--column','Benefit','--answer',''],
 ['inbox','--add',''],['inbox','--add','https://example.invalid','--skill','missing'],
 ['cut',item,'--from','abc'],['cut',item,'--from=-1','--to','3'],['page-text','missing'],['tables','missing','--status'],
 ['chat','missing'],['chat','--set'],['feed','set','missing','--name','x'],['feed','arrange','{}'],['feed','restore','null'],['models','bogus']
]:run(args,expect=1,stdin='not json' if '--set' in args else None)
for args in [['settings','--job','grade'],['tutor','hi','--earlier','{}'],['course','set',course,'--skills','missing']]:run(args,expect=1,text=True)
print(json.dumps({'commands':len(records),'flagged':sum(bool(r['problems']) for r in records)}))
