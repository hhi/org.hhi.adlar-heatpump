#!/usr/bin/env python3
"""Fase 3 (IMPLEMENTATIEPLAN-AURORA3): flow cards.

  3A. 57 kaarten splitsen naar <id>_aurora3 (eigen driver_id-filter) + code-hernoeming
  3B. 17 gedeelde triggers: Aurora III aan het pipe-filter toevoegen
  3C. 3 COP-triggers uit de gedeelde calculator: Aurora III en (O6) Aurora II toevoegen
  3D. 5 nieuwe Aurora III-kaarten
  3E. 2 dode bronkaarten niet overnemen

Draaien vanuit de projectroot:

    python3 scripts/migration/aurora3/30-flowcards.py [pad-naar-bronrepo]
"""
import json, os, re, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
SOURCE = dict(line.split('=', 1) for line in open(os.path.join(HERE, 'SOURCE'), encoding='utf-8')
              .read().splitlines() if line and not line.startswith('#'))
SRC_REPO = sys.argv[1] if len(sys.argv) > 1 else '../org.hhi.adlar3-heatpump-modbus'
COMMIT = SOURCE['commit']
FLOW = '.homeycompose/flow'
TYPES = ['actions', 'conditions', 'triggers']

SUFFIX = '_aurora3'
TUYA = 'intelligent-heat-pump'
A2 = 'intelligent-heatpump-modbus'
A3 = 'intelligent-heatpump-aurora3'
SRC_DRIVER = 'intelligent-heatpump-modbus'  # driver-ID in de bronrepo

SPLIT = """
calculate_curve_value calculate_preheat_time calculate_time_based_value force_insight_analysis
generate_performance_report get_seasonal_mode modbus_read_register modbus_write_register
receive_external_ambient_data receive_external_energy_prices receive_external_flow_data
receive_external_indoor_temperature receive_external_power_data receive_external_solar_power
receive_external_solar_radiation receive_external_wind_data set_desired_indoor_temperature
set_heating_mode set_hotwater_temperature set_target_temperature
compressor_running confidence_above cop_efficiency_check cop_trend_analysis
daily_cop_above_threshold device_power_is fault_active heating_mode_is hotwater_temperature_is
insight_is_active monthly_cop_above_threshold power_above_threshold price_in_cheapest_hours
price_trend_is price_vs_daily_average savings_above target_temperature_is temperature_above
temperature_differential total_consumption_above water_flow_rate_check
ambient_temperature_changed coiler_temperature_alert compressor_efficiency_alert
discharge_temperature_alert eev_pulse_steps_alert evi_pulse_steps_alert
fan_motor_efficiency_alert fault_detected inlet_temperature_changed
inlet_temperature_value_changed outlet_temperature_changed outlet_temperature_value_changed
performance_report_ready suction_temperature_alert tank_temperature_alert water_flow_alert
""".split()
SHARED_PIPE = """
adaptive_simulation_update adaptive_status_change building_insight_detected
building_profile_mismatch cheapest_block_started daily_consumption_threshold
daily_cost_threshold expensive_block_approaching forecast_heating_advice heating_mode_changed
learning_milestone_reached power_threshold_exceeded pre_heat_recommendation
price_threshold_crossed price_trend_changed temperature_adjustment_recommended
total_consumption_milestone
""".split()
SHARED_COP = ['cop_trend_detected', 'daily_cop_efficiency_changed', 'monthly_cop_efficiency_changed']
NEW = ['set_backup_heater', 'set_dhw_function', 'set_silent_mode', 'dhw_heating_active', 'silent_mode_is']
DEAD = ['cop_efficiency_changed', 'cop_outlier_detected']

# Code-hernoeming: alleen deze twee bestanden noemen de 57 ID's functioneel
CODE_FILES = ['lib/aurora3/services/flow-card-manager-service.ts',
              'lib/aurora3/services/snapshot-trigger-service.ts']
