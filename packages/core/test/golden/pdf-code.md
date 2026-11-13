---
id: <id>
type: pdf
title: Spacing in Code
captured_at: <time>
text_sha256: 2178be00f32334d06af793b5a6ed611588b1beaf294fad673dad16c42f9f17a5
status: inbox
skills: []
topics: []
---
<!-- page 1 -->

## Spacing in Code

A review schedule is a few lines of code. Each card keeps the days until it is next due, and one short method moves it on:

```
# inside class Card:
def review(self, grade):
    if grade < 3:
        self.interval = 1
    else:
        self.interval *= 2

    return self.interval
```

Call it from the prompt and each answer comes back on its own line:

```
>>> card = Card()
>>> card.review(4)
2
```

The name `__init__` has two underscores on each side, and `interval *= 2` doubles the gap after every answer he gets right. Only a missed card starts over.

\# starts a comment in Python, so the first line above is a note to the reader.
