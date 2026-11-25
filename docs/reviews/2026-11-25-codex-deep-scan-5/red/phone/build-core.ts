import { resolve, dirname } from 'node:path';
const base = resolve(import.meta.dir, '../..');
const phone = (f: string) => `${base}/apps/desktop/src/phone/${f}.ts`;
const result = await Bun.build({
  entrypoints: [import.meta.dir+'/core-entry.ts'], outdir: import.meta.dir+'/built', target:'browser', packages:'external',
  plugins: [{name:'phone-shims', setup(build) {
    build.onResolve({filter:/^(node:)?(fs|os|util|child_process|crypto)$|^bun:sqlite$/}, (args) => ({path: phone(args.path === 'bun:sqlite' ? 'sqlite' : ['fs','os'].includes(args.path.replace('node:','')) ? args.path.replace('node:','') : 'node')}));
    build.onResolve({filter:/^(node:)?path$/}, () => ({path:Bun.resolveSync('path-browserify',base+'/apps/desktop'),external:true}));
    build.onResolve({filter:/^@open-spaced-repetition\/binding$/}, () => ({path:phone('node')}));
    build.onResolve({filter:/^[^./]/}, (args) => args.path.startsWith('node:') || args.path.startsWith('bun:') ? undefined : ({path:Bun.resolveSync(args.path,dirname(args.importer)),external:true}));
  }}],
});
if (!result.success) { console.error(result.logs); process.exit(1); }
console.log('[DEEP] bundled unchanged core modules with phone fs/sqlite/os/node aliases');
