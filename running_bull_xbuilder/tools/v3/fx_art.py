from PIL import Image, ImageDraw, ImageFont, ImageFilter
import math
RES=2; O='/workspace/art/out/'
F='/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc'
def font(s): return ImageFont.truetype(F, s*RES)
# +10
im=Image.new('RGBA',(46*RES,24*RES),(0,0,0,0)); d=ImageDraw.Draw(im)
d.text((23*RES,12*RES),'+10',font=font(17),fill=(255,214,40,255),anchor='mm',stroke_width=2*RES,stroke_fill=(150,80,0,255))
im.save(O+'fx_plus10.png')
# spark star
s=14*RES; im=Image.new('RGBA',(s,s),(0,0,0,0)); d=ImageDraw.Draw(im); c=s/2
pts=[]
for i in range(10):
    r=c-1 if i%2==0 else c*0.42; a=-math.pi/2+i*math.pi/5
    pts.append((c+r*math.cos(a),c+r*math.sin(a)))
d.polygon(pts,fill=(255,236,120,255),outline=(255,150,30,255),width=RES)
im.save(O+'fx_spark.png')
# dust puff
s=20*RES; im=Image.new('RGBA',(s,s),(0,0,0,0)); d=ImageDraw.Draw(im)
for (x,y,r) in [(10,12,6),(6,13,4.5),(14,13,4.5),(10,8,4.5)]:
    d.ellipse([(x-r)*RES,(y-r)*RES,(x+r)*RES,(y+r)*RES],fill=(252,248,238,235),outline=(200,175,130,200),width=RES)
im=im.filter(ImageFilter.GaussianBlur(0.6*RES)); im.save(O+'fx_dust.png')
# white flash (full stage)
Image.new('RGBA',(480*RES,360*RES),(255,255,255,255)).save(O+'flash.png')
# buttons
def btn(label,col,name):
    s=58*RES; im=Image.new('RGBA',(s,s),(0,0,0,0)); d=ImageDraw.Draw(im)
    d.ellipse([2*RES,4*RES,s-2*RES,s],fill=(0,0,0,70))
    d.ellipse([2*RES,1*RES,s-2*RES,s-3*RES],fill=col+(235,),outline=(255,255,255,255),width=3*RES)
    d.text((s/2,s/2-2*RES),label,font=font(22),fill=(255,255,255,255),anchor='mm',stroke_width=2*RES,stroke_fill=(60,40,20,255))
    im.save(O+name+'.png')
btn('跳',(245,150,30),'btn_jump'); btn('滑',(60,140,230),'btn_slide')
print('ok')
