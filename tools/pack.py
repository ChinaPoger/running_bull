import zipfile, os, json
P='/workspace/running_bull/project/'; out='/workspace/running_bull/running_bull.xbp'
meta={"type":"game","displayName":"大角牛快跑",
 "description":"大角牛快跑：三条跑道的无尽跑酷。跳过低栏、滑铲钻过高栏、换道躲开草垛和木箱，收集金币，吃闪电冲刺！",
 "instructions":"J 跳跃（游戏中空格也能跳）；K 滑铲；↑/W 换到上面（远）一条跑道，↓/S 换到下面（近）一条跑道。手机：右下角「跳」按钮 / 点右半屏跳，左下角「滑」按钮 / 点左半屏滑铲，上下滑换道。按空格、回车或点击屏幕开始 / 重新开始。标题页 / 结算页按 B 或点「商店」：用金币买角色（大角牛 / 粉粉猪 / 咩咩羊）、地图（草原 / 沙漠 / 夜晚）和道具（无敌护盾、双倍金币）。撞车后可以花金币或看示意广告复活一次。"}
with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as z:
    z.writestr('builder-meta.json', json.dumps(meta,ensure_ascii=False))
    z.write('/workspace/running_bull/thumbnail.jpg','builder-thumbnail.jpg')
    for root,_,files in os.walk(P):
        for f in sorted(files):
            full=os.path.join(root,f); rel=os.path.relpath(full,P).replace(os.sep,'/')
            z.write(full,rel)
print(out, os.path.getsize(out))
for n in zipfile.ZipFile(out).namelist(): print(' ',n)
