# Card files (`cards/<id>.md`)

Read this before editing a card (finishing edits in review, or mode 4).

## Format

```markdown
---
id: 01J...            # never change
kind: card | prompt   # change only if Tyler asks (e.g. a term wrongly drafted as a prompt)
item: 01J...          # never change
annotation: 01J...    # never change
skills: [ai]
topics: [slug]
content_type: definition | concept | procedure | fact
state: draft | live | retired   # never change by hand; `ore card retire` and `ore card restore` own it (a finished draft stays `draft` here: the review log makes it live)
created: ...          # never change
ai: {vendor, model, prompt_version}   # leave as is
---
<question>
---
<answer>
## Rubric            # prompts only
- <point>
- <point>
```

`card`: question, `---`, answer. Cloze allowed: `{{c1::text}}`.
`prompt`: question, `---`, model answer, `## Rubric` with 2–4 bullets. Bullets may start with `Optionally…` or `Avoids…`.

## Edit rules

- **One retrieval target.** If the card asks for two things, keep the one Tyler cares about (ask only if unclear) and drop the other. Offer the dropped one as a new Card highlight; never write a new card file.
- **Stands alone.** It will be seen interleaved with other topics; the question names its context ("In spaced repetition, …"), not "the article".
- **Rubric asks only what the question asks.** Every bullet must be something a good answer to that exact question would contain. If a bullet needs content the question doesn't request, change the question or drop the bullet.
- **2–4 rubric bullets** for prompts. Merge or cut to fit.
- Keep Tyler's wording when he gives it; tighten, don't embellish.
- Edit with the Edit tool so the frontmatter block stays byte-identical except the fields you meant to touch. Keep `---` delimiters intact.
- After editing, `ore card show <id> --json` must succeed. If it fails, restore the original and report the error.
