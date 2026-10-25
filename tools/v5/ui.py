# v4 界面素材：商店面板、商品卡片（每种状态一个造型）、选择框、商店按钮、提示条、复活 / 示意广告面板
from PIL import Image, ImageDraw, ImageFont
RES=2; O='/workspace/art/out/'
F='/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc'
def font(s): return ImageFont.truetype(F,int(s*RES))
def new(w,h): im=Image.new('RGBA',(w*RES,h*RES),(0,0,0,0)); return im,ImageDraw.Draw(im)
def R(*a): return [v*RES for v in a]
def text(d,xy,s,size,fill,stroke=0,sf=(255,255,255)):
    d.text((xy[0]*RES,xy[1]*RES),s,font=font(size),fill=fill,anchor='mm',stroke_width=int(stroke*RES),stroke_fill=sf)
def coin(d,x,y,r=6):
    d.ellipse(R(x-r,y-r,x+r,y+r),fill=(255,200,40),outline=(170,100,10),width=RES); d.ellipse(R(x-r*0.5,y-r*0.5,x+r*0.5,y+r*0.5),outline=(200,130,20),width=RES)
# 商店底板
im,d=new(470,322)
d.rounded_rectangle(R(3,5,467,320),radius=22*RES,fill=(0,0,0,60))
d.rounded_rectangle(R(1,1,465,316),radius=22*RES,fill=(255,246,225,250),outline=(150,90,40),width=4*RES)
d.rounded_rectangle(R(140,8,326,40),radius=14*RES,fill=(240,120,40),outline=(150,70,20),width=2*RES)
text(d,(233,24),'金币商店',19,(255,255,255),2,(140,60,10))
text(d,(233,302),'键盘：←→↑↓ 选择 · J / 回车 购买或使用 · B / Esc 返回      鼠标 / 手指：直接点卡片',10,(110,80,50))
im.save(O+'shop_bg.png')
# 返回按钮
im,d=new(62,28); d.rounded_rectangle(R(1,1,61,27),radius=12*RES,fill=(120,170,230),outline=(40,80,140),width=2*RES); text(d,(31,14),'返回',13,(255,255,255),1.5,(40,80,140)); im.save(O+'shop_close.png')
# 卡片图标
def icon_char(pre):
    a=Image.open(O+pre+'_run1.png'); a=a.crop(a.getbbox()); a.thumbnail((64*RES,52*RES)); return a
def icon_map(n,road):
    b=Image.open(O+n+'.png').convert('RGBA').resize((480,360)); r=Image.open(O+road+'.png').convert('RGBA').crop((0,0,960,354)).resize((480,177)); b.alpha_composite(r,(0,181))
    b=b.resize((76*RES,52*RES)); m=Image.new('L',b.size,0); ImageDraw.Draw(m).rounded_rectangle((0,0,b.size[0]-1,b.size[1]-1),radius=8*RES,fill=255); b.putalpha(m); return b
def icon_shield():
    im,d=new(60,52); pts=[(30,3),(52,11),(49,32),(30,49),(11,32),(8,11)]
    d.polygon([(x*RES,y*RES) for x,y in pts],fill=(70,150,240),outline=(20,60,140)); d.line([(x*RES,y*RES) for x,y in pts+[pts[0]]],fill=(20,60,140),width=3*RES)
    text(d,(30,25),'★',20,(255,230,90),1,(150,100,0)); return im
def icon_double():
    im,d=new(64,52); c=Image.open(O+'coin.png'); c.thumbnail((40*RES,40*RES)); im.alpha_composite(c,(4*RES,6*RES)); d=ImageDraw.Draw(im)
    text(d,(46,30),'×2',18,(230,60,40),2.5); return im
ITEMS=[('角色','大角牛',icon_char('bull'),0),('角色','粉粉猪',icon_char('pig'),300),('角色','咩咩羊',icon_char('sheep'),600),
       ('地图','青青草原',icon_map('backdrop','road'),0),('地图','黄沙大漠',icon_map('backdrop_desert','road_desert'),200),('地图','星星夜晚',icon_map('backdrop_night','road_night'),500),
       ('道具','无敌护盾',icon_shield(),60),('道具','双倍金币',icon_double(),80)]
