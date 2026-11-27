# Ore Cloud spike: where PDFs are read, and YouTube captions on the phone

Issue #546 (part of the Ore Cloud spec #545). Measured 2026-11-26 to 27. The scripts are in `docs/research/ore-cloud-spike/`.

## 1. The PDF page reader off the Mac

**What ran.** PaddleOCR-VL 1.6 with PP-DocLayoutV3 (D346), paddleocr 3.7.0, on a 4 vCPU Linux box (Intel Xeon at 2.1 GHz, 16 GB, no GPU). That is about the size of a Hetzner 4 to 8 vCPU server. Two ways to run the model were tried:

- **Paddle's own engine (`native`)** used one core and didn't finish the first page of a 4-page paper in 17 minutes. It can't be used on a CPU.
- **llama.cpp (`llama-cpp-server`)**, with PaddlePaddle's own GGUF build of the model (`PaddlePaddle/PaddleOCR-VL-1.6-GGUF`, 1.8 GB) and llama.cpp built from source (MIT), uses all 4 cores. All the numbers below are from this one. PaddleOCR supports it, so Ore's driver only changes `vl_rec_backend`, the way the Mac uses `mlx-vlm-server`.

**Seconds a page on 4 vCPU** (each page timed from start to finish, including the layout model):

| PDF (D346 race samples) | pages | s/page |
|---|---|---|
| paper-buyalskaya (two-column) | 4 | 92.6 |
| textbook-mcgill | 5 | 29.4 |
| design-refactoring-ui | 5 | 26.9 |
| report-iab | 5 | 44.6 |
| code-llm-handbook | 5 | 47.9 |
| scan-bandura (scanned) | 5 | 47.9 |
| **all 29 pages** | 29 | **46.7** |
| Public set (also run on the GPU): Transformer paper, GPT-3 tables, Think Python | 15 | 49.5 (61.8 / 60.6 / 26.2) |

Pages full of blocks (papers in two columns, tables) are the slow ones: each block is its own model request, about 3 to 5 s on this CPU. For comparison, the Mac (M4 Pro, mlx-vlm) takes about 6.3 s a page.

- **A 300-page book: about 4 hours on one 4 vCPU box** (300 × 47 s). A box reads about 1,800 pages a day, which is about 6 books.
- **Peak memory: about 9 GB.** The llama.cpp server takes 6.3 GB and the pipeline 2.6 GB, so the box needs 16 GB.
- **Start-up:** the pipeline loads in 2 to 19 s once the model is downloaded. The model is 2 GB of downloads (the GGUF and its vision part), once per box.
- **Cost:** a dedicated 4 to 8 vCPU, 16 GB box is about €37 a month on Hetzner (General Purpose plans from €36.99, hetzner.com/cloud on 2026-11-27). Kept busy, that is about €0.20 a book. Kept mostly idle, the cost is the whole €37 a month.

**Regions match the Mac's.** On the four Buyalskaya pages, the Linux reading has the same blocks as the Mac's reading from the race (`/mnt/project-files/pdf-race/paddle-pages/`): 73 of 73 with the same label and a box overlapping by more than 90%. The block text was identical in 67 of 73. The other 6 differ only by quote style (`"` against `“”`), a link icon read as "ID", or a full stop. Ore uses pdf.js's own words wherever the page has text (D346), so these differences reach doc.md only on scans and on tables or formulas that are pictures.

