import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { parseFeed, findFeed, followFeed, refreshFeeds, feedView } from '../../packages/core/src/feeds.ts';
import { scratch } from './support.ts';

const base = 'https://feeds.example.test/rss/feed.xml';
const rss = (item: string) => `<rss version="2.0"><channel><title>Example</title><link>https://example.test/</link>${item}</channel></rss>`;
const atom = (entry: string, attrs = '') => `<feed xmlns="http://www.w3.org/2005/Atom" ${attrs}><title>Example</title>${entry}</feed>`;
const mode = process.argv[2] ?? 'base';
let xml = '';
let expected: unknown;
let get: (p: Awaited<ReturnType<typeof parseFeed>>) => unknown;
if (mode === 'base') {
  xml = atom('<entry><title>Lesson</title><link href="one"/></entry>', 'xml:base="https://site.example.test/learn/"');
  expected = 'https://site.example.test/learn/one'; get = p => p.posts[0]?.url;
} else if (mode === 'guid') {
  xml = rss('<item><title>Episode</title><guid isPermaLink="false">opaque-123</guid></item>');
  expected = false; get = p => p.posts.some(x => x.url === 'https://feeds.example.test/rss/opaque-123');
} else if (mode === 'text-title') {
  xml = atom('<entry><title type="text">Use &lt;T&gt; in TypeScript</title><link href="https://example.test/post"/></entry>');
  expected = 'Use <T> in TypeScript'; get = p => p.posts[0]?.title;
} else if (mode === 'escaped-title') {
  xml = rss('<item><title><![CDATA[Research &amp; practice]]></title><link>https://example.test/post</link></item>');
  expected = 'Research & practice'; get = p => p.posts[0]?.title;
} else if (mode === 'prefix') {
  xml = '<a:feed xmlns:a="http://www.w3.org/2005/Atom"><a:title>Example</a:title><a:entry><a:title>Lesson</a:title><a:link href="https://example.test/post"/></a:entry></a:feed>';
  expected = 1; get = p => p.posts.length;
} else if (mode === 'encoding') {
  xml = '<?xml version="1.0" encoding="ISO-8859-1"?>' + rss('<item><title>Café</title><link>https://example.test/café</link></item>').replace('<title>Example</title>','<title>Café</title>');
  const bytes = Buffer.from(xml, 'latin1');
  mkdirSync(new URL('./fixtures/', import.meta.url), {recursive:true});
  writeFileSync(new URL('./fixtures/encoding.xml',import.meta.url),bytes);
  globalThis.fetch = (async () => new Response(bytes, {headers: {'content-type':'application/rss+xml; charset=ISO-8859-1'}})) as typeof fetch;
  const f = await findFeed(base);
  const lib=await scratch('encoding'); await followFeed(lib,base); await refreshFeeds(lib);
  const url=feedView(lib).posts[0]?.url;
  console.log('[DEEP]', mode, JSON.stringify({actual:f.title, expected:'Café', actualUrl:url, expectedUrl:'https://example.test/caf%C3%A9'}));
  assert.equal(url, 'https://example.test/caf%C3%A9'); process.exit(0);
} else throw new Error(`unknown mode ${mode}`);
mkdirSync(new URL('./fixtures/', import.meta.url), {recursive:true});
writeFileSync(new URL(`./fixtures/${mode}.xml`, import.meta.url), xml);
let actual;
try { actual = get(await parseFeed(xml, base)); }
catch (error) { actual = {error:(error as Error).message}; }
console.log('[DEEP]', mode, JSON.stringify({actual, expected}));
assert.deepEqual(actual, expected);
