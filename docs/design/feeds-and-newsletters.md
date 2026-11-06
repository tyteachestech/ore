# Feeds and newsletters (2026-11-03)

Tyler: an RSS tab below Home, ideally with its own email like Readwise Reader, for people like Simon Willison and How I AI that he means to read but never does in Gmail. Folo didn't stick.

**Picked: A**, then made stricter by Tyler: a post is saved only once he highlights it (or writes in its note), and the Feed has two views (Recent, By feed with drag to reorder, five posts each) with one Unread / All switch for both. Built as D107.

## Take

Worth it, small, and it serves the science pass's rec 1 (use Ore 10 min a day for two weeks): a daily trickle of writing he already wants to read is the easiest reason to open the app. It is only safe if followed posts are **not** saved to the library until he opens one. Readwise Reader splits Feed from Library for the same reason. Saving every post would mean enrich, prequestions and AI calls on things he never reads, and a To read list nobody can clear.

## Minimal version

1. **Follow.** Paste a blog, Substack or YouTube channel link in ⌘N. Today the add refuses feeds (D96); instead it finds the feed (`<link rel="alternate">`, `/feed`, YouTube's `feeds/videos.xml`) and offers **Follow** next to Add. Feeds live in the library's `feeds.yaml`, written through `packages/core` (`ore follow <url>`, `ore unfollow`). An optional skill per feed files what he opens.
2. **Feed** in the sidebar, under Home. Newest first: title, author, date, thumbnail, the same row as a source. One click opens it in the reader, which adds it as a source (filed to the feed's skill) and moves it out of Feed. E (or swipe on iPhone) dismisses. Nothing else.
3. **No pile.** No unread count, no badge, nothing on Home. Unopened posts drop off after 14 days. Feeds are checked when the app opens and every few hours while it runs, on the Mac only; the phone sees the list through the library like everything else.
4. **Failure states.** A feed that stops answering says so on its row in the follow list with Retry and Unfollow, never a silent empty Feed.

Lifecycle: follow, open, dismiss, unfollow, rename (feed title), set skill; no reordering (order is by date).

## Email

A Readwise-style `you@ore` address needs a mail server and storage that someone runs forever, which a free app with no server tier can't promise. Two routes that need none:

- **Most newsletters already have a feed.** Substack (`/feed`), Beehiiv, Ghost, Buttondown, personal blogs (Simon Willison: `simonwillison.net/atom/everything/`) and every YouTube channel. Following those skips email entirely. This covers his named examples (How I AI is also a YouTube show, which Ore already imports with transcripts).
- **Email-only newsletters**: subscribe with an address from a free email-to-feed service such as Kill the Newsletter (a unique address per newsletter, turned into an Atom feed), then follow that feed. No Gmail, no forwarding rules, nothing on our side. Ore's Follow box can link to it in the "no feed found" message.

Rejected for now: reading Gmail over IMAP or a Gmail filter (keeps him in the inbox he hates and needs his credentials), a Mail.app rule script (fragile, Mac only), our own inbound address (server cost, D-free app).

## Options

- **A (rec):** Feed place under Home as above, plus Follow in ⌘N. One PR, about the size of the courses work.
- **B:** No new place. Followed posts appear as a quiet "New from Simon Willison, How I AI…" section at the bottom of To read, same 14-day drop-off. Fewer screens, but it mixes "might read" with "chose to read", the thing Reader's split avoids.
- **C:** Wait. Finish the two-week trial first, adding posts by hand with ⌘N, and build A only if he finds himself wanting it.

Amends D13 (newsletters were v3) and D96 (feeds were refused).
