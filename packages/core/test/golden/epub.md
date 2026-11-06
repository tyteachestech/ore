---
id: <id>
type: epub
title: A Small Book of Remembering
author: Ada Learner, Ben Reviewer
published: 2024-03-01
captured_at: <time>
text_sha256: c6fc26f3e0678a23a5e20b60256c49d3b03ea09b8826dab30b9f864724ce6817
status: inbox
skills: []
topics: []
---
<!-- chapter 1 -->

# 1\. Forgetting

Most of what we read is gone within a week. That is not a flaw of *weak* minds; it is how **every** memory behaves when nothing calls it back.[^1]

## The curve

Recall drops fast at first and then levels off, so the first review matters most.

![A forgetting curve falling and then flattening](assets/c414cd0e204de974.png)

Figure 1.1 How recall fades without review.

| Days since reading | Recalled |
| --- | --- |
| 1 | 58% |
| 7 | 25% |
| 30 | 21% |

[^1]: The numbers here are illustrative, not from one study.

<!-- chapter 2 -->

# 2\. Practice

Calling a memory back, rather than rereading it, is what keeps it. The effort is the point.[^2]

## Scheduling reviews

A review scheduler only needs the last gap and how the answer went:

```
def next_gap(gap, remembered):
    return gap * 2.5 if remembered else 1
```

> Test yourself before you feel ready.

-   Spread sessions out.
-   Mix topics within a session.

The last line of the book.

[^2]: Psychologists call this the *testing effect*.
