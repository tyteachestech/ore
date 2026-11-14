from pathlib import Path
import fitz,zipfile,json,base64,plistlib,subprocess,unicodedata
from PIL import Image,ImageDraw,ImageFont
p=Path('codex-out/intake/fixtures');p.mkdir(exist_ok=True)
text='Café learning notes\n\nA naïve learner measures température in degrees.\n\nFinal sentence: voilà, résumé complete.'
(p/'latin1.txt').write_bytes(text.encode('latin-1'));(p/'utf16.txt').write_bytes(text.encode('utf-16'));(p/'zero.txt').write_bytes(b'')
(p/(unicodedata.normalize('NFD','🧠 café ∕ notes')+'.md')).write_text('# Unusual filename lesson\n\nSTART UNUSUAL. Learning works through retrieval.\n\n## Conclusion\n\nEND UNUSUAL.')
(p/'folder-drop').mkdir(exist_ok=True);(p/'folder-drop'/'inside.md').write_text('# Inside folder\n\nDo not silently ignore me.')
for n in ['one','two']:(p/f'drop-{n}.md').write_text(f'# Drop {n} lesson\n\nSTART {n}. Retrieval improves memory.\n\nEND {n}.')
font=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',36)
im=Image.new('RGB',(900,600),'white');d=ImageDraw.Draw(im)
d.text((40,40),'Scan learning lesson',font=font,fill='black');d.text((40,140),'START SCAN: Retrieval strengthens memory.',font=font,fill='black');d.text((40,420),'END SCAN: Practice tomorrow.',font=font,fill='black');im.save(p/'screenshot.png')
tall=Image.new('RGB',(900,10000),'white');d=ImageDraw.Draw(tall)
for i in range(20):d.text((30,30+i*500),f'Section {i+1}: learning marker {i+1:02d}',font=font,fill='black')
d.text((30,9900),'END TALL: final learning sentence.',font=font,fill='black');tall.save(p/'tall.png')
im2=Image.new('RGB',(400,200),'white');d=ImageDraw.Draw(im2);d.rectangle((40,40,300,150),fill='blue');im2.save(p/'plot.png')
doc=fitz.open();pg=doc.new_page(width=900,height=600);pg.insert_image(pg.rect,filename=str(p/'screenshot.png'));doc.save(p/'scanned.pdf')
for name,count,wide in [('slides',3,True),('long600',600,False),('locked',1,False)]:
 doc=fitz.open()
 for i in range(count):
  pg=doc.new_page(width=720 if wide else 595,height=405 if wide else 842);pg.insert_text((40,55),f'{name.title()} Learning - page {i+1}',fontsize=24);pg.insert_text((40,110),f'START PAGE {i+1:03d}: retrieval strengthens memory.',fontsize=13);pg.insert_text((40,200),f'END PAGE {i+1:03d}: practice this lesson tomorrow.',fontsize=13)
 doc.set_metadata({'title':f'{name.title()} Learning','author':'Ore Fixture Author','creationDate':'D:20261114090000'})
 if name=='locked':doc.save(p/f'{name}.pdf',encryption=fitz.PDF_ENCRYPT_AES_256,owner_pw='owner-secret',user_pw='learner-secret')
 else:doc.save(p/f'{name}.pdf')
for foot in [False,True]:
 name='epub-footnotes' if foot else 'epub-no-toc'
 with zipfile.ZipFile(p/f'{name}.epub','w') as z:
  z.writestr('mimetype','application/epub+zip');z.writestr('META-INF/container.xml','<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0"><rootfiles><rootfile full-path="OEBPS/book.opf" media-type="application/oebps-package+xml"/></rootfiles></container>')
  z.writestr('OEBPS/book.opf',f'''<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">{name}</dc:identifier><dc:title>{name} Learning</dc:title><dc:creator>Ore Fixture Author</dc:creator><dc:date>2026-11-14</dc:date><dc:language>en</dc:language></metadata><manifest><item id="a" href="a.xhtml" media-type="application/xhtml+xml"/><item id="b" href="b.xhtml" media-type="application/xhtml+xml"/><item id="pic" href="plot.png" media-type="image/png"/></manifest><spine><itemref idref="a"/><itemref idref="b"/></spine></package>''')
  note='<p>Retrieval is helpful<a epub:type="noteref" href="b.xhtml#fn1">1</a>.</p>' if foot else ''
  z.writestr('OEBPS/a.xhtml',f'<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><body><h1>First lesson</h1><p>START EPUB: learning through practice.</p>{note}<img src="plot.png" alt="Blue learning chart"/><table><tr><th>Method</th><th>Score</th></tr><tr><td>Recall</td><td>9</td></tr></table><pre><code>def learn():\n    return 42</code></pre></body></html>')
  note='<aside epub:type="footnote" id="fn1"><p>FOOTNOTE EVIDENCE: spacing separates practice.</p></aside>' if foot else ''
  z.writestr('OEBPS/b.xhtml',f'<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><body><h1>Final lesson</h1><p>END EPUB: use the idea tomorrow.</p>{note}</body></html>');z.write(p/'plot.png','OEBPS/plot.png')
