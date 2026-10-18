#!/usr/bin/env python3
"""Fase 5a (IMPLEMENTATIEPLAN-AURORA3): app-teksten en versie.

  - locales: 3 Aurora III-sleutels (en/nl uit de bron, de/fr nieuw) en het blok
    pair.enter_modbus_info, inclusief de modelwaarschuwing (O8)
  - pairingpagina van beide Modbus-drivers: modelwaarschuwing (O8)
  - drivernamen per model (O7), in vier talen
  - Aurora III-manifest: de/fr voor de 21 capabilitiesOptions-titels
  - Aurora II-instelling dashboard_port: hint noemt de poort van de Aurora III-driver
  - versie 3.2.0 in .homeycompose/app.json, package.json en package-lock.json

Draaien vanuit de projectroot:

    python3 scripts/migration/aurora3/50-texts.py
"""
import json, os, sys

VERSION_OLD, VERSION_NEW = '3.1.4', '3.2.0'
LANGS = ['en', 'nl', 'de', 'fr']
A2 = 'drivers/intelligent-heatpump-modbus'
A3 = 'drivers/intelligent-heatpump-aurora3'

LOCALE_KEYS = {
    ('building_model', 'blocked_dhw_active'): {
        'en': 'Hot water heating', 'nl': 'Tapwater verwarmen',
        'de': 'Warmwasserbereitung', 'fr': "Production d'eau chaude",
    },
    ('errors', 'zone_onoff_disabled'): {
        'en': "On/off via zone control register 2101 is experimental. Enable 'On/off via zone control "
              "(experimental)' in the device settings to use it.",
        'nl': "Aan/uit via zoneregister 2101 is experimenteel. Schakel 'Aan/uit via zonebesturing "
              "(experimenteel)' in bij de apparaatinstellingen om dit te gebruiken.",
        'de': "Ein/Aus über das Zonenregister 2101 ist experimentell. Aktivieren Sie 'Ein/Aus über "
              "Zonensteuerung (experimentell)' in den Geräteeinstellungen, um dies zu nutzen.",
        'fr': "La marche/arrêt via le registre de zone 2101 est expérimentale. Activez 'Marche/arrêt via la "
              "commande de zone (expérimental)' dans les paramètres de l'appareil pour l'utiliser.",
    },
    ('errors', 'silent_level2_r290_only'): {
        'en': 'Silent mode level 2 is only available on R290 heat pumps.',
        'nl': 'Stille modus niveau 2 is alleen beschikbaar op R290-warmtepompen.',
        'de': 'Leisemodus Stufe 2 ist nur bei R290-Wärmepumpen verfügbar.',
        'fr': "Le mode silencieux niveau 2 n'est disponible que sur les pompes à chaleur R290.",
    },
}

# Engels gelijk aan de terugvaltekst in de HTML; de sleutels ontbraken in alle bron-apps
PAIR = {
    'title': {'en': 'Modbus Connection', 'nl': 'Modbus-verbinding',
              'de': 'Modbus-Verbindung', 'fr': 'Connexion Modbus'},
    'description': {
        'en': 'Enter the IP address and port of your Elfin EW11A or Modbus TCP gateway',
        'nl': 'Voer het IP-adres en de poort van uw Elfin EW11A of Modbus TCP-gateway in',
        'de': 'Geben Sie die IP-Adresse und den Port Ihres Elfin EW11A oder Modbus-TCP-Gateways ein',
        'fr': "Saisissez l'adresse IP et le port de votre Elfin EW11A ou de votre passerelle Modbus TCP",
    },
    'model_hint': {
        'en': 'Choose the driver that matches the model on the type plate of your heat pump '
              '(Aurora II or Aurora III).',
        'nl': 'Kies de driver die past bij het model op het typeplaatje van uw warmtepomp '
              '(Aurora II of Aurora III).',
        'de': 'Wählen Sie den Treiber, der zum Modell auf dem Typenschild Ihrer Wärmepumpe passt '
              '(Aurora II oder Aurora III).',
        'fr': 'Choisissez le pilote correspondant au modèle indiqué sur la plaque signalétique de votre '
              'pompe à chaleur (Aurora II ou Aurora III).',
    },
    'host': {'en': 'IP Address:', 'nl': 'IP-adres:', 'de': 'IP-Adresse:', 'fr': 'Adresse IP :'},
    'port': {'en': 'TCP Port:', 'nl': 'TCP-poort:', 'de': 'TCP-Port:', 'fr': 'Port TCP :'},
    'unit_id': {'en': 'Modbus Unit ID:', 'nl': 'Modbus Unit-ID:', 'de': 'Modbus-Unit-ID:',
                'fr': "ID d'unité Modbus :"},
    'continue': {'en': 'Continue', 'nl': 'Doorgaan', 'de': 'Weiter', 'fr': 'Continuer'},
}
PAIR_ANCHOR = ('    <p class="homey-subtitle" data-i18n="pair.enter_modbus_info.description">'
               'Enter the IP address and port of your Elfin EW11A or Modbus TCP gateway</p>\n')
