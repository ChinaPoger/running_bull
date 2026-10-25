# 从 XBuilder 版复制素材，并用 Pillow 生成角色/地图的换色版本
import os, shutil, random
from PIL import Image, ImageEnhance, ImageDraw, ImageFilter
import numpy as np
SRC = '/workspace/running_bull/project/assets'
DST = os.path.join(os.path.dirname(__file__), '..', 'public', 'assets')
os.makedirs(DST, exist_ok=True)
S = SRC + '/sprites/'
copy = {
 'Obstacle/crate.png':'crate.png','Obstacle/gate_back.png':'gate_back.png','Obstacle/gate_front.png':'gate_front.png',
 'Obstacle/hay.png':'hay.png','Obstacle/hurdle_back.png':'hurdle_back.png','Obstacle/hurdle_front.png':'hurdle_front.png',
 'Obstacle/rocks.png':'rocks.png','Coin/coin.png':'coin.png','Boost/boost.png':'boost.png','Fx/dust.png':'dust.png',
 'Fx/spark.png':'spark.png','Shadow/shadow.png':'shadow.png','NewRecord/badge.png':'badge.png',
}
for a,b in copy.items(): shutil.copy(S+a, os.path.join(DST,b))
frames = ['run1','run2','run3','run4','jump','slide']

def hue_shift(img, dh, sat=1.0, val=1.0, mask_fn=None):
    rgba = np.array(img.convert('RGBA')).astype(np.float32)
    a = rgba[...,3:4]
    hsv = np.array(img.convert('RGB').convert('HSV')).astype(np.float32)
    m = np.ones(hsv.shape[:2], bool) if mask_fn is None else mask_fn(hsv)
    hsv[...,0] = np.where(m, (hsv[...,0] + dh*255) % 255, hsv[...,0])
    hsv[...,1] = np.where(m, np.clip(hsv[...,1]*sat,0,255), hsv[...,1])
    hsv[...,2] = np.where(m, np.clip(hsv[...,2]*val,0,255), hsv[...,2])
    rgb = np.array(Image.fromarray(hsv.astype(np.uint8),'HSV').convert('RGB')).astype(np.float32)
    out = np.concatenate([rgb, a], -1).astype(np.uint8)
    return Image.fromarray(out,'RGBA')

# 只改“棕色毛皮”区域（色相 ~ 10°-45°），保留红围巾和角
def brown(hsv):
    h = hsv[...,0]*360/255; s = hsv[...,1]; v=hsv[...,2]
    return (h>12)&(h<50)&(s>60)&(v>40)
for f in frames:
    im = Image.open(S+f'Bull/{f}.png').convert('RGBA')
    im.save(f'{DST}/bull_{f}.png')
    hue_shift(im, 0.55, 1.0, 1.05, brown).save(f'{DST}/blue_{f}.png')   # 蓝角牛
    hue_shift(im, 0.04, 1.5, 1.35, brown).save(f'{DST}/gold_{f}.png')   # 金角牛
    hue_shift(im, 0.0, 0.25, 0.45, brown).save(f'{DST}/black_{f}.png')  # 黑旋风

bd = Image.open(SRC+'/backdrop.png').convert('RGBA')
road = Image.open(S+'Road/road.png').convert('RGBA')
bd.save(f'{DST}/bg_farm.png'); road.save(f'{DST}/road_farm.png')
# 沙漠：绿色 → 沙黄
def green(hsv):
    h = hsv[...,0]*360/255; return (h>55)&(h<170)
d = hue_shift(bd, -0.09, 0.75, 1.08, green)
d = ImageEnhance.Color(d).enhance(0.9)
d.save(f'{DST}/bg_desert.png')
hue_shift(road, -0.02, 1.3, 1.05).save(f'{DST}/road_desert.png')
# 夜晚：压暗 + 偏蓝 + 星星月亮
def night(img, stars=True):
    arr = np.array(img).astype(np.float32)
    arr[...,0]*=0.35; arr[...,1]*=0.42; arr[...,2]=arr[...,2]*0.6+40
    n = Image.fromarray(np.clip(arr,0,255).astype(np.uint8),'RGBA')
    if stars:
        dr = ImageDraw.Draw(n); random.seed(3)
        for _ in range(90):
            x,y = random.randint(0,959), random.randint(0,200); r=random.choice([1,1,2])
            dr.ellipse([x-r,y-r,x+r,y+r], fill=(255,255,220,255))
        dr.ellipse([760,40,840,120], fill=(255,248,200,255)); dr.ellipse([785,32,865,112], fill=(40,50,110,255))
    return n
night(bd).save(f'{DST}/bg_night.png'); night(road, False).save(f'{DST}/road_night.png')
print('ok', len(os.listdir(DST)))

# 无敌护盾图标（简单绘制）
sh = Image.new('RGBA', (140, 140), (0, 0, 0, 0)); dr = ImageDraw.Draw(sh)
pts = [(70, 8), (126, 28), (120, 80), (70, 132), (20, 80), (14, 28)]
dr.polygon(pts, fill=(40, 110, 200, 255)); dr.line(pts + [pts[0]], fill=(255, 255, 255, 255), width=8)
dr.polygon([(70, 26), (108, 40), (104, 78), (70, 112)], fill=(110, 190, 255, 255))
dr.line([(50, 70), (66, 88), (94, 52)], fill=(255, 255, 255, 255), width=12)
sh.save(f'{DST}/shield.png')
