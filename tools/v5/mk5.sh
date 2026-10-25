set -e
rm -rf /workspace/test_run/rb5 && cp -r /workspace/running_bull/project /workspace/test_run/rb5 && cd /workspace/test_run/rb5
python3 - <<'PY'
def rep(s,a,b):
    assert a in s, a[:60]; return s.replace(a,b,1)
p='Obstacle.spx'; s=open(p).read()
s=rep(s,"		if reviveClear > 0 &&","""		if autoPilot && !frozen && part == 0 && !acted && myLane == bullLane && px-bullX < 40+curSpeed*6 && px-bullX > 0 {
			acted = true
			if category() == 0 {
				Bull.doJump
			} else if category() == 1 {
				Bull.doSlide
			} else {
				nl := (bullLane + 1) % 3
				changeLane(nl - bullLane)
			}
		}
		if reviveClear > 0 &&""")
s=rep(s,"	hitDone bool\n","	hitDone bool\n	acted   bool\n")
open(p,'w').write(s)
m=open('main.spx').read()
import os
m=rep(m,'const apiBase = "https://bull.lingecho.com/api"','const apiBase = "'+os.environ.get('RB_BASE','http://127.0.0.1:3901/api')+'"')
m=rep(m,"	overFrames int ","	autoPilot  bool\n	overFrames int ")
m=rep(m,"	defer resp.Body.Close()\n	var out map[string]any\n	if json.NewDecoder(resp.Body).Decode(&out) != nil {\n		return nil\n	}\n","	defer resp.Body.Close()\n	var out map[string]any\n	if json.NewDecoder(resp.Body).Decode(&out) != nil {\n		return nil\n	}\n	println \"API\", path, resp.StatusCode, out\n")
m=rep(m,"func onHit() bool {\n","func onHit() bool {\n	println \"HIT runShield\", runShield, \"revived\", revived, \"wallet\", wallet\n")
m=rep(m,"func doRevive() {\n","func doRevive() {\n	println \"REVIVE wallet\", wallet\n")
m=rep(m,"func offerRevive() {\n","func offerRevive() {\n	println \"OFFER wallet\", wallet\n")
m=rep(m,"func goOffline(why string) {\n","func goOffline(why string) {\n	println \"OFFLINE\", why\n")
m=rep(m,"	if !finished {\n","	println \"GAMEOVER score\", score, \"coins\", coins, \"wallet\", wallet, \"best\", best, \"online\", online, netState\n	if !finished {\n")
m=rep(m,"	if runShield > 0 {\n		showVar \"runShield\"\n","	println \"START online\", online, \"run\", runId, \"shield\", runShield, \"mul\", coinMul, \"wallet\", wallet\n	if runShield > 0 {\n		showVar \"runShield\"\n")
m+='''
onKey KeyP, => {
	autoPilot = !autoPilot
	println "autopilot", autoPilot
}
'''
open('main.spx','w').write(m)
PY
echo patched5
