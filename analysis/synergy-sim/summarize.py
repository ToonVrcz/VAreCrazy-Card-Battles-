import json,sys
O='out/'; L=lambda t: json.load(open(O+t+'.json'))
N=['Aggro','Tank','Heal','Combo','Control','Random']
band={'Aggro':(55,65),'Tank':(40,55),'Heal':(45,55),'Combo':(50,60),'Control':(45,55),'Random':(45,55)}
def row(t,k='winPct'): d=L(t)['overall']; return [d[n][k] for n in N]
def tbl(title,tags,labels,k='winPct'):
    print(f'\n**{title}**\n\n| Config | '+' | '.join(N)+' |\n|---|'+'---:|'*len(N))
    for t,l in zip(tags,labels): print(f'| {l} | '+' | '.join(str(x) for x in row(t,k))+' |')
V=['base','B2','B3','B4','B5','B6','B7']
tbl('Win rate %, Starter, Story on',[f'starter-story-{v}' for v in V],['base (no synergy)','B2 table, no cap','B3 + cap HP10/DEF4','B4 all-friendly scope','B5 HP only','B6 DEF only','B7 max-HP only (no heal)'])
for k,t in [('avgTurns','Average turns'),('dmgPerTurn','Damage per turn (units+LP, both sides)'),('deathsPerGame','Character deaths per game'),('directPerGame','Direct attacks per game'),('lpWinPct','% games ended by LP (not deck-out)'),('synCoveragePct','Synergy coverage % of unit-actions boosted')]:
    tbl(t+' — Starter, Story on',[f'starter-story-{v}' for v in V],V,k)
for pre,t in [('starter-nostory','Starter, Story OFF'),('starter-nofusion','Starter, Fusion OFF (Story on)'),('adv-story','Advanced tier (Evolution+Lv40+), Story on'),('adv-nostory','Advanced tier, Story OFF')]:
    tbl('Win rate % — '+t,[f'{pre}-base',f'{pre}-B3'],['base','B3'])
print('\n**Target band check (Starter, Story on)**\n\n| Config | '+' | '.join(N)+' | bands met |\n|---|'+'---:|'*len(N)+'---:|')
for v in V:
    r=row(f'starter-story-{v}'); m=sum(band[n][0]<=x<=band[n][1] for n,x in zip(N,r)); print(f'| {v} | '+' | '.join(('✅ ' if band[n][0]<=x<=band[n][1] else '❌ ')+str(x) for n,x in zip(N,r))+f' | {m}/6 |')
for t in ['starter-story-base','starter-story-B3','starter-story-B7']:
    d=L(t); print(f'\n**Matchup matrix {t}** (row beats column, %)\n\n| | '+' | '.join(N)+' |\n|---|'+'---:|'*len(N))
    for a in N: print(f'| {a} | '+' | '.join('–' if a==b else str(d['M'][a][b]['winPct']) for b in N)+' |')