**On a rented GPU (Modal, billed by the second).** This used the same pipeline with the model in vLLM 0.10.2 (PaddleOCR's own `paddlex_genai_server`) and the layout model on the GPU, from `modal_paddle.py`, on 15 public pages: the Transformer paper, GPT-3's tables and Think Python. Every GPU read the same 155 blocks. The model needs 1.8 GB of GPU memory; vLLM reserves more up front.

| GPU | s/page, 15 pages together | s/page, 5-page PDF | model server start | $/s (GPU + 2 cores, 16 GB) | per 1,000 pages |
|---|---|---|---|---|---|
| **A10** | **0.31** | 0.41 to 0.74 | 78 s | $0.000366 | **$0.11** |
| L4 | 0.63 | 0.61 to 1.27 | 135 s | $0.000282 | $0.18 |
| T4 | 4.26 | 1.79 to 9.08 | 124 s | $0.000224 | $0.95 |
| CPU, 4 vCPU (above) | 49.5 | 26 to 62 | 2 to 19 s | €37 a month flat | n/a |

Prices are from modal.com/pricing on 2026-11-27, with CPU and memory at about $0.22/h added to the GPU. The whole spike cost $0.27 of Modal's free monthly $30.

- **A 300-page book on an A10: about 93 s and $0.03**, plus one cold start (about 80 s, $0.03) when nothing is warm. That is under $0.10 a book, and nothing is paid while no one imports.
- **A 10-page paper: about 4 s of reading**, so the cold start is most of its cost and its wait. Keeping one container warm for a few minutes after a job (Modal's `scaledown_window`) or batching a few imports into one start brings that down.
- The A10 is both the fastest and the cheapest per page, so the pricier L4 isn't worth it. The T4 is 7 to 14 times slower and costs more per page.
- Getting it running took four fixes, all now in the script: the server is `paddlex_genai_server` (PaddleOCR 3.7 has no `genai_server` command), flash-attn's prebuilt wheel is installed by hand (the build has no GPU), `build-essential` is there for Triton's warm-up, and on a T4 `XFORMERS_IGNORE_FLASH_VERSION_CHECK=1` is set. They are the kind of thing that breaks on version bumps, so pin them.

**Reading fewer pages.** D346 reads every page on the Mac, where pages cost nothing. Another thread checked the Mac's own readings of the 16 text PDFs of the race: only 13 of 937 model calls (1.4%) were tables, display formulas or algorithms. The rest is text, and Ore swaps in pdf.js's words for it anyway. The headings and the reading order come from the layout model (PP-DocLayoutV3), not the reading model, and that model alone takes 3.1 s a page on a 4 vCPU CPU (96% of the Mac's boxes matched; `/mnt/project-files/pdf-race/layout-only/`). So the server could run the layout model on every page and the reading model only on table and formula boxes, boxes with no pdf.js text, and scans. That would be about 3.8 s a page on a plain CPU box (a 300-page book in about 20 minutes) and would keep D346's headings. This is an estimate, not run end to end. It would also bend D346 on the server, so it needs Tyler's yes.

**Recommendation: Modal on an A10, per second, with the same reading as the Mac.** It costs cents a book, nothing while idle, reads a 300-page book in under 3 minutes, and gives the same blocks the Mac gets, so the first device to finish can win (Q9) with no difference in what lands. A rented CPU box only makes sense with the layout-only reading above, and that is worth building only if GPU cost ever matters, which it won't at $0.11 per 1,000 pages. Revisit if Modal's prices or cold starts change, or if imports grow to where a GPU kept on all day (an A10 is about $950 a month) costs less than paying per second.

## 2. YouTube captions without yt-dlp

**What ran.** `yt-captions.ts` is plain `fetch`, the way the phone's own HTTP would make the requests, with no yt-dlp. It ran on Tyler's Mac on home Wi-Fi (VPN off), against yt-dlp 2026.10.26 there as the reference. Ore's own `vttWords` and `vttToBody` compared the results. 7 videos: 3 with captions written by people (one a TED talk with 25 tracks) and 4 with only automatic captions, 3 of them from Tyler's library. Every method ran 2 to 5 times between 00:28 and 00:46 UTC, and the results didn't change.

| Method | Result |
|---|---|
| Player API (`youtubei/v1/player`) as the **iOS** or **Android** app | Captions for all 7, every run. **Same words as yt-dlp, 100%, on all 7.** Captions written by people come out the same doc.md body. |
| The same as **visionOS** (yt-dlp's default without JavaScript) | "Sign in to confirm you're not a bot" on 6 of 7 |
| The same as **Android VR** | Blocked the same way on 6 of 7 |
| The same as **web** or **mobile web** | "The page needs to be reloaded" on all 7 |
| The watch page's `ytInitialPlayerResponse` | Finds the tracks, but every caption download is empty (HTTP 200, 0 bytes). It most likely needs a proof-of-origin token (not checked). |
| From a cloud IP (this box) | 429 on the watch page. "Not a bot" on most videos, from every client. |

**The catch is word times on automatic captions.** yt-dlp gets YouTube's word-timed automatic track (`<00:00:11.840><c> my</c>`). The iOS and Android clients get the same words with one time per two-line cue, in VTT, json3 and srv3 alike. Ore already spreads a cue's time over its words when there are no word times (`captionLines`). Against yt-dlp's real word times, that guess is off by a median of 1.2 to 1.4 s and 1.9 to 2.5 s at the 90th percentile. Captions written by people have no word times in either case, and those match exactly (gap 0). So on a video with only automatic captions:

- the transcript's words are the same, but its paragraph breaks differ from the Mac's (`sameBody` false),
- the word lit while the video plays runs up to about a line early or late,
- a highlight's time still lands within about a line.

**How fragile.** Medium to high. The iOS and Android clients work today with no token, but these are YouTube's private app APIs. yt-dlp ships new client versions and changes its default clients every few weeks for this reason: on 2026-11-27 its defaults are `tv_samsung` and `visionos`, and visionOS was already blocked here. A fix is a new client name or version string, and the phone can only get it through an app update, while the Mac's yt-dlp updates through Homebrew. Two things lower the risk: the phone asks from a home or cellular IP, which YouTube trusts more, and Ore can keep the Mac's yt-dlp as the fallback that redoes a transcript (D227's owed part).

**Recommendation:** on the phone, read captions through the player API as iOS, then as Android. Keep the transcript owed (D227) when both fail. When a Mac with yt-dlp is around, let it replace a transcript of automatic captions so their word times come back. Captions never go through the server: a cloud IP is refused.
