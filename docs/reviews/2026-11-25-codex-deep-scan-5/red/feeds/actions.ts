import assert from 'node:assert/strict';
import { markFeedRead } from '../../apps/desktop/src/feed-actions.ts';
import { History } from '../../apps/desktop/src/history.ts';
import type { Notify } from '../../apps/desktop/src/util.ts';
import { deferred, scratch, rss, response } from './support.ts';
import { feedView, followFeed, refreshFeeds, markRead } from '../../packages/core/src/feeds.ts';
const mode=process.argv[2] ?? 'undo-failed';
const lib=await scratch('actions-'+mode);
globalThis.fetch=(async()=>response(rss('Example',['post']))) as typeof fetch;
await followFeed(lib,'https://example.test/feed');await refreshFeeds(lib);
let posts=[{url:'https://example.test/post',read:false}];
const disk=()=>feedView(lib).posts[0].read;
const writes:string[]=[];
const h=new History();
const notify:Notify=(message,kind,undo,redo)=>{
 const step={message,undo:undo!,redo}; if(undo)h.push(step);
 return Object.assign(()=>h.forget(step),{undo:()=>h.take(step),hold:(p:Promise<unknown>)=>h.hold(step,p)});
};
const gate=deferred<void>(); let calls=0;
const mark=(on:boolean)=>markFeedRead(posts,on,{
 notify,show:update=>{posts=update(posts);},run:async(...args)=>{
   if(++calls===1){await gate.promise;if(mode!=='control')throw new Error('save failed');}
   writes.push(args[1]); markRead(lib,args.slice(2),args[1]==='read');
 }
});
const first=mark(true), second=mark(false);
const third=mode==='rollback'?mark(true):Promise.resolve(true);
gate.resolve(); await Promise.all([first,second,third]);
await new Promise(r=>setTimeout(r,0));
if(mode==='undo-failed'||mode==='control') {h.undo(); await new Promise(r=>setTimeout(r,0));}
console.log('[DEEP]',mode,JSON.stringify({shown:posts[0].read,disk:disk(),writes,expected:mode!=='undo-failed'}));
if(mode==='rollback')assert.equal(posts[0].read,disk(),'after the last successful Mark read, the screen must match disk');
else assert.equal(disk(),mode==='control','Undo must restore the state that actually saved before the action');
