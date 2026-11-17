# Makes files/glossary.pdf: two textbook pages with a margin glossary, as biology and psychology
# textbooks set one: beside the line that introduces a term in bold, the margin gives the term again
# with its definition, in smaller type. One margin note only repeats its term (AIMA's style), which
# says nothing the line doesn't. Written for Ore; the words are invented.
# Run: python3 make-glossary-pdf.py (needs reportlab).
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph
import os

out = os.path.join(os.path.dirname(__file__), "files", "glossary.pdf")
c = canvas.Canvas(out, pagesize=letter, invariant=1)
c.setTitle("How Plants Make Food")
c.setAuthor("Tomas Ferreira")
c.setCreator("Ore test fixture")
note = ParagraphStyle("n", fontName="Times-Roman", fontSize=8, leading=10)
X, MARGIN, LEAD = 72, 420, 14

def line(y, parts):
    x = X
    for font, text in parts:
        f = "Times-Bold" if font == "B" else "Times-Roman"
        c.setFont(f, 11)
        c.drawString(x, y, text)
        x += c.stringWidth(text, f, 11)

def margin(y, html):
    p = Paragraph(html, note)
    _, h = p.wrap(140, 200)
    p.drawOn(c, MARGIN, y + 8 - h)

def page(title, heading, rows):
    y = 700
    if title:
        c.setFont("Times-Bold", 18)
        c.drawString(X, y, title)
        y -= 36
    c.setFont("Times-Bold", 13)
    c.drawString(X, y, heading)
    y -= 24
    for parts, gloss in rows:
        line(y, parts)
        if gloss:
            margin(y, gloss)
        y -= LEAD
    c.setFont("Times-Roman", 9)
    c.drawString(300, 50, str(c.getPageNumber()))
    c.showPage()

page("How Plants Make Food", "Light into sugar", [
    ([("R", "Every green leaf is a small factory that runs on sunlight.")], None),
    ([("R", "The process is "), ("B", "photosynthesis"), ("R", ": the leaf takes in water and")],
     "<b>photosynthesis</b> The making of sugar from carbon dioxide and water, powered by light, with oxygen given off."),
    ([("R", "carbon dioxide and joins them into sugar it can store.")], None),
    ([("R", "Oxygen is what is left over, and it leaves through the leaf.")], None),
    ([("R", "The green comes from a pigment. "), ("B", "Chlorophyll"), ("R", " sits in tiny")], "<b>chlorophyll</b>"),
    ([("R", "bodies inside each cell and soaks up red and blue light.")], None),
    ([("R", "Air enters through pores on the underside of the leaf,")], None),
    ([("R", "called "), ("B", "stomata"), ("R", ", which close when the plant is dry.")],
     "<b>stomata</b> Small openings in a leaf that let gases in and out and that close to save water."),
])
page(None, "Where the sugar goes", [
    ([("R", "Sugar made in the leaf travels to the roots and the fruit. The")], None),
    ([("B", "phloem"), ("R", " carries it in long tubes that run the length of the stem.")],
     "<b>phloem</b> The tissue that carries sugar from the leaves to the parts of a plant that use or store it."),
    ([("R", "A ripe apple is mostly sugar that began as light on a leaf.")], None),
])
c.save()
