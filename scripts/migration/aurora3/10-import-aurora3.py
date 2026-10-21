#!/usr/bin/env python3
"""Fase 1 (IMPLEMENTATIEPLAN-AURORA3): Aurora III-code en -driver importeren.

Leest de bronrepo via `git show` op de commit uit SOURCE, zodat de uitvoer niet afhangt
van de werkboom van de bronrepo. Draaien vanuit de projectroot:

    python3 scripts/migration/aurora3/10-import-aurora3.py [pad-naar-bronrepo]

Stappen:
  1. Controle: de 19 meegebruikte bestanden zijn na import-herschrijving gelijk aan de
     doelbestanden (anders stoppen, zonder iets te schrijven).
  2. Controle: geen module-brede veranderlijke state in de meegebruikte bestanden.
  3. 21 bestanden naar lib/aurora3/, driver naar drivers/<DRIVER_ID>/, assets, public,
     tests — met alle relatieve imports herschreven.
"""
import json, os, posixpath, re, subprocess, sys

DRIVER_ID = 'intelligent-heatpump-aurora3'
SRC_DRIVER = 'drivers/intelligent-heatpump-modbus'
DST_DRIVER = f'drivers/{DRIVER_ID}'
DASHBOARD_PORT_OLD, DASHBOARD_PORT_NEW = 8090, 8091

HERE = os.path.dirname(os.path.abspath(__file__))
SOURCE = dict(line.split('=', 1) for line in open(os.path.join(HERE, 'SOURCE'), encoding='utf-8')
              .read().splitlines() if line and not line.startswith('#'))
SRC_REPO = sys.argv[1] if len(sys.argv) > 1 else '../org.hhi.adlar3-heatpump-modbus'
COMMIT = SOURCE['commit']

# ── Modulemap: bronmodule (zonder .ts) -> doelmodule ────────────────────────────────
REUSE = {
    'lib/curve-calculator': 'lib/shared/curve-calculator',
    'lib/error-types': 'lib/shared/error-types',
    'lib/logger': 'lib/shared/logger',
    'lib/seasonal-mode-calculator': 'lib/shared/seasonal-mode-calculator',
    'lib/self-healing-registry': 'lib/shared/self-healing-registry',
    'lib/time-schedule-calculator': 'lib/shared/time-schedule-calculator',
    'lib/utils/preheat-calculator': 'lib/shared/utils/preheat-calculator',
    'lib/adaptive/building-model-learner': 'lib/shared/adaptive/building-model-learner',
    'lib/adaptive/defrost-learner': 'lib/shared/adaptive/defrost-learner',
    'lib/services/rolling-cop-calculator': 'lib/shared/services/rolling-cop-calculator',
    'lib/services/settings-manager-service': 'lib/shared/services/settings-manager-service',
    'lib/services/weather-forecast-service': 'lib/shared/services/weather-forecast-service',
    'lib/adaptive/cop-optimizer': 'lib/modbus/adaptive/cop-optimizer',
    'lib/adaptive/energy-price-optimizer': 'lib/modbus/adaptive/energy-price-optimizer',
    'lib/adaptive/heating-controller': 'lib/modbus/adaptive/heating-controller',
    'lib/adaptive/weighted-decision-maker': 'lib/modbus/adaptive/weighted-decision-maker',
    'lib/services/external-temperature-service': 'lib/modbus/services/external-temperature-service',
    'lib/services/wind-correction-service': 'lib/modbus/services/wind-correction-service',
}
# Vervalt: alleen door de bron-app.ts gebruikt; die wordt niet overgenomen (fase 4)
DROPPED = {'lib/flow-handler-wrapper': 'lib/shared/flow-handler-wrapper'}

