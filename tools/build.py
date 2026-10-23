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
S['Road']=sprite('Road',[('road','road','center')],0,-91.5,True)
S['Coin']=sprite('Coin',[('coin','coin','center')],120,-40)
S['Boost']=sprite('Boost',[('boost','boost','center')],160,-40)
S['Obstacle']=sprite('Obstacle',[('hurdle_back','hurdle_back','depth'),('hurdle_front','hurdle_front','depth'),('rocks','rocks_sh','shadow'),
    ('gate_back','gate_back','depth'),('gate_front','gate_front','depth'),('hay','hay_sh','shadow'),('crate','crate_sh','shadow')],60,-112)
S['Shadow']=sprite('Shadow',[('shadow','bull_shadow','center')],-146,-112,True,0.93)
S['Bull']=sprite('Bull',[('run1','bull_run1'),('run2','bull_run2'),('run3','bull_run3'),('run4','bull_run4'),('jump','bull_jump'),('slide','bull_slide')],-150,-112,True,0.93)
S['NewRecord']=sprite('NewRecord',[('badge','new_record','center')],0,-75)
S['Panel']=sprite('Panel',[('title','panel_title','center'),('over','panel_over','center')],0,62)
order=['Road','Coin','Boost','Obstacle','Shadow','Bull','NewRecord','Panel']

shutil.copy(O+'backdrop.png', P+'assets/backdrop.png')
bw,bh=Image.open(O+'backdrop.png').size
def mon(name,label,val,x,y,visible=True):
    return {"type":"monitor","name":name,"builder_id":nid(),"x":x,"y":y,"size":1,"visible":visible,
            "label":label,"mode":1,"style":"default","target":"","val":val}
index={
 "backdrops":[{"name":"farm","path":"backdrop.png","x":bw/2,"y":bh/2,"bitmapResolution":RES,
               "builder_id":nid(),"imageWidth":bw,"imageHeight":bh}],
 "backdropIndex":0,
 "map":{"width":480,"height":360,"mode":"fillRatio"},
 "run":{"width":480,"height":360},
 "camera":{"on":""},
 "physics":False,"autoSetCollisionLayer":True,"layerSortMode":"",
 "audioAttenuation":0,"audioMaxDistance":768,
 "zorder":order+[mon('monitorScore','分数','score',-232,172),mon('monitorCoins','金币','coins',-120,172),
                 mon('monitorBest','最高分','best',-8,172),mon('monitorBoost','冲刺','boostLeft',120,172,False)],
 "builder_spriteOrder":[S[n]['builder_id'] for n in order],
 "builder_soundOrder":[],
 "maxFPS":60,
}
json.dump(index, open(P+'assets/index.json','w'), ensure_ascii=False, indent=2)
print('assets ok')
