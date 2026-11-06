# Makes files/hazards.pdf: two pages of body text laid out line by line, each line a known hazard for
# the PDF reader (D119, D121). Run: python3 make-hazards-pdf.py (needs reportlab).
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
import os

out = os.path.join(os.path.dirname(__file__), "files", "hazards.pdf")
c = canvas.Canvas(out, pagesize=letter, pageCompression=0)
c.setTitle("")
L, TOP, GAP, BODY = 72, 700, 14, 11


def line(y, parts):
    """parts: (text, size, rise) runs drawn one after another on one baseline."""
    x = L
    for text, size, rise in parts:
        c.setFont("Times-Roman", size)
        c.drawString(x, y + rise, text)
        x += c.stringWidth(text, "Times-Roman", size)


def body(y, text):
    line(y, [(text, BODY, 0)])


def page(n, lines, notes=()):
    # The body first, then the running head and page number, the order Chromium and many
    # print-to-PDF tools write them in.
    y = TOP
    for l in lines:
        if l is None:
            y -= GAP
            continue
        if isinstance(l, str):
            body(y, l)
        else:
            line(y, l)
        y -= GAP
    y = 120
    for note in notes:
        line(y, note)
        y -= 11
    c.setFont("Times-Roman", 8)
    c.drawCentredString(306, 762, "How Memory Works")
    c.drawCentredString(306, 40, str(n))
    c.showPage()


c.setFont("Times-Bold", 20)
c.drawString(L, 730, "How Memory Works")
page(
    1,
    [
        [("Psychologists study the mind as rational", BODY, 0), ("2", 7, 4), (" and as a habit of the body, and", BODY, 0)],
        "both views explain part of how we remember what we read. Each view",
        "predicts something the other misses, which is why the field keeps both.",
        None,
        [("The brain holds about 10", BODY, 0), ("11", 7, 4), (" neurons and a signal crosses a synapse in 10", BODY, 0), ("−3", 7, 4), (" s,", BODY, 0)],
        [("so a search costs O(n · d", BODY, 0), ("2", 7, 4), (") steps for n items of length d.", BODY, 0)],
        "Numbers like these are rough, but they show the scale of the problem.",
        None,
        "Models that are fine-tuned on a few examples forget less when they are fine-",
        "tuned again later, a result that holds for people learning a skill as well.",
        "Practice that is spread out leaves a stronger trace than practice crammed.",
        None,
        "Some puzzles belong to the class of NP-",
        "complete problems, and no shortcut is known for them. Memory search is",
        "easier: a good cue narrows it at once, which is why cues matter so much.",
        None,
        "We review frequently because a memory reviewed fre",
        "quently is cheaper to recall, as the spacing studies show. The gain is",
        "largest when the gap between reviews grows a little each time it works.",
        None,
        "The idea goes back to Alan Turing’s 1950 article “Com-",
    ],
    notes=[[("2", 6, 3), (" We are not suggesting that people are irrational, only that habits matter.", 8, 0)]],
)
page(
    2,
    [
        "puting Machinery and Intelligence,” which asked whether machines can think.",
        None,
        "Each later chapter returns to this question from another side, and",
        "each one ends with exercises that ask you to recall what it said.",
    ],
)
c.save()
print(out)
