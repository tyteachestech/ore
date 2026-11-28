import json,pathlib,collections
p=pathlib.Path(__file__).resolve().parent
files=['inverse-matrix.json','inverse-all-mature.json','inverse-skills-rm-plain-modes.json','inverse-course-all-modes.json','inverse-inbox-link-modes.json']
rows=[r for f in files for r in json.loads((p/f).read_text())]
out=['# Coverage and byte differences','',f'{len(rows)} inverse cases; {sum(r.get("semanticPass",False) for r in rows)} compared-state passes; {sum(r.get("indexPass",False) for r in rows)} fresh-index matches.','', 'Each matrix entry contains parsed before/after state, exact file-byte deltas (base64), and results before/after a fresh index. Only `.index` is excluded from the byte snapshot. An intervening rename is intentionally retained, so that source file differs from the original snapshot. No filesystem timestamps or empty-directory metadata are compared.','', 'The semantic comparison excludes only append-only annotation/variant revision numbers and annotation revision times, and normalizes absent versus empty try-use lists. It includes full exercise data and review history.','', '## Inverse cases','', '| Pair | Modes | Restored state | Index | Raw differences in plain mode |','| --- | --- | --- | --- | --- |']
group=collections.defaultdict(list)
for r in rows:group[r['name']].append(r)
for name,rs in group.items():
 plain=next((r for r in rs if r['mode']=='plain'),rs[0]);paths=[d['path'] for d in plain['deltas']]
 import re
 paths=[re.sub(r'[0-9A-HJKMNP-TV-Z]{26}','<id>',v) for v in paths]
 failures=sorted(set(k for r in rs for k in r.get('mismatches',[])))
 out.append('| '+ ' | '.join([name,', '.join(r['mode'] for r in rs),'pass' if not failures else 'DIFF: '+', '.join(failures),'pass' if all(r.get('indexPass') for r in rs) else 'FAIL',', '.join('`'+v+'`' for v in paths) or 'none'])+' |')
out+=['','`intervening` renames the same source between forward and inverse. `mature` seeds three prior reviews on November 1, 7, and 20, with Good, Good, Again. `reindex` rebuilds between forward and inverse. All modes compare reads with another fresh rebuild afterward.','', 'Commands:', '', '```sh','bun codex-out/undo/inverse-matrix.ts','bun codex-out/undo/inverse-matrix.ts all mature','bun codex-out/undo/inverse-matrix.ts skills-rm-plain','bun codex-out/undo/inverse-matrix.ts course-all','bun codex-out/undo/inverse-matrix.ts inbox-link','```','', 'The default matrix collects all results rather than failing early. Selecting a case (or `all mature`) asserts every restoration, so the topic and archived-suggestion cases deliberately exit 1. Cut and page-text entries additionally perform redo/undo. Chat and session use their core equivalents to avoid stdin/global process machinery and session background jobs/Git snapshots. All other listed pairs use the real CLI command handlers.','', '## Reimport','', '```sh','bun codex-out/undo/reimport-loop.ts chain','bun codex-out/undo/reimport-loop.ts named','bun codex-out/undo/reimport-loop.ts chain-reindex','bun codex-out/undo/reimport-loop.ts title','bun codex-out/undo/reimport-loop.ts notes','bun codex-out/undo/reimport-loop.ts highlight-note','bun codex-out/undo/reimport-loop.ts status','```','', 'All commands above passed. The three-deep loops compare each document body and original byte-for-byte, then redo all three and undo all three again. Author and independently deleted-highlight variants are the separate red findings.','', '## Twelve isolated doctor corruptions','', '| Corruption | Before fix | What fix does | After fix | Next step quality |','| --- | --- | --- | --- | --- |']
notes={
 'truncated-review':'Names the line and says to delete that line in a text editor; no automatic deletion.',
 'bad-card-frontmatter':'Names the bad file, but only a YAML parse error; no concrete repair step.',
 'orphan-highlight':'Requests doctor --fix for hash/anchors; orphan remains named afterward, without a further recovery step.',
 'missing-doc':'Names unfinished folder and suggests delete/re-add; linked exercise also says restore source or retire exercise.',
 'unknown-skill':'Names unknown skill; no repair command.',
 'duplicate-card':'Names ID/file mismatch; no explicit recovery step.',
 'truncated-chat':'No issue or next step: UNDO-05.',
 'dangling-inbox':'No issue or next step: UNDO-05.',
 'missing-variant-card':'No issue or next step: UNDO-05.',
 'missing-image':'No issue or next step: UNDO-05.',
 'bad-job':'Names jobs.grade and default fallback; says to fix in a text editor.',
 'old-index':'No manual step needed: index schema rebuilt transparently.'}
for r in json.loads((p/'doctor-matrix.json').read_text()):
 desc=lambda d:f'{d["errors"]} errors, {d["warnings"]} warnings'
 fix='Updates only doc.md hash; 0 anchors moved; no annotation bytes removed' if r['name']=='orphan-highlight' else 'No canonical changes'
 out.append('| '+' | '.join([r['name'],desc(r['doctor']),fix,desc(r['after']),notes[r['name']]])+' |')
out+=['','```sh','bun codex-out/undo/doctor-matrix.ts','```','', 'For every isolated fault, real `ls`, `due`, `search`, chat-list, and inbox-list handlers returned exit 0. This means usable reads, not complete results: corrupt chat and missing inbox attachment disappear from their lists. The minimal follow-up also proves direct corrupt-chat open exits 1. `--fix` does not erase damaged records in any sampled case. The old-schema probe changes `.index` schema metadata to 1; it is not a migration test for every historic schema layout.','', '## Reproduction manifest','', '[confirmation.json](confirmation.json) records three consecutive red runs for each minimized case and one pass per control. [cli-confirmation.json](cli-confirmation.json) records actual CLI process output for doctor, cards, and corrupt chat open. Other probes and JSON states sit beside the report; run logs are in [logs/](logs/).','']
(p/'coverage.md').write_text('\n'.join(out))
assert len(rows)==97
assert sum(r.get('semanticPass',False) for r in rows)==89
assert all(r.get('indexPass') for r in rows)
print('Wrote coverage.md: 97 cases, 89 state passes, 97 index matches')
