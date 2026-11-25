# Your run: feeds (feed parsing, newsletters, the Feed list)

Your name is `feeds`. Sweep 11 drove the Feed through pages; nobody has fuzzed the parser. Write feed documents in your folder and drive `packages/core/src/feeds.ts` and `inbox.ts` directly (stub network fetches in your script; never fetch real sites).

1. **Parsing**: RSS 0.9x/1.0 (RDF)/2.0, Atom, JSON Feed; CDATA, HTML-escaped titles, entities, namespaces (`content:encoded`, `media:`, `itunes:`), missing or duplicate GUIDs, GUIDs that change while the link stays, relative links and `xml:base`, enclosures, encodings declared in the XML vs the HTTP header, a BOM, malformed XML, an HTML page served instead of a feed, a feed of 5,000 items, items with no date or a date in the future or in odd RFC-822 forms and timezones.
2. **Following and refreshing**: feed discovery from a page, redirects and a feed URL that moves, the same feed followed by two URLs (http/https, trailing slash), unfollow with posts kept, a post that is also added by hand, a refresh racing a second refresh or an add, new vs seen posts after a refresh (does anything reappear as new, or vanish?), podcasts feeds' episodes vs posts.
3. **Newsletters** (whatever inbox.ts takes in), and the app side (`apps/desktop/src/Feed.tsx`, `feed-actions.ts`): Mark read, add to library, previews; the state shown vs what is on disk after each.
Read F143, F144, F303 and other Feed rows first.
