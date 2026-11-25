import assert from 'node:assert/strict';
import * as m from '../../apps/desktop/src/draw/model';
// ?url imports are Vite file URLs; svgMarkup itself does not fetch them. Match their bundler role.
Bun.plugin({name:'font-url-for-headless-export',setup(b){b.onLoad({filter:/\.woff2\?url$/},args=>({contents:'export default '+JSON.stringify(args.path)+';',loader:'js'}));}});
const {svgMarkup}=await import('../../apps/desktop/src/draw/export');
const s=m.text([0,0],'Words <script>alert(1)</script> & "quotes" 日本 😀',m.DEFAULT_STYLE);
const svg=svgMarkup([s]);
assert.ok(svg.includes('&lt;script&gt;'));assert.ok(!svg.includes('<script>'));assert.ok(svg.includes('日本'));assert.ok(svg.includes('😀'));assert.ok(!/NaN|Infinity/.test(svg));
console.log('[DEEP] PASS SVG export escapes text markup and retains Unicode; length',svg.length);