COPY = {
    'lib/constants': 'lib/aurora3/constants',
    'lib/types/shared-interfaces': 'lib/aurora3/types/shared-interfaces',
    **{f'lib/modbus/{m}': f'lib/aurora3/protocol/{m}' for m in [
        'adlar3-modbus-registers', 'adlar3-modbus-service',
        'modbus-runtime-service', 'modbus-tcp-service']},
    **{f'lib/services/{m}': f'lib/aurora3/services/{m}' for m in [
        'adaptive-control-service', 'building-insights-service', 'building-model-service',
        'capability-health-service', 'cop-calculator', 'dashboard-service',
        'energy-tracking-service', 'flow-card-manager-service', 'modbus-connection-service',
        'modbus-cop-service', 'performance-report-service', 'scop-calculator',
        'service-coordinator', 'snapshot-trigger-service', 'widget-state-service']},
}
MODMAP = {**REUSE, **DROPPED, **COPY}

ASSETS = ['assets/backup-heater.svg', 'assets/silent-mode.svg', 'assets/dhw-tank.svg']
TEST_SUPPORT = re.compile(r'^test/(.*\.mbs|test-adlar3-registers.*|test-sim3-registers.*|readme\.md)$')

# Padverwijzingen die geen import zijn maar wel van de nieuwe testlocatie afhangen:
# doelbestand -> [(oud, nieuw, verwacht aantal)]
PATH_PATCHES = {
    'test/unit/aurora3/dashboard-service.test.js': [
        ("path.join(__dirname, '..', '..')", "path.join(__dirname, '..', '..', '..')", 1),
    ],
    'test/aurora3/test-sim3-registers.ts': [
        ("path.resolve(process.cwd(), 'test', 'adlar3-server.mbs')",
         "path.resolve(process.cwd(), 'test', 'aurora3', 'adlar3-server.mbs')", 1),
        ('MBS_FILE=test/adlar3-server.mbs', 'MBS_FILE=test/aurora3/adlar3-server.mbs', 2),
    ],
}


def apply_path_patches(dst, text):
    for old, new, n in PATH_PATCHES.get(dst, []):
        assert text.count(old) == n, f'{dst}: verwacht {n}x "{old}"'
        text = text.replace(old, new)
    return text


# ── Hulpfuncties ────────────────────────────────────────────────────────────────────
def git(*args):
    return subprocess.run(['git', '-C', SRC_REPO, *args], check=True,
                          capture_output=True).stdout


def src_files():
    return git('ls-tree', '-r', '--name-only', COMMIT).decode().splitlines()


def src_read(path):
    return git('show', f'{COMMIT}:{path}')


def write(path, data):
    if os.path.exists(path):
        sys.exit(f'STOP: {path} bestaat al — script is niet idempotent bedoeld; eerst opruimen')
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'wb') as fh:
        fh.write(data if isinstance(data, bytes) else data.encode('utf-8'))


SPEC = re.compile(r"""(?P<q>['"])(?P<spec>\.{1,2}/[^'"\n]*)(?P=q)""")
HOMEYBUILD = '.homeybuild/'


def rewrite_imports(text, src_path, dst_path, unresolved):
    """Herschrijf relatieve modulepaden van src_path-perspectief naar dst_path-perspectief.

    Alleen paden die naar een bekende bronmodule wijzen worden aangepast (ook via
    .homeybuild/ in tests); andere relatieve strings blijven ongemoeid.
    """
    src_dir, dst_dir = posixpath.dirname(src_path), posixpath.dirname(dst_path)

    def repl(m):
        spec = m.group('spec')
        target = posixpath.normpath(posixpath.join(src_dir, spec))
        build = target.startswith(HOMEYBUILD)
        mod = target[len(HOMEYBUILD):] if build else target
        mod = re.sub(r'\.(ts|js)$', '', mod)
        if mod not in MODMAP:
            if mod.startswith('lib/'):
                unresolved.append((src_path, spec))
            return m.group(0)
        new_mod = (HOMEYBUILD if build else '') + MODMAP[mod]
        rel = posixpath.relpath(new_mod, dst_dir)
        if not rel.startswith('.'):
            rel = './' + rel
        return f"{m.group('q')}{rel}{m.group('q')}"

    return SPEC.sub(repl, text)


