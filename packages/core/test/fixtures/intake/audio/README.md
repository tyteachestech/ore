# Podcast gap fixtures

`player-date.html`, `episode-language.html`, and `sundial.vtt` were written for Ore (AGPL-3.0-or-later). They contain no copied text. The HTML models an episode's Open Graph date and a PodcastEpisode's explicit spoken language inside JSON-LD, with the site's UI in another language.

`sundial.wav` is generated silence: mono, 16-bit PCM, 16 kHz, 2,026 zero-valued samples (4,096 bytes including its WAV header). Tests replace the external speech helper with the saved transcript; they verify import and language selection, not speech recognition accuracy. No network or speech model is needed.

`chaptered.mp3` and `chaptered.m4a` were made for Ore with espeak-ng and ffmpeg (`docs/reviews/2026-11-14-codex-sweep-2/fixtures/make-fixtures.py`, chapters from `chapters.ffmeta`): about 10 s of speech tagged title "Chaptered Audio Learning", artist "Ore Fixture Author", and chapters "Recall chapter" (0 s) and "Spacing chapter" (4 s). The second chapter's end (12 s) runs past the file's end, as real files' chapters sometimes do.
