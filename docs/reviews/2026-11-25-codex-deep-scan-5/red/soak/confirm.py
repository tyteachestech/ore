import json, os, pathlib, subprocess, time
out=pathlib.Path(__file__).resolve().parent
root=out.parent.parent
results=[]
for case, control, count in [('home-race',None,3),('focus-sidebar',None,3),('home-race','serial',3)]:
    for n in range(1,count+1):
        command=['node','codex-out/soak/driver.cjs',case]
        env={**os.environ,'ORE_NO_ENRICH':'1'}
        if control: env['SOAK_CONTROL']=control
        started=time.monotonic()
        run=subprocess.run(command,cwd=root,env=env,text=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,timeout=30)
        name=f'{case}-{control or "red"}-{n}.log'
        (out/name).write_text(run.stdout)
        expected=0 if control else 1
        symptom='An older Today response replaces the newer goal on Home' if case=='home-race' else 'Sidebar keeps the old skill name after returning from another app'
        passed=run.returncode==expected and (bool(control) or ('AssertionError' in run.stdout and symptom in run.stdout))
        row={'command':' '.join(command),'control':control,'run':n,'exit':run.returncode,'expected':expected,'seconds':round(time.monotonic()-started,3),'verified':passed,'log':name}
        results.append(row)
        print('[DEEP]',json.dumps(row),flush=True)
        (out/'confirmation.json').write_text(json.dumps(results,indent=2)+'\n')
        if not passed: raise SystemExit('Unexpected result; inspect '+name)
