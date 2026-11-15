# Media learning sweep — 2026-11-15

Tested the supplied release builds in the supplied WebKit server: Mac at 1280×800 and iPhone at 390×844 with touch, both at 2× scale. Covered the seeded lecture, a newly imported YouTube source, a podcast's direct audio URL, and an authored two-hour local WAV through `ore add`; playback, seek, speed, following, highlights, Key points, anchored notes, finish, navigation, resume, unavailable audio, slow audio, private-video errors, untimed text, and a recording exercise's answer/source round trip. **Two new S2 findings**, both reproduced on Mac and iPhone. This is findings only: no application code or findings ledger was changed. Limits: the seed is a tone, the long fixture is silence with an authored transcript, and the podcast uses the same test transcriber; these test controls and timing maps, not speech recognition or audible word accuracy. YouTube playback used the provided fake-player protocol through request interception, not a real YouTube embed. Review used a read-only test exercise response because AI is disabled and the seeded lecture has no exercises. Native iPhone lock-screen/headphone behavior, native YouTube playback, a two-hour podcast on iPhone, and the complete AI-draft-to-phone-review chain remain unverified.

## Findings

### MEDIA-1 — Leaving an audio source restores the position from when it opened

**S2 · Mac and iPhone · reproduced 4/4 on Mac and 2/2 on iPhone.** A second listening session loses its progress. The first visit can look correct, so a simple play/close/reopen test misses this.

Reproduce from a fresh page:

1. Open **Lecture 4 the testing effect**. On Mac use ⌘K and search its title if it is already Done; on the phone use Continue reading.
2. Tap/click the `00:30` transcript timestamp, then Pause.
3. Leave with Home (Mac) or Back (phone), then reopen. It resumes paused at 0:30, correctly.
4. Press **Back 15 seconds**. The player now shows 0:15.
5. Leave again, then reopen.
6. Repeat steps 4–5.

**Expected:** reopen paused at 0:15, the latest position. **Actual:** reopen paused at 0:30, the position at the start of this visit. The phone also retained the wrong 0:30 after a page reload. In the original Mac run, the equivalent sequence reopened at 0:24, sought to 0:30, saved `30` on pause, then changed storage back to `24` on leaving, twice.

Evidence:

- `codex-out/media/resume-before-1.png`, `resume-after-1.png`, `resume-before-2.png`, `resume-after-2.png` — original Mac 0:30 → 0:24 regression.
- `codex-out/media/phone-resume-before-1.png`, `phone-resume-after-1.png`, `phone-resume-before-2.png`, `phone-resume-after-2.png` — phone 0:15 → 0:30 regression.
- `codex-out/media/phone-results.log` — phone position readings and reload result.
- `codex-out/media/resume-repro.cjs` — standalone Mac reproduction from a fresh context; final run completed with the bug reproduced in both trials.
- `codex-out/media/resume-results.json` and `confirmed-resume-before-1.png`, `confirmed-resume-after-1.png`, `confirmed-resume-before-2.png`, `confirmed-resume-after-2.png` — fresh-context 0:15 → 0:30 evidence.

Suspected cause: `apps/desktop/src/Reader.tsx:881` creates `useYouTube` even for an audio-only source. It and `useAudio` share `ore.video.<source-id>`. `apps/desktop/src/Video.tsx:198` always runs YouTube's persistence cleanup, and `Video.tsx:81–83` saves its stale nonzero initial position even with no video. That overwrites the current audio position saved by `Video.tsx:286–291`. Guarding only the initial-zero case would miss this repeat-visit failure.

### MEDIA-2 — Audio that has not loaded leaves dead controls with no loading state

**S2 · Mac and iPhone · confirmed twice on each platform.** A learner cannot tell whether the recording is loading, unavailable, or waiting for a click.

Reproduce from a fresh page:

1. Intercept only the recording's media-file response: Mac `http://localhost:1751/file?...source.wav`, phone `/library-file/.../source.wav`.
2. Hold that response without sending data or an error; leave the source metadata and transcript requests untouched.
3. Open **Lecture 4 the testing effect**.
4. Wait at least 16 seconds.
5. Release the response, leave, and repeat with a new media element.

**Expected:** a visible audio-loading state while waiting, followed by a useful delayed-load message or recovery action if it does not arrive. **Actual:** just disabled play/skip controls. Mac shows `0:24 / –:––`; the fresh phone run shows `0:00` with no duration. There is no spinner, loading text, timeout explanation, or next step. Releasing the held response makes the player ready; this is specifically the pending-response path, not the explicit error path.

Evidence:

- `codex-out/media/audio-wait-16s-1.png`, `audio-wait-16s-2.png`.
- `codex-out/media/phone-audio-wait-16s-1.png`, `phone-audio-wait-16s-2.png`.
- `codex-out/media/loading-check.js`, `phone-loading.js`, and `phone-results.log`.

Suspected cause: `apps/desktop/src/Video.tsx:269–282` handles metadata and errors but gives pending audio no visible state or timeout. `Video.tsx:408–412` only disables controls while unready and renders an audio message once `player.error` exists. The 15-second timeout earlier in the file applies only to YouTube. This is distinct from known F2, which concerns a player stalling **after playback starts**.

## Known rows and limits

