import json,sys
names=['Aggro','Tank','Heal','Combo','Control','Random']
band={'Aggro':(55,65),'Tank':(40,55),'Heal':(45,55),'Combo':(50,60),'Control':(45,55),'Random':(45,55)}
tags=sys.argv[1:]
print('| config | '+' | '.join(names)+' | in band | Tank turns | Aggro turns |'); print('|'+'---|'*(len(names)+4))
for t in tags:
    d=json.load(open(f'out/{t}.json'));o=d['overall'];ib=sum(band[n][0]<=o[n]['winPct']<=band[n][1] for n in names)
    print(f"| {t} | "+' | '.join(str(o[n]['winPct']) for n in names)+f" | {ib}/6 | {o['Tank']['avgTurns']} | {o['Aggro']['avgTurns']} |")
