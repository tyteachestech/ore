# Makes the small PDFs for the PDFs the deep import pass found broken (intake.test.ts, "PDF: deep import pass").
# Run: python3 make-deep-pdfs.py (needs reportlab and Pillow with JPEG 2000). The text is written for Ore (AGPL).
# - files/skewed.pdf: a page of body text set at a 1.5 degree tilt, as a scan's text layer often is.
# - files/side-table.pdf: a column of prose with a small table of numbers set beside it.
# - files/form.pdf: a filled form: two text fields, a ticked box and a choice of season, under a paragraph.
# - files/form-scan.pdf: a filled form whose page holds no text of its own, as a scanned form's doesn't.
# - files/unordered-outline.pdf: bookmarks that list chapter 2 before chapter 1, with a section in each.
# - files/nested-outline.pdf: four pages whose bookmarks have sections inside each chapter.
# - files/many-figures.pdf: 82 pages, each with a figure of its own, past the 80 a PDF keeps.
# - files/eps-title.pdf: metadata titled by a figure's file name ("raa_asRun.eps"), the real title on the page.
# - files/jpx.pdf: a page whose figure is a JPEG 2000 image.
import io, os, zlib
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
out = lambda name: os.path.join(HERE, "files", name)
PROSE = [
    "Rivers carry sand from the hills to the sea, a little each day.",
    "In spring the water rises and the current moves larger stones.",
    "Over many years the bends of a river slowly move across its valley.",
    "Where the river slows, it drops the sand it carried and builds a bar.",
    "A bar grows into an island when plants take root and hold the ground.",
    "Floods can cut a new channel and leave the old bend as a quiet lake.",
    "People who farm the valley learn where the river is likely to wander.",
    "Maps drawn a century apart show how far a single bend has travelled.",
]


def body(c, y, lines, x=72, size=11, gap=15):
    c.setFont("Times-Roman", size)
    for line in lines:
        c.drawString(x, y, line)
        y -= gap
    return y


# Skewed: the title upright, the body tilted as one block.
c = canvas.Canvas(out("skewed.pdf"), pagesize=letter, pageCompression=0)
c.setTitle("")
c.setFont("Times-Bold", 18)
c.drawString(72, 720, "How Rivers Move")
# A scan's text layer, tilted with the page.
c.saveState()
c.translate(72, 680)
c.rotate(1.5)
body(c, 0, PROSE, x=0)
c.restoreState()
# The scanner's own line, upright, off to the right: a short one.
c.setFont("Times-Roman", 11)
c.drawString(400, 520, "Scanned at the county library.")
# A second page the scanner set straight.
c.showPage()
body(c, 720, PROSE)
c.save()

# Side table: prose in a narrow column, a small table to its right, its rows set apart.
c = canvas.Canvas(out("side-table.pdf"), pagesize=letter, pageCompression=0)
c.setTitle("")
c.setFont("Times-Bold", 16)
c.drawString(72, 720, "Measuring Bends")
y = body(c, 690, PROSE)
c.setFont("Helvetica", 8)
rows = [("Year", "Bend", "Shift"), ("1900", "A", "12 m"), ("1950", "A", "31 m"), ("2000", "A", "58 m")]
for i, row in enumerate(rows):
    for j, cell in enumerate(row):
        c.drawString(430 + j * 34, 660 - i * 16, cell)
c.save()

# Form: the values a person filled in.
c = canvas.Canvas(out("form.pdf"), pagesize=letter, pageCompression=0)
c.setTitle("Field Survey Form")
c.setFont("Times-Bold", 16)
c.drawString(72, 720, "Field Survey Form")
body(c, 690, PROSE[:3])
c.setFont("Times-Roman", 11)
c.drawString(72, 600, "Surveyor")
c.acroForm.textfield(name="surveyor", tooltip="Surveyor", value="Ada Lovelace", x=160, y=595, width=200, height=16)
c.drawString(72, 570, "River")
c.acroForm.textfield(name="river", tooltip="River", value="Wye", x=160, y=565, width=200, height=16)
c.drawString(72, 540, "Flooded")
c.acroForm.checkbox(name="flooded", tooltip="Flooded", checked=True, x=160, y=535, size=14)
c.drawString(72, 510, "Season")
c.acroForm.radio(name="season", tooltip="Season", value="Spring", selected=True, x=160, y=505, size=14)
c.acroForm.radio(name="season", tooltip="Season", value="Summer", selected=False, x=200, y=505, size=14)
c.save()

c = canvas.Canvas(out("form-scan.pdf"), pagesize=letter, pageCompression=0)
c.setTitle("")
c.acroForm.textfield(name="surveyor", tooltip="Surveyor", value="Ada Lovelace", x=160, y=595, width=200, height=16)
c.acroForm.textfield(name="river", tooltip="River", value="Wye", x=160, y=565, width=200, height=16)
c.showPage()
c.save()

