# Writes word-equations.docx (written for Ore, deep import pass 2026-11-27): Word's own equation markup (OMML)
# inline and on its own line: a fraction, a power, a root, a sum with limits, brackets, Greek, a subscript.
# The package is word-equation.docx with a new body. Run: python3 make-word-equations.py
import zipfile

M = 'xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"'


def r(t):
    return f'<m:r><m:t>{t}</m:t></m:r>'


body = (
    '<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Spacing and the forgetting curve</w:t></w:r></w:p>'
    '<w:p><w:r><w:t xml:space="preserve">Retention after a day is </w:t></w:r>'
    f'<m:oMath><m:f><m:num>{r("1")}</m:num><m:den>{r("2")}</m:den></m:f></m:oMath>'
    '<w:r><w:t xml:space="preserve"> and the stability grows as </w:t></w:r>'
    f'<m:oMath><m:sSup><m:e>{r("S")}</m:e><m:sup>{r("2")}</m:sup></m:sSup></m:oMath>'
    '<w:r><w:t xml:space="preserve"> with each review.</w:t></w:r></w:p>'
    f'<w:p><m:oMathPara><m:oMath>{r("R=")}<m:sSup><m:e>{r("e")}</m:e><m:sup>{r("−t/S")}</m:sup></m:sSup></m:oMath></m:oMathPara></w:p>'
    '<w:p><w:r><w:t xml:space="preserve">Summed over every review:</w:t></w:r></w:p>'
    f'<w:p><m:oMathPara><m:oMath><m:nary><m:naryPr><m:chr m:val="∑"/></m:naryPr><m:sub>{r("i=1")}</m:sub><m:sup>{r("n")}</m:sup>'
    f'<m:e><m:sSub><m:e>{r("α")}</m:e><m:sub>{r("i")}</m:sub></m:sSub><m:rad><m:radPr><m:degHide m:val="1"/></m:radPr><m:deg/><m:e>{r("t")}</m:e></m:rad></m:e></m:nary>'
    f'{r("=")}<m:d><m:e>{r("a+b")}</m:e></m:d></m:oMath></m:oMathPara></w:p>'
    '<w:p><w:r><w:t>That is the whole model.</w:t></w:r></w:p>'
)
src = zipfile.ZipFile('word-equation.docx')
doc = src.read('word/document.xml').decode()
head = doc[:doc.index('<w:body>') + len('<w:body>')]
if 'xmlns:m=' not in head:
    head = head.replace('<w:document ', f'<w:document {M} ', 1)
with zipfile.ZipFile('word-equations.docx', 'w', zipfile.ZIP_DEFLATED) as out:
    for i in src.infolist():
        data = (head + body + '</w:body></w:document>').encode() if i.filename == 'word/document.xml' else src.read(i.filename)
        out.writestr(i, data)
