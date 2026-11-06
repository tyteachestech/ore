---
title: "Animations 25 Years Later: New Roles and Opportunities"
authors: [Chevalier, F., Riche, N.H., Plaisant, C., Chalbi, A., Hurter, C.]
year: 2016
type: systematic-review
population: general-adult
sample_size: 20
key_claims:
  - "23 distinct roles of animation in GUIs, organized across 5 categories: Keeping in Context, Teaching Aid, User Experience, Data Encoding, Visual Discourse"
  - "Taxonomy validated against 200+ author-collected examples and 95 examples from 20 expert interviews; 98% of examples fit within the 23 roles"
  - "Animation is now a core UI design component per Google Material Design and Windows UX guidelines — described as conveying 'spatial relationships, functionality, and intention'"
  - "Animated transitions reduce 'jarring' navigation by making spatial changes smooth; staged animation breaks complex transitions into steps to aid orientation"
  - "Animation for teaching has mixed empirical outcomes — studies comparing animated vs. static conditions show no consistent advantage"
  - "Animation's strong perceptual draw may prevent users from perceiving other display elements (potential distraction risk)"
  - "Many UX roles of animation (aesthetics, engagement, persuasion) are widely used in practice but rarely studied in research"
doi: "10.1145/2909132.2909255"
pmid: unknown
evidence_grade: emerging
scope_flag: include
inflation_flag: none
---

# Animations 25 Years Later: New Roles and Opportunities

## Study Overview
- **Citation**: Chevalier, F., Riche, N.H., Plaisant, C., Chalbi, A., Hurter, C. (2016)
- **Study Type**: Systematic review / taxonomy paper — literature review + expert interviews + practitioner observation
- **Sample**: n=20 expert interviews (HCI researchers, UX/interaction designers, UI developers); 200+ author examples; 95 additional examples from interviewees
- **Venue**: AVI '16 — ACM International Working Conference on Advanced Visual Interfaces
- **DOI**: 10.1145/2909132.2909255

## Key Findings

- **Taxonomy of 23 animation roles**: The paper's primary contribution is a taxonomy updating Baecker and Small's 1990 classification. 23 roles organized in 5 categories. 98% of the validation corpus (295 total examples) fit within it.

- **5 top-level categories and their roles**:
  1. **Keeping in Context** (4 roles): staying oriented during navigation, tracking during layout change, maintaining up-to-date state, replaying history/summarizing
  2. **Teaching Aid** (5 roles): affordance/preview, training by demonstration, explaining how systems work, illustrating algorithms, teaching new representations
  3. **User Experience** (5 roles): hooking the user, keeping user engaged, visual comfort/aesthetics, making activity/progress visible, revealing/hiding content, providing virtual tours, feedback of input mechanism
  4. **Data Encoding** (4 roles): revealing data relationships, conveying uncertainty/randomness, encoding emotion, encoding object attributes
  5. **Visual Discourse** (3 roles): supporting a narrative, highlighting content, persuading/convincing

- **Smooth transitions reduce disorientation**: Animated navigation (e.g., Google Maps zoom/pan) replaces jarring jumps. For complex navigation, staged animation (shrink → recenter → grow) breaks the transition into comprehensible steps (SpaceTree example).

- **"Nothing is lost" principle (Role 2)**: When layout changes, animating objects to their new positions preserves continuity — users understand what happened to elements. Applied in window minimization, document version transitions, etc.

- **Teaching animations have mixed results**: The paper explicitly notes "the outcomes of existing empirical studies are mixed" for animation as teaching aid. More research needed on when to use it and what components matter.

- **Aesthetics and engagement are under-researched**: Roles like visual comfort/aesthetics, hooking users, and persuasion are "commonly used in practice but rarely studied in the literature." The paper calls this a gap, not a validated practice.

- **Animation can distract**: "Because of its strong perceptual draw, animation might prevent users from perceiving other elements of the display." Named as a design risk, especially for data encoding.

- **Roles are not mutually exclusive**: Many animations serve multiple roles simultaneously. Example: NodeTrix animation first teaches a new representation (Role 9), then helps track layout changes on subsequent use (Role 2).

## Effect Sizes (Raw Values)

This is a taxonomy and review paper. No quantitative effect sizes are reported. The paper explicitly states: "We opted not to report on the results of published evaluations, because mixed results and complex procedures require substantially more space than is available, and we could not provide accurate and nuanced summaries."

No d, SMD, OR, r, or beta values are present.

## Mechanisms & Moderators

- **Orientation mechanism (Role 1 & 2)**: Animation preserves spatial continuity during state changes, reducing cognitive load associated with tracking where objects went. Analogized to Lavoisier's principle: "nothing is lost, nothing is created, everything is transformed."

- **Attention mechanism (Role 22)**: Motion has strong pre-attentive perceptual draw — used to highlight content but also risks distracting from other display elements.