c = canvas.Canvas(out("unordered-outline.pdf"), pagesize=letter, pageCompression=0)
c.setTitle("Out of Order")
for n, (chapter, section) in enumerate([("1 First", "1.1 Part"), ("2 Second", "2.1 Part")]):
    c.setFont("Times-Bold", 14)
    c.drawString(72, 720, chapter)
    c.bookmarkPage(f"c{n}", fit="XYZ", top=740)
    body(c, 690, PROSE[3:6])
    c.setFont("Times-Roman", 11)
    c.drawString(72, 600, section)
    c.bookmarkPage(f"s{n}", fit="XYZ", top=620)
    body(c, 570, PROSE[:3])
    c.showPage()
c.addOutlineEntry("2 Second", "c1", level=0)
c.addOutlineEntry("2.1 Part", "s1", level=1)
c.addOutlineEntry("1 First", "c0", level=0)
c.addOutlineEntry("1.1 Part", "s0", level=1)
c.save()

# Nested outline: chapters with their sections.
c = canvas.Canvas(out("nested-outline.pdf"), pagesize=letter, pageCompression=0)
c.setTitle("A Short Survey")
pages = [("1 Introduction", "1.1 Background"), ("1.2 Aims", None), ("2 Method", "2.1 Data"), ("2.2 Analysis", None)]
marks = []
for n, (first, second) in enumerate(pages):
    y = 720
    for head in [first, second]:
        if not head:
            continue
        # A chapter's title stands out; a section's is set as the text is: only the bookmarks say it is one.
        c.setFont("Times-Bold", 14) if head[1] == " " else c.setFont("Times-Roman", 11)
        c.drawString(72, y, head)
        key = f"k{len(marks)}"
        c.bookmarkPage(key, fit="XYZ", top=y + 20)
        marks.append((key, head))
        y = body(c, y - 24, PROSE[:4]) - 10
    c.showPage()
for key, head in marks:
    level = 0 if head[1] == " " else 1
    c.addOutlineEntry(head, key, level=level)
c.save()

# Many figures: one picture per page, each its own colour.
c = canvas.Canvas(out("many-figures.pdf"), pagesize=letter, pageCompression=1)
c.setTitle("Figures")
for n in range(82):
    img = Image.new("RGB", (40, 30), ((n * 37) % 256, (n * 91) % 256, (n * 53) % 256))
    for x in range(40):
        img.putpixel((x, n % 30), (255, 255, 255))
    c.setFont("Times-Roman", 11)
    c.drawString(72, 720, f"Figure {n + 1} shows the river at station {n + 1} in its own season.")
    c.drawImage(ImageReader(img), 72, 400, width=320, height=240)
    c.showPage()
c.save()

# EPS title: a figure's file name in the metadata.
c = canvas.Canvas(out("eps-title.pdf"), pagesize=letter, pageCompression=0)
c.setTitle("raa_asRun.eps")
c.setFont("Times-Bold", 20)
c.drawString(72, 720, "Sand Bars and Islands")
body(c, 680, PROSE)
c.save()

# JPX: written by hand, since reportlab writes no JPEG 2000. One page: a line of text and the image.
img = Image.new("RGB", (64, 48), (30, 90, 160))
for x in range(64):
    for y in range(0, 48, 6):
        img.putpixel((x, y), (240, 200, 40))
buf = io.BytesIO()
img.save(buf, "JPEG2000")
jp2 = buf.getvalue()
text = b"BT /F1 12 Tf 72 720 Td (The station photo below shows the river in flood each spring.) Tj ET\nq 256 0 0 192 72 400 cm /Im1 Do Q\n"
objs = [
    b"<< /Type /Catalog /Pages 2 0 R >>",
    b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> /XObject << /Im1 5 0 R >> >> /Contents 6 0 R >>",
    b"<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman >>",
    b"<< /Type /XObject /Subtype /Image /Width 64 /Height 48 /Filter /JPXDecode /Length %d >>\nstream\n" % len(jp2) + jp2 + b"\nendstream",
    b"<< /Length %d >>\nstream\n" % len(text) + text + b"endstream",
]
pdf = bytearray(b"%PDF-1.5\n")
offsets = []
for i, o in enumerate(objs):
    offsets.append(len(pdf))
    pdf += b"%d 0 obj\n" % (i + 1) + o + b"\nendobj\n"
xref = len(pdf)
pdf += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objs) + 1) + b"".join(b"%010d 00000 n \n" % o for o in offsets)
pdf += b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (len(objs) + 1, xref)
open(out("jpx.pdf"), "wb").write(pdf)
