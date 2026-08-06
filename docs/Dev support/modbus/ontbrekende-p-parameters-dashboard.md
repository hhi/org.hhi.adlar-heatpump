# Ontbrekende P-parameters in het dashboard

Gebaseerd op vergelijking tussen:
- `docs/Heatpump specs/modbus/OEM/OPxPii-TB_TC_TD_protocol_V1.2.9_system_params_P.md`
- `todo/scan-overige.p.registers.txt` (scan 192.168.50.92, 2026-05-09)
- `lib/modbus/adlar-modbus-registers.ts` (P_PARAMETERS export)

Totaal ontbrekend: ~115 registers. Werkconditie-ijkpunten (P184–P253) zijn fabrieksinstelling en niet zinvol om toe te voegen.

---

## EEV / ventielregeling

| P | Adres | Naam | Waarde |
|---|---|---|---|
| P38 | 0x0126 | Heating main valve initial opening constant | 300 |
| P40 | 0x0128 | Cooling target superheat correction | -2 °C |
| P41 | 0x0129 | Heating HP protection freq limit correction | 2 °C |
| P42 | 0x012A | Heating target superheat correction | -1 °C |
| P46 | 0x012E | Liquid injection valve return difference | 8 °C |
| P47 | 0x012F | EVI target superheat constant | 1 |
| P71 | 0x0147 | Turn on enthalpy control frequency | 45 Hz |
| P72 | 0x0148 | Stop enthalpy increase frequency | 35 Hz |
| P73–P78 | 0x0149–0x014E | Main valve openings (koel/ht min/max) | 400/300/350/100/40/480 P |
| P79–P81 | 0x014F–0x0151 | Main valve initial opening c/a/b | 80/60/40 |
| P82–P83 | 0x0152–0x0153 | Aux valve max/min opening | 480/30 P |
| P84 | 0x0154 | Main valve regulation period | 40 s |
| P85–P87 | 0x0155–0x0157 | Aux valve initial opening c/a/b | 50/30/20 |
| P90–P94 | 0x015A–0x015E | EVI condities (temp/tijd/ΔT/compressor/cycle) | 23°C/3min/2°C/1min/40s |

---

## Watertemperatuur compensatie

| P | Adres | Naam | Waarde |
|---|---|---|---|
| P97 | 0x0161 | Water tank temp auto compensation | 0 (Enable) |
| P98 | 0x0162 | Water tank temp manual compensation | 0 °C |

---

## 4-weg klep / moduswissel

| P | Adres | Naam | Waarde |
|---|---|---|---|
| P102 | 0x0166 | Four-way valve control mode | 0 (Cooling Power On) |
| P104 | 0x0168 | Mode switch operating freq % | 25 % |

---

## Frequentie-afscherming zones

| P | Adres | Naam | Waarde |
|---|---|---|---|
| P121–P124 | 0x0179–0x017C | Heating freq shield zone 1+2 (low/high) | 0/0/0/0 Hz |
| P125–P126 | 0x017D–0x017E | Heating freq shield zone 3 | 0/0 Hz |
| P127–P132 | 0x017F–0x0184 | Cooling freq shield zones 1–3 | alle 0 Hz |
| P133 | 0x0185 | Fan module | 1 (Individual) |

---

## Ontdooiing (uitgebreid)

| P | Adres | Naam | Waarde |
|---|---|---|---|
| P135 | 0x0187 | ΔT to start anti-condensation | 5 °C |
| P136 | 0x0188 | Ambient temp to open throttle bypass | 25 °C |
| P137 | 0x0189 | Throttle bypass delay compressor | 0 s |
| P138 | 0x018A | Defrost compressor frequency | 70 Hz |
| P141 | 0x018D | Dew point defrost duration | 5 min |
| P142 | 0x018E | Dew point defrost constant | 11 |
| P143 | 0x018F | Water temp to enter defrost | 7 °C |
| P144 | 0x0190 | Ambient temp to enter defrost | 17 °C |
| P145 | 0x0191 | Outlet water antifreeze protection | -30 °C |

