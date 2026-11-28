import os,json,subprocess,shutil,pathlib,resource
ROOT=pathlib.Path.cwd(); OUT=ROOT/'codex-out/agent'; LIB=OUT/'libs/cli-day'
shutil.rmtree(LIB,ignore_errors=True)
env={**os.environ,'ORE_LIBRARY':str(LIB),'ORE_NO_ENRICH':'1','ORE_DEVICE':'agent-scout','ORE_AI':'claude','PATH':str(OUT/'bin')+':'+os.environ['PATH'],'TMPDIR':str(OUT/'tmp'),'SCOUT_REPLY':str(OUT/'reply-cli.json')}
log=[]
def limit(): resource.setrlimit(resource.RLIMIT_CPU,(25,25))
def run(*args,stdin=None,ok=True):
 p=subprocess.run(['bun','--preload',str(OUT/'network.ts'),'packages/cli/src/ore.ts',*args,'--json'],input=stdin,text=True,capture_output=True,env=env,timeout=28,preexec_fn=limit)
 log.append({'args':list(args),'exit':p.returncode,'stdout':p.stdout,'stderr':p.stderr})
 (OUT/'cli-day.json').write_text(json.dumps(log,indent=2))
 if ok: assert p.returncode==0,(args,p.stdout,p.stderr)
 return json.loads(p.stdout)
def reply(data): (OUT/'reply-cli.json').write_text(json.dumps(data))
run('init')
a=run('add','--stdin','--no-enrich',stdin='# Agent pasted source\n\nRetrieval makes the memory accessible. Spacing retrieval across days strengthens later recall.\n')
u=run('add','https://scout.invalid/article','--no-enrich')
run('edit',a['id'],'--skills','learning')
h=run('highlight',a['id'],'--exact','Retrieval makes the memory accessible.','--intent','card')
reply({'prequestions':['Why does retrieval help?','How would you space practice?'],'skills':['learning'],'suggested_skill':None,'topics':[{'slug':'spaced-practice','name':'Spaced practice','summary':'Spacing practice.'}],'drafts':[{'annotation':h['id'],'from_notes':False,'prequestion':None,'kind':'prompt','content_type':'concept','question':'How does retrieval help later recall?','answer':'Retrieval makes the memory accessible.','rubric':['Retrieval improves access.','Practice occurs across days.'],'topics':['spaced-practice']}]})
r=run('enrich',a['id']); c=r[0]['cards'][0]['id'] if isinstance(r,list) else r['cards'][0]['id']
run('show',a['id']); run('card','show',c)
run('prequestion',a['id'],'1','--before','No idea')
run('prequestion',a['id'],'1','--after','Retrieval improves access.')
run('recall',a['id'],'--text','I can space retrieval across days.')
run('notes',a['id'],'--append','I will explain it tomorrow.','--heading','Use and connections')
s=run('session','start')
run('due','--start','--skill','learning','--limit','12')
# Own-source override exposes today's fixture draft for the remaining grading mechanics.
run('due','--source',a['id'])
reply({'rating':3,'gaps':[],'feedback':'The explanation covers the points.','covered':[True,True],'evidence':['Retrieval improves access.','Practice occurs across days.']})
g=run('grade',c,'--answer','Retrieval improves access. Practice occurs across days.')
assert list((LIB/'reviews').glob('*.jsonl'))==[], 'grading must not log a rating'
by=' '.join(g['ai'][k] for k in ['vendor','model','prompt_version'])
r=run('review',c,'--rating','2','--confidence','2','--answer','Retrieval improves access. Practice occurs across days.','--ai-rating',str(g['rating']),'--ai-by',by,'--elapsed-ms','12000','--session',s['id'],'--finishing')
assert r['rating']==2
run('card','set',c,'--question','Why does retrieval improve access to a memory?')
run('card','show',c)
q=run('highlight',a['id'],'--exact','Spacing retrieval across days strengthens later recall.','--intent','question','--note','How many days apart?')
run('answer',q['id'],'--text','I will use several days.','--item',u['id'],'--done')
run('questions','--skill','learning')
run('archive',a['id']); run('ls','--archived'); run('archive',a['id'],'--undo')
run('session','end');run('stats','--skill','learning')
reply({'reply':'Try retrieving the main point before looking at it.','citations':[],'general':True,'hint':False,'card':None,'exercise':None,'steps':[],'covered':[],'evidence':[],'title':'Retrieval practice'})
run('tutor','How can I practice?','--item',a['id'])
run('usage'); run('models','claude');run('models','codex')
# Test job settings without the evaluation override.
env.pop('ORE_AI');run('settings','--job','grade','--ai','codex','--model','gpt-5.4-mini');run('settings');run('settings','--job','grade','--ai','default')
run('doctor')
(OUT/'cli-day-ids.json').write_text(json.dumps({'source':a['id'],'urlSource':u['id'],'card':c,'question':q['id']}))
print('PASS:',len(log),'sequential real CLI calls; stub AI; grade wrote no review; explicit learner rating 2 retained over AI proposal 3.')