# Objectsleutels zonder quotes die als kaart-ID worden opgezocht (CARD_PROFILES[cardId])
KEYED_FILE = 'lib/aurora3/services/snapshot-trigger-service.ts'
KEYED_EXPECTED = 12

# ADR-004 §2: Aurora III-modusstrings gelijktrekken met de Aurora II-spelling
MODE_PATCH = [("  1: 'Cool',\n", "  1: 'Cooling',\n"), ("  2: 'Heat',\n", "  2: 'Heating',\n")]


def git(*args):
    return subprocess.run(['git', '-C', SRC_REPO, *args], check=True, capture_output=True).stdout


def src_cards():
    cards = {}
    for p in git('ls-tree', '-r', '--name-only', COMMIT, FLOW).decode().split():
        if p.endswith('.json'):
            j = json.loads(git('show', f'{COMMIT}:{p}'))
            cards[j['id']] = (p.split('/')[2], j)
    return cards


def tgt_cards():
    cards = {}
    for t in TYPES:
        for f in sorted(os.listdir(f'{FLOW}/{t}')):
            if f.endswith('.json'):
                p = f'{FLOW}/{t}/{f}'
                cards[json.load(open(p, encoding='utf-8'))['id']] = p
    return cards


def device_args(card):
    return [a for a in card.get('args', []) if a.get('type') == 'device']


def retarget(card, new_id):
    """Kopie met nieuwe ID en driver_id-filter op Aurora III; capability-deel blijft."""
    card = json.loads(json.dumps(card))
    card['id'] = new_id
    for a in device_args(card):
        parts = (a.get('filter') or '').split('&')
        assert parts[0] == f'driver_id={SRC_DRIVER}', f'{new_id}: onverwacht filter {a.get("filter")}'
        a['filter'] = '&'.join([f'driver_id={A3}'] + parts[1:])
    assert device_args(card), f'{new_id}: geen device-argument'
    return card


def check_title_formatted(card):
    """titleFormatted mag alleen naar args verwijzen, niet naar tokens (certificering)."""
    args = {a['name'] for a in card.get('args', [])}
    for lang, text in (card.get('titleFormatted') or {}).items():
        for ref in re.findall(r'\[\[(\w+)\]\]', text):
            assert ref in args or ref == 'device', f'{card["id"]}: titleFormatted.{lang} verwijst naar {ref}'


def write_new(path, card):
    if os.path.exists(path):
        sys.exit(f'STOP: {path} bestaat al')
    with open(path, 'w', encoding='utf-8') as fh:
        fh.write(json.dumps(card, indent=2, ensure_ascii=False) + '\n')


def shape(card):
    """Structuur van args (zonder device-filter) en tokens, voor de deelbaarheidscontrole."""
    args = [(a['name'], a['type'], json.dumps(a.get('values'), sort_keys=True), a.get('min'), a.get('max'))
            for a in card.get('args', []) if a.get('type') != 'device']
    tokens = [(t['name'], t['type']) for t in card.get('tokens', [])]
    return args, tokens


def edit_filter_line(path, old, new):
    text = open(path, encoding='utf-8').read()
    line_old = f'"filter": "{old}'
    assert text.count(line_old) == 1, f'{path}: verwacht 1x {line_old}'
    with open(path, 'w', encoding='utf-8') as fh:
        fh.write(text.replace(line_old, f'"filter": "{new}'))


