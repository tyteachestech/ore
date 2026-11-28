import os,json,subprocess,pathlib,resource
ROOT=pathlib.Path.cwd();OUT=ROOT/'codex-out/agent'; LIB=OUT/'libs/cli-day';ids=json.loads((OUT/'cli-day-ids.json').read_text());logs=[]
env={**os.environ,'ORE_LIBRARY':str(LIB),'ORE_NO_ENRICH':'1','ORE_DEVICE':'agent-scout','ORE_AI':'claude','SCOUT_REPLY':str(OUT/'reply-extra.json'),'PATH':str(OUT/'bin')+':'+os.environ['PATH'],'TMPDIR':str(OUT/'tmp')}
def limit():resource.setrlimit(resource.RLIMIT_CPU,(25,25))
def run(*args,stdin=None):
 p=subprocess.run(['bun','--preload',str(OUT/'network.ts'),'packages/cli/src/ore.ts',*args,'--json'],input=stdin,text=True,capture_output=True,env=env,timeout=28,preexec_fn=limit);logs.append({'args':args,'stdin':stdin,'exit':p.returncode,'stdout':p.stdout,'stderr':p.stderr});(OUT/'extra-day.json').write_text(json.dumps(logs,indent=2));assert p.returncode==0,(args,p.stdout,p.stderr);return json.loads(p.stdout)
item=ids['source']; c=ids['card']; q=ids['question']
n=run('diagram',item,'--new')['name'];run('diagram',item,n,'--set',stdin=json.dumps({'type':'excalidraw','version':2,'elements':[]}));run('diagram',item,n);run('diagram',item,n,'--link');run('diagram',item,n,'--rename','my-diagram');note=run('notes',item);run('notes',item,'--set',note['text'].replace(n+'.excalidraw','my-diagram.excalidraw'),'--base',note['text']);run('diagram',item,'my-diagram')
chat={'id':'scout-chat','title':'My study chat','carry':[],'turns':[{'id':'one','message':'How do I retrieve?'}]}
run('chat','scout-chat','--set','--merge',stdin=json.dumps(chat));run('chat','scout-chat');run('chat');removed=run('chat','scout-chat','--delete');run('chat','scout-chat','--set','--keep-time',stdin=json.dumps(removed))
(OUT/'reply-extra.json').write_text(json.dumps({'sources':[{'title':'Fixture source '+str(i),'url':'https://scout.invalid/'+('article' if i==1 else 'article'+str(i)),'site':'Scout','type':'article','why':'Practice evidence','minutes':2} for i in range(1,4)]}))
r=run('research',q);assert len(r['sources'])==3
run('add',r['sources'][0]['url'],'--for',q,'--no-enrich');run('questions','--skill','learning')
for args in [('ls',),('search','retrieval'),('stats','--skill','learning'),('skills',),('cards',),('show',item),('notes',item),('notes','--skill','learning'),('backlinks',item),('backlinks','--skill','learning')]:run(*args)
(OUT/'reply-extra.json').write_text(json.dumps({'found':False,'answer':'This fixture has no further evidence.','citations':[]}));run('ask-library','retrieval')
print('PASS',len(logs),'additional sequential real CLI calls, stubbed research, diagrams, chat lifecycle, and library questions.')
