# Adlar klimaatcurves (stooklijnen HH1–HH8, HL1–HL8)

**Bron:** handleiding Adlar Castra, § 4.10.1 "Klimaattemperatuurcurves
(stooklijnen)", overgenomen uit een foto van de grafieken (31 okt 2026):
[adlar-climate-curves-4.10.1.jpg](adlar-climate-curves-4.10.1.jpg). Treden
opnieuw afgelezen op 1 nov 2026.
**Nauwkeurigheid:** ±1 °C per waarde en ±2 °C buiten per knikpunt. Niet
gemeten op de warmtepomp.
**Doel:** vertaaltabel van een vaste curve naar de twee velden van de
app-stooklijn (3.5.0: tabel in de handleiding; 3.6.0, punt G15: keuzelijst
`adaptive_curve_fixed` die de velden invult, tabel `FIXED_CURVES` in
`lib/shared/adaptive/positional-pi-controller.ts`).

## Vorm

- Elke curve is een traplijn: het doel (T1S) daalt in stappen van 1 °C naarmate
  de buitentemperatuur (T4) stijgt
- Onder ongeveer −17 tot −19 °C buiten is de curve vlak op de waarde bij kou
- Boven ongeveer +15 tot +18 °C buiten is de curve vlak op de waarde bij zacht
  weer
- Daartussen dalen de stappen gelijkmatig: in grote lijnen een rechte lijn,
  afgerond op hele graden
- Binnen één curve zijn de treden even breed, en curves met evenveel treden
  hebben ze op dezelfde plaatsen. Dat wijst op een formule (een rechte lijn,
  afgerond), niet op een met de hand afgestemde vorm. Geen verhoging rond 0 °C
  te zien

| Curve | Treden bij (°C buiten) | Afstand |
| --- | --- | --- |
| HH1 | −16, −8½, −1, +6½, +15 | 7½ – 7½ – 7½ – 8½ |
| HH6 | −16, −8½, −1, +7, +15 | 7½ – 7½ – 8 – 8 |
| HH8 | −17, −9, −½, +7, +15 | 8 – 8½ – 7½ – 8 |
| HL1 | −16½, −10½, −4, +3, +9½, +16 | 6 – 6½ – 7 – 6½ – 6½ |

- De eerste trede valt direct na het koude vlakke stuk, de laatste precies bij
  het begin van het zachte vlakke stuk. Het midden van de trap ligt daardoor
  een halve graad onder de waarde bij kou en een halve graad boven de waarde
  bij zacht weer

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

## Gebruik in de app

Tussen de vlakke stukken loopt elke curve recht. De app-stooklijn (waarde bij
−15 en +15 °C buiten) volgt het midden van de trap, op de traptreden van
±0,5 °C na. Een aparte rekenmethode voor deze curves is daarom niet nodig.

| Curve | −15 °C | +15 °C | Curve | −15 °C | +15 °C |
| --- | --- | --- | --- | --- | --- |
| HH1 | 54 | 51 | HL1 | 37 | 33 |
| HH2 | 54 | 46 | HL2 | 34 | 31 |
| HH3 | 53 | 42 | HL3 | 32 | 30 |
| HH4 | 49 | 46 | HL4 | 34 | 29 |
| HH5 | 49 | 41 | HL5 | 32 | 29 |
| HH6 | 44 | 41 | HL6 | 30 | 27 |
| HH7 | 44 | 36 | HL7 | 28 | 27 |
| HH8 | 39 | 36 | HL8 | 28 | 25 |

- Middenlijn van de trap: lineair van (vlak tot, kou − 0,5) naar (vlak vanaf,
  zacht weer + 0,5), afgerond op hele graden (de velden gaan per 1 °C; ,5 naar
  boven). De test `test/unit/fixed-curve.test.js` rekent dit na
- Bij HH2, HH5 en HH7 valt een trede rond −15 °C; daar ligt de trap bij −15 °C
  1 °C lager dan de tabel
- Tot 3.6.0 stond hier de lijn tussen de hoeken van de vlakke stukken. Die was
  bij 13 van de 16 curves 1 °C te steil: bij −15 °C 1 °C te hoog, bij +15 °C
  vaak 1 °C te laag
- Na OFF kan de app de gekozen curve niet meer uitlezen: de gebruiker neemt de
  waarden over vóór hij de stooklijnkeuze op OFF zet
- Startwaarden van 3.5.0: Radiatoren 50 / 35 (rond HH7), Vloerverwarming
  35 / 27 (rond HL4–HL6)
- Boven +15 °C buiten blijft de curve vlak en daalt de app-lijn door; bij dat
  weer is de warmtevraag klein en begrenst de warmtepomp het setpoint
- DIY (Aurora I/II): de app gebruikt de DIY-lijn alleen als de DIY-schakelaar
  (0x0810) op DIY staat en k negatief is; anders zijn k en b restwaarden

## Toetsen

Per curve één punt op de warmtepomp: de curve kiezen, bij bekende T1 het
setpoint aflezen (Aurora I/II: 0x0301, Tuya: doeltemperatuur) en vergelijken
met de tabel. Alleen doen als de gebruiker zijn stooklijn tijdelijk mag
wisselen.
