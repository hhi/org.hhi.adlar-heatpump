#!/usr/bin/env python3
"""Fase 3 — flow cards ontdubbelen en splitsen (besluit B5).

Drie groepen:
  1. Kaarten met een handler in BEIDE codebases -> splitsen. De Modbus-variant
     krijgt een eigen ID (_modbus) plus driver_id-filter; het Tuya-origineel
     krijgt zijn driver_id-filter terug.
  2. Kaarten met een handler aan EEN kant -> gedeeld. Filter weg, of alleen
     driver_id schrappen als er een capability-filter is.
  3. Driver-exclusieve kaarten -> filter ongemoeid.

PROCESFOUT P2: de doelmap bevat na fase 2 ook de Modbus-exclusieve kaarten. Die
mogen NIET als "gedeeld" gelden. Bron van waarheid is de Modbus-repo, niet de
doorsnede van de doelmap.
"""
import json, os, re

M  = '../org.hhi.adlar-heatpump-modbus'
TU = 'intelligent-heat-pump'
MB = 'intelligent-heatpump-modbus'
STRATEGY = 'pipe'      # V1-uitkomst: filter weglaten maakt er een APP-kaart van

# Alle patronen waarmee de twee codebases een kaart registreren.
# LET OP (A4): de Modbus-code gebruikt ook registerCapabilityAction().
PATTERNS = [r"get(?:Action|Condition|DeviceTrigger|Trigger)Card\('([a-z_0-9]+)'",
            r"cardId: '([a-z_0-9]+)'",
            r"registerCapabilityAction\('([a-z_0-9]+)'",
            r"registerAction\('([a-z_0-9]+)'",
            r"registerCondition\('([a-z_0-9]+)'"]

def ids(paths):
    s = set()
    for p in paths:
        if os.path.exists(p):
            t = open(p).read()
            for pat in PATTERNS:
                s |= set(re.findall(pat, t))
    return s

tuya_ids = ids(['app.ts', 'lib/tuya/flow-helpers.ts',
                'lib/tuya/services/flow-card-manager-service.ts'])
mb_files = ['lib/modbus/services/flow-card-manager-service.ts',
            'drivers/intelligent-heatpump-modbus/device.ts',
            'lib/modbus/services/snapshot-trigger-service.ts']
mb_ids = ids(mb_files)

# kaartdefinities die in BEIDE repos bestonden (bron: de Modbus-repo)
loc = {}
for d in ['actions', 'conditions', 'triggers']:
    for f in os.listdir(f'{M}/.homeycompose/flow/{d}'):
        loc[json.load(open(f'{M}/.homeycompose/flow/{d}/{f}'))['id']] = (d, f)
shared = {c for c, (d, f) in loc.items() if os.path.exists(f'.homeycompose/flow/{d}/{f}')}

split = sorted(tuya_ids & mb_ids & shared)
print(f'te splitsen: {len(split)}   gedeeld te houden: {len(shared - set(split))}')

def set_filter(path, value):
    j = json.load(open(path)); ch = False
    for a in j.get('args', []):
        if a.get('type') != 'device':
            continue
        cur  = a.get('filter') or ''
        caps = [x for x in cur.split('&') if x.startswith('capabilities=')]
        new  = '&'.join(([value] if value else []) + caps)
        if new != cur:
            a['filter'] = new
            if not new:
                a.pop('filter')
            ch = True
    if ch:
        open(path, 'w').write(json.dumps(j, indent=2, ensure_ascii=False) + '\n')

# 1. splitsen
for cid in split:
    d, f = loc[cid]
    j = json.load(open(f'{M}/.homeycompose/flow/{d}/{f}'))
    j['id'] = f'{cid}_modbus'
    for a in j.get('args', []):
        if a.get('type') == 'device':
            a['filter'] = f'driver_id={MB}'
    open(f'.homeycompose/flow/{d}/{cid}_modbus.json', 'w').write(
        json.dumps(j, indent=2, ensure_ascii=False) + '\n')
    set_filter(f'.homeycompose/flow/{d}/{f}', f'driver_id={TU}')

# 2. de resterende gedeelde kaarten
for cid in sorted(shared - set(split)):
    d, f = loc[cid]
    set_filter(f'.homeycompose/flow/{d}/{f}',
               '' if STRATEGY == 'remove' else f'driver_id={TU}|{MB}')

# 3. Modbus-code: kaart-ID's hernoemen
for p in mb_files:
    if not os.path.exists(p):
        continue
    t = open(p).read(); o = t
    for cid in split:
        t = re.sub(rf"(['\"]){re.escape(cid)}\1",
                   lambda m, c=cid: f'{m.group(1)}{c}_modbus{m.group(1)}', t)
    if t != o:
        open(p, 'w').write(t)
        print(f'  hernoemd in {os.path.basename(p)}')
print('klaar — controleer de verdeling met scripts/migration/verify.py')
