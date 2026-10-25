import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from scipy import ndimage as ndi
R='/workspace/art/raw/'; O='/workspace/art/out/'
RES=2  # bitmapResolution

def remove_bg(path, thr=232):
    im=Image.open(path).convert('RGB'); a=np.asarray(im).astype(np.int16)
    mn=a.min(2); mx=a.max(2)
    white=(mn>thr)&((mx-mn)<25)
    lab,n=ndi.label(white)
    border=set(np.unique(np.concatenate([lab[0],lab[-1],lab[:,0],lab[:,-1]])))-{0}
    bg=np.isin(lab,list(border))
    # also enclosed white holes that are large & pure (e.g. between legs)
    sizes=ndi.sum(white,lab,range(n+1))
    for i in range(1,n+1):
        if i not in border and sizes[i]>1500:
            reg=lab==i
            if a[reg].min()>244: bg|=reg
    alpha=np.where(bg,0,255).astype(np.float32)
    # feather edge: fg pixels next to bg get alpha by darkness
    near=ndi.binary_dilation(bg,iterations=2)&~bg
    dark=np.clip((255-mn)/ (255-170),0,1)*255
    alpha[near]=np.maximum(dark[near],0)
    rgba=np.dstack([a.astype(np.uint8),alpha.astype(np.uint8)])
    return Image.fromarray(rgba,'RGBA')

def components(img, gap=12, minarea=800):
    al=np.asarray(img)[:,:,3]>20
    grown=ndi.binary_dilation(al,iterations=gap)
    lab,n=ndi.label(grown)
    out=[]
    for sl in ndi.find_objects(lab):
        sub=al[sl]
        if sub.sum()<minarea: continue
        out.append(sl)
    out.sort(key=lambda s:s[1].start)
    return [img.crop((s[1].start,s[0].start,s[1].stop,s[0].stop)) for s in out]

def tight(img):
    bb=img.getchannel('A').point(lambda v:255 if v>10 else 0).getbbox(); return img.crop(bb)

def fit(img, h=None, w=None):
    img=tight(img); W,H=img.size
    if h: s=h*RES/H
    else: s=w*RES/W
    return img.resize((max(1,round(W*s)),max(1,round(H*s))),Image.LANCZOS)

def save(img,name): img.save(O+name+'.png'); print(name,img.size)

# bull
run=components(remove_bg(R+'run_sheet.jpg'))
assert len(run)==4,len(run)
for i,c in enumerate(run): save(fit(c,h=72),f'bull_run{i+1}')
save(fit(components(remove_bg(R+'jump.jpg'))[0],h=74),'bull_jump')
sl=remove_bg(R+'slide.jpg'); save(fit(sl,h=44),'bull_slide')
# items
it=components(remove_bg(R+'items.jpg'))
print('items',len(it))
coin,boost,boom,crate,rocks=it[:5]
save(fit(coin,h=26),'coin'); save(fit(boost,h=36),'boost')
save(fit(crate,h=62),'crate'); save(fit(rocks,h=42),'rocks')
ob=components(remove_bg(R+'obst2.jpg'))
print('obst',len(ob))
hurdle,gate,hay=ob[:3]
save(fit(hurdle,h=36),'hurdle'); save(fit(gate,h=104),'gate'); save(fit(hay,h=80),'hay')

# backdrop & road
bg=Image.open(R+'bg.jpg').convert('RGB').resize((480*RES,360*RES),Image.LANCZOS)
bg.save(O+'backdrop.png')
road_top=int(183*RES)
road=bg.crop((0,road_top,480*RES,360*RES))
d=ImageDraw.Draw(road)
# second lane dash line at spx y=-122 -> px 302
# erase generated dash band (raw rows ~186-210) by copying road texture from above
band=road.crop((0,150,road.size[0],176)); road.paste(band,(0,186)); road.paste(road.crop((0,120,road.size[0],140)),(0,176))
road=road.filter(ImageFilter.SMOOTH) if False else road
d=ImageDraw.Draw(road)
for py in (260,310):
    yy=(py-183)*RES
    for x in range(20*RES,480*RES,96*RES):
        d.rounded_rectangle((x,yy-3,x+50*RES,yy+3),radius=3,fill=(250,244,225))
tile=Image.new('RGB',(960*RES,road.size[1])); tile.paste(road,(0,0)); tile.paste(road.transpose(Image.FLIP_LEFT_RIGHT),(480*RES,0))
tile.save(O+'road.png'); print('road',tile.size)

# panels
F='/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc'
pan=fit(components(remove_bg(R+'panel.jpg'),gap=4)[0],w=330)
def text(d,xy,s,size,fill,stroke=0,sf=(255,255,255)):
    f=ImageFont.truetype(F,size*RES)
    d.text(xy,s,font=f,fill=fill,anchor='mm',stroke_width=stroke*RES,stroke_fill=sf)
W,H=pan.size
t=pan.copy(); d=ImageDraw.Draw(t)
text(d,(W/2,H*0.36),'大角牛快跑',40,(200,70,20),3)
text(d,(W/2,H*0.53),'J 跳跃    K 滑铲    ↑↓ / W S 换道',12,(90,60,30))
text(d,(W/2,H*0.62),'手机：「跳」「滑」按钮 / 点左右半屏 · 上下滑换道',11,(90,60,30))
text(d,(W/2,H*0.71),'B 键 / 点右下角「商店」：买角色、地图和道具',11,(30,110,180))
text(d,(W/2,H*0.81),'按 空格 / 回车 或 点击屏幕 开始',15,(220,90,30))
save(t,'panel_title')
g=pan.copy(); d=ImageDraw.Draw(g)
text(d,(W/2,H*0.40),'游戏结束',40,(190,40,40),3)
text(d,(W/2,H*0.57),'看看左上角的分数和最高分吧！',13,(90,60,30))
text(d,(W/2,H*0.67),'本局金币已存入钱包 · B 键 / 点「商店」去逛逛',11,(30,110,180))
text(d,(W/2,H*0.79),'按 空格 / 回车 或 点击屏幕 再来一局',14,(220,90,30))
save(g,'panel_over')
# new record badge
b=Image.new('RGBA',(150*RES,46*RES),(0,0,0,0)); d=ImageDraw.Draw(b)
d.rounded_rectangle((2,2,b.size[0]-3,b.size[1]-3),radius=20*RES,fill=(255,80,60),outline=(120,20,10),width=3*RES)
text(d,(b.size[0]/2,b.size[1]/2-RES),'★ 新纪录！★',22,(255,240,120),2,(140,30,10))
save(b,'new_record')
# backdrop: paste cleaned road into the backdrop so editor preview matches
bd=Image.open(O+'backdrop.png'); bd.paste(Image.open(O+'road.png').crop((0,0,480*RES,road.size[1])),(0,road_top)); bd.save(O+'backdrop.png')
