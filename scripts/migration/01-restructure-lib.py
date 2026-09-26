#!/usr/bin/env python3
"""Fase 1 — lib/ herstructureren naar shared/ + tuya/. Gedragsneutraal.

Verplaatst 35 bestanden met `git mv` (behoudt historie) en herschrijft alle
relatieve imports. Draaien vanuit de repository-root.

LET OP (procesfout P1): specifiers moeten worden opgelost tegen de OORSPRONKELIJKE
map van het bestand, niet tegen de nieuwe. Anders breken imports tussen twee
onderling verplaatste bestanden.
"""
import json, os, re, subprocess, glob

SHARED = {
    'lib/curve-calculator.ts':                 'lib/shared/curve-calculator.ts',
    'lib/error-types.ts':                      'lib/shared/error-types.ts',
    'lib/flow-handler-wrapper.ts':             'lib/shared/flow-handler-wrapper.ts',
    'lib/logger.ts':                           'lib/shared/logger.ts',
    'lib/seasonal-mode-calculator.ts':         'lib/shared/seasonal-mode-calculator.ts',
    'lib/self-healing-registry.ts':            'lib/shared/self-healing-registry.ts',
    'lib/time-schedule-calculator.ts':         'lib/shared/time-schedule-calculator.ts',
    'lib/utils/preheat-calculator.ts':         'lib/shared/utils/preheat-calculator.ts',
    'lib/adaptive/building-model-learner.ts':  'lib/shared/adaptive/building-model-learner.ts',
    'lib/adaptive/defrost-learner.ts':         'lib/shared/adaptive/defrost-learner.ts',
    'lib/services/cop-calculator.ts':          'lib/shared/services/cop-calculator.ts',
    'lib/services/rolling-cop-calculator.ts':  'lib/shared/services/rolling-cop-calculator.ts',
    'lib/services/settings-manager-service.ts':'lib/shared/services/settings-manager-service.ts',
    'lib/services/weather-forecast-service.ts':'lib/shared/services/weather-forecast-service.ts',
}
TUYA_DIRS  = ['lib/adaptive', 'lib/services', 'lib/definitions', 'lib/types']
TUYA_FILES = ['lib/constants.ts', 'lib/flow-helpers.ts']

moves = dict(SHARED)
for d in TUYA_DIRS:
    for f in glob.glob(d + '/**/*.ts', recursive=True):
        moves.setdefault(f, f.replace('lib/', 'lib/tuya/', 1))
for f in TUYA_FILES:
    moves[f] = f.replace('lib/', 'lib/tuya/', 1)
moves = {os.path.normpath(k): os.path.normpath(v) for k, v in moves.items()}

for src, dst in moves.items():
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    r = subprocess.run(['git', 'mv', src, dst], capture_output=True, text=True)
    if r.returncode:
        print('MV FAIL', src, r.stderr.strip())
print(f'verplaatst: {len(moves)}')

new2old = {v: k for k, v in moves.items()}
modmap  = {k[:-3]: v[:-3] for k, v in moves.items()}

files = []
for root, _, fs in os.walk('.'):
    if any(x in root for x in ('node_modules', '.homeybuild', '.git')):
        continue
    files += [os.path.normpath(os.path.join(root, f)) for f in fs if f.endswith('.ts')]

pat = re.compile(r"""(from\s+|import\s*\()(['"])(\.[^'"]+)\2""")
total = 0
for f in files:
    old_dir = os.path.dirname(new2old.get(f, f))   # <-- oorspronkelijke map
    new_dir = os.path.dirname(f)
    txt = open(f).read(); orig = txt

    def repl(m):
        global total
        pre, q, spec = m.group(1), m.group(2), m.group(3)
        target = os.path.normpath(os.path.join(old_dir, spec))
        dest   = modmap.get(target, target)
        new    = os.path.relpath(dest, new_dir).replace(os.sep, '/')
        if not new.startswith('.'):
            new = './' + new
        if new != spec:
            total += 1
        return f'{pre}{q}{new}{q}'

    txt = pat.sub(repl, txt)
    if txt != orig:
        open(f, 'w').write(txt)
print(f'imports herschreven: {total}')
print('opruimen: rmdir lib/adaptive lib/definitions lib/services lib/types lib/utils')
