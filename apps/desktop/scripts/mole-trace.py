"""Traces the mole of ChatGPT's concept 4 (docs/design/mole-concept-4.png) dot by dot into apps/desktop/src/mole-fine-data.ts
(D250). Finds every dot (a disc brighter than the ring round it), splits them into his parts (helmet, lamp, fur, nose,
moustache lobes, paws), puts fur on his own dot pitch under every part that can move off it, and places the eyes, which
are black on a dark page and can't be found. Run: python3 apps/desktop/scripts/mole-trace.py (needs Pillow and numpy)."""
import os
from PIL import Image
import numpy as np
HERE=os.path.dirname(os.path.abspath(__file__))
SRC=os.path.join(HERE,'../../../docs/design/mole-concept-4.png')
def trace(S=4, R=3.0, mind=6.0, thr=0.10):
    im=Image.open(SRC).convert('RGB')
    W,H=im.size
    big=im.resize((W*S,H*S),Image.BICUBIC)
    a=np.asarray(big).astype(float)
    bg=np.array([16,16,21.])
    d=np.abs(a-bg).sum(2)/ (3*255)
    # disc minus ring score via box sums on shifted arrays
    r=int(R*S); yy,xx=np.mgrid[-2*r:2*r+1,-2*r:2*r+1]; rr=np.hypot(yy,xx)
    disc=(rr<=r*0.8).astype(float); ring=((rr>r*1.25)&(rr<=r*1.7)).astype(float)
    k=disc/disc.sum()-ring/ring.sum()
    from numpy.fft import rfft2, irfft2
    P=np.zeros_like(d); 
    K=np.zeros_like(d); kh,kw=k.shape; K[:kh,:kw]=k; K=np.roll(K,(-(kh//2),-(kw//2)),(0,1))
    sc=irfft2(rfft2(d)*np.conj(rfft2(K)),d.shape)
    # NMS
    pts=[]; s=sc.copy(); md=int(mind*S)
    while True:
        i=np.argmax(s); y,x=divmod(i,s.shape[1]); v=s[y,x]
        if v<thr*0.25: break
        y0,y1,x0,x1=max(0,y-md),y+md+1,max(0,x-md),x+md+1
        Y,X=np.mgrid[y0:min(s.shape[0],y1),x0:min(s.shape[1],x1)]
        s[y0:y1,x0:x1][np.hypot(Y-y,X-x)<md]=-1
        if v<thr*0.25: continue
        # colour: mean of centre patch
        c=a[max(0,y-S):y+S+1,max(0,x-S):x+S+1].reshape(-1,3).mean(0)
        peak=d[max(0,y-S):y+S+1,max(0,x-S):x+S+1].mean()
        if peak<0.03: continue
        # radius: area where d>peak/2 within window
        win=d[max(0,y-2*r):y+2*r+1,max(0,x-2*r):x+2*r+1]
        Yw,Xw=np.mgrid[0:win.shape[0],0:win.shape[1]]
        cy,cx=min(y,2*r),min(x,2*r)
        m=(win>peak*0.5)&(np.hypot(Yw-cy,Xw-cx)<r*1.5)
        rad=np.sqrt(m.sum()/np.pi)/S
        pts.append([round(x/S,2),round(y/S,2),round(float(rad),2),[int(v) for v in c],round(float(v),3)])
    return pts
img=np.asarray(Image.open(SRC).convert('RGB')).astype(float)
D=[d for d in trace() if d[1]>20]
br=lambda c: sum(c)/3
D.sort(key=lambda d:-d[4]); K=[]
for d in D:
    if all((d[0]-k[0])**2+(d[1]-k[1])**2>5.0**2 for k in K): K.append(d)
print('dedupe',len(D),'->',len(K)); D=K
dirt=sorted([d for d in D if d[1]>246], key=lambda d:d[0])
PITCH=float(np.median(np.diff([d[0] for d in dirt]))); CX=(dirt[-1][0]+dirt[0][0])/2; DY=sum(d[1] for d in dirt)/len(dirt)
print('pitch',PITCH,'cx',CX,'dirtY',DY,'ndirt',len(dirt))
parts={k:[] for k in ['gap','helmet','lamp','fur','eyeL','eyeR','glintL','glintR','nose','lobeL','lobeR','pawL','pawR','shade']}
for x,y,r,c,v in D:
    if y>246: continue
    b=br(c)
    if c[0]>c[2]+60 and c[1]>c[2]+25:
        if b>140: parts['lamp'].append((x,y,r,c))
        continue
    if c[0]>c[1]+35: parts['nose'].append((x,y,r,c)); continue
    if b>=228 and y>205 and (x<72 or x>234): parts['pawL' if x<CX else 'pawR'].append((x,y,r,c)); continue
    if b>=215 and 125<y<150 and 60<x<250: parts['glintL' if x<CX else 'glintR'].append((x,y,r,c)); continue
    if b>=205 and y>150: parts['lobeL' if x<CX else 'lobeR'].append((x,y,r,c)); continue
    if y<119 or (y<152 and (x<72 or x>262)): parts['helmet'].append((x,y,r,c)); continue
    parts['fur'].append((x,y,r,c))
for k,v in parts.items(): print(k,len(v))
# lattice fit on fur
fur=np.array([(x,y) for x,y,r,c in parts['fur']])
best=None
for ox in np.arange(0,PITCH,0.25):
    for oy in np.arange(0,PITCH,0.25):
        rx=(fur[:,0]-ox+PITCH/2)%PITCH-PITCH/2; ry=(fur[:,1]-oy+PITCH/2)%PITCH-PITCH/2
        e=(np.minimum(np.abs(rx),2)**2+np.minimum(np.abs(ry),2)**2).sum()
        if best is None or e<best[0]: best=(e,ox,oy)
_,OX,OY=best; print('lattice',OX,OY)
# head silhouette: union of discs around every traced non-dirt dot below the helmet top, restricted; simpler: site is inside if within the hull of fur/lobe dots row-wise
allpts=[(x,y) for k in ['fur','lobeL','lobeR','nose','glintL','glintR'] for x,y,r,c in parts[k]]
def inside(x,y):
    # head: a superellipse dome from under the helmet to the dirt
    top=62; bottom=DY
    hw=108 if y>150 else 108-((150-y)/(150-top))**2.2*40
    if y<top or y>bottom-PITCH*0.6: return False
    return abs(x-CX)<=hw
occupied=lambda x,y,pts,rad: any((px-x)**2+(py-y)**2<rad*rad for px,py,*_ in pts)
def furcolor(x,y):
    w=0; s=0
    for px,py,r,c in parts['fur']:
        d2=(px-x)**2+(py-y)**2
        if d2<(PITCH*3.2)**2:
            ww=1/(d2+4); w+=ww; s+=ww*br(c)
    return s/w if w else 120
fill=[]
for i in range(-2,40):
    for j in range(-2,40):
        x=OX+i*PITCH; y=OY+j*PITCH
        if not inside(x,y): continue
        if occupied(x,y,parts['fur'],PITCH*0.62): continue
        # image brightness at the site
        yi,xi=int(round(y)),int(round(x))
        if not (0<=yi<img.shape[0] and 0<=xi<img.shape[1]): continue
        pix=img[max(0,yi-1):yi+2,max(0,xi-1):xi+2].mean()
        covered=any(occupied(x,y,parts[k],PITCH*0.7) for k in ['helmet','lamp','lobeL','lobeR','pawL','pawR','nose','glintL','glintR'])
        near_eye=(118<y<158) and (70<abs(x-CX)<10*0+ 75+0) 
        fill.append((x,y,pix,covered))
# eyes: empty dark sites near the glints
gl={s:parts['glint'+s][0] for s in 'LR' if parts['glint'+s]}
print('glints',gl)
under=[]; parts['gap']=[]
body=[(px,py) for k in ['fur','lobeL','lobeR','nose'] for px,py,_,_ in parts[k]]
def span(x,y):
    xs=[px for px,py in body if abs(py-y)<PITCH*0.6]
    return bool(xs) and min(xs)-2<=x<=max(xs)+2
eyes={}
for sd in 'LR':
    gx,gy,_,_=gl[sd]
    sx=OX+round((gx-OX)/PITCH)*PITCH; sy=OY+round((gy-OY)/PITCH)*PITCH
    eyes[sd]=[(sx-PITCH,sy),(sx,sy),(sx-PITCH,sy+PITCH),(sx,sy+PITCH)]
    parts['glint'+sd]=[(sx+1.2,sy-1.2,3.0,[245,245,245])]
    for ex,ey in eyes[sd]: parts['eye'+sd].append((ex,ey,4.6,[6,6,7]))
    # the traced part-dots of the socket go; a lid of fur sits under each eye dot
    parts['fur']=[f for f in parts['fur'] if all((f[0]-ex)**2+(f[1]-ey)**2>(PITCH*0.7)**2 for ex,ey in eyes[sd]) and not (br(f[3])<70 and abs(f[0]-sx+PITCH/2)<PITCH*2.2 and abs(f[1]-sy-PITCH/2)<PITCH*1.8)]
for i in range(-2,40):
    for j in range(-2,40):
        x=OX+i*PITCH; y=OY+j*PITCH
        if not inside(x,y) or occupied(x,y,parts['fur'],PITCH*0.62): continue
        yi,xi=int(round(y)),int(round(x))
        pix=img[max(0,yi-1):yi+2,max(0,xi-1):xi+2].mean() if (0<=yi<img.shape[0] and 0<=xi<img.shape[1]) else 16
        covered=any(occupied(x,y,parts[k],PITCH*0.7) for k in ['helmet','lamp','lobeL','lobeR','pawL','pawR','nose','eyeL','eyeR'])
        if covered: under.append((x,y,3.2,[furcolor(x,y)]*3))
        elif abs(x-CX)<PITCH*1.2 and y>175: parts['gap'].append((x,y,3.2,[52]*3))
        elif 119<y<165 and abs(x-CX)<95: under.append((x,y,3.0,[furcolor(x,y)*0.6]*3))
        elif y>=165 and span(x,y): under.append((x,y,3.0,[furcolor(x,y)*0.42]*3))
parts['fur']+=under
for k,v in parts.items(): print(k,len(v))
# rows of fur and arm below the dirt line, for a hop and a raised paw
ext={}
for k in ['fur','pawL','pawR']:
    low=[p for p in parts[k] if p[1]>DY-PITCH*1.6]
    ext[k]=[(x,y+n*PITCH,r,c) for x,y,r,c in low for n in range(1,7)]
ts='/* Traced dot by dot from concept 4 (docs/design/mole-concept-4.png) by apps/desktop/scripts/mole-trace.py: x from his middle, y up from the\n   dirt (negative), radius, all in dots of his own pitch; then a grey from 0 (black) to 255. Generated: do not edit. */\n'
ts+='export const PARTS: Record<string, number[]> = {\n'
for k in ['fur','gap','eyeL','eyeR','glintL','glintR','nose','lobeL','lobeR','helmet','lamp','pawL','pawR']:
    v=parts[k]+ext.get(k,[])
    flat=[]
    for x,y,r,c in v: flat+=[round((x-CX)/PITCH,2),round((y-DY)/PITCH,2),round(min(r,3.7 if not k.startswith('eye') else 4.6)/PITCH,2),int(round(br(c)))]
    ts+='  %s: [%s],\n'%(k,','.join(('%g'%n) for n in flat))
ts+='};\n'
open(os.path.join(HERE,'../src/mole-fine-data.ts'),'w').write(ts); print(len(ts),'bytes')
