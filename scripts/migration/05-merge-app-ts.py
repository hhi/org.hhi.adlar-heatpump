#!/usr/bin/env python3
"""Fase 6 — Modbus-specifieke app.ts-code overzetten naar de Tuya app.ts.

De Modbus app.ts telt 227 regels, waarvan 116 uniek: de widget-state-resolver en
de dashboard-poortbeheer. De rest (log/error/onInit/onUninit) bestaat al in de
doel-app, daar uitgebreider.

Bewust NIET gewijzigd (zie IMPLEMENTATIEPLAN-v3.md §6.1):
  ADLAR_DRIVER_ID blijft 'intelligent-heatpump-modbus'. De widget is alleen voor
  de Modbus-driver bedoeld en zijn capability-filter sluit Tuya al uit.

Draaien vanuit de repository-root, met ../org.hhi.adlar-heatpump-modbus ernaast.
Idempotent: draait het script twee keer, dan gebeurt er de tweede keer niets.
"""
import re
import sys

SRC = '../org.hhi.adlar-heatpump-modbus/app.ts'
DST = 'app.ts'

src = open(SRC).read()
dst = open(DST).read()

if 'getAdlarLiveOperationWidgetState' in dst:
    print('app.ts bevat de Modbus-code al — niets te doen')
    sys.exit(0)


def extract_method(text, name):
    """Pak een methode inclusief voorafgaand JSDoc-blok uit een klasse."""
    m = re.search(rf'^(  (?:private |public |async )*{re.escape(name)}\()', text, re.M)
    if not m:
        raise SystemExit(f'methode niet gevonden: {name}')
    start = m.start()
    # JSDoc erboven meenemen
    head = text[:start].rstrip('\n').split('\n')
    doc = []
    while head and (head[-1].strip().startswith('*') or head[-1].strip().startswith('/**')):
        doc.insert(0, head.pop())
    lines = text[start:].split('\n')
    body, depth, started = [], 0, False
    for line in lines:
        body.append(line)
        depth += line.count('{') - line.count('}')
        if '{' in line:
            started = True
        if started and depth == 0:
            break
    return '\n'.join(doc + body)


METHODS = ['getAdlarLiveOperationWidgetState', '_getAdlarDevices',
           '_findAdlarDevice', 'setDashboardPort']
block = '\n\n'.join(extract_method(src, m) for m in METHODS)

# 1. imports + module-constanten + interface
imports = ("import { DashboardService } from './lib/modbus/services/dashboard-service';\n"
           "import { LiveOperationWidgetState } from "
           "'./lib/modbus/services/widget-state-service';\n")
consts = ("\n// ── Modbus-dashboard en -widget (fase 6) ─────────────────────────────\n"
          "const DEFAULT_DASHBOARD_PORT = 8090;\n"
          "/** De widget is uitsluitend voor de Modbus-driver; zie IMPLEMENTATIEPLAN-v3.md §6.1 */\n"
          "const ADLAR_DRIVER_ID = 'intelligent-heatpump-modbus';\n\n"
          "interface LiveOperationWidgetDevice {\n"
          "  getData(): unknown;\n"
          "  getLiveOperationWidgetState?: () => LiveOperationWidgetState;\n"
          "}\n")

last_import = list(re.finditer(r'^import .*?;$', dst, re.M))[-1]
dst = dst[:last_import.end()] + '\n' + imports.rstrip() + '\n' + consts + dst[last_import.end():]

# 2. klassevelden + getter direct na de class-declaratie
fields = ("\n  // Local HTTP dashboard server (ADR-041a) — alleen actief met een Modbus-device\n"
          "  private _dashboard: DashboardService | null = null;\n\n"
          "  private _dashboardPort = DEFAULT_DASHBOARD_PORT;\n\n"
          "  get dashboard(): DashboardService | null {\n"
          "    return this._dashboard;\n"
          "  }\n")
cls = re.search(r'^class MyApp extends [A-Za-z.]+ \{$', dst, re.M)
dst = dst[:cls.end()] + fields + dst[cls.end():]

# 3. methodes vóór de afsluitende accolade van de klasse
# De klasse eindigt bij de laatste '}' op kolom 0 vóór module.exports.
# Let op: daartussen kan commentaar staan.
exp = re.search(r'^module\.exports = MyApp;', dst, re.M)
tail = list(re.finditer(r'^\}$', dst[:exp.start()], re.M))[-1]
dst = dst[:tail.start()] + '\n\n' + block + dst[tail.start():]

# 4. dashboard conditioneel starten — AAN HET EIND van onInit.
#    Niet aan het begin: this.logger wordt pas halverwege onInit geïnitialiseerd,
#    dus this.logger.debug() zou daar crashen.
init = re.search(r'  async onInit\(\)[^\n]*\{\n', dst)
start = ("    // Start het lokale dashboard alleen wanneer er een Modbus-device gepaird is.\n"
         "    // Een Tuya-only installatie krijgt zo geen HTTP-server op poort 8090.\n"
         "    try {\n"
         "      const modbusDevices = this.homey.drivers.getDriver(ADLAR_DRIVER_ID).getDevices();\n"
         "      if (modbusDevices.length > 0) {\n"
         "        await this.setDashboardPort(DEFAULT_DASHBOARD_PORT);\n"
         "      } else {\n"
         "        this.logger.debug('App: no Modbus devices paired — dashboard server not started');\n"
         "      }\n"
         "    } catch (error) {\n"
         "      this.error('Failed to evaluate Modbus dashboard startup:', error);\n"
         "    }\n\n")
_i = init.end(); _depth = 1; _out = _i
for _ln in dst[_i:].split('\n'):
    _depth += _ln.count('{') - _ln.count('}')
    _out += len(_ln) + 1
    if _depth == 0:
        break
_end = dst.rindex('\n', 0, _out - 1)          # vóór de sluitende '  }'
dst = dst[:_end + 1] + '\n' + start.rstrip('\n') + '\n' + dst[_end + 1:]

# 5. dashboard opruimen in onUninit
uninit = re.search(r'(  async onUninit\(\)[^\n]*\{\n)', dst)
stop = ("    if (this._dashboard) {\n"
        "      await this._dashboard.destroy();\n"
        "      this._dashboard = null;\n"
        "    }\n\n")
dst = dst[:uninit.end()] + stop + dst[uninit.end():]

open(DST, 'w').write(dst)
print(f'app.ts samengevoegd — {len(block.splitlines())} regels Modbus-code toegevoegd')
