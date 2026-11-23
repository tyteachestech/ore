# Makes files/columns.pdf: a designed page whose right-hand column is drawn first, so pdf.js, which
# reads a page in the order it is drawn, reads it before the left one. The page reader's order of the
# blocks puts them right (D346). Run: python3 make-columns-pdf.py (needs reportlab).
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
import os

c = canvas.Canvas(os.path.join(os.path.dirname(__file__), "files", "columns.pdf"), pagesize=letter)
c.setTitle("Two habits")
c.setFont("Times-Roman", 11)
def column(x, lines):
    for n, line in enumerate(lines):
        c.drawString(x, 700 - n * 14, line)
column(330, ["Second, test yourself before you", "feel ready, since recalling an idea", "strengthens it more than reading."])
column(72, ["First, spread your reviews out over", "days, so that each one comes just", "as the memory starts to fade."])
c.save()
