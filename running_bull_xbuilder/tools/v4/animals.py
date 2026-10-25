# 新角色：粉粉猪、咩咩羊（Pillow 矢量风格绘制，4 倍超采样后缩小，深色描边 + 腮红 + 围巾，和大角牛同一套可爱卡通风）
from PIL import Image, ImageDraw
import math
O='/workspace/art/out/'; S=4
def P(*a): return [v*S for v in a]
class Pen:
    def __init__(s,w,h): s.w,s.h=w,h; s.im=Image.new('RGBA',(w*S,h*S),(0,0,0,0)); s.d=ImageDraw.Draw(s.im)
    def ell(s,cx,cy,rx,ry,fill,ol,ow=2.4):
        s.d.ellipse(P(cx-rx,cy-ry,cx+rx,cy+ry),fill=fill,outline=ol,width=int(ow*S) if ol else 0)
    def poly(s,pts,fill,ol,ow=2.4):
        q=[(x*S,y*S) for x,y in pts]; s.d.polygon(q,fill=fill)
        if ol: s.d.line(q+[q[0]],fill=ol,width=int(ow*S),joint='curve')
    def limb(s,x0,y0,ang,L,w,fill,ol,hoof):
        x1=x0+L*math.sin(math.radians(ang)); y1=y0+L*math.cos(math.radians(ang))
        s.d.line(P(x0,y0,x1,y1),fill=ol,width=int((w+4.8)*S)); 
        for (x,y) in [(x0,y0),(x1,y1)]: s.d.ellipse(P(x-(w+4.8)/2,y-(w+4.8)/2,x+(w+4.8)/2,y+(w+4.8)/2),fill=ol)
        s.d.line(P(x0,y0,x1,y1),fill=fill,width=int(w*S))
        s.d.ellipse(P(x0-w/2,y0-w/2,x0+w/2,y0+w/2),fill=fill)
        s.d.ellipse(P(x1-w/2-0.5,y1-w/2-0.5,x1+w/2+0.5,y1+w/2+0.5),fill=hoof)
    def arc(s,box,a0,a1,col,w): s.d.arc(P(*box),a0,a1,fill=col,width=int(w*S))
    def out(s,size): return s.im.resize(size,Image.LANCZOS)

PIG=dict(body=(255,172,188,255),dark=(232,135,155,255),ol=(115,45,60,255),belly=(255,205,215,255),hoof=(150,80,90,255),scarf=(60,140,235,255),scarf2=(35,95,190,255),kind='pig')
SHEEP=dict(body=(252,250,244,255),dark=(225,222,214,255),ol=(105,92,85,255),belly=(255,255,255,255),hoof=(60,50,50,255),face=(95,82,82,255),leg=(95,82,82,255),scarf=(70,185,90,255),scarf2=(40,130,60,255),kind='sheep')

def figure(c,W,H,bx,by,brx,bry,hx,hy,hr,legs,bob=0,flap=0):
    p=Pen(W,H); by+=bob; hy+=bob
    legcol=c.get('leg',c['body']); legfar=c.get('leg',c['dark'])
    # 远侧腿
    for (lx,ly,ang) in legs[1]: p.limb(lx,ly+bob,ang,c.get('L',17),9.5,legfar,c['ol'],c['hoof'])
    # 尾巴
    if c['kind']=='pig':
        p.arc((bx-brx-12,by-14,bx-brx+2,by),200,520,c['ol'],4.6); p.arc((bx-brx-12,by-14,bx-brx+2,by),200,520,c['body'],2.2)
    else:
        p.ell(bx-brx+1,by-8,7,6,c['body'],c['ol'])
    # 围巾飘带（身体后面）
    p.poly([(hx-hr*0.55,hy+hr*0.75),(hx-hr*0.55-22,hy+hr*0.55-6+flap),(hx-hr*0.55-18,hy+hr*0.95+flap),(hx-hr*0.3,hy+hr*1.0)],c['scarf2'],c['ol'],2)
    # 身体
    if c['kind']=='sheep':
        for k in range(9):
            a=math.pi*2*k/9; p.ell(bx+brx*0.82*math.cos(a),by+bry*0.78*math.sin(a),11,10,c['body'],c['ol'])
        p.ell(bx,by,brx*0.9,bry*0.85,c['body'],None)
    else:
        p.ell(bx,by,brx,bry,c['body'],c['ol']); p.ell(bx+4,by+bry*0.35,brx*0.6,bry*0.45,c['belly'],None)
    # 近侧腿
    for (lx,ly,ang) in legs[0]: p.limb(lx,ly+bob,ang,c.get('L',17),10.5,legcol,c['ol'],c['hoof'])
    # 围巾
    p.ell(hx-hr*0.35,hy+hr*0.82,hr*0.62,hr*0.32,c['scarf'],c['ol'],2)
    # 头
    if c['kind']=='pig':
        p.poly([(hx-hr*0.75,hy-hr*0.55),(hx-hr*0.55,hy-hr*1.25),(hx-hr*0.1,hy-hr*0.85)],c['dark'],c['ol'])
        p.ell(hx,hy,hr,hr*0.92,c['body'],c['ol'])
        p.poly([(hx+hr*0.1,hy-hr*0.8),(hx+hr*0.55,hy-hr*1.25),(hx+hr*0.75,hy-hr*0.5)],c['dark'],c['ol'])
        p.ell(hx+hr*0.88,hy+hr*0.18,hr*0.4,hr*0.32,c['dark'],c['ol'])
        p.ell(hx+hr*0.78,hy+hr*0.18,1.7,2.6,c['ol'],None); p.ell(hx+hr*1.0,hy+hr*0.18,1.7,2.6,c['ol'],None)
        ex,ey=hx+hr*0.25,hy-hr*0.2
    else:
        p.ell(hx-hr*0.95,hy-hr*0.05,hr*0.45,hr*0.22,c['face'],c['ol'])
        p.ell(hx+hr*0.05,hy+hr*0.1,hr*0.82,hr*0.9,c['face'],c['ol'])
        for (dx,dy) in [(-0.45,-0.75),(0.0,-0.95),(0.45,-0.75),(-0.7,-0.35)]:
            p.ell(hx+hr*dx,hy+hr*dy,hr*0.36,hr*0.32,c['body'],c['ol'])
        ex,ey=hx+hr*0.3,hy-hr*0.05
    p.ell(ex,ey,4.6,5.4,(255,255,255,255),c['ol'] if c['kind']=='pig' else None,1.2)
    p.ell(ex+1.3,ey+0.6,2.8,3.4,(30,20,20,255),None); p.ell(ex+2.2,ey-0.9,1.1,1.1,(255,255,255,255),None)
    p.ell(ex-1,ey+hr*0.42,4.5,2.6,(255,120,140,170),None)
    # 嘴
    mx,my=(hx+hr*0.45,hy+hr*0.5) if c['kind']=='pig' else (hx+hr*0.5,hy+hr*0.45)
    p.arc((mx-4,my-3,mx+4,my+3),20,160,(255,255,255,255) if c['kind']=='sheep' else c['ol'],1.6)
    return p

