# Transcript eval

`bun run eval:transcripts` answers one question: how close is each way of getting a transcript to one
written by people? It runs on the Mac by hand (it needs yt-dlp and macOS 26's speech recognition,
downloads audio, and reads live sites), never in CI.

Flags: `--only <id>`, `--kind youtube|podcast`, `--method auto,page,heard`, `--keep <dir>` (saves the words to compare). Cases: `packages/core/eval/transcript-cases.json`; results: `packages/core/eval/results/transcripts-<date>.json`.

## What it scores

The **key** is a human transcript: a video's captions written by people, or the transcript a podcast
publishes. Each way of getting a transcript is compared with it, word by word:

| Way | What it is | Why it matters |
| --- | --- | --- |
| `auto` | YouTube's automatic captions, read with yt-dlp | What a video without human captions imports as today |
| `page` | Captions found from the video's own page with one plain request, no yt-dlp | What an iPhone could do, since it can't run yt-dlp |
| `heard` | Apple's on-device speech recognition on the sound | The Mac's fallback today, and the same engine an iPhone has |

The number is **word error rate (WER)**: the fewest word swaps, lost words and extra words that turn
the transcript into the key, over the key's length. 5% means about one word in twenty differs. Text is
compared in lower case with punctuation, speaker names, time stamps and notes like "[Music]" removed.

## Reading a result

- `wrong` is a swapped word, `lost` a word the key has and the transcript doesn't, `extra` the reverse.
- A podcast's published transcript is edited: it drops "um", tidies restarts and never includes the ads.
  So a podcast's WER has a floor of a few percent that isn't the recognizer's fault, and a high `extra`
  count usually means ads. Compare ways and episodes with each other, not with zero.
- `page` should match the key exactly (0%) when it finds the same human captions. What it tests is
  whether the page gives them up at all: a failure there says why.
- `--keep <dir>` saves `<case>.key.txt` and `<case>.<way>.txt`, one line of words each, to diff.

## The set

`packages/core/eval/transcript-cases.json`. Each case says in `why` what it adds: a kind of speaker,
sound, vocabulary or length. Only links are stored, never the audio or the transcripts, so nothing
copyrighted is in the repo. A YouTube case must have human captions in its language, or there is
nothing to score against; the run says so and the case is replaced. A podcast case names its feed and
the episode's guid (audio links change) and the page or file its transcript is published at, with
`from` and `to` phrases to leave out the page around it.

Add a case when a kind of source transcribes badly in real use and nothing in the set is like it.
