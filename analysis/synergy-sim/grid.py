import json,glob,re
N=['Aggro','Tank','Heal','Combo','Control','Random']
band={'Aggro':(55,65),'Tank':(40,55),'Heal':(45,55),'Combo':(50,60),'Control':(45,55),'Random':(45,55)}
rows=[]
for f in sorted(glob.glob('out/tune-B7-*.json')):
    m=re.search(r'tune-B7-(\d+)_(\d+)',f); a,b=int(m[1]),int(m[2]); d=json.load(open(f))['overall']
    w=[d[n]['winPct'] for n in N]; pen=sum(max(0,band[n][0]-x,x-band[n][1]) for n,x in zip(N,w)); met=sum(band[n][0]<=x<=band[n][1] for n,x in zip(N,w))
    rows.append((pen,a,b,w,met,d['Aggro']['avgTurns']))
rows.sort()
print('| rank | DEF+ (ATK<=20) | DEF+ (ATK21-30) | '+' | '.join(N)+' | bands | band-miss pts |\n|---|---|---|'+'---:|'*6+'---:|---:|')
for i,(p,a,b,w,m,t) in enumerate(rows[:10]): print(f'| {i+1} | +{a} | +{b} | '+' | '.join(str(x) for x in w)+f' | {m}/6 | {p:.0f} |')
print('worst:',rows[-1][:3],rows[-1][3])
