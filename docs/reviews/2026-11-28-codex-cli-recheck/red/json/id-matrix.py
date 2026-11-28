"""CLI ID resolution and parser controls; sequential, 15 s per child, scratch only."""
from pathlib import Path
# Reuse the CLI harness definitions without executing its matrix or seed.
s=Path(__file__).with_name('matrix.py').read_text()
s=s[:s.index("item=ids['item']")].replace("ids=seed('matrix')","ids=seed('id-matrix')").replace("'matrix.json'","'id-matrix.json'")
exec(compile(s,'matrix-harness','exec'))
item,other,card,card2,ann,q,tried=[ids[k] for k in ['item','second','card','card2','annotation','question','tried']]
def unique(id,others):
 for n in range(1,len(id)+1):
  if all(not x.startswith(id[:n]) for x in others if x!=id):return id[:n]
ip=unique(item,[other]);cp=unique(card,[card2]);ap=unique(ann,[q,tried]);qp=unique(q,[ann,tried]);tp=unique(tried,[ann,q])
# Shared ambiguous timestamp prefixes, both present in each kind.
for ref in ['missing',item[:4]]:
 for args in [['show',ref],['notes',ref],['archive',ref],['opened',ref],['pin',ref],['status',ref,'done'],['edit',ref,'--title','Changed'],['highlight',ref,'--exact','Recall improves memory.','--intent','keep'],['questions','--item',ref],['due','--source',ref],['tables',ref,'--status'],['page-text',ref],['cut',ref,'--from','0','--to','2'],['diagram',ref,'test']]:run(args,expect=1)
for ref in ['missing',card[:4]]:
 for args in [['card','show',ref],['card','set',ref,'--question','New?'],['card','retire',ref],['card','restore',ref,'--state','draft'],['review',ref,'--rating','3','--confidence','2']]:run(args,expect=1)
for ref in ['missing',ann[:4]]:
 for args in [['annotate',ref,'--note','New'],['try',ref,'--when','Soon'],['tried',ref],['answer',ref,'--text','Idea'],['research',ref],['explain',ref]]:run(args,expect=1)
for args in [['show',ip],['notes',ip],['questions','--item',ip],['due','--source',ip],['card','show',cp],['card','set',cp,'--question','Changed question?'],['annotate',ap,'--note','prefix works'],['try',tp,'--when','Evening'],['tried',tp],['answer',qp,'--text','Recall helps']]:run(args)
run(['annotate',ann,'--status','deleted'])
run(['annotate',ap,'--status','open'])
run(['card','retire',cp]);run(['card','show',cp]);run(['card','set',cp,'--answer','Still editable'])
run(['archive',ip]);run(['show',ip]);run(['notes',ip]);run(['edit',ip,'--title','Archived but editable'])
# Repeated scalar flags follow parseArgs last-value semantics; boolean repeats are idempotent.
run(['due','--limit','1','--limit','2']);run(['due','--all','--all'])
run(['due','--limit','abc','--limit','1'])
run(['due','--limit','1','--limit','abc'],expect=1)
run(['review',card2,'--rating','0','--rating','3','--confidence','2'])
run(['settings','--model'],expect=1);run(['tutor','Hello','--files'],expect=1)
run(['chat','--set','--json'],stdin='{}',expect=1)
print(json.dumps({'runs':len(records),'flagged':[r['args'] for r in records if r['problems']]}))