def strip_specs(text):
    return SPEC.sub("'<spec>'", text)


# ── 1. Meegebruikte bestanden controleren ───────────────────────────────────────────
def check_reuse():
    problems, notes = [], []
    for src_mod, dst_mod in REUSE.items():
        src = src_read(src_mod + '.ts').decode()
        dst = open(dst_mod + '.ts', encoding='utf-8').read()
        unresolved = []
        rewritten = rewrite_imports(src, src_mod + '.ts', dst_mod + '.ts', unresolved)
        if rewritten == dst:
            continue
        if strip_specs(src) == strip_specs(dst):
            a = sorted(set(SPEC.findall(rewritten)) - set(SPEC.findall(dst)))
            notes.append((src_mod, [s for _, s in a]))
        else:
            problems.append(src_mod)
    return problems, notes


MODULE_STATE = re.compile(r'^(let|var)\s|^\s+static\s+(?!readonly)(?!async)(?!\w+\s*\()\w+\s*[:=]'
                          r'|^(const|let|var)\s+\w+\s*(:[^=]+)?=\s*new\s+(Map|Set|WeakMap)\b', re.M)


def check_module_state():
    hits = []
    for dst_mod in REUSE.values():
        for m in MODULE_STATE.finditer(open(dst_mod + '.ts', encoding='utf-8').read()):
            hits.append((dst_mod, m.group(0).strip()))
    return hits


# ── 3. Importeren ───────────────────────────────────────────────────────────────────
def settings_port_hint(entry):
    entry['value'] = DASHBOARD_PORT_NEW
    entry['hint'] = {
        'en': f'Local HTTP port for the Aurora III dashboards. Default is {DASHBOARD_PORT_NEW} '
              f'(the Aurora II driver uses {DASHBOARD_PORT_OLD}). Change this only if the port is '
              'already in use, then open http://<homey-ip>:<port>/.',
        'nl': f'Lokale HTTP-poort voor de Aurora III-dashboards. Standaard is {DASHBOARD_PORT_NEW} '
              f'(de Aurora II-driver gebruikt {DASHBOARD_PORT_OLD}). Wijzig dit alleen als de poort '
              'al in gebruik is en open daarna http://<homey-ip>:<poort>/.',
        'de': f'Lokaler HTTP-Port für die Aurora III-Dashboards. Standard ist {DASHBOARD_PORT_NEW} '
              f'(der Aurora II-Treiber verwendet {DASHBOARD_PORT_OLD}). Ändern Sie dies nur, wenn '
              'der Port bereits belegt ist, und öffnen Sie dann http://<homey-ip>:<port>/.',
        'fr': f'Port HTTP local pour les tableaux de bord Aurora III. La valeur par défaut est '
              f'{DASHBOARD_PORT_NEW} (le pilote Aurora II utilise {DASHBOARD_PORT_OLD}). Modifiez-le '
              'uniquement si le port est déjà utilisé, puis ouvrez http://<homey-ip>:<port>/.',
    }


def patch_settings(text):
    data = json.loads(text)
    found = []

    def walk(items):
        for e in items:
            if e.get('children'):
                walk(e['children'])
            elif e.get('id') == 'dashboard_port':
                settings_port_hint(e)
                found.append(e)
    walk(data)
    assert len(found) == 1, 'dashboard_port niet (eenduidig) gevonden'
    return json.dumps(data, indent=2, ensure_ascii=False) + '\n'


def patch_driver_ts(text):
    assert text.count('class ModbusDriver ') == 1
    return re.sub(r'\bModbusDriver\b', 'Aurora3ModbusDriver', text)


