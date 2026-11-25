import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { parseFeed, findFeed, followFeed, refreshFeeds, feedView, markRead, unfollowFeed, listFeeds } from '../../packages/core/src/feeds.ts';
import { queueLink, queuedLinks, importQueued, mine } from '../../packages/core/src/inbox.ts';
import { addSource } from '../../packages/core/src/ingest/index.ts';
import { findItem } from '../../packages/core/src/items.ts';
import { scratch, rss, response } from './support.ts';
const base='https://example.test/feed.xml';
const mode=process.argv[2] ?? 'passes';
const log=(name:string,value:unknown)=>console.log('[DEEP]',name,JSON.stringify(value));
const atom=(entries:string)=>`<feed xmlns="http://www.w3.org/2005/Atom"><title>A</title>${entries}</feed>`;
const item=(title:string,url:string,date?:string)=>`<item><title>${title}</title><link>${url}</link>${date?'<pubDate>'+date+'</pubDate>':''}</item>`;
const wrap=(items:string)=>`<rss version="2.0"><channel><title>A</title>${items}</channel></rss>`;
if(mode==='future') {
 const lib=await scratch('future');
 const future=Array.from({length:30},(_,n)=>item('future'+n,`https://example.test/future${n}`,'1 Jan 2100 00:00:00 GMT')).join('');
 const xml=wrap(future+item('today','https://example.test/today','24 Nov 2026 12:00:00 GMT'));
 globalThis.fetch=(async()=>response(xml)) as typeof fetch;
 await followFeed(lib,base);await refreshFeeds(lib);
 const posts=feedView(lib).posts;
 log('future',{count:posts.length,todayPresent:posts.some(p=>p.title==='today'),firstPublished:posts[0]?.published});
 assert(posts.some(p=>p.title==='today'),'future-dated items must not evict today from the last-two-weeks Feed');
} else if(mode==='passes') {
 for(const version of ['0.91','0.92','2.0']) {
  assert.equal((await parseFeed(rss('R').replace('2.0',version),base)).posts.length,1);log('RSS '+version,'PASS');
 }
 const rdf='<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns="http://purl.org/rss/1.0/" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel rdf:about="https://example.test/feed"><title>RDF</title><link>https://example.test/</link></channel><item rdf:about="https://example.test/post"><title>RDF post</title><link>https://example.test/post</link><dc:date>2026-11-24T12:00:00Z</dc:date><dc:creator>Ada</dc:creator></item></rdf:RDF>';
 assert.equal((await parseFeed(rdf,base)).posts[0]?.author,'Ada');log('RSS 1.0 RDF','PASS');
 const dated=wrap(item('date','https://example.test/post','Tue, 24 Nov 26 04:00:00 -0800'));
 assert.equal((await parseFeed(dated,base)).posts[0]?.published,'2026-11-24T12:00:00.000Z');
 for(const date of ['24 Nov 2026 12:00 GMT','Tue, 24 Nov 2026 07:00:00 EST','Tue, 24 Nov 2026 13:00:00 +0100'])
  assert.equal((await parseFeed(wrap(item('date','https://example.test/post',date)),base)).posts[0]?.published,'2026-11-24T12:00:00.000Z');
 log('RFC822 dates two-digit year GMT EST offset','PASS');
 const media=wrap('<item><title><![CDATA[plain title]]></title><link>/post</link><content:encoded><![CDATA[<img src="/image.png">]]></content:encoded><dc:creator>Ada &amp; Bob</dc:creator></item>');
 assert.deepEqual((await parseFeed(media,base)).posts[0],{url:'https://example.test/post',title:'plain title',author:'Ada & Bob',published:undefined,image:'https://example.test/image.png'});log('CDATA content image and XML entity author','PASS');
 assert.equal((await parseFeed(wrap('<item><title>A</title><link>/post</link><media:thumbnail url="/thumb.jpg"/></item>'),base)).posts[0]?.image,'https://example.test/thumb.jpg');log('media thumbnail','PASS');
 globalThis.fetch=(async()=>response('\uFEFF'+rss('BOM'))) as typeof fetch;
 assert.equal((await findFeed(base)).title,'BOM');log('UTF8 BOM discovery','PASS');
 globalThis.fetch=(async u=>String(u)===base?new Response('<html><head><link href="/custom?x=1&amp;y=2" rel="alternate" type="application/rss+xml"></head></html>'):String(u)==='https://example.test/custom?x=1&y=2'?response(rss('Discovered'),'https://example.test/moved'):new Response('missing',{status:404})) as typeof fetch;
 assert.equal((await findFeed(base)).url,'https://example.test/moved');log('HTML alternate, escaped query, redirect final URL','PASS');
 globalThis.fetch=(async()=>new Response('<html><body>Sign in</body></html>')) as typeof fetch;
 await assert.rejects(()=>findFeed(base),/Found no feed/);log('HTML instead of feed refused','PASS');
 const lib=await scratch('matrix');
 let xml=wrap(item('current','https://example.test/post','24 Nov 2026 12:00:00 GMT').replace('</item>','<guid>old-id</guid></item>'));
 globalThis.fetch=(async()=>response(xml)) as typeof fetch;
 await followFeed(lib,base);await followFeed(lib,base);assert.equal(listFeeds(lib).length,1);await refreshFeeds(lib);
 markRead(lib,['https://example.test/post']);xml=xml.replace('old-id','new-id');await refreshFeeds(lib);assert.equal(feedView(lib).posts[0]?.read,true);log('GUID changes with stable link keeps read state; repeat follow','PASS');
 xml=wrap(item('one','https://example.test/one').replace('</item>','<guid>same</guid></item>')+item('two','https://example.test/two').replace('</item>','<guid>same</guid></item>'));
 await refreshFeeds(lib);assert.equal(feedView(lib).posts.length,2);log('duplicate GUID, different URLs','PASS');
 xml=wrap(item('old','https://example.test/old','1 Jan 2020 00:00:00 GMT')+item('undated','https://example.test/no-date'));
 await refreshFeeds(lib);assert.deepEqual(feedView(lib).posts.map(p=>p.title),['undated']);log('old dates expire; no date stays while listed','PASS');
 xml=wrap(Array.from({length:5000},(_,i)=>item('post'+i,'https://example.test/p'+i)).join(''));
 const start=performance.now();assert.equal((await parseFeed(xml,base)).posts.length,5000);await refreshFeeds(lib);assert.equal(feedView(lib).posts.length,30);log('5000 items',{parsed:5000,cached:30,elapsedMs:Math.round(performance.now()-start)});
 await unfollowFeed(lib,base);assert.equal(feedView(lib).posts.length,0);log('unfollow removes feed posts','PASS');
 const queued=queueLink(lib,'example.test/queued');assert.equal(queued.url,'https://example.test/queued');
 const fail=async()=>{throw new Error('offline')};assert.equal((await importQueued(lib,fail)).failed.length,1);assert.equal((await importQueued(lib,fail)).failed.length,0);
 assert.equal(queuedLinks(lib).length,1);assert.equal(mine({...queued,device:'other'},Date.now(),'feeds-scout'),false);
 const done=await importQueued(lib,async()=>({id:'stub-id',title:'Queued'}));assert.equal(done.added.length,1);assert.equal(queuedLinks(lib).length,0);log('inbox link normalization failure retry device grace and successful removal','PASS');
} else if(mode==='kept') {
 const lib=await scratch('matrix-kept');
 const url='https://example.test/hand-added';
 const xml=wrap(item('Hand added',url));
 const html='<html><head><title>Hand added</title></head><body><article><h1>Hand added</h1>'+('<p>Practice retrieval over time to learn this lesson. Write what you remember before checking the source, then compare your answer carefully and revisit the parts you missed.</p>'.repeat(8))+'</article></body></html>';
 globalThis.fetch=(async u=>String(u)===base?response(xml):new Response(html,{headers:{'content-type':'text/html'}})) as typeof fetch;
 await followFeed(lib,base);await refreshFeeds(lib);assert.equal(feedView(lib).posts.length,1);
 const added=await addSource(lib,url);assert.equal(feedView(lib).posts.length,0);
 await unfollowFeed(lib,base);assert.equal(findItem(lib,added.meta.id).meta.url,url);log('hand-added post leaves Feed; unfollow preserves its source','PASS');
} else if(mode==='unsupported') {
 const json=JSON.stringify({version:'https://jsonfeed.org/version/1.1',title:'JSON',items:[{id:'1',url:'https://example.test/post',content_text:'Learn this'}]});
 globalThis.fetch=(async()=>new Response(json,{headers:{'content-type':'application/feed+json'}})) as typeof fetch;
 try {log('JSON feed',await findFeed(base));}catch(e){log('JSON feed',(e as Error).message);}
 const inline=atom('<entry><id>urn:uuid:newsletter-one</id><title>Newsletter</title><updated>2026-11-24T12:00:00Z</updated><content type="html">&lt;p&gt;Whole email here&lt;/p&gt;</content></entry>');
 log('inline-only Atom newsletter',await parseFeed(inline,base));
 const podcast=wrap('<item><title>Episode</title><enclosure url="https://example.test/episode.mp3" type="audio/mpeg"/></item>');
 log('enclosure-only podcast',await parseFeed(podcast,base));
} else throw new Error('unknown mode');
