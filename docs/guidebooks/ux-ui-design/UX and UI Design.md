# Chapter 01: The Functional Case for Design

*Why looking good isn't vanity — it's the mechanism*

## 1. What This Is

Here's something that probably matches your experience: you open an app for the first time, and within a second or two — before you've tapped a single button — you already have a feeling about it. This one seems polished. That one seems cheap. You'd trust this one with your data; you'd hesitate with that one. The weird thing is that you haven't actually *used* either of them yet. You've just looked.

That feeling isn't irrational, and it isn't merely superficial. Your brain is making a rapid initial assessment from the visual information available before interaction begins. Research shows that this first impression can form extraordinarily fast — within about 50 milliseconds of exposure, before you can read the interface.

This chapter is about why that matters for you as a builder. If you've ever thought "I'll clean up the design later once the features work," or "I'm not a designer so I'll just keep it simple and functional," this chapter is specifically for you. The argument isn't that you need to obsess over aesthetics before you write a single line of code. The argument is that **aesthetics and usability are not separate concerns** — they interact. Visual quality can shape perceived usability. An attractive interface may feel easier to use at first, while actual interaction quality determines whether that impression holds. Design quality is not merely decoration layered on top of function; it supports the function.

The practical implication: understanding *why* this happens gives you the leverage to do something about it — even as a true beginner.

## 2. What The Research Shows

### The founding insight: beauty predicts perceived usability

In 1995, two researchers showed 252 student participants 26 different ATM screen layouts that had been designed by engineers and designers at Hitachi in Tokyo. They asked participants two things: how easy does this look to use, and how beautiful is it? The resulting correlation between perceived ease of use and beauty was r=0.589 — substantially stronger than the correlation between ease of use ratings and any of the seven objective usability strategies built into the designs.

Let that land for a moment. The researchers had deliberately built different usability features into the layouts — things like key grouping, familiar button arrangements, and safety distance on the cancel button. None of those structural usability decisions predicted how easy users thought the layouts would be. But beauty did.

The obvious skeptic response is: so what? Maybe users just can't evaluate usability from a screenshot. Maybe perceived ease-of-use doesn't matter as long as the real usability is good. Noel Tractinsky's team put that objection directly to the test in 2000.

They used the same ATM layouts from Kurosu's study, but this time they had participants actually *use* the interfaces — with one group using a high-usability version (smooth, fast, reliable) and another using a low-usability version (with delays, unresponsive buttons, and forced long paths). After actually interacting with the system, they asked again: how usable was that? How beautiful?

The results are genuinely striking. Post-use aesthetic ratings predicted post-use usability ratings at r=0.71. And here's the headline finding from the paper: the **actual usability manipulation had no significant effect on perceived usability** (F=1.38, p=.44). Let that sink in. One group had used an interface that was objectively harder, slower, and more error-prone. The other group had used an interface that was objectively smooth and efficient. When asked how usable it was, both groups' answers were driven primarily by how pretty it looked — not by what they had just experienced. The title of the paper says it plainly: "What is beautiful is usable."

Pause and predict: Before reading on, consider: if beauty shapes perceived usability this strongly, what does that mean for user reviews of your app? Would users blame "bugs" for experiences that were actually about visual quality?

### First impressions form in 50 milliseconds and they stick

Gitte Lindgaard and her colleagues at Carleton University ran a series of experiments to find out how quickly a visual appeal judgment forms. In their key study, participants saw website homepages for either 50 milliseconds or 500 milliseconds, then rated their appeal. The 50ms group's ratings correlated with the 500ms group's ratings at r=0.947 — nearly interchangeable. Ratings given on the second viewing correlated with the first at r²=.89 at the 50ms exposure level.

Fifty milliseconds is fast. A typical eye blink takes 100-400ms. At 50ms, you cannot read a word. You cannot focus on a specific element. You are registering a holistic visual impression — the overall spatial structure, the color palette, the density of information — before your conscious brain has fully engaged. And yet that impression predicts a composed, deliberate judgment made with ten times more exposure.

The implication for app builders is direct: the visual impression your app creates at the moment of first launch is not just a first impression in the social sense. It's a prior that shapes every interaction that follows. The Tractinsky data shows that this prior is sticky — users who started with a beautiful interface kept rating it as more usable even after experiencing the same friction as users who started with an ugly one. Your visual design sets expectations, and expectations bias experience.

Think about the last time you opened a new app and it loaded a clean, spacious, carefully considered interface. Contrast that with one that felt cramped, inconsistent, or generic. You were more forgiving of the polished one's quirks. You were quicker to blame yourself ("I must be doing something wrong") rather than the design. That asymmetric forgiveness is the aesthetic-usability effect working in real time.

🔗 **Connect:** Think about Raycast, Things, or Bear — apps you genuinely love using. How much of that love do you think is about the feature set vs. the visual quality? Could you cleanly separate the two?

### What "beautiful" actually means: two kinds of aesthetics

Not all visual qualities predict usability equally. Tally Lavie and Noel Tractinsky's 2004 scale-development research (n=866 across four studies) identified two distinct aesthetic dimensions that users consistently perceive in interfaces.

**Classical aesthetics** is orderly, clear, clean, symmetric, well-organized. Think Things 3: every pixel is purposeful, nothing is ambiguous, the spatial structure is immediately legible. Classical aesthetics correlates with perceived usability at r=0.68 to r=0.78 — a very strong relationship.

**Expressive aesthetics** is creative, original, sophisticated, uses special effects, feels distinctive. Think Arc browser or Fantastical: they have a visual personality, they surprise you, they have an artistic point of view. Expressive aesthetics correlates with perceived usability more modestly, at r=0.40 to r=0.46.

Both contribute to how much users enjoy the experience, but they contribute differently. Classical aesthetics — the orderly, clean kind — is where the usability link lives. This is actually clarifying news for a beginner: you don't need to develop a bold artistic vision to make your app feel more usable. You need clean, organized, clear visual structure. Clarity is simultaneously aesthetic *and* functional. A clean layout isn't just easier to use — it *looks* easier to use, which makes users feel like they're succeeding even when they're navigating modest complexity.

The practical vocabulary: when you look at an interface and think "this feels professional," what you're usually noticing is classical aesthetics. When you think "this feels distinctive," you're noticing expressive aesthetics. Both are worth pursuing eventually, but classical comes first — it's the foundation.

### Beauty produces measurable performance differences

Andreas Sonderegger and Juergen Sauer's 2010 study added something the earlier work lacked: actual performance measurements. They gave 60 participants functionally identical simulated mobile phones — one with an attractive visual design, one unattractive — and had them complete tasks. Same buttons, same interaction structure, same information architecture. Only the visual design differed.

The attractive-phone group completed tasks 25.6% faster (147.7 seconds vs. 198.5 seconds), made 58% fewer errors (2.0 vs. 4.8 per trial), and rated the device significantly more usable on a validated scale. These are not trivial differences — 58% fewer errors is a large effect. And importantly, the perceived usability gap between the attractive and unattractive conditions did not shrink after use. Users didn't correct their aesthetics-driven perception once they had hands-on experience. If anything, the gap widened.

The proposed mechanism makes intuitive sense: an attractive interface puts users at ease. They're not spending cognitive resources managing a sense of low-quality or distrust. That frees attention for the actual task. An unattractive interface creates a kind of background doubt — "is this going to work? Did I do something wrong?" — that consumes working memory and creates hesitation.

One caveat worth noting: the Sonderegger study used adolescents (ages 13-16), and the performance effect direction (attractive = faster) may be context-dependent. In leisure contexts, attractive interfaces sometimes slow users down because they enjoy the experience more. For a work-oriented task — which is typical of most Mac and iOS productivity apps — the faster completion direction is likely to hold.

### The important boundary condition

At this point you might be thinking: okay, so if I make my app beautiful enough, I can get away with rough interactions underneath. That's not what the research says.

Alexander Tuch and colleagues ran a more rigorous version of the Tractinsky experiment in 2012, with a real e-commerce site and stronger usability manipulations. They found that when usability problems were severe — users were clicking 269 times instead of 50, completing only 55% of tasks instead of 92% — **the aesthetics-usability effect disappeared entirely** (F=0.58, p=.45). Aesthetics had no meaningful effect on perceived usability when the functional experience was broken enough to cause real frustration.

Even more interesting: the effect ran in reverse. Poor usability *decreased* aesthetics ratings, mediated by user frustration. When users were frustrated by bad navigation, they retroactively rated the visual design as worse too — specifically the "clean" and "organized" aspects of classical aesthetics. Frustration is contagious, and it contaminates perception in both directions.

The conflict resolution for this guidebook draws on both bodies of work (see C01-aesthetics-usability-boundary): the aesthetic-usability effect is real and robust under normal conditions (mild friction, functional flows), but it is bounded by severity of usability failure. The practical framing is this: **beauty amplifies good design and forgives minor friction, but it doesn't compensate for broken interactions**. Fix the flow first. Then polish.

Jon Yablonski's framing in *Laws of UX* (laws-of-ux_extracted) is useful here: "System 1 uses aesthetic quality as a proxy for overall quality at 50ms — before System 2 can evaluate functionality." First impressions are System 1. They're fast, automatic, and influential. But if System 2 — the slower, deliberate evaluation that happens during actual use — encounters real obstacles, System 1's positive prior gets overwritten.

🎯 **Apply:** Think of a screen in something you've built. If you showed it to someone for 50 milliseconds and asked "does this look trustworthy?", what would they say? What would change your answer?

### The "polish later" strategy and what it costs

There's a common rationale in solo app development: ship first, design later. Get the features working, get users in, then make it pretty once you know what to polish. The research suggests this strategy has real costs that are easy to underestimate.

The Tractinsky data shows that first impressions set expectations that persist through use. Lindgaard's data shows those impressions form in 50ms and are stable. If your first users encounter an unpolished interface, they arrive with a negative prior — one that makes every friction point feel worse than it is, and makes rough edges feel like fundamental problems rather than minor imperfections.

Early app reviews are disproportionately important. They shape the perception of all future users who read them. Users who experienced your app in its unpolished state will have lower perceived usability ratings, more negative emotional reactions, and less patience for the inevitable rough edges of a new product — not because the underlying functionality was worse, but because the visual design created a low-quality prior that everything else was evaluated against.

There's also a non-designer's version of this trap: thinking that "simple and functional" means "no visual design." Simplicity requires active visual decision-making. It doesn't emerge by default from removing ornament. The clean, minimal look you admire in Raycast or OpenAI products represents enormous design work — careful typography, considered spacing, deliberate color application. "No design" usually produces something that reads as unfinished, not minimal.

The practical implication isn't "obsess over every pixel before shipping." It's "treat visual quality as a functional concern from the start, not a final layer." We'll build toward that throughout this guidebook, starting with structure in the next chapter.

## 3. How To Use This

### Quick-Start Protocol

If there's one decision this chapter is asking you to change, it's when you think about design quality — and the answer is: from the beginning, not the end.

1.  **Before building any new screen, ask: what first impression should this create?** Articulate it in words. "Professional and focused." "Calm and trustworthy." "Fast and keyboard-native." This shapes visual decisions even before you have pixel-level control.

2.  **Audit your current work against the two aesthetic dimensions.** Classical aesthetics first: is this screen visually orderly, clean, and clear? Can someone tell immediately what the most important thing on it is? Expressive aesthetics later: does it have a visual personality, or does it look generic?

3.  **Prioritize fixing obvious visual disorganization before adding features.** If your current screen looks cluttered, inconsistent, or unfinished, that's affecting perceived usability for everyone who sees it — now. The R&D return on fixing that is higher than adding the next feature.

4.  **Treat your first-launch experience as a disproportionately important design problem.** That 50ms impression matters most when the user knows nothing about you. Make the moment of first open count.

5.  **When something feels "off" about an interaction, check: is the problem functional or visual?** Often what reads as a broken flow is actually a visual design failure — missing hierarchy, unclear affordances, inconsistent spacing. Fix the visual version of the problem first; it's usually faster.

### Decision Tree

**Is a visual quality problem worth addressing before shipping?**

- Is this on a first-launch or first-impression screen (the initial view a new user sees)?
  - Yes → high priority. Address before shipping. First impressions are stable and sticky.
  - No → continue below.
- Is this a screen users will see repeatedly in normal use (home, list, main view)?
  - Yes → medium priority. Accumulated visual friction compounds. Schedule before your next version.
  - No → continue below.
- Does this screen have a severe functional usability problem (users can't complete the task)?
  - Yes → fix the function first, then the visual. Beauty doesn't compensate for broken flows.
  - No → the visual issue is worth addressing. A small polish investment yields outsized returns here.

**Is this interface beautiful enough, or just functional?**

- Does it score well on classical aesthetics? (Is it clean, organized, clearly structured?)
  - No → this is the priority. Classical aesthetics drives the usability correlation.
  - Yes → proceed to expressive aesthetics.
- Does it have a visual personality, or does it look generic?
  - Generic → fine for now if classical is strong. Add distinctiveness in a later iteration.
  - Personality → check it doesn't overwhelm clarity. Classical should dominate expressive, not the reverse.

### Design Checklist

**Avoid (failure modes):**

- Shipping a first-launch screen that looks unfinished or low-effort — the impression is sticky
- Treating "simple" as synonymous with "no design decisions" — simplicity requires active visual work
- Over-relying on visual polish to hide fundamentally broken navigation or information architecture
- Applying expressive aesthetic choices (unusual colors, custom shapes, complex animation) before establishing classical clarity

**Do (ambient principles):**

- Treat visual quality as a functional concern alongside feature completeness — not a final decoration layer
- Use your quality bar apps (Raycast, Things, Bear) as calibration references: before shipping a screen, ask "would this feel at home in Raycast?"
- Build classical aesthetics first: order, clarity, cleanliness, visual hierarchy. Expressiveness comes later.

## 4. Practice Lab

This lab has two parts: a first-impression audit and a classical aesthetics inventory. Both can be done in about 20 minutes.

**Part A — The 50ms Audit (10 minutes)**

Pick one screen from something you've already built, or use the last screenshot in your camera roll of something you were working on. You're going to test first impressions.

1.  Set a timer for 5 seconds. Show the screen to a friend, family member, or colleague — someone who hasn't seen it before. Ask them: "What do you think this app does? What's the most important thing on this screen?" Note their response.

    - ☐ Did they correctly identify the screen's purpose?
    - ☐ Could they identify the primary action or piece of information?
    - ☐ Did they use positive or negative language about how it looked?

2.  Now look at the screen yourself for 50 milliseconds (cover it with a piece of paper, then reveal it briefly). What did you notice? Try to capture the first 3 things your eye landed on.

    - ☐ Were those 3 things the 3 most important elements on the screen?
    - ☐ If not: why did your eye land somewhere else? (Size, color, contrast, position?)

3.  Score your screen on classical aesthetics (1-5 scale, 1=poor, 5=excellent):

    - Orderly (elements feel arranged, not scattered): \_\_\_
    - Clean (nothing unnecessary or distracting): \_\_\_
    - Clear (main purpose legible at a glance): \_\_\_
    - Symmetric (visual balance, nothing feels lopsided without reason): \_\_\_

    Total: \_\_\_/20. Target: 14 or above for shipping.

**Part B — Competitive Calibration (10 minutes)**

Open three apps from your quality bar: Raycast, Things (or a similar app you admire), and one OpenAI/Claude.ai product. For each, look at the main view for 5 seconds and answer:

4.  \[ \] What does the main view of Raycast communicate in 5 seconds?

    - Write your answer: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

5.  \[ \] What does the main view of Things communicate in 5 seconds?

    - Write your answer: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

6.  \[ \] What does the main view of Claude.ai communicate in 5 seconds?

    - Write your answer: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

7.  Now look at your own screen again for 5 seconds. Write what it communicates:

    - Write your answer: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

8.  Compare your description with the reference apps:

    - ☐ Is your screen's core message as immediately legible as your reference apps?
    - ☐ If you had to describe the gap in one sentence, what would you say?
    - ☐ What one visual change would most close that gap?

**Debrief:** The goal isn't to achieve Things-level polish on every screen today. It's to build the habit of calibrating against your quality bar before shipping. The aesthetic-usability effect means users experience your app through the lens of that first impression. Make the lens clear.

## 5. Key Takeaways

- **Visual appearance predicts perceived usability more strongly than actual usability features.** Kurosu & Kashimura found beauty correlated with perceived ease of use at r=0.589 — stronger than any of seven objective usability strategies. Evidence: strongly supported.

- **First impressions form in 50ms and are highly stable.** Lindgaard et al. found 50ms appeal ratings correlated with 500ms ratings at r=0.947. That initial read sets a prior that shapes all subsequent evaluation. Evidence: strongly supported.

- **Classical aesthetics (clean, orderly, clear) drives the usability link more than expressive aesthetics.** Lavie & Tractinsky found classical aesthetics correlated with perceived usability at r=0.68-0.78; expressive aesthetics only r=0.40-0.46. For a beginner, classical clarity is where to start. Evidence: supported with limitations (N=866, cross-validated, web stimuli only).

- **The aesthetics-usability effect is real but bounded.** Under normal conditions, visual quality genuinely improves perceived usability and produces measurable performance differences. Under severe usability failure, the effect disappears and frustration contaminates aesthetics ratings in the other direction. Fix broken flows first; polish amplifies good design, it doesn't rescue broken design. Evidence: strongly supported with caveats.

- **"Polish later" has real costs.** Early users set lasting expectations. App reviews from an unpolished first launch shape the perception of all future users. Visual quality is a functional concern that compounds over time. Evidence: Practitioner consensus, supported by first-impressions research.

# Chapter 02: Information Architecture — What Goes on This Screen?

*The first decision: what belongs here, what doesn't*

## 1. What This Is

You're about to build a new screen. You open your editor, you have a rough idea of what this thing is supposed to do, and then — nothing. A blank canvas. Where do you even start? What goes in the top left? How much is too much? If you put the settings somewhere, where? You end up placing things somewhat arbitrarily, moving things around, feeling vaguely dissatisfied with the result but unable to say why.

This is the blank canvas problem, and it's the most common design paralysis point for technical builders. It feels like a taste problem — like you'd know what to do if you just had better design instincts. But it's actually a vocabulary problem. You're missing the questions to ask before you start placing anything.

**Information architecture (IA)** is the practice of deciding what goes on a screen, in what order, at what level of prominence, and what gets moved somewhere else. It answers the question before you start placing pixels. It's not about visual design — it's about the logical structure of what users need access to, and when.

The analogy that works best here is a kitchen, not a screen. A well-designed kitchen doesn't just have all the right tools — it has them in the right places. The things you use every day are on the counter. The things you use weekly are in easy-to-reach drawers. The things you use once a year are in the cabinet above the fridge. You don't think about this organization when you're cooking — it just works, because the structure matches your usage pattern. When it doesn't (when you have to open four drawers to find a spoon, or the colander is somehow stored next to the blender), the friction is invisible but constant.

Your app is the kitchen. This chapter gives you the framework to organize it.

## 2. What The Research Shows

### Users don't read — they scan, satisfice, and muddle through

Before you can design for users, you need an accurate mental model of how users actually behave. Steve Krug's synthesis of decades of usability consulting identifies three behavioral patterns that are so universal they should be treated as design constraints rather than edge cases.

**Users scan, they don't read.** When a person arrives at a new screen, they don't start at the top left and read systematically to the bottom right. They glance around rapidly, picking out words and images that seem relevant to whatever they're trying to accomplish. Three things cause this: they're usually on a mission (they have something specific to do), most of the content on any given screen is irrelevant to that mission, and scanning is a practiced, efficient skill that works well enough to have become the default. The design implication is significant: your visual hierarchy has to communicate the structure of the screen *pre-linguistically* — through size, position, and contrast — not through prose that requires sequential reading.

**Users satisfice, they don't optimize.** When a user is looking for something — a button, a piece of information, a path to their next step — they don't evaluate every option before choosing. They choose the first option that seems plausible. This isn't laziness; it's rational behavior under time pressure. If you're wrong, backing up costs very little (a tap or a click). Careful evaluation of every option rarely improves outcomes on moderately designed screens. The design implication: make the right path obvious, because users will take the first path that doesn't actively look wrong.

**Users muddle through, they don't understand.** This one is the hardest to internalize if you're the person who built the thing. Most users don't build accurate mental models of how your app works. They develop a rough heuristic — "tapping the big button does the thing, I'm not sure why" — and they proceed successfully with that approximate understanding. The design implication: don't require correct understanding to use correctly. The system should work even for users who have fundamentally wrong beliefs about why it works.

These three patterns have a common implication: **every question mark is a cognitive tax.** When a user has to stop and think — "wait, where does this live?", "what does this button do?", "which one of these is correct?" — that's a withdrawal from a finite attention budget. Krug's framing is precise: the goal isn't zero clicks or zero steps, it's zero unnecessary moments of genuine uncertainty.

Pause and predict: Before reading the next section, pick an app you've been using recently. How often do you actually know *why* something works, vs. having a rough heuristic that usually works? How much of your mental model is accurate?

### The working memory constraint: the real limit on what you can show

George Miller's famous 1956 paper established that human working memory — the number of items you can hold in active attention simultaneously — has a capacity of roughly 7 ± 2 chunks. This has been widely cited in UX to justify "no more than 7 items in a navigation menu." That application is wrong, and understanding why matters.

Miller measured *immediate memory span*: how many discrete items you can hold in mind after hearing them in sequence, before they decay. Think of it like how many digits you can remember from a phone number read aloud once. But this isn't what's happening when a user looks at a navigation bar. They're not memorizing the options sequentially — the options are visible in front of them. They're not recalling from memory; they're recognizing from sight. The 7±2 limit was never about visible menus.

The more relevant limit comes from Nelson Cowan's 2001 research on true simultaneous working memory capacity — how many things you can hold in active attention at the same time, without the benefit of sequential rehearsal. Cowan's estimate is approximately 4 chunks. This is the number that matters for interface design, because it describes what a user can reasonably hold in mind while navigating your app — not how many items they can see on screen, but how many independent concepts they can juggle while completing a task.

The practical design limit, per the conflict resolution for this guidebook (see C02-working-memory-7-vs-4), is **4-5 simultaneous concepts**. Reaching 7 means you're already at the cognitive edge. Aim for 5 or fewer for any decision that requires users to hold multiple options in mind at once.

The good news: the most important insight from Miller's work isn't the number, it's the mechanism of **chunking**. A 10-digit phone number is technically 10 items, but formatted as (555) 867-5309, it becomes 3 chunks — area code, exchange, number. The same principle applies to interface design. Twelve items in three clearly labeled groups of four behaves like three items cognitively. The organization does the cognitive work so the user doesn't have to.

Consider how Raycast applies this. The command palette shows you potentially hundreds of actions, but they're grouped by recency, category, and type — and filtered in real time as you type. At any moment, you're only evaluating a small cluster of options. The chunking happens through visual grouping, filtering, and alphabetical ordering. The complexity is present but absorbed by the structure.

🔗 **Connect:** Phone formatting is the classic example of chunking: (555) 867-5309 vs. 5558675309. Can you think of an interface you use where grouping does this cognitive compression work? What would break if the grouping were removed?

### The three questions every screen must answer

Good information architecture comes down to answering three questions clearly, at every level of your app. Steve Krug frames these as the "where am I, what can I do, where can I go" orientation problem, and Tidwell, Brewer & Valencia's pattern framework for navigation formalizes this into a wayfinding structure that applies to every screen you build.

**Question 1: Where am I?** The user needs to know what this screen is and how it relates to the rest of the app. This is answered by the page name, the visual context (what navigation item is active, what breadcrumb trail is visible), and the screen's content taking the shape they expected. A screen that fails this question makes users feel lost — and lost users leave or backtrack, which wastes the cognitive investment they've already made.

**Question 2: What can I do here?** The user needs to see the available actions clearly, in rough order of how likely they are to need them. Primary actions should be visually prominent. Secondary actions should be accessible but less dominant. Tertiary actions (settings, edge cases, destructive operations) should exist but not compete for attention. A screen that fails this question forces users to search for what they need — which costs attention and confidence.

**Question 3: Where can I go?** The user needs a clear path to the next step, whether that's moving deeper into the content, going back to a higher level, or jumping to a different area of the app. Navigation should be obvious enough that users feel safe exploring — knowing they can always get back. A screen that fails this question creates dead ends, which is the worst-case navigation failure.

Test any screen you build by asking these three questions cold — pretend you just arrived at this screen from a search engine or a notification, with no context. Can you answer all three in under 5 seconds? If not, the IA needs work.

Here's a concrete example. Open Raycast and type a partial command. Notice how every piece of information on screen answers exactly one of these three questions: the current input (where you are and what you're doing), the command list filtered to your query (what you can do), and the keyboard shortcut hints at the bottom (how to go deeper). There's nothing on screen that doesn't answer one of these three questions. That's what excellent IA looks like.

Contrast this with a settings screen you've seen that left you scanning multiple sections looking for a particular option, unsure whether it even existed or whether you were in the wrong place. That screen failed questions 1 and 3. It didn't adequately signal where you were, and it didn't give you clear paths to navigate.

### Information scent: why clicks are measured in quality, not quantity

Krug's Second Law of usability is precise and often misapplied: "It doesn't matter how many times I have to click, as long as each click is a mindless, unambiguous choice." Three mindless clicks equal one click requiring real thought.

This principle comes from a body of research on **information foraging** — how users follow "scent" trails through an interface toward their goal, much like an animal tracking a scent trail toward food. When a navigation path carries strong information scent — when the label or affordance clearly signals "what you're looking for is this way" — users move confidently. When scent is weak or ambiguous — when the label could mean two things, or when clicking it might not produce what was expected — users hesitate, guess, and often backtrack.

The practical implication: the right question to ask about your navigation structure is not "how many taps to reach X?" but "does every step along the path to X feel obviously correct?" A three-level hierarchy where every label is obvious is dramatically better than a two-level hierarchy where the second level is ambiguous.

This is why icon-only navigation (common in older mobile apps) so frequently fails: icons without text labels have weak information scent. The user has to decode what the icon means before they can evaluate whether it's the right path. Even with very familiar icons (the gear for settings, the magnifying glass for search), adding text labels increases both discovery and confidence — Yablonski notes this explicitly in *Laws of UX*.

Appearance is part of information scent too. The Stanford Web Credibility Project found that visual appearance was the single most important factor in whether users trusted a website — ranking above reputation, customer service, and even content quality. If the interface looks authoritative and polished, users extend benefit of the doubt to ambiguous navigation. If it looks amateurish, they second-guess paths that would otherwise seem obvious.

### The four-tier content hierarchy

You need a practical framework for deciding what goes *where* on a screen — not just that something belongs in your app, but at what depth and in what form. The framework that works best for the apps you're building is a four-tier content hierarchy adapted from progressive disclosure principles in *Designing Interfaces* and the Laws of UX framework for Hick's Law.

**Tier 1 — Always visible:** The core purpose of this screen. One or two things the user definitely needs every time they open this view. In a task management app, that might be the task list. In Raycast, it's the search input. In a settings screen, it might be a grid of major categories. If more than 5-7 things are in this tier, you're overloading the primary view.

**Tier 2 — One tap/click away:** Frequently-needed secondary actions that belong contextually to this screen but don't need to be visible at all times. In iOS, this is often a swipe-to-reveal action or a disclosure indicator. In macOS, it's a right-click contextual menu or a toolbar button. These are things users will need regularly, but not on every visit.

**Tier 3 — In a panel, sheet, or secondary view:** Configuration, detailed editing, less-frequent actions. These require explicit navigation — tapping "Edit" to enter an editing mode, opening a settings panel, expanding an accordion. This tier holds real complexity without it competing for attention on the primary view.

**Tier 4 — Not on this screen:** Things that belong in a different screen altogether, or in settings that rarely need changing. If you find yourself trying to fit something in Tier 1 because it's important to *you* (as the builder) but users would only need it once a week, it probably belongs in Tier 3 or 4. IA discipline means honestly mapping your own assumptions about importance against actual usage frequency.

The exercise of categorizing everything in your app into these four tiers is more useful than it might sound. You'll immediately find things you've put in Tier 1 that don't belong there, and things you've buried in Tier 3 that users need much more often. That mismatch is the blank canvas problem made explicit — you can fix it systematically once you can name it.

🎯 **Apply:** Think about a screen you're currently building or planning. List everything that needs to live on that screen. Now categorize each item: Tier 1 (always visible), Tier 2 (one tap away), Tier 3 (in a panel), Tier 4 (different screen). Is anything in Tier 1 that should be in Tier 2? Anything in Tier 3 that users need constantly?

### Appearance and trust: the IA-aesthetics link

It might seem strange to discuss visual trust in an information architecture chapter, but there's a direct connection. The Stanford Web Credibility Project finding — that appearance is the primary driver of user trust — is deeply linked to IA quality, not just visual decoration.

Users assess trust through the lens of "do these designers know what they're doing?" When an app's information architecture is logically consistent, when items are where users expect them to be, when navigation labels match the content they reveal — this communicates competence. The visual orderliness that Lavie & Tractinsky identified as "classical aesthetics" maps directly to IA quality: clean, clear, organized. A well-structured screen looks trustworthy because it *is* logically structured, and the logic is perceptible.

Conversely, a screen with poor IA — things organized by developer convenience rather than user mental models, labels that could mean multiple things, primary actions buried next to tertiary ones — will look messy and untrustworthy even if the individual visual elements are fine. Structure is visible. Logic is legible. And both contribute to that first-impression quality assessment that happens before a user even starts reading.

## 3. How To Use This

### Quick-Start Protocol

When you're about to design a new screen, don't start by placing elements. Start by answering five questions:

1.  **Name this screen in 3 words or fewer.** If you can't name it clearly, the screen doesn't have a clear purpose. A screen without a clear purpose is an IA failure waiting to happen. Keep naming until you can say it cleanly: "Task List View." "Account Settings." "Command Palette." "New Event Form."

2.  **List everything the user might need on this screen.** Don't filter yet — just inventory. Everything: primary content, actions, navigation, status indicators, secondary information.

3.  **Assign each item to a tier** (Tier 1: always visible / Tier 2: one tap away / Tier 3: in a panel / Tier 4: different screen). If you have more than 5-7 items in Tier 1, you're overloading the primary view. Be ruthless: most things are not Tier 1.

4.  **Answer the three screen questions:** Where am I? What can I do here? Where can I go? If you can't answer all three in under 5 seconds from the designed screen, fix the IA before adding visual design.

5.  **Check information scent on every navigation path.** For each way a user could reach this screen (tap in nav bar, notification, deep link), does the label or affordance they clicked clearly predict what they found? If not, rename the label or restructure the path.

### Decision Tree

**What goes on this screen at Tier 1?**

- Does this information need to be visible on every visit, not just occasionally?
  - Yes → Tier 1 candidate. Continue below.
  - No → Tier 2 or deeper. Move on.
