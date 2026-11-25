// Runs the real phone filesystem module, entirely in memory; no physical library writes.
import * as phone from '../../apps/desktop/src/phone/fs.ts';
const n=Number(process.argv[2]??2);
phone.mkdirSync('/lib/target',{recursive:true});phone.writeFileSync('/lib/target/note.md','mine');
for(let i=0;i<n;i++){phone.mkdirSync('/lib/unrelated-'+i,{recursive:true});phone.writeFileSync('/lib/unrelated-'+i+'/doc.md','unrelated');}
const starts=String.prototype.startsWith;let unrelatedChecks=0;
String.prototype.startsWith=function(...args:Parameters<typeof starts>){if(starts.call(String(this),'/lib/unrelated-'))unrelatedChecks++;return starts.apply(String(this),args);};
let out;const t=performance.now();try{out=phone.readdirSync('/lib/target');}finally{String.prototype.startsWith=starts;}
console.log('[DEEP]',JSON.stringify({unrelatedSources:n,oneDirectoryMs:performance.now()-t,unrelatedChecks,result:out}));
if(unrelatedChecks){console.log('FAIL: listing one directory inspects every unrelated source file and folder');process.exitCode=1;}else console.log('PASS');
