#!/usr/bin/env python3
"""Fase 2 (IMPLEMENTATIEPLAN-AURORA3): capabilities.

  2a. 8 nieuwe capabilities ongewijzigd uit de bron
  2b. adlar_mode -> adlar_mode_aurora3 (andere enum-betekenis dan Aurora II)
  2c. 10 gedeelde beschrijvingen transport-neutraal (geen registeradressen meer)

Draaien vanuit de projectroot:

    python3 scripts/migration/aurora3/20-capabilities.py [pad-naar-bronrepo]
"""
import json, os, re, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
SOURCE = dict(line.split('=', 1) for line in open(os.path.join(HERE, 'SOURCE'), encoding='utf-8')
              .read().splitlines() if line and not line.startswith('#'))
SRC_REPO = sys.argv[1] if len(sys.argv) > 1 else '../org.hhi.adlar3-heatpump-modbus'
COMMIT = SOURCE['commit']
CAP_DIR = '.homeycompose/capabilities'

SUFFIX = '_aurora3'
SPLIT = 'adlar_mode'

NEW = ['adlar_backup_heater_forced', 'adlar_compressor_on', 'adlar_dhw_active',
       'adlar_dhw_enabled', 'adlar_disinfection_enabled', 'adlar_high_pressure',
       'adlar_low_pressure', 'adlar_silent_mode']

# 2b: bestand -> verwacht aantal treffers op woordgrens (gemeten bij fase 2)
SPLIT_FILES = {
    'drivers/intelligent-heatpump-aurora3/driver.compose.json': 1,
    'drivers/intelligent-heatpump-aurora3/device.ts': 3,
    'lib/aurora3/constants.ts': 1,
    'lib/aurora3/services/building-model-service.ts': 2,
    'lib/aurora3/services/capability-health-service.ts': 1,
    'lib/aurora3/services/flow-card-manager-service.ts': 2,
    'lib/aurora3/services/widget-state-service.ts': 1,
    'public/aurora3/dashboard-live.html': 1,
    'test/unit/aurora3/building-model-service.test.js': 2,
    'test/unit/aurora3/dashboard-service.test.js': 2,
}
SPLIT_SCOPE = ['lib/aurora3', 'drivers/intelligent-heatpump-aurora3', 'public/aurora3',
               'test/unit/aurora3', 'test/aurora3']

# 2c: betekenis in plaats van bron. Titels en insightsTitle* blijven ongewijzigd.
NEUTRAL = {
    'adlar_antifreeze': {
        'en': 'Antifreeze protection status. True while the heat pump is protecting the water circuit against freezing.',
        'nl': 'Status van de vorstbeveiliging. Waar zolang de warmtepomp het watercircuit tegen bevriezing beschermt.',
        'de': 'Status des Frostschutzes. Wahr, solange die Wärmepumpe den Wasserkreis vor dem Einfrieren schützt.',
        'fr': "État de la protection antigel. Vrai tant que la pompe à chaleur protège le circuit d'eau contre le gel.",
    },
    'adlar_defrosting': {
        'en': 'Defrost status. True while the outdoor coil is actively being defrosted.',
        'nl': 'Ontdooistatus. Waar zolang de buitenspoel actief wordt ontdooid.',
        'de': 'Abtaustatus. Wahr, solange der Außenwärmetauscher aktiv abgetaut wird.',
        'fr': "État de dégivrage. Vrai pendant le dégivrage actif de l'échangeur extérieur.",
    },
    'adlar_eev_step': {
        'en': 'Opening position of the main electronic expansion valve (EEV), in stepper motor steps.',
        'nl': 'Openingspositie van de elektronische hoofdexpansieklep (EEV), in stappenmotor-stappen.',
        'de': 'Öffnungsposition des elektronischen Hauptexpansionsventils (EEV), in Schrittmotorschritten.',
        'fr': "Position d'ouverture du détendeur électronique principal (EEV), en pas du moteur pas à pas.",
    },
    'adlar_evi_step': {
        'en': 'Opening position of the auxiliary expansion valve for vapour injection (EVI), in stepper motor steps.',
        'nl': 'Openingspositie van de hulpexpansieklep voor dampinjectie (EVI), in stappenmotor-stappen.',
        'de': 'Öffnungsposition des Hilfsexpansionsventils für die Dampfeinspritzung (EVI), in Schrittmotorschritten.',
        'fr': "Position d'ouverture du détendeur auxiliaire pour l'injection de vapeur (EVI), en pas du moteur pas à pas.",
    },
    'adlar_fan_speed': {
        'en': 'Speed of the outdoor unit fan, in RPM.',
        'nl': 'Snelheid van de ventilator in de buitenunit, in RPM.',
        'de': 'Drehzahl des Ventilators der Außeneinheit, in U/min.',
        'fr': "Vitesse du ventilateur de l'unité extérieure, en tr/min.",
    },
    'adlar_fault_active': {
        'en': 'Active fault and protection codes with their description. Empty when no fault is present.',
        'nl': 'Actieve storings- en beveiligingscodes met omschrijving. Leeg als er geen storing is.',
        'de': 'Aktive Störungs- und Schutzcodes mit Beschreibung. Leer, wenn keine Störung vorliegt.',
        'fr': "Codes de défaut et de protection actifs avec leur description. Vide en l'absence de défaut.",
    },
    'adlar_fault_shutdown': {
        'en': 'Fault shutdown status. True when the heat pump has stopped because of a fault.',
        'nl': 'Storingsstop. Waar als de warmtepomp door een storing is gestopt.',
        'de': 'Störabschaltung. Wahr, wenn die Wärmepumpe wegen einer Störung abgeschaltet hat.',
        'fr': "Arrêt sur défaut. Vrai lorsque la pompe à chaleur s'est arrêtée à cause d'un défaut.",
    },
    'adlar_pump_pwm': {
        'en': 'Speed of the circulation pump as a PWM duty cycle percentage.',
        'nl': 'Snelheid van de circulatiepomp als PWM-vulgraad in procent.',
        'de': 'Drehzahl der Umwälzpumpe als PWM-Tastgrad in Prozent.',
        'fr': 'Vitesse du circulateur en rapport cyclique PWM, en pourcentage.',
    },
    'adlar_running': {
        'en': 'Running status. True when the heat pump is actively running.',
        'nl': 'Bedrijfsstatus. Waar als de warmtepomp actief draait.',
        'de': 'Betriebsstatus. Wahr, wenn die Wärmepumpe aktiv läuft.',
        'fr': 'État de fonctionnement. Vrai lorsque la pompe à chaleur fonctionne activement.',
    },
    'adlar_sterilization': {
        'en': 'Sterilization status. True during an active Legionella prevention cycle.',
        'nl': 'Sterilisatiestatus. Waar tijdens een actieve legionellapreventiecyclus.',
        'de': 'Sterilisationsstatus. Wahr während eines aktiven Legionellen-Schutzzyklus.',
        'fr': 'État de stérilisation. Vrai pendant un cycle actif de prévention de la légionellose.',
    },
}
LANGS = ['en', 'nl', 'de', 'fr']