def run_legs(k,hipF,hipB,y):
    a=[32,12,-28,-8][k]
    return ([(hipF,y,a),(hipB,y,-a)],[(hipF-6,y,-a*0.8),(hipB-6,y,a*0.8)])
def make(c,prefix):
    for k in range(4):
        L=run_legs(k,82,44,96)
        p=figure(c,136,144,63,84,34,22,101,58,23,L,bob=[0,-3,0,-3][k],flap=[0,4,0,-3][k])
        p.out((136,144)).save(O+f'{prefix}_run{k+1}.png')
    L=([(84,92,70),(46,94,-65)],[(78,92,55),(40,94,-50)])
    p=figure(c,137,148,64,80,34,22,102,54,23,L,flap=-5)
    im=p.out((137,148)).rotate(10,resample=Image.BICUBIC,center=(68,90)); im.save(O+f'{prefix}_jump.png')
    L=([(118,70,95),(56,72,-95)],[(112,70,85),(50,72,-85)])
    p=figure(c,172,88,85,58,42,17,140,40,21,L,flap=6)
    p.out((172,88)).save(O+f'{prefix}_slide.png')
make(PIG,'pig'); make(SHEEP,'sheep')
# 预览
sheet=Image.new('RGBA',(6*175,3*155),(200,230,200,255))
for r,pre in enumerate(['bull','pig','sheep']):
    for i,n in enumerate(['run1','run2','run3','run4','jump','slide']):
        im=Image.open(O+f'{pre}_{n}.png'); sheet.alpha_composite(im,(i*175,r*155+(150-im.size[1])))
sheet.save('/tmp/animals.png'); print('ok')
# 放大到和大角牛差不多的个头：裁掉透明边，按目标高度缩放后贴回原画布底部居中
def fit(name,W,H,th):
    im=Image.open(O+name+'.png'); bb=im.getbbox(); im=im.crop(bb)
    s=th/im.size[1]; im=im.resize((min(W,int(im.size[0]*s)),th),Image.LANCZOS)
    c=Image.new('RGBA',(W,H),(0,0,0,0)); c.alpha_composite(im,((W-im.size[0])//2,H-th-2)); c.save(O+name+'.png')
for pre in ['pig','sheep']:
    for k in range(4): fit(f'{pre}_run{k+1}',136,144,118)
    fit(f'{pre}_jump',137,148,128); fit(f'{pre}_slide',172,88,70)
sheet=Image.new('RGBA',(6*175,3*155),(200,230,200,255))
for r,pre in enumerate(['bull','pig','sheep']):
    for i,n in enumerate(['run1','run2','run3','run4','jump','slide']):
        im=Image.open(O+f'{pre}_{n}.png'); sheet.alpha_composite(im,(i*175,r*155+(150-im.size[1])))
sheet.save('/tmp/animals.png')