def main():
    if not os.path.exists('.homeycompose/app.json'):
        sys.exit('Draai vanuit de projectroot')
    src, tgt = src_cards(), tgt_cards()

    # ── Controles vooraf: niets schrijven als de indeling niet meer klopt ──
    groups = SPLIT + SHARED_PIPE + SHARED_COP + NEW + DEAD
    assert len(groups) == len(set(groups)) == len(src) == 84, 'indeling dekt de bron niet precies'
    assert all(i in tgt for i in SPLIT + SHARED_PIPE + SHARED_COP), 'gedeelde/te splitsen kaart ontbreekt in doel'
    assert not any(i + SUFFIX in tgt for i in SPLIT), '_aurora3-kaart bestaat al'
    assert not any(i in tgt for i in NEW), 'nieuwe kaart bestaat al'
    for i in SHARED_PIPE + SHARED_COP:
        t = json.load(open(tgt[i], encoding='utf-8'))
        assert shape(t) == shape(src[i][1]), f'{i}: args/tokens wijken af tussen bron en doel — niet deelbaar'
    a3_caps = set(json.load(open(f'drivers/{A3}/driver.compose.json'))['capabilities'])
    a2_caps = set(json.load(open(f'drivers/{A2}/driver.compose.json'))['capabilities'])
    for i in SHARED_PIPE + SHARED_COP:
        fl = device_args(json.load(open(tgt[i], encoding='utf-8')))[0]['filter']
        caps = [c for part in fl.split('&') if part.startswith('capabilities=')
                for c in part[len('capabilities='):].split(',')]
        if caps and not all(c in a3_caps for c in caps):
            print(f'   ⚠️  {i}: Aurora III mist {caps} in het manifest (runtime toegevoegd?) — V1')
        if i in SHARED_COP:
            assert all(c in a2_caps for c in caps), f'{i}: Aurora II mist {caps}'

    # ── 3A ──
    for i in SPLIT:
        t, card = src[i]
        new = retarget(card, i + SUFFIX)
        check_title_formatted(new)
        write_new(f'{FLOW}/{t}/{i}{SUFFIX}.json', new)
    print(f'3A. {len(SPLIT)} kaarten gesplitst naar {SUFFIX}')

    # ── 3B ──
    for i in SHARED_PIPE:
        edit_filter_line(tgt[i], f'driver_id={TUYA}|{A2}', f'driver_id={TUYA}|{A2}|{A3}')
    print(f'3B. {len(SHARED_PIPE)} gedeelde triggers: {A3} toegevoegd')

    # ── 3C (incl. O6) ──
    for i in SHARED_COP:
        edit_filter_line(tgt[i], f'driver_id={TUYA}&', f'driver_id={TUYA}|{A2}|{A3}&')
    print(f'3C. {len(SHARED_COP)} COP-triggers: {A2} (O6) en {A3} toegevoegd')

    # ── 3D ──
    for i in NEW:
        t, card = src[i]
        new = retarget(card, i)
        check_title_formatted(new)
        write_new(f'{FLOW}/{t}/{i}.json', new)
    print(f'3D. {len(NEW)} nieuwe kaarten')
    print(f'3E. {len(DEAD)} niet overgenomen: {", ".join(DEAD)}')

    # ── Code ──
    total = 0
    for path in CODE_FILES:
        text = open(path, encoding='utf-8').read()
        for i in SPLIT:
            text, n = re.subn(rf"(['\"`]){i}\1", rf'\g<1>{i}{SUFFIX}\g<1>', text)
            total += n
        if path == KEYED_FILE:
            text, n = re.subn(rf"^(\s+)({'|'.join(SPLIT)}):", rf'\g<1>\g<2>{SUFFIX}:', text, flags=re.M)
            assert n == KEYED_EXPECTED, f'{path}: verwacht {KEYED_EXPECTED} objectsleutels, gevonden {n}'
            total += n
            for old, new in MODE_PATCH:
                assert text.count(old) == 1, f'MODE_OPTIONS: {old!r} niet gevonden'
                text = text.replace(old, new)
        with open(path, 'w', encoding='utf-8') as fh:
            fh.write(text)
    code = ''.join(open(p, encoding='utf-8').read() for p in CODE_FILES)
    missing = [i for i in SPLIT if not re.search(rf"\b{i}{SUFFIX}\b", code)]
    assert not missing, f'zonder registratie of trigger in de code: {missing}'
    print(f'    code: {total} hernoemingen in {len(CODE_FILES)} bestanden; MODE_OPTIONS Cooling/Heating')


if __name__ == '__main__':
    main()
