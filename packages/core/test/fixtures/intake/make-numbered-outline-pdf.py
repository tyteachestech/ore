# Makes files/numbered-outline.pdf: a short paper as LaTeX sets one. Its section headings carry their numbers on the
# page ("1 Introduction") while the PDF outline (bookmarks) names them without ("Introduction"), and three sections
# start on one page. Written for Ore; the words are invented. Run: python3 make-numbered-outline-pdf.py (needs reportlab).
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
import os, random

out = os.path.join(os.path.dirname(__file__), "files", "numbered-outline.pdf")
ss = getSampleStyleSheet()
body = ParagraphStyle("b", parent=ss["BodyText"], fontName="Times-Roman", fontSize=10, leading=13)
head = ParagraphStyle("h", parent=body, fontName="Times-Bold", fontSize=12, leading=15, spaceBefore=10, spaceAfter=6)
title = ParagraphStyle("t", parent=body, fontName="Times-Bold", fontSize=17, leading=21, alignment=1, spaceAfter=14)
# (section, paragraphs, page break after)
# The last paragraph of Results opens with the next section's name, and the last section's title is longer than a line
# of forty characters: both once put a second heading on the page.
LONG = "A comparison of spaced and massed practice in adult learners"
sections = [("Introduction", 2, False), ("Background", 2, False), ("Method", 3, True), ("Results", 3, False), ("Conclusion", 2, False), (LONG, 2, False)]
nouns = ["learner", "memory", "trace", "cue", "review", "answer", "question", "habit", "lesson", "interval", "idea", "mistake"]
verbs = ["strengthens", "weakens", "reshapes", "anchors", "recalls", "blurs", "sharpens", "links", "tests", "rebuilds"]
adjs = ["old", "fresh", "faint", "vivid", "spaced", "massed", "early", "late", "small", "patient"]
rnd = random.Random(11)

def sentence():
    return f"Each {rnd.choice(adjs)} {rnd.choice(nouns)} {rnd.choice(verbs)} the {rnd.choice(adjs)} {rnd.choice(nouns)} a little, and the {rnd.choice(nouns)} {rnd.choice(verbs)} {rnd.choice(['once', 'again', 'slowly', 'at last', 'for weeks'])}."

class Paper(SimpleDocTemplate):
    def afterFlowable(self, f):
        key = getattr(f, "outline_key", None)
        if key:
            self.canv.bookmarkPage(key)
            self.canv.addOutlineEntry(f.outline_title, key, level=0)

story = [Paragraph("Spacing is all you need", title), Paragraph("Abstract. " + " ".join(sentence() for _ in range(5)), body), PageBreak()]
for n, (name, paras, brk) in enumerate(sections, 1):
    h = Paragraph(f"{n}&nbsp;&nbsp;&nbsp;{name}", head)
    h.outline_key, h.outline_title = f"s{n}", name
    story.append(h)
    for _ in range(paras):
        story.append(Paragraph(" ".join(sentence() for _ in range(4)), body))
    if name == "Results":
        story.append(Paragraph("Conclusion drawn early is a habit of its own. " + sentence(), body))
    if brk:
        story.append(PageBreak())
Paper(out, pagesize=letter, title="Spacing is all you need", author="A. Reader").build(story)
print(out)
