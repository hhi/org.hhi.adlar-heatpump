# Testprotocol 3.5: positionele regeling bij vloerverwarming

Voor wie: een tester met **Aurora I/II** of **Aurora III** en vloerverwarming.
Versie: testversie **3.5.2** (bevat 3.5.0 en 3.5.1).

| Fase | Wat | Duur |
| --- | --- | --- |
| 0 | Voorbereiden en de huidige stand vastleggen | 15 minuten |
| 1 | Schaduw: de app adviseert, de warmtepomp merkt niets | 24–48 uur |
| 2 | Gesloten lus: een flow voert het advies uit | 1–2 weken |

Stop op elk moment als iets niet goed voelt: zie "Terugzetten" onderaan.

## Fase 0: voorbereiden

1. Installeer de testversie en herstart de app niet tussentijds.
2. Noteer de huidige stand:
   - **Regelmodus** in de apparaatinstellingen (normaal: Klassiek).
   - **Stooklijn van de warmtepomp:**
     - Aurora I/II: de stooklijnkeuze (HH1–HH8, HL1–HL8, of OFF) en of
       de DIY-stooklijn aan staat.
     - Aurora III: of de klimaatcurve van zone 1 aan staat.
   - Het **setpoint** van de warmtepomp en het **kamerdoel**.
3. Controleer dat de app een binnentemperatuur krijgt: de tegel
   "Laatste Binnentemperatuur (Flow Kaart)" moet een tijd van de laatste
   minuten tonen.
4. Kopieer de inhoud van `adaptive_control_diagnostics` (instellingen,
   Diagnostiek). Dit is het nulpunt.

## Fase 1: schaduw (24–48 uur)

De app rekent het advies uit, maar niets schrijft het naar de warmtepomp.

### Instellen

1. Zet een flow die het advies uitvoert **uit** (als je die hebt).
2. Zet **Regelmodus** op **Positioneel – Vloerverwarming**.
3. Kies **Stooklijn (positionele modi)**:

   | Jouw situatie | Keuze |
   | --- | --- |
   | Aurora I/II, vaste curve (HH/HL) | App-stooklijn (overstaptabel) |
   | Aurora I/II met DIY-stooklijn aan | Stooklijn van de warmtepomp |
   | Aurora III met klimaatcurve | Stooklijn van de warmtepomp |
   | Geen idee | App-stooklijn met de startwaarden 35 / 27 |

### Aflezen (ochtend en avond)

| Wat | Waar |
| --- | --- |
| Advies | `adlar_simulated_target` |
| Setpoint van de warmtepomp | Doeltemperatuur (vloerverwarming) |
| Binnen- en buitentemperatuur | Tegels van het apparaat |
| Basis, P, I | `adaptive_control_diagnostics`, blok `control` |

### Wat je mag verwachten

- `control.basis.source` past bij je keuze: `heat_pump_curve` of
  `app_curve`. Bij Aurora III met "Stooklijn van de warmtepomp" en toch
  `app_curve`: graag melden (de schaal van de klimaatcurve is nog niet
  bevestigd).
- `integralHold` staat meestal op `flow_behind`: niemand voert het advies
  uit, dus de I-term wacht. Af en toe leeg is ook normaal: dan ligt het
  advies binnen 1 °C van het setpoint en loopt de I-term gewoon door.
- Het advies ligt bij vloerverwarming tussen 20 en 37 °C. Is het huis nu
  te warm of te koud, dan kan het advies tot ongeveer 10 °C van het
  huidige setpoint afwijken: de app wil het verschil wegwerken.

### Melden als

- `control.basis.source` op `flat` staat.
- Het advies tussen twee cycli (5 minuten) meer dan 5 °C springt zonder
  dat binnen- of buitentemperatuur veranderde.
- Het advies wekenlang tegen een grens aan ligt: de ondergrens
  (vloerverwarming 20 °C) of de maximale watertemperatuur (standaard
  60 °C), terwijl het huis op temperatuur is.

## Fase 2: gesloten lus (1–2 weken)

### Voorwaarde per warmtepomp

- **Aurora I/II:** de warmtepomp houdt een geschreven setpoint alleen vast
  als de **stooklijnkeuze op OFF** staat. Noteer eerst je curve en vul de
  waarden uit de overstaptabel in bij de app-stooklijn (als je die nog
  niet gebruikte). De DIY-schakelaar mag aan blijven.
- **Aurora III:** schrijf één keer een setpoint en kijk na 2 minuten of
  het blijft staan. Springt het terug, zet dan de klimaatcurve van zone 1
  uit en meld dit.

### Flow die het advies uitvoert

- **Als:** "Adaptieve regeling beveelt temperatuur aanpassing aan"
- **Dan, Aurora I/II:** "Setpoint temperatuur instellen (per modus)" met
  temperatuur = token `recommended_temperature`, doel = Auto (volg
  huidige modus).
- **Dan, Aurora III:** "Doel (setpoint) temperatuur instellen" met
  temperatuur = token `recommended_temperature`.

### Aflezen (dagelijks)

| Wat | Doel |
| --- | --- |
| Binnentemperatuur (laagste, hoogste) | Meestal binnen ±0,5 °C van het doel |
| Setpoint (laagste, hoogste) | Rustig, stappen van 1–2 °C |
| `control.i` | Loopt langzaam op of af en blijft daarna rond één waarde |
| Compressorstarts (als zichtbaar) | Niet duidelijk meer dan in Klassiek |

`integralHold` staat nu meestal op `null` of `small_error`. Een tijdelijke
`flow_behind` na een handmatige wijziging is normaal. Coast staat bij
Vloerverwarming uit (sinds 3.5.2), dus `coast` hoort hier niet te staan.

### Stoppen, terugzetten of bijstellen als

- Het meer dan 6 uur meer dan 1 °C te koud is.
- Het meer dan 6 uur meer dan 1 °C te warm is.
- `control.i` dagenlang op −6 of +6 staat: de I-term kan niet verder
  corrigeren. Zet de app-stooklijn 2–3 °C lager (bij −6) of hoger (bij +6).
- Het setpoint langer dan een dag tegen een grens aan ligt.
- De compressor duidelijk vaker start dan in Klassiek. Meestal staat de
  app-stooklijn dan te hoog: zet beide waarden 2–3 °C lager.

## Terugzetten

1. Zet **Regelmodus** op **Klassiek**. De klassieke regeling begint
   schoon; de positionele integraal blijft bewaard voor een volgende keer.
2. **Aurora I/II:** zet de stooklijnkeuze terug op je oude curve, of laat
   hem op OFF als je de klassieke adaptieve regeling met een flow
   gebruikt.
3. Zet de flow die het advies uitvoert uit als je terug wilt naar de
   eigen stooklijn van de warmtepomp.

## Wat je meestuurt bij een melding

- De inhoud van `adaptive_control_diagnostics` op dat moment.
- De tijd en wat je zag (binnentemperatuur, setpoint, advies).
- Welke fase en welke keuzes uit "Instellen".
