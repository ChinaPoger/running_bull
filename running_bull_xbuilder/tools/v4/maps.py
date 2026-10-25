# 新地图：沙漠（草地→沙丘色、天空偏暖）、夜晚（整体压暗偏蓝 + 星星 + 月亮）；路面同样调色
import numpy as np, random
from PIL import Image, ImageDraw, ImageFilter
O='/workspace/art/out/'
def hsv(im):
    a=np.asarray(im.convert('RGBA')).astype(np.float32)/255; rgb=a[...,:3]
    h=np.asarray(im.convert('RGB').convert('HSV')).astype(np.float32)
    return a,h
def desert(src,dst,road=False):
    im=Image.open(src).convert('RGBA'); alpha=im.split()[3]
    h=np.asarray(im.convert('RGB').convert('HSV')).astype(np.float32)
    H,Sat,V=h[...,0],h[...,1],h[...,2]
    green=(H>35)&(H<120)&(Sat>50)          # PIL 的 H 是 0-255
    H2=np.where(green,24+ (H-35)*0.08,H); S2=np.where(green,Sat*0.75,Sat); V2=np.where(green,np.minimum(255,V*1.08+18),V)
    if road: H2=np.where(~green,np.clip(H*0.9+2,0,255),H2); S2=np.where(~green,np.minimum(255,Sat*1.15),S2)
    sky=(H>120)&(H<180)
    S2=np.where(sky,Sat*0.55,S2); V2=np.where(sky,np.minimum(255,V*1.05+10),V2)
    out=Image.fromarray(np.stack([H2,S2,V2],-1).astype(np.uint8),'HSV').convert('RGB').convert('RGBA'); out.putalpha(alpha)
    out.save(O+dst)
def night(src,dst,stars=False):
    im=Image.open(src).convert('RGBA'); a=np.asarray(im).astype(np.float32)
    a[...,0]*=0.38; a[...,1]*=0.45; a[...,2]=a[...,2]*0.62+20
    out=Image.fromarray(np.clip(a,0,255).astype(np.uint8),'RGBA')
    if stars:
        d=ImageDraw.Draw(out); r=random.Random(3); W,H=out.size
        for _ in range(90):
            x,y=r.randint(0,W),r.randint(0,int(H*0.36)); s=r.choice([1,1,2,2,3])
            d.ellipse((x-s,y-s,x+s,y+s),fill=(255,250,220,255))
        glow=Image.new('RGBA',out.size,(0,0,0,0)); g=ImageDraw.Draw(glow); mx,my=int(W*0.82),int(H*0.12)
        g.ellipse((mx-70,my-70,mx+70,my+70),fill=(255,250,200,70)); glow=glow.filter(ImageFilter.GaussianBlur(25)); out.alpha_composite(glow)
        d=ImageDraw.Draw(out); d.ellipse((mx-36,my-36,mx+36,my+36),fill=(255,248,210,255)); d.ellipse((mx-8,my-10,mx+4,my+2),fill=(235,228,190,255)); d.ellipse((mx+10,my+8,mx+20,my+18),fill=(235,228,190,255))
    out.save(O+dst)
desert(O+'backdrop.png','backdrop_desert.png'); desert(O+'road.png','road_desert.png',True)
night(O+'backdrop.png','backdrop_night.png',True); night(O+'road.png','road_night.png')
s=Image.new('RGB',(960,1080))
for i,n in enumerate(['backdrop','backdrop_desert','backdrop_night']):
    b=Image.open(O+n+'.png').convert('RGBA').resize((480,360)); r=Image.open(O+('road' if i==0 else ['','road_desert','road_night'][i])+'.png').convert('RGBA')
    r=r.crop((0,0,960,354)).resize((480,177)); b.alpha_composite(r,(0,360-177-2)); s.paste(b.convert('RGB'),(0,i*360))
s.save('/tmp/maps.png'); print('ok')
