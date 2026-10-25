from PIL import Image, ImageDraw, ImageFont
import glob,os
O='/workspace/art/out/'
names=['bull_run1','bull_run2','bull_run3','bull_run4','bull_jump','bull_slide','bull_shadow','coin','boost','hurdle_back','hurdle_front','hurdle_combined','gate_back','gate_front','gate_combined','rocks_sh','hay_sh','crate_sh','new_record','panel_title','panel_over']
F=ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',18)
W=1400; cell=220
rows=[]; x=y=20; rowh=0
canvas=Image.new('RGB',(W,1500),(236,240,246)); d=ImageDraw.Draw(canvas)
d.text((20,10),'大角牛快跑 — 素材预览 (running_bull assets)',font=ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc',30),fill=(60,40,20)); y=60
for n in names:
    im=Image.open(O+n+'.png')
    if im.width>cell*1.6: im=im.resize((int(im.width*0.6),int(im.height*0.6)))
    w=max(im.width,150)+30
    if x+w>W: x=20; y+=rowh+40; rowh=0
    # checker
    bgc=Image.new('RGB',(im.width,im.height),(255,255,255)); cd=ImageDraw.Draw(bgc)
    for i in range(0,im.width,16):
        for j in range(0,im.height,16):
            if (i//16+j//16)%2: cd.rectangle((i,j,i+15,j+15),fill=(215,215,215))
    canvas.paste(bgc,(x,y)); canvas.paste(im,(x,y),im)
    d.text((x,y+im.height+4),n,font=F,fill=(30,30,30))
    x+=w; rowh=max(rowh,im.height)
y+=rowh+50
bd=Image.open(O+'backdrop.png').resize((480,360)); canvas.paste(bd,(20,y)); d.text((20,y+362),'backdrop (480x360)',font=F,fill=(30,30,30))
rd=Image.open(O+'road.png'); rd=rd.resize((rd.width*360//rd.height//2, 360//2)) ; rd=rd.resize((860,int(860*rd.height/rd.width)))
canvas.paste(rd,(520,y)); d.text((520,y+rd.height+4),'road (横向无缝滚动, 960 宽)',font=F,fill=(30,30,30))
canvas=canvas.crop((0,0,W,y+400))
canvas.save('/workspace/running_bull/preview.png'); print(canvas.size)