- **Staged animation moderator**: For complex layout changes, breaking animation into sequential stages (e.g., shrink → recenter → expand) aids comprehension compared to a single continuous animation.

- **Learning decay moderator (Role 9)**: Once users understand a new representation through animated teaching, the animation may no longer be needed and can be discontinued — suggesting animation's value diminishes post-learning.

- **Role combination moderator**: Animations that serve multiple roles (e.g., teaching + orientation) are more prevalent in complex UIs; role combinations require careful design to avoid overloading users.

- **Evaluation methodology moderator**: Most animation research uses target-agnostic motion object tracking (MOT) tasks — the paper notes this "may not be representative of reality" and calls for more ecologically valid evaluation.

## Study Design Details

- **Method**: Multi-step taxonomy construction — (1) literature review of HCI and visualization papers (ACM DL + keyvis.org), (2) collection of commercial examples from websites/mobile apps, (3) iterative grouping into roles, (4) validation via 20 expert interviews
- **Interview protocol**: Experts asked to generate 5+ animation examples unprompted, then introduced to the taxonomy and asked to classify their examples and critique the framework
- **Coverage test**: 98% of 295 total examples fit the taxonomy; 2 examples prompted addition of Role 16 (feedback of input mechanism)
- **No experimental control conditions**: This is a descriptive/taxonomic paper, not a controlled study

## Limitations

- No quantitative evidence of whether any of these roles actually improve usability, comprehension, or satisfaction — the taxonomy describes what animation is used for, not whether it works
- Expert sample (n=20) is convenience-based, not representative of end users
- Corpus skews toward information visualization (authors' domain expertise); less coverage of game UI, enterprise software, consumer apps
- Excludes tangible interfaces, augmented reality, and non-GUI contexts — authors acknowledge roles may extend there
- Roles are not mutually exclusive and vary substantially in granularity — the taxonomy is a practical tool, not a rigorous formal classification
- Animation quality and implementation parameters (duration, easing, number of objects, speed) are identified as important but not studied
- All "User Experience" roles (aesthetics, engagement, persuasion) are noted as under-researched — practitioner usage does not equal validated effectiveness

## Population Scope Assessment

- **Population**: HCI researchers and practitioners (expert interviews); examples drawn from general consumer interfaces (Google Maps, iOS, mobile apps)
- **Relevance to Apple ecosystem / indie app development**: High — the taxonomy maps directly to common animation patterns in macOS, iOS (navigation transitions, sheet reveals, progress indicators, icon animations)
- **Red flags**: None — this is a general GUI framework paper, not clinical

## Conclusions

The authors present a 23-role taxonomy across 5 categories as a "comprehensive yet simple" framework to inform GUI animation design and guide empirical research. Their intent is explicitly dual: practical guidance for designers and a research agenda for the HCI community. They emphasize that many roles — particularly those related to user experience and discourse — are widely deployed in commercial products but lack empirical validation, and call for "role-aware" research that evaluates animations against their specific intended purpose rather than using blanket paradigms like MOT tasks.

## Named Frameworks

- **Baecker & Small (1990) taxonomy**: Original taxonomy of animation roles at the interface — 25-year-old predecessor this paper updates and expands
  - Components: track objects of interest, choose actions, see how to act, get feedback, see summaries
  - Research alignment: subsumed as subset of this paper's Roles 1–4 (Keeping in Context) and parts of Teaching Aid

- **Betrancourt & Tversky (2000) definition**: Working definition used throughout: "computer animation refers to any application which generates a series of frames, so that each frame appears as an alteration of the previous one, and where the sequence of frames is determined either by the designer or the user"

- **Google Material Design "authentic motion"**: Quoted as industry standard — describes motion as conveying "spatial relationships, functionality, and intention with beauty and fluidity"

- **Windows UX guidelines**: Quoted: "purposeful, well-designed animations bring apps to life and make the experience feel crafted and polished"

---

## Extraction Notes

This is a taxonomy paper, not an empirical study. No effect sizes exist to extract. Its value to the guidebook is as a **classification framework** — the 23 roles provide a vocabulary and organizational structure for a motion/animation chapter.

**High practical utility for the guidebook**: The 5-category structure maps well onto how a non-designer would encounter animation decisions:
- "Keeping in Context" = navigation transitions (very relevant for app-building)
- "Teaching Aid" = onboarding, affordance hints (relevant for Raycast extensions and new apps)
- "User Experience" = polish, progress spinners, reveals (directly applicable)
- "Data Encoding" = charts/dashboards (lower priority for this guidebook's audience)
- "Visual Discourse" = presentations/marketing (probably out of scope)

**Key honest caveat to preserve**: The authors are explicit that teaching and UX roles have mixed or absent empirical support. The guidebook should not overstate animation's benefits based on this paper — it describes roles, not proven effects.

**Practical design principle worth quoting**: The "Lavoisier principle" for layout transitions (Role 2) is a crisp, memorable framing for why elements should animate to new positions rather than disappearing and reappearing.
