# Makes files/scripts.pdf: one page of learning notes in other scripts (D122 gap 4), each written for
# Ore: Russian, Greek, Japanese and Chinese lines that wrap mid-sentence, and Arabic set the way word
# processors write it (shaped letters, right to left). Run: python3 make-scripts-pdf.py
# (needs reportlab, arabic-reshaper and python-bidi; the DejaVu Sans and WenQuanYi Zen Hei fonts).
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from bidi.algorithm import get_display
import arabic_reshaper
import os

pdfmetrics.registerFont(TTFont("DV", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"))
pdfmetrics.registerFont(TTFont("WQ", "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc", subfontIndex=0))
out = os.path.join(os.path.dirname(__file__), "files", "scripts.pdf")
c = canvas.Canvas(out, pagesize=(612, 792), pageCompression=0)
c.setTitle("")
y = 720


def para(font, lines, size=11, right=False):
    global y
    c.setFont(font, size)
    for t in lines:
        if right:
            c.drawRightString(540, y, get_display(arabic_reshaper.reshape(t)))
        else:
            c.drawString(72, y, t)
        y -= size + 4
    y -= 14


para("DV", ["Память и повторение"], 18)
para("DV", ["Интервальные повторения помогают запоминать надолго: каждый раз,", "когда мы вспоминаем факт, он держится дольше, а перерыв между", "повторениями можно увеличивать."])
para("DV", ["Η ανάκληση ενισχύει τη μνήμη περισσότερο από", "την απλή ανάγνωση, γιατί κάθε προσπάθεια να θυμηθούμε", "κάνει το ίχνος πιο σταθερό."])
para("WQ", ["間隔をあけて復習すると、長く覚えていられる。思い出す", "練習が記憶を強くする。読み返すだけでは、わかった気に", "なるだけだ。"])
para("WQ", ["学习的关键在于主动回忆，而不是", "反复阅读。每次回忆都会让记忆更加", "牢固。"])
para("DV", ["التكرار المتباعد يساعد على التذكر،", "والاسترجاع يقوي الذاكرة أكثر من القراءة،", "لأن كل محاولة للتذكر تثبت المعلومة."], right=True)
c.save()
