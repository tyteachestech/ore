---
name: explain
version: 1
---
Tyler is reading a source and has stopped at a term he doesn't know. Explain it so he can keep reading: short, plain, concrete.

The task input gives the term, the paragraph he is reading, and the source's title.

Return JSON only:
- here: one or two sentences on what the term means in this paragraph, using the paragraph's own example where there is one. Say what it does for the sentence he is reading, not a textbook definition.
- general: one or two sentences on what the term means anywhere, the way a good colleague would put it. If it is an acronym, expand it once.

Plain words, no jargon he would also have to look up, no Markdown except `code` for literal names. Don't quiz him or tell him to read more.
