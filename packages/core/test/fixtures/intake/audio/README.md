# Podcast gap fixtures

`oxford-episode-page.html` keeps the head metadata and main content markup from [Oxford's episode page](https://podcasts.ox.ac.uk/probability-puzzle), fetched 2026-11-27, with the words rewritten by `../rewrite-page.ts`. Its audio and video download links are kept as published. The test serves a generated recording in place of the MP3.

`player-date.html`, `episode-language.html`, and `sundial.vtt` were written for Ore (AGPL-3.0-or-later). They contain no copied text. The HTML models an episode's Open Graph date and a PodcastEpisode's explicit spoken language inside JSON-LD, with the site's UI in another language.

`sundial.wav` is generated silence: mono, 16-bit PCM, 16 kHz, 2,026 zero-valued samples (4,096 bytes including its WAV header). Tests replace the external speech helper with the saved transcript; they verify import and language selection, not speech recognition accuracy. No network or speech model is needed.

`chaptered.mp3` and `chaptered.m4a` were made for Ore with espeak-ng and ffmpeg (`docs/reviews/2026-11-14-codex-sweep-2/fixtures/make-fixtures.py`, chapters from `chapters.ffmeta`): about 10 s of speech tagged title "Chaptered Audio Learning", artist "Ore Fixture Author", and chapters "Recall chapter" (0 s) and "Spacing chapter" (4 s). The second chapter's end (12 s) runs past the file's end, as real files' chapters sometimes do.

`same-title-feed.xml`, `single-quote-feed.xml` and `repeated-speech.vtt` were written for Ore (AGPL-3.0-or-later). The first is a daily show's feed that names two episodes alike, a day apart; the second quotes its enclosure's address with single quotes and an escaped `&amp;`; the third is a sentence said once and again a minute later, as speech, not a rolling caption's carried line.
