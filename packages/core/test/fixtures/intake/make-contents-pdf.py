# Makes files/contents.pdf: a short guide laid out like an ebook from a podcast: a contents page whose
# entries are one per line (the parts in bold, their sections indented under them, one entry wrapped
# onto a second line, the page number at each end), and on every page a running foot set larger than
# the text ("Field" in bold, "NOTES GUIDE", the page number; none on the contents page) and a running
# head. Written for Ore; the words are invented. Run: python3 make-contents-pdf.py (needs reportlab).
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
import os

out = os.path.join(os.path.dirname(__file__), "files", "contents.pdf")
c = canvas.Canvas(out, pagesize=letter)
c.setTitle("Notes Guide")
W, H = letter
pages = [0]

def frame(head, number=True):
    c.setFont("Helvetica", 12)
    c.drawString(84, H - 60, head)
    c.setFont("Helvetica-Bold", 14)
    c.drawString(77, 38, "Field")
    c.setFont("Helvetica", 12)
    c.drawString(77 + c.stringWidth("Field ", "Helvetica-Bold", 14), 38, "NOTES GUIDE" + (f" {pages[0]}" if number else ""))

def text(lines, y, x=72, size=12, leading=16, font="Helvetica"):
    c.setFont(font, size)
    for l in lines:
        c.drawString(x, y, l)
        y -= leading
    return y

# The contents, over two pages.
c.setFont("Helvetica-Bold", 22)
c.drawString(200, H - 150, "Table of Contents")
y = H - 190
toc = [
    (0, "Why Notes Matter 2"),
    (1, "Beyond Rereading 2"),
    (1, "Two Common Mistakes With Notes 3"),
    (0, "What Is a Good Note? 3"),
    (1, "Writing Notes in Your Own Words Instead of Copying the"),
    (2, "Page 3"),
    (1, "The Question Test 4"),
    None,
    (0, "Keeping Notes Alive 5"),
    (1, "Review on a Schedule 5"),
    (1, "When to Let a Note Go 6"),
]
for entry in toc:
    if entry is None:  # the contents go on over the page
        frame("Contents", number=False)
        c.showPage()
        y = H - 110
        continue
    level, entry = entry
    if level == 2:  # the wrapped entry's second line sits closer, under its first
        y += 3.5
        level = 1
    text([entry], y, x=72 + 18 * level, font="Helvetica-Bold" if level == 0 else "Helvetica")
    y -= 19.5
frame("Contents", number=False)
c.showPage()

body = [
    ["Why Notes Matter", [
        "A note is a promise to your later self. Most notes break that promise because",
        "they copy the page instead of asking what the page means, and a copy is easy",
        "to reread and hard to remember.",
        "",
        "Rereading feels like learning because the words grow familiar, yet the familiar",
        "words are not the same as knowing them. A note that asks a question makes you",
        "answer it, and answering is what holds an idea in place for the weeks after",
    ]],
    ["Why Notes Matter", [
        "you first read it, even when the answer comes slowly.",
        "",
        "The first mistake is writing everything down. The second is never looking at",
        "the notes again, which turns the notebook into a drawer nobody opens.",
    ]],
    ["What Is a Good Note?", [
        "A good note is short, in your own words, and shaped as a question you could",
        "answer tomorrow. It names one idea and says why it matters to you.",
        "",
        "In one class the notes were tested on day 1",
        "and then again on day 7",
        "and on day 30, and the class that wrote questions kept twice as many ideas.",
    ]],
    ["What Is a Good Note?", [
        "The question test asks whether a stranger could quiz you from the note alone.",
    ]],
    ["Keeping Notes Alive", [
        "Notes stay alive when you meet them again on a schedule, a little later each",
        "time, until the idea no longer needs the note at all.",
    ]],
    ["Keeping Notes Alive", [
        "A note can go once you answer its question without it, every time, for months.",
    ]],
]
for head, lines in body:
    pages[0] += 1
    text(lines, H - 120)
    frame(head)
    c.showPage()
c.save()
print(out)
