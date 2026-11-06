# Stress test: skill goals and parts (2026-10-29)

This review walks [`design/skill-goals-and-parts.md`](../design/skill-goals-and-parts.md) (A: a goal per skill, C: parts with several parents) through real use, from the UX side. Tyler is hesitant because of the complexity, and this checks whether that worry is right.

**Verdict.** Mostly yes. A is cheap, but its goal card has a real flaw. C adds about a dozen new rules across six screens, and its main promise, "the rings show the weak part", does not hold. The ring measures how cards were filed, not how skilled he is. Recommendation at the end: a smaller A, and C deferred.

## What each option adds

| | New things he has to understand | Screens touched |
|---|---|---|
| A | a goal line, a goal card, Try it, the last try | skill page, Review |
| C | Part of, the Parts card, roll-up of gems and Review, hidden-from-sidebar parts, choosing parents, priority inheritance, what happens when a parent is deleted | skill page, sidebar, ⌘K, Review picker (D80), add-box skill picker (D89), Home tiles, enrich, iPhone |

## A: goal per skill

1. **A repeated goal card is memorised.** The same prompt under FSRS gets the same answer back. By the third review he is recalling his last answer, not showing the skill. Remix (D66) varies a card only once he knows it, which is exactly the point where it is already rote. *Severity: high, because the card measures the wrong thing.*
2. **Performance goals don't fit a review card.** "Teach a 10-minute lesson" or "write a hook" can't be done in a 3-minute review slot (D60 caps active time per card at 3 min). Either he skips it or he rates a fake attempt, and FSRS then schedules on noise. *High.*
3. **Vague goals.** Most first goals read "Understand AI". A placeholder helps a little, but a vague goal becomes a card nobody can grade. *Medium.*
4. **A reworded goal loses its history.** Retiring the card on every edit throws away his past attempts over a typo. Keeping them would need a "did the meaning change?" rule. *Low, but it is one more rule.*
5. **What holds up.** One line on the skill page, no new screen, and it fits the purpose rule (the target for the skill).

## C: parts with several parents

1. **Parts start empty, so the rings lie.** His existing cards are filed under the parent (Teaching). New parts (Explaining clearly) begin at 0 and only fill if he re-files old sources or enrich starts choosing parts. The "weak" part is really the under-filed part. *Severity: high, because it breaks the reason for C.*
2. **Enrich has to pick between parent and part.** With 9 skills × 3–5 parts, that's 27–45 skills in the prompt. That means more wrong filings (D25 says enrich only assigns skills that obviously fit), and every card tagged to both counts twice in his head even when the roll-up counts it once. *High.*
3. **Parts aren't in the sidebar.** He can't drop a file or source on a part (the sidebar is where drag-to-file lives), and every visit to a part costs two clicks through its parent. If parts *are* shown, a part with two parents appears twice. *Medium.*
4. **The Review picker becomes a tree.** D80's "which skills?" list needs nesting, partial ticks and a rule for picking a part without its parent. A one-key step becomes a decision. *Medium.*
5. **Edge rules multiply.** Each of these needs a rule:
   - Deleting a parent moves its parts into the sidebar.
   - Detaching a part leaves the parent at a level it can no longer hold, because levels never drop (D63).
   - Changing a parent's priority quietly changes retention for every part's cards (D22).
   - Cycles have to be blocked.
   - Two parents means picking which sidebar row lights up.

   Each is fine alone; together they are the complexity Tyler is feeling. *Medium.*
6. **Most of it already exists.** Cards already carry several skills, and collections already group them. "Explaining clearly" can already be a skill of its own that sources share with Teaching. Only the roll-up and the Parts list are new, and the roll-up is the part that misleads (finding 1). *This is the main finding.*
7. **Purpose rule.** A Parts card of rings and counts is close to the stat chips removed in D72, unless the numbers mean something, and by finding 1 they often won't. *Medium.*

## Recommendation

- **Build a smaller A.** The goal is one line under the why, edited in place. **Try it** opens the closed-book recall the skill note already has (D41), prompted with the goal ("Without notes: <goal>"), and saves the attempt, dated, into the skill note. That way his tries sit side by side and he can see the gap (Hormozi's "measure the gap"). This means no new card, no scheduling and no rating, so findings A1, A2 and A4 go away. It costs one field and one prompt change to an existing flow.
- **Defer C.** To break a skill down for now, he writes its parts as headings in the skill note, or makes a narrower skill and tags sources with both. Revisit C only when a real skill gets big enough that he can't tell what's weak. The fix for finding C1 (re-filing old cards into parts) would have to come with it.
- **If he wants a nudge to retry the goal**, it is one line on the skill page ("Last try Oct 22"), never a reminder or a count (D23).