md='''---
title: Office Learning
author: Ore Fixture Author
date: 2026-11-14
---
# First lesson

START OFFICE: retrieval improves memory.[^1]

![Blue learning chart](plot.png)

| Method | Score |
|---|---|
| Recall | 9 |

```python
def learn():
    return 42
```

# Final lesson

END OFFICE: practice tomorrow.

[^1]: FOOTNOTE EVIDENCE: spacing separates practice.
'''
(p/'office.md').write_text(md)
subprocess.run(['pandoc','office.md','-o','office.docx'],cwd=p,check=True)
subprocess.run(['pandoc','office.md','-o','notes.pptx'],cwd=p,check=True)
# OOXML edits add genuine revision and comment structures.
with zipfile.ZipFile(p/'office.docx') as z: files={n:z.read(n) for n in z.namelist()}
x=files['word/document.xml'].decode();ins='<w:p><w:del w:id="44" w:author="Reviewer" w:date="2026-11-14T12:00:00Z"><w:r><w:delText>DELETED CLAIM: massed practice always wins.</w:delText></w:r></w:del><w:ins w:id="45" w:author="Reviewer" w:date="2026-11-14T12:01:00Z"><w:r><w:t>INSERTED CORRECTION: spaced practice wins.</w:t></w:r></w:ins></w:p><w:p><w:commentRangeStart w:id="0"/><w:r><w:t>Commented learning passage.</w:t></w:r><w:commentRangeEnd w:id="0"/><w:r><w:commentReference w:id="0"/></w:r></w:p>'
x=x.replace('<w:sectPr',ins+'<w:sectPr');files['word/document.xml']=x.encode();files['word/comments.xml']=b'<w:comments xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:comment w:id="0" w:author="Reviewer" w:date="2026-11-14T12:00:00Z"><w:p><w:r><w:t>COMMENT EVIDENCE: check the study sample.</w:t></w:r></w:p></w:comment></w:comments>'
r=files['word/_rels/document.xml.rels'].decode().replace('</Relationships>','<Relationship Id="rComments" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments" Target="comments.xml"/></Relationships>');files['word/_rels/document.xml.rels']=r.encode();files['[Content_Types].xml']=files['[Content_Types].xml'].replace(b'</Types>',b'<Override PartName="/word/comments.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml"/></Types>')
with zipfile.ZipFile(p/'office.docx','w') as z:
 for n,data in files.items():z.writestr(n,data)
slide='''---
title: Slides With Speaker Notes
author: Ore Fixture Author
date: 2026-11-14
---
# First slide

START SLIDES: Retrieval improves memory.

::: notes
SPEAKER NOTE FIRST: ask learners to close their books.
:::

# Final slide

END SLIDES: Practice tomorrow.

::: notes
SPEAKER NOTE LAST: schedule another session next week.
:::
'''
(p/'notes.md').write_text(slide);subprocess.run(['pandoc','notes.md','-o','notes.pptx'],cwd=p,check=True)
png=base64.b64encode((p/'plot.png').read_bytes()).decode();nb={'nbformat':4,'nbformat_minor':5,'metadata':{'title':'Notebook learning','authors':[{'name':'Ore Fixture Author'}]},'cells':[{'cell_type':'markdown','metadata':{},'source':['# Notebook learning\n','START NOTEBOOK: inspect the blue chart.']},{'cell_type':'code','metadata':{},'execution_count':1,'source':['print("learning")'],'outputs':[{'output_type':'display_data','metadata':{},'data':{'image/png':png,'text/plain':['Blue chart output']}}]},{'cell_type':'markdown','metadata':{},'source':['## Conclusion\nEND NOTEBOOK: chart survived.']}]};(p/'outputs.ipynb').write_text(json.dumps(nb))
(p/'learning.rtf').write_text(r'{\rtf1\ansi{\info{\title RTF Learning}{\author Ore Fixture Author}}\b RTF Learning\b0\par START RTF: retrieval strengthens memory.\par Footnote claim{\footnote FOOTNOTE RTF: use spaced practice.}\par END RTF: practice tomorrow.}')
(p/'learning.csv').write_text('Method,Description,Score\nRecall,"Line one\nLine two, with a comma",9\nSpacing,"He said ""practice""",10\n')
html=b'<html><head><title>Webarchive Learning</title><meta name="author" content="Ore Fixture Author"></head><body><article><h1>Webarchive Learning</h1><p>START WEBARCHIVE: retrieval improves memory by practicing recall. This page is original synthetic learning content written for the Ore import test. Every passage should survive capture.</p><h2>Final lesson</h2><p>END WEBARCHIVE: space practice across several days for long term retention.</p></article></body></html>'
(p/'learning.webarchive').write_bytes(plistlib.dumps({'WebMainResource':{'WebResourceData':html,'WebResourceFrameName':'','WebResourceMIMEType':'text/html','WebResourceTextEncodingName':'UTF-8','WebResourceURL':'https://example.org/learning'},'WebSubresources':[]},fmt=plistlib.FMT_BINARY))
(p/'chapters.ffmeta').write_text(';FFMETADATA1\ntitle=Chaptered Audio Learning\nartist=Ore Fixture Author\n[CHAPTER]\nTIMEBASE=1/1000\nSTART=0\nEND=4000\ntitle=Recall chapter\n[CHAPTER]\nTIMEBASE=1/1000\nSTART=4000\nEND=12000\ntitle=Spacing chapter\n')
print('Created',len(list(p.iterdir())),'fixtures')
