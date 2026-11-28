# Makes files/stamps.pdf: a journal paper's pages as a typesetting service prints them (JMIR's, corpus run
# 2026-11-28): the renderer's stamp ("XSL• FO" over "RenderX") in a corner of every page, set larger than the
# text, a running foot with the page's number inside it, and the file's title left as an export link's id
# with its authors in a library manager's sort form. Run: python3 make-stamps-pdf.py (needs reportlab).
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
import os

c = canvas.Canvas(os.path.join(os.path.dirname(__file__), "files", "stamps.pdf"), pagesize=letter)
c.setTitle("1diPCNuI9me_eHeGoEPVRpWwr41NDF4ts?format=pdf&dat=ADGX7xH5CR8edQJdX-MlfVzhkZsdT21")
c.setAuthor("Brewer, William F.;Lichtenstein, Edward H.")
import textwrap
text = " ".join(
    f"On day {d} of the survey the {animal} in pool {p} {act}."
    for d, (animal, p, act) in enumerate(
        ((a, p, act) for p in ("one", "two", "three", "four", "five", "six") for a in ("snails", "crabs", "anemones", "limpets", "shrimp", "gobies", "barnacles") for act in ("grazed the algae", "hid under the ledge", "closed against the air", "waited for the tide")),
        start=1,
    )
)
lines = textwrap.wrap(text, 95)
for page in range(1, 6):
    y = 720
    if page == 1:
        c.setFont("Helvetica-Bold", 16)
        c.drawString(72, y, "Life Between the Tides")
        y -= 40
    c.setFont("Times-Roman", 10)
    for n in range(20):
        c.drawString(72, y, lines[(page - 1) * 20 + n])
        y -= 14
    c.setFont("Times-Roman", 8)
    c.drawString(72, 40, f"J Tide Stud 2021 | vol. 3 | iss. 9 | e251 | p. {page}https://tides.example.org/e251 (page number not for citation purposes)")
    c.setFont("Helvetica-Bold", 14)
    c.drawString(470, 60, "XSL• FO")
    c.setFont("Helvetica-Bold", 9)
    c.drawString(470, 48, "RenderX")
    c.showPage()
c.save()
