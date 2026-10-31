# Adlar klimaatcurves (stooklijnen HH1–HH8, HL1–HL8)

**Bron:** handleiding Adlar Castra, § 4.10.1 "Klimaattemperatuurcurves
(stooklijnen)", overgenomen uit een foto van de grafieken (31 okt 2026).
**Nauwkeurigheid:** ±1 °C per waarde en ±2 °C buiten per knikpunt. Niet
gemeten op de warmtepomp.
**Doel:** basis voor "Stooklijn van de warmtepomp" bij de vaste curves
(gepland voor 3.6.0, punt G15).

## Vorm

- Elke curve is een traplijn: het doel (T1S) daalt in stappen van 1 °C naarmate
  de buitentemperatuur (T4) stijgt
- Onder ongeveer −17 tot −19 °C buiten is de curve vlak op de waarde bij kou
- Boven ongeveer +15 tot +18 °C buiten is de curve vlak op de waarde bij zacht
  weer
- Daartussen dalen de stappen gelijkmatig: in grote lijnen een rechte lijn,
  afgerond op hele graden

## Hoge watertemperatuur (HH1–HH8)

| Curve | Kou (°C) | Zacht weer (°C) | Vlak tot (T4) | Vlak vanaf (T4) |
| --- | --- | --- | --- | --- |
| HH1 | 55 | 50 | ~−17 | ~+15 |
| HH2 | 55 | 45 | ~−19 | ~+17 |
| HH3 | 55 | 40 | ~−19 | ~+18 |
| HH4 | 50 | 45 | ~−18 | ~+17 |
| HH5 | 50 | 40 | ~−19 | ~+17 |
| HH6 | 45 | 40 | ~−18 | ~+15 |
| HH7 | 45 | 35 | ~−19 | ~+17 |
| HH8 | 40 | 35 | ~−17 | ~+15 |

## Lage watertemperatuur (HL1–HL8)

| Curve | Kou (°C) | Zacht weer (°C) | Vlak tot (T4) | Vlak vanaf (T4) |
| --- | --- | --- | --- | --- |
| HL1 | 38 | 32 | ~−17 | ~+16 |
| HL2 | 35 | 30 | ~−18 | ~+16 |
| HL3 | 33 | 30 | ~−17 | ~+14 |
| HL4 | 35 | 28 | ~−18 | ~+17 |
| HL5 | 33 | 28 | ~−17 | ~+16 |
| HL6 | 31 | 26 | ~−17 | ~+16 |
| HL7 | 29 | 26 | ~−17 | ~+15 |
| HL8 | 29 | 24 | ~−18 | ~+16 |

## Koppeling aan de drivers (aangenomen, niet getoetst)

| Driver | Instelling | Waarde → curve |
| --- | --- | --- |
| Tuya | DPS 13 (`countdown_set`) | H1–H8 → HH1–HH8, L1–L8 → HL1–HL8 |
| Aurora I/II | 0x0314 (Heating Curve) | 1–8 → HH1–HH8, 11–18 → HL1–HL8 |

Aurora III levert de berekende waarde van zijn klimaatcurve direct (Reg 67) en
heeft deze tabel niet nodig.

## Gebruik in de app (voorstel 3.6.0)

- Basis = de waarde van de gekozen curve bij T1, met lineaire interpolatie
  tussen "vlak tot" en "vlak vanaf"; afronden zoals de warmtepomp (hele
  graden) is niet nodig, de app rondt het advies zelf af
- Bij een setpoint dat moet blijven staan, staat de curve zelf op OFF: de app
  kent dan de laatst gekozen curve niet meer. Bewaar de curve daarom bij het
  overstappen, of laat de gebruiker hem kiezen als startwaarde voor de
  app-stooklijn
- Startwaarden van 3.5.0 liggen in het midden van deze curves: Radiatoren
  50 / 35 (rond HH7), Vloerverwarming 35 / 27 (rond HL4–HL6)

## Toetsen

Per curve één punt op de warmtepomp: de curve kiezen, bij bekende T1 het
setpoint aflezen (Aurora I/II: 0x0301, Tuya: doeltemperatuur) en vergelijken
met de tabel. Alleen doen als de gebruiker zijn stooklijn tijdelijk mag
wisselen.
