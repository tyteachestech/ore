import assert from 'node:assert/strict';
const { DOMParser } = await import(Bun.resolveSync('linkedom', new URL('../../packages/core/', import.meta.url).pathname));
import { parseFeed, findFeed, followFeed, listFeeds, arrangeFeeds, feedView, refreshFeeds, markRead } from '../../packages/core/src/feeds.ts';
import { queueFile, removeQueuedLink, queuedLinks } from '../../packages/core/src/inbox.ts';
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { scratch, response, rss } from './support.ts';
const base='https://feeds.example.test/rss/feed.xml';
const mode=process.argv[2] ?? 'parser';
const log=(name:string,value:unknown)=>console.log('[DEEP]',name,JSON.stringify(value));
if(mode==='parser') {
 const atom=(attrs:string,entry:string)=>`<feed xmlns="http://www.w3.org/2005/Atom" ${attrs}><title>Example</title><entry>${entry}</entry></feed>`;
 const entry='<title>Lesson</title><link href="one"/>';
 const root=atom('xml:base="https://site.example.test/learn/"',entry);
 const dom=new DOMParser().parseFromString(root,'text/xml');
 log('base DOM attribute',dom.documentElement.getAttribute('xml:base'));
 for(const [label,xml] of [['none',atom('',entry)],['root-only',root],['absolute-href',root.replace('href="one"','href="https://site.example.test/learn/one"')]])
  log('base '+label,(await parseFeed(xml,base)).posts[0]?.url);
 const guid=(attr:string,enc:boolean)=>`<rss><channel><title>A</title><item><title>Episode</title><guid ${attr}="false">opaque-123</guid>${enc?'<enclosure url="https://example.test/ep.mp3" type="audio/mpeg"/>':''}</item></channel></rss>`;
 for(const attr of ['isPermaLink','ispermalink']) for(const enc of [true,false]) {
  const xml=guid(attr,enc), d=new DOMParser().parseFromString(xml,'text/xml');
  log('guid '+attr+' enclosure='+enc,{attribute:d.getElementsByTagName('guid')[0]?.getAttribute(attr),posts:(await parseFeed(xml,base)).posts});
 }
 for(const type of ['text','html','']) {
  const xml=atom('',`<title ${type?'type="'+type+'"':''}>Use &lt;T&gt; in TypeScript</title><link href="https://example.test/post"/>`);
  const d=new DOMParser().parseFromString(xml,'text/xml');
  log('title type='+type,{dom:d.getElementsByTagName('title')[1]?.textContent,parsed:(await parseFeed(xml,base)).posts[0]?.title});
 }
 for(const t of ['Research &amp; practice','<![CDATA[Research &amp; practice]]>','<![CDATA[Research &#38; practice]]>']) {
  const xml=atom('',`<title>${t}</title><link href="https://example.test/post"/>`);
  log('entity '+t,(await parseFeed(xml,base)).posts[0]?.title);
 }
 const prefixed=readFileSync(new URL('./fixtures/prefix.xml',import.meta.url),'utf8');
 const d=new DOMParser().parseFromString(prefixed,'text/xml');
 log('prefix DOM',{root:d.documentElement.tagName,entries:d.getElementsByTagName('a:entry').length});
 log('prefix removed',(await parseFeed(prefixed.replaceAll('a:','').replace('xmlns:a','xmlns'),base)).posts.length);
 for(const charset of ['utf-8','ISO-8859-1']) for(const declaration of [true,false]) {
  const xml=(declaration?`<?xml version="1.0" encoding="${charset}"?>`:'')+rss('Café');
  const bytes=Buffer.from(xml,charset==='utf-8'?'utf8':'latin1');
  globalThis.fetch=(async()=>new Response(bytes,{headers:{'content-type':`application/rss+xml; charset=${charset}`}})) as typeof fetch;
  log('encoding '+charset+' declaration='+declaration,(await findFeed(base)).title);
  log('encoding explicit decode '+charset,(await parseFeed(new TextDecoder(charset).decode(bytes),base)).title);
 }
} else if(mode==='state') {
 const lib=await scratch('probe-state');
 const a='https://example.test/a.xml', b='https://example.test/b.xml';
 globalThis.fetch=(async u=>response(rss(String(u)===a?'A':'B'))) as typeof fetch;
 await followFeed(lib,a);await followFeed(lib,b);
 await arrangeFeeds(lib,[b,a]);
 assert.deepEqual(listFeeds(lib).map(f=>f.url),[b,a]);log('valid reorder',listFeeds(lib).map(f=>f.url));
 await arrangeFeeds(lib,[a,'A']);log('alias reorder disk',readFileSync(join(lib.root,'feeds.yaml'),'utf8'));
 const p=join(lib.root,'captured.md');writeFileSync(p,'only captured copy');
 for(const removeOriginal of [true,false]) {
  const q=queueFile(lib,p);
  copyFileSync(join(lib.root,'inbox',q.id+'.file.json'),join(lib.root,'inbox',q.id+' 2.file.json'));
  removeQueuedLink(lib,removeOriginal?q.id:q.id+' 2');
  log('remove '+(removeOriginal?'original':'copy'),{payload:existsSync(join(lib.root,'inbox',q.file!)),remaining:queuedLinks(lib).length});
 }
} else if(mode==='future') {
 const lib=await scratch('probe-future');
 for(const count of [0,29,30]) {
  const xml=`<rss><channel><title>Dates</title>${Array.from({length:count},(_,i)=>`<item><title>future${i}</title><link>https://example.test/future${i}</link><pubDate>1 Jan 2100 00:00:00 GMT</pubDate></item>`).join('')}<item><title>today</title><link>https://example.test/today</link><pubDate>24 Nov 2026 12:00:00 GMT</pubDate></item></channel></rss>`;
  globalThis.fetch=(async()=>response(xml)) as typeof fetch;
  await followFeed(lib,base);await refreshFeeds(lib);
  const parsed=await parseFeed(xml,base);
  log('future count '+count,{parsedToday:parsed.posts.some(p=>p.title==='today'),totalParsed:parsed.posts.length,firstDate:parsed.posts[0]?.published,todayVisible:feedView(lib).posts.some(p=>p.title==='today')});
 }
} else throw new Error('unknown mode');
