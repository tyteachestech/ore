# Run: python3 make-mixed-scan-pdf.py (needs ReportLab).
# The middle page reuses the image and OCR transcript from the scanned-PDF test.
from pathlib import Path

from reportlab import rl_config
from reportlab.pdfgen import canvas


files = Path(__file__).resolve().parent / "files"
width, height = 720, 432
rl_config.useA85 = 0
pdf = canvas.Canvas(str(files / "mixed-scan.pdf"), pagesize=(width, height), invariant=True)
pdf.setTitle("Practice over time")
pdf.setAuthor("Ada Lovelace")


def text_page(heading, lines):
    pdf.setFont("Helvetica-Bold", 24)
    pdf.drawString(36, 310, heading)
    pdf.setFont("Helvetica", 12)
    for i, line in enumerate(lines):
        pdf.drawString(36, 270 - i * 18, line)
    pdf.showPage()


text_page("Before practice", [
    "Pick one idea you want to remember by the end of the week.",
    "Write it down with a question you can ask yourself tomorrow.",
    "Put the answer somewhere you can check it later.",
    "Set the source aside and give yourself a little time.",
    "Then try to recall the idea in your own words.",
])
pdf.drawImage(str(files / "screenshot.png"), 0, 0, width, height)
pdf.showPage()
text_page("After practice", [
    "Check your answer against the source and correct any mistakes.",
    "Try the question again a few days later to see what stayed with you.",
    "Give the ideas you remember easily more time between reviews.",
    "Return sooner to the ideas you had to look up.",
    "Keep adjusting the gaps as your answers improve.",
])
pdf.save()
