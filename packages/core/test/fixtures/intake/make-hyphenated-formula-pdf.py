# Makes files/hyphenated-formula.pdf (requires reportlab). Text written for Ore.
from pathlib import Path
from reportlab import rl_config
from reportlab.pdfgen import canvas

rl_config.useA85 = 0
c = canvas.Canvas(str(Path(__file__).parent / "files/hyphenated-formula.pdf"), invariant=1, pageCompression=1)
c.setTitle("Comparing two models")
c.setAuthor("Maya Reed")
c.setFont("Helvetica-Bold", 18)
c.drawString(72, 740, "Two ways to model change")
c.setFont("Helvetica", 12)
c.drawString(72, 710, "The first model squares its input:")
c.drawString(120, 680, "f")
c.setFont("Helvetica", 8)
c.drawString(125, 677, "non-linear")
c.setFont("Helvetica", 12)
c.drawString(160, 680, "(x) = x")
c.setFont("Helvetica", 8)
c.drawString(192, 686, "2")
c.setFont("Helvetica", 12)
c.drawString(72, 645, "The second model takes the difference:")
c.drawString(120, 615, "d = x-y")
c.drawString(72, 580, "Both models take the same measurements.")
c.save()
