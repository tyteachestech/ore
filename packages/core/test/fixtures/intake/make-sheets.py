# Makes files/vocab.xlsx: a learner's vocabulary workbook written for Ore (D122 gap 8): shared and
# inline strings, a date, a formula's saved value, percents (one a formula's, one to a decimal), a
# blank row and column to drop, an empty sheet, and its own title and author. Run: python3 make-sheets.py (needs openpyxl and LibreOffice, which
# resaves it the way Excel writes one: shared strings, formulas' values).
from datetime import date
from openpyxl import Workbook
import os

wb = Workbook()
ws = wb.active
ws.title = "Spanish"
ws.append(["Word", "Meaning", "Example", "Added", "Reviews"])
ws.append(["cocinar", "to cook", 'Sin sal, "cocinamos" mal.', date(2025, 3, 4), 3])
ws.append(["hornear", "to bake, to roast", "Hornear es esperar | de verdad.", date(2025, 3, 5), 5])
ws.append([])
ws.append(["hervir", "to boil", None, date(2025, 3, 6), None])
ws["E5"] = "=E2+E3"
ws["F1"] = "Right"
for cell, v, fmt in [("F2", 0.75, "0%"), ("F3", "=5/8", "0%"), ("F5", 1 / 3, "0.0%")]:
    ws[cell] = v
    ws[cell].number_format = fmt
wb.create_sheet("Empty")
notes = wb.create_sheet("Grammar")
notes.append(["Rule", "Example"])
notes.append(["Ser for what something is", "La sopa es rica."])
notes.append(["Estar for how it is now", "Estoy cansado."])
wb.properties.title = "Spanish vocabulary"
wb.properties.creator = "Ada Learner"
import subprocess, shutil, tempfile
tmp = tempfile.mkdtemp()
wb.save(os.path.join(tmp, "vocab.xlsx"))
subprocess.run(["soffice", "--headless", "--convert-to", "xlsx:Calc MS Excel 2007 XML", "--outdir", os.path.join(tmp, "out"), os.path.join(tmp, "vocab.xlsx")], check=True)
shutil.copy(os.path.join(tmp, "out", "vocab.xlsx"), os.path.join(os.path.dirname(__file__), "files", "vocab.xlsx"))
