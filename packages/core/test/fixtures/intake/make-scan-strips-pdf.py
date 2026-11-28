# Run: python3 make-scan-strips-pdf.py (needs ReportLab and Pillow).
# A text page, a scanned page stored as four strips (as some scanners write them), and a full-page figure with
# its caption: the strips are a scan to read; the figure, with words of its own, is not.
from pathlib import Path

from PIL import Image
from reportlab import rl_config
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

files = Path(__file__).resolve().parent / "files"
width, height = 720, 432
rl_config.useA85 = 0
pdf = canvas.Canvas(str(files / "scan-strips.pdf"), pagesize=(width, height), invariant=True)
pdf.setTitle("Practice in strips")
pdf.setAuthor("Ada Lovelace")

pdf.setFont("Helvetica-Bold", 24)
pdf.drawString(36, 310, "Before practice")
pdf.setFont("Helvetica", 12)
for i, line in enumerate(["Pick one idea you want to remember by the end of the week.", "Write it down with a question you can ask yourself tomorrow.", "Then try to recall the idea in your own words."]):
    pdf.drawString(36, 270 - i * 18, line)
pdf.showPage()

shot = Image.open(files / "screenshot.png").convert("RGB")
w, h = shot.size
for k in range(4):
    strip = shot.crop((0, h * k // 4, w, h * (k + 1) // 4))
    pdf.drawImage(ImageReader(strip), 0, height - height * (k + 1) / 4, width, height / 4)
pdf.showPage()

pdf.drawImage(str(files / "screenshot.png"), 0, 0, width, height)
pdf.setFont("Helvetica", 10)
pdf.drawString(36, 12, "Figure 1: a diagram")
pdf.showPage()
pdf.save()
