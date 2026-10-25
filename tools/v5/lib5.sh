export DISPLAY=:99
S=/workspace/running_bull
launch(){ pkill -f "spx run"; pkill -f gdspx; sleep 1; L=$1; cd /workspace/test_run/rb5; (spx run > $L 2>&1 &)
 for i in $(seq 1 60); do sleep 1; W=$(xdotool search --onlyvisible --name "XGo Builder" 2>/dev/null | head -1); [ -n "$W" ] && break; done; sleep 3
 eval $(xdotool getwindowgeometry --shell $W); OX=$X; OY=$Y; }
shot(){ ffmpeg -loglevel error -y -f x11grab -video_size 480x360 -i :99+$OX,$OY -frames:v 1 $S/screenshot_v5_$1.png; echo "SHOT $1" >> /tmp/run5_steps.log; }
clk(){ xdotool mousemove $((OX+240+$1)) $((OY+180-$2)) mousedown 1; sleep 0.12; xdotool mouseup 1; sleep 0.35; }
k(){ xdotool key $1; sleep 0.25; }
waitfor(){ for i in $(seq 1 $2); do sleep 0.2; [ $(grep -c "$1" $L) -gt ${3:-0} ] && return 0; done; echo "TIMEOUT $1" >> /tmp/run5_steps.log; }
# keypad digit d via mouse: keys 1..9 -> k=d-1 ; 0 -> k=10
pad(){ d=$1; if [ $d = 0 ]; then kk=10; else kk=$((d-1)); fi; clk $((50+60*(kk%3))) $((82-44*(kk/3))); }
typenick(){ k t; sleep 1; clk -20 -125; xdotool type --delay 90 "$1"; sleep 0.3; clk 190 -125; sleep 0.8; }