PAIR_HINT = ('    <p class="homey-subtitle" data-i18n="pair.enter_modbus_info.model_hint">'
             f'{PAIR["model_hint"]["en"]}</p>\n')

NAMES = {
    A2: {'en': 'Adlar Castra Aurora II Heat Pump (Modbus)', 'nl': 'Adlar Castra Aurora II-warmtepomp (Modbus)',
         'de': 'Adlar Castra Aurora II Wärmepumpe (Modbus)', 'fr': 'Pompe à chaleur Adlar Castra Aurora II (Modbus)'},
    A3: {'en': 'Adlar Castra Aurora III Heat Pump (Modbus)', 'nl': 'Adlar Castra Aurora III-warmtepomp (Modbus)',
         'de': 'Adlar Castra Aurora III Wärmepumpe (Modbus)', 'fr': 'Pompe à chaleur Adlar Castra Aurora III (Modbus)'},
}

# Aurora III capabilitiesOptions: pad -> (de, fr). en/nl blijven zoals in de bron.
A3_OPTIONS = {
    ('measure_frequency.compressor_freq', 'title'): ('Kompressorfrequenz', 'Fréquence du compresseur'),
    ('measure_frequency.compressor_freq', 'insightsTitle'): ('Kompressorfrequenz', 'Fréquence du compresseur'),
    ('measure_frequency.comp_target_freq', 'title'): ('Kompressor-Sollfrequenz', 'Fréquence cible du compresseur'),
    ('measure_frequency.comp_target_freq', 'insightsTitle'): ('Kompressor-Sollfrequenz', 'Fréquence cible du compresseur'),
    ('target_temperature', 'title'): ('Heiz-Sollwert', 'Consigne de chauffage'),
    ('target_temperature.cooling', 'title'): ('Kühl-Sollwert', 'Consigne de refroidissement'),
    ('target_temperature.dhw', 'title'): ('Warmwasser-Sollwert', "Consigne d'eau chaude sanitaire"),
    ('target_temperature.floor', 'title'): ('Fußbodenheizungs-Sollwert', 'Consigne du chauffage par le sol'),
    ('measure_temperature.outlet', 'title'): ('Vorlauftemperatur (TA)', 'Température de départ (TA)'),
    ('measure_temperature.inlet', 'title'): ('Rücklauftemperatur (TE1)', 'Température de retour (TE1)'),
    ('measure_temperature.ambient', 'title'): ('Außentemperatur (T4)', 'Température extérieure (T4)'),
    ('measure_temperature.outer_coil', 'title'): ('Temperatur Außenwärmetauscher (T3)', "Température de l'échangeur extérieur (T3)"),
    ('measure_temperature.suction', 'title'): ('Sauggastemperatur (TH)', "Température d'aspiration (TH)"),
    ('measure_temperature.exhaust', 'title'): ('Heißgastemperatur (TP)', 'Température de refoulement (TP)'),
    ('measure_temperature.dhw', 'title'): ('Warmwasserspeichertemperatur (TZ2)', 'Température du ballon ECS (TZ2)'),
    ('measure_temperature.buffer_tank', 'title'): ('Pufferspeichertemperatur (TW)', 'Température du ballon tampon (TW)'),
    ('measure_temperature.total_outlet', 'title'): ('Gesamtvorlauftemperatur (TC)', 'Température de départ totale (TC)'),
    ('measure_temperature.zone2', 'title'): ('Temperatur Zone 2 (Tso)', 'Température zone 2 (Tso)'),
    ('measure_current.comp_phase', 'title'): ('Kompressor-Phasenstrom', 'Courant de phase du compresseur'),
    ('measure_current.b_phase', 'title'): ('Strom Phase B', 'Courant phase B'),
    ('measure_current.c_phase', 'title'): ('Strom Phase C', 'Courant phase C'),
}

A2_PORT_HINT = {
    'en': 'Local HTTP port for the dashboards. Default is 8090 (the Aurora III driver uses 8091). '
          'Change this only if the port is already in use, then open http://<homey-ip>:<port>/.',
    'nl': 'Lokale HTTP-poort voor de dashboards. Standaard is 8090 (de Aurora III-driver gebruikt 8091). '
          'Wijzig dit alleen als de poort al in gebruik is en open daarna http://<homey-ip>:<poort>/.',
    'de': 'Lokaler HTTP-Port für die Dashboards. Standard ist 8090 (der Aurora III-Treiber verwendet 8091). '
          'Ändern Sie dies nur, wenn der Port bereits belegt ist, und öffnen Sie dann http://<homey-ip>:<port>/.',
    'fr': 'Port HTTP local pour les tableaux de bord. La valeur par défaut est 8090 (le pilote Aurora III '
          'utilise 8091). Modifiez-le uniquement si le port est déjà utilisé, puis ouvrez '
          'http://<homey-ip>:<port>/.',
}


