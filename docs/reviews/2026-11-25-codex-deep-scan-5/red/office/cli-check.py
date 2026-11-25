from pathlib import Path
import subprocess, os, json, time, resource, hashlib
root=Path(__file__).resolve().parent;repo=root.parent.parent
inputs=[('docx','word-merged.docx'),('pptx','slides-table.pptx'),('xlsx','sheets-time.xlsx'),('ipynb','notebook-attachment.ipynb'),('rtf','rtf-cp1251.rtf'),('md','text-relative.md'),('csv','cli.csv')]
(root/'inputs/cli.csv').write_text('Term;Meaning\r\n"spacing";"learning across days"\r\n')
def limit():resource.setrlimit(resource.RLIMIT_CPU,(25,25))
for kind,name in inputs:
 lib=root/'libs'/('cli-'+kind)
 env=dict(os.environ,ORE_NO_ENRICH='1',ORE_LIBRARY=str(lib),PATH=str(root/'bin')+':'+os.environ['PATH'],TMPDIR=str(root/'tmp'))
 logs=[]
 for args in [['init',str(lib),'--json'],['add',str(root/'inputs'/name),'--json','--no-enrich']]:
  cmd=['bun','packages/cli/src/ore.ts',*args]
  start=time.monotonic();p=subprocess.run(cmd,cwd=repo,env=env,capture_output=True,text=True,timeout=25,preexec_fn=limit)
  logs+=['$ ORE_NO_ENRICH=1 ORE_LIBRARY='+str(lib)+' '+' '.join(cmd),p.stdout,p.stderr,f'exit={p.returncode} elapsed_ms={round((time.monotonic()-start)*1000)}']
  if p.returncode: print(p.stdout,p.stderr);raise SystemExit(p.returncode)
 docs=list((lib/'items').glob('*/*/doc.md'));assert len(docs)==1
 doc=docs[0];original=doc.parent/('source.'+kind)
 logs+=['[DEEP] doc.md on disk:\n'+doc.read_text(),'[DEEP] originalExact='+str(original.read_bytes()==(root/'inputs'/name).read_bytes()),'[DEEP] assets='+str([f.name for f in (doc.parent/'assets').glob('*')])]
 (root/'logs'/('cli-'+kind+'.log')).write_text('\n'.join(logs)+'\n')
 print(kind,'saved',doc.relative_to(root))
