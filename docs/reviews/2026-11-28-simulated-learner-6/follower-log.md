# Follower friction log

Day 1 = 2026-11-28, 08:00 local; days advance one calendar day at a time, visits on 1, 3, 5, 8, 12, 14. Only own scratch library is used.
- Day 1 | 6 Read / adding | Followed BAIR (791 ms backend), One Useful Thing (798 ms), and Latent Space (801 ms; discovery 1,298 ms). BAIR and newsletter have no eligible posts; newsletter proof says 20 posts, newest Nov 9. Latent Space provides dated November posts. All waits displayed follow status.
- Day 1 | 6 Read | Coding-data article opened in 1,313 ms with Opening shown. Read the task/verifier explanation and unverified-sabotage discussion; saved own summary. Not saved cleared; 68 documents vs 67 baseline.
- Day 1 | 6 Read | Encoding the encyclopedia on a rod opened in 4,894 ms; all four timestamped paragraphs and description present, read to 01:58. Player could not start; transcript allowed the lesson. Own note kept it. Video-shell limitation to investigate, not yet a finding.
- Day 1 | 6 Close | Marked all 18 remaining unread. Undo restored 18. Immediate Redo followed by reload did not persist redo; automation interruption, not yet a finding. Repeated mark and waited for save.
- Day 3 | 2 Open | Day 3, Nov 30: all prior dismissals stayed dismissed after automatic refresh; no new live posts. Used Show all to choose two previously dismissed posts.
- Day 3 | 6 Read / adding | Inside the AI Training Data Market — Gabe Greenberg, G2i opened in 30962 ms.
- Day 3 | 6 Read / adding | [AINews] Math Proofs Are Landing Faster Than We Can Read Them opened in 1829 ms.
- Day 3 | 6 Read / adding | Encoding the encyclopedia on a rod opened in 3836 ms.
- Day 3 | 6 Read | Repeat: kept Short opened from Feed All in 3,836 ms as a new Not saved preview; Source note empty, while original annotated source remains. Seen twice after saving. Podcast opening cost 30,962 ms with row Opening. Read 00:00–20:34 and ending; kept podcast and math-proofs post.
- Day 3 | 6 Close | Marked rest read; Undo of one read leaves intentional unread: How Clay Builds GTM Agents — Jeff Barg, Head of AI.
- Day 5 | 2 Open | Day 5, Dec 2: only How Clay Builds GTM Agents returned, exactly the post intentionally restored with Undo on day 3. Other dismissed posts stayed dismissed.
- Day 5 | 6 Read / adding | The War Against Slop and an Emerging Weapon to Fight it: Formal Verification opened in 3338 ms.
- Day 5 | 6 Read / adding | The Revolution vs The Renaissance — Thariq Shihipar, OpenAI opened in 49059 ms.
- Day 5 | 6 Read | Formal-verification article read through all sections and own summary saved. Second keep: Renaissance talk for later; 49,059 ms to transcript.
- Day 5 | 6 Close | With only one unread post, Command-click selected it; Shift-Command-U gave no response and it stayed unread for 12 s. Context-menu recovery needed.
- Day 5 | 6 Close | Marked rest read; Undo of one read leaves intentional unread: How Clay Builds GTM Agents — Jeff Barg, Head of AI.
- Day 8 | 6 Close | Repeat after reload: Command-click single unread post, Shift-Command-U; still selected/unread after 250 ms, no write or feedback. Same as day 5.
- Day 8 | 2 Open / adding | Day 8, Dec 5: unfollowed Latent Space, verified four feeds on disk, followed again (1,308 ms), verified five. Dismissals stayed read; kept posts stayed absent except already-confirmed Short variant, now expired.
- Day 8 | 6 Read / adding | [AINews] Gemini 4 Neon marks opened in 1310 ms.
- Day 8 | 6 Read / adding | [AINews] Jensen Is Back! opened in 1828 ms.
- Day 8 | 6 Read | Kept Gemini evaluation roundup and Jensen/perplexity roundup; opening paragraphs feel disconnected (Jensen opens As Matt Levine; no setup for who was fired, then Think of it without naming perplexity). Checking saved original against import.
- Day 8 | 6 Close | Dismiss 1 unread posts: 294 ms.
- Day 8 | 6 Close | Marked rest read; Undo of one read leaves intentional unread: How Clay Builds GTM Agents — Jeff Barg, Head of AI.
- Day 8 | 6 Read / verification | Reimport backend 692 ms. Introducing Gabe paragraph still absent; original has it. Jensen separately lacks introductory paragraphs.
- Day 12 | 6 Add | Old DeepMind URL followed in 1,043 ms backend, redirected to current Google DeepMind RSS. Successful migration, not a broken-feed failure.
- Day 12 | 2 Open | Injected refresh command failure twice: visible HTTP 503 error; cached post stays, feed files unchanged. Clearing hook and reopening refreshes successfully. This is simulated command failure, not a real publisher outage.
- Day 12 | 6 Read / waiting | Clay episode exceeded 60 s UI wait; bridge feed open measured 65,590 ms, transcript then visible 00:00–72:04. Opening state retained; no blank failure.
- Day 12 | 6 Read / coverage | Only one eligible unkept post remained; kept Clay and studied evaluation, model-choice and trace-analysis passages. Feed All now empty; cannot keep a second post without leaving the assigned five-feed/two-week window.
- Day 14 | 2 Open | Day 14, Dec 11: Feed All has no eligible unkept posts. No new server publications appeared during the simulated calendar; no dismissal resurfaced.
- Day 14 | 6 Read | Day 14 reopened saved formal-verification source in 198 ms. Day 5 note survived verbatim; reread specification-versus-proof sections.

## Final file audit and measurement notes

- All days: zero new ratings; every review-log snapshot matches baseline. Day 14 Home shows 0 of 10 min. No end screen used.
- Day 14: nine kept sources and nonempty notes, five subscriptions, zero leftover previews; original Short note retained. All owned browser contexts/connections closed.
- Source completeness: inspecting original HTML was necessary to understand who “He” was and what “Think of it” referred to. The reader should have retained those explanatory paragraphs; code inspection only identified the extraction boundary, not the exact removal heuristic.
- Late audit: all measured action waits are in timings.jsonl, all backend waits over one second in slow-requests.json. Feed refresh waits: day 12 1.984/1.701 s, day 14 1.975 s. Reimport 0.692 s; moved-feed follow 1.043 s.
- Instrumentation exclusions: two 60-second selector timeouts expected the wrong success/error wording (reimport and successfully moved DeepMind feed); not app waiting. Automation setup/recovery time is not reported as learner study time. No artificial reading dwell or full-podcast viewing was claimed.
