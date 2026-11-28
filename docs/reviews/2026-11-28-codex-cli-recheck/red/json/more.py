"""Continue successful command contracts and payload errors on a fresh scratch seed."""
exec((__import__('pathlib').Path(__file__).parent/'matrix.py').read_text().split('ids=seed(')[0])
ids=seed('more');root=Path(ids['root'])
env={**os.environ,'ORE_LIBRARY':str(root),'ORE_NO_ENRICH':'1','ORE_DEVICE':'json-scout','PATH':str(BASE/'bin')+':'+os.environ['PATH']}
for k in ['ORE_AI','ORE_AI_MODEL','ORE_CLOCK_OFFSET_MS']:env.pop(k,None)
records=[]
src=(BASE/'matrix.py').read_text()
exec(src[src.index('def run('):src.index("item=ids['item']")].replace("'matrix.json'","'more.json'"))
item=ids['item'];card=ids['card'];t=ids['tried'];q=ids['question'];ann=ids['annotation']
def ai(args,reply,schema=None):
    env['SCOUT_REPLY']=json.dumps(reply)
    r=run(args,schema=schema)
    del env['SCOUT_REPLY'];return r
run(['add','--stdin','--no-enrich'],stdin='# Local added\n\nWords added through the CLI.')
run(['snippet','--text','A selected passage','--no-enrich','--intent','keep'])
run(['highlight',item,'--exact','Spacing practice helps retention.','--intent','keep'])
run(['annotate',ann,'--note','My note'])
run(['chat','--attach',str(BASE/'seed.ts')])
chat={'id':'scout-chat','title':'Memory conversation','carry':[],'turns':[{'id':'turn-one','message':'How do I practice?','reply':'Recall first.'}]}
run(['chat','scout-chat','--set'],stdin=json.dumps(chat))
run(['chat']);run(['chat','scout-chat'])
run(['chat','scout-chat','--set','--merge'],stdin=json.dumps(chat))
deleted=run(['chat','scout-chat','--delete']);run(['chat','scout-chat','--set','--keep-time'],stdin=json.dumps(deleted))
suggestion=run(['suggested-skill',item,'accept']);run(['suggested-skill',item,'undo',json.dumps(suggestion['undo'])]);run(['suggested-skill',item,'dismiss']);run(['suggested-skill',item,'undo',json.dumps({'suggestion':{'name':'Memory methods'}})])
skill=run(['skills','add','Scout skill']);run(['skills','set',skill['id'],'--name','Scout renamed','--priority','P2']);run(['skills','archive',skill['id']]);run(['skills','archive',skill['id'],'--undo'])
removed=run(['skills','rm',skill['id']]);run(['skills','restore',json.dumps(removed['removed'])]);run(['skills'])
cut=run(['cut',item,'--from','12','--to','35']);run(['cut',item,'--undo',cut['id']]);run(['cut',item,'--redo',cut['id']]);run(['cut',item,'--undo',cut['id']])
page=run(['page-text',item]);run(['page-text',item,'--undo',page['id']]);run(['page-text',item,'--redo',page['id']]);run(['page-text',item,'--undo',page['id']])
run(['reimport',ids['second']])
ai(['grade',card,'--answer','Recall'],{'rating':3,'gaps':[],'feedback':'The idea is here.','covered':[],'evidence':[]},{'card':str,'rating':int,'gaps':list,'feedback':str,'covered':list,'evidence':list,'ai':dict})
ai(['ask',card,'--message','Why?'],{'reply':'Recall makes the memory available again.','card':None},{'card':str,'reply':str,'session':str,'ai':dict})
ai(['explain',item,'--exact','Recall'],{'here':'Remembering without looking.','general':'Retrieving something learned.'},{'here':str,'general':str,'ai':dict})
run(['key-points',item])
run(['prequestion',item,'1','--after','Recall helps memory'])
ai(['check',item,'1'],{'covered':[True]},{'q':str,'check':dict})
run(['check',item,'1','--covered','0'])
run(['recall',item,'--text','Recall helps memory'])
ai(['recall',item,'--feedback'],{'feedback':'You recalled the first idea.','questions':[{'n':1,'feedback':'The main point is here.'}],'missed':[],'section_lines':None},{'item':str,'feedback':str,'questions':list,'missed':list})
ai(['ask-library','Recall'],{'found':True,'answer':'Recall improves memory. [1]','citations':[{'passage':'P1','quote':'Recall improves memory.'}]},{'question':str,'found':bool,'answer':str,'citations':list})
tutor={'reply':'Try recalling one idea.','citations':[],'general':True,'hint':False,'card':None,'exercise':None,'steps':[],'covered':[],'evidence':[],'title':'Memory practice'}
ai(['tutor','How should I practice?','--item',item],tutor,{'reply':str,'citations':list,'marks':list,'steps':list,'ai':dict})
ai(['research',q],{'sources':[{'title':f'Source {i}','url':f'https://example.invalid/{i}','site':'Fixture','type':'article','why':'Explains recall.','minutes':3} for i in range(3)]},{'sources':list})
run(['tutor-card',item,'--card',json.dumps({'kind':'card','content_type':'fact','question':'What strengthens memory?','answer':'Recall','rubric':[]}),'--ai',json.dumps({'vendor':'claude','model':'fixture','prompt_version':'tutor@1'})])
run(['tried',t,'--text','Remembered an idea.'])
ai(['tried',t,'--line'],{'line':'Keep the same cue next time.'},{'id':str,'line':dict})
enrich={'prequestions':['Why recall?','Why space practice?'],'skills':['learning'],'suggested_skill':None,'topics':[{'slug':'recall','name':'Recall','summary':'Practice recall.'}],'drafts':[],'question_matches':[]}
ai(['enrich',ids['second']],enrich)
run(['catch-up'])
run(['usage'])
# Arrays with the wrong JSON shape should explain the accepted input.
for args in [['tutor','hi','--earlier','{}'],['tutor','hi','--files','{}'],['tutor','hi','--earlier','[null]'],['ask-library','hi','--earlier','{}'],['ask-library','hi','--earlier','[null]']]:run(args,expect=1)
print(json.dumps({'commands':len(records),'flagged':sum(bool(r['problems']) for r in records)}))