- No previously fixed row was confirmed to have returned.
- F13 still says phone media is absent. The supplied browser build now **does** load the lecture WAV and timed transcript, plays it, seeks it, and shows its controls. That broad audio symptom was not reproduced here. This does not establish that native iPhone YouTube relay support is fixed.
- F129/F130: the recording highlight popup fit its Key point action and used **Play from here**, not a video-only label.
- F181: the Mac recording's Source actions menu contained **Reimport**.
- F267: the phone finish screen correctly said **Exercises come from your Mac**.
- F2's mid-play stall and F31's long-transcript finger-scroll case were not independently retested. Desktop long-transcript scrolling passed.
- Physical screen locking and Bluetooth/headphone play/pause could not be driven by this remote WebKit session. A **synthetic** hidden-page event kept playback advancing (30.27 → 31.88 seconds); Media Session existed and reported `playing`, with no app-registered handlers or metadata. This neither proves nor disproves hardware-button support: WebKit can supply default media handling. No hardware defect is claimed.

## What passed

- Mac seeded WAV: play/pause, timestamp seeking, skip back, and immediate 1.5× speed changes; the speed carried to YouTube and other audio.
- Mac first-visit resume worked; the repeat-visit failure is MEDIA-1.
- Mac long audio: `2:00:00` duration, seek to `1:30:00`, back to `1:29:45`, pinned controls, scroll away, **Back to current**, and return to following.
- Mac highlight created during playback: saved as a Key point, note saved, reopened intact, and **Play from here** sought to its first sentence at 0:00.
- Existing Mac highlight at “the memory gets stronger” played from approximately 0:15, with its saved note retained.
- Phone touch: play/pause, timestamp seek, skip back, speed preset, highlight popup, Key point, anchored note save/reopen, and highlight playback at 0:15.
- Leaving a source stopped its audio; switching from the playing podcast to the two-hour source left zero active audio elements. No overlapping players were observed.
- Mac opening Finish during playback paused the recording. Both platforms finished the lecture through the app.
- Explicit missing/unreadable audio response: both platforms showed “This recording won’t play here. Its transcript is below.” The transcript remained readable; tested twice per platform. This simulates a failed file read, not deletion of a library file.
- YouTube's mocked error 100 showed “This video was removed or made private” and **Open on YouTube**; tested twice. Mocked video play, pause, timestamp seek, and shared speed worked.
- Untimed transcript response: removed word times and visible stamps through the read-only `__ORE_EDIT` hook; zero `.ts` elements remained, text was readable, and audio still played. No synchronized-word claim for untimed data.
- Recording review fixture: answer and source quote appeared after confidence; **Open in source** returned to the recording. After forcing the media response to fail, returning to Review kept “The memory gets stronger.” unchanged. No rating of the synthetic exercise was recorded. There is no inline review audio control; source navigation is the available path, and it opens at the saved playback position rather than automatically seeking the quote.
- Phone finish accurately explained that Mac AI drafts exercises.

## Inputs, scripts, and provenance

Application checkout inspected: `cc6e604c7cdd512db27094ba33770c0dcb32288b`. Library changes were through the app and the explicitly requested `ore add` imports. Scripts, fixtures, screenshots, and this report live only under `codex-out/media/`.

| Input | Result and boundary |
| --- | --- |
| Seed lecture | `01M7FPJPSPGCKDYAGE2WG3B2JD`; 60-second WAV, timed transcript, two seeded highlights. |
| `https://www.youtube.com/watch?v=kCc8FmEb1nY` | Imported as **Let's build GPT: from scratch, in code, spelled out.**, `01M7FPNQEH7D9T47NE4761B9X8`; see `youtube-add.log`. The fake player is 170 seconds, so this was not a full video-duration test. |
| Scientific American episode page | Imported its article transcript without audio, permitted by D215's fallback when audio cannot be heard here; see `podcast-add.log`. Not reported as a playback regression. |
| Apple Podcasts episode link | Refused with “Add the episode from the show's own site instead”; see `podcast-player-add.log`. |
| `https://traffic.megaphone.fm/SAM9228418236.mp3` | Imported the episode's 22 MB audio as **From tofu to biodiesel: How soybeans dominate America**, `01M7FPXE51251NTD1732S8AAQ0`. Actual player duration 15:58; playback advanced. `ORE_TRANSCRIBE` used the authored test transcript, so word/audio content alignment was not assessed. |
| `Two hour learning session.wav` | Authored silent WAV with 120 timed passages, imported as `01M7FPWHZQPQMZWAXFRNMVHQ72`; `create-fixture.cjs`, `long.vtt`, `transcribe`, and `local-add.log` reproduce setup. |
| Review fixture | `review-base.json` is a read of an existing seed exercise; `review-journey.js` supplies a temporary lecture question/answer/item/annotation through `__ORE_REPLY` for UI testing only. It does not modify that exercise file. |

`driver.cjs` and `phone-driver.cjs` are interactive harnesses that evaluate the saved journey snippets. They connect to the assigned server, do not launch browsers or servers, and cap command counts. One early phone wait run hit a harness-only route-cleanup race (`Route is already handled`); that run was discarded and the corrected two-trial phone wait script completed. No application finding is based on that exception.
