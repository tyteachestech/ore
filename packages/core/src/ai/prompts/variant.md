---
name: variant
version: 2
---
You write one new version of a review exercise Tyler already knows, for his spaced-repetition review. The new version asks him to use the same idea on a case he hasn't seen, so he has to apply it instead of recalling the answer he has memorized. It replaces the original only in how the exercise is asked; it never adds anything new to know.

Input (JSON):
- original: the exercise (kind, content_type, question, answer) and `points`, the key points a full answer needs, numbered from 0.
- passage: the highlighted source passage and his note on it, when there is one. Use it only to check facts.
- skills: the skills the exercise is filed under, each with a one-line hook saying why it matters to him.
- allowed_types: the version types you may write. avoid_type: the type shown last; pick a different one.
- earlier: versions already written, with their setting and, for rejected ones, why. Do not repeat a setting or a question, and do not repeat a rejected one's mistake.

Types, each with how to write it and what to avoid:
- new-case: a new situation; the ask stays the same ("why does it help here, and what wouldn't it help with?"). Ask for a decision or a product in that situation. Never the source's own example, which is recall.
- predict: "what happens if…" in a new situation whose outcome the idea decides. He gives the outcome and the reason. Never a coin flip, an outcome nobody could know, or one that something other than the idea decides.
- diagnose: a short claim or plan that is right except for exactly one mistake: a realistic one, a misconception people really hold, not a typo or a silly slip. He finds it, says why it is wrong and fixes it; the answer names the mistake, the reason and the fix, so the wrong statement never stands uncorrected.
- choose: two options for a case that differ on the one feature that matters, both ones a sensible person might pick. He writes the pick and the reason; never a list to tick, never an option that is plainly silly.
- name-it (definitions): a short new case that shows the concept without its name or the name's root, and that only this term fits. He names the term and says what gives it away.

The boundary is the original's points. Every rule below must hold:
1. Each of your key points tests one original point; give its index as `tests`. At least one tests the exercise's main idea. Nothing tests an idea outside the original's points.
2. Someone holding only the original answer and the passage could write a full answer. Any fact the scenario adds is stated in the question itself, so he never needs outside knowledge.
3. Same claim, same caveats. "According to <author>" carries over. Never make the claim stronger or broader than the source does.
4. At least one key point can only be met by applying the idea to your case. Repeating the original answer word for word should earn partial credit at most.
5. No shared wording: the question must not share a run of 5 or more words with the original question or answer. Name the idea only if the original's question does.
6. A new setting each time, drawn from his skills' hooks (his writing, teaching, building AI systems, his creator business, and so on). Not the source's own example and not an earlier version's setting.
7. The question gives nothing away: it does not state the answer or the key points.

Keep it short: the question is 1 to 3 sentences, never a case that takes longer to read than to answer; the answer 2 to 4 sentences, each key point one line.

Return JSON only:
- type: one of allowed_types
- setting: the setting in 2 to 5 words, e.g. "planning a YouTube explainer"
- question, answer: the new version
- points: 2 to 4 objects, { text: the key point for this version, tests: the original point's index }
