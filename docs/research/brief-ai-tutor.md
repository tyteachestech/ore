# The tutor chat: what the science and other products say

Research for the bottom-right tutor built on Ask your library (PR #42). 2026-11-07.

## The short version

An AI chat helps learning when it makes him think and hurts it when it does the thinking for him. The best evidence (a ~1,000-student field trial) found that plain ChatGPT raised practice scores 48% and then *lowered* the unaided exam 17%; the same model with hints instead of answers raised practice 127% and did no harm. A carefully structured tutor in a Harvard physics course beat an active-learning class. So the tutor's whole design job is three things:

1. **Never do the retrieval he is supposed to do.** Explaining what he asks is fine; answering a question he is meant to recall is not.
2. **Stay grounded in his sources**, with citations, so it doesn't teach him something wrong.
3. **Send what he learns in chat back into review**, or it fades like any other conversation.

Everything else (the bubble, the mascot) is delivery. Keep it small.

## What the science says

| Finding | Evidence | What the tutor does |
|---|---|---|
| Answer-giving harms later performance; hint-giving doesn't | Bastani et al. 2025, PNAS (GPT Base +48% practice, −17% exam; GPT Tutor +127% practice, exam ≈ control) | Before he has answered a card, prequestion or quiz question, it gives hints, never the answer (already D61 and D34.3) |
| Using an LLM as a *substitute* (it solves) covers more but understands less; as a *complement* (it explains) understands more | Lehmann, Cornelius & Sting 2025, two pre-registered experiments | His own "why / how / what's an example" questions get straight answers. Problems and practice get the hint ladder |
| A tutor built on pedagogy beats a good class: one step at a time, the learner does each step, correct solutions given to the model | Kestin et al. 2025, *Scientific Reports* RCT | One question per turn, wait for his answer, ground every claim in his passages (the ask-library prompt already refuses outside knowledge) |
| Hints help most as a ladder he climbs on request; jumping to the bottom rung ("just tell me") is the classic way tutors are gamed | Koedinger & Aleven 2007 (assistance dilemma); Aleven et al. on help abuse; OATutor's hint → scaffold → solution pathways | Three rungs: a nudge, a narrower question, then the worked answer. The last rung is always available (respect his time) and offers to make it a card |
| Novices learn more from a worked example first; experts learn more from solving | Sweller; Kalyuga (expertise reversal) | "I have no idea" gets a worked example, then a similar one for him to try |
| Retrieval with feedback, spaced, is what makes it last | Yang et al. 2021 (g ≈ 0.5); already Ore's base | Any turn can become a card in one click (D9: drafts go live). Quiz me pulls from his real cards and questions |
| Students who lean on AI on-demand lose self-regulation, especially weaker ones | Dai et al. 2025, two RCTs | The tutor appears when he opens it. It never pops up uninvited |
| Animated "pedagogical agents" help a little, not a lot; on-screen text beats narration | Schroeder, Adesope & Gilbert 2013 meta-analysis (43 studies, small but significant effect) | The mascot is for warmth and to show it's working, not a talking character. Text replies, no voice by default |
| Socratic modes annoy when they ask a pile of questions before helping | Tom's Guide test of ChatGPT study mode vs Claude learning mode (Aug 2025): Claude "prioritizing diagnostics over action", "overly verbose" | One question at a time, 2 to 5 sentences, help on the first turn |

## What other products do (and what to copy)

- **NotebookLM**: answers only from your sources with numbered citations that open the passage. *Copy:* exactly what Ask your library does; keep it. Its suggested questions after an answer are a good nudge toward deeper questions.
- **Khanmigo**: knows the exercise on screen and won't hand over the answer; asks "what do you think the first step is?". *Copy:* screen context, plus the no-spoiler rule tied to what's on screen.
- **ChatGPT study mode / Claude learning mode / Gemini Guided Learning**: a toggle that turns the chat Socratic. Reviewers like the idea and complain it's slow, verbose, and one click from getting the answer anyway. *Copy:* the intent, not the toggle. Ore knows when a question is practice (a card, a prequestion) and when it's curiosity, so it can pick the stance itself.
- **Duolingo Max "Explain my answer"**: chat that opens only after you've answered. *Copy:* already D61. Duo's personality lives in the copy and in small reactions, not in a chatty character.
- **Clippy**: the warning. An animated helper that interrupts is hated; one you summon is fine.
- **Grok companions**: animated characters built for companionship and engagement. *Don't copy* the parasocial part; it pulls against D23 (no engagement mechanics).

## Code and data worth borrowing

| What | License | Use |
|---|---|---|
| OATutor's hint pathway format (hint, scaffold with answer, solution; each depends on earlier ones) | MIT code, CC BY 4.0 content | The data shape for the hint ladder. No need for the app itself |
| assistant-ui (`@assistant-ui/react`) | MIT | Only if the panel outgrows AskLibrary.tsx: streaming, autoscroll, composer, retry. Probably not needed for v1 |
| LearnLM's approach: pedagogy written as system instructions per mode, not baked into one prompt | paper, no code | One versioned prompt per stance (answer, hint, quiz) in `packages/core/src/ai/prompts/` |
| OpenAI's study mode and Anthropic's learning mode prompts | not licensed | Read for ideas, don't copy text |
| Mascot art | — | Draw it ourselves on the pixel icon grid (D105) as a CSS `steps()` sprite sheet. Avoid Live2D and Spine (proprietary runtimes) |

## Recommended shape

- **One button bottom right, a docked panel when opened** (Raycast AI / Linear Ask). ⌘J or similar toggles it; Esc closes. Hidden while a quiz or recall hides the source (D34.4), and in Review before he answers.
- **It sees where he is**, shown as one removable chip above the input ("Reading: *Title*", or the card after he answers). Purpose: he knows what it's answering about.
- **Stance picked from context, no mode switch.** His own question → a cited answer from his library. Practice he hasn't answered yet → hints only. "Quiz me" → one question at a time from his cards and questions on that source or skill.
- **Every useful turn can become a card** with one action, so chat feeds FSRS.
- **Short.** One question per turn, 2 to 5 sentences, citations as small numbers.
- **The mascot comes later and does one job first**: it is the button and the working indicator (thinking while it waits, a small reaction when it lands). No idle animation, no speech bubbles of its own.

## Design calls for Tyler

1. **What it does with a question he's supposed to answer himself** (a card before he answers, a prequestion, a quiz question).
   - A: hints only, with a "show me" last rung that also offers a card. *(recommended: Bastani's guarded version, without trapping him)*
   - B: answers anything, like plain ChatGPT.
   - C: refuses until he answers.
2. **Where it opens.**
   - A: a docked panel on the right, the page stays usable beside it. *(recommended: he can read and ask at once)*
   - B: a floating chat card over the corner (Intercom style).
   - C: no bubble; ⌘K "Ask" only (today).
3. **How Quiz me grades.**
   - A: uses his real cards, he rates them as in Review, so it counts toward FSRS. *(recommended: one review system, no second score)*
   - B: unscored practice on fresh questions, like the in-reader quiz.
4. **Mascot scope for the first version.**
   - A: none yet; plain pixel button. Add the character once the tutor earns daily use.
   - B: a small pixel sprite with three states (idle, thinking, done) that doubles as the working indicator. *(recommended: it has a job, and it's cheap)*
   - C: the full animated, customizable character now.

## Sources

- Bastani et al. 2025, "Generative AI without guardrails can harm learning", PNAS: <https://knowledge.wharton.upenn.edu/article/without-guardrails-generative-ai-can-harm-education>
- Lehmann, Cornelius & Sting 2025, "AI Meets the Classroom": <https://arxiv.org/abs/2409.09047>
- [Kestin et al. 2025, "AI tutoring outperforms in-class active learning", Scientific Reports](https://consensus.app/papers/details/f12731c50ae651e59469569386ea8ed9/?utm_source=claude_desktop)
- [Dai et al. 2025, "How Students Use AI Feedback Matters"](https://consensus.app/papers/details/fec6e43c450857eeb71788d2fe9a5731/?utm_source=claude_desktop)
- [Tufino 2025, "NotebookLM as a Socratic physics tutor"](https://consensus.app/papers/details/ec394ada7e1c51ee863553868648d53a/?utm_source=claude_desktop)
- Schroeder, Adesope & Gilbert 2013, pedagogical agents meta-analysis (abstract): <https://karlkapp.com/abstracts-of-three-studies-related-to-pedagogical-agents/>
- LearnLM, "Improving Gemini for Learning": <https://arxiv.org/abs/2412.16429>
- OATutor: <https://github.com/CAHLR/OATutor> · assistant-ui: <https://www.npmjs.com/package/@assistant-ui/react>
- Tom's Guide, ChatGPT study mode vs Claude learning mode: <https://www.tomsguide.com/ai/i-tested-chatgpt-5-study-mode-vs-claude-learning-mode-with-7-prompts-heres-the-winner>
- Koedinger & Aleven 2007 (assistance dilemma), Kalyuga (expertise reversal), Yang et al. 2021 (testing effect): from Ore's existing briefs, `docs/research/brief-learning-science.md`.