def card(i,state):
    cat,name,ic,price=ITEMS[i]; im,d=new(102,114)
    sel = i<6 and state==2
    bg=(255,255,255) if not sel else (255,240,170)
    d.rounded_rectangle(R(1,2,101,113),radius=12*RES,fill=(0,0,0,50))
    d.rounded_rectangle(R(1,1,100,111),radius=12*RES,fill=bg,outline=(230,150,30) if sel else (170,130,90),width=(3 if sel else 2)*RES)
    col={'角色':(230,110,60),'地图':(60,160,90),'道具':(70,120,220)}[cat]
    d.rounded_rectangle(R(30,4,72,18),radius=6*RES,fill=col); text(d,(51,11),cat,9,(255,255,255))
    im.alpha_composite(ic,(int((102*RES-ic.size[0])/2),int((48*RES-ic.size[1]/2)))); d=ImageDraw.Draw(im)
    text(d,(51,80),name,12,(80,50,25))
    if i<6:
        if state==0:
            if price==0: line,c2='免费',(60,140,60)
            else:
                coin(d,30,97,5); text(d,(56,97),f'{price}',12,(200,110,10)); line=None
            if price==0: text(d,(51,97),line,11,c2)
            # 未拥有：灰一点
            if price>0:
                ov=Image.new('RGBA',im.size,(0,0,0,0)); ImageDraw.Draw(ov).rounded_rectangle(R(8,22,94,70),radius=8*RES,fill=(255,255,255,90)); im.alpha_composite(ov); d=ImageDraw.Draw(im)
                text(d,(84,28),'🔒' if False else '未解锁',8,(150,150,150))
        elif state==1: text(d,(51,97),'已拥有 · 点击使用',9.5,(60,130,200))
        else: text(d,(51,97),'✓ 使用中',12,(220,120,0))
    else:
        coin(d,22,97,5); text(d,(40,97),f'{price}',11,(200,110,10)); text(d,(74,97),f'持有 {state}/3',10,(60,130,200) if state else (150,150,150))
    return im
for i in range(8):
    for st in (range(3) if i<6 else range(4)): card(i,st).save(O+f'card_{i}_{st}.png')
# 选择框（键盘光标）
im,d=new(110,122); d.rounded_rectangle(R(2,2,108,120),radius=15*RES,outline=(255,120,0),width=4*RES); im.save(O+'card_cursor.png')
# 商店按钮
im,d=new(88,34); d.rounded_rectangle(R(1,3,87,33),radius=14*RES,fill=(0,0,0,60)); d.rounded_rectangle(R(1,1,87,31),radius=14*RES,fill=(250,170,40),outline=(150,80,10),width=2*RES)
coin(d,17,16,7); text(d,(54,16),'商店 B',13,(255,255,255),1.5,(150,80,10)); im.save(O+'shop_btn.png')
# 提示条
for k,(s,c) in enumerate([('金币不够！',(220,60,50)),('购买成功！',(50,160,70)),('已装备！',(50,130,220)),('最多持有 3 个',(220,120,30)),('护盾抵挡！',(70,120,230)),('复活！无敌 2 秒',(240,140,20)),('金币 -100',(220,60,50)),('网络断开，转为离线',(150,150,150)),('注册成功！已存档',(50,160,70)),('登录成功！',(50,130,220)),('网络不稳，请再试一次',(220,120,30))]):
    im,d=new(170,32); d.rounded_rectangle(R(1,1,169,31),radius=14*RES,fill=c+(245,),outline=(255,255,255),width=2*RES); text(d,(85,16),s,14,(255,255,255)); im.save(O+f'toast_{k}.png')
# 复活面板
def revive(poor):
    im,d=new(300,214); d.rounded_rectangle(R(3,5,299,213),radius=20*RES,fill=(0,0,0,70))
    d.rounded_rectangle(R(1,1,297,210),radius=20*RES,fill=(255,248,232,250),outline=(150,90,40),width=4*RES)
    text(d,(149,28),'撞到了！复活一次？',18,(200,60,30),2)
    text(d,(149,50),'每局只能复活一次，复活后无敌 2 秒',10,(120,90,60))
    c=(250,170,40) if not poor else (200,200,200); oc=(150,80,10) if not poor else (140,140,140)
    d.rounded_rectangle(R(30,64,268,100),radius=14*RES,fill=c,outline=oc,width=2*RES)
    coin(d,58,82,8); text(d,(160,82),'花 100 金币复活   [1]' if not poor else '钱包金币不够（要 100）',13,(255,255,255) if not poor else (120,120,120),1.5 if not poor else 0,oc)
    d.rounded_rectangle(R(30,112,268,148),radius=14*RES,fill=(90,170,240),outline=(30,80,150),width=2*RES)
    text(d,(149,130),'▶ 看示意广告复活   [2]',13,(255,255,255),1.5,(30,80,150))
    d.rounded_rectangle(R(90,162,208,192),radius=12*RES,fill=(235,225,210),outline=(150,120,90),width=2*RES)
    text(d,(149,177),'放弃   [3 / Esc]',12,(120,90,60))
    return im
