# 用 Pillow 精确绘制带纵深（斜 45° 透视）的低栏和高栏，分成 back / front 两层
from PIL import Image, ImageDraw, ImageFilter
O='/workspace/art/out/'
RES=2; S=8                 # 输出 2x；绘制时 8x 超采样
W,H=90,140; PX,PY=45,110   # 画布（显示像素）和支点（脚底/跑道中心）
OUT=(58,34,20,255)         # 卡通深色描边
def P(x,y): return ((x+PX)*S,(PY-y)*S)
def new(): return Image.new('RGBA',(W*S,H*S),(0,0,0,0))
def poly(d,pts,fill,ow=1.3):
    pp=[P(*p) for p in pts]; d.polygon(pp,fill=fill)
    d.line(pp+[pp[0]],fill=OUT,width=int(ow*S),joint='curve')
def shadow(img,pts,blur=0.7,alpha=150):
    sh=Image.new('RGBA',img.size,(0,0,0,0)); ImageDraw.Draw(sh).polygon([P(*p) for p in pts],fill=(70,45,20,alpha))
    sh=sh.filter(ImageFilter.GaussianBlur(blur*S)); img.alpha_composite(sh)
def ell_shadow(img,cx,cy,rx,ry,alpha=140):
    sh=Image.new('RGBA',img.size,(0,0,0,0)); x0,y0=P(cx-rx,cy+ry); x1,y1=P(cx+rx,cy-ry)
    ImageDraw.Draw(sh).ellipse((x0,y0,x1,y1),fill=(70,45,20,alpha)); sh=sh.filter(ImageFilter.GaussianBlur(1*S)); img.alpha_composite(sh)
def lerp(a,b,t): return (a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t)
def plank(d,F,N,h0,h1,colors,nstripe,top=(255,250,240,255),topoff=(-3.5,2.5)):
    A=(F[0],F[1]+h1); B=(N[0],N[1]+h1)
    # 顶面（看得见的厚度）
    poly(d,[A,B,(B[0]+topoff[0],B[1]+topoff[1]),(A[0]+topoff[0],A[1]+topoff[1])],top)
    # 正面条纹
    for i in range(nstripe):
        t0,t1=i/nstripe,(i+1)/nstripe
        a=lerp(F,N,t0); b=lerp(F,N,t1)
        q=[(a[0],a[1]+h0),(b[0],b[1]+h0),(b[0],b[1]+h1),(a[0],a[1]+h1)]
        d.polygon([P(*p) for p in q],fill=colors[i%len(colors)])
    pts=[(F[0],F[1]+h0),(N[0],N[1]+h0),(N[0],N[1]+h1),(F[0],F[1]+h1)]
    pp=[P(*p) for p in pts]; d.line(pp+[pp[0]],fill=OUT,width=int(1.3*S),joint='curve')
def post(d,foot,h,w,colors,band=7):
    x,y=foot
    n=int(h/band)+1
    for i in range(n):
        y0=y+i*band; y1=min(y+h,y0+band)
        if y0>=y+h: break
        d.rectangle((*P(x-w/2,y1),*P(x+w/2,y0)),fill=colors[i%len(colors)])
    d.rounded_rectangle((*P(x-w/2,y+h),*P(x+w/2,y)),radius=int(w*S/3),outline=OUT,width=int(1.2*S))
def foot_base(d,foot,col):
    x,y=foot; poly(d,[(x-9,y+2),(x+7,y+2),(x+7,y-2),(x-9,y-2)],col,1.2)
def finish(img,name):
    img=img.resize((W*RES,H*RES),Image.LANCZOS); img.save(O+name+'.png'); print(name,img.size)

