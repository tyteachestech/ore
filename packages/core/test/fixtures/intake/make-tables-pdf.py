# Makes files/tables.pdf: a page of a paper with a table and a numbered display formula between
# paragraphs, the parts pdf.js reads as plain lines and Docling reads as structure (D125). Its reading
# by Granite-Docling (D273), saved as files/tables.docling.json with the page images
# dropped, comes from the command runDocling runs:
#   docling convert files/tables.pdf --to json --pipeline vlm --vlm-model granite_docling --image-export-mode placeholder
# Run: python3 make-tables-pdf.py (needs reportlab).
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Table, TableStyle, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
import os

out = os.path.join(os.path.dirname(__file__), "files", "tables.pdf")
ss = getSampleStyleSheet()
body = ParagraphStyle("b", parent=ss["BodyText"], fontName="Times-Roman", fontSize=11, leading=14)
eq = ParagraphStyle("e", parent=body, alignment=1, fontName="Times-Italic", fontSize=12, leading=18)
doc = SimpleDocTemplate(out, pagesize=letter, title="Spacing and recall", author="A. Reader")
rows = [["Schedule", "Learners", "Day 1", "Day 30"], ["Spaced", "412", "91%", "74%"], ["Massed", "398", "93%", "41%"], ["Control", "120", "88%", "37%"]]
t = Table(rows, colWidths=[110, 80, 70, 70])
t.setStyle(TableStyle([("FONT", (0, 0), (-1, 0), "Times-Bold", 11), ("FONT", (0, 1), (-1, -1), "Times-Roman", 11), ("LINEABOVE", (0, 0), (-1, 0), 1, colors.black), ("LINEBELOW", (0, 0), (-1, 0), 0.5, colors.black), ("LINEBELOW", (0, -1), (-1, -1), 1, colors.black)]))
story = [
    Paragraph("Spacing and recall", ss["Title"]),
    Paragraph("Learners who spread their reviews out remembered more a month later than learners who crammed, though both groups did about as well the next day. Table 1 lists each group.", body),
    Spacer(1, 10), t, Spacer(1, 6),
    Paragraph("Table 1: Recall after one day and after thirty days.", body),
    Spacer(1, 10),
    Paragraph("The chance of recalling an item falls with the time t since it was last seen, at a rate set by its stability S:", body),
    Spacer(1, 22),
    Paragraph("R(t) = e<super>−t/S</super>,&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;S<sub>n+1</sub> = S<sub>n</sub> · (1 + α)", eq),
    Spacer(1, 22),
    Paragraph("Each successful review raises S, so the next gap can be longer than the last one.", body),
]
doc.build(story)
print(out)
