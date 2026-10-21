#!/usr/bin/env python3
"""Verificatie na elke fase: verdeling, dubbele ID's, ongedefinieerde capabilities.

Generiek over N drivers (ADR-004 fase 0): de drivers komen uit drivers/*/driver.compose.json.
Draaien vanuit de projectroot.
"""
import json, os, collections

FLOW_DIRS = ['actions', 'conditions', 'triggers']


def json_files(d):
    # Alleen .json: macOS zet .DS_Store in elke map die Finder heeft geopend
    return sorted(f for f in os.listdir(d) if f.endswith('.json'))


def load(p):
    with open(p, encoding='utf-8') as fh:
        return json.load(fh)


def flow_cards():
    for d in FLOW_DIRS:
        for f in json_files(f'.homeycompose/flow/{d}'):
            yield load(f'.homeycompose/flow/{d}/{f}')


def filter_parts(fl, key):
    """Waarden van één filtersleutel, bijv. driver_id=a|b -> ['a', 'b']."""
    return [v for x in fl.split('&') if x.startswith(f'{key}=')
            for v in x[len(key) + 1:].replace(',', '|').split('|')]


drvcaps = {}
for drv in sorted(os.listdir('drivers')):
    dp = f'drivers/{drv}/driver.compose.json'
    if os.path.exists(dp):
        drvcaps[drv] = set(load(dp).get('capabilities', []))
print(f'  drivers: {", ".join(drvcaps)}')

b = collections.Counter(); tot = 0; ids = []; unknown = []
for j in flow_cards():
    tot += 1; ids.append(j['id'])
    dev = [a for a in j.get('args', []) if a.get('type') == 'device']
    fl = (dev[0].get('filter') or '') if dev else ''
    drvs = filter_parts(fl, 'driver_id')
    unknown += [(j['id'], x) for x in drvs if x not in drvcaps]
    if len(drvs) > 1:                       b[f'gedeeld ({"|".join(drvs)})'] += 1
    elif drvs:                              b[f'alleen {drvs[0]}'] += 1
    elif fl.startswith('capabilities='):    b['gedeeld (alleen capability)'] += 1
    elif not fl:                            b['APP-kaart (geen filter!)'] += 1
    else:                                   b[f'overig {fl}'] += 1
w = max([len(k) for k in b] + [6])
for k, v in sorted(b.items()):
    print(f'  {k:{w}s} {v}')
print(f'  {"TOTAAL":{w}s} {tot}')
dup = [k for k, v in collections.Counter(ids).items() if v > 1]
print('  dubbele flow-card-ID:', dup or 'geen')
print('  onbekende driver in driver_id-filter:', unknown or 'geen')

caps = [load(f'.homeycompose/capabilities/{f}') for f in json_files('.homeycompose/capabilities')]
noid = [c for c in caps if 'id' not in c]
cids = {c['id'] for c in caps if 'id' in c}
print(f'  capabilities: {len(caps)}   zonder id: {len(noid)}')
dupc = [k for k, v in collections.Counter(c['id'] for c in caps if 'id' in c).items() if v > 1]
print('  dubbele capability-ID:', dupc or 'geen')
for drv, used in drvcaps.items():
    undef = sorted(c for c in used if c.split('.')[0] not in cids
                   and c.split('.')[0].startswith(('adlar_', 'heating_', 'cop_', 'building_',
                                                   'energy_', 'adaptive_', 'defrost_')))
    print(f'  {drv}: ongedefinieerde custom capability:', undef or 'geen')

# Gedeelde kaarten (driver_id met pipe): rapporteer hoe ze feitelijk gescoped zijn.
# Een capability-filter dat één driver mist is CORRECT — zo beperk je een gedeelde
# kaart tot de driver die hem kan bedienen. Fout is alleen:
#   * geen enkele driver heeft de capability  -> dode kaart
#   * geen capability-filter terwijl de handler er een nodig heeft -> niet detecteerbaar,
#     handmatig controleren (zie IMPLEMENTATIEPLAN-v3.md §5.2)
# Vergeleken wordt met de drivers uit het eigen driver_id-filter, niet met alle drivers:
# een kaart voor twee van de drie drivers is niet "beperkt" omdat de derde ontbreekt.
dead, scoped, unscoped = [], [], []
for j in flow_cards():
    for a in j.get('args', []):
        if a.get('type') != 'device':
            continue
        fl = a.get('filter') or ''
        if '|' not in fl:
            continue
        caps = filter_parts(fl, 'capabilities')
        if not caps:
            unscoped.append(j['id'])
            continue
        targets = [x for x in filter_parts(fl, 'driver_id') if x in drvcaps] or list(drvcaps)
        owners = [drv for drv in targets if all(c in drvcaps[drv] for c in caps)]
        if not owners:
            dead.append((j['id'], caps))
        elif len(owners) < len(targets):
            scoped.append((j['id'], caps, owners))

print(f'  gedeeld, beperkt via capability: {len(scoped)}')
for i2, c, o in scoped:
    print(f'     {i2:34s} {",".join(c):22s} -> alleen {", ".join(o)}')
print(f'  gedeeld zonder capability-filter: {len(unscoped)}  (handmatig controleren)')
for i2 in unscoped:
    print(f'     {i2}')
print('  DODE kaart (geen driver heeft de capability):', dead or 'geen')
