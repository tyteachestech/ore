import assert from 'node:assert/strict';
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { followFeed, refreshFeeds, feedView, arrangeFeeds, listFeeds } from '../../packages/core/src/feeds.ts';
import { queueFile, queuedLinks, removeQueuedLink } from '../../packages/core/src/inbox.ts';
import { scratch, rss, response, deferred } from './support.ts';
const mode = process.argv[2];
const lib = await scratch(mode);
const a='https://example.test/a.xml', b='https://example.test/b.xml';
globalThis.fetch = (async u => response(rss(String(u) === a ? 'A':'B'))) as typeof fetch;
if (mode === 'inbox-copy') {
  const original = join(lib.root, 'capture.md');
  writeFileSync(original, 'Unique captured words');
  const q = queueFile(lib, original);
  copyFileSync(join(lib.root,'inbox',q.id+'.file.json'), join(lib.root,'inbox',q.id+' 2.file.json'));
  const before = queuedLinks(lib).length;
  removeQueuedLink(lib, q.id+' 2');
  const result = {before, after:queuedLinks(lib).length, originalEntry:existsSync(join(lib.root,'inbox',q.id+'.file.json')), payload:existsSync(join(lib.root,'inbox',q.file!))};
  console.log('[DEEP]', mode, JSON.stringify(result));
  assert.equal(result.payload, true, 'removing a sync copy must preserve the still-queued original payload');
} else if (mode === 'refresh-follow') {
  await followFeed(lib,a); await refreshFeeds(lib);
  const hold=deferred<Response>();
  let blocked = false;
  globalThis.fetch = (async u => String(u)===a && !blocked ? (blocked=true,hold.promise) : response(rss(String(u)===a?'A':'B'))) as typeof fetch;
  const old=refreshFeeds(lib);
  await followFeed(lib,b); await refreshFeeds(lib,[b]);
  const before=feedView(lib).posts.map(p=>p.title);
  hold.resolve(response(rss('A'))); await old;
  const after=feedView(lib).posts.map(p=>p.title);
  console.log('[DEEP]', mode, JSON.stringify({before,after,followed:listFeeds(lib).map(f=>f.title), cache:JSON.parse(readFileSync(join(lib.root,'.index/feeds.json'),'utf8'))}));
  assert(after.includes('B'), 'a refresh started before Follow must not erase the new feed cache');
} else if (mode === 'arrange-alias') {
  await followFeed(lib,a); await followFeed(lib,b);
  let error:string|undefined;
  try {await arrangeFeeds(lib,[a,'A']);} catch(e) {error=(e as Error).message;}
  const urls=listFeeds(lib).map(f=>f.url);
  console.log('[DEEP]', mode, JSON.stringify({error,urls}));
  assert(urls.includes(b), 'invalid order must not silently delete followed feed B');
} else if (mode === 'refresh-order') {
  await followFeed(lib,a); await refreshFeeds(lib);
  const hold=deferred<Response>(); let n=0;
  globalThis.fetch=(async()=> ++n===1?hold.promise:response(rss('A',['new','old']))) as typeof fetch;
  const old=refreshFeeds(lib);
  await refreshFeeds(lib);
  const before=feedView(lib).posts.map(p=>p.title);
  hold.resolve(response(rss('A',['old']))); await old;
  const after=feedView(lib).posts.map(p=>p.title);
  console.log('[DEEP]', mode, JSON.stringify({before,after}));
  assert(after.includes('new'),'an older refresh must not replace the later successful refresh');
} else throw new Error('unknown mode');
