---
id: <id>
type: markdown
title: How sourdough rises
captured_at: <time>
text_sha256: c5de6203880ea8ac207b91041f6c59f9e6a444191f9395d4efc42b1f294186ec
status: inbox
skills: []
topics: []
---
This report, written for Ore's tests in the shape ChatGPT's page copies, opens with the main claim: a starter's wild yeast and bacteria raise a loaf more slowly than baker's yeast, and the wait is where the flavour comes from.[example.org](https://example.org/sourdough-science)

## What the starter does

Yeast numbers grow along a curve until the flour runs out. A simple model writes the population after $$t$$ hours as follows.

$$
N = N_0 e^{rt}
$$

![A starter doubling in its jar over six hours](assets/7f82852cfe75e6db.png)

- **Yeast:** makes the gas that lifts the dough.
- **Lactic bacteria:** make the acid that gives the sour taste.

## Proof times that work

| Kitchen at | Bulk proof |
| --- | --- |
| 20 °C | Six to eight hours |
| 26 °C | Four to five hours |

### A feeding calculator

```python
def feed(starter):
    return starter * 5
```

The closing advice is plain: feed the starter at the same time each day, and bake when it has doubled.