def patch_device_ts(text):
    assert text.count('class AdlarModbusDevice ') == 1
    text = re.sub(r'\bAdlarModbusDevice\b', 'Aurora3ModbusDevice', text)
    old = f'dashboard_port ?? {DASHBOARD_PORT_OLD})'
    assert text.count(old) == 2, f'verwacht 2x "{old}"'
    return text.replace(old, f'dashboard_port ?? {DASHBOARD_PORT_NEW})')


def import_all(files):
    unresolved, written = [], []

    def put(dst, data):
        write(dst, data)
        written.append(dst)

    for src_mod, dst_mod in COPY.items():
        text = src_read(src_mod + '.ts').decode()
        put(dst_mod + '.ts', rewrite_imports(text, src_mod + '.ts', dst_mod + '.ts', unresolved))

    for f in files:
        if not f.startswith(SRC_DRIVER + '/'):
            continue
        dst = DST_DRIVER + f[len(SRC_DRIVER):]
        data = src_read(f)
        if f.endswith('.ts'):
            text = rewrite_imports(data.decode(), f, dst, unresolved)
            if f.endswith('/driver.ts'):
                text = patch_driver_ts(text)
            elif f.endswith('/device.ts'):
                text = patch_device_ts(text)
            data = text
        elif f.endswith('/driver.settings.compose.json'):
            data = patch_settings(data.decode())
        put(dst, data)

    for a in ASSETS:
        put(a, src_read(a))
    for f in files:
        if f.startswith('public/'):
            put('public/aurora3/' + f[len('public/'):], src_read(f))
        elif re.match(r'^test/unit/[^/]+\.test\.js$', f):
            dst = 'test/unit/aurora3/' + posixpath.basename(f)
            text = rewrite_imports(src_read(f).decode(), f, dst, unresolved)
            put(dst, apply_path_patches(dst, text))
        elif TEST_SUPPORT.match(f):
            dst = 'test/aurora3/' + f[len('test/'):]
            data = src_read(f)
            if f.endswith('.ts'):
                data = apply_path_patches(dst, rewrite_imports(data.decode(), f, dst, unresolved))
            put(dst, data)
    missing = set(PATH_PATCHES) - set(written)
    assert not missing, f'PATH_PATCHES voor niet-geschreven bestanden: {missing}'
    return written, unresolved


def main():
    if not os.path.exists('.homeycompose/app.json'):
        sys.exit('Draai vanuit de projectroot')
    files = src_files()
    print(f'Bron: {SOURCE["app_id"]} v{SOURCE["version"]} @ {COMMIT[:7]}')

    problems, notes = check_reuse()
    print(f'1. Meegebruikt: {len(REUSE)} bestanden, {len(REUSE) - len(problems)} gelijk na herschrijving')
    for mod, specs in notes:
        print(f'   ⚠️  {mod}: gelijk op importpad na, bron zou wijzen naar {specs}')
    if problems:
        sys.exit(f'STOP: inhoudelijk verschil in {problems}')

    importers = [f for f in files if f.endswith('.ts') and f != 'app.ts'
                 and 'flow-handler-wrapper' in src_read(f).decode()]
    if importers:
        sys.exit(f'STOP: flow-handler-wrapper wordt buiten app.ts gebruikt: {importers}')

    hits = check_module_state()
    print(f'2. Module-brede state in meegebruikte bestanden: {len(hits)} treffers')
    for h in hits:
        print(f'   {h}')

    written, unresolved = import_all(files)
    print(f'3. Geschreven: {len(written)} bestanden')
    for prefix in ['lib/aurora3/', DST_DRIVER + '/', 'assets/', 'public/aurora3/',
                   'test/unit/aurora3/', 'test/aurora3/']:
        print(f'   {prefix:32s} {sum(1 for w in written if w.startswith(prefix))}')
    if unresolved:
        print('   ❌ Niet herleidbare lib-imports:')
        for u in unresolved:
            print(f'      {u}')
        sys.exit(1)


if __name__ == '__main__':
    main()
