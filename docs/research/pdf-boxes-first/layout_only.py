import sys,time,json,glob,os
import fitz, numpy as np
from paddleocr import LayoutDetection
t0=time.time(); m=LayoutDetection(model_name="PP-DocLayoutV3"); print('load',round(time.time()-t0,1),flush=True)
out={}
for f in sorted(glob.glob('/mnt/project-files/pdf-race/samples/*.pdf')):
    name=os.path.basename(f)[:-4]; doc=fitz.open(f); pages=[]
    for i,pg in enumerate(doc):
        tr=time.time(); pix=pg.get_pixmap(matrix=fitz.Matrix(2,2),alpha=False)
        img=np.frombuffer(pix.samples,dtype=np.uint8).reshape(pix.height,pix.width,3)[:,:,::-1].copy(); tr=time.time()-tr
        tl=time.time(); r=m.predict(img,batch_size=1,layout_nms=True)[0]; tl=time.time()-tl
        boxes=[{'label':b['label'],'score':float(b['score']),'bbox':[float(x) for x in b['coordinate']]} for b in r['boxes']]
        pages.append({'page':i+1,'width':pix.width,'height':pix.height,'render':tr,'layout':tl,'blocks':boxes})
        print(name,i+1,round(tr,2),round(tl,2),len(boxes),flush=True)
    out[name]=pages
json.dump(out,open('layout.json','w'))
