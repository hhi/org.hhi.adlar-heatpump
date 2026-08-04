#!/usr/bin/env python3
"""Fase 4 — capabilities splitsen en harmoniseren."""
import json, os, re

M = '../org.hhi.adlar-heatpump-modbus'
SPLIT = ['adlar_enum_capacity_set', 'adlar_enum_work_mode', 'adlar_state_backwater']
INSIGHTS = ['heating_curve_intercept', 'heating_curve_ref_outdoor',
            'heating_curve_ref_temp', 'heating_curve_slope']

for cid in SPLIT:
    j = json.load(open(f'{M}/.homeycompose/capabilities/{cid}.json'))
    j['id'] = f'{cid}_modbus'
    open(f'.homeycompose/capabilities/{cid}_modbus.json', 'w').write(
        json.dumps(j, indent=2, ensure_ascii=False) + '\n')

for cid in INSIGHTS:
    p = f'.homeycompose/capabilities/{cid}.json'
    j = json.load(open(p))
    if not j.get('insights'):
        j['insights'] = True
        open(p, 'w').write(json.dumps(j, indent=2, ensure_ascii=False) + '\n')

# transport-neutrale tekst — PROCESFOUT P3: geen regex op vertaalstrings,
# de doeltekst voluit schrijven.
p = '.homeycompose/capabilities/adlar_connection_status.json'
j = json.load(open(p))
j['desc'] = {'en': 'Current heat pump connection state with timestamp',
             'nl': 'Huidige warmtepomp verbindingsstatus met tijdstempel',
             'de': 'Aktueller Wärmepumpen-Verbindungsstatus mit Zeitstempel',
             'fr': 'État de connexion actuel de la pompe à chaleur avec horodatage'}
open(p, 'w').write(json.dumps(j, indent=2, ensure_ascii=False) + '\n')

# V5: ontbrekend verplicht id-veld
import collections
p = '.homeycompose/capabilities/cop_optimizer_diagnostics.json'
j = json.load(open(p), object_pairs_hook=collections.OrderedDict)
if 'id' not in j:
    open(p, 'w').write(json.dumps(
        collections.OrderedDict([('id', 'cop_optimizer_diagnostics')] + list(j.items())),
        indent=2, ensure_ascii=False) + '\n')

# driver + code bijwerken
dp = 'drivers/intelligent-heatpump-modbus/driver.compose.json'
d = json.load(open(dp))
d['capabilities'] = [f'{c}_modbus' if c in SPLIT else c for c in d['capabilities']]
if 'capabilitiesOptions' in d:
    d['capabilitiesOptions'] = {(f'{k}_modbus' if k in SPLIT else k): v
                                for k, v in d['capabilitiesOptions'].items()}
open(dp, 'w').write(json.dumps(d, indent=2, ensure_ascii=False) + '\n')

files = ['drivers/intelligent-heatpump-modbus/device.ts']
files += [os.path.join(r, f) for r, _, fs in os.walk('lib/modbus')
          for f in fs if f.endswith('.ts')]
for p in files:
    t = open(p).read(); o = t
    for cid in SPLIT:
        t = re.sub(rf"(['\"]){re.escape(cid)}\1",
                   lambda m, c=cid: f'{m.group(1)}{c}_modbus{m.group(1)}', t)
    if t != o:
        open(p, 'w').write(t)
        print(f'  hernoemd in {p}')
print('klaar — controleer applyModbusSnapshot() handmatig: string-substitutie is niet type-gevalideerd')
