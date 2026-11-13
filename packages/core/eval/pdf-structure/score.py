# Formula and table scores. Usage: python3 score.py <keys dir> <out dir> <kind,kind>
# Keys: <doc>.keys.json from keys.cjs ({eq: [latex], tab: [[[cell]]]}). Outputs: <out>/<doc>.<kind>.md
# Formula: for each key equation, the best similarity (0-1) of any $..$ / $$..$$ / \[..\] block, after
#   normalizing LaTeX spelling (\mathrm, \displaystyle, braces, spaces). Table: for each key table, the
#   best cell F1 against any output table (markdown pipes or HTML), cells normalized.
import json, re, sys, os, difflib, html, unicodedata

K, O, kinds = sys.argv[1], sys.argv[2], sys.argv[3].split(',')

def ltx(s):
    s = unicodedata.normalize('NFKC', s)
    s = re.sub(r'\\(displaystyle|textstyle|left|right|big|Big|bigg|Bigg|quad|qquad|,|;|!|nonumber|limits)\b', '', s)
    s = re.sub(r'\\(mathrm|text|textrm|operatorname|mathit|mathbf|boldsymbol|bm|mathbb|mathcal)\s*', '', s)
    s = s.replace('~', '').replace('\\ ', '').replace('&', '').replace('\\\\', '')
    s = re.sub(r'[{}\s]', '', s)
    return s

def blocks(md):
    out = re.findall(r'\$\$(.+?)\$\$', md, re.S) + re.findall(r'\\\[(.+?)\\\]', md, re.S)
    md2 = re.sub(r'\$\$.+?\$\$', '', md, flags=re.S)
    out += re.findall(r'(?<!\$)\$([^$\n]+?)\$(?!\$)', md2)
    return [ltx(b) for b in out if b.strip()]

def eqscore(key, md):
    bs = blocks(md)
    if not bs: return [0.0 for _ in key]
    res = []
    for e in key:
        k = ltx(e)
        best = 0
        for b in bs:
            r = difflib.SequenceMatcher(None, k, b, autojunk=False).ratio()
            if r > best: best = r
        res.append(best)
    return res

def cell(s):
    s = html.unescape(re.sub(r'<[^>]+>', ' ', s))
    s = re.sub(r'\$([^$]*)\$', r'\1', s)
    s = unicodedata.normalize('NFKC', s).lower()
    return re.sub(r'[\s{}\\*_^]|mathrm|cdot', '', s)

def tables(md):
    ts = []
    for t in re.findall(r'<table.*?</table>', md, re.S | re.I):
        rows = re.findall(r'<tr.*?</tr>', t, re.S | re.I)
        ts.append([[cell(c) for c in re.findall(r'<t[dh][^>]*>(.*?)</t[dh]>', r, re.S | re.I)] for r in rows])
    cur = []
    for line in md.splitlines() + ['']:
        if line.strip().startswith('|'):
            cells = [c for c in line.strip().strip('|').split('|')]
            if all(re.fullmatch(r'\s*:?-+:?\s*', c) for c in cells): continue
            cur.append([cell(c) for c in cells])
        elif cur:
            ts.append(cur); cur = []
    return ts

def f1(key, out):
    from collections import Counter
    a = Counter(c for r in key for c in r if c); b = Counter(c for r in out for c in r if c)
    m = sum((a & b).values())
    if not m: return 0.0
    p, r = m / sum(b.values()), m / sum(a.values())
    return 2 * p * r / (p + r)

def tabscore(key, md):
    ts = tables(md)
    return [max([f1([[cell(c) for c in r] for r in k], t) for t in ts] or [0]) for k in key]

print(f"{'doc':12}" + ''.join(f"| {k:>10} eq   tab " for k in kinds))
tot = {k: ([], []) for k in kinds}
for f in sorted(os.listdir(K)):
    if not f.endswith('.keys.json'): continue
    d = f[:-10]; key = json.load(open(f'{K}/{f}'))
    row = f'{d:12}'
    for k in kinds:
        p = f'{O}/{d}.{k}.md'
        if not os.path.exists(p): row += f"| {'-':>10} {'':4} {'':4} "; continue
        md = open(p).read(); e = eqscore(key['eq'], md); t = tabscore(key['tab'], md)
        tot[k][0].extend(e); tot[k][1].extend(t)
        avg = lambda x: f"{100*sum(x)/len(x):4.0f}" if x else '   -'
        row += f"| {'':10} {avg(e)} {avg(t)} "
    print(row)
for k in kinds:
    e, t = tot[k]
    if e or t: print(f"{k:12} formulas {100*sum(e)/max(len(e),1):.0f} ({len(e)})  tables {100*sum(t)/max(len(t),1):.0f} ({len(t)})")