# ---------- 低栏 hurdle ----------
F=(-17,18); N=(17,-18); hb0,hb1=21,32
back=new(); d=ImageDraw.Draw(back)
sh=8  # 影子向右下偏移
shadow(back,[(F[0]+sh,F[1]+2),(N[0]+sh,N[1]+2),(N[0]+sh+4,N[1]-3),(F[0]+sh+4,F[1]-3)])
ell_shadow(back,F[0]+2,F[1],7,2.2); ell_shadow(back,N[0]+2,N[1],7,2.2)
foot_base(d,F,(235,235,240,255)); post(d,F,hb0+1,6,[(245,245,250,255),(215,218,228,255)])
plank(d,F,N,hb0,hb1,[(230,50,45,255),(255,255,255,255)],5,topoff=(-4,3))
finish(back,'hurdle_back')
front=new(); d=ImageDraw.Draw(front)
foot_base(d,N,(235,235,240,255)); post(d,N,hb0+1,6.5,[(250,250,255,255),(220,222,232,255)])
finish(front,'hurdle_front')

# ---------- 高栏 gate ----------
F=(-19,20); N=(19,-20); gb0,gb1=62,78; ph=86
back=new(); d=ImageDraw.Draw(back)
sh=16
shadow(back,[(F[0]+sh,F[1]+2.5),(N[0]+sh,N[1]+2.5),(N[0]+sh+3,N[1]-2.5),(F[0]+sh+3,F[1]-2.5)],alpha=80)
shadow(back,[(F[0],F[1]+1.5),(F[0]+sh,F[1]+1.5),(F[0]+sh,F[1]-1.5),(F[0],F[1]-1.5)],alpha=70)
shadow(back,[(N[0],N[1]+1.5),(N[0]+sh,N[1]+1.5),(N[0]+sh,N[1]-1.5),(N[0],N[1]-1.5)],alpha=70)
def plate(d,foot):
    x,y=foot; x0,y0=P(x-8,y+3); x1,y1=P(x+8,y-3); d.ellipse((x0,y0,x1,y1),fill=(250,200,40,255),outline=OUT,width=int(1.2*S))
plate(d,F); post(d,F,ph,8,[(255,205,30,255),(40,35,35,255)])
finish(back,'gate_back')
front=new(); d=ImageDraw.Draw(front)
plank(d,F,N,gb0,gb1,[(225,45,40,255),(240,70,55,255)],2,top=(255,140,120,255),topoff=(-4,3))
# 警示三角
m=lerp(F,N,0.5); cx,cy=m[0],m[1]+(gb0+gb1)/2
poly(d,[(cx-6,cy-5.5),(cx+6,cy-5.5),(cx,cy+5.5)],(255,215,40,255),1.1)
plate(d,N); post(d,N,ph,9,[(255,210,35,255),(40,35,35,255)])
finish(front,'gate_front')

# ---------- 石堆 / 草垛 / 木箱：加地面影子 ----------
for name in ['rocks','hay','crate']:
    im=Image.open(O+name+'.png'); w,h=im.size; pad=5*RES
    c=Image.new('RGBA',(w+pad*2,h+pad),(0,0,0,0)); sd=Image.new('RGBA',c.size,(0,0,0,0))
    ImageDraw.Draw(sd).ellipse((pad*0.6+w*0.05, h-pad*0.9, pad*1.6+w*0.98, h+pad*0.9),fill=(70,45,20,100))
    sd=sd.filter(ImageFilter.GaussianBlur(2*RES)); c.alpha_composite(sd); c.alpha_composite(im,(pad,0))
    c.save(O+name+'_sh.png'); print(name+'_sh',c.size,'pivot',(c.size[0]/2,h))

# ---------- 大角牛脚下的影子 ----------
sw,shh=64,16
img=Image.new('RGBA',(sw*S,shh*S),(0,0,0,0)); ImageDraw.Draw(img).ellipse((2*S,3*S,(sw-2)*S,(shh-3)*S),fill=(60,35,15,175))
img=img.filter(ImageFilter.GaussianBlur(1.0*S)).resize((sw*RES,shh*RES),Image.LANCZOS); img.save(O+'bull_shadow.png'); print('bull_shadow',img.size)
