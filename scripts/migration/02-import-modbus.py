#!/usr/bin/env python3
"""Fase 2 — Modbus-code, driver, capabilities, flow cards en assets overnemen.

Draaien vanuit de repository-root van org.hhi.adlar-heatpump, met de Modbus-repo
ernaast. Additief: raakt geen bestaande Tuya-code aan.

Twee bewuste keuzes:
  * de 14 byte-identieke bestanden worden NIET gekopieerd; de Modbus-code
    importeert ze uit lib/shared/
  * lib/modbus/ (submap in de bronrepo) wordt lib/modbus/protocol/ om het
    dubbele pad lib/modbus/modbus/ te vermijden
"""
import json, os, re, shutil

M = '../org.hhi.adlar-heatpump-modbus'
SHARED14 = ['curve-calculator.ts', 'error-types.ts', 'flow-handler-wrapper.ts', 'logger.ts',
            'seasonal-mode-calculator.ts', 'self-healing-registry.ts', 'time-schedule-calculator.ts',
            'utils/preheat-calculator.ts', 'adaptive/building-model-learner.ts',
            'adaptive/defrost-learner.ts', 'services/cop-calculator.ts',
            'services/rolling-cop-calculator.ts', 'services/settings-manager-service.ts',
            'services/weather-forecast-service.ts']

def dest(rel):
    return 'lib/modbus/protocol/' + rel[len('modbus/'):] if rel.startswith('modbus/') \
        else 'lib/modbus/' + rel

copied = {}
for root, _, fs in os.walk(f'{M}/lib'):
    for f in sorted(fs):
        if not f.endswith('.ts'):
            continue
        src = os.path.join(root, f)
        rel = os.path.relpath(src, f'{M}/lib').replace(os.sep, '/')
        if rel in SHARED14:
            continue
        d = dest(rel)
        os.makedirs(os.path.dirname(d), exist_ok=True)
        shutil.copy2(src, d)
        copied[rel] = d
print(f'lib-bestanden gekopieerd: {len(copied)}')

shutil.copytree(f'{M}/drivers/intelligent-heatpump-modbus',
                'drivers/intelligent-heatpump-modbus',
                dirs_exist_ok=True, ignore=shutil.ignore_patterns('.DS_Store'))

for f in sorted(set(os.listdir(f'{M}/.homeycompose/capabilities'))
                - set(os.listdir('.homeycompose/capabilities'))):
    shutil.copy2(f'{M}/.homeycompose/capabilities/{f}', f'.homeycompose/capabilities/{f}')

for d in ['actions', 'conditions', 'triggers']:
    for f in sorted(set(os.listdir(f'{M}/.homeycompose/flow/{d}'))
                    - set(os.listdir(f'.homeycompose/flow/{d}'))):
        shutil.copy2(f'{M}/.homeycompose/flow/{d}/{f}', f'.homeycompose/flow/{d}/{f}')

# V9: assets NIET vergeten — de Modbus-capabilities verwijzen naar eigen iconen.
# Ontbrekende assets breken pas bij `homey app validate -l publish`, niet bij tsc.
for f in sorted(set(os.listdir(f'{M}/assets')) - set(os.listdir('assets'))):
    src = f'{M}/assets/{f}'
    if os.path.isfile(src) and not f.startswith('.'):
        shutil.copy2(src, f'assets/{f}')

for sub in ['public', 'widgets']:
    if os.path.isdir(f'{M}/{sub}'):
        shutil.copytree(f'{M}/{sub}', sub, dirs_exist_ok=True,
                        ignore=shutil.ignore_patterns('.DS_Store'))

# imports in de gekopieerde bestanden herschrijven
mod = {rel[:-3]: dst[:-3] for rel, dst in copied.items()}
mod.update({rel[:-3]: 'lib/shared/' + rel[:-3] for rel in SHARED14})

targets = [os.path.join(r, f) for r, _, fs in os.walk('lib/modbus')
           for f in fs if f.endswith('.ts')]
targets += ['drivers/intelligent-heatpump-modbus/device.ts',
            'drivers/intelligent-heatpump-modbus/driver.ts']
new2old = {v: k for k, v in copied.items()}
pat = re.compile(r"""(from\s+|import\s*\()(['"])(\.[^'"]+)\2""")
total = 0
for f in targets:
    if not os.path.exists(f):
        continue
    old_rel  = new2old.get(f.replace(os.sep, '/'))
    old_dir  = os.path.dirname(old_rel) if old_rel else None
    is_drv   = f.startswith('drivers/')
    new_dir  = os.path.dirname(f)
    txt = open(f).read(); orig = txt

    def repl(m):
        global total
        pre, q, spec = m.group(1), m.group(2), m.group(3)
        if is_drv:                       # '../../lib/xxx' -> t.o.v. bron-lib/
            t = os.path.normpath(os.path.join('drivers/x', spec)).replace(os.sep, '/')
            if not t.startswith('lib/'):
                return m.group(0)
            key = t[len('lib/'):]
        else:
            key = os.path.normpath(os.path.join(old_dir, spec)).replace(os.sep, '/')
        if key not in mod:
            return m.group(0)
        new = os.path.relpath(mod[key], new_dir).replace(os.sep, '/')
        if not new.startswith('.'):
            new = './' + new
        total += 1
        return f'{pre}{q}{new}{q}'

    txt = pat.sub(repl, txt)
    if txt != orig:
        open(f, 'w').write(txt)
print(f'imports herschreven: {total}')
print("vergeet niet: jsmodbus ^4.0.10 toevoegen aan package.json dependencies")