- Is this the core purpose of the screen (the thing the user came here to do)?
  - Yes → Tier 1.
  - No → Is it needed to complete the core purpose? (e.g., a filter that's always relevant)
    - Yes → Tier 1, but minimize its visual weight relative to the core purpose.
    - No → Tier 2 or deeper.

**Is this element causing cognitive overload?**

- Are there currently more than 5-7 Tier 1 elements on screen?
  - Yes → Identify the least-frequently needed. Can it move to Tier 2?
- Are any Tier 1 elements grouped by logical relationship (using proximity or visual containers)?
  - No → Add grouping. 12 ungrouped items \> 3 groups of 4 cognitively.
- Does any label have ambiguous information scent (could mean more than one thing)?
  - Yes → Rename it. Clarity of label is worth more than brevity.

**Which navigation model applies to this screen?**

- Is this a focused, task-completion flow (checkout, form, wizard)?
  - Yes → Step-by-step navigation. Minimal nav, clear progress, prominent escape hatch.
- Is this a primary top-level view with multiple peer sections?
  - macOS → Sidebar navigation model (like Mail, Notes, Bear).
  - iOS → Tab bar (max 5 items) or sidebar for iPadOS.
  - Raycast → Command palette + contextual actions. You don't control this model — work with it.
- Is this a detail view within a hierarchy (one item from a list)?
  - Yes → Hub-and-spoke or one-window drilldown. Clear back navigation is essential.

### Design Checklist

**Avoid (failure modes):**

- Overloading Tier 1 with more than 5-7 items — every item added competes with every other item for attention
- Organizing screens by how you (the developer) think about the code, rather than how users think about their tasks
- Using icon-only navigation without text labels — icons have weak information scent except for extremely universal symbols
- Building screens that can't answer "where am I?" — every screen needs a clear, prominent name or title
- Placing destructive or rarely-used actions in the same visual tier as primary actions

**Do (ambient principles):**

- Name every screen before designing it — if you can't name it in 3 words, it doesn't have a clear purpose
- Group related items using proximity and visual containers so chunks register as single cognitive units
- Test every navigation path: if the label doesn't clearly predict the content, rename the label or restructure the path
- Design for the satisficing user, not the ideal user — assume users will take the first plausible path, so make the right path the most obvious one

## 4. Practice Lab

This lab walks you through the IA process for a real screen. You'll need: a screen you're currently designing or planning to build, or if nothing comes to mind, use a settings screen for a hypothetical task management app.

**Step 1 — Name and purpose (5 minutes)**

1.  Write the screen name in 3 words or fewer: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_
    - ☐ Is this name what a user would call this screen, or what you as the developer call it?
    - ☐ Could a new user predict what they'd find here from the name alone?
    - ☐ If the name needed two clauses ("Tasks, filtered by project"), the screen might be trying to do two things. Note this: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_
2.  Write the screen's single core purpose in one sentence: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

**Step 2 — Content inventory (10 minutes)**

List every element you initially considered putting on this screen. Don't filter — just write them all down.

| Element | What it does |
|---------|--------------|
| 1\.     |              |
| 2\.     |              |
| 3\.     |              |
| 4\.     |              |
| 5\.     |              |
| 6\.     |              |
| 7\.     |              |
| 8\.     |              |
| ...     |              |

**Step 3 — Tier assignment (10 minutes)**

For each element in your inventory, assign a tier:

| Element      | Tier          | Reason |
|--------------|---------------|--------|
| (from above) | 1 / 2 / 3 / 4 |        |

After assigning tiers, check:

- How many items are in Tier 1? If more than 7: circle the least-critical one and move it to Tier 2.
- Are Tier 1 items logically grouped? Name the groups: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_
- Is there anything in Tier 1 that users need less than once per session? Move it to Tier 2.
- Is there anything in Tier 3 or 4 that users actually need on most visits? Move it up.

**Step 4 — Three-question check (5 minutes)**

With your Tier 1 layout in mind, answer these from the perspective of a new user:

5.  \[ \] Where am I? (Can a new user tell what this screen is from the content alone?)

    - Can you answer in under 5 seconds? Yes / No
    - If no, what's missing or unclear: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

6.  \[ \] What can I do here? (Are the primary actions visible and clearly labeled?)

    - Can you answer in under 5 seconds? Yes / No
    - If no: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

7.  \[ \] Where can I go? (Are the navigation paths back, forward, and sideways clear?)

    - Can you answer in under 5 seconds? Yes / No
    - If no: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

**Step 5 — Information scent check (5 minutes)**

Pick one navigation path to this screen (from your app's main view, from a notification, from a search result). For the label or affordance that leads here:

8.  \[ \] Does the label clearly predict what the user will find?
9.  \[ \] Is there any ambiguity in the label (could it mean something else)?
10. \[ \] Does arriving here feel like what was promised by the label?

If you answered No to any of these, write one alternative label that would have stronger scent: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

**Debrief rubric:**

- All three screen questions answered in under 5 seconds: strong IA foundation
- Tier 1 has 5 or fewer ungrouped items, or items are clearly chunked: good cognitive load management
- Information scent check passed: navigation is trustworthy
- Screen name clearly describes the purpose to a new user: you've solved the blank canvas problem for this screen

## 5. Key Takeaways

- **Users scan, satisfice, and muddle through — design for these behaviors, not against them.** Visual hierarchy must communicate screen structure faster than reading speed. Users take the first plausible path, not the best one. Most users operate on approximate mental models, not accurate ones. Evidence: Practitioner consensus, foundational.

- **Working memory capacity is approximately 4-5 simultaneous chunks, not 7.** Miller's 7±2 applies to sequential recall, not active decision-making. Cowan's ~4 is the more relevant practical limit. The "7 items in nav" rule is a misapplication of Miller. The design response is chunking: group items so they register as fewer cognitive units. Evidence: strongly supported (Cowan), foundational with caveats (Miller).

- **Every screen must answer three questions clearly: Where am I? What can I do? Where can I go?** These three orientation questions determine whether users feel in control or lost. Test any screen cold — if you can't answer all three in 5 seconds, the IA needs work. Evidence: Practitioner consensus, foundational.

- **Information scent per click matters more than click count.** Three unambiguous clicks are better than one ambiguous click. Every navigation label should clearly predict its content. When labels are ambiguous, users hesitate, backtrack, and lose confidence. Evidence: Practitioner consensus, supported by information foraging research.

- **Use the four-tier content hierarchy to solve the blank canvas problem.** Before placing anything, sort all content into: always visible (Tier 1) / one tap away (Tier 2) / in a panel or sheet (Tier 3) / different screen (Tier 4). If more than 5-7 things are in Tier 1, move the least-critical ones down. This framework converts the blank canvas from a judgment call into a structured decision. Evidence: Practitioner consensus.

# Chapter 03: Navigation Design — Connecting Your Screens

**Part 2 — Structure: Solving the Blank Canvas Problem**

The question for this chapter is: "How do I structure the flow between screens so users always know where they are and where they can go?"

## 1. What This Is

Here's a situation you've probably run into. You open an app you haven't used in a few months. You need to do something specific. You remember the app could do it — but you have no idea where to find it. You tap around. Nothing. You tap somewhere else. Now you don't know how to get back. You close the app and try a different one.

That experience is a navigation failure. Not a features failure — the feature existed. A navigation failure.

Navigation is the skeleton of your app. It connects every screen to every other screen, tells users where they are at any moment, and signals where they can go next. When it works, users don't notice it at all — they just move. When it fails, the entire app feels broken, even if every individual feature works perfectly.

The counterintuitive truth: navigation isn't something you design after you know what your app does. It's one of the first decisions you make. The structure you choose shapes what's possible, what's discoverable, and how your app grows over time.

This chapter gives you the vocabulary and decision framework to choose the right navigation pattern for each of your platforms — iOS, macOS, and Raycast — and to make those patterns feel obvious rather than confusing. By the end, you'll have a clear answer to the question: tab bar, sidebar, command palette, or something else?

## 2. What The Research Shows

### The Cost of Choice — Hick's Law in Navigation

Every time a user arrives at a navigation element — a tab bar, a sidebar, a menu — they face a decision: where do I go? Research on this specific type of decision has produced one of the most well-replicated findings in human performance research.

Choice reaction time increases logarithmically with the number of alternatives available. The formula is RT = a + b·log₂(n), where RT is the time to decide, a is baseline processing time, b is the rate at which you process information, and n is the number of options. Logarithmic is the key word. The cost doesn't grow linearly. Going from 1 option to 2 costs roughly the same as going from 2 to 4, which costs roughly the same as going from 4 to 8. Each doubling of options adds approximately the same penalty.

For navigation, this matters in a specific way: the difference between 2 tabs and 4 tabs is the same decision-time cost as the difference between 4 tabs and 8 tabs. At around 8–10 options, the logarithmic function starts to flatten — but by then you've already paid most of the cost.

There are three important boundary conditions to understand before you apply this too mechanically.

First, S-R compatibility — the degree to which an option's name or appearance directly signals what it does — dramatically changes the slope. With highly compatible, obvious mappings (think: a tab labeled "Inbox" with an inbox icon), the set-size effect nearly disappears. Users don't have to search memory for what each option means; the answer is right in front of them. Familiar, well-labeled navigation mostly bypasses the Hick's Law penalty.

Second, practice reduces the cost. A user who opens your app every day builds automatic recognition for the navigation structure. The cost doesn't vanish, but it shrinks substantially — the RT difference between having 2 vs. 8 options was roughly 500ms in the first session, shrinking to around 149ms after thousands of practice trials. This means Hick's Law matters most on first use and for new or infrequent users. Your power users will navigate faster regardless.

Third, hierarchy structure matters. The same research that established the logarithmic cost also found that broader, shallower menu trees produce faster search than narrower, deeper ones. More options at the top level with fewer levels of depth beats a narrow top level with many nested tiers.

**early-stage evidence (22-29):** The Proctor & Schneider review is a narrative synthesis, not a meta-analysis, and the primary studies used laboratory keypress tasks rather than touchscreen or keyboard-driven navigation. The logarithmic relationship is robust across those tasks, but exact effect magnitudes in modern app navigation are extrapolated rather than directly measured.

The practical design implication is not "always minimize options." It's: keep navigation labels obvious, keep hierarchy shallow, and push rarely-used destinations out of primary navigation.

Pause and predict: Before reading further — how many tabs does Raycast have? How many sections does Things have in its sidebar? Take a moment to recall. Then consider: does each additional item in those navigations feel costly to you, or does the labeling make it obvious?

### How Users Actually Navigate

Research from usability observation paints a humbling picture of how users actually move through apps. They don't build accurate mental models. They don't trace paths logically. They satisfice — they click the first option that seems plausible and see where it leads.

What this means practically: users are running a continuous low-stakes betting game. They look at the navigation, pick the option that seems most likely to lead where they want to go, take the bet, and — if they're wrong — hit Back and try the next most plausible option. They don't need a perfect mental model. They need enough information scent at each choice point to make a reasonable bet.

"Information scent" — the degree to which a label predicts the content it leads to, introduced in 02-information-architecture — is the key currency here. A tab labeled "Projects" has high scent if the user's goal is "find my active project list." A tab labeled "Workspace" has low scent for the same goal — it's ambiguous. Low-scent labels force users to open multiple options before finding what they need, which erodes confidence in the app and costs goodwill.

Navigation also serves four purposes, two of which are often missed. The obvious two are: help users find things, and show users where they are. The frequently missed two are: revealing what exists — surfacing content users wouldn't know to search for — and giving confidence. Users are constantly running a background assessment: "do these people know what they're doing?" Strong, clear navigation that matches their mental model of the domain answers that question positively, even before they find what they're looking for.

🔗 **Connect:** The satisficing behavior here connects directly to the information architecture principles in 02-information-architecture. If every screen clearly answers "where am I? what can I do? where can I go?" — the three screen questions — then each navigation step starts from a stable position instead of a disoriented one.

### Visual Wayfinding — How Users Orient Themselves

Physical spaces give you orientation for free: you walked in this direction, the exit is behind you, the windows are on the left. Digital apps have none of that. Users can deep-link into any screen, can lose track of where they've been, and have no spatial memory to fall back on.

Good navigation substitutes for this lost physical context. The wayfinding toolkit has four components:

Signposts tell you where you are right now — page titles, breadcrumbs, selected states on tab bars and sidebars, progress indicators in multi-step flows. Every screen needs at least one signpost. Without it, the user is navigating blind.

Environmental clues are conventions you can lean on because users already know them — the logo in the upper left links home, the X in the corner closes the dialog, the hamburger icon means "more options are hidden here." These are near-zero cost to learn because users bring the knowledge with you.

Maps show structure across the whole app — breadcrumbs showing depth, progress indicators in onboarding flows, section headings in sidebars.

Escape hatches are the most important and most underused: a way to teleport to a known safe place from anywhere in the app. On iOS, this is the top-level tab. On macOS, it's the sidebar section header or the window's toolbar. In Raycast, it's pressing Escape to step back up the navigation stack. Without escape hatches, users who get lost stay lost.

One common failure with signposts: they're too subtle. If you think your "selected state" on a tab bar looks selected, make it twice as prominent. Research and usability observation both confirm that designers consistently underestimate how hard subtle visual indicators are to read at glance speed.

**strongly supported (38-46):** The satisficing and wayfinding findings represent decades of observational usability research and direct expert-practitioner consensus, consistently replicated across contexts.

🎯 **Apply:** Open Raycast right now. Navigate two levels deep into any command. Now notice: where is the visual cue that tells you where you are in the hierarchy? What is the escape hatch? How does the UI communicate the path back? Now open Things 3 and try the same exercise.

## 3. How To Use This

### The Platform Decision: Which Navigation Pattern Fits Where?

Before you pick a pattern, identify what type of structure your app has. Tidwell et al. describe five navigational models, three of which are most relevant here:

**Hub and Spoke** — a home screen links to distinct sections; sections don't directly link to each other. This is the iPhone app model. Each spoke is independent. Users return to the hub to change sections. Works best for apps with distinct, non-overlapping feature areas.

**Fully Connected** — global navigation appears on every screen; users can jump from anywhere to anywhere. This is the web model and the macOS sidebar model. Things 3 exemplifies it: no matter where you are in the app, the sidebar is always visible and you can jump to any project or area instantly.

**Step by Step** — screens follow a linear sequence (onboarding wizards, checkout flows, setup assistants). Navigation here is Back/Next, not a menu. The user isn't exploring; they're completing a task.

For apps with multiple destinations, the question becomes: which continuous navigation pattern belongs on which platform?

**iOS: Tab Bar**

The tab bar lives at the bottom of the screen and provides direct access to top-level destinations. Apple's Human Interface Guidelines cap it at five tabs. This isn't arbitrary — each additional tab adds decision time per the logarithmic relationship, and the bottom of the screen is already crowded with iOS system chrome. Five is a practical ceiling for items that remain recognizable at a glance.

Each tab should represent a genuinely distinct destination, not a feature. "Home," "Search," "Library," and "Profile" are destinations. "Sort," "Share," and "Edit" are actions — they belong in toolbars or contextual menus, not tabs.

Selected state on the active tab should be unmistakably visible. Use color (your accent color on the selected item) plus a label change or weight shift — not one or the other alone.

NavigationStack handles depth within each tab. Users drill into a detail view and return with the system back button or a Back label in the top-left corner. Keep depth to three levels maximum: List → Item → Detail. Anything deeper is a sign that either your information architecture needs restructuring or you're using navigation where a modal sheet would serve better.

Sheets handle contextual tasks that don't belong in the main navigation flow — composing a new message, viewing a document preview, completing a quick configuration step. Sheets are "go here to do this thing, then come back." If the user might want to stay in the sheet context for an extended time, reconsider — it might want to be a full screen instead.

In SwiftUI:

``` swift
TabView {
    InboxView()
        .tabItem {
            Label("Inbox", systemImage: "tray")
        }
    ProjectsView()
        .tabItem {
            Label("Projects", systemImage: "folder")
        }
}
```

**macOS: Sidebar**

The sidebar is the canonical macOS primary navigation. Things 3, Mail, Finder, Notes — they all use it. It works because macOS screens are wide enough to afford a persistent panel alongside the main content, and because desktop users expect to be able to jump between sections without losing their place in the content area.

Sidebar sections typically range from 3 to 10 items. Below 3, it's probably overkill — a simple two-up split view or toolbar may serve better. Above 10, group items into labeled sections with section headers.

The sidebar handles structural navigation — the major sections of your app. It doesn't handle utility navigation — settings, help, account management. Those belong in the app menu (in the menu bar) or in a preferences window, not in the sidebar alongside your main content.

Linear uses its sidebar beautifully as a dense but scannable navigation system: team sections at top, then project hierarchies below. The key is that every item in the sidebar has obvious information scent — you know exactly where you'll land when you click it.

Toolbar actions sit in the window's top toolbar, not the sidebar. The toolbar is for frequent actions on the current context (new item, refresh, filter, search). The sidebar is for changing your location in the app.

In SwiftUI:

``` swift
NavigationSplitView {
    List(sections, selection: $selectedSection) { section in
        Label(section.name, systemImage: section.icon)
    }
    .listStyle(.sidebar)
} detail: {
    DetailView(section: selectedSection)
}
```

**Raycast: Command Palette**

Raycast's navigation model is fundamentally different from both iOS and macOS app patterns, and it's worth understanding as a design system in its own right because you will be building extensions inside it.

Raycast is keyboard-first, list-based navigation. The user types to filter a list. They arrow-key or type to select an item. Contextual actions are available on the selected item via a secondary action panel (the Action Panel, triggered by Command+K or the right-arrow key depending on context). There is no visible navigation structure at the top level. There is no sidebar. There are no tabs.

This creates an unusual tradeoff: Raycast's navigation has near-zero discovery cost for known items (if you know the command name, you find it instantly) but near-zero discoverability for unknown items (if you don't know what exists, you have to browse or guess). This is the opposite of a sidebar.

For your Raycast extensions, this means:

Your primary content is a list. Every command you expose is a list item. Commands that go deeper open a new list view or a detail view, not a new "page" with different navigation chrome. Navigation depth in Raycast is shallow by design: the main list → an item's detail view or action panel → back to the main list. Rarely more than two levels.

Actions on selected items belong in the Action Panel (`ActionPanel` in the Raycast API), not as separate navigation destinations. If a user selects a note, the actions "Edit," "Share," and "Delete" should be in the action panel — not in a separate screen that the user has to navigate to and back from.

The escape hatch in Raycast is always the Escape key, which moves the user up one level in the navigation stack. Design every screen in your extension so that Escape works correctly and returns the user to a sensible previous state.

In the Raycast API:

``` typescript
export default function Command() {
  return (
    <List>
      <List.Item
        title="My Item"
        actions={
          <ActionPanel>
            <Action title="Primary Action" onAction={handlePrimary} />
            <Action title="Secondary Action" onAction={handleSecondary} />
          </ActionPanel>
        }
      />
    </List>
  );
}
```

### Structural vs. Utility Navigation

Every app has two kinds of navigation and most beginners conflate them. Structural navigation is the skeleton — the sections of your app that represent your main content areas. Utility navigation is the plumbing — settings, help, account, logout, about.

Keep them separate. Structural navigation lives in your tab bar (iOS) or sidebar (macOS). Utility navigation lives in settings/preferences. In Raycast, utility items can be in the Action Panel on relevant items or in a dedicated Preferences view.

Mixing structural and utility navigation in the same panel creates hierarchy confusion. If "Inbox," "Projects," "Reports," and "Help" are all in your sidebar at the same visual level, the user doesn't know what kind of app this is — is Help a feature? Is Settings a section?

### Quick-Start Protocol

1.  Identify your app's structural destinations — the 2-5 major sections that define what your app is. If you have more than 5, group related ones or reconsider whether some belong in settings instead.

2.  Choose the pattern for your platform: tab bar for iOS with up to 5 tabs, sidebar for macOS with 3-10 sections, command palette list for Raycast.

3.  Write every navigation label and ask: does it predict what the user will find there? If not, revise until it does. Avoid clever or branded labels ("Workspace," "Canvas") in favor of descriptive ones ("Projects," "Notes").

4.  Add a selected state to every navigation element that can be active. Make it visually unmistakable — not subtle.

5.  Identify your escape hatch: what is the universal safe place a user can always return to? Make sure every screen has a visible path back to it.

6.  For any flow deeper than 2 levels, audit whether the depth is necessary. Can a sheet replace a navigation push? Can a modal handle a contextual task without disrupting the main navigation stack?

### Decision Tree

**Is the task contextual (temporary, then return)?** → Yes: Use a modal sheet, not a navigation push. → No: Continue.

**Is this a structural destination or a utility?** → Structural: Put it in tab bar / sidebar / list. → Utility: Put it in settings / preferences / action panel.

**How many structural destinations does the app have?** → 1-2: You may not need primary navigation at all — use a simple toolbar or no chrome. → 3-5: Tab bar (iOS) or sidebar with no sections (macOS). → 6-10: Sidebar with grouped sections (macOS). Consider merging on iOS. → 10+: Reconsider information architecture — this is likely a content problem, not a navigation problem.

**Does the app have navigation depth?** → Flat (everything is one level): No hierarchy navigation needed — use a list. → 2-3 levels: NavigationStack (iOS) or two-panel split view (macOS). → 4+ levels: Restructure. Navigation deeper than 3 levels consistently loses users.

**Is the user at risk of getting lost in a flow?** → Yes: Add breadcrumbs or a prominent "back to \[section\]" label. → No: Selected state on primary navigation is sufficient.

### Design Checklist

**Avoid:**

- Mixing structural navigation (Inbox, Projects) with utility navigation (Settings, Help) at the same visual level
- Labels that are clever or branded instead of descriptive — "Hub" instead of "Home," "Stream" instead of "Feed"
- Navigation deeper than 3 levels — restructure or use sheets instead
- Using navigation where a sheet is more appropriate (contextual tasks that return to the same screen)
- Selected states that are subtle, low-contrast, or easy to miss
- Moving navigation items between app versions — spatial memory means users rely on position, not just labels

**Do:**

- Ensure every screen has a visible path back to safety (escape hatch)
- Apply the rule: "broader and shallower beats narrower and deeper"
- Keep structural and utility navigation in separate parts of the chrome
- Use platform conventions (tab bar on iOS, sidebar on macOS) unless you have a rigorously tested reason to deviate
- In Raycast extensions, keep depth to two levels maximum and put actions in the Action Panel, not new screens

## 4. Practice Lab

This lab is designed to be completed in 20-30 minutes. You need an app you're currently building or planning to build. If you don't have one, use a hypothetical "note-taking app" as your working example.

**Setup**

Write down the name of your app and its primary purpose in one sentence.

App: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ Primary purpose: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

**Step 1 — Inventory your destinations (5 min)**

List every section, view, or area you imagine a user might navigate to in your app. Be exhaustive — include everything you've considered, even things you've deprioritized.

\[ \] Destination: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ \[ \] Destination: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ \[ \] Destination: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ \[ \] Destination: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ \[ \] Destination: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ \[ \] Destination: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ \[ \] Destination: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ \[ \] Destination: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

**Step 2 — Sort: structural vs. utility (5 min)**

Go through your list. Mark each destination with **S** (structural — a content area that defines what the app does) or **U** (utility — settings, help, account, preferences, about).

Anything marked U moves out of your primary navigation.

Remaining structural destinations: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

**Step 3 — Choose your primary navigation pattern (5 min)**

Answer these for your app:

Platform(s): \[ \] iOS \[ \] macOS \[ \] Raycast

How many structural destinations do you have? \_\_\_\_\_

Based on platform and count, which pattern fits? \[ \] iOS tab bar (up to 5 destinations) \[ \] macOS sidebar (3-10 destinations, grouped if needed) \[ \] Raycast list (all destinations as filterable list items) \[ \] Other: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

**Step 4 — Audit your labels (5 min)**

Write your structural destinations in a column. Next to each, write the first thing a user would be looking for if they needed that destination (e.g., if the destination is "Projects," the user goal is "find my project list"). Then check whether your label predicts that goal.

| Destination Label | User's Goal | Does the Label Predict It? |
|-------------------|-------------|----------------------------|
|                   |             | \[ \] Yes / \[ \] No       |
|                   |             | \[ \] Yes / \[ \] No       |
|                   |             | \[ \] Yes / \[ \] No       |
|                   |             | \[ \] Yes / \[ \] No       |
|                   |             | \[ \] Yes / \[ \] No       |

Revise any label that scored No.

**Step 5 — Map your escape hatches (5 min)**

For each major navigation depth level in your app, identify the escape hatch — the visual element that gets the user back to safety.

Top level: always visible via \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ One level deep: back button / Escape key / \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ Two levels deep: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ Sheet/modal: always has an X or Cancel — \[ \] confirmed

**Step 6 — Depth audit (5 min)**

Are there any flows in your app that require more than 3 navigation pushes to complete a task? List them:

------------------------------------------------------------------------

For each one: could a modal sheet replace any of those levels? Could any levels be combined? Write your revised approach:

------------------------------------------------------------------------

**Completion criteria**

\[ \] You have a list of structural destinations only (utilities removed) \[ \] You have chosen a platform-appropriate navigation pattern \[ \] Every label has been checked against the user's likely goal \[ \] Every depth level has a defined escape hatch \[ \] No flow requires more than 3 navigation pushes

## 5. Key Takeaways

- **Decision time grows logarithmically with navigation options.** RT = a + b·log₂(n) means going from 2 to 4 options costs the same as going from 4 to 8. The penalty is attenuated by obvious labeling and familiarity, but it never fully disappears. strongly supported (38-46).

- **Broader and shallower beats narrower and deeper.** Landauer & Nachbar found that menu trees with more items per level but fewer levels consistently outperformed narrow, deep trees for search speed. Three navigation levels is the practical maximum. strongly supported (38-46).

- **Users satisfice, not optimize.** They take the first plausible navigation option and backtrack if wrong. High information scent — labels that clearly predict what's behind them — reduces the number of wrong turns dramatically. strongly supported (38-46).

- **Navigation serves four purposes, and most designers only design for two.** Finding things and showing location are obvious. Revealing what exists and giving confidence are frequently missed but equally important. supported with limitations (30-37).

- **Platform conventions are load-bearing.** Tab bar on iOS, sidebar on macOS, command palette in Raycast — these aren't aesthetic preferences. They're the patterns users have learned to expect, and departing from them imposes a learning cost on every new user. Innovate on content, not navigation structure, unless you have rigorous evidence that a different pattern works better. supported with limitations (30-37).

# Chapter 04: Progressive Disclosure — What to Show When

**Part 2 — Structure: Solving the Blank Canvas Problem**

The question for this chapter is: "Which features do I include? What do I show first vs. hide behind a tap?"

## 1. What This Is

Here is a moment every app builder eventually faces. You've got a working feature. It's useful. You don't want to delete it. But every time you open the main screen, it's there — right next to two other useful features — and together they make the screen feel busy, the purpose feel unclear, and the first-time experience feel like homework.

The instinct is to choose: keep it or cut it. This is almost always the wrong frame.

The better question is: *when* should this feature appear?

Progressive disclosure is the practice of revealing complexity in stages, timed to when the user actually needs it. Not removing features. Not hiding them permanently. Deferring them — to the moment when they become relevant, when the user has demonstrated intent, when the context calls for them.

This principle is already embedded in the apps you admire most. Raycast's main interface shows one thing: a search field and a list of commands. The commands have contextual actions (edit, share, delete) — but they don't appear until you've selected an item. The Action Panel doesn't surface until you press Command+K. A full preferences screen exists — but only accessible when you need to configure something. The full power of Raycast is enormous. The surface you encounter at any given moment is small.

Things 3 shows you your task list. Long-press a project to see project settings. Open the task to see due dates, tags, and notes. The default surface is a clean list. Complexity lives behind a deliberate gesture.

Both apps feel simple at first contact. Both are genuinely powerful. The gap between those two facts is progressive disclosure.

This chapter gives you the research behind why overexposure to options demotivates users, the single most powerful design decision you can make (defaults, and how they work psychologically), and a concrete four-tier model for deciding exactly where every feature in your app belongs.

## 2. What The Research Shows

### Choice Overload Is Real — But Conditional

The foundational study in this area ran a jam tasting booth at an upscale grocery store in Menlo Park, California. Researchers rotated between displaying 24 jam varieties and 6 jam varieties throughout the day. More people stopped at the 24-variety booth — it was initially more attractive. But when it came time to actually buy, customers who had seen 6 options were roughly 10 times more likely to purchase than those who had seen 24. The actual figures: 29.9% purchased from the small display versus 2.8% from the large one.

The pattern held across a follow-up study where Stanford students given 6 essay topics completed the optional assignment more often than those given 30 topics (74% vs. 60%), and wrote higher-quality essays. A laboratory study with chocolates showed the same pattern on satisfaction scores.

This is striking. But the story gets more nuanced.

A 2015 meta-analysis examined 53 choice overload studies across 7,202 participants and found that the mean effect of assortment size on overload is nonsignificant without moderating factors. That is: more options don't automatically cause overload. But four conditions make overload reliable and strong:

**Choice set complexity** (d=0.55) — how difficult are the options to compare? If options have misaligned attributes, require heavy evaluation, or are all similarly attractive with no clear winner, overload is likely. If options are distinct, well-curated, and include an obvious recommended choice, it's attenuated.

**Decision task difficulty** (d=0.37) — is the user under time pressure? Are there many attributes to evaluate? Is the presentation format confusing? These compound with option count.

**Preference uncertainty** (d=0.32) — does the user already know what they want? Experts with clear preferences navigate large option sets well. Beginners without a clear goal get overwhelmed.

**Decision goal** (d=0.56) — is the user trying to *choose* or just *browse*? Users with buying intent experience much more overload from large sets than users who are exploring. This is the strongest moderator alongside complexity.

The practical translation is important: **it's not about counting options**. Simply removing features won't fix overload. What makes overload happen is a combination of complexity, difficulty, uncertainty, and commitment pressure. You address overload by curating options to be distinct and comparable, guiding users toward a recommendation, and framing early interactions as exploratory rather than committing.

**strongly supported (38-46) for existence of effect; supported with limitations (30-37) for the specific moderator pattern.** The Chernev et al. meta-analysis is a high-quality hierarchical model covering a clean corpus of 53 studies with no detected publication bias. The moderator d-estimates are from the same model that explains 68% of residual variance. The primary limitation is that nearly all studies use retail/product selection contexts — direct application to digital UI is extrapolated, not directly tested.

Pause and predict: Think about the last settings screen you configured in an app. Did it feel overwhelming? Now think about whether the overload came from too many options — or from the options being hard to compare, unclear in their effect, or making you feel like you were committing to something.

### The Default Effect — The Most Powerful Design Lever You Have

Here is a finding that should stop you in your tracks.

In a meta-analysis of 58 datasets covering 73,675 participants, the difference between setting something as opt-out versus opt-in produced an effect size of d=0.68. In the studies that measured binary uptake, the average difference between opt-out and opt-in conditions was 27 percentage points — a Cramér's V of 0.29. This effect is larger than healthy eating nudges (d=0.23), social norm energy interventions (d=0.32), and framing effects on risky choices (d=0.31).

Changing whether a checkbox comes pre-checked is more powerful than changing the words around it, the color of the button, or the ordering of the options.

To understand why, you need to understand the three mechanisms through which defaults work:

**Implicit endorsement.** Users interpret the pre-selected option as a recommendation from the designer. It signals: "this is what most people choose" or "this is what we think is right for you." The trust the user has in the product flows into the default. If you've earned credibility, your defaults carry authority.

**Effort asymmetry.** Accepting a default requires no action. Changing it requires a deliberate act — reading the options, evaluating them, deciding differently, finding the control, changing it. Even when that effort is minimal (a single mouse click), the asymmetry persists. Johnson & Goldstein found the effect held in a one-click online experiment, which rules out effort alone as the explanation.

**Loss aversion.** The default becomes the reference point. Deviating from it feels like a loss — you're giving up something you already "have." Changing a pre-selected option triggers a mild form of the same loss aversion that makes people reluctant to switch bank accounts or insurance plans, even when a better option is clearly available.

Consumer contexts show the largest default effects (b=0.73 in the domain moderator analysis). App onboarding and feature settings fall squarely in this territory. If your users don't have strong pre-formed preferences about, say, whether notifications should be grouped or ungrouped, your default is the decision — the user will almost certainly keep whatever you set.

**strongly supported (38-46).** The Jachimowicz et al. meta-analysis is methodologically strong: random-effects three-level hierarchical model, 58 datasets, n=73,675, blinded mechanism coding with inter-rater reliability reported. The extreme heterogeneity (I²=98%) is the honest caveat — the average d=0.68 conceals massive variability. Effect sizes will be smaller in low-trust contexts, in situations where users have strong prior preferences, or where the default is perceived as misaligned with the user's interest.

**Note on effect size:** The extraction notes flag a choice-architecture inflation concern. A practical working estimate for app toggle defaults, after accounting for the variability and context difference, might be meaningfully smaller than d=0.68. The directional finding — defaults drive uptake far more than any other single decision — is unambiguous even if the exact magnitude varies.

🔗 **Connect:** Defaults show up again in 14-defaults-and-onboarding, which covers first-run experience in depth. The mechanism explanation here is the foundation for the more specific onboarding guidance there.

### Why Chunking Beats Counting

As we explored in 02-information-architecture, Miller's 7+/-2 finding is widely misapplied to navigation menus. The actual limit applies to sequential recall, not visual scanning. The more relevant number for active simultaneous processing is Cowan's ~4 chunks. But the most important insight from that research is not the number — it is the mechanism of **chunking**.

For progressive disclosure, chunking gives you a powerful tool. Instead of reducing the number of options, you can group them into logical chunks with clear labels. A settings screen with 20 individual toggles scattered arbitrarily is overwhelming. The same 20 toggles organized into four labeled sections ("Notifications," "Appearance," "Privacy," "Advanced") becomes four chunks — scannable and manageable.

**strongly supported (38-46)** for the chunking mechanism. supported with limitations (30-37) for its specific application to UI settings design — the original research used artificial memory tasks, not naturalistic screen-scanning.

The practical implication: group your options into no more than four to five labeled clusters.

🎯 **Apply:** Open your phone's Settings app right now. Count the top-level sections. Then count how many items are within one section. Notice how the organizational structure (sections within categories) makes it feel navigable even though there are hundreds of individual settings. That's chunking doing the work.

## 3. How To Use This

### The Four-Tier Feature Placement Model

Every feature, option, or piece of information in your app belongs in one of four tiers. Getting this placement right is the core design work of progressive disclosure.

**Tier 1 — Always visible**

This is the main screen. The primary content. The main action. What the user sees the moment they open the app.

The rule for Tier 1: include only what the user needs to accomplish their primary task, every time. Not the full breadth of your app's capability. Not everything you're proud of. The thing the user came to do.

For a Raycast extension that searches a database: the search field and the results list are Tier 1. For a task manager: the current task list is Tier 1. For a journaling app: today's entry is Tier 1.

Cluttering Tier 1 with secondary features is the most common mistake. Each item you add to the main screen competes with the primary action for the user's attention and decision-making capacity. Every unnecessary item is, in Krug's framing, a question mark — a tiny tax on the user's attention budget.

**Tier 2 — One interaction away**

This is where secondary actions live. In iOS: swipe actions on list cells, long-press context menus, action buttons in a toolbar that only appear when an item is selected. In macOS: right-click context menus, secondary toolbar items, click-to-reveal action rows. In Raycast: the Action Panel, triggered by Command+K on the selected item.

The design rule for Tier 2: these features exist and can be discovered, but they don't demand attention. The user who needs them will find them. The user who doesn't won't be bothered by them.

Good Tier 2 placement: delete, share, rename, duplicate, move. Actions that modify or redistribute content. Actions that apply only to a specific selected item. Actions that are occasionally needed but not in every interaction.

Bad Tier 2 placement: primary actions, things users need to do on every use, things that are so important users might not know to look for them.

**Tier 3 — Settings / configuration panel**

Preferences. Per-user customization. Power-user options. Edge cases that most users will never configure.

Tier 3 is intentionally removed from the task flow. Reaching it requires deliberate navigation to a settings screen. Users who arrive here know they're in configuration mode, not task mode.

In iOS: a dedicated Settings screen navigated to from a toolbar or navigation bar item, or from within the device's Settings app. In macOS: a Preferences window (Cmd+,). In Raycast: the extension's Preferences pane, accessible from the Raycast preferences.

The rule for Tier 3: put things here that would genuinely serve a minority of users and would clutter Tier 1 and Tier 2 for everyone else. Notification preferences. Theme choices. Default values. Keyboard shortcut overrides. Sync settings.

Do not use Tier 3 as a dumping ground for features you're not sure where to put. If a feature genuinely serves a common use case, it needs to be in Tier 1 or Tier 2, not buried in settings where users won't find it.

**Tier 4 — Not yet (deferred or absent)**

This is for features that don't yet exist, or that exist but aren't appropriate for the current version, or that you're deliberately holding back until you see evidence that users want them.

Tier 4 is not where you delete features. It's where you park them. "This feature won't be in v1. If users ask for it, or if analytics show they're trying to find it, it moves to Tier 2 or Tier 3."

The strategic value of Tier 4 is that it allows you to ship a focused, simple first version without foreclosing future capabilities. The Raycast team has shipped enormous amounts of capability in Tier 4 — the extension ecosystem allows anyone to add features without cluttering the core interface.

### Walking the Model Through a Real Raycast Extension

Imagine you're building a Raycast extension that lets you search and manage a collection of saved text snippets.

**Tier 1 (always visible):** The search field and the list of snippets, each showing title and a brief preview. This is what you see the moment you open the extension.

**Tier 2 (one interaction away):** On any selected snippet, Command+K opens the Action Panel with: Copy to Clipboard (the primary action, also available via Return), Edit Snippet, Delete Snippet, Share Link.

**Tier 3 (settings panel):** The extension's Preferences pane includes: default sort order (alphabetical vs. recency), whether to show snippet previews in the list, keyboard shortcut override, and a "clear all" option.

**Tier 4 (not yet):** Tags, snippet versioning, AI-powered search, browser paste integration. Features you're considering for the future, but not ready to build.

What does this accomplish? A user who opens the extension for the first time sees a clean search-and-list interface. They can find their snippet and copy it in two interactions (search, Return). They don't see the preference system, the delete flow, or the share mechanism until they need any of those things. The extension feels simple. The capability is there.

Compare this to a version where the main screen shows snippets with delete buttons visible on each row, sort controls in the toolbar, an always-visible "edit mode" toggle, and a tags panel below the search field. Identical features, but the surface is overwhelming — and every user, including the majority who just want to search and copy, is paying a visual cost for capabilities only a few need.

Pause and predict: Look at Things 3 on macOS. When you first open it, what's in the sidebar? What's hidden inside each project (accessible by opening it)? What's only accessible by right-clicking or long-pressing? What's in Settings? Try to map Things' interface onto the four-tier model before continuing.

### How to Design Your Defaults

Because defaults are the most powerful single design decision you make, they deserve deliberate thought — not a default default.

For each setting or option in your app, ask three questions:

**What do most users want here?** If 80% of users want notifications on, default to on. If 80% of users would be annoyed by notifications, default to off. The default should serve the majority without requiring them to configure anything.

**What would a first-time user likely expect?** The implicit endorsement mechanism means users treat the default as a recommendation. If your default is something unexpected or counterintuitive, it will feel like a bug. The default should match the mental model most users arrive with.

**What are the consequences of getting this wrong?** For low-stakes settings (sort order, theme), getting the default wrong is a minor inconvenience. For high-stakes settings (who can see content, whether data is synced, notification permissions), getting the default wrong erodes trust. Err toward the safer, more conservative option for high-stakes settings and toward the more convenient option for low-stakes ones.

The mechanism that makes defaults sticky isn't primarily laziness — it's implicit endorsement combined with loss aversion. Users trust that you've thought about the default. Make sure you actually have.

A practical rule of thumb: for every feature you add, write down the default state and the reasoning for it before you ship. If you can't articulate the reasoning, you haven't thought about it enough.

### Quick-Start Protocol

1.  List every feature, option, and piece of information in your app (or the screen you're currently designing).

2.  Assign each item to a tier: Tier 1 (always visible), Tier 2 (one interaction away), Tier 3 (settings), or Tier 4 (not yet).

3.  Audit Tier 1 ruthlessly: does every item here serve the user's primary task on every use? If not, move it to Tier 2.

4.  For Tier 2 items, verify they have a discoverable trigger: a swipe gesture, a long-press, a right-click, a Command+K panel. If the trigger is non-obvious, add a hint (a visual affordance, an onboarding tooltip).

5.  For each setting in Tier 3, write down its default value and the one-sentence reason you chose it. If you can't write the reason, reconsider whether the setting should exist.

6.  Group Tier 3 settings into no more than 4-5 labeled sections using chunking principles.

### Decision Tree

**Is this the primary action or primary content the user came for?** → Yes: Tier 1. Always visible. → No: Continue.

**Is this needed on most uses, for most users?** → Yes: Tier 2 — make it one interaction away via swipe, right-click, or action panel. → No: Continue.

**Is this a per-user preference or power-user option that some users need but most don't?** → Yes: Tier 3 — settings / preferences panel. → No: Tier 4 — defer it, or cut it.

**For a Tier 3 setting — what should the default be?** → Ask: what do 80% of users want? → Set that. → Ask: is this high-stakes or low-stakes? → For high-stakes, default conservative. → Ask: does this default match user expectations? → If no, reconsider.

**Is this feature complex or simple to compare to alternatives?** → Complex (many attributes, nonalignable options): Simplify the presentation, add a recommendation, or break into a guided flow. → Simple: Present directly.

**Is the user in task mode or browsing/configuring mode?** → Task mode: Show only Tier 1 and necessary Tier 2 items. → Config mode: Surface Tier 3 settings — the user is ready for them.

### Design Checklist

**Avoid:**

- Putting features in Tier 1 "just in case" the user needs them — this is the most common source of cluttered main screens
- Using Tier 3 (settings) as a dumping ground for unplaced features — settings should be configured once, not used routinely
- Undiscoverable Tier 2 actions — if swipe, long-press, or right-click reveals important features, add at least one visible hint during onboarding
- Choosing defaults without deliberate reasoning — "I'll set a default later" is never the right answer
- Fighting the platform's defaults pattern — Raycast extensions have a Preferences system precisely so that non-default behavior lives there, not on the main screen

**Do:**

- Frame early interactions as exploratory, not committing — reduce overload by reducing the stakes of early choices
- Group options in threes and fours using visual chunking — labeled sections compress cognitive load better than any amount of feature trimming
- Ensure Tier 2 actions exist within the platform's expected interaction vocabulary (swipe, long-press, right-click, keyboard shortcut) rather than inventing new gestures
- Write the default value and reason for every Tier 3 setting before shipping

## 4. Practice Lab

This lab takes 20-30 minutes. Work with a specific screen in your app — either the main screen or a settings screen. If you don't have an app in progress, use the hypothetical: "a Raycast extension for searching saved code snippets."

**Setup**

Name your screen and its purpose: Screen: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ User's primary goal when they arrive here: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

**Step 1 — Full inventory (5 min)**

List everything that currently appears (or that you're considering including) on this screen. Don't edit yet.

\[ \] Item: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ \[ \] Item: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ \[ \] Item: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ \[ \] Item: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ \[ \] Item: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ \[ \] Item: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ \[ \] Item: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ \[ \] Item: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ \[ \] Item: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ \[ \] Item: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

**Step 2 — Tier assignment (5 min)**

For each item in your inventory, assign a tier using these criteria:

- **T1**: User's primary task — needed on most uses, by most users, at first glance
- **T2**: Secondary — needed sometimes, should be accessible but not always visible
- **T3**: Settings/config — needed rarely, by some users, for personalization
- **T4**: Not yet — useful idea but not ready or not necessary for v1

| Item | Tier (T1/T2/T3/T4) | Reason |
|------|--------------------|--------|
|      |                    |        |
|      |                    |        |
|      |                    |        |
|      |                    |        |
|      |                    |        |
|      |                    |        |
|      |                    |        |
|      |                    |        |

**Step 3 — Tier 1 audit (5 min)**

List all items you assigned T1:

------------------------------------------------------------------------

Now apply this test: if you imagine a user opening this screen to accomplish their primary goal, do they need to see or interact with each T1 item on most visits?

\[ \] Remove any T1 items that fail this test — move them to T2.

Revised T1: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

**Step 4 — Default design (5 min)**

For each setting or toggle in your app (T3 items), fill in this table:

| Setting | Default value | Primary mechanism | Reasoning |
|----|----|----|----|
|  |  | \[ \] Endorsement \[ \] Endowment \[ \] Effort |  |
|  |  | \[ \] Endorsement \[ \] Endowment \[ \] Effort |  |
|  |  | \[ \] Endorsement \[ \] Endowment \[ \] Effort |  |
|  |  | \[ \] Endorsement \[ \] Endowment \[ \] Effort |  |

For "Primary mechanism": Endorsement = "most people choose this and users trust your judgment." Endowment = "users will perceive this as the status quo." Effort = "changing this requires meaningful work."

**Step 5 — Grouping check (5 min)**

How many T3 settings do you have? \_\_\_\_\_

Can you group them into 4 or fewer labeled sections?

Section 1: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ (items: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_) Section 2: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ (items: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_) Section 3: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ (items: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_) Section 4: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ (items: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_)

**Step 6 — Discoverability check (5 min)**

For each T2 item, identify its trigger — how does the user access it?

| T2 Item | Trigger | Is the trigger platform-standard? |
|---------|---------|-----------------------------------|
|         |         | \[ \] Yes \[ \] No                |
|         |         | \[ \] Yes \[ \] No                |
|         |         | \[ \] Yes \[ \] No                |
|         |         | \[ \] Yes \[ \] No                |

For any "No": add a discoverability hint to your backlog (contextual tooltip, onboarding step, empty state that surfaces the action).

**Completion criteria**

\[ \] Every item in your inventory has been assigned to a tier \[ \] T1 contains only items needed on most visits for most users \[ \] Every T3 setting has a written default value and reason \[ \] T3 settings are organized into 4 or fewer labeled groups \[ \] Every T2 item has a discoverable, platform-standard trigger

## 5. Key Takeaways

- **Choice overload is real but conditional.** More options alone don't cause overload — complexity, task difficulty, preference uncertainty, and commitment pressure are the actual drivers. The design response is curating options to be distinct and comparable, providing recommendations, and framing early choices as exploratory. strongly supported (38-46) for the moderator model; supported with limitations (30-37) for digital UI application.

- **Defaults are the most powerful single design decision you make.** Opt-out versus opt-in produces an average d=0.68 effect on uptake across 73,675 participants — larger than social norm nudges, framing effects, or incentives. Three mechanisms drive this: implicit endorsement, endowment (loss aversion from the status quo), and effort asymmetry. strongly supported (38-46).

- **The four-tier model: always visible, one away, settings, not yet.** Every feature belongs in exactly one tier. The most common mistake is placing too many things in Tier 1. Tier 4 is not deletion — it's deferral with the option to revisit. supported with limitations (30-37).

- **Chunking reduces overload more reliably than counting options.** Grouping settings into four to five labeled sections compresses cognitive units and makes large option sets manageable. The original 7±2 limit applies to active memory recall, not visual scanning — chunking is the relevant mechanism, not a maximum item count. strongly supported (38-46) for the chunking mechanism.

- **Never remove features — defer them.** The progression from v1 to mature app is not subtraction. It's tier migration: Tier 4 moves to Tier 3, Tier 3 features that become common enough move to Tier 2. Progressive disclosure preserves capability while maintaining clarity (practitioner consensus). supported with limitations (30-37).

# Chapter 05: Visual Hierarchy — Making the Important Thing Look Important

The question for this chapter is: How do I make it obvious what to look at first on a screen?

## 1. What This Is

Open Raycast. Notice what your eye lands on first. It is the search field — large, centered, unmistakably the place to start. Everything else on that screen recedes. The recent commands list sits below in a smaller, lighter typeface. The keyboard shortcut hints are lighter still. Nothing competes with the one thing you are supposed to do.

Now open a cluttered settings screen in an app you find difficult to use. Notice how your eye wanders. There is no obvious starting point. Everything appears to be roughly the same size, roughly the same weight, roughly the same color. The screen is giving you no guidance. That experience of visual confusion has a name, and it has a cure.

Visual hierarchy is the principle that some things on a screen should look more important than others — and that the visual difference between levels should be dramatic enough that the ranking is instantly obvious. When hierarchy works, your eye knows where to go. When it fails, everything competes equally and the user has to do the cognitive work of figuring out what matters.

Here is the counterintuitive part: many visual hierarchy problems are not caused by bad taste. They are caused by timidity. A common beginner mistake is using differences that are too small — 14 points versus 16 points, medium versus semibold, light grey versus slightly-lighter grey. These differences can look like mistakes rather than decisions. The usual cure is to make the intended difference clearer—often bigger, but always in service of a deliberate hierarchy.

This chapter gives you the vocabulary and the specific levers to create hierarchy that is unmistakably clear — the kind you see in Things 3, in OpenAI's ChatGPT interface, in Raycast. And it gives you a diagnostic framework — the CRAP principles — that turns the vague feeling of "something looks off" into a solvable, nameable problem.

## 2. What The Research Shows

### The Vocabulary Problem

Robin Williams makes a striking claim in non-designers-design-book: design incompetence is not a taste problem — it is a vocabulary problem. Once you have a name for something, you can see it. Before you have the name, you cannot.

She calls this the Joshua Tree Epiphany. Once you learn what a Joshua tree looks like, you suddenly notice them everywhere. The same thing happens with visual design principles: learn the name, and you start seeing the failure mode everywhere — including in your own work.

This is why this chapter begins with frameworks and names. Not because learning vocabulary is an end in itself, but because the vocabulary is what makes diagnosis possible. You cannot fix what you cannot see, and you cannot see what you cannot name.

The four principles Williams identifies — Contrast, Repetition, Alignment, Proximity, abbreviated as CRAP — are not decorative theory. They are a diagnostic toolkit. When something looks off in your UI, CRAP tells you which problem you are looking at. practitioner consensus (foundational pedagogy; no empirical studies cited).

### The Three Levers of Hierarchy

Adam Wathan and Steve Schoger's refactoring-ui establishes something that beginners consistently miss: visual hierarchy is controlled by three levers, not one.

Most people think hierarchy = size. Make the heading bigger, and it will look more important. This is true but incomplete. The three levers are size, weight, and color — and they work together to create the full range of hierarchy you need.

**Size** is the most obvious signal. A 32-point title reads as more important than 16-point body text. But you cannot size your way out of every hierarchy problem. If you make your heading huge but leave it in the same weight and color as everything else, you will have a big-but-boring element, not a dominant one.

**Weight** — the thickness of letterforms — is often more powerful than size for distinguishing levels within a tier. A 17-point semibold label feels more authoritative than an 18-point regular-weight one. Weight carries a sense of permanence and importance that size alone does not. In Refactoring UI's model: normal weight (400–500) for body; heavy weight (600–700) for emphasis. Do not go below 400 in any interface text — thin weights dissolve at small sizes.

**Color** creates the rest of the hierarchy. On a white or light background: dark text (near-black) = primary. Mid-grey = secondary. Light grey = tertiary. This gives you three levels of visual importance without changing a single font size. Think of how Things 3 renders your task list — the task name is dark and prominent, the due date sits in a lighter mid-grey, the project tag even lighter. Three tiers of information encoded entirely through color. practitioner consensus (refactoring-ui).

Pause and predict: Before reading further, open any screen in an app you use daily. Try to name the visual hierarchy levels. How many tiers can you count? What lever (size, weight, color) is doing the most work? What would happen if you made the difference between tiers more extreme?

### Timidity: The Most Common Failure

The CRAP framework names a failure mode Williams calls the Wimp Problem — and it is the single most common mistake beginners make. It looks like this:

- A heading that is 14 points when body text is 12 points. Not a decision — a conflict.
- A label in dark brown when the body text is black. Not a variation — a confusion.
- One semibold element among regular-weight text. Not hierarchy — a mistake.

The rule is stark: if elements are not exactly the same, make them very different. There is no useful middle ground between same and dramatically different. Slight differences always read as errors, not intentions.

The practical implication: whenever you are adding hierarchy, ask whether the difference is large enough to be unmistakably intentional. If you have to squint to see it, it is not big enough. Go bigger. Then go bigger again. Williams recommends what she calls the Squint Test — literally squint at your layout. The hierarchy should be legible even when you cannot read the individual words. practitioner consensus (non-designers-design-book).

### The CRAP Diagnostic Framework

CRAP is not four separate ideas. It is a nested system where each layer builds on the previous one.

**Proximity** creates groups. Items that are physically close together are perceived as related — this is not a preference, it is a hardwired perceptual reflex. On your screen: if your form label is equidistant between the field above and the field below, users cannot tell which field it belongs to. Put it unmistakably close to its own field and far from everything else. If your section heading has the same space above and below it, the eye cannot tell whether it introduces the section below or concludes the section above. Give it more space above than below — it belongs to what follows. strongly supported.

**Alignment** creates order. Every element on your screen should share a visual edge with at least one other element. This invisible alignment grid is what separates an "organized" feeling from a "random" feeling. The most common mistake is centering everything — centered text produces a jagged, weak alignment edge on both sides. Left-aligned text produces a strong, consistent edge on the left. Reserve centering for short, isolated elements (a section title, an empty state message) — not as the default for everything.

Williams' rule: choose one alignment per screen and commit to it. When you need to mix, make the exception so deliberate that it reads as a decision, not an accident.

**Repetition** creates consistency. Every time you reuse a visual element — a font size, a border-radius, a color, a spacing value — you are teaching the user your design system. They learn "italic text in grey means metadata." They learn "this shade of blue means interactive." They learn "elements this size are secondary." This learning happens unconsciously, which is why consistency matters. Breaking your own patterns causes friction without the user knowing why. practitioner consensus (non-designers-design-book, refactoring-ui).

**Contrast** is the hierarchy engine. Williams' rule: if not exactly the same, make very different. No in-between. Contrast creates the entry point — the thing the eye goes to first. Contrast also clarifies relationships: when the heading is dramatically larger and heavier than the body text, the hierarchy is unambiguous. When they are close in size and weight, the hierarchy is invisible and the user's eye has nowhere to start.

The CRAP principles operate in sequence in your workflow: first group related things (Proximity), then line them up (Alignment), then make sure you are consistent across similar elements (Repetition), and finally ensure enough contrast exists that the most important thing is unmistakably the most important thing (Contrast).

🔗 **Connect:** Think about the CRAP principles in terms of an app you use every day — Raycast, Things 3, or ChatGPT. Where is Proximity doing work? Where is Alignment holding the layout together? Can you see the Repetition in the visual system? What has the highest Contrast on the screen, and is that the thing you actually want users to look at first?

### Classical Aesthetics Predicts Perceived Usability

As we covered in 01-functional-case-for-design, Lavie and Tractinsky found that classical aesthetics — orderly, clear, clean, and symmetric design — correlates with perceived usability at r=0.68 to r=0.78, substantially more than expressive aesthetics (r=0.40 to r=0.46). The relevance here is direct: visual hierarchy done well is not in conflict with aesthetic beauty. Orderly and clear IS the aesthetic.

Raycast is beautiful precisely because it is orderly. Things 3 is beautiful precisely because its hierarchy is immaculate — task names dominant, metadata receding, labels almost invisible. OpenAI's ChatGPT interface is beautiful because there is virtually nothing competing with the conversation itself.

You do not have to choose between pretty and clear. In the classical aesthetic tradition, clarity IS pretty. supported with limitations (N=866, cross-validated, web stimuli only; native app applicability inferred).

### Color Grouping and the Proximity Requirement

Peterson and Berryhill's 2013 study found that grouping by color similarity improved visual working memory accuracy — but only when similar-colored items were also spatially proximate.

When items with the same color were separated by even one intervening item, the grouping benefit disappeared. The key implication for UI design: you cannot use color alone to communicate grouping. If you color-code a set of items but scatter them across a layout, users do not perceive them as a group. Color grouping only works when the items are also physically close together.

In practical terms: if you have a set of related actions in a toolbar and you want to communicate that they belong together, you need both the shared visual treatment AND physical proximity. One without the other provides no grouping signal. early-stage (small sample, N=23 students, laboratory task; directional finding is theoretically well-grounded and replicated across two experiments).

🎯 **Apply:** Look at the navigation bar or toolbar in your current project. Are the controls that belong together physically adjacent? If you use color or icon style to group them, are they also close? If you separated them to add visual balance, you may have accidentally broken the grouping signal.

### De-emphasizing Is More Powerful Than Emphasizing

One of the most useful insights from refactoring-ui is this: when the primary element is not standing out, your instinct is to make it bigger or bolder. This is usually the wrong move. The more effective technique is to de-emphasize everything else.

Soften the weight of inactive navigation items so the active one dominates by contrast. Lighten the color of secondary information so the primary information feels darker and more important. Reduce the visual weight of supporting labels so the actual data they describe takes center stage.

This is exactly what Raycast does with its command list. The command name is full-weight. The keyboard shortcut is lighter. The category tag is lighter still. No individual element was inflated — the primary element dominates because everything around it was dialed back.

The hierarchy does not come from making the important thing loud. It comes from making everything else quiet.

## 3. How To Use This

### Starting From Hierarchy, Not Style

When you are laying out a new screen, begin by establishing hierarchy before you think about aesthetics. The practical sequence is:

Open a blank canvas (or a blank SwiftUI view). List everything that needs to appear on the screen. Rank that list by importance: what is the one thing the user came here to do? What is the supporting information they might need? What is the metadata that might occasionally be relevant?

That ranking is your hierarchy. The number-one item gets the most visual weight. Everything else gets progressively less. Do not make any visual decisions until you know this ranking.

### The CRAP Quick-Start Protocol

When you are building or auditing any screen, work through CRAP in order:

1.  **Proximity first.** Group related elements by pulling them close together. Increase the space between groups. Make the internal spacing within a group smaller than the external spacing between groups. Check every label, heading, and helper text: does it unambiguously belong to the thing it describes?

2.  **Alignment second.** Pick one alignment (almost always left-align for primary content) and apply it consistently. Check that every element shares a visual edge with at least one other element. Identify any elements that appear to float — they need to snap to an edge.

3.  **Repetition third.** Audit your visual decisions for consistency. If your section headings use a certain size and weight, every section heading should use exactly that size and weight. If your secondary text is a certain grey, every piece of secondary text should use that grey. If something differs, it should differ intentionally and dramatically.

4.  **Contrast last.** Apply the Squint Test. Hold your layout at arm's length and blur your eyes. Can you read the hierarchy without being able to read the words? Is there one unmistakable focal point? If not, increase the contrast between your primary element and everything else — size it up, weight it up, or darken it. Then de-emphasize competing elements by going lighter, thinner, or grayer.

5.  **Use all three hierarchy levers together.** Confirm that you are using size, weight, AND color — not just one. A heading that is larger but identical in weight and color to body text is not as dominant as it should be.

### Decision Tree

**"My layout looks flat — nothing stands out."**

- Is the primary element using all three hierarchy levers (larger, heavier, darker)? If not, apply them.
- Are competing elements too loud? Reduce their weight, lighten their color, or decrease their size.
- Does the layout pass the Squint Test? Literally squint — if the primary item does not pop, the difference is not big enough.

**"Something looks wrong but I cannot tell what."**

- Start with Proximity: do any labels appear to belong to the wrong element?
- Check Alignment: is there an element that appears to float without a shared edge?
- Check Repetition: is there an element that uses a slightly different style from its peers without a good reason?
- Check Contrast: is there an element that looks almost-but-not-quite like another, creating a conflict instead of a clear decision?

**"I have too much important information — everything needs to stand out."**

- Hierarchy is relative and zero-sum. If everything is bold, nothing is bold.
- Re-rank your content ruthlessly. If the user can only look at one thing, what should it be? Make only that one thing the primary element.
- Move truly secondary content to a lesser visual tier — not removed, just quieter.

**"My design looks good in isolation but feels inconsistent when I see multiple screens together."**

- This is a Repetition failure. Define your heading styles, secondary text color, and spacing values as fixed tokens. Use exactly those values everywhere — do not make one-off adjustments per screen.

### Design Checklist

**Avoid these failure modes:**

- Slight differences that look like mistakes (the Wimp Problem) — commit to same or dramatically different, never in-between
- Centering everything without a strong reason — default to left-alignment
- Using color to group elements that are not also spatially adjacent
- Making every element the same visual weight — hierarchy requires inequality
- Amplifying the primary element when de-emphasizing secondary elements is the better move

**Do these as ambient practices:**

- Apply all three hierarchy levers (size, weight, color) intentionally, not by default
- Let the most important action or information genuinely dominate — protect it from competition
- Treat your visual variables (heading sizes, grey levels, font weights) as a limited palette — choose them deliberately and reuse them consistently
- Design for classical aesthetics (orderly, clear, symmetric) as the default register — expressive distinctiveness can be added selectively, but clarity comes first

### Platform Implementation Notes

**SwiftUI:** Font weight is controlled with `.fontWeight(.semibold)` or `.font(.headline)` / `.font(.subheadline)` from the system semantic type scale. For color hierarchy, use Apple's semantic text colors: `.primary` (full opacity), `.secondary` (60% opacity), `.tertiary` (30% opacity). These automatically adapt to light and dark mode. Avoid hardcoding `Color.gray` — use `.secondary` instead.

``` swift
// Example hierarchy in a list row
VStack(alignment: .leading, spacing: 2) {
    Text(task.title)
        .font(.body)
        .foregroundStyle(.primary)
    Text(task.dueDate)
        .font(.caption)
        .foregroundStyle(.secondary)
}
```

**Raycast extensions:** Raycast's component library enforces hierarchy through its own design system. `<List.Item title="..." subtitle="..." />` uses the `title` as primary (full weight/color) and `subtitle` as secondary (lighter). Work with this system, not against it — do not try to override Raycast's default visual hierarchy through custom styling.

## 4. Practice Lab

This lab takes approximately 20–30 minutes. You will apply CRAP directly to a real screen, identify its failure modes, and fix them.

### Setup

Pick one screen from a project you are currently building or planning. If you do not have a project, sketch a task management screen that shows: a list of tasks, each with a name, due date, and priority tag.

**Step 1 — Audit for the Wimp Problem** (5 minutes)

Look at your screen and list every visual difference you can find. Write down each pair: element A vs. element B, and what makes them different (size, weight, color).

For each pair, ask: is this difference large enough to be unmistakably intentional?

- Identified all visual difference pairs on the screen
- Marked any pair where the difference is subtle enough to read as a mistake
- For each subtle pair, decided: make them the same, or make the difference much larger

**Step 2 — Apply the Squint Test** (3 minutes)

Step back from your screen or hold it at arm's length. Blur your eyes slightly.

- Can you identify the primary element (the most important thing) without reading any words?
- Is there a clear focal point — one thing your eye goes to first?
- If not, note which elements are competing for dominance

**Step 3 — CRAP audit** (10 minutes)

Work through each principle in order and answer the questions below.

**Proximity:**

- Does every label appear to belong unambiguously to the element it describes?
- Is the spacing within each group smaller than the spacing between groups?
- Does every section heading have more space above it than below it?

**Alignment:**

- Is there a consistent alignment edge running through the primary content?
- Are there any floating elements with no shared edge to another element?
- If there is a mix of left-aligned and centered elements, is the mixing intentional and dramatic?

**Repetition:**

- Are all elements of the same type (all section headings, all body text, all secondary labels) using identical visual treatment?
- Is there any element that uses a slightly different style from its peers without a strong reason?

**Contrast:**

- Does the primary element use all three hierarchy levers: larger AND heavier AND darker than secondary content?
- Are there any two elements that look almost the same but are not quite the same (a conflict, not a contrast)?

**Step 4 — Fix one thing** (5–10 minutes)

Choose the most impactful problem you found. Make one targeted change:

- If the primary element does not stand out: increase its size, weight, or darkness — or reduce the weight/color of competing elements

- If a label appears to belong to the wrong element: adjust spacing so it is unmistakably close to the right element

- If two elements create a visual conflict: commit to making them the same, or make the difference dramatic

- Made one targeted fix based on the audit

- Re-ran the Squint Test after the fix — does the primary element now dominate?

- Note what change had the most visible impact

**Step 5 — Name your hierarchy levels** (5 minutes)

Write down your screen's hierarchy in plain language:

- Level 1 (primary): \[what is it, and what visual treatment does it get?\]

- Level 2 (secondary): \[what is it, and what visual treatment does it get?\]

- Level 3 (tertiary): \[what is it, and what visual treatment does it get?\]

- Can articulate three distinct hierarchy levels by name and visual treatment

- Every element on the screen belongs to one of these three levels

- No two adjacent levels use similar enough treatment to create conflict

## 5. Key Takeaways

- **Design incompetence is a vocabulary problem, not a taste problem.** The CRAP framework — Contrast, Repetition, Alignment, Proximity — gives you the names to diagnose failures you could previously only feel. Once you have the names, you can see and fix problems that were invisible before. (foundational practitioner pedagogy — non-designers-design-book)

- **Timidity is the most common design failure.** Slight differences between elements — close-but-not-the-same sizes, weights, and colors — register as mistakes, not decisions. The rule is: same or dramatically different. Never in-between. (practitioner consensus — non-designers-design-book)

- **Visual hierarchy requires all three levers: size, weight, and color.** Using only size produces weak hierarchy. Combine all three deliberately: the primary element should be larger, heavier, and darker than secondary content. (practitioner consensus — refactoring-ui)

- **Classical aesthetics (orderly, clear, symmetric) correlates more strongly with perceived usability than expressive aesthetics.** The correlation between classical aesthetics and perceived usability was r=0.68–0.78 across validation samples. Designing for clarity is not in conflict with beauty — in the classical register, clarity IS beauty.

- **Color grouping requires spatial proximity.** Assigning the same color to related elements only creates a grouping signal when those elements are also physically adjacent. Color alone, without proximity, produces no working memory benefit.

# Chapter 06: Layout & Spacing — The System Behind Breathing Room

The question for this chapter is: How do I make a layout feel balanced and intentional rather than cramped or random?

## 1. What This Is

Look at two screens side by side. The first is OpenAI's ChatGPT interface. The conversation content sits in a comfortable column, generously spaced. The input field at the bottom has breathing room above and below it. The margins are wide. Nothing feels compressed.

The second screen is a cluttered settings panel — every preference crowded next to every other preference, inputs stacked with barely a pixel between them, labels ambiguously close to both the field above and the field below.

Both screens contain information. But one feels calm and easy to read, and one feels like a wall of input you have to push through. The difference is not the content. It is the spacing.

Here is what most beginners do not realize: that feeling of "breathing room" is not a vague aesthetic preference. It is functional. White space is not empty space — it is the mechanism by which layout communicates relationships. Close spacing tells the eye: these things belong together. Distance tells the eye: these things are separate. Every pixel of spacing is an assertion about the structure of information. When spacing is random, the structure is invisible. When spacing is systematic, the structure speaks for itself.

This chapter solves the problem: "my layout feels cramped or random, and I don't know why or how to fix it." It gives you the specific system for spacing that Raycast, OpenAI, and Things 3 all use in their own ways — the same underlying logic expressed in different contexts.

## 2. What The Research Shows

### Proximity: Layout Encodes Relationships

The Gestalt principle of proximity is simple and powerful: items that are physically close together are perceived as related. This is not a preference — it is a pre-conscious perceptual reflex. Your eye perceives spatial proximity as a relationship signal before you have read a single word.

The design implication is profound. If you place a form label equidistant between two fields, the label appears ambiguous — does it belong to the field above or the field below? If you place a section heading with equal space above and below, the eye cannot tell whether it introduces the section that follows or concludes the section above. If you give equal spacing between items within a group and between groups, the groups dissolve.

Proximity is the primary way layout communicates information structure without words. Before you add any label, any dividing line, or any color block to communicate grouping, ask whether spacing alone could do the job. Often it can. strongly supported.

A practical consequence from refactoring-ui: always ensure more space exists around a group than within it. Internal spacing must be smaller than external spacing. This is the rule that most beginners violate most often. They set a spacing value for the gap between a label and its input, then use that same value for the gap between one form section and another. The sections lose their identity. The fix is simple: the space between sections should be larger — often two to four times larger — than the space within a section.

### Alignment: The Invisible Grid

The second CRAP principle from non-designers-design-book is alignment, and it works through a mechanism that is almost invisible when it is working and immediately jarring when it is not. Every element on a screen should be aligned to an implicit grid — sharing a visual edge with at least one other element.

The eye perceives these alignment edges as invisible lines running through the composition. When elements line up, the invisible line is strong and clean and creates an organized feeling. When an element floats without a shared edge, there is no line — and that element reads as arbitrary, as if it landed there by accident.

The most common beginner mistake with alignment is centering everything. Centering feels safe and balanced, but it produces weak, jagged alignment edges on both sides. Left-alignment produces a strong, consistent edge on the left. Reserve centering for short, isolated elements — a dialog box heading, an empty state message, a single-line callout. As a default for lists, forms, body content, and navigation, left-alignment is almost always stronger.

The specific failure mode to avoid is what Robin Williams calls the Centered Trap: a layout where some elements are left-aligned and others are centered, creating inconsistency without intention. If you mix alignment directions, the different alignment must be so dramatic and deliberate that it reads as a design decision, not an oversight.

Think about Raycast's list view. Every item is left-aligned. The icon, the command name, the category tag — all share the same left edge. This invisible vertical line runs the length of the entire list and creates an organized, scannable structure. If even one item were centered or indented differently without reason, the grid would break. practitioner consensus (non-designers-design-book, designing-interfaces).

### The Non-Linear Spacing Scale

Here is the insight that turns arbitrary spacing into a system: adjacent spacing values must differ by at least 25% to be perceptibly distinct.

The human eye perceives relative differences, not absolute ones. The difference between 12px and 16px is 4px in absolute terms, but it is a 33% relative difference — clearly visible. The difference between 100px and 104px is also 4px in absolute terms, but it is only 4% — imperceptible. This means that a spacing scale with values that are too close together effectively collapses to a single value. Your "three different spacing sizes" all look the same.

Wathan and Schoger in refactoring-ui formalize this as the non-linear spacing scale rule: pre-define a limited set of spacing values where each step is meaningfully different from the previous one, with a minimum 25% gap between adjacent values. A concrete scale that works well: 4px, 8px, 12px, 16px, 24px, 32px, 48px, 64px.

Notice how the gaps grow as the values grow. From 4 to 8 is a 100% increase. From 8 to 12 is 50%. From 12 to 16 is 33%. From 16 to 24 is 50%. From 24 to 32 is 33%. From 32 to 48 is 50%. Each step is meaningfully distinguishable from the one before it.

This is the secret behind why Raycast's spacing feels disciplined and intentional. It is using a consistent scale — an 8px base grid — so every spacing decision is a multiple of 8: 8, 16, 24, 32, 48, 64. When you use values from the same scale consistently, the layout has an underlying rhythm. When you use arbitrary values (17px here, 23px there, 11px somewhere else), the layout feels random even if the individual choices seem reasonable.

Pre-define your scale before you start laying out any screen. Then use only values from that scale. practitioner consensus (refactoring-ui).

Pause and predict: Before reading the next section, estimate: if you replaced all the spacing in your current project with values from the 4–8–12–16–24–32–48–64 scale, rounding each existing value to the nearest option, how much would the layout change? Would it become more or less consistent? What would you lose?

### White Space Is Functional, Not Wasted

There is a persistent misconception among beginners that white space is empty space — wasted real estate that could be holding more content. This is backwards.

White space is information. It communicates the absence of relationship. It says: these things are in different categories. It gives the eye a place to rest before moving to the next group. It isolates important elements so they can dominate their area. It is the mechanism by which hierarchy becomes legible at glance speed.

A widely referenced finding in UX literature (practitioner consensus) is that white space increases comprehension and satisfaction even when it does not improve raw reading speed. The benefit is not speed — it is understanding. Readers better grasp the structure of content when that structure is communicated through spacing rather than through explicit labels and dividers.

The practical rule from refactoring-ui: start with more whitespace than you think you need, then trim. Never start cramped and add space reactively — cramped layouts reach the minimum acceptable threshold but rarely achieve the comfortable, confident spacing of a polished app.

OpenAI's ChatGPT is a case study in strategic white space. The conversation column is narrow relative to the available screen width. There is substantial margin on both sides. Each message has generous vertical padding. The input field has breathing room above it. None of this space is wasted — every pixel of it is telling the user: this is a focused space, the conversation is the only thing here, you can relax. The alternative — a full-width layout with tightly packed messages — would feel anxious and cluttered even with identical content. practitioner consensus; comprehension and satisfaction benefits widely referenced in UX literature.

### Gestalt Grouping Hierarchy

Not all grouping signals are equally strong. As covered in 05-visual-hierarchy, the Gestalt hierarchy of grouping mechanisms runs from strongest to weakest: **enclosure \> connection \> proximity \> similarity**.

For layout decisions, the practical translation is: when you need strong, unambiguous grouping (a navigation panel, a settings category, a card), use enclosure — drawing a boundary around items with a border, background, or card shadow. When you need implicit, lightweight grouping (related fields in a form, items in a list section), proximity is sufficient. Do not rely on similarity (same color, same icon style) unless proximity is also satisfied — as the Peterson research showed, color grouping without spatial proximity produces no benefit. strongly supported.

### Repetition: Training User Pattern Recognition

The third CRAP principle — Repetition — is the mechanism behind "consistent feeling." Every time a user encounters the same visual pattern — the same heading size, the same card layout, the same action button placement — they learn your system. The learning happens automatically and unconsciously. Once learned, it becomes an expectation. When you fulfill the expectation, the user feels confident. When you break it without reason, the user feels confused.

This is why design tokens matter even for a solo developer. When you hardcode spacing values by hand for each screen, you will end up with slightly different values in different places — and the layout will feel inconsistent in a way that is hard to diagnose. When you define a spacing scale once and reference it everywhere, the repetition is enforced by the system. practitioner consensus (non-designers-design-book, refactoring-ui).

The most powerful practical application of Repetition is in component design. Once you define what a list item looks like — icon on the left, primary text, secondary text, trailing accessory — every list item should look exactly like that. The user learns the pattern from the first item they see and can scan the rest of the list without reading each one carefully. Break the pattern on a single item and the user's eye stops to investigate. That interruption is a tiny cognitive tax, but it accumulates across every inconsistency on every screen.

🔗 **Connect:** Think about an app where scrolling through a list feels effortless — Things 3, Raycast, Linear. Now think about an app where scrolling a list feels like work. What is different? Pay attention to whether the list items are perfectly consistent (Repetition) and whether the spacing within each item versus between items communicates the right grouping (Proximity).

### Grids Are a Tool, Not a Requirement

One thing worth addressing directly: you do not need Figma or a formal grid system to build a well-aligned layout. The invisible grid is created by your consistent use of a spacing scale. If every spacing decision comes from the same set of values, the layout will be grid-aligned by default.

refactoring-ui makes the important point that explicit grid systems (percentage-width columns, fluid gutters) are often overengineered for the problem. Many UI elements have a natural width that is not proportional to the screen size — a search field is a certain width because of what the user needs to type, not because it should be 33% of the viewport. Forcing components onto a proportional grid makes them grow and shrink in ways that serve the grid, not the content.

Instead, give components a fixed width and let the surrounding layout accommodate them. Use your spacing scale for margins and padding. Align elements to a left edge. The result is a layout that feels intentional and grid-aligned without requiring any grid tool.

🎯 **Apply:** Pull up any screen you have built and count how many distinct spacing values it uses. Write them down: 8px here, 14px there, 20px in another place, 11px somewhere else. How many of those values are close enough together to be perceptually equivalent? Can you reduce the full set to four or five distinct values from a consistent scale? What would you need to change?

## 3. How To Use This

### Building a Spacing System from Scratch

Before you design any screen, define your spacing scale. Here is a concrete starting point that works well for macOS, iOS, and Raycast extensions:

    xs:  4px   — icon-to-label gaps, tight internal padding
    sm:  8px   — standard internal component padding
    md:  16px  — standard spacing between sibling elements
    lg:  24px  — spacing between groups within a section
    xl:  32px  — spacing between sections
    2xl: 48px  — major layout separations, page margins
    3xl: 64px  — hero-level breathing room, major screen sections

In SwiftUI, define this as an enum or extension so you reference names, not numbers:

``` swift
extension CGFloat {
    static let spacingXS: CGFloat = 4
    static let spacingSM: CGFloat = 8
    static let spacingMD: CGFloat = 16
    static let spacingLG: CGFloat = 24
    static let spacingXL: CGFloat = 32
}
```

Then: `.padding(.vertical, .spacingMD)` instead of `.padding(.vertical, 16)`. Same value, but now it is part of a named system. When you decide the standard vertical padding should be 20px instead of 16px, you change one constant, not forty `.padding()` calls.

### Layout Quick-Start Protocol

When approaching any new screen, use this sequence:

1.  **Identify the content hierarchy.** List every element the screen needs. Group related elements — a label and its field belong together; a section header and its items belong together. This grouping is your spacing map.

2.  **Establish proximity first.** Place related elements close, unrelated elements far. Use your spacing scale: items within a group get `spacingSM` or `spacingMD`; the gap between groups gets `spacingLG` or `spacingXL`. The between-group gap should always be larger than the within-group gap.

3.  **Align to a consistent edge.** Choose one primary alignment for the screen (almost always left). Line up every element to that edge. Audit for floaters — elements with no shared edge.

4.  **Set margins generously.** Start with more margin than you think you need. Specifically: use `spacingXL` (32px) as your starting horizontal margin for any content area. Then shrink if it feels too spacious. Do not start cramped and try to add space back.

5.  **Apply repetition by using the scale, not one-off values.** Every spacing value in the layout should come from your predefined scale. If you find yourself needing 19px, round to 16 or 24.

6.  **Apply the Squint Test.** Step back, blur your eyes, and confirm that the grouping is legible without reading the content. Related things should visually cluster. Separate things should have visible distance between them.

### Decision Tree

**"My layout feels cramped."**

- Are you using your smallest spacing values everywhere? Most cramped layouts are applying `xs` or `sm` spacing (4–8px) in places that need `lg` or `xl` spacing (24–32px).
- Try applying the Whitespace-First Method: temporarily double every spacing value on the screen. Does it feel more breathable? Then incrementally reduce until it feels right — that threshold is your target.
- Check your margins specifically — screen-edge margins are often the first casualty of "saving space."

**"My layout feels random or inconsistent."**

- This is almost always a spacing scale violation. List every distinct spacing value in use on the screen. If you have more than five or six distinct values, you have too many. Rationalize to the nearest scale values.
- Check for alignment violations: any element that appears to float (no shared edge with another element) contributes to the "random" feeling even if the spacing is correct.

**"I have two groups of elements but they don't feel separate enough."**

- Use a larger gap between them (move from `spacingLG` to `spacingXL` or `spacing2XL`).
- Consider using enclosure (a card container, a colored background panel) if proximity alone is not producing a strong enough group signal.
- Make the within-group spacing smaller relative to the between-group spacing if it is not already.

**"I want to add a dividing line between sections but it looks heavy."**

- A dividing line is the last resort before using spacing. Try increasing the gap between sections first (`spacingXL`). Try using a light background color change. Only add a line if neither alternative provides clear enough separation.

**"My Raycast extension looks different from Raycast's own UI."**

- Raycast extensions are constrained by the Raycast component library — you work within `<List>`, `<Grid>`, `<Detail>`, and `<Form>` components. You cannot do arbitrary layout. The spacing is handled by Raycast's design system. Work with what the system provides: use `accessories` in `<List.Item>` for trailing content, respect the built-in hierarchy of `title` / `subtitle` / `accessories`, and do not try to override spacing through custom React styles.

### Design Checklist

**Avoid these failure modes:**

- Using the same spacing value between elements within a group and between groups — this collapses the grouping signal
- Using more than five or six distinct spacing values across a screen — this creates visual randomness
- Centering content by default — defaulting to centered alignment produces weak alignment edges
- Starting with cramped spacing and trying to add space reactively — always start generous, then reduce
- Using arbitrary pixel values (11px, 17px, 23px) instead of values from a pre-defined scale
- Relying on dividing lines to separate groups when increased spacing would communicate the same separation more cleanly

**Do these as ambient practices:**

- Define your spacing scale before designing any screen — reference names, not numbers
- Always use a larger gap between groups than within groups — this is the one rule that produces the most visible improvement
- Give margins generous starting values — 24–32px horizontal margins are rarely too much
- Apply the Squint Test: the grouping structure should be legible without reading the content
- Use enclosure (card containers) for groups that need strong, unambiguous separation; use proximity for groups that need lighter, implicit separation

### Platform Implementation Notes

**SwiftUI — VStack and HStack spacing:**

The `.spacing` parameter in `VStack` and `HStack` sets the gap between all child elements. Make this a value from your spacing scale:

``` swift
VStack(alignment: .leading, spacing: .spacingMD) {
    // Related elements within a group
}
```

For a form, the gap between a label and its field is `spacingSM` (8px). The gap between one field group and the next is `spacingLG` (24px). These two values must be different — if they are the same, the groups dissolve.

**SwiftUI — Padding:**

Use `.padding()` with explicit spacing scale values. For content areas, start with `.padding(.horizontal, .spacingXL)` (32px horizontal margin) and `.padding(.vertical, .spacingLG)` (24px vertical margin). These are generous starting points — trim if the screen feels too spacious.

**iOS safe areas:**

On iPhone, the system adds safe area insets at the top (status bar) and bottom (home indicator). SwiftUI respects these automatically with `.safeAreaInset()` or the default behavior of containers. Do not add extra padding to compensate for safe areas that SwiftUI is already handling — you will double the spacing. Check your layout on a real device or simulator to verify.

**SwiftUI — LazyVStack for long lists:**

When displaying lists of items, use `LazyVStack` inside a `ScrollView` for performance, and set a consistent spacing value:

``` swift
ScrollView {
    LazyVStack(alignment: .leading, spacing: .spacingSM) {
        ForEach(items) { item in
            ItemRow(item: item)
                .padding(.horizontal, .spacingMD)
        }
    }
    .padding(.vertical, .spacingLG)
}
```

The `.spacingSM` gap between list items creates visual separation while keeping them readable as a continuous list. The `.spacingMD` horizontal padding gives each row breathing room. The `.spacingLG` vertical padding on the stack as a whole keeps the list from touching the screen edges.

**Raycast extensions:**

Raycast provides `<List>`, `<Grid>`, and `<Detail>` as the primary layout primitives. Spacing within these components is managed by Raycast's design system — you do not control it directly. What you do control: the density of content within each item (`title`, `subtitle`, `accessories`), and whether you use section headers to group related items (`<List.Section title="Recent">`). Use section headers to create explicit grouping when the content warrants it; leave them out when all items belong to a single continuous list.

## 4. Practice Lab

This lab takes approximately 25–30 minutes. You will design a spacing system and apply it to one real screen.

### Setup

You need a screen you are building or planning. If you do not have one, use this scenario: a simple "New Task" form with a title field, a due date picker, a priority selector (low / medium / high), and a submit button.

**Step 1 — Define your spacing scale** (5 minutes)

Before touching any layout, define your scale. Write down six values:

| Name | Value |
|------|-------|
| xs   | 4px   |
| sm   | 8px   |
| md   | 16px  |
| lg   | 24px  |
| xl   | 32px  |
| 2xl  | 48px  |

If you are in SwiftUI, define these as `CGFloat` constants in a file called `Spacing.swift`. If you are in React/Raycast, note them for reference.

- Spacing scale defined with at least 5 distinct values
- Adjacent values differ by at least 25%
- Values are written down or added to your codebase

**Step 2 — Audit your existing spacing** (8 minutes)

Pick one existing screen. For every spacing value you can identify, write down the approximate pixel value.

- Listed at least 6 spacing values currently in use on the screen
- Identified values that are "in between" — close to two scale options
- Mapped every existing value to the nearest scale value

Write down your answer: after rounding to the scale, how many distinct spacing values does your screen actually use? (Target: 4–5 maximum)

**Step 3 — Apply the proximity rule to one form or list** (10 minutes)

Take your existing screen (or the "New Task" form scenario). Focus on one form section or list.

Apply the proximity rule:

- The gap between a label and its field: use `sm` (8px)

- The gap between one field group and the next: use `lg` (24px)

- The gap between sections: use `xl` (32px) or more

- Within-group spacing is smaller than between-group spacing everywhere

- There are no places where the same spacing value appears both inside a group and between groups

- Every section header has more space above it than below it

Run the Squint Test:

- The grouping of related elements is legible without reading the content
- Separate groups are clearly separate at a glance

**Step 4 — Fix one alignment violation** (5 minutes)

Audit the screen for alignment.

- Identified the primary alignment edge (usually left)
- Found at least one element that floats without a shared edge — an element that appears to be placed arbitrarily without aligning to anything else
- Fixed it: snapped the floating element to the alignment edge or deliberately aligned it to an adjacent element

After the fix, does the layout feel more organized? Note what changed.

**Step 5 — Apply the margins test** (5 minutes)

Look at the horizontal and vertical margins of your content area. Are they at least 24px on each side?

- Horizontal margins are at least `lg` (24px) — preferably `xl` (32px)
- Vertical margins at the top and bottom of scrollable content are at least `lg` (24px)
- If margins were previously smaller, increased them and noticed the difference in feeling

Write down the single most impactful spacing change you made in this lab. Was it the scale rationalization, the proximity fix, the alignment fix, or the margin change?

## 5. Key Takeaways

- **Proximity encodes relationships without words.** Items that are close together are perceived as related — this is a pre-conscious perceptual reflex, not a preference. The gap between groups must always be larger than the gap within groups. When this rule is violated, grouping dissolves.

- **Spacing scales must be non-linear.** Adjacent spacing values must differ by at least 25% to be perceptibly distinct. A concrete scale — 4, 8, 12, 16, 24, 32, 48, 64px — provides enough range to communicate grouping, section separation, and major layout structure without looking random. Arbitrary spacing values create random-feeling layouts even when each individual choice seems reasonable. (practitioner consensus — refactoring-ui)

- **White space is functional, not wasted.** Generous spacing increases comprehension and satisfaction by making information structure legible at glance speed. The correct method is to start with too much space and reduce — not to start cramped and try to add space back. (practitioner consensus; widely referenced in UX literature)

- **Gestalt grouping has a hierarchy.** Enclosure (card containers, background fills) is the strongest grouping signal. Connection (visible lines) comes next. Proximity follows. Similarity (shared color or icon style) is the weakest — and only works when similar items are also spatially adjacent. Design with the appropriate signal strength for the grouping importance.

- **Alignment creates order through invisible edges.** Every element should share a visual edge with at least one other element. Left-alignment is almost always stronger than centering as a default. Consistent alignment produces an invisible grid that makes layouts feel organized even before users consciously register it. (practitioner consensus — non-designers-design-book, designing-interfaces)

# Chapter 07: Typography — Making Text Work at Every Size

The question for this chapter is: What font do I use? How do I size it? How do I make text feel easy to read?

## 1. What This Is

Open Things 3 on your Mac. Notice the task names — the font is clean, confident, and completely invisible. You are not aware of it as a font choice. You are just reading. Now open a poorly designed app — maybe a free utility that hasn't been updated in years — and notice the font there. Perhaps it is an oversized serif title, then a slightly different weight of that same typeface for the body, then a third variant that is only marginally smaller than the title. Nothing feels wrong exactly, but something is off. The text doesn't guide your eye anywhere. Every size and weight is competing with every other size and weight, and the result is visual noise.

That feeling — "something is off but I can't name it" — is almost always typography. Specifically, it is a lack of typographic hierarchy. And the good news is that typography hierarchy can be built from three tools that you already understand intuitively: size, weight, and color. The challenge is learning to use them deliberately rather than arbitrarily.

This chapter answers the four questions that trip up every non-designer approaching typography: which font to use, how to build a type hierarchy, how wide your text should be, and whether you should default to light or dark mode. Each question has a practical answer. Some of those answers are backed by research; some are practitioner consensus. You will know which is which.

## 2. What The Research Shows

### Font Choice: Sans-Serif Wins, Italic Loses

Here is a finding worth stating directly: your font choice has a measurable effect on how fast and how comfortably people read your text. This is not a stylistic opinion — it is a result you can measure with an eye-tracker.

Rello and Baeza-Yates ran a controlled experiment where 97 participants read short passages in each of 12 fonts on screen, while their eye movements were tracked. The fonts included Arial, Helvetica, Verdana, Courier, Garamond, Times, and several others. The researchers measured reading time, fixation duration (how long the eye pauses on each word before moving on), and subjective preference. Two findings that matter for you:

First, **sans-serif fonts produced significantly shorter fixation durations** than serif fonts — for both dyslexic and non-dyslexic readers. Shorter fixation durations mean less processing effort per word. The eye identifies the letter forms faster. Sans-serif fonts do not have the small decorative strokes (the serifs) at the ends of letterforms, which appears to make individual characters easier to discriminate on screen at typical reading sizes. The difference was significant for fixation duration (p = 0.015 for dyslexic readers, p = 0.007 for non-dyslexic readers), though not for overall reading time — the effect is real but specific to how hard the eye works, not how long the passage takes in total. supported with limitations.

Second, and more dramatic: **italic fonts increased reading time by approximately 16% for non-dyslexic readers** compared to roman (non-italic) counterparts (17.40s vs. 20.11s, p = 0.001). For dyslexic readers, italic also produced significantly longer fixation durations. Italic letterforms mimic cursive handwriting, which requires more effort to decode than the upright letterforms your eye is trained on. The practical conclusion is stark: do not use italic for any UI text that needs to be read quickly. Save it for quotations or occasional emphasis in documentation, if at all.

Pause and predict: Looking at your last project, count how many places you used italic. How many of those uses could be replaced with a weight change (bold or semibold) instead, getting the same emphasis without the 16% reading time cost?

The top-performing fonts in the Rello study — combining readability and preference for both populations — were Helvetica, Arial, Verdana, and Courier. If those names feel familiar, they should: they are the fonts Apple drew on when designing SF Pro (San Francisco), its system font. Apple's choice of a humanist sans-serif for its platform is consistent with what the readability research actually shows.

One counterintuitive finding from Rello worth noting: **OpenDyslexic, the purpose-designed typeface for dyslexic readers, showed no objective advantage** over standard sans-serif fonts on reading time or fixation duration — and was significantly disliked by both dyslexic and non-dyslexic participants. Purpose-built "accessibility" fonts are not always better than well-designed standards. The most readable fonts are the ones people have been trained on. supported with limitations.

### The Right Fonts for Your Platform

For macOS and iOS apps, the font decision is straightforward: use SF Pro and let the platform do the work.

SF Pro is Apple's system typeface — a humanist sans-serif with multiple weights and sizes tuned specifically for Apple displays. Using it costs you nothing (it is built into every Apple device), automatically matches the system aesthetic, and produces the legibility behavior the research supports. In SwiftUI, you access it through semantic type styles: `.font(.largeTitle)`, `.font(.title)`, `.font(.headline)`, `.font(.body)`, `.font(.subheadline)`, `.font(.caption)`. These semantic names are not just convenience labels — they automatically respond to the user's Dynamic Type size setting, which means your text gets larger or smaller for users who have configured accessibility text sizes, without any additional work on your part.

The most important rule here is one that beginners frequently break: **specify type using semantic styles, not raw pixel sizes**. Writing `.font(.system(size: 17))` bypasses Dynamic Type. Writing `.font(.body)` respects it. Raycast, Things, and every polished Apple app uses semantic type styles. Hardcoded sizes break accessibility and signal that the developer did not read Apple's guidelines.

For Raycast extensions specifically: Raycast has its own component library with a built-in type system. You do not choose fonts in a Raycast extension — the framework applies them. Attempting to override Raycast's typography will create visual inconsistency with the rest of the Raycast interface and will likely be overridden by the chrome anyway. Accept the system and focus your energy elsewhere.

For cross-platform contexts (if you are ever building a web-based tool): use the system font stack: `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`. This renders SF Pro on macOS and iOS, Segoe UI on Windows, and sensible fallbacks elsewhere.

### Building a Type Hierarchy with Three Levers

The single most powerful insight from refactoring-ui on typography is this: **visual hierarchy is controlled by three levers — size, weight, and color — and you should never crank all three to maximum simultaneously**.

Think about a page where the title is large, bold, and dark. The subheadings are medium, medium-weight, and dark. The body text is small, regular-weight, and dark. The secondary labels are small, regular-weight, and lighter. This works because each level of the hierarchy uses a different combination of the three levers. You are layering differences, not stacking identities.

The failure mode is what Robin Williams in non-designers-design-book calls the Wimp Problem: using differences so slight they register as mistakes rather than decisions. A title at 18pt and body text at 16pt — that 2pt difference is almost invisible. It reads as a layout error, not a hierarchy. The cure is commitment: if elements are not the same, make them dramatically different. A title should be large enough that you could not mistake it for body text. practitioner consensus (refactoring-ui, non-designers-design-book).

Here is how to build a practical three-level type hierarchy for a Mac or iOS app:

Your **primary level** — titles, screen headings, list item names — should be the largest and heaviest element. Use `.title` or `.headline` in SwiftUI. The weight should be semibold (600) or bold (700). The color should be your primary text color — the darkest one in your palette.

Your **secondary level** — descriptions, metadata, secondary labels — should be meaningfully smaller and lighter. Use `.subheadline` or `.callout`. The weight should be regular (400) or medium (500). The color can be your secondary text color — a noticeably lighter shade than primary, but still clearly readable.

Your **tertiary level** — timestamps, counts, category labels, fine print — should be clearly smaller still. Use `.caption` or `.footnote`. The weight stays regular. The color becomes your tertiary text color — visibly de-emphasized but not invisible.

The result is a three-tier system where each level is immediately distinguishable from the others because you have used at least two of the three levers differently at each step. This is how Things 3 handles its task list: task names are large and dark, notes are smaller and lighter, metadata (dates, tags) is smaller still and noticeably muted. You instantly know what is primary and what is supporting.

🔗 **Connect:** The type hierarchy system described here is an application of the visual hierarchy principles from Chapter 05. If you built a hierarchy map in that chapter's practice lab, your type choices should match the hierarchy you identified — primary text size and weight should align with the visual importance you assigned to each element.

### Line Length: Research vs. Comfort

Here is a finding that sounds like a simple rule but requires some nuance to apply correctly.

Shaikh and Chaparro measured reading speed across four line lengths in an online text experiment: 35, 55, 75, and 95 characters per line. The result: **95 characters per line produced the fastest raw reading speed at 178.82 words per minute**, compared to roughly 167-169 wpm for the shorter lengths — a 6% speed advantage (eta² = 0.15, p = 0.02). early-stage.

Before you conclude that you should make all your text 95 characters wide: the same study found that line length had **no significant effect on comprehension** at any width tested. And when participants were asked for their preferences, the result was striking — 55% of participants named 95 cpl as their least favorite format. Users read fastest at wide line lengths but found them uncomfortable.

The conflict resolution for this guidebook (C05) synthesizes this honestly: the 50-75 cpl recommendation that appears in most UX guides is not a hard research finding — it is a practical consensus range. For most of your app's UI text, line length is not a constraint at all. Button labels, navigation items, form field labels, notifications — these are naturally short, well under any of the tested lengths. You do not need to think about line length for these.

Where line length actually matters is **extended reading contexts**: onboarding copy, help documentation panels, settings descriptions, or any view where users read paragraphs of text. For those surfaces, target **55-70 characters per line**. This is below Shaikh's speed optimum but sits in the comfortable middle where comprehension is equal, return sweeps (the eye movement back to the start of the next line) are manageable, and users are not reporting discomfort.

A practical way to implement this: refactoring-ui recommends using `20-35em` width for paragraph text. This scales with the font size, so if your body text is 17pt, your text column will be roughly 340-595px — landing conveniently in the comfort zone. In SwiftUI, constraining the width of a `Text` view with `.frame(maxWidth: 560)` on a reading view is a reasonable implementation.

🎯 **Apply:** Pick any app you are currently building or have recently built. Find the longest paragraph of text in it — an onboarding screen, a description, a help view. Count the characters on the longest line. Is it in the 55-70 range? If it is wider, try adding a `maxWidth` constraint and see how the text rewraps.

### Light Mode vs. Dark Mode: What the Research Actually Shows

Two studies by Piepenbrock and colleagues provide the clearest experimental evidence on this question, and their findings are unambiguous on their face: **positive polarity (dark text on light background) is better for reading**.

In Piepenbrock et al., 169 adults in two age groups performed visual acuity tasks and proofreading under positive and negative polarity conditions. Positive polarity produced significantly better visual acuity for younger adults (d=2.17) and older adults (d=0.58). Proofreading accuracy was also better with positive polarity for both groups (F(1,165)=9.92, p\<0.01, eta²=0.06), without any cost to reading speed. supported with limitations.

The 2014 Piepenbrock et al. study added a key mechanistic finding: positive polarity causes the pupil to constrict (mean pupil diameter 2.09mm in positive vs. 3.65mm in negative polarity, dz=2.96). A smaller pupil produces a sharper retinal image by reducing spherical aberrations — the same reason squinting helps you see more clearly. This pupil constriction predicted better proofreading accuracy (b = -0.24, p \< 0.01) and reading rate (dz=0.68). early-stage.

So the research favors light mode. But here is the part that prevents you from treating this as a simple rule.

The d=2.17 effect size for younger adults looks enormous — and it is, under the specific conditions of that study: extreme black-on-white (white background at 350 cd/m², black background at 1 cd/m²) in a darkened lab room. Real apps do not look like this. Light mode in a normal office environment is not as extreme as the experimental condition. The proofreading effect (eta²=0.06) is more modest and probably more ecologically relevant. The practical polarity advantage for a well-designed dark mode versus a well-designed light mode in normal use is real but much smaller than d=2.17 implies.

More critically: the research does not tell you how users feel about their choice. Many people prefer dark mode — especially in low-light environments, for extended use at night, and in developer-adjacent tools. Raycast defaults to dark because its users expect and prefer it. Forcing those users into a light mode would be perceived as worse, even if their objective reading accuracy were marginally better.

**The practical resolution (C04) is straightforward and should be your default approach: use Apple's semantic color system.**

When you build with semantic colors — `.label`, `.secondaryLabel`, `.tertiaryLabel`, `.background`, `.secondarySystemBackground` in UIKit/SwiftUI — your app automatically adapts to whatever mode the user has set in System Preferences. You do not choose light or dark mode. The user chooses, and your app respects that choice. This is the approach every polished Apple app takes.

If you are building a text-heavy view — a reading mode, documentation, long-form content — you can optionally default it to light mode even within an otherwise dark app, since the evidence-based advantage for reading accuracy is more pronounced in extended reading contexts. For dense UI with small text (settings panels, data tables, footnotes), the polarity research is particularly relevant: avoid very small text in dark-only environments where you cannot give users an alternative.

supported with limitations.

🔗 **Connect:** If you have built anything with hardcoded color values like `Color.black` or `Color.white`, those values will not adapt to dark mode and will look wrong in whichever mode the user has not chosen. This connects directly to Chapter 08's discussion of Apple's semantic color system — those two chapters are a pair.

### The Shade Scale Principle

One more typographic principle that bleeds into the territory of color (covered fully in Chapter 08) but matters for typography specifically: **define a fixed set of text color shades and use only those**.

refactoring-ui recommends 5-10 pre-defined shades per hue. For text specifically, you need at minimum three: a primary text color (dark, high contrast), a secondary text color (noticeably lighter), and a tertiary text color (clearly de-emphasized). These should be defined once and used consistently throughout your app. Never generate text colors on the fly by applying opacity or programmatic lightening to another color — the results are unpredictable across backgrounds and look amateurish.

On Apple platforms, the semantic color system does this work for you: `.label` is your primary text color, `.secondaryLabel` is your secondary, `.tertiaryLabel` is your tertiary. They adapt to both light and dark mode. Use them.

## 3. How To Use This

### Where Typography Fits When You Are Staring at a Blank Screen

Typography is a finishing-layer decision, not a starting-layer decision. Before you think about fonts and sizes, the screen's structure, information hierarchy, and content priority should already be established. Typography is how you express that hierarchy in text, not how you discover it.

That said, you should define your type system before you start placing content — not after. Define your three text levels (primary, secondary, tertiary) and assign SwiftUI semantic styles to each level. Then apply those consistently everywhere. Do not make font choices element by element.

### Quick-Start Protocol

1.  For macOS and iOS: use SF Pro via SwiftUI's semantic type styles. Start with `.headline` for primary labels, `.body` for body text, `.subheadline` for secondary information, and `.caption` for tertiary metadata. Do not use hardcoded sizes.

2.  Define three text colors using Apple's semantic colors: `.label` (primary), `.secondaryLabel` (secondary), `.tertiaryLabel` (tertiary). Apply these consistently across all text in your app.

3.  Build a three-level type hierarchy using the three levers: size and weight distinguish your primary text from secondary text; color distinguishes secondary from tertiary. Use at least two levers at each transition — if you only change color from level 1 to level 2, the difference is too subtle.

4.  For any text-heavy view (descriptions, onboarding copy, help text), constrain the text column width to roughly 55-70 characters per line using a `maxWidth` constraint. For most UI text (labels, navigation, buttons), do not constrain — it is already naturally short.

5.  Eliminate italic from UI text. Replace any italic emphasis with a weight change (semibold instead of italic) or a color change. Reserve italic exclusively for quotations or technical terms in documentation, if at all.

### Decision Tree

**Is this text inside a Raycast extension?** Yes: do not override any typography. Raycast's component library handles it. No: continue below.

**Is this a native macOS or iOS app?** Yes: use SwiftUI semantic type styles. Do not hardcode point sizes.

**Does the user need to read more than two or three lines continuously?** Yes: constrain column width to 55-70 characters per line. No: do not worry about line length.

**Do you want to emphasize a piece of text differently from its surroundings?** Change at least two of the three levers (size, weight, color). Changing only one lever risks the Wimp Problem — a difference too slight to read as intentional.

**Are you using italic for emphasis somewhere?** Replace it with semibold or a color shift. Italic increases reading time by 16% with no compensating benefit in UI contexts.

**Does the text need to work in both light and dark mode?** Yes (almost always): use semantic colors. No hardcoded black, white, or grey values.

### Design Checklist

**Avoid:**

- Hardcoded font sizes that bypass Dynamic Type (`.system(size: 17)` instead of `.body`)
- Italic for body text, labels, descriptions, or navigation items
- Serif fonts for UI labels, buttons, and navigation (appropriate for body copy in reading contexts, but not for UI chrome)
- Generating text colors on the fly via opacity or programmatic lightening
- Using only one lever (e.g., only color) to distinguish hierarchy levels
- Tiny text in dark-mode-only contexts where acuity matters most

**Do:**

- Define your full type system — three text levels with semantic sizes and colors — before laying out any screen
- Let Dynamic Type handle accessibility scaling automatically via semantic styles
- Use font weight to carry emphasis rather than italic
- Check your text hierarchy at small sizes, not just at design scale — captions and labels often need more contrast than they look like they need at full zoom
- In reading-heavy views, verify the text column width with a character count (aim for 55-70 per line)

## 4. Practice Lab

This lab builds your type system for a real project — or a realistic mock project if you are starting fresh. Budget approximately 20-25 minutes.

**Setup:** Pick a screen from an app you are building or a screen you could realistically build. It should contain at least three distinct types of text — for example: a list view with an item title, a secondary description, and a timestamp. Or a settings screen with a section heading, setting labels, and current-value text. Or an onboarding screen with a title, body copy, and a caption.

**Step 1: Inventory your text** Write down each distinct text element in your screen and assign it a hierarchy level: primary (most important, needs immediate attention), secondary (supporting detail), or tertiary (metadata, fine print, timestamps). If you have more than three levels, consolidate — most screens only need three.

- Primary text elements identified: \_\_\_
- Secondary text elements identified: \_\_\_
- Tertiary text elements identified: \_\_\_

**Step 2: Apply semantic type styles** For each element, assign a SwiftUI semantic type style. Use this mapping as a starting point, then adjust if needed:

- Primary: `.headline` (semibold, 17pt base) or `.title2` (22pt) if it is a screen title
- Secondary: `.subheadline` (15pt, regular) or `.callout` (16pt)
- Tertiary: `.caption` (12pt) or `.footnote` (13pt)
- Confirm that no element uses `.system(size:)` — only semantic names

**Step 3: Apply semantic text colors**

- Primary text uses `.label`
- Secondary text uses `.secondaryLabel`
- Tertiary text uses `.tertiaryLabel`
- No text uses hardcoded `Color.black`, `Color.white`, or `Color.gray(...)` values

**Step 4: Check your hierarchy** Squint at the screen (literally — defocus your eyes slightly). In this blurred view, can you still tell which elements are primary, which are secondary, which are tertiary? Squinting removes detail and leaves only size, weight, and color contrast.

- The hierarchy is legible when squinting
- The primary elements are clearly dominant — not just slightly larger than secondary
- No italic text appears anywhere in UI labels or descriptions

**Step 5: Check reading contexts** If your screen contains any block of text longer than 2-3 lines (onboarding copy, descriptions, help text):

- Measure or estimate the character count at the longest line
- If it is wider than 70 characters, add a `maxWidth` constraint and verify it rewraps to roughly 55-70 cpl
- If your app is dark-mode-only, verify that small text (`.caption`, `.footnote`) still has at least 4.5:1 contrast ratio against its background

**Rubric:** Your type system is working if: the hierarchy is immediately clear when squinting; you can name which SwiftUI semantic style you used for each element; all text colors are semantic and will adapt to light and dark mode; and no italic appears in UI labels or navigation.

## 5. Key Takeaways

- **Sans-serif fonts reduce fixation duration for all readers** — the research-backed reason Apple chose SF Pro, and the research-backed reason you should use it. Avoid serif fonts for UI text. supported with limitations.

- **Italic increases reading time by approximately 16%** with no benefit in UI contexts. Use font weight changes for emphasis instead. supported with limitations.

- **Build a three-level type hierarchy using size, weight, and color as levers.** Change at least two levers at each hierarchy transition to avoid the Wimp Problem (differences too subtle to read as intentional). Practitioner consensus (Refactoring UI, Non-Designer's Design Book).

- **Line length at 95 cpl produces the fastest raw reading speed (+6%), but most users find it uncomfortable.** For extended reading views, target 55-70 cpl as a practical comfort zone. For short UI text, line length is irrelevant. early-stage for exact numbers; supported with limitations for the general principle.

- **Light mode is marginally better for reading accuracy** (positive polarity acuity advantage d=2.17 for younger adults, though under extreme lab conditions). **The practical answer is semantic colors** — let the user choose, and let Apple's color system handle both modes automatically. supported with limitations for the acuity advantage; practitioner consensus for the semantic color implementation.

# Chapter 08: Color — Using It Without Getting Lost

The question for this chapter is: How do I use color intentionally without making a mess?

## 1. What This Is

Color is the most emotionally loaded design decision you will make, and also one of the most misused. When beginners add color to an interface, they often either add too much — bright hues scattered wherever something seems to need emphasis — or too little: everything grey, with a timid hint of their brand color applied to the main button. Both extremes produce the same failure: an interface where color is not doing any work.

Here is what color is actually for. In a well-designed app, every color has a role. Grey backgrounds separate surfaces. Slightly lighter grey panels distinguish content areas from containers. Your brand's blue marks everything interactive — buttons, links, toggles, selected states. Red signals destruction or danger. Green signals success. Orange signals warning. These are not arbitrary stylistic choices. They are a communication system.

The difference between an app that uses color well and one that does not is exactly this: in the good app, color encodes meaning. In the bad app, color encodes nothing — or worse, it encodes arbitrary aesthetic choices that actively mislead the user. Notice how Raycast uses its single accent color (a bright teal-green) sparingly: it appears on the selected item in a list, on interactive icons in active states, and on progress indicators. Nowhere else. When you see that color, you know something is selected or interactive. When you do not see it, you know you are looking at passive content. The color has a single, consistent meaning, and that consistency is what makes it useful.

This chapter teaches you how to build that kind of system.

## 2. What The Research Shows

### Color as Meaning, Not Decoration

The strongest experimental evidence for color's practical value in UI comes from a context you might not expect: form design. Bargas-Avila et al. synthesized multiple controlled studies comparing different methods of marking required fields in web forms. The comparison was between asterisk-only marking (the most common approach) and color-coding (coloring required fields or their labels distinctly). Result: **color-coding required fields produced faster form completion, fewer errors, and higher user satisfaction** than asterisk-only marking. supported with limitations (multiple studies; no Cohen's d reported, but directional findings are consistent).

What this finding illustrates is the core principle of color in interfaces: **color that encodes a meaningful category is functional, not decorative.** Required vs. optional is a meaningful distinction. Marking it with color lets users process that distinction pre-attentively — before they consciously read the label. The information is decoded in less than 150 milliseconds, before deliberate thought. Marking it with an asterisk requires readers to find the asterisk, read it, and remember what it means. These are cognitively different operations.

The same logic applies everywhere color is used intentionally. Destructive actions in red. Success states in green. Warning states in amber. When color encodes a consistent semantic role, it acts as a silent second layer of information on top of your text and icons. When it does not encode a consistent role — when you use red sometimes for danger and sometimes because you liked the look of it there — you are generating noise instead of signal.

🔗 **Connect:** Think about Raycast's use of color. Its accent color appears on selected items and interactive indicators — and nowhere else. Now think about an app where the same blue appears on headings, decorative borders, and buttons. In which app does color carry meaning? In which is it noise?

### Color Is the Weakest Grouping Signal

Here is a finding that runs against intuition: **color is the weakest of the major grouping signals** available to you, and it only provides any grouping benefit when combined with spatial proximity.

As we explored in 05-visual-hierarchy, Peterson and Berryhill found that color similarity only improves working memory grouping when similar items are also spatially adjacent. When matching-color items appeared next to each other, accuracy improved dramatically — at set size 6, 90% for grouped items versus 63% for ungrouped, a 27-percentage-point gap. But when matching-color items were separated by even one intervening item, **the grouping benefit disappeared entirely**.

This matters for how you use color in UI layout. Giving all items in a category the same color accent means nothing if those items are scattered across the screen. The color grouping only functions when the items are spatially close. Color + proximity must co-occur. early-stage.

The gestalt hierarchy established across cognitive psychology research reinforces this point. Enclosure (a border or background region) is the strongest grouping signal. Connection (a visible line between items) is second. Proximity is third. Color similarity is fourth — weaker than all three. When you are choosing how to communicate grouping, color should be the last tool you reach for, not the first. Spacing, cards, and containers will do more work than color alone.

### Contrast Is Functional, Not Aesthetic

The Piepenbrock studies covered in Chapter 07 are equally relevant here, because the light-versus-dark-mode research is fundamentally about contrast ratio. The mechanism behind the positive polarity advantage (dark text on light background) is that bright backgrounds cause pupil constriction, which sharpens the retinal image. The pupil diameter difference — 2.09mm in positive polarity versus 3.65mm in negative polarity — is a physical consequence of luminance difference. High contrast between text and background is not a stylistic preference. It is a functional requirement for legibility. supported with limitations for the acuity advantage; Piepenbrock-2013-PositiveDisplayPolarity_10-1080-00140139-2013-790485, Piepenbrock-2014-PolaritySmallCharacterSizes_10-1177-0018720813515509.

The Web Content Accessibility Guidelines (WCAG) formalize this as minimum contrast ratios: 4.5:1 for normal text (below 18pt), 3:1 for large text. These are not arbitrary. They reflect the luminance levels at which text becomes legible for users with reduced contrast sensitivity, which includes a large fraction of older adults even without diagnosed vision impairment.

On dark mode surfaces, the contrast requirement does not go away — it just reverses direction. Light text on a dark background must meet the same 4.5:1 ratio. A common failure in dark mode designs is using mid-grey text (say, \#888888) on a dark background (#1C1C1E). This might look fine to a young designer on a high-brightness display but fails contrast checks and is illegible for many users. In practice: if you are using Apple's semantic colors, the system handles contrast correctly in both modes. If you are defining custom colors, test them with a contrast checker.

Designing Interfaces notes that approximately **10% of men have some form of color blindness, and about 1% of women** (designing-interfaces). This is a large enough proportion that you cannot treat accessibility as an edge case. The practical implication: never use color as the only signal for anything important. If a required field is marked only in red, a user with protanopia (red-green color blindness, the most common form) may not perceive it. The solution is always to pair color with at least one other signal: shape, icon, text label, or position. Red + an exclamation icon + an error message below the field. Green + a checkmark + "Success" text. Color reinforces; it does not carry the full semantic load alone.

Pause and predict: Open an app you are currently building. Without reading any labels, can you tell which elements are interactive, which are decorative, and which are status indicators — using only color as your guide? If color cannot answer this question in five seconds, it is not yet a system.

### The Timidity Problem

non-designers-design-book makes a point about color that is easy to overlook: **half-hearted color choices register as errors, not decisions.** If your brand color appears in a desaturated, barely-there form, the user's eye interprets it as a mistake — a rendering artifact, a compression artifact, an accidental grey. It does not register as a color choice. Color that is barely present is worse than no color, because it introduces noise without adding information.

The solution is to commit. If you are going to use a brand color as an accent, use it at full saturation in the contexts where it belongs. If you are going to de-emphasize a color (as a background tint, for example), de-emphasize it intentionally and dramatically — 10% opacity on a button background, not 70% opacity that is almost-but-not-quite the full accent. The distinction between "accent" and "tinted background" should be immediately clear from the color treatment, not ambiguous.

The same principle applies to your grey scale. An almost-white background next to a slightly-less-almost-white panel does not communicate surface hierarchy — it looks like an inconsistency. The distinction between your background grey, your panel grey, and your element grey needs to be perceptible enough to read as intentional. practitioner consensus (non-designers-design-book, refactoring-ui).

🔗 **Connect:** This connects directly to the Wimp Problem introduced in Chapter 05 and revisited in Chapter 07 on typography. The underlying principle is the same: if elements are not the same, make them dramatically different. Applied to color, this means: if two surfaces are different background colors, the difference should be perceptible at a glance, not only detectable on close inspection.

### Building a Color System: Three Categories, Five to Ten Shades

refactoring-ui provides the clearest practitioner framework for how to build a minimal color system. The architecture has three categories, each with 5-10 pre-defined shades:

**Greys (8-10 shades):** The vast majority of any UI is grey. Text, backgrounds, panels, borders, dividers, disabled states — all of these live in your grey scale. Start with a near-black (not pure black — pure black feels harsh against off-white backgrounds) at the dark end, and work through to a near-white at the light end. Eight shades, numbered 100 to 900, covers the range. Your shades at 800-900 are text colors. Your shades at 500-700 are border and disabled colors. Your shades at 100-300 are background and panel colors.

**Primary (5-10 shades):** Your brand color. This is the color that appears on your primary action buttons, selected states, active navigation indicators, links, and focus rings. You need a range of shades because your brand color appears in multiple contexts: a dark shade for text that needs to be in the brand color; a mid-tone shade for button backgrounds; a light shade for tinted alert backgrounds. The mid-point shade (around 500 in a 100-900 scale) is your base — it should look good as a button background.

**Accents (5-10 shades each):** Semantic status colors. Red for destructive actions and errors. Green for success and confirmation. Orange or amber for warnings and caution. Optionally, additional hues for categorical differentiation in data visualization (graph lines, tags, calendar categories). Each accent color gets its own 5-10 shade range so you can use it in both text and background contexts.

The critical discipline: **never generate shades on the fly**. Do not use `Color(red: 0, green: 0, blue: 1).opacity(0.3)` or CSS `lighten(#0066ff, 30%)` in the moment. These on-the-fly calculations produce colors that do not belong to your system, may have unexpected contrast behavior against your other colors, and look slightly off in ways that are hard to diagnose. Pre-define all your shades. Then choose from the system. practitioner consensus (refactoring-ui).

### Why HSL Makes This Easier

refactoring-ui recommends working in HSL (hue, saturation, lightness) rather than hex or RGB when building your color system. This is not a philosophical preference — it is practical. HSL maps to how you actually think about color:

- Hue (0-360°): which color on the wheel — red at 0°, green at 120°, blue at 240°
- Saturation (0-100%): how vivid vs. grey — 0% is fully grey, 100% is fully vivid
- Lightness (0-100%): how dark vs. light — 0% is black, 100% is white, 50% is the pure hue

Building a grey scale is straightforward in HSL: fix the hue (pick a slight blue or warm orange tint to avoid looking washed out), fix the saturation at a low value, and vary the lightness from 10% to 95%. Building shade variations of your primary color means keeping the hue fixed, slightly adjusting saturation as lightness moves away from 50% (colors look less vivid at extremes), and varying lightness. Each operation is one understandable knob, not three entangled ones.

In SwiftUI, you can define colors using HSL:

``` swift
Color(hue: 0.6, saturation: 0.8, brightness: 0.9)
```

Note that SwiftUI uses HSB (hue, saturation, brightness/value), which differs from HSL at non-100% saturation. For precise HSL → HSB conversion, tools like Coolors or Huemint will do the calculation. The important point is to work perceptually, not numerically.

## 3. How To Use This

### Where Color Fits in Your Design Process

Color is one of the last decisions to make, not one of the first. The sequence is: structure and information architecture first (Chapters 02-04), then visual hierarchy and layout (Chapters 05-06), then typography (Chapter 07), then color. Raycast's development team built in grayscale before applying color — this is the correct order.

The reason to defer color is that color applied before hierarchy is established tends to mask hierarchy problems. Your primary button appears prominent because it is blue, not because it is sized and positioned correctly. Remove the blue and you discover the hierarchy was not working. Build the structure in grey first, get the hierarchy working, then add color as a layer that reinforces what you have already established.

### Quick-Start Protocol

1.  **Define your grey scale first.** You need at minimum five shades: a near-black for primary text, a mid-dark grey for secondary text, a mid-grey for borders and dividers, a light grey for panel/card backgrounds, and a near-white for the page background. Use Apple's semantic colors — `.label`, `.secondaryLabel`, `.tertiaryLabel`, `.separator`, `.secondarySystemBackground`, `.systemBackground` — and you get this scale for free, already adapted to dark mode.

2.  **Pick one primary/brand color and define 5-9 shades of it.** Choose the mid-point shade that works as a button background. Work outward: a dark shade for brand-colored text, a light shade for tinted backgrounds (alert banners, selected row backgrounds). Test adjacent shades in context — the background tint and the button color should not be confused for each other.

3.  **Define your three semantic accent colors: red, green, and amber.** These are for status — errors, success, warnings. Use Apple's semantic system colors (`.systemRed`, `.systemGreen`, `.systemOrange`) as your foundation. These have built-in dark mode adaptations and meet contrast requirements.

4.  **Assign each color a role and use it only in that role.** Interactive elements: primary color. Destructive actions: red. Success: green. Warning: amber. Background hierarchy: grey scale. No cross-assignment. If you use red for both danger and decorative highlighting, you have broken the semantic meaning.

5.  **Test contrast.** Verify that your primary text on your background meets 4.5:1 ratio. Verify your colored text on tinted backgrounds (e.g., red text on a light red background for error states) also meets the ratio. Free tools: WebAIM Contrast Checker, the Accessibility Inspector in Xcode.

### Decision Tree

**Are you building a Raycast extension?** Yes: use Raycast's color tokens — `Color.red`, `Color.green`, `Color.orange`, `Color.blue` from the Raycast API. Do not bring custom brand colors that will fight the Raycast chrome. No: continue below.

**Are you building a native macOS or iOS app?** Yes: start with Apple's semantic system colors for all grey scale, text, and status colors. Custom brand color on top of that foundation.

**Do you have a strong brand color?** Yes: use it exclusively for interactive/primary-action elements. Do not apply it to headings, decorative elements, or status states (red/green/amber own those roles). No: Apple's `.tintColor` / accent color provides a reasonable default.

**Is color the only signal distinguishing a critical state** (required vs. optional, error vs. success, destructive vs. safe)? Yes: add at least one other signal — an icon, a text label, a shape change. Color alone will fail for 10% of male users with color vision deficiency.

**Are two surfaces supposed to look different but the difference is subtle?** Either make the difference more dramatic (two clearly distinct shades) or remove the distinction entirely and communicate it differently. Do not leave ambiguous near-misses — they register as rendering errors, not design decisions.

**Are you generating a shade on the fly** (using `.opacity()`, `lighten()`, or programmatic color math at render time)? Stop. Define the shade in your palette and reference it by name.

🎯 **Apply:** Open your current project and list every color value or semantic color reference in one screen. For each color, write its semantic role in one word (text, background, interactive, error, etc.). If any color appears in two different roles, or if any role is served by two different colors, you have found a system inconsistency to fix.

### Design Checklist

**Avoid:**

- Using color as the only signal for required fields, errors, or destructive actions (pair color with icon, text, or shape)
- Generating shades on the fly instead of choosing from a pre-defined palette
- Applying your brand color to headings, decorative elements, or text emphasis — reserve it for interactive elements and selected states
- Near-miss shade differences that look like rendering artifacts rather than deliberate design choices
- Using color to create grouping when the items are not also spatially proximate
- Hardcoded `Color.black`, `Color.white`, or specific hex values that will not adapt to dark mode

**Do:**

- Let Apple's semantic colors carry your grey scale, text hierarchy, and status colors automatically, with dark mode adaptation for free
- Apply brand/accent color exclusively to interactive elements so color carries consistent semantic meaning
- Define your full palette — all shades, all categories — before you start laying out any screen
- Pair color with a second signal (icon + color, label + color) for any distinction that carries functional meaning
- Check contrast ratios before shipping, especially in dark mode where mid-tone grey text on dark backgrounds often fails

## 4. Practice Lab

This lab builds your color system from scratch, or audits and repairs the color system in a project you are already working on. Budget approximately 25-30 minutes.

**Setup:** Have a screen open — either from a project you are building or a mockup you will create. The screen should contain: a primary background, at least one panel or card surface, text at multiple hierarchy levels, at least one interactive element (button, link, or toggle), and ideally one status indicator (error message, success confirmation, or warning).

**Step 1: Audit your current color usage**

Without changing anything, make a list of every color currently used in the screen. If you are in SwiftUI, look at the `.foregroundColor`, `.background`, and `.tint` modifiers.

- List every distinct color value or semantic color reference you find
- For each color, write down its current role (text, background, border, accent, status)
- Identify any cases where the same semantic role uses two different colors (e.g., two different greys for secondary text)
- Identify any cases where the same color carries two different semantic roles (e.g., a blue used both for headings and for interactive buttons)

**Step 2: Map your colors to semantic roles**

Using the role framework from this chapter:

- Background: the main surface color of the screen
- Surface: a panel, card, or sidebar background that sits on top of the main background
- Primary text: high-contrast text for the most important content
- Secondary text: clearly de-emphasized text for supporting information
- Tertiary text: noticeably muted text for timestamps, metadata, fine print
- Interactive: the single color that marks everything clickable or selectable
- Destructive: the color used for delete, remove, or danger actions
- Success: the color used for completed, confirmed, or positive states
- Warning: the color used for cautionary or needs-attention states

For each category above, write the color or semantic color reference you are using. If any category is empty (no color assigned), decide whether it needs one or whether another signal (icon, text) covers it. If any category has more than one color, consolidate.

- All nine roles identified or intentionally left empty
- No role has more than one color
- No color appears in more than one role

**Step 3: Switch to semantic colors**

For every color in your screen that is a hardcoded value, replace it with the Apple semantic equivalent:

- Page background: `.systemBackground`
- Panel/card background: `.secondarySystemBackground`
- Primary text: `.label`
- Secondary text: `.secondaryLabel`
- Tertiary text: `.tertiaryLabel`
- Borders and dividers: `.separator`
- Interactive (if using Apple blue): `.tint` or `.accentColor`
- Error/destructive: `.systemRed`
- Success: `.systemGreen`
- Warning: `.systemOrange`

After this step, toggle your preview between light and dark mode. Your colors should adapt automatically.

- Light mode preview looks correct
- Dark mode preview looks correct
- No color looks broken or inverted in either mode

**Step 4: Check contrast**

Using Xcode's Accessibility Inspector or an external contrast checker:

- Primary text on background: 4.5:1 or better
- Secondary text on background: 4.5:1 or better (this one often fails — if it does, use a darker shade)
- Any colored text (red error text, green success text) on a tinted background: 4.5:1 or better
- Interactive element text on its background (e.g., white text on blue button): 4.5:1 or better

**Step 5: Find the color-only signals**

- Identify every place in the screen where color carries a functional distinction (required vs. optional, error vs. valid, active vs. inactive)
- For each one, verify that at least one non-color signal also carries that distinction (icon, text label, shape, position)
- If any distinction is color-only, add the missing non-color signal

**Rubric:** Your color system is working if: toggling light/dark mode produces a sensible result with no broken colors; you can name the semantic role of every color in the screen; at least one non-color signal accompanies every functional color distinction; and contrast ratios pass 4.5:1 for all text.

## 5. Key Takeaways

- **Color encodes meaning most powerfully when each color has exactly one semantic role.** Interactive elements: brand/primary color. Errors: red. Success: green. Warnings: amber. Surfaces: grey scale. Mixing semantic roles destroys the communication system. Practitioner consensus (refactoring-ui, designing-interfaces).

- **Color is the weakest grouping signal — and it requires spatial proximity to function at all.** Giving scattered items the same color provides no perceptual grouping benefit. Color similarity only improves memory and recognition when similar items are adjacent. Use proximity, cards, and enclosure first; color as a secondary reinforcement. early-stage.

- **Never use color as the only signal for any functional distinction.** Approximately 10% of men have color vision deficiency. Always pair color with at least one other signal: icon, text label, or shape. strongly supported (designing-interfaces; population epidemiology).

- **Build a pre-defined color system: 8-10 grey shades, 5-9 primary shades, accent shades for each status color.** Never generate shades on the fly with opacity or programmatic lightening. Practitioner consensus (refactoring-ui).

- **Use Apple's semantic color system for all standard colors** — `.label`, `.systemBackground`, `.systemRed`, `.tint`, etc. This gives you automatic dark mode adaptation and contrast behavior that meets accessibility requirements. Adding custom colors on top is appropriate for brand accents; replacing the semantic system is not. Practitioner consensus; Apple Human Interface Guidelines.

# Chapter 09: Touch & Click Targets — Making Things Easy to Hit

The question for this chapter is: How big do my buttons need to be? Where should I put them?

## 1. What This Is

Think about the last time you tried to tap a tiny button on a phone — one of those three-dot menus crammed into the corner of a list row, or a small "X" to dismiss a tag — and you missed. Your finger landed half a millimeter off and nothing happened, or worse, you triggered something adjacent. You tried again. Maybe a third time. That brief moment of friction is invisible to you as a developer, but it is absolutely visible to your users, and it happens on every single session.

Here is the counterintuitive thing: the problem usually isn't that the button looks too small. It often looks perfectly normal. The problem is that the tappable area behind the button — the zone that actually registers a touch — is too small for a human finger. The visual element and the interactive element do not always match, and even when they do, a well-proportioned button on a design canvas can still be physically too small on a real screen in a real hand.

This chapter answers the question precisely. How big does a touch target need to be before errors become acceptable? Where on the screen should you put important controls? And does any of this apply to macOS, where users have a cursor instead of a finger?

The answers come from physics — the physics of the human motor system — and from one of the largest empirical studies of real-world touch behavior ever conducted. By the end of this chapter, you will have concrete numbers you can put directly into SwiftUI.

## 2. What The Research Shows

### Fitts's Law: The Physics of Pointing

In 1954, Paul Fitts published what became one of the most replicated findings in all of human-computer interaction. He had participants tap back and forth between two metal plates, varying how far apart the plates were and how wide they were. He measured movement time across dozens of conditions and found a remarkably clean result: movement time is a predictable, logarithmic function of the distance to a target divided by its width.

The formula — MT = a + b × log₂(2A/W), where A is amplitude (distance) and W is target width — tells you something important: **both** factors matter, and they are interchangeable up to a point. A target that is very far away can be just as hard to hit as a target that is very small. Making a target larger reduces movement time. Moving a target closer also reduces movement time. The relationship is logarithmic, meaning the returns diminish: doubling a target size from 8mm to 16mm helps far more than doubling it from 40mm to 80mm.

Three practical implications fall directly out of Fitts's Law for app design.

First, your primary action should be the largest tappable element on the screen. Not just the most visually prominent — actually the largest hit target. In Things 3, the new task button occupies a large, easy-to-hit area at the bottom of the list. It is large because it is used constantly.

Second, targets at screen edges have an enormous natural advantage — on macOS, not on iOS. On a desktop Mac with a cursor, the menu bar at the top of the screen and the Dock at the bottom are effectively infinitely wide in the vertical direction, because the cursor cannot overshoot a screen edge. This is why clicking a menu title is so fast: you just fling the cursor upward and you cannot miss. On iOS, this advantage disappears. The screen boundary does not help you aim a finger.

Third, the law explains why cramming controls into a tiny corner or stacking them too close together causes errors: you have reduced W (width of each target) while also reducing effective inter-target spacing. The result is a pointing task that takes more time and produces more errors. strongly supported — foundational; 70 years of replication across laboratory and field conditions.

Pause and predict: Before reading the numbers below, think about Raycast for a moment. Raycast is keyboard-first — you rarely tap anything. Does Fitts's Law even apply there? What does it imply about a list-item-based interface where selection happens via keyboard, not pointer?

### The Minimum Touch Target Number

Fitts's Law tells you the shape of the relationship but not the exact size floor. For that, we have an empirical study from Parhi, Karlson, and Bederson that set out to find exactly where error rates become unacceptable for one-handed thumb use on touchscreens.

They had 20 participants tap targets of varying sizes (3.8mm to 13.4mm) in a controlled lab study. They measured both discrete tapping (single-tap tasks, like pressing a button) and serial tapping (multi-tap tasks, like entering a numeric code). The results produced two specific thresholds.

For **discrete tapping** — a single button you tap once — the error rate was statistically indistinguishable between 9.6mm and 11.5mm targets. The 9.2mm size is the recommended minimum: the smallest size that achieves near-optimal accuracy without a substantial speed penalty. Below 7.7mm, errors begin climbing significantly. At 3.8mm, average error rate was approximately 25%. At 9.6mm, it was approximately 5%.

For **serial tapping** — entering multiple taps in sequence, like digits on a numeric keypad — the recommended minimum is 9.6mm. The reason for the slightly higher bar is that serial tasks accumulate errors: each individual tap is less careful, because the user's attention is split across a sequence rather than concentrated on a single target.

Speed continues to improve with targets larger than these minimums. Larger is always faster, even above the accuracy floor. So these numbers represent the minimum before errors become unacceptable — not the optimal size when screen real estate is not a constraint. strongly supported for the minimum threshold; study sample is narrow, but findings have been corroborated by subsequent research and adopted into platform guidelines.

**Apple's 44pt minimum is not arbitrary.** At standard iOS resolution, 44 points corresponds to approximately 9–10mm, deliberately calibrated to meet the Parhi threshold for discrete tapping. This is a deliberate translation of empirical research into a platform standard, which is why you should take it seriously rather than treating it as a guideline you can bend when space is tight.

### Where Real Users Actually Tap

Lab studies with controlled conditions give you clean numbers. Large-scale real-world data gives you something different: the messy truth about how actual fingers land on actual phones.

Henze, Rukzio, and Boll deployed a circle-tapping Android game to the public and collected 120 million touch events from over 91,000 players across 321 different device models. This is one of the largest touch behavior datasets ever analyzed, and it produced several findings that go well beyond simple size thresholds.

**Touch events skew systematically toward the lower-right.** Users do not tap at the visual center of a target. They tap below it and to the right. The convergence point — where touches naturally cluster — was consistently located approximately 25% of screen width from the right edge and 25% of screen height from the bottom edge. The mechanism is straightforward: the natural resting position of the right thumb when holding a phone one-handed is in the lower-right quadrant. The fat-finger problem compounds this — your finger blocks your view of the target, creating a consistent parallax-like offset.

The practical implication: if you are designing a custom tap target, the visual center of your design is not where users will tap. They will tap slightly below-and-right of center. For standard buttons this is handled by Apple's system controls, but if you are building custom interactive views in SwiftUI, you should account for this offset.

**Edge and corner targets fail dramatically more often.** Henze et al. divided the screen into a 10×10 grid and compared error rates between center zones and border zones for targets smaller than 12mm. Border targets showed approximately 31.68% error rate versus 17.59% for center targets — roughly 80% higher. The screen edge does not help accuracy for touch the way it helps cursor movement on macOS. It actively hurts it, because the finger's natural range of motion is restricted when reaching to screen corners, especially the top-left corner for right-handed users.

**Below 15mm, error rates climb steeply. Below 8mm, they exceed 40%.** This is the real-world data counterpart to Parhi's lab finding. In actual use, under time pressure with no accuracy instruction, the degradation starts earlier and is more severe than controlled lab conditions suggest. The 9-10mm minimum from platform guidelines is calibrated for best-case usage. Real-world conditions are not best case. strongly supported for the directional findings and magnitude of edge/center difference; study used 2011 Android hardware and game-context time pressure, which inflates absolute error rates compared to normal app use.

🔗 **Connect:** Think about an app you use daily on your iPhone. Where are the controls you hit most often? Are they in the lower half of the screen or the upper half? Now think about controls you've accidentally triggered or struggled to hit. Were any of them in corners or along the top edge? Fitts's Law and Henze's tap-bias data predict exactly this pattern.

### macOS: A Different World

Everything above applies to touch interfaces. On macOS — in a native window-based app — the target size rules are substantially different, because a cursor is orders of magnitude more precise than a finger.

The average adult fingertip makes contact with approximately 16–20mm of screen surface. A cursor points to a single pixel. The fat-finger occlusion problem does not exist. Fitts's Law still applies — closer is faster, larger is faster — but the error-tolerance is vastly higher. A 16pt button on macOS is essentially never missed by a cursor. What matters more on macOS is hover states: the visual feedback that tells the user "this element is interactive and your cursor is over it." Without a visible hover state change, users may not know a small element is clickable at all.

The Designing Interfaces guidebook puts it cleanly: minimum touch targets on iOS are 44×44pt; no equivalent minimum exists for macOS cursor interfaces, because the problem is affordance visibility, not hit-area size (designing-interfaces).

For Raycast extensions specifically, the target size question barely applies. Raycast is keyboard-first. List items are selected by pressing Enter or using arrow keys, not by tapping or clicking. The entire list item is effectively one large hit target if the user does use the mouse. The design constraint in Raycast is not target size — it is which item is focused and whether the keyboard workflow makes sense.

🎯 **Apply:** Before you write any SwiftUI for an iOS app, list every element that a user can tap. For each one, ask: is this 44pt minimum in both dimensions? Is it in the upper-left corner, where it will be hardest to reach comfortably? Would moving it to the lower portion of the screen make it more natural to use one-handed?

## 3. How To Use This

### Quick-Start Protocol

1.  **Audit every interactive element in your iOS app.** Make a list: every button, toggle, row, icon, and link that a user can tap. Do not assume SwiftUI's defaults are sufficient — system controls like `Button` and `NavigationLink` follow the 44pt minimum, but custom views do not unless you explicitly set them.

2.  **Apply `.frame(minWidth: 44, minHeight: 44)` to all custom tappable views.** For views where you want to expand the hit area without changing the visual appearance, use `.contentShape(Rectangle())` to make the full frame hittable regardless of how your content is sized.

    ``` swift
    // Correct: expands hit area without changing visual size
    Image(systemName: "ellipsis")
        .frame(width: 44, height: 44)
        .contentShape(Rectangle())
    ```

3.  **Place primary actions in the lower two-thirds of the screen.** The natural one-handed thumb zone covers the bottom portion of the screen comfortably. Top corners require stretching or a grip shift. Use the bottom of the screen for actions users will trigger frequently, and the top for navigation controls accessed less often.

4.  **Avoid placing interactive elements in extreme corners.** Henze's data is unambiguous: corner targets fail at roughly 80% higher rates than center targets. If a control must go in a corner, make it larger than the 44pt minimum — aim for 56pt or more — and consider whether it truly needs to live there.

5.  **For custom touch targets, shift the visual center slightly upward and leftward.** Users tap below-and-right of where they think they are tapping. If you are designing a custom control where precision matters (a drawing canvas, a map pin, a small circular button), you may want to compensate by shifting the active region slightly to account for this systematic bias.

### Decision Tree

**Is this an iOS app or a macOS app?**

- iOS app → Is every tappable element at least 44pt in both dimensions? If not, expand it. Is the primary action in the lower half of the screen? If not, consider moving it.
- macOS app → Does every interactive element have a visible hover state? If not, add one. Is the cursor target area clearly communicated through visual affordance?

**Is this a frequently tapped element or an occasionally tapped one?**

- Frequently tapped (main action, back button, row selection) → Use maximum comfortable size; 44pt minimum; prefer lower-screen placement
- Occasionally tapped (settings access, delete confirmation, secondary toggle) → 44pt minimum is sufficient; can be placed in upper regions

**Is this a serial-input interface (like a numeric keypad or a form)?**

- Serial input → Use 9.6mm / approximately 46-48pt minimum; keys smaller than this cause accumulated errors on sequences

**Is this a Raycast extension?**

- List items are always full-width hit targets → Target size is not your constraint; focus on keyboard flow and which action is primary

### Design Checklist

**Avoid:**

- Custom `Image` or `Text` views used as buttons without explicit frame sizing — they will be visually tappable but hit-area-tiny
- Placing your most frequently used action in the top-left corner of an iOS screen
- Stacking interactive elements too close together without 8pt minimum spacing between hit areas
- Relying on visual size alone to judge whether a button is large enough — measure in points

**Do:**

- Prefer system controls (`Button`, `Toggle`, `NavigationLink`) over custom views when possible — they handle the 44pt minimum automatically
- Use `.contentShape()` to expand hit areas on icon-only controls
- Test your app one-handed, holding the phone in your right hand — reach each interactive element without repositioning your grip; anything that requires repositioning should move down or get larger
- On macOS, invest in clear hover states for every interactive element, even ones that look clickable by convention

## 4. Practice Lab

This lab applies directly to a real screen in your app. Work through the checklist once per screen you are currently building or recently shipped.

**Setup:** Open your iOS project and navigate to a screen with multiple interactive elements. Have Simulator open or a physical device available for testing.

**Step 1 — Identify and document every tappable element (10 min)**

Go through the screen and list every element a user can tap or interact with. For each one, record:

- What is it? (button, row, toggle, icon, link)
- What is its declared frame size in points?
- Is it using a system control or a custom view?

Do not estimate — look at your actual SwiftUI code or use the Xcode view debugger to measure real sizes.

**Step 2 — Check minimum sizes (5 min)**

For each element from Step 1:

- Is the tap target at least 44×44pt?
- If the visual element is smaller (e.g., a 20×20 icon), is the hit area expanded using `.frame()` and `.contentShape()`?
- Are any two tap targets spaced less than 8pt apart edge-to-edge?

Fix any that fail. The code change is typically one line per element.

**Step 3 — Thumb-zone audit (5 min)**

Identify the three most-used actions on this screen. For each:

- Is it in the lower half of the screen?
- Is it reachable with a right-handed one-handed grip without shifting grip?
- Is it at least 8pt away from the screen edge?

Mark any that are in a top corner or along a narrow edge. Decide: can you move them, or is there a structural reason they must stay?

**Step 4 — One-handed physical test (5 min)**

Run your app on a physical device or Simulator. Hold the device in your right hand only. Try to complete the primary task flow with your right thumb only, without repositioning.

- Which elements required repositioning or two hands?
- Which elements did you tap accidentally?
- Which elements required multiple attempts?

Document your findings. Each miss is a candidate for enlargement or repositioning.

**Step 5 — macOS hover state audit (5 min, macOS apps only)**

If you are also working on a macOS app:

- Does every clickable element change appearance on hover?
- Are cursor-interactive elements visually distinct from non-interactive ones at a glance?
- Do custom controls show a cursor change (hand cursor for links, default for buttons)?

**Completion target:** Every tappable element on your screen at or above 44pt minimum, primary actions in reachable zones, at least one physical one-handed test completed.

## 5. Key Takeaways

- **Fitts's Law is the underlying physics of all pointing tasks:** larger targets and closer placement always reduce movement time and error rate, with logarithmically diminishing returns. strongly supported.

- **9.2mm is the empirical minimum for discrete touch targets; 9.6mm for serial (multi-tap) tasks.** Apple's 44pt guideline directly implements this threshold. strongly supported.

- **Real users tap below-and-right of visual center.** The convergence point clusters approximately 25% from the lower-right corner, reflecting natural thumb posture. Account for this in custom touch targets. strongly supported.

- **Edge and corner targets fail at roughly 80% higher rates than center targets.** This is not a minor adjustment — it is nearly double the error rate. Avoid placing high-frequency actions at screen edges or corners. strongly supported.

- **macOS and iOS have fundamentally different target size requirements.** A cursor is precisely controllable; a finger is not. The minimum for iOS (44pt) has no equivalent on macOS, where hover state visibility is the more critical concern. Practitioner consensus (designing-interfaces, laws-of-ux).

# Chapter 10: Feedback & System Status — Telling Users What's Happening

The question for this chapter is: How do I handle loading, errors, empty states, and success — so users always know what's going on?

## 1. What This Is

Here is a scenario you have probably experienced as a user: you tap a button in an app. Nothing happens. Nothing changes. No spinner appears, no loading bar, no message. You stare at the screen. Did it work? Did the request fail silently? Did your tap even register? You tap again. Maybe a third time. Now you have submitted the same form three times, or deleted the same item twice.

That frozen moment of uncertainty is not a minor UX inconvenience. It is a broken contract. When you interact with an app, you are implicitly trusting that it will tell you what is happening. A good app honors that contract constantly. A bad app breaks it silently, and users are left guessing.

This chapter covers what Jakob Nielsen identified as heuristic number one — visibility of system status — and translates it into the four concrete design problems you will face in every app you build: loading states, empty states, error states, and success confirmation. Each one is a design opportunity, not an afterthought. The apps you admire — Raycast's instant visual feedback on every action, Linear's smooth loading transitions, Things 3's satisfying task-completion animation — all treat these states as first-class content, designed with the same care as the primary screens.

By the end of this chapter, you will know exactly what to show in each state, how to write error messages that actually help, and when animation communicates status versus when it adds noise.

## 2. What The Research Shows

### Heuristic \#1: The Most Fundamental Usability Principle

Jakob Nielsen's 1994 paper derived nine usability heuristics from factor analysis of 249 real usability problems across 11 software projects. He asked: of all the ways an interface can fail, which underlying principle explains the most problems?

The winner — the heuristic that explained more usability problems than any other — was visibility of system status: "The system should always keep users informed about what is going on, through appropriate feedback within reasonable time." This is not a coincidence or an artifact of his dataset. When users cannot tell what a system is doing, they cannot make good decisions. They over-click, they abandon tasks, they lose trust. Every other usability problem is consequential; this one is foundational.

The coverage numbers are striking: the top four heuristics (consistency, speaking the user's language, feedback, and aesthetic and minimalist design) together explain 65% of all the usability problems in Nielsen's dataset — and 70% of the serious ones. Feedback alone accounts for 13 percentage points of that cumulative coverage. Most of the problems you will create in your apps without a systematic approach to feedback will fall under this umbrella. strongly supported as a framework — empirically derived from a real problem database; note that the derivation used Nielsen's own prior projects, so the finding should be treated as a strong practitioner framework with empirical grounding rather than a randomized study.

Designing Interfaces frames the response time dimension of this heuristic precisely: below 0.1 seconds feels instantaneous and needs no indicator; from 0.1 to 1 second the user notices but stays on task; above 1 second, the user may believe the interface is broken and begin losing task context. Above about 2 seconds, pair every operation with a cancel affordance (designing-interfaces).

Pause and predict: Think about the last time you felt uncertain whether an app was working. What was missing? Was it a spinner? A progress bar? A changed button state? Now think about an app where you always feel confident — what does it do to communicate state? Try to name the specific UI element before reading the answer.

### Three Questions That Define Good Feedback

Hattie and Timperley's meta-analysis of 196 educational studies found that feedback was among the most powerful influences on learning, with an average effect size of d=0.79 across 6,972 effect sizes. Crucially, the research found that feedback ranges from strongly negative to strongly positive in its effects — context and type matter more than presence alone.

An important caveat: this is educational research, measuring learning outcomes in classrooms and medical training. The effect sizes do not transfer directly to UI design — you cannot say that adding a loading spinner will improve user performance by the equivalent of d=0.79. Use the framework, not the number. The reason to engage with this research is the three-question model it produces, which maps cleanly onto UI feedback design.

Hattie and Timperley organize effective feedback around three questions:

- **Feed up (Where am I going?)** — Does the user understand the goal of this operation?
- **Feed back (How am I going?)** — Is the current state of the operation visible?
- **Feed forward (Where to next?)** — Once this finishes, what should the user do?

Apply these three questions to every feedback state you design, and you will consistently produce more useful feedback than "please wait" or "error". supported with limitations as a framework for UI application; the original d=0.79 finding is strongly supported in educational contexts but not directly applicable to software interaction.

Here is how the three questions map onto the four feedback states you will design:

| Feedback State | Feed Up (Where am I going?) | Feed Back (How am I going?) | Feed Forward (Where to next?) |
|----|----|----|----|
| Loading | "Your message is being sent" | Progress bar or spinner | "You'll see the response appear here" |
| Empty | "This is where your tasks will appear" | "You don't have any yet" | "Tap + to add your first task" |
| Error | "We couldn't send your message" | Specific failure reason | "Check your connection and try again" |
| Success | Implicit: the action succeeded | Confirmation animation or message | Next available action |

### Animation and State Transitions

Chevalier et al. conducted a systematic review and expert interview study to produce a taxonomy of 23 animation roles in GUIs, organized across five categories. Two of those categories are directly relevant to feedback and system status.

The first is **Keeping in Context** — animated transitions that preserve spatial continuity when the interface changes state. When a screen navigates to a new screen, a transition animation shows the relationship between where you were and where you are going. When a list item is deleted, an animation showing the other items shifting up makes it clear what happened — without animation, an item simply disappears and the list snaps to a new state, which can feel disorienting or bug-like. The principle behind this, which Chevalier's paper calls the "nothing is lost" principle: animate elements to their new positions rather than letting them disappear and reappear. Users then understand what happened to every element even after a significant layout change.

The second relevant category is **User Experience** — animations that make activity and progress visible. Spinners, progress bars, and skeleton screens all fall here. Their role is not decoration; it is communication of system state. The Designing Interfaces guidebook distinguishes these precisely: a spinner signals an indeterminate brief wait, while a determinate progress bar signals a measurable long operation with progress you can watch.

The important honest note from Chevalier's research: teaching and engagement roles of animation have mixed or absent empirical support. The paper explicitly flags that many UX animation uses — aesthetic delight, "hooking the user," persuasion — are widely used in practice but rarely studied in research. The well-supported roles are the orientation and status-communication ones. Animation that exists purely for visual delight adds cognitive load without a corresponding benefit, and the paper notes that "because of its strong perceptual draw, animation might prevent users from perceiving other elements of the display." early-stage — taxonomy paper with expert validation, not a controlled experiment; teaching/engagement roles are understudied; orientation and status roles are more grounded.

🔗 **Connect:** Think about the difference between Linear's loading states and a blank white screen that freezes for two seconds. Linear uses skeleton screens — placeholder shapes that appear instantly while content loads, maintaining layout structure before real data arrives. How does this satisfy Nielsen's "visibility of system status" heuristic differently from a centered spinner? Which of Hattie's three questions does each approach answer?

### Loading States: Determinate vs. Indeterminate

The single most important decision in loading state design is whether you know how long something will take.

If you know (or can estimate) progress — a file upload, an image processing operation, a sync with a finite number of records — use a determinate progress indicator. A progress bar answers all three of Hattie's questions: it shows the goal (complete), current status (how far along), and implicitly, how much longer. Determinate progress also gives users something to watch, which psychologically reduces perceived wait time. Designing Interfaces notes that 300ms is cited as the research-supported ideal for smooth animated transitions, and that any operation longer than about 2 seconds should include a cancel affordance (designing-interfaces).

If you do not know how long something will take — a network request, a search that depends on server load — use an indeterminate spinner. A spinner says "something is happening" without promising when it will finish. The key rule: show the spinner immediately (within 100ms of the action) rather than waiting to see whether the operation is fast. If it finishes quickly, a brief spinner flash is invisible. If it finishes slowly, the spinner was already there. Showing nothing and then showing a spinner after 500ms is exactly backwards — it creates the gap of uncertainty that breaks the Nielsen heuristic.

Laws of UX includes skeleton screens as a superior alternative to spinners when you know the layout of the content that is loading. Skeleton screens — the gray placeholder shapes you see in apps like Notion and LinkedIn while content loads — maintain the spatial structure of the interface before data arrives. This keeps users oriented (they can see where things will appear) and dramatically reduces the perception of slowness, even when actual load time is identical (laws-of-ux).

### Empty States: Invitations, Not Failures

An empty state is not a blank screen. It is the most important onboarding moment in your app, and it is the one place you have the user's full attention before they have any existing content to distract them.

Think about how Things 3 handles a newly created project with no tasks. It does not show a blank white list. It shows the project header, a subtle illustration or message, and a clear call to action: the same way you would add a task. It tells you: this is where your tasks will live, and here is how to add one. The empty state teaches the interface.

Don't Make Me Think frames this through the concept of information scent: every element should reduce uncertainty and point toward the next action. An empty state that simply shows nothing — no message, no call to action, no visual structure — breaks information scent entirely. The user has no signal about what to do next or whether the app is even working. (dont-make-me-think).

Apply Hattie's three questions directly to empty state design:

- Feed up: What is this space for? Name it and describe it in one sentence.
- Feed back: Nothing is here yet — and that is expected, not an error.
- Feed forward: Here is how to add your first item. Make the call-to-action unmissable.

The tone matters enormously. An empty state that reads like an error ("No items found") is a missed opportunity. One that reads like an invitation ("Your tasks will appear here — add your first one to get started") starts the user's relationship with the feature on the right foot.

### Error Messages: Help-First, Blame-Last

Most error messages are written in exactly the wrong order. They lead with the failure ("Error 404 — Not Found"), then explain what happened (in technical terms), and then sometimes hint at what to do. This order serves the system, not the user.

An error message that actually helps inverts this structure: it leads with what the user can do, explains what happened in plain language, and saves technical details for secondary display (or omits them entirely).

Consider two versions of the same error:

*Blame-first:* "Connection error (-1009). The request timed out. NSURLError."

*Help-first:* "We couldn't save your changes. Check your internet connection and try again — your work is still here."

The second version answers all three of Hattie's questions: the user knows what went wrong (couldn't save), why (connection issue), and what to do next (check connection, retry). The first version answers none of them from the user's perspective.

Designing Interfaces provides three rules for error message writing: short but specific, plain language, and polite (designing-interfaces). Krug adds the goodwill dimension: information blackouts and blame-first error messages are among the fastest ways to drain user trust. Users arrive with a reservoir of goodwill; opaque errors deplete it quickly (dont-make-me-think).

The structural rules for iOS error presentation follow from the platform conventions: use an alert for errors that require immediate attention and block the user from continuing; use a toast or inline message for recoverable errors that do not require stopping the flow. Never use an alert for a success confirmation — alerts interrupt; confirmations should not.

🎯 **Apply:** Pick an error message from an app you have shipped or are building. Rewrite it using the help-first format: (1) what the user can do, (2) what went wrong in plain language, (3) reassurance that nothing is permanently broken. Does your rewritten version answer all three of Hattie's questions?

### Success Confirmation: Enough, But Not Too Much

Success confirmation exists on a spectrum from invisible to intrusive. Most developers default to one of two failure modes: either they confirm nothing (the user is left wondering if the action worked) or they over-confirm with a modal alert that requires dismissal for every completed action.

The right level of confirmation depends on the reversibility and significance of the action. A deleted file deserves a toast notification and an undo option — significant enough to confirm, reversible enough not to require a blocking dialog. Sending a message deserves a brief animation showing the message sent. Marking a task complete in Things 3 gets a satisfying check animation. Saving a draft might need nothing visible at all if the UI state already communicates the change.

Designing Interfaces distinguishes these precisely with the spinner vs. loading indicator framing: a brief confirming animation or subtle state change is appropriate for most actions; a blocking indicator with a cancel button is appropriate for long operations (designing-interfaces). The Laws of UX frames this as the optimistic UI model — show successful feedback immediately, and surface errors only if the action later fails. Instagram comments appear in your feed instantly; only if posting actually failed does an error appear. This eliminates the wait state entirely for the common success case (laws-of-ux).

For Raycast extensions, `showToast()` is the canonical confirmation mechanism. A toast at the bottom of the Raycast window appears briefly and disappears — exactly calibrated for a keyboard-first tool where interruption is expensive and confirmation should be lightweight.

## 3. How To Use This

### Quick-Start Protocol

1.  **Identify the four states for every data-loading view in your app.** Before you build any screen that loads, fetches, or submits data, explicitly design all four states: loading, empty, error, and success. Do not let any state be an afterthought. If a state is undecided, it will default to a blank screen.

2.  **Match your loading indicator to your knowledge of duration.** If you know the progress (file upload, sync count), use a determinate `ProgressView(value:)`. If you do not, use `ProgressView()` as a spinner. Show it within 100ms of the initiating action — never wait to see whether it will be fast.

3.  **Write every error message in help-first format.** Draft the message with three parts: (1) what the user can do, (2) what went wrong in plain language, (3) reassurance. Strip all technical codes to a secondary area or eliminate them from user-facing messages entirely.

4.  **Treat every empty state as onboarding.** Write three things: a name for the space, a one-sentence explanation of what goes here, and a clear call-to-action that is visually prominent. Make sure the empty state looks like an invitation, not an accident.

5.  **Match confirmation weight to action significance.** Reversible, low-stakes actions get a brief animation or state change. Significant actions get a toast or inline confirmation. Only truly blocking, irreversible actions deserve a modal alert. Never confirm trivial success with a modal that requires dismissal.

### Decision Tree

**Is this operation loading data from a remote source?**

- Yes → Do you know how long it will take or how much is done?
  - Yes → Use determinate `ProgressView(value:)` with estimated time or percentage
  - No → Use `ProgressView()` spinner; show within 100ms of triggering
- No (instant local operation) → No loading indicator needed; change state immediately

**Is this a new empty collection or a filtered empty result?**

- New empty collection → Write an onboarding empty state with explanation + primary call-to-action
- Filtered empty result → Write a message explaining no results matched + offer to clear filters or broaden search

**Did an operation fail?**

- Is it recoverable without user action? → Show inline retry option with help-first message; do not block with alert
- Does the user need to take action to proceed? → Show an alert with a clear action label (not "OK") and a help-first message body
- Is it a background operation that failed quietly? → Show a toast notification with a retry option

**Did an operation succeed?**

- Is it reversible? → Show toast with undo option (use Raycast `showToast()` pattern; in SwiftUI, brief animation + undo button)
- Is it irreversible and significant? → Show confirmation and summary of what changed
- Is it a routine action the user will do constantly? → Brief animation only; do not interrupt flow with explicit confirmation

### Design Checklist

**Avoid:**

- Screens that show nothing during loading — blank screens are indistinguishable from frozen apps
- Empty states that just show a blank list without any message or call-to-action
- Error messages that lead with technical codes or system-level language ("Error -1009")
- Success modals that require dismissal for low-stakes actions
- Animations added purely for aesthetic delight, especially those that play on every frame and cannot be bypassed

**Do:**

- Respect `isLoading` state on list items in Raycast extensions — the `isLoading` prop shows a spinner on individual rows without blocking the whole interface
- Use SwiftUI's `.task {}` modifier to manage async loading states tied to view lifecycle, so loading begins when the view appears
- Respect `.isEnabled` on controls — disabled controls need visible dimming to communicate that they are inactive, not just broken
- Always provide a `.accessibilityLabel` on animated elements — VoiceOver users cannot see spinners and need verbal confirmation that something is loading
- Keep `ProgressView` dismissal automatic when the operation completes — never leave a spinner running after an operation finishes

## 4. Practice Lab

This lab has you design all four feedback states for a real screen in your app before writing any code. The goal is to make state design explicit rather than discovered during implementation.

**Setup:** Choose one screen in your current app that loads data from a network or local source. Have a text editor or notes app open to record your designs.

**Step 1 — Map your four states (10 min)**

For the screen you selected, write one paragraph describing what each of these four states should look like:

- **Loading state:** What visual indicator appears? When exactly does it appear (on what user action)? Is progress determinate or indeterminate? Where on the screen does it appear?
- **Empty state:** What does the user see when there is no data yet? Write the exact copy for: (1) the headline explaining what this space is for, (2) the body text explaining what to do, (3) the call-to-action button label.
- **Error state:** What does the user see when loading fails? Write the exact error message in help-first format: what can they do, what went wrong, reassurance. Specify how it is presented: inline? toast? alert?
- **Success state:** If this screen involves submission or action, what confirms success? Brief animation? Toast? State change? Is there an undo affordance?

Score each state you designed: does it answer Hattie's three questions — where am I going, how am I going, where to next?

**Step 2 — Audit your existing error messages (10 min)**

Find three error messages currently in your app, or — if you are starting fresh — find three error messages in apps you use daily that frustrate you.

For each one:

- Does it lead with what the user can do, or with the failure itself?
- Does it use plain language, or technical codes?
- Does it answer all three of Hattie's feedback questions?

Rewrite each one in help-first format. Keep each rewrite to two sentences maximum.

**Step 3 — Implement one state in SwiftUI (15 min)**

Pick the state you feel least confident about from Step 1 and implement it now:

For a loading state:

- Add `@State private var isLoading = false`
- Wrap your data fetch in `.task { isLoading = true; ... ; isLoading = false }`
- Show `ProgressView()` when `isLoading` is true, using an overlay or conditional view
- Confirm the spinner appears within one second of the triggering action

For an empty state:

- Add a conditional check on your data array being empty
- Design a view with a descriptive title, explanatory body, and a prominent call-to-action button
- Make the call-to-action the same action as your primary "add" button so muscle memory transfers

For an error state:

- Add `@State private var errorMessage: String? = nil`
- Set a help-first error message string on failure
- Display it inline or as an `.alert` depending on severity
- Include a retry button that re-triggers the fetch

**Completion target:** All four states documented in writing, three error messages rewritten in help-first format, one state implemented and tested in Simulator.

## 5. Key Takeaways

- **Visibility of system status is Nielsen's heuristic \#1 — the most fundamental usability principle.** The top four heuristics together explain 65% of all usability problems; feedback alone accounts for a significant share. strongly supported as a framework.

- **Hattie's three-question model is a useful lens for evaluating any feedback state:** Where am I going? How am I going? Where to next? A feedback state that fails all three questions will consistently frustrate users. supported with limitations as a framework, applied here by analogy from educational research.

- **Animation earns its place when it communicates state changes and preserves spatial context — not when it exists purely for aesthetic delight.** The "nothing is lost" principle: animate elements to their new positions to maintain user orientation. early-stage evidence — well-supported for orientation roles, understudied for engagement/aesthetic roles.

- **Empty states are onboarding moments, not failure states.** Design them to name the space, set expectations, and provide a clear first action — before the user has any data to distract them. Practitioner consensus (designing-interfaces, dont-make-me-think).

- **Error messages should be help-first, blame-last.** Lead with what the user can do, explain what went wrong in plain language, and reassure that nothing is permanently broken. Technical error codes belong in logs, not user-facing messages. Practitioner consensus (designing-interfaces, dont-make-me-think).

# Chapter 11: Forms & Inputs — The Hardest Part of App Design

The question for this chapter is: How do I design an input form that users actually complete correctly?

## 1. What This Is

Most of the time, your app is delivering something to the user. It shows a task list, plays music, surfaces search results, displays a map. The user is the consumer and your interface does the work. Forms are the inversion of this. Now the user is the producer. You are asking them to do work, to transfer information they hold in their head into a structure you define, in a format you specify, without error. The gap between how you think about a form and how a user actually fills one out is the root of almost every form design failure.

You probably imagine a user reading each label carefully, understanding the field's purpose, typing a correct response, and moving cleanly to the next. What actually happens looks more like a person filling out tax paperwork in a hurry: scanning ahead to estimate how long this will take, skipping optional fields without reading them, misreading ambiguous labels, formatting dates wrong, getting confused about what "required" means, hitting Submit with a mistake they didn't notice, and then trying to figure out from a vague error message what went wrong.

Forms are the highest-friction interaction in most apps. They are also, consequently, the highest-leverage design problem. A well-designed form completes the same transaction with fewer errors, faster, and with users who feel competent rather than frustrated. Bad form design is one of the most common reasons real transactions fail — registrations abandoned, purchases uncompleted, onboarding flows dropped. Conversely, a redesign of a suboptimal form can increase completion rates by 10 to 40 percent. That range is a practitioner estimate without a controlled experimental design, but the magnitude is consistent with what UX research shows more broadly: small structural changes to forms produce surprisingly large changes in completion.

This chapter gives you a set of evidence-backed answers for the most common form design decisions: where to put labels, how to mark required fields, when to show validation errors, which input control to use for which data type, and what to do about the date picker problem. Each answer comes with the why, so you can reason about edge cases rather than just memorizing rules.

## 2. What The Research Shows

### Label Placement Is Not a Stylistic Choice

Of all the micro-decisions in form design, label placement has the clearest empirical answer. In 2006, Matteo Penzo ran an eye-tracking study comparing three conditions: labels positioned above the input field, to the left of the field, and to the right of the field. The results were decisive enough that the design community has largely settled on them as a standard.

Top-aligned labels are the fastest. When a label sits directly above its field, a single eye fixation captures both the label and the input together. The user's attention never has to jump between two separate locations on the page. The cognitive cost of reading the label and then finding the field is essentially zero.

Left-aligned labels are the slowest. The user's eye must track right from the label to find the input, then come back to read the next label. In Penzo's study, users needed nearly twice as long to complete forms with left-aligned labels compared to right-aligned. That "nearly twice" is a meaningful performance difference for a form that might have ten to fifteen fields.

Right-aligned labels split the difference — they cut the fixation count roughly in half compared to left-aligned, because the label is immediately adjacent to the input. But user satisfaction with right-aligned labels is lower than with both other conditions. The visual raggedness of the left edge of the label column creates a less organized feeling.

The practical rule: use top-aligned labels as your default for most forms, especially on mobile where the vertical scroll budget is less constrained than the horizontal. Left-aligned labels have one legitimate use case: when you deliberately want users to slow down and read carefully before answering — complex financial forms, legal documents, or anything where a user skimming and typing quickly would be genuinely dangerous. supported with limitations — the Penzo eye-tracking data is the primary source; exact effect sizes require the original study.

On iOS, top-aligned labels fit naturally into the Vertical Stack mobile pattern. In SwiftUI, the `Form` view places labels to the left of fields by default in its grouped list style — that is appropriate for Settings-style forms where users expect to navigate and read, not for fast transaction forms where you want top-aligned labels in a custom layout.

Pause and predict: Think about a login form with username and password fields. If you were to use left-aligned labels, where would the user's eye go after reading "Username:"? Now imagine top-aligned. How many times does the eye move before the user starts typing?

### Required Fields: The Asterisk Is Not Enough

The asterisk-only convention for marking required fields is everywhere — and it underperforms alternatives that have been tested against it. A 2009 study by Pauwels and colleagues compared color-coded required field marking against the asterisk-only approach. Color-coded marking produced faster form completion, fewer errors, and higher user satisfaction across all three measures.

The mechanism is simple. An asterisk is a symbol that requires the user to remember what it means. A color-differentiated field communicates its status without requiring any translation. The visual signal "this box looks different" is processed before conscious attention, while "this box has an asterisk which means required" requires a lookup.

The practical application is to combine color with the asterisk, not choose between them. Use a colored border, a tinted background, or a small colored indicator on required fields. The asterisk satisfies screen reader accessibility (make sure it has an appropriate ARIA label); the color satisfies the faster visual-processing channel. The color you choose should be consistent with your broader status system — if red means "error" throughout your app, then using red to mean "required" will create confusion. A neutral accent color or a subtle highlight works better than red for required-field marking.

A complementary finding from Tullis and Pons: separating required fields from optional ones in the visual layout — rather than mixing them and using a symbol to differentiate — also speeds completion. If your form has five required fields and three optional ones, consider whether you can group the required fields together or even move the optional fields below a visual divider. The user then completes the primary task first and optionally fills in additional information. This structure also reinforces Designing Interfaces' principle of deferred choices — never ask users for information they are not ready to provide.

In SwiftUI, you can mark fields visually using `.overlay` with a colored border or a conditional `.background`. There is no built-in required-field indicator — it is always a custom implementation.

### The Counter-Intuitive Truth About Inline Validation

This is the finding that most surprises developers and designers when they first encounter it, because it contradicts a practice that is extremely common — and even recommended by many design tools and frameworks.

Inline validation means showing an error message immediately after the user leaves a field (the "blur" or "focus-out" event). The intuition behind it seems sound: if the user made a mistake in field 3, tell them right then, before they have filled out fields 4 through 10. Catching the error early saves the user from having to backtrack.

The evidence says something different. A 2007 study by Bargas-Avila and colleagues tested inline validation — errors shown as the user left each field — against showing all errors together after the user clicked Submit. The inline condition produced more consecutive errors, not fewer. Users were in input mode when they received the error messages. They were actively filling the next field, their attention was forward-facing, and the error appearing behind them in a field they had already moved away from was ignored, dismissed, or missed entirely. They clicked Submit, saw the same error summary they would have seen anyway, and felt more confused — because some of the fields now showed error states they did not remember creating.

The effective pattern, resolved from this conflict in conflict-resolutions/C03-inline-validation, is what practitioners now call progressive validation:

1.  Never validate while the user is still typing in a field.
2.  Never validate on the first time the user leaves a field — do not flag an error the first time focus moves away.
3.  Validate all fields together after the first submission attempt. Show all errors simultaneously, embedded near the fields they describe, with enough context to fix each one.
4.  After the user has seen the error summary and started correcting, then show inline confirmation as they fix each field. At this point, they are in review mode, they are looking for feedback, and a green checkmark or disappearing error message is genuinely helpful.

The difference between step 2 and step 4 is the user's mental state. Before submission, users are composing. After a failed submission, users are editing. Real-time feedback lands differently in editing mode than in composition mode.

The practical implementation consequence: do not use your framework's default `onChange` or `onBlur` validation for showing errors. Wire the validation to form submission. Then, after a failed submit, switch to a mode that re-validates inline as the user corrects each field. This is more engineering work than the default, which is probably why inline-on-blur persists so widely despite its problems.

supported with limitations — the Bargas-Avila 2007 study is the primary source, but it is older and based on web forms; the progressive validation synthesis is practitioner consensus compatible with the original finding.

In SwiftUI, you would typically bind a `@State` variable `hasAttemptedSubmit` and only compute validation state on fields where `hasAttemptedSubmit == true`. After submission failure, set it to true and then render inline messages on subsequent `.onChange` updates.

🔗 **Connect:** Think about the last form you filled out on iOS where a red error appeared under a field you hadn't finished yet. Did it help you fix the error, or did you dismiss it and keep going? This chapter's finding says you almost certainly kept going. How would the progressive validation pattern have felt different?

### Format Specification Over Format Examples

When a field has a specific format requirement — a password must have at least eight characters, a date must be MM/YYYY, a phone number must include a country code — how you communicate that constraint matters more than whether you communicate it.

A 2009 study by Bargas-Avila and colleagues tested three approaches: no hint at all, a format example, and a format specification ("MM/YYYY"). The format specification — stating the rule without an example — produced the lowest error rate with the least visual information. The format example alongside the specification did not improve accuracy and in several cases increased errors, apparently because users read the example and tried to replicate the literal values rather than the pattern.

The mechanism: a specification gives users a rule they can apply. An example gives users a case they might misread as a template. "Enter date as MM/YYYY" is unambiguous. "e.g. 01/2024" invites the question: do I use that exact year? Is this demonstrating the format or showing a placeholder? The answer seems obvious, but under the mild cognitive load of filling a multi-field form, users make that mistake consistently.

Practical application: put the format specification below the field as helper text, using the smallest readable text size in your type scale. Keep it to a single line. Do not put it inside the field as placeholder text — placeholder text disappears the moment the user starts typing, which is exactly when they need the format reminder most. This is in the Always/Never list from Don't Make Me Think: never use labels inside form fields. Placeholder text is for examples of valid input, not for instructions the user needs to complete the field correctly.

In SwiftUI, the `TextField` initializer takes a `prompt` parameter for placeholder text. Helper text goes below the field as a separate `Text` view styled with `.caption` and `.secondary` foreground color.

### Choosing the Right Input Control

The choice between input control types matters more than most developers expect. The form is a communication interface, and the shape of a field telegraphs the shape of the expected answer.

**Checkboxes versus list boxes for multi-select.** When you need users to select multiple options from a list, checkboxes outperform list boxes on both speed and satisfaction. In a study by Bargas-Avila et al., users were faster and reported higher satisfaction with checkboxes. The reason is straightforward: checkboxes make all options simultaneously visible, individually tappable, and show their current state (checked or unchecked) without any mode change. A list box requires the user to scroll, hold Cmd or Shift to select multiple items (a power-user interaction that many casual users do not know), and provides no persistent visual summary of what is currently selected. On iOS and macOS, list boxes are uncommon in native UI for precisely this reason — use checkboxes or a multi-select picker with visible selection state.

**Radio buttons versus dropdowns for single-select.** The evidence here is nuanced. At the individual-question level, radio buttons are faster than dropdowns. But in overall form completion time across a full form, the difference disappears. No significant difference in dropout rates was found across three separate studies. The practical rule that emerged from this mixed evidence: use radio buttons when there are four or fewer options; use a dropdown when there are more than four. At low option counts, radio buttons show all choices at once with no interaction cost. At higher option counts, the space cost of radio buttons becomes significant and a dropdown is more efficient.

In SwiftUI on iOS, `Picker` with `.pickerStyle(.inline)` shows like radio buttons; `.pickerStyle(.menu)` shows as a dropdown. Use `.inline` for four or fewer choices, `.menu` for more.

**The date picker problem.** Date entry is the single most error-prone field type in most forms, because there are so many ways to represent a date and users consistently format them differently from what you expect. Two tested approaches work well for different reasons: dropdown menus for month, day, and year produce the lowest format error rate because the user cannot enter an invalid date. A single text field with clearly shown format symbols (MM/YYYY displayed inside or adjacent to the field) achieves faster completion — in a study by Christian et al., using the MM/YYYY symbols directly in the field produced between 92.9 and 95.8 percent correct format compliance. Choose based on your priority: if error prevention is paramount, use a picker; if speed matters and your format is simple and familiar, use a structured text field with explicit format display.

On iOS, `DatePicker` is the native component and handles all of this for you. Use it whenever possible. On macOS, `DatePicker` has a calendar popover style and a compact inline style. For Raycast extensions, the `DatePicker` component is available in the Raycast API's Form and handles validation internally.

**Match field width to expected answer length.** This is a design principle grounded in Gibson's affordance concept: the visual size of an input field communicates the expected size of the answer. A full-width text field for a two-digit age field signals "write a paragraph." A short field for a zip code communicates "a few characters." Studies by Couper et al. and Christian et al. found that mismatched field sizes increase format errors. The field's visual shape is a constraint message. Short answer = narrow field. Long answer = wide field. In SwiftUI, set explicit `.frame(maxWidth:)` on fields whose expected inputs are short.

🎯 **Apply:** Open a form in an app you use regularly — the iOS Settings app, a banking app, or a checkout flow. Go through each field and ask: what is the correct control type for this data? What label placement is being used? Is there any inline validation, and does it follow the progressive pattern? Name one thing you would change.

### Single-Column Beats Multi-Column

A word on overall form layout, because this is a mistake that appears frequently in developer-built forms: do not put two fields side by side in a multi-column layout unless the fields are genuinely inseparable (like first name and last name in a direct visual pairing). Research by Robinson and practitioner consensus from Baymard Institute consistently point the same direction: single-column forms are faster to complete and produce fewer errors. Multi-column forms create ambiguity about reading order (do I go across the row or down the column?) and break the visual scanning pattern users apply to lists. If your form has twenty fields, the answer is not to put them in two columns of ten — it is to eliminate fields you do not need or to break the form into sections or steps.

The connection to progressive disclosure from Chapter 4 is direct: if your form has ten required fields and five optional ones, consider whether the optional fields should appear at all in the initial form, or whether they could live behind an "Add details" expansion. Every field you remove from the visible default form is friction you have absorbed on the user's behalf.

## 3. How To Use This

### Connecting to Other Chapters

Form design does not exist in isolation. The label placement finding connects to Chapter 5's principle that visual hierarchy is controlled by proximity — a top-aligned label has higher visual proximity to its field than a left-aligned one. The required-field color guidance connects to Chapter 8's color system: your required-field indicator color needs to be part of your pre-defined palette, not an ad hoc addition. The error message timing connects forward to how you handle the error state, which Chapter 10 covered under system feedback — the post-submit error summary is a system status message, and it should follow the same principles: specific, actionable, politely worded, and immediately adjacent to the field it describes.

The single-column recommendation connects to Chapter 6's spacing principle: more space around a group than within it, and a consistent vertical reading rhythm are both incompatible with multi-column form layouts.

### Quick-Start Protocol

When you are designing a new form, work through these steps in order:

1.  **Eliminate fields first.** Before designing anything, ask for each field: can the system deduce this? Zip code can determine city and state. A logged-in user should not need to re-enter their name. Eliminate every field whose data can be inferred or pre-filled. Start with the minimum viable field set.

2.  **Label every field above its input.** Position labels directly above their fields. Use the same font size as body text (not smaller). Match the label's proximity to the field — the label should sit visibly closer to its own field than to the adjacent field above it. This usually means 4–8px of space between label and its field, and 20–32px of space between one field block and the next.

3.  **Mark required fields with color plus symbol.** Add a visible color treatment to required fields (a highlighted border, a tinted left edge, or a small indicator) and include a symbol (asterisk or text like "Required") for screen reader users. Include a one-line legend at the top of the form or first time required fields appear.

4.  **Wire validation to submission, not to blur.** Do not validate fields on focus-out during the initial fill. Set a `hasAttemptedSubmit` flag. On submission failure, show all errors simultaneously at their respective fields. After this point, re-validate inline as the user corrects each field.

5.  **Write format specifications, not examples.** For every field with a format constraint, add a single line of helper text below the field stating the rule directly ("8+ characters, at least one number"). Do not put this text inside the field as placeholder text.

### Decision Tree

The following conditional logic handles the most common form design decisions you will face:

**What input control should I use?**

- If the user selects multiple values from a fixed list: use checkboxes, not a list box.
- If the user selects one value from four or fewer options: use radio buttons or a segmented control.
- If the user selects one value from more than four options: use a dropdown or picker.
- If the data is a date: use the native `DatePicker` on iOS/macOS unless you have a strong reason not to. For Raycast, use the Raycast `DatePicker` component.
- If the data is a short text answer with a known format (zip code, phone, email): use a single-line `TextField` with the appropriate keyboard type (`.keyboardType(.emailAddress)`, `.keyboardType(.phonePad)`) and a format specification as helper text.

**How long should my form be on screen at once?**

- If you have 10 or more fields: break into steps or sections with progress indication, or aggressively eliminate optional fields from the default view.
- If you have 5–9 fields: use a single-column layout with clear section headings if the fields fall into logical groups.
- If you have fewer than 5 fields: a single-column layout needs no sections or headers.

**When should I show validation errors?**

- If the user has not yet attempted to submit: show no field-level errors, regardless of what they type.
- If the user has submitted and errors were found: show all errors simultaneously at their fields, and optionally a summary at the top for long forms.
- If the user is correcting a field after a failed submission: show inline confirmation as they fix each field.

### Design Checklist

**Avoid these failure modes:**

- Placeholder text used as a substitute for a visible label (the field becomes unlabeled once the user starts typing).
- Inline per-field validation on blur before the first submission attempt.
- Full-width text fields for short answers (zip codes, area codes, two-digit quantities).
- Asterisk-only required field marking with no visual reinforcement.
- Multi-column layout that creates ambiguous reading order.
- Optional fields front-loaded with equal visual weight to required ones.

**Do these by default:**

- Always use native input controls on each platform — `TextField`, `SecureField`, `Toggle`, `Picker`, `DatePicker` in SwiftUI. Raycast's `Form` component with its own `TextField`, `Dropdown`, and `DatePicker` components. Native controls give you keyboard type, autocorrection, autocapitalization, and accessibility for free.
- Use `.submitLabel()` on iOS text fields to set a meaningful return key label ("Next," "Done," "Search") rather than the default "Return."
- Use `.focused()` and a `FocusState` to manage keyboard focus programmatically — advance to the next field on "Next" and dismiss the keyboard on "Done."
- Keep field labels and their helper text in the same visual column as the field itself. Labels should never float independently in the layout.

## 4. Practice Lab

This lab walks you through designing a short form from scratch, applying the principles in this chapter. It is designed to take 20–30 minutes.

**Setup:** Pick a form you need to build or have already built in one of your apps. If you do not have a real candidate, use this scenario: a "Create New Task" form for an iOS task manager, with fields for task name, due date, project (from a list), and optional notes. Whichever you choose, write down the fields before starting.

**Exercise 1: Field audit (5 minutes)**

Go through every field in your form and answer these questions for each one:

- Can this data be deduced or pre-filled from information you already have? If yes, eliminate the field.
- Is this field required or optional? Mark each one explicitly before thinking about the layout.
- What is the correct control type for this field? (Text, picker, checkbox, toggle, date picker — use the decision tree above.)
- Does this field have a format constraint? If yes, write the specification in plain language right now ("Task name: 1–100 characters").

At the end of Exercise 1, you should have a trimmed field list with each field labeled required/optional, assigned a control type, and given a format specification if needed.

**Exercise 2: Layout sketch (10 minutes)**

Lay out the form. You do not need code or a design tool — a piece of paper or a quick notes sketch works. Apply these rules:

- All fields in a single column.
- Every label positioned above its field.
- Required fields marked with a visual indicator plus text or symbol.
- Optional fields visually subordinated — slightly smaller helper text saying "Optional," or grouped below the required fields under a visual divider.
- Helper text (format specification) appearing below each constrained field, in a smaller text size.

**Exercise 3: Validation logic (5 minutes)**

Describe your validation behavior in plain words before writing any code:

- What happens when the user taps in a field and then taps out without typing? (Answer: nothing — no error shown.)
- What happens when the user taps Submit with an empty required field? (Answer: show all field errors simultaneously. Write what the error message for each required field would say — be specific, not generic. "Task name is required" beats "Required field.")
- What happens after a failed submission when the user goes back and types a valid value into an error field? (Answer: the error clears when the field becomes valid — now inline feedback is appropriate.)

**Exercise 4: Implementation check (5 minutes)**

If you are building on iOS/macOS:

- Did you assign the correct `.keyboardType` for each text field? (`.emailAddress` for email, `.decimalPad` for numbers, `.default` for free text.)
- Did you set `.autocapitalization(.none)` on email and username fields? Did you set `.disableAutocorrection(true)` where appropriate?
- Did you set `.submitLabel()` on each field? The last field should say "Done"; earlier fields should say "Next."
- If using iOS, did you set up a `FocusState` to advance focus to the next field when the user taps "Next"?

If you are building a Raycast extension:

- Did you use `<Form>` with Raycast's `<TextField>` and `<Dropdown>` components? Are you avoiding custom HTML input elements?
- Did you add `info` props to fields that need format specification?
- Did you handle `onSubmit` validation at the form level, not per-field?

## 5. Key Takeaways

- **Top-aligned labels are fastest, left-aligned are slowest.** Users need a single eye fixation to capture a top-aligned label and its field together. Left-aligned labels require nearly twice as long as right-aligned. Use top-aligned labels as your default.

- **Validate after submit, not on blur.** Inline per-field validation before the first submission attempt causes more errors, not fewer — users are in composition mode and dismiss error messages without reading them. Show all errors together after submission, then switch to inline confirmation as users correct each field.

- **Color-plus-symbol beats asterisk-only for required fields.** Color-coded required field marking produces faster completion, fewer errors, and higher satisfaction. Combine a visual treatment with a symbol or text label to cover both rapid visual processing and screen reader accessibility.

- **State the format rule, do not show an example.** Format specification ("8+ characters") produces lower error rates than format examples ("e.g. password1!"). Examples can be misread as templates.

- **Checkboxes beat list boxes for multi-select; four-or-fewer options warrant radio buttons.** Checkboxes are faster and preferred over list boxes for selecting multiple values. For single-select, radio buttons win at four or fewer options; dropdowns win above that threshold. Match field width to expected answer length — the width is a format affordance.

# Chapter 12: Motion & Animation — When to Move, When to Stay Still

The question for this chapter is: Should I animate this? If yes, how?

## 1. What This Is

Notice what happens when you open a sheet in Things 3. The view slides up from the bottom, and the underlying content pushes gently back. When you dismiss it, the sheet slides down and the content comes forward again. The world you were in did not disappear — it receded. The world you are navigating to did not appear from nowhere — it came from below you. You always know where you are in relation to where you were.

Now think about an app with no animations. You tap a button. The next screen appears instantly. You tap back. The previous screen appears instantly. It works. But there is a subtle cost: every jump between screens requires a small act of cognitive reorientation. Where did the previous screen go? Is this a new level or a different section? The transition gave you no spatial information.

This is what animation is fundamentally for in interface design. Not to look impressive. Not to entertain. Not to signal "we worked hard on this." The primary job of animation in a well-designed app is to make the spatial and causal structure of the interface legible — to answer the question "what happened?" without requiring the user to read anything.

But animation can also work against you. A transition that takes 800 milliseconds instead of 300 is not 2.7 times more elegant — it is a wall the user has to wait at. An animation on every single interaction does not feel polished; it feels slow. A spinning, bouncing, color-changing element screams for attention while the user is trying to read something else on the same screen.

The research on animation is less definitive than the research on forms or touch targets. We have a detailed taxonomy of what animation does in interfaces, strong evidence for a few specific functional uses, and an honest admission from researchers that many of the uses attributed to animation in commercial products have never been empirically tested. This chapter will tell you which uses are evidenced, which are assumed, and how to make the judgment call for your own apps.

## 2. What The Research Shows

### A Map of What Animation Actually Does

In 2016, Chevalier and colleagues published a paper that asked a foundational question: what are all the roles that animation actually plays in graphical user interfaces? The paper surveyed the HCI literature, collected over 200 examples from commercial products, and conducted interviews with 20 expert practitioners. The result was a taxonomy of 23 distinct animation roles, organized across five categories.

Before going through the categories, an important note about the evidence level of this paper: this is a taxonomy, not an experimental study. The paper describes what animation is used for, not whether each use works. For some roles, the authors cite prior studies with mixed or supportive results. For others — particularly the "User Experience" category — the authors explicitly note that the uses are "widely used in practice but rarely studied in the literature." That distinction will matter when we get to practical guidance.

**Category 1: Keeping in Context.** Four roles in this category, all concerned with orientation during navigation. The core principle is what the authors describe as inspired by Lavoisier's law — in chemistry, matter is neither created nor destroyed, only transformed. Good animated transitions apply the same principle to interface elements: when a screen changes, elements animate to their new positions rather than disappearing and reappearing. Users understand what happened to elements. "Where did that go?" becomes "I see where that went."

The specific role with the most research support is animated transitions during navigation. When you navigate from a list to a detail view, animating the selected item expanding to fill the screen preserves spatial continuity. Users understand that the detail view is this item, at a larger scale, not a separate place they teleported to. When you dismiss the detail view, the element shrinks back into its list position. The entire mental model of "a list of things, each of which I can expand" is communicated by the animation without a word of explanation.

A related role is staged animation for complex transitions: breaking a complicated state change into sequential steps rather than executing everything simultaneously. The SpaceTree information visualization, cited by Chevalier et al., used this pattern: when navigating to a distant node in a large tree, the view first shrinks the current branch, then repositions, then expands the destination branch. This three-step choreography lets users track what happened at each stage. A single instantaneous jump would require them to reconstruct the spatial change from scratch.

supported with limitations — animated transitions for orientation are backed by prior studies cited in the taxonomy; the staged animation claim is observational/practitioner-based.

**Category 2: Teaching Aid.** Five roles here, covering things like previewing what a gesture will do before you commit, demonstrating how to perform an action, and explaining how a system works. This category has the most mixed empirical record in the taxonomy. The authors state plainly: "The outcomes of existing empirical studies are mixed. More research is needed to determine when to use animation and what components of the animation matter." This is an honest and important caveat. When you see an animated tutorial in an app, the assumption is that it teaches better than a static diagram would. The evidence does not consistently support that assumption.

The one teaching use with stronger standing is affordance animation — a subtle hint that reveals what an element will do before the user commits to it. The small preview of a drag-to-delete swipe that appears as the user begins the gesture, or the gentle bounce that tells a new user "this thing can be dragged," falls in this category. This use is evidenced less by controlled studies and more by the nearly universal practitioner consensus that affordance signals reduce errors on first interaction.

early-stage to early-stage for teaching animations — explicitly noted as having mixed empirical outcomes in the primary source.

**Category 3: User Experience.** Five roles, including visual comfort/aesthetics, keeping users engaged, making activity or progress visible, and providing feedback for input. This is the category most relevant to everyday app building, and it is also — as the authors acknowledge — the least researched. The paper notes that roles like "hooking the user" and "visual comfort" are commonly deployed in commercial products but that empirical study is sparse.

What is well-supported within this category: making activity and progress visible. A spinner or progress bar during a loading operation is not decoration — it answers the user's question "is something happening?" without any words. Animating a button into a loading state after a tap tells the user their input registered. A brief confirmation animation ("your task was completed") prevents the user from second-guessing whether their action took effect. These are all feedback animations, and they connect directly to Chapter 10's principle of visibility of system status. They earn their keep.

What is less well-supported: the assumption that aesthetic and engagement animations — the playful micro-interactions, the logo animation on launch, the animated icon states — produce measurable usability benefits. They may contribute to perceived quality or brand identity, and practitioners broadly believe they do. But "designers believe this creates a better experience" and "research has confirmed this creates a better experience" are different claims. Use aesthetic animations intentionally and sparingly rather than as a default.

supported with limitations for progress and feedback animations; early-stage for aesthetic/engagement animations.

**Category 4: Data Encoding.** Four roles, covering things like conveying uncertainty, encoding emotion through motion, and revealing data relationships. This category is largely out of scope for the apps you are building — it applies more to data visualization and scientific software. The main note worth carrying forward: motion is one of the few pre-attentive visual variables, meaning the eye detects it before conscious attention is engaged. This is powerful for data visualization but also a liability in general app UI — any moving element on a screen will draw the eye away from whatever the user is supposed to be looking at.

**Category 5: Visual Discourse.** Three roles: supporting a narrative, highlighting content, and persuading or convincing. These are mostly in scope for marketing and presentation software, not utility apps. The one role worth noting is highlighting — animation that draws attention to a changed state or a new piece of information. A notification badge pulsing once, a newly added item animating into a list, a changed status indicator briefly flashing — these are legitimate and effective uses of motion as an attention signal.

Pause and predict: Think about how Raycast handles navigation. When you type a command and select a result, does the view animate? What does the absence of ornamental animation communicate about Raycast's design priorities? Now think about how Things 3 handles task completion. What does the completion animation communicate that a silent disappearance would not?

### When Animation Harms UX

The taxonomy's strongest caution is also its least obvious: animation's strong perceptual draw can actively prevent users from noticing other elements of the display. This is not a theoretical risk. Pre-attentive motion detection is a feature of the visual system that cannot be turned off — when something moves in peripheral vision, the eye redirects to it involuntarily. This is a survival mechanism, and it overrides conscious attention.

The implication for interface design: if you animate something on a screen where the user is supposed to be doing something else, you will pull their attention away from the task. An animated advertisement beside an article is the canonical example — it is why banner blindness evolved, and then why banner blindness extended to anything that looks like it might animate. But the same principle applies to your own animations. If you have a progress animation in one corner of the screen while the user is supposed to be reading and responding to content in the center, the animation will win the attention competition even when the user does not want it to.

The practical rule: animate one thing at a time, or animate only background elements that the user does not need to attend to. Never run an attention-drawing animation while the user is supposed to be reading, making a decision, or filling out a field.

The other primary way animation harms UX is simple: duration. Transitions that are too long create perceived lag — the feeling that the app is slow even when the underlying operation is instant. The research on response time thresholds from Chapter 10 applies here. Designing Interfaces cites 300ms as the research-supported threshold for smooth, fluid animated transitions. Apple's own system animations cluster around 300–400ms. Spring animations in iOS typically use a response of around 0.3 seconds and a damping fraction around 0.7, which produces a fast, slightly elastic feel that matches the physical intuition of touching something springy. Go much over 400ms for a simple navigation transition and the app starts to feel sluggish.

🔗 **Connect:** You have just read that duration is one of the main ways animation harms UX. Now think about animated tutorials you have seen in iOS onboarding flows. The tutorial animation usually runs 1–2 full seconds and may loop. Does that match the 300ms target for UI transitions? Why might a tutorial animation have a different duration target than a navigation transition?

🎯 **Apply:** Pick one navigation transition in something you have built or are building. Time it — use a screen recording if needed. Is it under 400ms? If not, halve the duration and compare. Does the shorter version feel abrupt, or does it feel faster without losing clarity?

### What the Platform Norms Actually Say

Apple describes motion in the Human Interface Guidelines as a tool for "conveying spatial relationships, functionality, and intention with beauty and fluidity" — a formulation directly aligned with Chevalier et al.'s first category (Keeping in Context). The platform expectation is that navigation has spatial logic and that animation communicates it.

Google Material Design describes motion as conveying "spatial relationships, functionality, and intention" as well. Both are cited by Chevalier et al. as evidence that the Keeping in Context roles have become recognized platform standards.

Raycast takes the opposite approach: minimal animation by deliberate design. Raycast is a tool, not an experience. Every millisecond of transition time is friction. The design priority is instant response — results appear immediately, selections register immediately, the interface is always in the present tense. When building Raycast extensions, do not fight this philosophy by adding custom animations. They will feel foreign to the shell and slow down an interface whose entire character is built on speed. Raycast's animation budget is essentially zero, and that is the right call for its use case.

## 3. How To Use This

### Connecting to Other Chapters

Animation connects directly to Chapter 10's feedback and system status principles — progress animations, loading indicators, and success confirmations are all system status signals. They should be present on operations that take longer than 0.1 seconds and must be present on operations that take longer than 1 second. The decision about whether to show an animation is often a feedback decision, not an aesthetic one.

Animation also connects to Chapter 9's touch target principles at the micro-interaction level. When a button registers a tap, a brief state change (button darkens momentarily, a ripple effect, a checkmark flashes) confirms that the touch was received. This is more important on iOS than on macOS because touch has no hover state — the only confirmation the user receives that a tap registered is what happens afterward. A small confirmation animation bridges the gap between the tap and the response.

The distraction risk of animation connects to Chapter 5's visual hierarchy principle — visual emphasis is a finite resource. An animated element always wins some of that budget. Spend it deliberately.

### Quick-Start Protocol

Use this five-question decision process before adding any animation to your app:

1.  **What is the functional reason for this animation?** If you cannot articulate a role from the Chevalier taxonomy — specifically a role from Keeping in Context, User Experience (feedback/progress), or attention signaling — the animation does not have a functional justification. Reconsider it.

2.  **What would happen if this animation were not there?** If the user would be disoriented, confused about what happened, or uncertain whether their action registered, the animation is load-bearing. If the experience is equally clear without it, the animation is decorative. Decorative animations are not automatically bad, but they should be earned by a product that already handles all functional states well.

3.  **Is the duration under 400ms for navigation and state transitions?** If your animation runs longer than 400ms, cut it in half and test whether anything was lost. You will almost always find that the shorter version feels more responsive without feeling abrupt. The exception is tutorial or teaching animations, which can run longer because the user's attention is deliberately focused on the animation itself.

4.  **Does this animation compete with anything the user is supposed to be doing?** If the animation runs while the user should be reading, typing, or making a decision, it will pull their attention involuntarily. Either remove it or move it outside the user's active work area.

5.  **Does this animation respect Reduce Motion?** See the platform implementation note below — this is not optional.

### Decision Tree

Use this conditional logic for the most common animation decisions:

**Should I animate this navigation transition?**

- If the new screen is a detail view of an item the user tapped: yes, animate the item expanding to fill the screen. On SwiftUI, `.navigationTransition(.zoom(sourceID:in:))` or a matched geometry effect achieves this.
- If the new screen is a sibling section (switching tabs): a cross-fade or a subtle slide is appropriate — a full push/pop suggests hierarchy that does not exist.
- If the new screen is a modal or sheet: slide in from the bottom on iOS (this is the platform default and users expect it); use a sheet presentation on macOS.
- If this is a Raycast extension: use no custom navigation animations. Raycast handles its own transitions.

**Should I animate this state change?**

- If data is loading and the operation takes more than 0.1 seconds: yes, show a loading indicator. A spinner for indeterminate waits; a progress bar for operations with measurable progress.
- If the user just completed an action and needs confirmation: yes, a brief state-change animation on the button or a confirmation checkmark is appropriate. Keep it under 400ms.
- If the view is updating because data changed in the background: animate the change (items appearing, reordering, or disappearing) so users can track what happened. An abrupt content shift without animation is confusing.
- If an error state is appearing for the first time: a subtle shake or color change on the invalid field is effective. An elaborate error animation is distracting.

**How long should this animation run?**

- Navigation transition (push/pop, sheet): 250–350ms with ease-in-out.
- State change (button feedback, toggle, checkbox): 100–200ms.
- List item appearance/disappearance: 200–300ms.
- Tutorial or affordance hint: 600–1000ms (user attention is focused on the animation).
- Loading spinner: indeterminate duration, runs until operation completes.

### Design Checklist

**Avoid these failure modes:**

- Animations over 400ms on navigation transitions and state changes — they feel like lag regardless of how fluid the motion is.
- Running an attention-drawing animation while the user is filling a form or reading important content.
- Animating every interaction — the cumulative effect of many small animations is a slow-feeling app, not a polished one.
- Adding custom animations to Raycast extensions — they conflict with the shell's speed-first design language.
- Forgetting to handle the Reduce Motion accessibility setting — a meaningful proportion of iOS users have this enabled, and ignoring it creates a real accessibility failure.
- Using animation as a substitute for instant response — if an operation can be made faster, make it faster. Animation cannot make a slow operation feel fast; it can only reduce perceived wait.

**Do these by default:**

- Respect `@Environment(\.accessibilityReduceMotion)` in SwiftUI. When it is true, either disable the animation entirely or replace movement-based transitions with a simple opacity cross-fade. A cross-fade conveys state change without spatial motion, which is what triggers motion sensitivity.
- Use spring physics for gesture-driven transitions (dragging, swiping, pinching). Spring physics feel natural because they mimic the physical intuition of elastic materials — the interface responds to force and momentum rather than moving at a constant speed. In SwiftUI: `.animation(.spring(response: 0.3, dampingFraction: 0.7))`.
- Use ease-in-out for programmatic transitions that are not driven by a gesture. Elements that appear should ease in (start slow, accelerate slightly) and elements that disappear should ease out (decelerate before finishing).
- Animate layout changes when new content is inserted or removed from a list. In SwiftUI, wrapping state changes in `withAnimation { }` animates the resulting view updates automatically.

## 4. Practice Lab

This lab gives you a structured way to audit the animation in an app you have already built, or to plan the animation in an app you are designing. It takes 20–30 minutes.

**Setup:** Choose a specific flow in one of your apps — a navigation transition, a loading state, a form submission — or use a hypothetical: a to-do list app where a task can be completed, deleted, or rescheduled. Have the flow in mind before starting.

**Exercise 1: Animation audit (10 minutes)**

For each existing or planned animation in your chosen flow, answer these questions. Work through each one independently:

- What is the functional role of this animation? Match it to one of the Chevalier categories: Keeping in Context (orientation during navigation), Teaching Aid (showing how something works), User Experience (feedback, progress, aesthetic), Data Encoding (representing data through motion), or Visual Discourse (highlighting, persuading). If you cannot match it, write "decorative."
- How long does it run? Measure it or estimate it in milliseconds. Compare it to the targets: 250–350ms for navigation, 100–200ms for state changes.
- Does it compete with any user action (typing, reading, making a decision)?
- What happens when `accessibilityReduceMotion` is enabled? Does the animation disable or reduce gracefully, or does it run regardless?

At the end of Exercise 1, you should have a list of animations with each one labeled by role, duration, competition risk, and Reduce Motion behavior.

**Exercise 2: Functional triage (5 minutes)**

Review your list. Sort each animation into one of three buckets:

- **Load-bearing:** The user would be confused, disoriented, or uncertain without this animation. Keep it and make sure the duration is correct.
- **Earned polish:** The animation is not functionally necessary, but it contributes to the feeling of quality without competing with user attention. Keep it if the rest of the functional animations are working well.
- **Cut or defer:** The animation has no clear role, runs too long, or competes with user attention. Mark it for removal or deferral.

Write down at least one animation in each category if you have them. If all your animations fall into the first category, you have a well-restrained animation budget — that is a good sign.

**Exercise 3: Reduce Motion implementation (5 minutes)**

Open your SwiftUI code (or write pseudo-code if you are designing). For each load-bearing animation:

- Identify where the animation is applied in code.
- Add a check for `@Environment(\.accessibilityReduceMotion)`. If it is true, either substitute `.animation(nil)` (no animation) or replace a movement transition with `.opacity` (cross-fade only).
- Confirm that the state change still communicates correctly without the animation. Does the user still know what happened when the motion is removed?

For each earned-polish animation:

- Confirm that it is disabled when `reduceMotion` is true. Decorative animations should always be off for users who have requested reduced motion.

**Exercise 4: One animation to add (5 minutes)**

Identify one place in your flow where a load-bearing animation is currently missing — a navigation transition without any motion, a state change that happens abruptly, a loading operation with no indicator. For that missing animation:

- Write which Chevalier role it would serve.
- Write the target duration.
- Write the SwiftUI modifier or approach you would use: `.animation(.spring(response: 0.3, dampingFraction: 0.7))`, `withAnimation { }`, `.transition(.move(edge: .bottom))`, `ProgressView()`, or another appropriate component.
- Write what the `reduceMotion` fallback would be.

## 5. Key Takeaways

- **Animation is functional, not decorative.** The most evidenced roles for animation are orientation during navigation (Keeping in Context) and feedback during operations (making activity visible). Every other use — aesthetics, engagement, teaching — has weaker empirical support and should be added only with clear intent.

- **Animated transitions preserve spatial orientation.** When a navigation change animates rather than jumps, users understand the structure of the interface without any explicit instruction. The detail view came from the list; dismissing it returns to the list. This is the "nothing is lost" principle applied to navigation.

- **Animation's perceptual draw is involuntary and can harm UX.** Any animated element on a screen will compete for the user's attention whether they want it to or not. Never run an attention-drawing animation while the user is supposed to be doing something else.

- **Duration matters more than most designers realize.** Keep navigation transitions at 250–350ms and state-change animations at 100–200ms. Exceeding 400ms on routine transitions makes an app feel slow even when the underlying operation is instant.

- **Always respect Reduce Motion.** Check `@Environment(\.accessibilityReduceMotion)` and disable or reduce movement-based animations when it is true. Replace movement transitions with opacity cross-fades to preserve state-change communication without spatial motion. This is both an accessibility requirement and a consideration for users who experience motion sickness from screen animations. (Apple HIG — Platform standard)

# Chapter 13: Gestalt Principles — How the Eye Groups Things

*The visual grammar your users already know*

## 1. What This Is

Look at a well-designed settings screen — say, the Settings panel in Things 3 or the Preferences window in Raycast. Notice how controls feel like they belong together in little families. Appearance settings are clearly a group. Keyboard shortcuts are a group. Notifications are their own section. Now look at a poorly designed settings screen and notice how it feels like a pile — everything sitting at the same visual distance from everything else, labels floating near-ish to their fields but not confidently close, sections vaguely implied but never quite landing.

Here's the strange thing: both screens might contain exactly the same controls. Same text, same toggles, same buttons. But one reads as organized and the other reads as cluttered. Why?

The answer is that your brain is running a grouping algorithm in real time, before you've consciously processed a single label. It's asking: which things belong together? Which things are separate? Which thing is the foreground and which is the background? Your users' visual system answers these questions in milliseconds, without being asked, based on a set of perceptual rules first described in the 1920s by a group of German psychologists called the Gestalt school.

These rules are called the **Gestalt principles**. They are more than conventions designers simply agreed upon: they describe recurring tendencies in visual perception. Context, learned conventions, accessibility, and culture can still influence how a particular interface is interpreted. You can use these tendencies intentionally, or ignore them and risk groupings you did not intend.

This chapter gives you the names, the hierarchy, and the practical implications of the six most important Gestalt principles for UI design. By the end, you'll have a diagnostic vocabulary for asking "why does this screen feel scattered?" — and a toolkit for answering it.

## 2. What The Research Shows

### Proximity: the first and strongest grouping signal

The most powerful Gestalt principle is the simplest. Items that are physically close together are perceived as belonging together. Items that are physically far apart are perceived as separate. Your brain forms groups based on spatial distance before it processes any other visual feature — color, size, shape, or label.

This isn't a soft preference; it's a reflex. When you look at a row of buttons spaced 4 points apart, then a gap of 16 points, then three more buttons, your visual system has already grouped them before you read a single word. The gap is information. You encoded "two button groups" before your conscious brain said "navigation and actions."

The practical implication is that spacing is vocabulary. Every gap you leave between elements is a silent declaration about the relationship between them. A form where every field is equally spaced tells the brain that all fields are equally related — there is no structure beyond "list." A form where name and email are tight together, then a visible gap, then address fields are tight together reads as: "these two sections are conceptually separate." You created that meaning with nothing but space.

Robin Williams makes this explicit in *The Non-Designer's Design Book* (non-designers-design-book_extracted): "The basic purpose of proximity is to organize." Not to decorate, not to improve aesthetics — to organize. Proximity is the primary visual encoding mechanism for relationship. Everything else is secondary.

The Gestalt hierarchy, as synthesized by Jon Yablonski from Wendy Wong's *Design Basics*, ranks grouping signals from strongest to weakest: **enclosure \> connection \> proximity \> similarity**. An element inside a box is more strongly grouped than elements near each other. Elements connected by a line are more strongly grouped than elements that are merely close. Elements that are close are more strongly grouped than elements that share a color. This hierarchy gives you a decision ladder: use the most appropriate level of grouping strength for the relationship you're trying to convey.

Pause and predict: Open a screen you've recently designed or are thinking about designing. Without looking at the labels, can you read the grouping structure from the spacing alone? What do the gaps say?

### Similarity requires proximity to work

The research on similarity as a grouping signal includes a counterintuitive finding that has direct design implications. Similarity in visual appearance — same color, same shape, same size — does help users group related items. But it only helps when the similar items are also spatially close together. When similar items are spatially separated, the similarity benefit effectively disappears.

Daniel Peterson and Marcia Berryhill tested this directly using a visual working memory change-detection task. Participants viewed arrays of colored circles and had to remember them across a brief delay. In the critical condition, two identically-colored circles were placed adjacent to each other in the array. In comparison conditions, those same matching items were separated by one or two intervening items.

The results were stark. When matching circles were adjacent (neighbors, roughly 6 degrees apart), grouping by color significantly improved working memory performance — accuracy .74 vs. .65 in the control condition, and estimated working memory capacity 2.82 vs. 1.82 items. When the same matching circles were separated by even one intervening item (about 9 degrees apart), the benefit disappeared entirely. The condition with two intervening items also showed no benefit. The p-values for both separated conditions vs. control were above .30 — statistically indistinguishable from random.

The mechanism is encoding-level chunking. When similar proximate items are presented together, the brain prepackages them into a single memory unit — one "slot" in working memory instead of two. When those same items are separated, the chunking doesn't happen. They're encoded as individual items, with no memory benefit.

For UI design, the implication is precise: you cannot distribute similar-looking elements across a screen and expect users to perceive them as a category. Giving all interactive buttons the same blue color is a grouping signal — but only if those buttons are physically close together. If you scatter blue interactive elements across different zones of a screen, you're not encoding "these are all interactive"; you're just adding noise. Proximity-plus-similarity produces chunking. Similarity alone does not.

🔗 **Connect:** Think about how Raycast uses its design language. Every list item follows the same visual template. But because list items are spatially stacked, the similarity amplifies the proximity rather than working against it. Now think about a screen where buttons of the same color appear in the header, the middle, and the footer. Does that spatial distribution create a clear "interactive" category or confusion?

### The cognitive load multiplier

The Peterson study also showed that the benefit of Gestalt grouping grows with cognitive load. At small array sizes (3 items), the grouping benefit was negligible — near-ceiling performance made it hard to measure. At 4 items, grouped accuracy was .96 vs. ungrouped .82. At 6 items — the high-load condition — grouped accuracy was .90 vs. ungrouped .63. A 27-percentage-point gap between grouped and ungrouped conditions, at the exact moment when remembering items was hardest.

The design implication is where this gets particularly useful: Gestalt grouping matters most on dense screens, not sparse ones. If you have a settings screen with 4 options, the grouping is almost irrelevant — users can hold everything in mind anyway. If you have a settings screen with 16 options, a preferences panel with 30 controls, or a data-entry form with 12 fields, grouping becomes the primary mechanism keeping the cognitive load manageable. The more complex the screen, the more important it is to help the brain create chunks.

One important limitation to note: the Peterson study used n=23 undergraduate participants and artificial stimuli (colored circles). Effect sizes were very large (partial eta-squared values of .80+) partly because of the small within-subjects sample. The qualitative findings — that proximity is a prerequisite for similarity-based chunking, and that grouping matters more at higher cognitive loads — are well-grounded theoretically and consistent with broader Gestalt psychology. But the specific accuracy numbers should be treated as illustrative rather than precise estimates.

### The six principles in practice

The Gestalt principles that matter most for UI design are six, and they operate at different levels of a screen. Here's how to think about each one practically.

**Proximity** encodes relationship through space. Close = related. Far = separate. This principle is doing the heaviest lifting on almost every screen you'll build.

**Similarity** encodes category through shared visual features. Same color, size, or shape = same type of thing. The effectiveness of similarity is gated by proximity — it only works when similar items are also spatially near each other.

**Closure** is the brain's tendency to perceive complete shapes even from incomplete information. When you see a circle with a gap in it, you still perceive a circle. When you see a row of items with implied borders — a thin separator line that doesn't fully enclose them, or a subtle background color difference — your brain fills in the box and perceives a contained group. This is why card-style layouts work: you don't need a heavy border to create a sense of bounded content. A subtle background, a slight rounded corner, a shadow — these are enough to activate closure. The card implies an enclosure your eye completes. Think about how Things 3 groups tasks inside a project — each project area has a header and a subtle separation, and your brain perceives a contained section even though there is no heavy border.

**Continuity** is the tendency to follow implied lines and curves. Elements arranged along a line are perceived as belonging to the same sequence. A progress indicator works partly because of continuity: the dots or steps sit on an implied horizontal axis, and your eye reads them as a unified sequence. Form fields stacked vertically are perceived as a list with order. If one field is offset from the others — misaligned — the continuity breaks, and that field reads as separate, which may or may not be your intent.

**Figure/ground** is the distinction between foreground (the element you're looking at) and background (everything else). Every element on a screen is perceived as either figure or ground — nothing is neutral. Modals work by pushing everything behind them into the ground (dimmed background) so the modal itself is unambiguously figure. Popovers, sheets, and tooltips all rely on this principle. If figure/ground is ambiguous — if the content behind a modal is too visible, or if a floating card doesn't visually separate from the surface beneath it — users spend cognitive resources figuring out what they're supposed to be looking at. A subtle shadow, a backdrop blur, or a dimmed overlay is not decoration; it is a figure/ground declaration.

In SwiftUI, `.sheet()`, `.popover()`, and `.fullScreenCover()` implement figure/ground automatically through platform conventions. The system provides the backdrop; your content is the figure. Don't fight this by making your presented content transparent or overly subtle — commit to the separation.

**Common fate** is the principle that elements moving together are perceived as a group. In static UI, common fate is mostly dormant. In animated UI, it becomes significant. When you animate a group of items sliding in together, users perceive them as belonging together — even before they can read the labels. When you animate items departing at different speeds, users perceive them as separate. This is part of why list insertions and deletions in iOS feel coherent: items shift as a group, encoding "this is one list" through shared movement. It's also why staggered animations — each item appearing with a slight delay — can feel disorganized: if the stagger is too pronounced, the common fate signal weakens and users see individual items rather than a unified group.

🎯 **Apply:** Look at a screen in something you're building. For each group of related controls, ask: how is the grouping being communicated? Proximity? Similarity? Enclosure? Connection? Is the grouping signal strong enough to read without labels?

### The grouping hierarchy in action: enclosure beats proximity beats similarity

Understanding the hierarchy isn't just theoretical — it resolves real design decisions. When should you use a card vs. just tight spacing? When should you use a separator vs. just a gap?

Enclosure (a visible or implied container) is the strongest grouping signal. If you have a group of controls that are functionally distinct from everything else on the screen — a section with its own identity — enclosure is the right tool. Cards, bordered sections, background color blocks, rounded rectangles: these declare "this is a bounded unit" more strongly than any amount of tight spacing.

Connection (a visible line or border between items) is the next tier. It's weaker than enclosure but stronger than proximity. Separator lines in a list are connection signals: they don't enclose items, but they connect items into a linear sequence with clear boundaries. Think about how Settings in macOS uses grouped table views — items in a section are connected by being inside the same table, and sections are separated by spacing and headers.

Proximity comes next. It's the most versatile tool because it requires nothing extra — just space. But it can be undermined by competing enclosures or by insufficient contrast between "in-group" spacing and "between-group" spacing. If all your spacing ratios are too similar, the proximity signal gets muddy.

Similarity is the weakest grouping signal on its own, and it requires proximity to function as demonstrated by the Peterson research. Use it to reinforce proximity-based groups, not as a standalone grouping mechanism.

The practical rule: use the hierarchy level appropriate to the strength of the relationship you're conveying. Not every grouping needs a card. But a card is appropriate when you genuinely need to say "this is a distinct bounded unit." Overusing cards makes everything feel equally important; underusing them makes related controls feel scattered.

Tidwell and colleagues in *Designing Interfaces* (designing-interfaces_extracted) note that proximity is the primary mechanism behind form layouts and card groupings — but add that continuity (implied lines, aligned edges) supports the spatial structure that makes scanning efficient. These principles don't operate in isolation; they reinforce each other.

## 3. How To Use This

### Gestalt as a diagnostic tool

Before using Gestalt to design from scratch, learn to use it as a diagnostic tool. When a screen feels "off" but you can't articulate why, Gestalt violations are usually the answer. Here's the diagnostic sequence:

Take the screen you're evaluating and squint at it or step back from it until you can't read any text. Now look only at the spatial structure. Which things cluster together? Which things feel isolated? Which things have implied boxes around them?

Now ask: do those implied clusters match the actual logical structure of the content? If the spacing clusters Navigation \> Action Buttons \> Content \> Footer as four distinct regions, does that match what you intend? If the spacing clusters "Search Field" with "Sort Controls" just because they happen to be near each other — but they're logically unrelated — you have a proximity false alarm.

The most common Gestalt failure in practice is uniform spacing: every element separated by the same amount of space, creating no grouping signal at all. The screen reads as a pile. The cure is almost always to introduce clear spacing ratios — tight within groups, loose between groups. Chapter 6 (06-layout-and-spacing) covers the mechanics of building a spacing system; Gestalt gives you the reason why that system needs to exist.

### The Quick-Start Protocol

When laying out a new screen, work through these steps in sequence:

1.  **List the logical groups first, before placing anything.** On a settings screen, list the conceptual sections. On a form, list the question clusters. On a detail view, list the content zones (identity, actions, metadata, related content). Write them down.

2.  **Decide the strongest grouping signal for each group.** Ask: does this group need a container (card/bordered section) because it's a distinct unit? Or can tight spacing handle the grouping? Use the hierarchy: enclosure \> connection \> proximity \> similarity. Only escalate to the stronger signal if the weaker one isn't sufficient.

3.  **Set your spacing ratios deliberately.** Choose your within-group spacing and your between-group spacing, and make sure the ratio is large enough to read without labels. A 2:1 ratio (e.g., 8pt within a group, 16pt between groups) is a minimum. A 3:1 or 4:1 ratio (e.g., 6pt within, 24pt between) is often cleaner. In SwiftUI, `VStack(spacing: 6)` inside a section and `VStack(spacing: 24)` between sections gives you this ratio structurally.

4.  **Apply similarity to reinforce, not to replace, proximity.** Color-code or style-code your groups only after proximity already groups them spatially. Using the same icon style for all navigation items reinforces their visual category because they're already spatially grouped as a nav bar. Using the same color for items scattered across the screen reinforces nothing.

5.  **Check the figure/ground hierarchy.** Anything modal, popover, sheet, or floating tooltip should have a clear visual separation from the content beneath it. This is handled automatically by platform conventions on iOS and macOS, so don't fight those conventions — they're doing Gestalt work for you.

### Decision Tree: which grouping tool for which situation?

**If you need to say "these are a distinct, self-contained unit"** — use enclosure: a card, a bordered section, a background fill. The group has an identity.

**If you need to say "these are steps in a sequence or items in a list"** — use connection: separator lines, a shared background, a unified table view. The group has order.

**If you need to say "these controls relate to each other more than to other controls"** — use proximity: tight spacing within the group, clear gaps between groups. The relationship is local.

**If you need to reinforce an existing group's category membership** — use similarity: same color, same icon weight, same typographic style. But only after the other grouping mechanism is already working.

**If the grouping involves animation or motion** — use common fate: animate related elements with the same timing and direction. If items belong to different groups, animate them with different timing.

### The Wimp Problem in Gestalt terms

The Wimp Problem from 05-visual-hierarchy — the tendency to use slight differences that register as mistakes rather than decisions — applies directly to Gestalt grouping. The most common form is mild spacing differences that don't clearly encode a grouping structure.

If your within-group spacing is 8pt and your between-group spacing is 10pt, users don't perceive two levels of hierarchy. They perceive vague visual inconsistency. The gap needs to be bold enough to be read as intentional. When in doubt, make your between-group spacing dramatically larger than your within-group spacing — not slightly larger. Commit to the difference.

The same applies to figure/ground. If your modal backdrop is 30% opacity instead of 60%, the figure/ground distinction gets muddy. Don't be timid about visual separation; commit to it.

### Implementation notes

In **SwiftUI**, the primary tools for Gestalt-aware layout are `VStack` and `HStack` with explicit spacing values, `Section` inside `List` or `Form` views, and `.background(Color.systemGroupedBackground)` for creating implicit enclosure on grouped sections. SwiftUI's `Form` view implements the iOS Inset Grouped table style by default, which applies enclosure through the rounded card containers — a correct Gestalt choice for settings and forms.

In **React/Raycast**, the Raycast component library uses a `List` with `List.Section` for grouping, which creates a header label and visual separation between sections. This is the correct grouping mechanism for Raycast extensions — use `List.Section` whenever your items logically group into categories, even if the category only has a few items.

For **macOS sidebar navigation**, the `.sidebar` list style in SwiftUI creates the standard macOS two-column layout where the left pane uses proximity and similarity (same cell style for all items) to encode "same navigation level," while section headers and grouping encode category structure.

## 4. Practice Lab

This lab has two exercises: a diagnostic exercise and a layout exercise. Complete them in order. Budget about 20–30 minutes total.

**Exercise 1: Gestalt Audit**

Pick a screen from something you're currently building, or screenshot any settings or form screen from an app on your Mac or iPhone.

- Look at the screen without reading the labels. Just observe the spatial structure. Roughly sketch or describe where the implied clusters are — which things are spatially grouped together?
- Now read the labels. Does the spatial clustering match the logical structure of the content? List any mismatches: things that are spatially close but logically unrelated, or things that are logically related but spatially separated.
- Identify the strongest grouping signal being used on each major group. Is it enclosure? Connection? Proximity? Similarity? Write it down.
- Find one place where the grouping signal is too weak — where the spacing difference between "in-group" and "between-group" is less than 2:1. Note it.
- Find one place where a grouping signal is stronger than necessary — a card used where tight spacing would do. Note it.

**Exercise 2: Layout from Gestalt**

Take a screen you're designing (or plan to design) that has at least 8–10 elements that belong in at least 3 logical groups.

- Write out the logical groups before touching the layout. Name each group. List what belongs in each group.
- Assign a grouping tool to each group using the hierarchy: enclosure for the most distinct units, proximity for looser groupings.
- Set your spacing values. Within each group, pick a tight spacing value. Between groups, pick a value that is at least 2.5x the within-group value. Write these down.
- Sketch or build the layout. Don't add labels yet. Does the spatial structure alone communicate the grouping?
- Add labels and evaluate: do the proximity clusters still match the logical structure? If not, identify what to move.
- Check figure/ground: is anything meant to float or overlay? Does it have sufficient visual separation from the surface beneath it?

**Scoring rubric:**

Your layout is Gestalt-compliant if you can show it to someone at arm's length (squinting, labels unreadable) and they can correctly identify the number of logical groups and which items belong together. Test this with one other person if possible. If they identify the same clusters you intended, your proximity signals are working. If they misread clusters, you have a spacing ratio problem.

## 5. Key Takeaways

- **Proximity is the primary grouping signal.** Spacing encodes relationship. Every gap between elements is a declaration about whether those elements belong together. Uniform spacing means no structure. (Practitioner consensus from non-designers-design-book_extracted, laws-of-ux_extracted)

- **The Gestalt grouping hierarchy is enclosure \> connection \> proximity \> similarity.** Use the level of grouping appropriate to the strength of the relationship. Cards are for distinct bounded units; tight spacing is for loose local relationships. (strongly supported via Gestalt psychology; synthesized in laws-of-ux_extracted)

- **Similarity requires proximity to produce cognitive benefits.** Color-coding a category only helps users group items when those items are also spatially close together. Scattered same-colored items don't encode a useful category — they add noise.

- **Grouping matters most under cognitive load.** On dense screens — settings, forms, data tables — Gestalt structure is the primary mechanism for keeping the screen manageable. On sparse screens, grouping matters less because users can hold everything in working memory anyway.

- **Figure/ground separation is functional, not aesthetic.** Modals, popovers, sheets, and tooltips depend on clear foreground/background distinction. Platform conventions implement this automatically — follow them rather than fighting them. (strongly supported; practitioner consensus from designing-interfaces_extracted)

# Chapter 14: Defaults & Onboarding — The First Run Experience

*The most underdesigned screen in most apps*

## 1. What This Is

There's a moment every app builder dreads in a different way than users do: the moment the app launches for the very first time. For you, that moment is exciting — the thing works, it loads, you see your creation. For a new user, that moment is judgment. They are asking a handful of questions in rapid succession: What is this? What do I do now? Is this what I expected? Can I figure this out?

Most apps treat first launch as an afterthought. The empty state shows an unhelpful blank slate. The default settings are whatever was easiest to hardcode. The onboarding either asks ten questions before showing anything or asks none and dumps the user into a screen they don't understand. The experience of "first run" falls through the cracks between "building the feature" and "it works."

This is a significant mistake, because product first impressions are fast, can be sticky, and shape what follows. More concretely, one design decision can exert an unusually large influence on user behavior — and it is not the visual design, the onboarding flow, or the marketing copy. It is the **default**: the state your app is in before the user touches anything.

This chapter explains why defaults are so powerful, how to make the first-run experience actually work for new users, and how to design empty states that invite action rather than signal failure. If you've been treating your initial app state as "we'll fill it in with real content eventually," this chapter will reframe that completely.

## 2. What The Research Shows

### Defaults are the single most leveraged design decision you have

A meta-analysis by Jon Jachimowicz and colleagues pooled 58 datasets from 55 studies covering 73,675 participants to answer a simple question: how much does the default option affect what people choose? The answer: d=0.68 on average, with a corresponding absolute uptake shift of about 27 percentage points in binary-choice studies.

To understand what that means in practice: if you ship a feature with an opt-in default (users must actively turn it on), you might see 30% adoption. If you ship the same feature with an opt-out default (it's on by default, users can turn it off), you might see 57% adoption. Same feature, same users, same moment in time — just a different starting position. The default itself is doing more work than your marketing copy, your onboarding explanation, or your feature design.

For context, the default effect at d=0.68 is substantially larger than healthy eating nudges (d=0.23), social norm energy interventions (d=0.32), or framing effects on risky choice (d=0.31), according to the same paper's benchmarking. Defaults are one of the strongest behavioral interventions studied in choice architecture.

Two important caveats before you run with that number. First, heterogeneity in this meta-analysis is extreme — I²=98%, meaning the effect varies enormously across contexts. The headline d=0.68 is an average across domains where some defaults produced enormous effects and some produced none. Second, the inflation flag on this literature suggests a practical correction: if the meta-analytic average is d=0.68, expect real-world app defaults to produce somewhat smaller effects than the most dramatic historical examples (organ donation consent rates, retirement savings). A practical working estimate for consumer app contexts is d=0.40–0.60 — still substantial, and likely on the higher end because consumer domains show larger default effects (b=0.73 advantage in the Jachimowicz model).

The direction of the effect is unambiguous even when the magnitude varies. Defaults exert real, consistent influence on behavior. They are never neutral.

Pause and predict: Think of a toggle in your app that users probably want but might not discover. What's your current default? What would you expect to happen to adoption if you flipped it?

### Three mechanisms that make defaults so sticky

Knowing that defaults work is useful. Understanding *why* they work is more useful — because it tells you which defaults will be most effective and which might backfire.

Eric Johnson and Daniel Goldstein proposed three mechanisms based on their research comparing organ donation consent rates across countries with opt-in vs. opt-out defaults, combined with online experiments. The Jachimowicz meta-analysis found empirical support for two of the three.

**Implicit endorsement.** Users interpret the default as a recommendation from whoever set it. If the app ships with notifications enabled, users implicitly read: "the people who built this think notifications are the right call." This is the mechanism behind why defaults feel different from a neutral blank state — they carry an implicit signal of authority and relevance. The Jachimowicz analysis found endorsement to be a significant moderator of the default effect (b=0.32, p=0.038): defaults that more clearly signal "this is what we recommend" produce larger effects.

**Loss aversion.** Once a user sees the app in its default state, that state becomes the reference point. Changing it feels like a loss — even if "changing it" just means turning a toggle on or off. The status quo is cognitively privileged. This is the same psychological mechanism that makes people hold onto stocks they should sell, stay in jobs they should leave, and keep cable plans they rarely use. The endowment effect in the Jachimowicz analysis was also a significant moderator (b=0.31, p=0.044): when users perceive the default as "already theirs," the effect strengthens.

**Effort asymmetry.** Accepting the default requires no action. Changing it requires opening settings, finding the right control, understanding what it does, and actively overriding the system's stated preference. Even when this effort is trivially small — a single tap — it functions as friction that many users won't bother to generate. Johnson & Goldstein's online experiment showed that opt-out defaults produced ~2x higher consent rates than opt-in even when users could change the setting with a single mouse click, suggesting that pure effort isn't the whole story. But effort compounds with the other mechanisms: when endorsement and loss aversion are also active, even small effort asymmetries push strongly toward the default.

Interestingly, the Jachimowicz analysis found that ease (operationalized as how easy it was to change the default) was *not* a significant moderator in the meta-analytic corpus (b=-0.05, p=0.75). The authors note this is likely because ease was under-manipulated in lab studies — real-world applications with higher friction (like requiring a notarized form to opt out of organ donation) would likely show larger ease effects. For consumer app design, the practical lesson is: don't over-rely on the "it's easy to change" justification for a default you know users should actively decide about. The endorsement and endowment mechanisms are more powerful than convenience, and they operate even when changing is trivially easy.

One ethical note worth stating plainly: these mechanisms work whether or not you're using them in users' interests. The same default effect that helps users discover a feature they'll love also drives patterns like auto-enrollment in recurring subscriptions. This guidebook treats defaults as a tool to serve users well, not to exploit inattention. Jachimowicz and colleagues are explicit that defaults with perceived endorsement and clear benefit to the user produce the strongest effects — which neatly aligns using defaults ethically with using them effectively.

🔗 **Connect:** Think about Raycast's default behavior when you first install it. It opens with a command palette, no setup required, a few sample commands populated. That's a default state: Raycast has decided what the first-run experience looks like. Does that default feel like an endorsement? Does it orient you, or leave you confused?

🎯 **Apply:** List every toggle or setting in your current app. For each one, write the default value and a one-sentence reason it is the right choice for the majority of your users. If you cannot write the reason, that default was not a deliberate decision — fix it before shipping.

### The consumer context amplification

Jachimowicz et al. found that default effects are significantly stronger in consumer domains (b=0.73, p=0.003) than in environmental domains. The proposed mechanism is preference strength: when users have weakly formed preferences — when they genuinely don't know or don't care what the "right" setting is — they defer to the default more heavily. Consumer apps sit squarely in this territory. New users of your iOS task manager, Raycast extension, or macOS utility often have no strong preference for the initial configuration. They haven't formed opinions yet. The default is filling a vacuum.

This is reassuring and cautionary at the same time. Reassuring because it means your defaults will have real influence on how users experience the app. Cautionary because it means poorly chosen defaults — ones that don't serve the majority of users well — will also have real influence, in the wrong direction. The asymmetry matters: it's easier for a bad default to frustrate users than for a good default to delight them, because users notice friction more sharply than they notice things going smoothly.

### Empty states are not error states

As we covered in 10-feedback-and-system-status, empty states are one of the four feedback states every screen needs. Here, the connection is specific: the empty state is your best onboarding vehicle, because it appears at the exact moment a new user is most attentive.

*Designing Interfaces* (designing-interfaces_extracted) provides a useful reframe: an empty state is not an absence of content — it is a special kind of content. It's an invitation. The user is in a moment of potential: they've opened the app, they haven't done anything, and the app has a brief window to show them what's possible and what to do next.

An effective empty state has three parts. It shows what the screen will look like when it has data — giving users a mental model of what they're working toward. It tells them what action will change the state — specifically, not generally. ("Add your first project" is better than "Get started.") And it reduces the activation energy for that first action — putting the call-to-action in the most prominent position on the screen, not buried in a nav bar or behind a menu.

Think about how Things 3 handles a new project list. There's no blank void; there's a subtle prompt that makes the empty container feel ready to receive content. Compare that to an app that shows an empty scroll view with no context — users see nothing and sometimes wonder if the app loaded incorrectly.

The empty state is also your best onboarding opportunity, because the user is maximally attentive at this moment. They have no existing mental model to override. They are ready to learn. The content you put in that empty state — the guidance, the example, the first action — will be read more carefully than anything in a traditional onboarding flow, because it appears at the exact moment the user is motivated to do something.

### Progressive onboarding: defer, don't eliminate

The standard advice to "keep onboarding short" is correct but incomplete. The right framing is: **defer non-essential decisions, don't eliminate them**. Configuration that doesn't affect the first 10 minutes of app use should not appear during onboarding.

Krug's analysis in *Don't Make Me Think* (dont-make-me-think_extracted) is useful here: users want instant gratification. Every question you ask at first launch is a question that delays the moment they get value from the app. That delay has a cost in abandonment — some users simply won't complete the setup. The threshold is low; even two or three extra screens of onboarding reduces conversion meaningfully.

Sensible defaults eliminate this friction. Instead of asking "how often should we remind you?", pick a sensible reminder cadence and let users change it in settings. Instead of asking "what's your preferred theme?", launch in the system default (light mode / dark mode following the OS setting). Instead of asking "what categories do you want?", ship with a good starting set that covers common use cases.

The rule of thumb: if you can make a reasonable choice on behalf of the majority of users, make it. If you genuinely cannot — if the choice fundamentally determines how the app will work for that user and getting it wrong would create real friction — then ask, but only then. Most onboarding questions fail this test.

When choices must be deferred rather than pre-decided, the right vehicle is **progressive disclosure**: surface the configuration option in context, at the moment the user actually encounters the thing being configured. If a user navigates to the notifications section for the first time, that's the right moment to ask about notification preferences — not at first launch, before they've used the app for a single minute.

## 3. How To Use This

### Defaults as the first design decision, not the last

Most apps are designed from the inside out: you build the feature, then decide what the defaults are as a final step before shipping. The research suggests inverting this. Start every feature design by asking: what is the best default state for the majority of users? That question often reveals design decisions that were hidden.

If you're building a daily digest feature and you can't decide what the default schedule should be, that's a product question: what do most users actually want? If you ship daily at 8am as the default and most users would prefer weekly, your default is actively creating a bad experience for them. The Jachimowicz finding on preference strength implies that users in low-preference domains will stick with whatever you give them — which means a bad default isn't just suboptimal, it's persistent.

Before shipping any new feature with a configurable component, ask: if this user never opens Settings, what experience have I given them? Is that the best possible default for the person most likely to use this feature?

### Quick-Start Protocol

1.  **Audit your current defaults.** List every toggle, setting, or pre-selected option in your app. For each one, write down who the majority user is and whether the default serves them. Any default that fails this test is worth reconsidering.

2.  **Design the empty state as content, not absence.** For every list, dashboard, or feed in your app, sketch what it looks like when it has no data. Does it show what the screen will contain? Does it have a clear, specific first action? Is that action the most prominent element on the screen?

3.  **Strip your onboarding to the minimum essential decisions.** List every question your current onboarding asks. For each question, ask: can I make a good default choice and defer this to Settings? If yes, remove the question. Only keep questions where the answer fundamentally determines the app's behavior in the first session.

4.  **Set your first-run default state as a deliberate design decision.** The state your app is in on first launch is your onboarding. It should reflect considered choices, not whatever was easiest to hardcode. In SwiftUI, `@AppStorage` with explicit default values lets you set this cleanly — every stored preference should have a documented default that you've chosen intentionally.

5.  **Test the first-run experience as a distinct user scenario.** Delete your app, reinstall it, and go through the first-run experience with fresh eyes. Where did you feel confused? Where did you feel like the app expected knowledge you didn't have yet? Those moments are your onboarding failures.

### Decision Tree: what to configure at setup vs. what to defer

**If the answer affects what the user sees in the first 5 minutes of using the app** — ask during onboarding or show a quick setup flow. This is rare. An example: a workout app asking "are you a beginner, intermediate, or advanced runner?" genuinely changes the recommended workouts shown immediately.

**If the answer could be reasonably pre-decided for 80% of users** — ship a sensible default. Allow override in Settings. Example: notification timing, theme, default view mode.

**If the answer involves a personal preference with no "majority correct" answer** — ship a default that's safe and neutral (e.g., system font, system colors, system appearance), then surface the configuration option in context the first time the user would care about it.

**If the answer involves data or content the user needs to provide** — this is not a default question, it's an empty state question. Design the empty state to guide that first data entry moment.

### Empty state design checklist

When designing any empty state in your app, verify the following:

Does the screen show what it will look like when populated? (Preview, illustration, or example content.) Does it include a specific, labeled first action? ("Create your first project" not "Get started.") Is that action visually prominent — not just a small link, but a real button or call-to-action? Does the screen avoid making users feel like something went wrong? (No error-style messaging, no apologetic tone.) Is the path from empty state to first data entry as short as possible — ideally one tap?

In SwiftUI, the `ContentUnavailableView` component (iOS 17+, macOS 14+) provides a structured way to build empty states with title, description, and action. Using it correctly gets you appropriate visual hierarchy and system-consistent styling automatically.

### Implementation notes

In **SwiftUI**, use `@AppStorage(key, store: UserDefaults.standard)` with explicit default values for every user preference. Document those defaults — don't let them be implicit. A comment like `// Default: daily at 8am, chosen for general productivity use case` is worth 30 seconds to write and saves confusion when you revisit the code six months later.

For onboarding flows in **iOS**, consider whether to use a presented sheet (`sheet(isPresented:)`) or an `onboarding view` that's shown conditionally based on a first-launch flag stored in `UserDefaults`. The latter integrates more naturally with the app's existing navigation structure rather than feeling like a separate mode.

For **Raycast extensions**, the extension's default preferences (set in the manifest) are the primary defaults mechanism. Set meaningful defaults for every extension preference — Raycast users frequently install extensions and use them immediately without reading documentation.

## 4. Practice Lab

This lab focuses on auditing and redesigning one first-run experience. Budget 25–35 minutes.

**Part 1: The First-Run Audit**

Pick one app you've built or are actively building. Delete and reinstall it (or use a simulator with a fresh state) to experience the first-run flow.

- Note the first 5 things you see or are asked to do. Write them down.
- For each element, classify it: is this a default state (already decided for me), a required input (I must provide this before proceeding), or an optional configuration (I'm being asked to set a preference)?
- Identify any required inputs that could be replaced by a sensible default. Write down what that default would be.
- Identify any empty states that appear during the first-run experience. Do they have a clear first action? Do they explain what the screen will contain when populated?
- Rate the overall first-run experience on a 1–5 scale: 1 = I would have quit, 5 = I understood exactly what to do and did it. Be honest.

**Part 2: Redesigning One Default**

Pick one setting or configurable behavior in your app that currently has a default you haven't actively thought about.

- Write down the current default value.
- Ask: who is the majority user of this app? What would they want? Is the current default what they would want?
- If the answer is no, or if you're genuinely uncertain, write down three candidate default values and argue for each one. Pick the strongest argument and change the default.
- Write a one-sentence comment in your code explaining why that default was chosen.

**Part 3: Empty State Mockup**

Pick the most important list or data view in your app. In a notes app, a sketch tool, or just paper — design the empty state for that screen.

- Include a descriptive title (what this screen is for, not "No items yet").
- Include a short description of what will appear here when populated.
- Include a single, prominent, verb-labeled action button ("Create your first project," not "Add," not "Get started").
- Optional but valuable: include a simple illustration or icon that represents the kind of content that will live here.

Show your empty state design to one person who hasn't seen your app. Ask them: "What would you do on this screen?" If they can answer correctly without explanation, your empty state is working.

## 5. Key Takeaways

- **Defaults are the highest-leverage single design decision you can make.** Across 58 datasets, opt-out defaults shifted uptake by d=0.68 on average and roughly 27 percentage points in binary outcomes. Consumer app contexts are likely in the higher-effect range.

- **Three mechanisms drive default stickiness: implicit endorsement, loss aversion, and effort asymmetry.** Endorsement and endowment are empirically validated moderators; ease is theoretically important but under-manipulated in research. In practice, all three are likely active in app contexts.

- **Heterogeneity is extremely high (I²=98%) — the direction of the effect is unambiguous but the magnitude depends heavily on context.** Plan for real effects; don't extrapolate exact percentages.

- **Empty states are onboarding moments, not error states.** The most effective empty state shows what the screen will contain, names a specific first action, and makes that action the most prominent element. (Practitioner consensus from designing-interfaces_extracted)

- **Defer non-essential configuration; pre-decide everything you can reasonably choose on users' behalf.** Every setup question that can be answered with a sensible default should be answered with one. Ask during onboarding only when the user's answer fundamentally shapes the first-session experience. (Practitioner consensus from dont-make-me-think_extracted, designing-interfaces_extracted)

# Chapter 15: The Self-Audit — Evaluating Your Own Design Before Shipping

*Nielsen's 10 heuristics as a personal design review framework*

## 1. What This Is

You've built something. It runs. The features work. You're about to ship it. And somewhere in the back of your mind is the question you've been half-avoiding: is this actually good? Not "does it compile" or "does the API call succeed" — those you can test mechanically. But: will a real person pick this up and understand what to do? Will they get stuck? Will they feel confused, or frustrated, or lost?

Most builders answer this question by launching and waiting for complaints. That's one approach, but it has a failure mode: users rarely complain about the specific design problem that caused them to abandon your app. They just leave. Or they leave a one-star review that says "confusing" without further detail. The problem was real, but the feedback was too late and too vague to act on.

The alternative is a **design audit**: a structured review of your own interface against a known set of usability principles, conducted before you ship. Not after.

Heuristic evaluation — using a short list of principles to systematically identify problems — was developed and studied empirically by Jakob Nielsen and Rolf Molich starting in 1990. It was specifically designed as a method that didn't require user testing: you could do it yourself, with the right framework, and catch the majority of serious usability issues before any user ever touched the product.

This chapter gives you that framework. By the end, you'll have a vocabulary for every major category of usability failure, an understanding of which categories are most likely to produce serious problems, and a practical protocol for running a pre-ship audit of your own work. It also serves as the conceptual foundation for three appendices: **Appendix G** (the operational Pre-Ship Checklist, where these heuristics become concrete checkboxes), **Appendix H** (Anti-Patterns, organized by heuristic), and **Appendix B** (Claims Excluded, which covers UX myths worth stopping believing before your audit).

## 2. What The Research Shows

### Nine heuristics explain most usability problems

In 1994, Jakob Nielsen published a study that took 249 real usability problems from 11 of his own prior projects — a mix of character-based interfaces, graphical UIs, and telephone interfaces — and analyzed how well different heuristic sets explained those problems.

The analysis was a coverage exercise: which heuristics, applied during evaluation, would have caught the highest proportion of problems? Using factor analysis of a rating matrix and greedy optimization, Nielsen derived a nine-item heuristic set (later expanded to ten with the addition of "help and documentation") that explained the large majority of the problem database.

The ten heuristics are:

1.  **Visibility of system status** — always keep users informed about what is happening, with appropriate feedback in reasonable time.
2.  **Match between system and the real world** — speak the user's language, not system language. Use words, phrases, and concepts familiar to the user.
3.  **User control and freedom** — support undo and redo. Users often choose actions by mistake; they need a clearly marked "emergency exit."
4.  **Consistency and standards** — users should not have to wonder whether different words, situations, or actions mean the same thing. Follow platform conventions.
5.  **Error prevention** — even better than good error messages is a design that prevents problems from occurring in the first place.
6.  **Recognition rather than recall** — minimize the user's memory load. Options, actions, and objects should be visible or easily retrievable.
7.  **Flexibility and efficiency of use** — accelerators for experienced users; beginners can ignore them. Allow frequent actions to be personalized or shortcutted.
8.  **Aesthetic and minimalist design** — dialogues should not contain irrelevant or rarely needed information. Every extra unit of information competes with and dilutes relevant information.
9.  **Help users recognize, diagnose, and recover from errors** — error messages should be in plain language, precisely indicate the problem, and constructively suggest a solution.
10. **Help and documentation** — even though it is better if the system can be used without documentation, it may be necessary. Any such information should be easy to search, focused on the user's task.

These are not arbitrary conventions. They were empirically derived from a database of real usability failures. Each heuristic corresponds to a factor-analytic cluster in the problem database — a distinct phenomenon that causes interfaces to fail in recognizably similar ways.

It's worth noting the main limitation of Nielsen's derivation study: single rater, no inter-rater reliability, and a problem database drawn from the author's own prior projects evaluated with earlier versions of the same heuristics. This is a circular validation. The heuristics have since been applied in thousands of usability studies, and their practical utility is strongly supported across the literature — but their empirical derivation should be understood as a careful observation, not a controlled experiment.

### The top four explain 65% of all problems

The finding with the most immediate practical value is the coverage concentration. The four heuristics with the widest explanatory reach — **consistency and standards, match between system and real world, visibility of system status (feedback), and aesthetic and minimalist design** — together explain approximately 65% of all 249 usability problems in the database. For the 82 serious problems, the top four explain approximately 70%.

This has a direct implication for self-audit prioritization. You don't need to achieve perfect coverage across all ten heuristics to catch most of the issues that will materially affect users. If you do a thorough job on these four, you've addressed the dominant failure modes. The remaining six heuristics catch real problems too — particularly in specific contexts — but the asymmetry is large enough to be actionable.

In practice, consistency failures (heuristic 4) are almost universally the first problem visible on a screen built by a solo developer without a formal design system. Labels that say slightly different things in different places. Icon weights that aren't consistent across the interface. Primary buttons styled differently on two adjacent screens. These feel like minor details, but they signal to users that the interface was assembled rather than designed, which erodes trust and forces them to re-examine familiar elements instead of relying on pattern recognition.

Pause and predict: Think of the last screen you built. Go through it looking only for consistency violations — labels that say the same thing but look different, or buttons at different sizes across similar screens. How many do you find?

### Individual evaluators catch 20–51% of problems

The 1990 Nielsen and Molich study on heuristic evaluation methodology tested individual evaluators across four experiments. Average problem-detection rates ranged from 51% in the easiest experiment down to 20% in the hardest. The best individual evaluators in any single experiment caught around 60–80% of known problems; the worst caught nearly nothing.

For a solo developer doing a self-audit, this means you will not catch everything. You will miss some problems — particularly ones invisible to someone who built the interface and therefore cannot approach it without prior knowledge of how it works. That is the nature of self-evaluation, and it's a genuine limitation.

But it is not a reason to skip the audit. Even at 20–30% detection for the hardest cases, that means finding a substantial fraction of the real problems in your interface before any user encounters them. The 1990 data showed that aggregating 3–5 independent evaluators captured roughly 60–75% of problems — which is why the paper recommends using multiple evaluators. For a solo developer, getting even one other person to walk through your interface independently before launch dramatically improves coverage. This is the "three users per month" argument Krug makes in *Don't Make Me Think* (dont-make-me-think_extracted): even minimal external evaluation beats zero external evaluation.

The independence principle matters: evaluators should work independently before comparing results. If you walk someone through your interface while they evaluate it, you anchor their attention and inadvertently suppress the variety of problems they'd find. Show them the product and let them explore.

### The penalty runs in both directions

Earlier in this guidebook (01-functional-case-for-design), we covered the aesthetic-usability effect: beautiful interfaces are perceived as more usable. Chapter 15 is an appropriate place to revisit the boundary condition from the same research.

Tuch and colleagues found that severe usability problems don't just fail to benefit from aesthetic polish — they actively lower aesthetic ratings. The mechanism is affective contamination: users frustrated by broken navigation experience negative emotions, and those negative emotions color how they perceive the visual design. Specifically, the "clean" and "organized" dimensions of aesthetic judgment were most susceptible — the exact qualities associated with classical aesthetics and perceived usability.

The effect size for usability's impact on classical aesthetics was eta²=.076 (medium effect, p=.015) — meaningful by conventional standards. In practical terms: if your app has genuinely broken or confusing flows, users will perceive your visual design as less clean and less organized, even if you've invested real effort in the visual layer.

This is the reversal of the halo effect working against you: just as a polished visual design makes usability problems feel smaller, a broken usability experience makes visual polish feel inadequate. The self-audit is therefore not just a usability exercise — it's a quality signal that affects how users perceive everything else about your product.

The audit and the visual polish work together. Do the audit first.

🔗 **Connect:** Think about an app you've used that felt visually polished but was confusing to navigate. At what point did the navigation confusion start to taint how you felt about the visual design? When did you stop giving it the benefit of the doubt?

### Heuristic evaluation as a solo practice

The 1990 Nielsen and Molich study was designed with multiple evaluators in mind. But the method scales to solo use. Nielsen himself has written extensively about "discount usability" — the idea that meaningful usability insight is achievable with minimal resources. A single evaluator running a structured heuristic review in 30–60 minutes will not achieve the coverage of a professional evaluation team, but will reliably surface the majority of the most visible, most severe problems.

The key to making solo heuristic evaluation work is structure. Going through an interface "looking for problems" without a framework is essentially random. Going through it heuristic by heuristic — asking, for each screen: "Does this screen keep users informed? Does it use their language? Are their mistakes recoverable? Is it consistent with the rest of the app?" — imposes a systematic search that dramatically improves yield.

The goal is not to find every problem. The goal is to find the problems serious enough to prevent task completion or destroy trust, before a user encounters them. That goal is achievable with a careful solo pass.

## 3. How To Use This

### The pre-ship audit protocol

This is the structured self-audit procedure. Run through it before every significant release. Budget 45–90 minutes for a mature feature or screen, 20–30 minutes for a small addition.

**Step 1: Preparation.** Write down the primary tasks a user is expected to accomplish in this feature or screen. You need at least 2–3 representative tasks. "Browse the list" is a task. "Add a new item" is a task. "Change a setting" is a task. "Recover from an error" is a task. These become your audit scenarios.

**Step 2: Heuristic walkthrough.** Open the screen or flow. For each of the 10 heuristics (in order), go through the feature and look specifically for violations. Don't try to evaluate all heuristics simultaneously — go through once per heuristic, focusing only on that principle. Note every potential violation, even ones that seem minor.

**Step 3: Prioritize by severity.** Not all violations are equal. For each problem you found, estimate: would this prevent task completion (critical)? Would it cause significant confusion or a noticeable delay (serious)? Would it create mild friction (minor)? Fix critical and serious issues before shipping. Defer minor ones to the next release if necessary.

**Step 4: Get one external review.** After your own pass, have one other person use the feature without guidance. Watch without helping. The problems they hit that you didn't find are the ones your familiarity blinded you to.

**Step 5: Use Appendix G.** The Appendix-G-PreShip-Checklist translates this framework into a concrete checkbox list organized by platform (iOS, macOS, Raycast). Run the checklist after the heuristic walkthrough — it catches specific platform conventions and patterns that the high-level heuristics don't address explicitly.

### Heuristics applied to each platform

The heuristics are platform-agnostic, but their most common violations vary by platform. Here's where to focus attention for each of your primary build contexts.

**iOS:** The highest-frequency violation is \#6 (recognition rather than recall) — gesture-based actions that are powerful but invisible. Swipe to delete, pull-to-refresh, long-press context menus: these are invisible affordances in iOS. If any of your primary actions require gestures that aren't hinted at visually, you have a recognition/recall violation. Heuristic \#4 (consistency) is the second most common problem: using a non-standard navigation pattern (back button in the wrong place, sheet when a push would be expected) breaks users' mental models built from years of iOS app usage.

**macOS:** The highest-frequency violations involve \#4 (consistency with standards) and \#3 (user control and freedom). macOS users have strong expectations about keyboard shortcuts (`Cmd+Z` for undo, `Cmd+W` to close a window, `Escape` to cancel). If your app intercepts these keys or doesn't implement them, you've violated the consistency heuristic. Control and freedom violations on macOS often look like modality without escape: a modal dialog with no cancel button, a sheet with no way to dismiss it, a window state with no undo path.

**Raycast:** The dominant heuristics are \#5 (error prevention) and \#2 (match between system and real world). Raycast users are keyboard-first and context-heavy: they run commands at speed, often on top of other work, and mistakes are jarring. Error prevention means clear confirmation on destructive actions and no easy-to-trigger irreversible operations. Real-world match means your command names and descriptions use vocabulary the user actually knows — not your internal naming.

### The quick heuristic diagnostic

When a screen or flow just "feels off" but you can't name the problem, use this rapid diagnostic. Ask each question and stop at the first one where the answer is "no":

1.  Can users always tell what state the app is in and what just happened? (Visibility of status)
2.  Are all labels and messages in plain language that a non-technical user would understand? (Real world match)
3.  If a user makes a mistake, can they undo it easily without penalty? (User control and freedom)
4.  Does every similar element look and behave the same way throughout the app? (Consistency and standards)
5.  Are dangerous or irreversible actions clearly differentiated from safe ones, with confirmation where needed? (Error prevention)
6.  Are all available actions visible and labeled, rather than relying on user memory? (Recognition over recall)
7.  Are error messages specific, written in plain language, and constructive? (Help recover from errors)
8.  Is the interface free of irrelevant information, unnecessary decoration, or visual noise that competes with the main content? (Aesthetic and minimalist design)

If you answer "no" to any question, you've found your issue. Start there.

### Decision Tree: when to use a full audit vs. a quick check

**Before a major release (new feature, first public launch, significant redesign)** — run the full heuristic walkthrough plus the Appendix G checklist. Get at least one external user test.

**Before a minor release (bug fix, small UI tweak, copy update)** — run the quick eight-question diagnostic on the affected screens only. No external test required unless the change touches a primary user flow.

**When a screen or flow feels wrong** — start with the eight-question diagnostic. If you find the violation, fix it. If you don't, run the full heuristic walkthrough.

**When you receive a user complaint about confusion** — match the complaint to the most relevant heuristic. "I couldn't figure out how to get back" = Heuristic 3 (user control and freedom). "The app doesn't do what I expected" = Heuristic 2 (real world match). "I didn't realize the button was there" = Heuristic 6 (recognition over recall). Diagnosing to a heuristic names the category of fix needed.

### Linking to the appendices

This chapter is the conceptual foundation for three operational resources. Use them actively:

**Appendix-G-PreShip-Checklist** is the operationalized version of this chapter — the heuristics translated into specific, checkboxable items organized by platform. Every item maps back to one of the ten heuristics. This is the artifact you'll use most in practice.

**Appendix-H-AntiPatterns** catalogs the specific failure modes organized by heuristic category, with examples from real apps and descriptions of what to do instead. If you find a violation during an audit, Appendix H shows what the pattern looks like and how other apps have solved it.

**Appendix-B-ClaimsExcluded** covers UX myths that are widely believed and worth stopping believing before you conduct an audit. Some common ones: "seven items in navigation" (misapplication of Miller's law, discussed in 02-information-architecture); "inline validation always helps" (contradicted by research, covered in 11-forms-and-inputs); "users will read onboarding instructions" (Krug has documented extensively that they won't — dont-make-me-think_extracted). Auditing against myths wastes time and creates bad design; Appendix B gives you the list of claims to discard.

## 4. Practice Lab

This lab guides you through a complete heuristic self-audit of one screen or flow in something you're building. Budget 45–60 minutes.

**Setup: choose your target**

- Pick one feature, screen, or flow in an app you're currently building or have recently shipped. Ideally choose something complex enough to have at least 5–8 elements or interactions.
- Write down 3 tasks a real user would perform in this feature. Make them specific: not "use the list" but "find and complete an existing task."

**The heuristic walkthrough**

Go through the ten heuristics in order. For each one, look at your target screen with that specific lens and note every violation. Do NOT try to evaluate multiple heuristics at once — one pass per heuristic.

- **H1 — Visibility of system status:** Is there feedback for every action that takes more than 0.1 seconds? Are loading states visible? Are success and error states clearly communicated? Note any missing feedback moment.

- **H2 — Real world match:** Read every label aloud. Would a non-technical user understand every word? Are error messages in plain language? List any jargon or system-language terms.

- **H3 — User control and freedom:** Can every action be undone? Is there a clear way to cancel or go back from every state? Is there a way out of every modal, sheet, or popover? Note any dead-end states.

- **H4 — Consistency and standards:** Pick any label, button style, or interaction pattern. Does it appear identically in every other place it's used in the app? Are platform conventions followed (Cmd+Z for undo, standard navigation patterns)? Note any inconsistencies.

- **H5 — Error prevention:** Are destructive actions (delete, irreversible submit) clearly differentiated from safe ones? Do dangerous actions require a confirmation? Are there places where user error is easy and the consequences are hard to reverse? Note them.

- **H6 — Recognition over recall:** Is every available action visible or one tap from visible? Are there any hidden gestures, keyboard shortcuts, or actions that only work if you already know about them, with no visual hint? Note any invisible affordances that matter.

- **H7 — Flexibility and efficiency:** Are there keyboard shortcuts or accelerators for frequently used actions? (This matters more for macOS and Raycast than iOS.) Note any frequently used flows without shortcuts.

- **H8 — Aesthetic and minimalist design:** Is there any information on this screen that isn't needed for the current task? Any decorative elements that compete visually with the content? Any interface chrome that could be removed or deferred? Note any noise.

- **H9 — Help recover from errors:** Find one error state in this flow. Does the error message say specifically what went wrong in plain language? Does it suggest what to do next? Note any error messages that blame the user, use codes, or are non-specific.

- **H10 — Help and documentation:** If a user gets stuck, is there contextual help available without leaving the app? (Tooltips, empty state guidance, inline instructions.) Note any places where a user is likely to get stuck with no guidance available.

**Severity triage**

- Review your list of violations. Mark each one: (C) critical — prevents task completion; (S) serious — causes significant confusion or delay; (M) minor — creates mild friction.
- Commit: you will fix all critical issues before shipping. You will fix serious issues unless there's a strong reason to defer. You will log minor issues for the next release.

**Scoring check**

How many violations did you find? The 1990 Nielsen data suggests individual evaluators typically catch 20–50% of existing problems — so whatever you found, there are likely more. The audit is valuable even if imperfect. The critical issues you catch are the ones that would have driven users away.

After running the audit: show your screen to one person who hasn't used the app. Watch them complete one of your three tasks without guidance. Note the first moment they hesitate or look confused. That is the problem your familiarity blinded you to.

## 5. Key Takeaways

- **Nine to ten empirically-derived heuristics explain the large majority of usability problems.** They were derived from factor analysis of 249 real usability failures and have been validated extensively in subsequent practice.

- **The top four heuristics — consistency, real-world language, feedback, and aesthetic/minimalist design — explain roughly 65% of all problems and 70% of serious ones.** If you can only audit for four things, audit for these.

- **Individual evaluators catch 20–51% of problems — which is still valuable, especially for serious issues.** Self-audit is not perfect, but it's far better than no audit. Getting one external reviewer independently roughly doubles your coverage.

- **Poor usability actively lowers perceived aesthetics, not just vice versa.** If the navigation is broken, users will perceive your visual design as less clean and organized too. The penalty runs in both directions.

- **This chapter is the conceptual layer; the appendices are the operational layer.** Appendix G (Pre-Ship Checklist) is the heuristics made concrete. Appendix H (Anti-Patterns) shows what violations look like. Appendix B (Claims Excluded) lists the myths to stop auditing for. Use them together.