revive(False).save(O+'revive_offer.png'); revive(True).save(O+'revive_poor.png')
for n in (3,2,1):
    im,d=new(300,214); d.rounded_rectangle(R(1,1,297,210),radius=20*RES,fill=(25,30,50,245),outline=(120,140,200),width=3*RES)
    d.rounded_rectangle(R(110,12,188,34),radius=8*RES,fill=(255,200,0)); text(d,(149,23),'示意广告',12,(60,40,0))
    text(d,(149,70),'这里将来放激励视频广告',13,(220,225,255))
    text(d,(149,122),str(n),56,(255,220,80),3,(120,70,0))
    text(d,(149,180),'（演示用，不是真实广告）  看完自动复活',10,(170,180,220))
    im.save(O+f'ad_{n}.png')
print('ui ok')
# +20（双倍金币时的飘字）
im,d=new(46,24); text(d,(23,12),'+20',17,(255,120,40),2,(140,40,0)); im.save(O+'fx_plus20.png')

# ---------- v5：登录面板 / 账号按钮 ----------
im,d=new(440,318)
d.rounded_rectangle(R(3,5,438,317),radius=22*RES,fill=(0,0,0,60))
d.rounded_rectangle(R(1,1,436,313),radius=22*RES,fill=(255,246,225,252),outline=(150,90,40),width=4*RES)
d.rounded_rectangle(R(118,8,318,40),radius=14*RES,fill=(240,120,40),outline=(150,70,20),width=2*RES)
text(d,(218,24),'登录 / 注册 账号',17,(255,255,255),2,(140,60,10))
text(d,(78,52),'① 选一个昵称',11,(120,80,40))
text(d,(78,130),'② 输入 4 位数字 PIN',11,(120,80,40))
def btn(x,y,w,h,label,fill,oc,size=12):
    d.rounded_rectangle(R(x-w/2,y-h/2,x+w/2,y+h/2),radius=10*RES,fill=fill,outline=oc,width=2*RES)
    text(d,(x,y),label,size,(255,255,255),1.5,oc)
# 昵称左右切换 + 自己输入（坐标：面板左上角为原点，面板中心 = 舞台 (0,-5)）
btn(30,104,34,28,'◀',(120,170,230),(40,80,140)); btn(78,104,34,28,'▶',(120,170,230),(40,80,140))
btn(150,104,96,28,'自己输入 [T]',(120,170,230),(40,80,140),11)
btn(110,206,190,32,'登录   [回车]',(250,150,40),(150,80,10),14)
btn(110,246,190,30,'注册新账号   [R]',(80,170,90),(30,110,40),13)
btn(110,284,190,28,'游客试玩（不存档）[G]',(170,160,150),(110,100,90),12)
keys=['1','2','3','4','5','6','7','8','9','清空','0','删除']
for k,lab in enumerate(keys):
    cx=270+60*(k%3); cy=72+44*(k//3)
    d.rounded_rectangle(R(cx-26,cy-19,cx+26,cy+19),radius=10*RES,fill=(255,255,255),outline=(170,130,90),width=2*RES)
    text(d,(cx,cy),lab,16 if len(lab)==1 else 11,(90,60,30))
text(d,(330,250),'键盘：←→ 换昵称 · T 输入昵称',9.5,(120,90,60))
text(d,(330,266),'数字键输 PIN · Backspace 删除',9.5,(120,90,60))
text(d,(330,282),'回车 登录 · R 注册 · G 游客',9.5,(120,90,60))
text(d,(330,298),'换设备也能用同一昵称 + PIN 登录',9.5,(40,110,180))
im.save(O+'login_bg.png')
im,d=new(88,34); d.rounded_rectangle(R(1,3,87,33),radius=14*RES,fill=(0,0,0,60)); d.rounded_rectangle(R(1,1,87,31),radius=14*RES,fill=(90,170,240),outline=(30,80,150),width=2*RES)
text(d,(44,16),'账号 L',13,(255,255,255),1.5,(30,80,150)); im.save(O+'acct_btn.png')
print('login ui ok')
