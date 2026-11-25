#!/usr/bin/python3
import sys,os,json,time,pathlib
base=pathlib.Path(__file__).resolve().parent.parent
queue=json.loads((base/'queue.json').read_text())
n=int((base/'count').read_text()); (base/'count').write_text(str(n+1))
case=queue[min(n,len(queue)-1)]
a=sys.argv[1:]; vendor=pathlib.Path(sys.argv[0]).name
stdin=sys.stdin.read()
with (base/'calls.jsonl').open('a') as f: f.write(json.dumps({'vendor':vendor,'args':a,'stdin':stdin})+'\n')
(base/'ready').write_text(str(n))
if case.get('hold'):
 end=time.monotonic()+5
 while not (base/'release').exists() and time.monotonic()<end: time.sleep(.005)
 if not (base/'release').exists(): sys.exit(88)
if case.get('delay'): time.sleep(case['delay'])
if case.get('stderr'): print(case['stderr'],file=sys.stderr)
if 'raw' in case:
 sys.stdout.buffer.write(bytes(case['raw'])); sys.exit(case.get('exit',0))
if vendor=='codex':
 if 'data' in case: pathlib.Path(a[a.index('-o')+1]).write_text(json.dumps(case['data']))
 if 'file_raw' in case: pathlib.Path(a[a.index('-o')+1]).write_bytes(bytes(case['file_raw']))
 print(json.dumps({'type':'thread.started','thread_id':case.get('session','fake-thread')}))
 print(json.dumps({'type':'turn.completed','usage':{'input_tokens':12,'output_tokens':3}}))
else:
 out={'type':'result','is_error':case.get('is_error',False),'modelUsage':{case.get('model','claude-fake'):{'outputTokens':3}},'usage':{'input_tokens':12,'output_tokens':3}}
 if 'data' in case: out['structured_output']=case['data']
 if 'result' in case: out['result']=case['result']
 if '--output-format' in a and a[a.index('--output-format')+1]=='stream-json':
  print(json.dumps({'type':'system','subtype':'init','model':case.get('model','claude-fake')}))
  for e in case.get('events',[]): print(json.dumps(e))
 print(json.dumps(out))
sys.exit(case.get('exit',0))
