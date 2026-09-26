#!/usr/bin/env python3
"""Verificatie na elke fase: verdeling, dubbele ID's, ongedefinieerde capabilities."""
import json, os, collections

b = collections.Counter(); tot = 0; ids = []
for d in ['actions', 'conditions', 'triggers']:
    for f in os.listdir(f'.homeycompose/flow/{d}'):
        j = json.load(open(f'.homeycompose/flow/{d}/{f}')); tot += 1; ids.append(j['id'])
        dev = [a for a in j.get('args', []) if a.get('type') == 'device']
        fl = (dev[0].get('filter') or '') if dev else ''
        drv = next((x[len('driver_id='):] for x in fl.split('&')
                    if x.startswith('driver_id=')), None)
        if drv and '|' in drv:                  b['gedeeld (driver_id=a|b)'] += 1
        elif drv == 'intelligent-heatpump-modbus': b['Modbus-only'] += 1
        elif drv == 'intelligent-heat-pump':    b['Tuya-only'] += 1
        elif fl.startswith('capabilities='):    b['gedeeld (alleen capability)'] += 1
        elif not fl:                            b['APP-kaart (geen filter!)'] += 1
        else:                                   b[f'overig {fl}'] += 1
for k, v in sorted(b.items()):
    print(f'  {k:28s} {v}')
print(f'  {"TOTAAL":28s} {tot}')
dup = [k for k, v in collections.Counter(ids).items() if v > 1]
print('  dubbele flow-card-ID:', dup or 'geen')

caps = [json.load(open(f'.homeycompose/capabilities/{f}'))
        for f in os.listdir('.homeycompose/capabilities')]
noid = [c for c in caps if 'id' not in c]
cids = {c['id'] for c in caps if 'id' in c}
print(f'  capabilities: {len(caps)}   zonder id: {len(noid)}')
dupc = [k for k, v in collections.Counter(c['id'] for c in caps if 'id' in c).items() if v > 1]
print('  dubbele capability-ID:', dupc or 'geen')
for drv in os.listdir('drivers'):
    p = f'drivers/{drv}/driver.compose.json'
    if not os.path.exists(p): continue
    used = json.load(open(p)).get('capabilities', [])
    undef = [c for c in used if c.split('.')[0] not in cids
             and c.split('.')[0].startswith(('adlar_', 'heating_', 'cop_', 'building_',
                                             'energy_', 'adaptive_', 'defrost_'))]
    print(f'  {drv}: ongedefinieerde custom capability:', undef or 'geen')

# Gedeelde kaarten (driver_id met pipe): rapporteer hoe ze feitelijk gescoped zijn.
# Een capability-filter dat één driver mist is CORRECT — zo beperk je een gedeelde
# kaart tot de driver die hem kan bedienen. Fout is alleen:
#   * geen enkele driver heeft de capability  -> dode kaart
#   * geen capability-filter terwijl de handler er een nodig heeft -> niet detecteerbaar,
#     handmatig controleren (zie IMPLEMENTATIEPLAN-v3.md §5.2)
drvcaps = {}
for drv in os.listdir('drivers'):
    dp = f'drivers/{drv}/driver.compose.json'
    if os.path.exists(dp):
        drvcaps[drv] = set(json.load(open(dp)).get('capabilities', []))

dead, scoped, unscoped = [], [], []
for d in ['actions', 'conditions', 'triggers']:
    for f in os.listdir(f'.homeycompose/flow/{d}'):
        j = json.load(open(f'.homeycompose/flow/{d}/{f}'))
        for a in j.get('args', []):
            if a.get('type') != 'device':
                continue
            fl = a.get('filter') or ''
            if '|' not in fl:
                continue
            caps = [c for x in fl.split('&') if x.startswith('capabilities=')
                    for c in x[len('capabilities='):].split(',')]
            if not caps:
                unscoped.append(j['id'])
                continue
            owners = [drv for drv, have in drvcaps.items() if all(c in have for c in caps)]
            if not owners:
                dead.append((j['id'], caps))
            elif len(owners) < len(drvcaps):
                scoped.append((j['id'], caps, owners))

print(f'  gedeeld, beperkt via capability: {len(scoped)}')
for i2, c, o in scoped:
    print(f'     {i2:34s} {",".join(c):22s} -> alleen {", ".join(o)}')
print(f'  gedeeld zonder capability-filter: {len(unscoped)}  (handmatig controleren)')
for i2 in unscoped:
    print(f'     {i2}')
print('  DODE kaart (geen driver heeft de capability):', dead or 'geen')
