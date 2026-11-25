import assert from 'node:assert/strict';
const {fromMarkdown}=await import(Bun.resolveSync('mdast-util-from-markdown',new URL('../../packages/core/',import.meta.url).pathname));
const md='[Space skill](<ore:skill/A B>)\n';
const link=(fromMarkdown(md) as any).children[0].children[0];
console.log('[DEEP]',JSON.stringify({nodeType:link.type,parsedUrl:link.url,currentFilter:/^ore:(item|skill)\/(\S+)$/.test(link.url),sameUrlWithoutSpace:/^ore:(item|skill)\/(\S+)$/.test(link.url.replace(' ','-'))}));
assert.equal(link.url,'ore:skill/A B');
