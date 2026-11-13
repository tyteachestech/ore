# Makes files/code.pdf: one page of a programming book written for Ore, set the way LaTeX books are:
# prose in a serif face, code in a typewriter face on its own lines (a comment first, indented lines,
# a blank line inside, a prompt session) and typewriter words inside the prose (F-new-pdf-code).
# Run: python3 make-code-pdf.py (needs reportlab).
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
import os

out = os.path.join(os.path.dirname(__file__), "files", "code.pdf")
c = canvas.Canvas(out, pagesize=letter, pageCompression=0)
c.setTitle("")
L, GAP, BODY, CODE = 72, 14, 11, 10
y = 700


def prose(*lines):
    """Each line: a string, or runs of (text, font) on one baseline."""
    global y
    for l in lines:
        x = L
        for text, font in [(l, "Times-Roman")] if isinstance(l, str) else l:
            c.setFont(font, CODE if font == "Courier" else BODY)
            c.drawString(x, y, text)
            x += c.stringWidth(text, font, CODE if font == "Courier" else BODY)
        y -= GAP
    y -= 8


def code(*lines):
    global y
    c.setFont("Courier", CODE)
    for l in lines:
        if l:
            c.drawString(L + c.stringWidth(" ", "Courier", CODE) * (len(l) - len(l.lstrip())), y, l.lstrip())
        y -= 12
    y -= 10


c.setFont("Times-Bold", 20)
c.drawString(L, 730, "Spacing in Code")
prose("A review schedule is a few lines of code. Each card keeps the days until it is next due,", "and one short method moves it on:")
code("# inside class Card:", "def review(self, grade):", "    if grade < 3:", "        self.interval = 1", "    else:", "        self.interval *= 2", "", "    return self.interval")
prose("Call it from the prompt and each answer comes back on its own line:")
code(">>> card = Card()", ">>> card.review(4)", "2")
prose(
    [("The name ", "Times-Roman"), ("__init__", "Courier"), (" has two underscores on each side, and ", "Times-Roman"), ("interval *= 2", "Courier"), (" doubles", "Times-Roman")],
    "the gap after every answer he gets right. Only a missed card starts over.",
)
prose("# starts a comment in Python, so the first line above is a note to the reader.")
c.save()
