import json,statistics,collections,pathlib
root=pathlib.Path(__file__).parent
load=lambda name:[json.loads(x) for x in (root/name).read_text().splitlines()]
cli=collections.defaultdict(lambda:collections.defaultdict(list))
for r in load('cli-timing.jsonl'):
 assert r['code']==0
 cli[' '.join(r['args'])][r['size']].append(r['ms'])
lines=['| CLI command (all use `--json`) | 952 sources | 1,904 sources |','|---|---:|---:|']
for k,v in cli.items():
 k=k.replace('01M88G0P6Z89CVJ42BZFA8EQH0','<source>').replace('01M88G0PXNRTEJ6ETYRASXH721','<exercise>')
 lines.append('| `'+k+'` | '+' | '.join(f'{statistics.median(v[s]):.1f} ms' for s in ['large','twice-large'])+' |')
(root/'cli-table.md').write_text('\n'.join(lines)+'\n')
mac=load('mac-profile.jsonl');phone=load('phone-profile.jsonl');selected={}
for name,rows in [('mac',mac),('phone',phone)]:
 selected[name]=[next(r for r in reversed(rows) if r['size']==s and r['label']==label) for s in ['large','twice-large'] for label in (['startup','open-source','start-review','all-sources','type-source-search','scroll-source-list','archive-one-source'] if name=='mac' else ['skill','review','core-command-controls'])]
(root/'final-profiles.json').write_text(json.dumps(selected,indent=2))
print('CLI rows:',len(cli),'all succeeded. Final browser profiles:',len(selected['mac']),len(selected['phone']))
