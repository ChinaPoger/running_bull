import json, os, shutil, zipfile, random, string
from PIL import Image
O='/workspace/art/out/'; P='/workspace/running_bull/project/'
RES=2
def rid():
    return ''.join(random.Random(hash(rid.n)).choice(string.ascii_letters+string.digits+'_-') for _ in range(21))
rid.n=0
def nid():
    rid.n+=1; random.seed(1000+rid.n); return ''.join(random.choice(string.ascii_letters+string.digits) for _ in range(21))

for d in ['assets']:
    if os.path.exists(P+d): shutil.rmtree(P+d)
os.makedirs(P+'assets/sprites')

def costume(sprite, name, src, pivot='bottom'):
    im=Image.open(O+src+'.png'); w,h=im.size
    shutil.copy(O+src+'.png', f'{P}assets/sprites/{sprite}/{name}.png')
    if pivot=='bottom': px,py=w/2,h
    elif pivot=='center': px,py=w/2,h/2
    elif pivot=='depth': px,py=45*RES,110*RES      # 有纵深的障碍：支点在跑道中心的地面
    elif pivot=='shadow': px,py=w/2,h-5*RES        # 带地面影子的障碍：支点在物体底部
    else: raise ValueError(pivot)
    return {"x":px,"y":py,"faceRight":0,"bitmapResolution":RES,"name":name,"path":name+'.png',
            "builder_id":nid(),"imageWidth":w,"imageHeight":h}

def sprite(name, costumes, x=0, y=0, visible=False, size=1, idx=0):
    os.makedirs(f'{P}assets/sprites/{name}', exist_ok=True)
    cs=[costume(name,*c) for c in costumes]
    cfg={"heading":90,"x":x,"y":y,"size":size,"rotationStyle":"normal","physicsMode":"no",
         "costumeIndex":idx,"visible":visible,"isDraggable":False,
         "collisionPivot":{"x":0,"y":0},"collisionShapeType":"none","collisionShapeParams":[],
         "costumes":cs,"builder_id":nid()}
    json.dump(cfg, open(f'{P}assets/sprites/{name}/index.json','w'), ensure_ascii=False, indent=2)
    return cfg

S={}
S['Road']=sprite('Road',[('road','road','center'),('road_desert','road_desert','center'),('road_night','road_night','center')],0,-91.5,True)
S['Coin']=sprite('Coin',[('coin','coin','center')],120,-40)
S['Boost']=sprite('Boost',[('boost','boost','center')],160,-40)
S['Obstacle']=sprite('Obstacle',[('hurdle_back','hurdle_back','depth'),('hurdle_front','hurdle_front','depth'),('rocks','rocks_sh','shadow'),
    ('gate_back','gate_back','depth'),('gate_front','gate_front','depth'),('hay','hay_sh','shadow'),('crate','crate_sh','shadow')],60,-112)
