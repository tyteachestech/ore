# Ask your library

The tutor (D128, ⌘J) answers Tyler's questions from his own sources. Each claim carries a numbered citation; clicking it opens the source with the quoted passage marked. When his sources don't hold the answer, the reply says so, then searches the web for a specific fact and cites the pages the same way (D137; a click opens the page), or answers a general explanation from what it knows, labelled "Not from your sources". `ore ask-library` is the same search with a stricter prompt that answers only from the library or says it can't.

```bash
bun run eval:ask                       # the tutor, Claude and Codex; spends AI usage, never in CI
bun run eval:ask --chat ask            # ore ask-library instead
bun run eval:ask --vendor claude --model claude-haiku-5-5
bun run eval:ask --vendor claude --library big   # with ~240 generated sources around the golden docs
```

## How it works

1. **Search** (`packages/core/src/ai/ask.ts`, `retrieve`). The question loses stop words and is cut to stems ("spacing" → "spac", "memories" and "memory" → "memor", "quizzing" → "quiz"), matched as prefixes. SQLite FTS5 ranks sources by BM25 (`db.ts`, `sourcesMatching`) and keeps the best six. Each is cut into paragraph passages under their headings, and passages are ranked by BM25 again (k1 1.2, b 0.75): a rarer word counts more, a word said again counts for less each time, and a long passage's matches count for less than a short one's. Title and heading words count half. Up to 14 passages go to the AI, five at most from one source (10 lost three questions' evidence in a 250-source library). The tutor puts the open source and anything he @-mentions first, then up to 12 from the rest of the library (`tutorPassages`).
2. **Answer**. The AI sees only the numbered passages and returns JSON: the reply with `[n]` markers, and per marker a passage id and an exact quote.
3. **Check**. Every quote must be found in its passage (`locate`, the same fuzzy anchoring highlights use), every marker must have a citation, and an unknown passage is refused. A web citation's URL must be one the search returned and its quote words the search returned: a web task runs `claude -p` with `--output-format stream-json`, whose events carry each WebSearch's links and text (`webSeen` in `adapter.ts`). A failed check goes back to the AI once with the reason.
4. **Stream** (D138). While the AI writes, the reply so far goes to the app as it comes, so the first words show in about 2 seconds; its markers wait for the citations, which come with the checked answer.
5. **Place**. Each quote is mapped to its character offsets in the source's `doc.md`. The citation opens the reader at `q:start:end`, which marks that range (`apps/desktop/e2e/journeys.ts`, "tutor citation").

## The eval

- **Set** (`packages/core/eval/ask-cases.json`): the golden sample docs (`packages/core/test/golden`: Wikipedia, Python docs, a textbook PDF, EPUB, Word, slides, a notebook, a YouTube transcript) imported into a scratch library. 20 questions they answer, each with answer patterns, the sources that hold it and an evidence pattern. 9 they don't: two off-topic, seven near misses where the person or topic is there but the fact isn't (Ebbinghaus's birth year, FSRS's default retention next to an unrelated "90%").
- **Harder set** (`hard`, 14, scored on its own line so the headline numbers stay comparable): paraphrases that share few words with their passage ("what happens overnight that helps memories stick?" against "consolidation happens during sleep"), follow-ups that need the turn before ("who came up with it?"), questions about the open source ("how does this say to fight it?"), and two-source questions whose answer must cite both.
- **Retrieval**, with no AI: do the passages from the expected sources that reach the AI hold the evidence and every part of the answer? CI checks this for all 34 questions on both chats, in the golden library and again with seed-big's ~240 sources around it (`--library big` runs the whole eval that way) (`packages/core/test/eval-ask.test.ts`), so a search change that loses evidence fails the build for free.
- **Answer**: every pattern matches the reply.
- **Citation**: every quote is really at its offsets in its source, and one comes from an expected source and holds the evidence.
- **Not in library**: an absent question is right when the reply says the answer isn't from his sources: in words ("your sources don't give his birth year"), or, with no passage cited, by the "Not from your sources" label or a web page's link. It may cite what his sources do say nearby, but then it has to say so in words, or the citation reads as the answer's source. Where the fact is settled (`outside` patterns: Ebbinghaus's birth year, the walrus operator's Python version), the answer from the web or general knowledge must also be right. The report counts how many cite the web and how many use general knowledge.
- **Searched needlessly**: answerable questions where the tutor searched the web anyway. It should be 0: his library comes first, and a search adds about 5 seconds.
- **Median reply**: the median time for an answerable question and for an absent one (which usually searches).
- Answer and citation accuracy carry 95% intervals, as in the grading eval.

## Design decisions

- **Keywords before embeddings.** BM25 is a strong, cheap first-stage retriever (BEIR), it runs on the index Ore already keeps, works offline, and needs no model download (D120). Its known gap is vocabulary mismatch ("why do I forget?" against a passage about "decay"). The retrieval score shows when that starts to cost answers, which is the signal to add embeddings or hybrid search.
- **Exact quotes, checked in code.** A citation is a quote the code finds in the passage, not the model's say-so. That rules out invented quotes and makes the jump exact. It doesn't prove the model used the passage rather than citing it afterwards (Wallat et al.); the answer patterns and the near-miss questions are the check on that.
- **Score retrieval apart from the answer.** When an answer is wrong, the first question is whether the evidence ever reached the model. Splitting the two keeps a search bug from being blamed on the prompt.
- **Near misses for abstention.** Off-topic questions are easy to refuse. The risk is a related passage that tempts the model to stretch: larger models often answer wrongly instead of abstaining when the context falls short (Joren et al.).
- **Test what ships.** The eval asks the tutor, the chat the app uses, not only the CLI's stricter prompt.

## Limits

- 34 answerable questions over 11 docs, all written for this eval; the paraphrases were written knowing the passages, so they are milder than his real questions. At scale the distractors are seed-big's generated sources, which repeat their topic's words more than real writing does; a real library of his would be the better test.
- Answer patterns are regexes: a right answer in unexpected words can fail, and a wrong one that names the right terms can pass.
- The tutor answers an absent question from the web or general knowledge after saying so (D137); the eval counts that right when the answer is, and reports how often each happens. `ore ask-library` refuses instead.
- A web quote is checked against what the search returned, which is the search tool's summary of the pages, not the page itself: it proves the link and words were really returned, not that the page says exactly that. Codex reports no search results, so its web links are only checked to be links.
- "Says it in words" is a phrase match, not a judge: a refusal in unusual words can fail.
- Two answer patterns were loosened after reading the 2026-11-08 misses, both cases a right answer the pattern was too literal for ("connects names to objects" for "mapping"; a citation of the 1880s sentence the name follows). Changing labels after looking at outputs is normal (criteria drift, Shankar et al.), but it means later runs, not that one, are the clean measure.

## Learn more

Newest first; the older ones are where the terms come from.

**2025–2026**

1. Sorodoc et al., [GaRAGe: A Benchmark with Grounding Annotations for RAG Evaluation](https://aclanthology.org/2025.findings-acl.875.pdf) (Findings of ACL 2025). Every passage is labelled by whether it answers the question. Models declined to answer at most 31% of the time when nothing relevant was retrieved, and their citations hit the relevant sources at most 58.9% F1. Abstention and citation need their own scores.
2. Muller et al., [GroUSE: A Benchmark to Evaluate Evaluators in Grounded Question Answering](https://aclanthology.org/2025.coling-main.304.pdf) (COLING 2025). 144 unit tests of grounded answers, including "negative rejection": say plainly that the material can't answer. Automated RAG evaluators miss failure modes even with GPT-4 as judge, which is why this eval checks quotes in code.
3. Joren et al., [Sufficient Context: A New Lens on Retrieval Augmented Generation Systems](https://arxiv.org/abs/2411.06037) (Google, 2024–25). Separates "the retrieved context is enough" from "the answer is right". Larger models often answer wrongly instead of abstaining when the context falls short; abstaining on insufficient context raises the share of right answers by 2 to 10%.
4. Akarsu et al., [From BM25 to Corrective RAG](https://arxiv.org/abs/2604.01733) (preprint, Apr 2026). On text-and-table documents BM25 beat current dense retrievers on precise queries. Keyword search is still a serious baseline, not a placeholder.
5. Anthropic, [Citations](https://platform.claude.com/docs/en/build-with-claude/citations) (API docs, 2025). The vendor's built-in citations return exact character ranges in the source, the same shape Ore builds by hand. They can't be combined with structured JSON output, which is why Ore checks its own quotes instead.

**Foundations**

6. Wallat et al., [Correctness is not Faithfulness in RAG Attributions](https://arxiv.org/abs/2412.18004) (Dec 2024). Up to 57% of citations are attached after the fact: correct, but not what the model used. A checked quote is necessary, not sufficient.
7. Gao et al., [Enabling Large Language Models to Generate Text with Citations](https://arxiv.org/abs/2305.14627) (ALCE, EMNLP 2023). The benchmark that defined citation recall and precision; even the best models lacked full citation support half the time.
8. Thakur et al., [BEIR](https://arxiv.org/abs/2104.08663) (NeurIPS 2021). Across 18 retrieval tasks BM25 is a robust zero-shot baseline; rerankers beat it at much higher cost.
9. Anthropic, [Introducing Contextual Retrieval](https://www.anthropic.com/news/contextual-retrieval) (2024). Prefixing each chunk with a line of context before indexing, for both BM25 and embeddings, cut retrieval failures by 49%. The cheapest next step for Ore's search.
10. SQLite, [FTS5](https://www.sqlite.org/fts5.html). The index itself: `bm25()` ranking (smaller is better) and prefix queries (`"spac"*`, star outside the quotes).
