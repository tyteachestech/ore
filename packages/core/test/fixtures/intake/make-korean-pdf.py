# Makes files/korean.pdf: a short Korean lesson written for Ore, set in a CJK font the PDF names but
# does not carry (reportlab's HYSMyeongJo with the UniKS-UCS2-H encoding, as many Korean PDFs are), so
# reading its text needs the CMaps. Run: python3 make-korean-pdf.py (needs reportlab).
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
import os

pdfmetrics.registerFont(UnicodeCIDFont("HYSMyeongJo-Medium"))
out = os.path.join(os.path.dirname(__file__), "files", "korean.pdf")
c = canvas.Canvas(out, pagesize=(612, 792), pageCompression=0)
c.setTitle("")
y = 720
for size, t in [
    (18, "기억을 오래 남기는 방법"),
    (11, "간격을 두고 복습하면 배운 내용을 더 오래 기억할 수 있다. 다시 읽기보다"),
    (11, "스스로 떠올리는 연습이 기억을 더 단단하게 만든다. 고양이처럼 조용히"),
    (11, "앉아서 오늘 배운 단어를 하나씩 떠올려 보자. 틀린 문제는 다음 날 다시"),
    (11, "풀어 보면 된다. 작은 습관이 큰 차이를 만든다."),
]:
    c.setFont("HYSMyeongJo-Medium", size)
    c.drawString(72, y, t)
    y -= size + 8
c.save()

# files/punctuation.pdf: what that PDF read as before (its punctuation and list numbers only), which is no text.
out = os.path.join(os.path.dirname(__file__), "files", "punctuation.pdf")
c = canvas.Canvas(out, pagesize=(612, 792), pageCompression=0)
c.setFont("Helvetica", 11)
for i, t in enumerate([". . .", ". . . . .", "1. . . . 2. . . .", ". . . , . . .", "3. . . ."]):
    c.drawString(72, 720 - i * 20, t)
c.save()