def dump(data):
    return json.dumps(data, indent=2, ensure_ascii=False) + '\n'


def load_rt(path):
    raw = open(path, encoding='utf-8').read()
    data = json.loads(raw)
    if dump(data) != raw:
        sys.exit(f'STOP: {path} komt niet byte-gelijk terug uit json.dumps')
    return data


def save(path, data):
    with open(path, 'w', encoding='utf-8') as fh:
        fh.write(dump(data))


def locales():
    for lang in LANGS:
        path = f'locales/{lang}.json'
        data = load_rt(path)
        for (section, key), texts in LOCALE_KEYS.items():
            data.setdefault(section, {})
            assert key not in data[section], f'{path}: {section}.{key} bestaat al'
            data[section][key] = texts[lang]
        pair = data.setdefault('pair', {})
        assert 'enter_modbus_info' not in pair, f'{path}: pair.enter_modbus_info bestaat al'
        pair['enter_modbus_info'] = {k: v[lang] for k, v in PAIR.items()}
        save(path, data)
    print(f'   locales: {len(LOCALE_KEYS)} sleutels + pair.enter_modbus_info ({len(PAIR)}) in {len(LANGS)} talen')


def pair_pages():
    for drv in (A2, A3):
        path = f'{drv}/pair/enter_modbus_info.html'
        text = open(path, encoding='utf-8').read()
        assert text.count(PAIR_ANCHOR) == 1, f'{path}: ankerregel niet gevonden'
        with open(path, 'w', encoding='utf-8') as fh:
            fh.write(text.replace(PAIR_ANCHOR, PAIR_ANCHOR + PAIR_HINT))
    print('   pairingpagina: modelwaarschuwing in beide Modbus-drivers (O8)')


def manifests():
    for drv, name in NAMES.items():
        path = f'{drv}/driver.compose.json'
        data = load_rt(path)
        data['name'] = name
        if drv == A3:
            opts = data['capabilitiesOptions']
            for (cap, field), (de, fr) in A3_OPTIONS.items():
                entry = opts[cap][field]
                assert set(entry) == {'en', 'nl'}, f'{cap}.{field}: talen {sorted(entry)}'
                entry.update({'de': de, 'fr': fr})
        save(path, data)
    print(f'   drivernamen (O7) en {len(A3_OPTIONS)} Aurora III-titels in de/fr')

    # Dit bestand komt niet byte-gelijk uit json.dumps: alleen de vier hintregels als tekst vervangen
    path = f'{A2}/driver.settings.compose.json'
    text = open(path, encoding='utf-8').read()
    for lang in LANGS:
        lines = [ln for ln in text.split('\n')
                 if ln.lstrip().startswith(f'"{lang}": "') and '8090' in ln and 'HTTP' in ln]
        assert len(lines) == 1, f'{path}: dashboard_port-hint {lang} niet eenduidig ({len(lines)})'
        old = lines[0]
        indent = old[:len(old) - len(old.lstrip())]
        comma = ',' if old.rstrip().endswith(',') else ''
        text = text.replace(old, f'{indent}"{lang}": {json.dumps(A2_PORT_HINT[lang], ensure_ascii=False)}{comma}')
    json.loads(text)
    with open(path, 'w', encoding='utf-8') as fh:
        fh.write(text)
    print('   Aurora II dashboard_port-hint noemt poort 8091')


def version():
    path = '.homeycompose/app.json'
    data = load_rt(path)
    assert data['version'] == VERSION_OLD, f'{path}: versie {data["version"]}'
    data['version'] = VERSION_NEW
    save(path, data)
    for path, places in [('package.json', 1), ('package-lock.json', 2)]:
        text = open(path, encoding='utf-8').read()
        old = f'"version": "{VERSION_OLD}"'
        # alleen de eigen versievelden bovenaan: in package-lock de root en packages[""]
        head, tail = text[:2000], text[2000:]
        assert head.count(old) == places, f'{path}: verwacht {places}x {old} in de kop'
        with open(path, 'w', encoding='utf-8') as fh:
            fh.write(head.replace(old, f'"version": "{VERSION_NEW}"') + tail)
    print(f'   versie {VERSION_OLD} -> {VERSION_NEW} in compose app.json, package.json, package-lock.json')


def main():
    if not os.path.exists('.homeycompose/app.json'):
        sys.exit('Draai vanuit de projectroot')
    print('5a.')
    locales()
    pair_pages()
    manifests()
    version()


if __name__ == '__main__':
    main()
