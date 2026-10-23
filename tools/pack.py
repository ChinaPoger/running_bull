import zipfile, os, json
P='/workspace/running_bull/project/'; out='/workspace/running_bull/running_bull.xbp'
meta={"type":"game","displayName":"大角牛快跑",
 "description":"大角牛快跑：三条跑道的无尽跑酷。跳过低栏、滑铲钻过高栏、换道躲开草垛和木箱，收集金币，吃闪电冲刺！",
 "instructions":"J 跳跃（游戏中空格也能跳）；K 滑铲；↑/W 换到上面（远）一条跑道，↓/S 换到下面（近）一条跑道。手机：点右半屏跳、点左半屏滑铲、上下滑换道。按空格、回车或点击屏幕开始 / 重新开始。"}
with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as z:
    z.writestr('builder-meta.json', json.dumps(meta,ensure_ascii=False))
    z.write('/workspace/running_bull/thumbnail.jpg','builder-thumbnail.jpg')
    for root,_,files in os.walk(P):
        for f in sorted(files):
            full=os.path.join(root,f); rel=os.path.relpath(full,P).replace(os.sep,'/')
            z.write(full,rel)
print(out, os.path.getsize(out))
for n in zipfile.ZipFile(out).namelist(): print(' ',n)
