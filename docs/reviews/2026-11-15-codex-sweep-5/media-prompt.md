Your name is `media`. First read `codex-out/preamble.md` and follow it.

Your ports: Mac app page http://localhost:1750/ with `window.__ORE_BRIDGE = 1751` (library `/Users/tylerpoelking/Developer/ore-wt/sweep5/codex-out/libs/media`); iPhone app http://localhost:1752/ (its seed is a copy at `/Users/tylerpoelking/Developer/ore-wt/sweep5/codex-out/libs/media-phone`; the page's writes stay in IndexedDB). WebKit server: `ws://[::1]:1759/`. The `ore` CLI: `ORE_LIBRARY=/Users/tylerpoelking/Developer/ore-wt/sweep5/codex-out/libs/media bun packages/cli/src/ore.ts`.
Your library is seeded with `seed.ts`.

## Your focus: learning from things that play
Videos, podcasts and recordings land as a `doc.md` with timestamps (D122). Earlier sweeps checked they import; nobody has learned from one end to end. Read D48–D50, D167 and anything on video, audio and transcripts in `docs/DECISIONS.md`, and `apps/desktop/src/Video.tsx` and `transcript.ts`. Your seed has a recorded lecture (a WAV with a transcript); add a YouTube video and a podcast episode with `ore add <url>` (read `apps/desktop/scripts/mock/fake-player.ts` for how the mock plays YouTube) and a local audio file.
1. **Read along.** Play, pause, seek by clicking a transcript word, change speed, skip back: does the text follow the sound, and the sound the text? Scroll away while it plays and come back.
2. **Highlight while it plays.** Highlight a line during playback, then press play on it later; mark a Key point; write a note at a timestamp. Does each keep its time and jump to it?
3. **Review from a recording.** Finish the source and review its exercises: does an exercise from a recording let him hear the moment it came from, and does the answer stay right when the audio fails to load?
4. **Leave and come back.** Switch source, go to Review, reload: does it resume where he stopped, does anything keep playing on a screen he can't see, do two players ever play at once?
5. **Failures.** A recording whose file is missing, a video that is private or removed, a transcript with no times, a two-hour podcast: every wait and error says what to do next.
On the iPhone: the same, with the screen locked mid-play (page hidden) and headphones' play/pause (Media Session).