---

## Koeling antifreeze

| P | Adres | Naam | Waarde |
|---|---|---|---|
| P147 | 0x0193 | Cooling anti-freeze mode | 2 (LP+temp) |
| P148 | 0x0194 | Cooling anti-freeze temperature | 1 °C |
| P149 | 0x0195 | Water outlet high limit freq | 58 °C |

---

## Warmtebron temperatuurlimieten

| P | Adres | Naam | Waarde |
|---|---|---|---|
| P153 | 0x0199 | Combined DHW heat source upper temp | 70 °C |
| P154 | 0x019A | Combined heating heat source upper temp | 60 °C |
| P158 | 0x019E | Heating limit water temp, start ambient | -15 °C |
| P159 | 0x019F | Limit temp constant | 68 |
| P160 | 0x01A0 | Limit temp coefficient | 14 |

---

## Load shedding / cascading

| P | Adres | Naam | Waarde |
|---|---|---|---|
| P165 | 0x01A5 | Load return difference | 3 °C |
| P166 | 0x01A6 | Load shedding hysteresis | 2 °C |
| P167 | 0x01A7 | Emergency stop return difference | 3 °C |
| P168–P170 | 0x01A8–0x01AA | HW/non-HW start ratio + loading cycle | 50%/100%/7min |
| P171 | 0x01AB | Shield low voltage switch ambient | -30 °C |
| P172 | 0x01AC | DC fan target freq constant c | 65 Hz |
| P173 | 0x01AD | Heating fan target freq lower limit | 40 Hz |

---

## Defrost timing / Powerful mode

| P | Adres | Naam | Waarde |
|---|---|---|---|
| P175 | 0x01AF | Constant temp operation cycle | 10 min |
| P176 | 0x01B0 | Minimum defrost time | 0 s |
| P177 | 0x01B1 | Defrost segmented water temp | 40 °C |
| P178 | 0x01B2 | High water temp defrost frequency | 70 Hz |
| P179 | 0x01B3 | Strong mode freq increase | 15 Hz |
| P180 | 0x01B4 | Powerful mode freq cap increase | 5 Hz |

---

## Werkconditie-ijkpunten *(fabrieksinstelling, lees-only)*

| P | Adressen | Inhoud | Waarden |
|---|---|---|---|
| P184–P193 | 0x01B8–0x01C1 | Compressor freq bij 35/55°C A-E | 25–85 Hz |
| P194–P203 | 0x01C2–0x01CB | Fan freq bij 35/55°C A-E | 25–55 Hz |
| P204–P213 | 0x01CC–0x01D5 | Hoofdklep superheat bij 35/55°C A-E | 1–2 °C |
| P214–P223 | 0x01D6–0x01DF | Hoofdklep opening bij 35/55°C A-E | 85–150 P |
| P224–P233 | 0x01E0–0x01E9 | Aux klep superheat bij 35/55°C A-E | 2 °C |
| P234–P243 | 0x01EA–0x01F3 | Aux klep opening bij 35/55°C A-E | 35–350 P |
| P244–P253 | 0x01F4–0x01FD | Waterflow/fan/klep targets 35/55 rated | diverse |

---

## Dubbele zone / mengklep

| P | Adres | Naam | Waarde |
|---|---|---|---|
| P257 | 0x0201 | Dual temperature zone selection | 2 (Disable) |
| P258 | 0x0202 | Mixed water regulating valve cycle | 7 min |
| P259 | 0x0203 | Mixing valve full cycle time | 120 s |

---

## Overig

| P | Adres | Naam | Waarde |
|---|---|---|---|
| P183 | 0x01B7 | Parameter password | 998 |
| P155 | 0x019B | Compressor code (reserved) | 0 |
| P156–P157 | 0x019C–0x019D | Aux EEV selection + ΔT to reduce | 0/0 |
