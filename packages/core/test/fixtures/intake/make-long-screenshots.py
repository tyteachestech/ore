# Makes files/tall.png and files/wide.png: a full-page capture's shape, 900×10,000, and a wide one,
# 12,000×800, with words written for Ore (F188: Vision read the tall one wrongly in one pass).
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

out = Path(__file__).parent / "files"
font = ImageFont.truetype("DejaVuSans.ttf", 36)
tall = Image.new("RGB", (900, 10000), "white")
d = ImageDraw.Draw(tall)
d.text((30, 30), "TALL START: a long page of notes.", font=font, fill="black")
for i in range(20):
    d.text((30, 400 + i * 470), f"Section {i + 1}: learning marker {i + 1:02d}", font=font, fill="black")
d.text((30, 9900), "TALL END: final learning sentence.", font=font, fill="black")
tall.save(out / "tall.png", optimize=True)
wide = Image.new("RGB", (12000, 800), "white")
d = ImageDraw.Draw(wide)
for i in range(10):
    x = 60 + i * 1190
    d.text((x, 80), f"Column {i + 1}: spacing", font=font, fill="black")
    d.text((x, 160), f"marker {i + 1:02d} holds", font=font, fill="black")
d.text((60, 600), "WIDE END: one more line.", font=font, fill="black")
wide.save(out / "wide.png", optimize=True)
