#!/usr/bin/env python3
import os,sys,json
from pathlib import Path
fixture=Path(__file__).with_name('reply.json')
if '--json-schema' not in sys.argv or ('SCOUT_REPLY' not in os.environ and not fixture.exists()):
    print('SCOUT STUB: no reply configured; AI disabled',file=sys.stderr)
    sys.exit(77)
reply=json.loads(os.environ['SCOUT_REPLY'] if 'SCOUT_REPLY' in os.environ else fixture.read_text())
if os.environ.get('SCOUT_VENDOR_LOG'):
    with open(os.environ['SCOUT_VENDOR_LOG'],'a') as f:f.write(json.dumps({'args':sys.argv[1:],'reply':reply})+'\n')
print(json.dumps({'type':'result','subtype':'success','is_error':False,'structured_output':reply,'session_id':'scout-session','modelUsage':{'scout-fixture':{'inputTokens':10,'outputTokens':10}},'usage':{'input_tokens':10,'output_tokens':10}}))
