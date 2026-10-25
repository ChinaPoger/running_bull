from PIL import Image, ImageDraw, ImageFont
O='/workspace/art/out/'; R=2
bg=Image.open(O+'backdrop.png').convert('RGBA')
def put(name,x,y,scale=1,pivot='bottom'):
    im=Image.open(O+name+'.png')
    if pivot=='depth':
        if scale!=1: im=im.resize((int(im.width*scale),int(im.height*scale)),Image.LANCZOS)
        bg.alpha_composite(im,(int((240+x)*R-45*R*scale),int((180-y)*R-110*R*scale))); return
    if scale!=1: im=im.resize((int(im.width*scale),int(im.height*scale)),Image.LANCZOS)
    px=(240+x)*R-im.width/2; py=(180-y)*R-(im.height if pivot=='bottom' else im.height/2)
    bg.alpha_composite(im,(int(px),int(py)))
lane=lambda l:-62-50*l; sc=lambda l:0.86+0.07*l
put('gate_back',140,lane(0),sc(0),'depth'); put('gate_front',140,lane(0),sc(0),'depth')
for i in range(5): put('coin',-60+30*i,lane(0)+14,sc(0),'center')
put('hay_sh',40,lane(1)-5,sc(1))
put('hurdle_back',-150,lane(1),sc(1),'depth')
put('bull_shadow',-146,lane(1)+8,sc(1)*0.8,'center')
put('bull_jump',-150,lane(1)+45,sc(1))
put('hurdle_front',-150,lane(1),sc(1),'depth')
put('hurdle',-60,lane(1)+0,sc(1)) if False else None
put('boost',90,lane(2)+20,sc(2),'center')
put('hurdle_back',190,lane(2),sc(2),'depth'); put('hurdle_front',190,lane(2),sc(2),'depth')
d=ImageDraw.Draw(bg); F=ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc',18*R)
for i,(t,x) in enumerate([('分数 368',-232),('金币 12',-120),('最高分 520',-8)]):
    X=(240+x)*R; Y=8*R
    d.rounded_rectangle((X,Y,X+100*R,Y+26*R),radius=8*R,fill=(255,255,255,220),outline=(120,80,40),width=R)
    d.text((X+50*R,Y+13*R),t,font=F,fill=(90,50,20),anchor='mm')
t=ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc',44*R)
d.text((240*R,72*R),'大角牛快跑',font=t,fill=(220,80,20),anchor='mm',stroke_width=4*R,stroke_fill=(255,255,255))
bg.convert('RGB').save('/workspace/running_bull/thumbnail.jpg',quality=90)
bg.convert('RGB').resize((480,360)).save('/tmp/thumb_small.png')