S['Shadow']=sprite('Shadow',[('shadow','bull_shadow','center')],-146,-112,True,0.93)
S['Bull']=sprite('Bull',[(f'{p}_{n}',f'{p}_{n}') for p in ['bull','pig','sheep'] for n in ['run1','run2','run3','run4','jump','slide']],-150,-112,True,0.93)
S['NewRecord']=sprite('NewRecord',[('badge','new_record','center')],0,-75)
S['Panel']=sprite('Panel',[('title','panel_title','center'),('over','panel_over','center')],0,62)
S['Fx']=sprite('Fx',[('plus10','fx_plus10','center'),('spark','fx_spark','center'),('dust','fx_dust','center'),('plus20','fx_plus20','center')],0,0)
S['BtnSlide']=sprite('BtnSlide',[('btn','btn_slide','center')],-208,-148)
S['BtnJump']=sprite('BtnJump',[('btn','btn_jump','center')],208,-148)
S['Flash']=sprite('Flash',[('white','flash','center')],0,0)
S['ShopBtn']=sprite('ShopBtn',[('btn','shop_btn','center')],190,-152)
S['Shop']=sprite('Shop',[('bg','shop_bg','center')],0,-10)
S['ShopCard']=sprite('ShopCard',[(f'c{i}_{st}',f'card_{i}_{st}','center') for i in range(8) for st in (range(3) if i<6 else range(4))],0,0)
S['ShopCursor']=sprite('ShopCursor',[('frame','card_cursor','center')],0,0)
S['ShopClose']=sprite('ShopClose',[('btn','shop_close','center')],195,128)
S['Revive']=sprite('Revive',[('offer','revive_offer','center'),('poor','revive_poor','center'),('ad3','ad_3','center'),('ad2','ad_2','center'),('ad1','ad_1','center')],0,0)
S['Login']=sprite('Login',[('bg','login_bg','center')],0,-5)
S['AcctBtn']=sprite('AcctBtn',[('btn','acct_btn','center')],92,-152)
S['Toast']=sprite('Toast',[(f't{k}',f'toast_{k}','center') for k in range(11)],0,95)
order=['Road','Coin','Boost','Obstacle','Shadow','Bull','Fx','BtnSlide','BtnJump','Flash','NewRecord','Panel','ShopBtn','Shop','ShopCard','ShopCursor','ShopClose','Revive','AcctBtn','Login','Toast']
import wave
SND={}
for sn in ['bgm','jump','slide','coin','boost','crash','newrecord']:
    os.makedirs(f'{P}assets/sounds/{sn}',exist_ok=True)
    shutil.copy(f'{O}sounds/{sn}.wav',f'{P}assets/sounds/{sn}/{sn}.wav')
    w=wave.open(f'{O}sounds/{sn}.wav')
    SND[sn]={"path":sn+'.wav',"rate":w.getframerate(),"sampleCount":w.getnframes(),"builder_id":nid()}
    json.dump(SND[sn],open(f'{P}assets/sounds/{sn}/index.json','w'),indent=2)

shutil.copy(O+'backdrop.png', P+'assets/backdrop.png')
bw,bh=Image.open(O+'backdrop.png').size
def mon(name,label,val,x,y,visible=True):
    return {"type":"monitor","name":name,"builder_id":nid(),"x":x,"y":y,"size":1,"visible":visible,
            "label":label,"mode":1,"style":"default","target":"","val":val}
for bn in ['backdrop_desert','backdrop_night']: shutil.copy(O+bn+'.png', P+'assets/'+bn+'.png')
index={
 "backdrops":[{"name":"farm","path":"backdrop.png","x":bw/2,"y":bh/2,"bitmapResolution":RES,"builder_id":nid(),"imageWidth":bw,"imageHeight":bh},
              {"name":"desert","path":"backdrop_desert.png","x":bw/2,"y":bh/2,"bitmapResolution":RES,"builder_id":nid(),"imageWidth":bw,"imageHeight":bh},
              {"name":"night","path":"backdrop_night.png","x":bw/2,"y":bh/2,"bitmapResolution":RES,"builder_id":nid(),"imageWidth":bw,"imageHeight":bh}],
 "backdropIndex":0,
 "map":{"width":480,"height":360,"mode":"fillRatio"},
 "run":{"width":480,"height":360},
 "camera":{"on":""},
 "physics":False,"autoSetCollisionLayer":True,"layerSortMode":"",
 "audioAttenuation":0,"audioMaxDistance":768,
 "zorder":order+[mon('monitorScore','分数','score',-232,172),mon('monitorCoins','金币','coins',-120,172),
                 mon('monitorBest','最高分','best',-8,172),mon('monitorBoost','冲刺','boostLeft',120,172,False),mon('monitorWallet','钱包','wallet',120,172),mon('monitorShield','护盾','runShield',-232,146,False),mon('monitorMul','金币倍数','coinMul',-120,146,False),mon('monitorNet','账号','netState',-232,120),mon('monitorNick','昵称','loginNick',-205,88,False),mon('monitorPin','PIN','pinShow',-205,14,False),mon('monitorMsg','提示','loginMsg',-215,-12,False)],
 "builder_spriteOrder":[S[n]['builder_id'] for n in order],
 "builder_soundOrder":[SND[k]["builder_id"] for k in SND],
 "maxFPS":60,
}
json.dump(index, open(P+'assets/index.json','w'), ensure_ascii=False, indent=2)
print('assets ok')