def git_show(path):
    return subprocess.run(['git', '-C', SRC_REPO, 'show', f'{COMMIT}:{path}'],
                          check=True, capture_output=True).stdout


def dump(data):
    return json.dumps(data, indent=2, ensure_ascii=False) + '\n'


def load_roundtrip(path):
    """Lees JSON en eis dat terugschrijven byte-gelijk is: zo geeft een wijziging geen opmaakruis."""
    raw = open(path, encoding='utf-8').read()
    data = json.loads(raw)
    if dump(data) != raw:
        sys.exit(f'STOP: {path} komt niet byte-gelijk terug uit json.dumps; handmatig bewerken')
    return data


def write_new(path, text):
    if os.path.exists(path):
        sys.exit(f'STOP: {path} bestaat al')
    with open(path, 'w', encoding='utf-8') as fh:
        fh.write(text)


def step_2a():
    for cap in NEW:
        raw = git_show(f'{CAP_DIR}/{cap}.json').decode()
        data = json.loads(raw)
        assert data.get('id') == cap, f'{cap}: id ontbreekt of wijkt af'
        icon = data.get('icon', '')
        assert icon and os.path.exists(icon.lstrip('/')), f'{cap}: icoon {icon!r} ontbreekt'
        write_new(f'{CAP_DIR}/{cap}.json', raw)
    print(f'2a. {len(NEW)} capabilities toegevoegd')


def step_2b():
    new_id = SPLIT + SUFFIX
    data = json.loads(git_show(f'{CAP_DIR}/{SPLIT}.json').decode())
    data['id'] = new_id
    write_new(f'{CAP_DIR}/{new_id}.json', dump(data))

    word = re.compile(rf'\b{re.escape(SPLIT)}\b')
    for path, expected in SPLIT_FILES.items():
        text = open(path, encoding='utf-8').read()
        n = len(word.findall(text))
        assert n == expected, f'{path}: verwacht {expected}x {SPLIT}, gevonden {n}'
        with open(path, 'w', encoding='utf-8') as fh:
            fh.write(word.sub(new_id, text))

    left = []
    for root in SPLIT_SCOPE:
        for dirpath, _, files in os.walk(root):
            for f in files:
                p = os.path.join(dirpath, f)
                try:
                    if word.search(open(p, encoding='utf-8').read()):
                        left.append(p)
                except UnicodeDecodeError:
                    pass
    assert not left, f'{SPLIT} nog aanwezig in: {left}'
    print(f'2b. {SPLIT} -> {new_id}: {sum(SPLIT_FILES.values())} plekken in {len(SPLIT_FILES)} bestanden')


def step_2c():
    for cap, texts in NEUTRAL.items():
        path = f'{CAP_DIR}/{cap}.json'
        data = load_roundtrip(path)
        assert sorted(data['description']) == sorted(LANGS), f'{cap}: talen wijken af'
        data['description'] = {lang: texts[lang] for lang in data['description']}
        with open(path, 'w', encoding='utf-8') as fh:
            fh.write(dump(data))
    print(f'2c. {len(NEUTRAL)} beschrijvingen transport-neutraal')


def main():
    if not os.path.exists('.homeycompose/app.json'):
        sys.exit('Draai vanuit de projectroot')
    # Alle round-trips vooraf, zodat een STOP niets half achterlaat
    for cap in NEUTRAL:
        load_roundtrip(f'{CAP_DIR}/{cap}.json')
    step_2a()
    step_2b()
    step_2c()


if __name__ == '__main__':
    main()
