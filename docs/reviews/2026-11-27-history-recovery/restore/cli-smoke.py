"""Run after roundtrip.ts: each CLI process exits before the next starts."""
import json, os, subprocess
from pathlib import Path
out = Path(__file__).resolve().parent
repo = out.parent.parent
for mode in ['notes', 'archive', 'cut', 'delete']:
    m = json.loads((out / f'manifest-{mode}.json').read_text())
    env = dict(os.environ, ORE_LIBRARY=m['root'], ORE_NO_ENRICH='1', PATH=str(out/'bin')+':'+os.environ['PATH'])
    commands = [
        ['ls'], ['show', m['item']], ['search', 'amberword'], ['due', '--all'],
        ['card', 'show', m['card'], '--review'], ['stats'], ['doctor'],
        ['notes', m['item']], ['backlinks', m['item']], ['diagram', m['item'], 'map'], ['chat', 'restorechat'],
    ]
    for args in commands:
        cmd = ['bun', 'packages/cli/src/ore.ts', *args, '--json']
        r = subprocess.run(cmd, cwd=repo, env=env, text=True, capture_output=True, timeout=20)
        assert r.returncode == 0, (mode, args, r.stderr, r.stdout)
        v = json.loads(r.stdout)
        name = args[0]
        if name == 'ls': assert any(x['id'] == m['item'] for x in v)
        if name == 'show': assert v['id'] == m['item'] and len(v['annotations']) == 1
        if name == 'search': assert any(x['item'] == m['item'] for x in v)
        if name == 'due': assert any(x['id'] == m['card'] for x in v)
        if name == 'card': assert v['id'] == m['card'] and v['state'] == 'live'
        if name == 'stats': assert v['total']['reviews'] == 1
        if name == 'doctor': assert v['ok']
        if name == 'notes': assert 'amberword' in v['text'] and 'violetone' not in v['text']
        if name == 'backlinks': assert len(v) == 2
        if name == 'diagram': assert v['scene']['elements'][0]['text'] == 'amberword'
        if name == 'chat': assert v['turns'][0]['message'] == 'amberword'
        (out/f'cli-{mode}-{name}.json').write_text(r.stdout)
        print('PASS', mode, ' '.join(cmd))
