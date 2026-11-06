# What should a skill's growth number be?

> Research, 2026-10-24. Accepted as D63 in [`DECISIONS.md`](../DECISIONS.md). Tyler asked which growth metric would make learning feel rewarding and meaningful, and whether it should also point at gaps.

## Recommendation

**Keep "strength" as the count of solid memories, and add meaning around it.**

- **Strength** = live cards with FSRS stability of 21 days or more (D62). In plain words: things you have a 90% chance of still recalling three weeks from now without looking.
- **Levels never go down.** The count can dip when you forget something, but the level shows the highest you have reached, and lapsed cards show as "3 to win back".
- **Secondary view** on the skill page: one bar split into Solid, Growing and New, plus a "You can now explain" list of solid Explain cards. The bar answers "where are my gaps"; the list makes growth feel real.
- **Meaning lever:** a one-line "Why I'm learning this" per skill, shown under its name, fed by the existing "Where would you use this?" question.

## Two levers: progress you can see, and a reason it matters

Game elements and meaning work through different routes, and the strongest designs use both.

- **Visible progress (the game layer).** Seeing yourself move toward a goal raises effort, and effort rises as the goal gets near. Gamification helps learning on average, but does little for the feeling of competence unless the feedback is about real skill. So the number must track what you actually remember.
- **Meaning (the reason layer).** Writing how material connects to your own life raises interest and performance, most for people who are struggling. Goals that fit your own values get more sustained effort. The best workdays are the ones where people make progress on work they care about.

## Evidence

| Finding | Effect | What it means for Ore |
| --- | --- | --- |
| Gamification of learning, meta-analysis [1] | g = .49 cognitive, g = .36 motivation | Worth doing; the effect held up in rigorous studies |
| Gamification boosts autonomy and relatedness but barely touches perceived competence [2] | g = .26 intrinsic, g = .28 competence | Points and badges don't make you feel skilled. Feedback tied to real recall does. Strength must count memories, not activity |
| Expected tangible rewards undermine intrinsic motivation; informational feedback does not [3] | d = −.40 | Frame strength as information about you, never as payment for minutes or cards |
| Measuring an enjoyable activity increases how much you do it but can lower enjoyment [4] | 6 experiments | No ticking counter during review. Show strength on Home and at session end |
| Goal gradient: effort rises near a reward; illusory head starts speed completion [5][6] | field data | Show "6 to level 3" rather than a bare total |
| Motivation sags halfway to a goal [7] | lab studies | Before the midpoint, frame as gained; after it, as remaining |
| Hard streak resets raise quitting [8] | +32% quit | Levels never drop. A dip is shown gently, as things to win back |
| Utility-value writing: connect material to your own life [9][10] | d up to .76 for low performers | A one-line "why" per skill, plus the closing "Where would you use this?" question (D53) |
| Self-concordant goals get more sustained effort [11] | 3 longitudinal sets | He writes the "why" himself. The app never suggests one |
| Progress on meaningful work is the top driver of good workdays [12] | 11,637 diaries | "You can now explain…" shows concrete progress in his own words |

## How others do it

- **Anki** calls a card *mature* once its interval reaches 21 days. "Solid" uses the same line on FSRS stability.
- **Khan Academy** labels each skill Attempted, Familiar, Proficient or Mastered, and a skill can slip back after a wrong answer [13]. Tiers in plain words read better than percentages.
- **Duolingo** once showed per-skill strength bars that decayed as its forgetting model predicted [14], then removed them; many learners read the decay as nagging. So current recall chance is not the headline: it falls every day you are away.

## Candidates

| Metric | Rewards | Problem | Verdict |
| --- | --- | --- | --- |
| Sources finished | Reading | Volume. Reading without retrieval barely sticks | Context only |
| Cards reviewed or minutes | Effort | Volume, and rewards reviewing too early. Minutes already drive the daily goal (D60) | No |
| Average recall chance now | Memory | Drops daily while you are away. Feels like guilt | No |
| Retention % | Accuracy | Flat once FSRS is tuned (~90%), so it never shows growth | Stats page |
| **Solid memories (stability ≥ 21 d)** | Memory that lasts | Grows with card count, so it can be padded (mitigated below) | Headline |

Stability does not decay with time. The count only falls when a review shows you forgot, so a week away never costs strength.

## Guardrails

- **Padding with easy cards.** Solid takes weeks of spaced reviews and new cards are capped, so it can't be farmed quickly. Calibration catches generous self-ratings.
- **Overjustification.** No rewards for strength: no unlocks, no badges, no sounds.
- **Measurement fatigue.** Strength appears on Home, the skill page and the end-of-session line, never during a card.
- **Comparisons.** Skills are never ranked against each other by strength.

## References

1. [Sailer & Homner 2019, The Gamification of Learning: a Meta-analysis](https://consensus.app/papers/details/848fef56a8d352b49110b45b36b4e4f2/), Educational Psychology Review.
2. [Li et al. 2024, Gamification enhances intrinsic motivation, autonomy and relatedness, but minimal impact on competency](https://consensus.app/papers/details/e4c6825e195e5580980420875fd86b94/), ETR&D.
3. Deci, Koestner & Ryan 1999, A meta-analytic review of experiments examining the effects of extrinsic rewards on intrinsic motivation, Psychological Bulletin 125(6).
4. [Etkin 2016, The Hidden Cost of Personal Quantification](https://consensus.app/papers/details/b4b8cbc7d2a1544bb45c6bb499017ad5/), Journal of Consumer Research.
5. [Kivetz, Urminsky & Zheng 2006, The Goal-Gradient Hypothesis Resurrected](https://consensus.app/papers/details/814cd0e2739554448827df3ab4cf4173/), Journal of Marketing Research.
6. [Nunes & Drèze 2006, The Endowed Progress Effect](https://consensus.app/papers/details/306ea700e0ec5ddc806c53e1059f55ba/), Journal of Consumer Research.
7. [Bonezzi, Brendl & De Angelis 2011, Stuck in the Middle](https://consensus.app/papers/details/95154fe016bc57098b46875c252bf42a/), Psychological Science.
8. Kang et al. 2022, PNAS (N = 14,383), via the learning-science brief §10.
9. [Hulleman et al. 2010, Enhancing interest and performance with a utility value intervention](https://consensus.app/papers/details/8aef9305d19f5be0ac3643e10cf80f7e/), Journal of Educational Psychology.
10. [Hulleman et al. 2017, Making Connections](https://consensus.app/papers/details/6f0b6c8465d559ecb79a172950e7f937/), Journal of Educational Psychology.
11. [Sheldon & Elliot 1999, Goal striving, need satisfaction, and longitudinal well-being](https://consensus.app/papers/details/414bfd0e1b9653c9832549bc522916b0/), JPSP.
12. [Amabile & Kramer 2007, Inner work life](https://consensus.app/papers/details/501e44ec9c6d573f87d785d2bc59fb3e/); book: The Progress Principle (2011).
13. [Khan Academy Help: How do Khan Academy's Mastery levels work?](https://support.khanacademy.org/hc/en-us/articles/5548760867853)
14. [Duolingo blog: How we learn how you learn](https://blog.duolingo.com/how-we-learn-how-you-learn) (half-life regression, Settles & Meeder 2016).
