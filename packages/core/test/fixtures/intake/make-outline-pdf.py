# Makes files/outline.pdf: a short book in three chapters, each two pages, with the PDF outline
# (bookmarks) naming them. Its headings are set in the body's size, so only the outline says where a
# chapter starts. Written for Ore; the words are invented. Run: python3 make-outline-pdf.py (needs reportlab).
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
import os, random

out = os.path.join(os.path.dirname(__file__), "files", "outline.pdf")
ss = getSampleStyleSheet()
body = ParagraphStyle("b", parent=ss["BodyText"], fontName="Times-Roman", fontSize=11, leading=14)
head = ParagraphStyle("h", parent=body, fontName="Times-Roman", spaceBefore=6, spaceAfter=6)
chapters = ["Why memories fade", "How retrieval rebuilds them", "Spacing the practice"]
nouns = ["learner", "memory", "trace", "cue", "review", "answer", "question", "habit", "lesson", "page", "idea", "mistake"]
verbs = ["strengthens", "weakens", "reshapes", "anchors", "recalls", "blurs", "sharpens", "links", "tests", "rebuilds"]
adjs = ["old", "fresh", "faint", "vivid", "spaced", "massed", "early", "late", "small", "patient"]
rnd = random.Random(7)

def sentence():
    return f"Each {rnd.choice(adjs)} {rnd.choice(nouns)} {rnd.choice(verbs)} the {rnd.choice(adjs)} {rnd.choice(nouns)} a little, and the {rnd.choice(nouns)} {rnd.choice(verbs)} {rnd.choice(['once', 'again', 'slowly', 'at last', 'for weeks'])}."

class Book(SimpleDocTemplate):
    def afterFlowable(self, f):
        key = getattr(f, "outline_key", None)
        if key:
            self.canv.bookmarkPage(key)
            self.canv.addOutlineEntry(f.outline_title, key, level=0)

story = []
for n, title in enumerate(chapters, 1):
    h = Paragraph(title, head)
    h.outline_key, h.outline_title = f"ch{n}", title
    story.append(h)
    for _ in range(14):
        story.append(Paragraph(" ".join(sentence() for _ in range(4)), body))
    story.append(PageBreak())
Book(out, pagesize=letter, title="Remembering on purpose", author="A. Reader").build(story)
print(out)
