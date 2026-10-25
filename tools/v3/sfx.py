import numpy as np, wave, os
SR=22050; O='/workspace/art/out/sounds/'; os.makedirs(O,exist_ok=True)
rng=np.random.default_rng(7)
def t(d): return np.arange(int(SR*d))/SR
def env(n,a=0.005,r=0.05):
    e=np.ones(n); A=max(1,int(a*SR)); R=max(1,int(r*SR))
    e[:A]=np.linspace(0,1,A); e[-R:]*=np.linspace(1,0,R); return e
def sweep(f0,f1,d,shape='sq'):
    f=np.linspace(f0,f1,int(SR*d)); ph=2*np.pi*np.cumsum(f)/SR
    return np.sign(np.sin(ph))*0.5 if shape=='sq' else np.sin(ph)
def tone(f,d,shape='sq',duty=0.5):
    ph=(t(d)*f)%1
    if shape=='sq': return np.where(ph<duty,1.0,-1.0)*0.5
    if shape=='tri': return (4*np.abs(ph-0.5)-1)
    return np.sin(2*np.pi*ph)
def lp(x,k=0.15):
    y=np.zeros_like(x); a=0
    for i,v in enumerate(x): a+=k*(v-a); y[i]=a
    return y
def save(name,x,vol=0.8):
    x=x/ (np.max(np.abs(x))+1e-9)*vol
    with wave.open(O+name+'.wav','wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((x*32767).astype('<i2').tobytes())
j=sweep(280,760,0.16); save('jump',j*env(len(j),r=0.06),0.55)
n=rng.uniform(-1,1,int(SR*0.28)); s=lp(n,0.08)*np.linspace(1,0.2,len(n)); s*=env(len(s),0.02,0.1); save('slide',s,0.6)
c=np.concatenate([tone(988,0.06),tone(1319,0.16)]); save('coin',c*env(len(c),0.002,0.12)*np.linspace(1,0.5,len(c)),0.45)
b=np.concatenate([tone(f,0.06,duty=0.25) for f in [523,659,784,1047,1319,1568]]); b=b+0.5*sweep(400,1600,len(b)/SR,'sin'); save('boost',b*env(len(b),r=0.08),0.55)
n=rng.uniform(-1,1,int(SR*0.5)); cr=lp(n,0.25)*np.exp(-t(0.5)*7)+0.8*sweep(220,50,0.5)*np.exp(-t(0.5)*4); save('crash',cr*env(len(cr),0.001,0.05),0.8)
notes=[(523,.12),(659,.12),(784,.12),(1047,.36)]; nr=np.concatenate([tone(f,d,duty=0.25)*env(int(SR*d),0.003,0.04) for f,d in notes]); nr=nr+0.4*np.concatenate([tone(f/2,d,'tri')*env(int(SR*d)) for f,d in notes]); save('newrecord',nr,0.6)
# BGM: 132 bpm, 4 bars of 4/4, C-Am-F-G, exact length -> seamless loop
bpm=132; beat=60/bpm; step=beat/2; N=int(round(SR*beat*16)); out=np.zeros(N)
def put(x,start):
    i=int(round(start*SR)); x=x[:max(0,N-i)]; out[i:i+len(x)]+=x
chords=[(130.8,[523,659,784]),(110,[440,523,659]),(87.3,[349,440,523]),(98,[392,494,587])]
mel=[0,2,1,2, 0,1,2,1]  # index into chord tones per 8th
for bar,(root,tri) in enumerate(chords):
    for k in range(8):
        st=(bar*8+k)*step
        bf=root if k%2==0 else root*2
        put(tone(bf,step*0.9,'tri')*env(int(SR*step*0.9),0.005,0.03)*0.55,st)
        m=tri[mel[k]]* (2 if k in (3,7) else 1)
        put(tone(m,step*0.8,duty=0.25)*env(int(SR*step*0.8),0.003,0.05)*0.22,st)
        hh=rng.uniform(-1,1,int(SR*0.03)); hh=hh-lp(hh,0.3); put(hh*np.exp(-t(0.03)*120)*0.25,st)
        if k%4==0:
            kick=np.sin(2*np.pi*np.cumsum(np.linspace(150,45,int(SR*0.12)))/SR)*np.exp(-t(0.12)*25); put(kick*0.8,st)
save('bgm',out,0.35)
print({f:os.path.getsize(O+f) for f in os.listdir(O)})
