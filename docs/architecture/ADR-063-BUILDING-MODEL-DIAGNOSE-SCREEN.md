# ADR-063: Diagnosescherm Gebouwmodel (Aurora II-dashboard)

**Status:** Voorgesteld
**Datum:** 2026-10-24
**Beslissers:** -
**Gerelateerd:** [ADR-062](ADR-062-BUILDING-MODEL-REVIEW-IMPLEMENTATION.md) (learner-fixes,
rate-limiting); [BUILDING_MODEL_REVIEW.md](BUILDING_MODEL_REVIEW.md) §1.2 (sample-gating);
de hardwaretest van 3.3.1, punten a2-9a t/m a2-9d

---

## Samenvatting voor de eigenaar

- **Probleem:** bij een hybride installatie stookt de CV-ketel bij koud weer bij, en kan
  de warmtepomp in een combimodus tussendoor tapwater maken. In beide gevallen klopt de
  warmte die het gebouwmodel "ziet" niet met de warmte die het huis in gaat. Het model
  leert dan een te laag warmteverlies, juist bij kou.
- **Aurora II levert mogelijk de signalen al:** een relais dat de CV-ketel aanstuurt, een
  sensor voor de totale wateruitgang en twee relais rond het tapwatercircuit. Of die
  signalen bij een echte installatie doen wat hun naam zegt, is niet geverifieerd.
- **Besluit (deel 1):** een alleen-lezen diagnosescherm **Gebouwmodel** in het Aurora
  II-dashboard (`/diagnose`), met een overgangslog in de app. Het scherm verandert
  niets aan de regeling of het leren.
- **Open besluit (deel 2):** hoe het gebouwmodel met bijstook en tapwater omgaat:
  overslaan (een poort, zoals bij ontdooien) of meetellen (de ketelwarmte optellen).
  Pas te nemen ná de waarnemingen met het scherm.
- **Versie:** niet in 3.3.1. Een eigen branch, uit te brengen met of na 3.4.0.

---

## 1. Context

### 1.1 Waarom het gebouwmodel dit moet weten

Het gebouwmodel leert uit "zoveel warmte ging het huis in, zoveel veranderde de
binnentemperatuur". De warmte is de thermische afgifte van de warmtepomp (elektrisch
vermogen × COP). Momenten waarop die afgifte niet het huis in gaat, of waarop er warmte
bij komt die de app niet meet, worden daarom overgeslagen:

| Moment | Aurora II nu |
|---|---|
| Ontdooien | Overgeslagen (status 0x0000 bit 8) |
| Koelen, alleen tapwater, koelen + tapwater (modus 0, 2, 4) | Overgeslagen (moduspoort, 0x0304) |
| Elektrische bijverwarming bij stilstaande compressor (> 300 W) | Overgeslagen (sinds 2.15.3) |
| **Tapwater tijdens een combimodus (5, 7)** | **Telt mee**: 0x0304 is de ingestelde modus, niet de actuele werking |
| **CV-ketel stookt bij (hulpwarmtebron, AHS)** | **Telt mee**: de ketelwarmte wordt niet gemeten |

De simulatie bij ADR-062 (`adr062.js`, B2) laat zien dat het effect vooral afhangt van
de rate-limiting. Bij koud weer, woning S1b, met herstart bij elk ontbrekend sample:
met de uniforme rate-limiting die ADR-062 aanhoudt, was de voorspelfout 0,06 °C bij de
poorten van Aurora II tegenover 0,05 °C bij die van Aurora III. Met rate-limiting per
component was dat 0,10 °C tegenover 0,01 °C; die variant staat niet in ADR-062 en is
apart doorgerekend bij de keuze voor de rate-limiting. Bijstook door een ketel is in die
simulatie niet nagebootst.

### 1.2 Wat Aurora II mogelijk levert

| Signaal | Register | Gepold | Nu gebruikt door |
|---|---|---|---|
| Relais "AHS signal output" | 0x001B bit 9 (`AHS_SIGNAL_OUTPUT`) | Medium, elke 30 s (optioneel blok) | Alleen het expert-dashboard |
| Totale wateruitgang | 0x0075 (`measure_temperature.total_outlet`) | Medium, elke 30 s (optioneel blok) | Capability |
| Relais driewegklep ruimtezijde | 0x0019 bit 14 (`AC_SOLENOID_3WAY`) | Medium | Alleen het expert-dashboard |
| Relais pomp tapwater-warmtebron | 0x001B bit 7 (`HW_HEAT_SOURCE_PUMP`) | Medium | Alleen het expert-dashboard |
| Water in/uit (T6/T7), debiet | 0x004F, 0x0050, 0x0058 | Superfast, elke 5 s | COP, gebouwmodel |
| Starttemperatuur bijverwarming | P22 (0x0116), −15 tot 40 °C | Niet | — |
| Bijverwarming = externe bron | P139/P140 (0x018B/0x018C), waarde 2 = AHS | Niet | — |

### 1.3 Wat we niet weten

1. Of `AHS_SIGNAL_OUTPUT` aan staat zolang de CV-ketel bijstookt, en alleen dan.
2. Of de sensor van de totale wateruitgang achter de ketel zit. Dan geldt
   `P_ketel ≈ debiet × c × (T_totaal − T7)`.
3. Of een van de twee tapwaterrelais omschakelt tijdens een tapwatercyclus in modus 5/7.
4. Of een medium-poll van 30 seconden genoeg is voor korte ketelcycli.

### 1.4 Waarom de bestaande register-changelog niet volstaat

De changelog van het dashboard bewaart per register de laatste en de vorige waarde, met
hun tijdstip, plus de duur van de laatste 50 intervallen. Een volledige geschiedenis
("wanneer stond bit 9 aan, en wat waren T7 en de totale uitgang op dat moment") staat er
niet in. Bovendien is het relaisregister één 16-bitswaarde: een wijziging van een
willekeurig ander bit telt ook als wijziging.

## 2. Besluit: het diagnosescherm (deel 1)

### D1 — Een alleen-lezen pagina `/diagnose`

Een nieuwe pagina `public/dashboard-diagnose.html`, bereikbaar via `/diagnose`, naast de
bestaande pagina's (live, expert, changelog, heating-curve). Vijf blokken:

| Blok | Inhoud | Bron |
|---|---|---|
| **Bijstook (CV-ketel)** | Lampje relais 0x001B bit 9; T7, totale uitgang, verschil, debiet; berekende ketelwarmte in kW (gemarkeerd als schatting) | `/api/register-cache` |
| **Tapwater** | Lampjes 0x0019 bit 14 en 0x001B bit 7; ingestelde modus | `/api/register-cache`, `/api/capabilities` |
| **Adaptieve regeling** | Modus → actief setpoint (0x0301, 0x0303 of "pauze"), met de waarde | `/api/capabilities` |
| **Gebouwmodel** | Blokkeerreden zoals in **Isolatie Prestatie**; compressor; ontdooien | `/api/capabilities` |
| **Overgangslog** | De laatste overgangen van de bewaakte signalen (D2) | `/api/diagnose-events` (nieuw) |

- Alleen lezen: het scherm schrijft geen registers en geen instellingen.
- Ontbreekt het optionele registerblok of de sensor, dan toont het blok "niet
  beschikbaar" in plaats van een waarde.
- Verversing elke 5 seconden; de relaiswaarden veranderen maximaal elke 30 seconden.

### D2 — Een overgangslog in de app

Een kleine `DiagnoseEventRecorder` in `lib/modbus/services/`, gevoed door de coördinator
bij elke binnenkomende snapshot.

- **Bewaakte signalen:** 0x001B bit 9, 0x0019 bit 14, 0x001B bit 7, de ingestelde modus,
  ontdooien en de compressorstatus. Per signaal het afzonderlijke bit, niet het hele
  register.
- **Per overgang:** tijdstip, signaal, oud → nieuw, en op dat moment T6, T7, totale
  uitgang en debiet.
- **Opslag:** in het geheugen, de laatste 200 overgangen. Niet persistent; na een
  herstart van de app begint het log leeg. Daarmee blijft het klein en raakt het de
  device store niet.
- **Route:** `GET /api/diagnose-events` geeft het log als JSON.

Waarom in de app en niet alleen in de browser: bijstook gebeurt vooral als niemand
kijkt, bijvoorbeeld 's nachts bij vorst. Een log in de browser werkt alleen zolang de
pagina openstaat.

### D3 — Berekende ketelwarmte

`P_ketel = (debiet / 60) × 4,186 × (T_totaal − T7)` in kW (debiet in L/min).

- Alleen getoond als de totale uitgang beschikbaar is en het relais aan staat.
- Met de vermelding "schatting; klopt alleen als de sensor achter de ketel zit".
- Dit is een weergave. Het gebouwmodel gebruikt deze waarde in deel 1 niet.

### D4 — Taal

De bestaande dashboardpagina's zijn alleen in het Nederlands. De projectregel is dat
teksten voor gebruikers gelokaliseerd zijn. **Voorstel:** de nieuwe pagina krijgt een
kleine teksttabel voor Nederlands en Engels, gekozen op basis van de browsertaal. Het
lokaliseren van de andere dashboardpagina's valt buiten dit ADR.

### D5 — Reikwijdte en versie

- **Alleen Aurora II.** Aurora III heeft een eigen dashboard (poort 8091) en andere
  signalen (`adlar_dhw_active` bestaat al; een AHS-signaal is niet onderzocht). Tuya
  heeft geen dashboard.
- **Niet in 3.3.1**, dat bij de hardwaretest ligt. Een eigen branch, lokaal te
  installeren met `homey app install`; uit te brengen met of na 3.4.0.

## 3. Open besluit: het gebouwmodel en ongemeten warmte (deel 2)

Te nemen na de waarnemingen met het scherm (hardwaretest a2-9a t/m a2-9d).

### O1 — Bijstook door de CV-ketel

| Optie | Wat | Voorwaarde | Gevolg |
|---|---|---|---|
| **Overslaan** | Een AHS-poort: zolang 0x001B bit 9 aan staat, leert het model niet ("Geblokkeerd: Bijverwarming actief") | Het relais volgt de ketel betrouwbaar | Eenvoudig en veilig; bij strenge kou minder leermomenten |
| **Meetellen** | Thermische warmte = warmtepomp + `P_ketel` uit D3 | Het relais én de sensor achter de ketel | Ook koude momenten blijven bruikbaar; past bij "bij kou preciezer" (ADR-062) |
| **Niets doen** | Zoals nu | — | De vertekening bij kou blijft |

Het venster van ADR-062 B2 herstart bij elk overgeslagen sample. Bij "overslaan" werkt
dat automatisch via `interruptWindow()`.

### O2 — Tapwater in een combimodus

| Optie | Voorwaarde |
|---|---|
| Een tapwaterpoort op 0x0019 bit 14 of 0x001B bit 7, zoals `adlar_dhw_active` bij Aurora III | Een van de relais schakelt betrouwbaar om tijdens een tapwatercyclus |
| Niets doen | Bij installaties waar de CV-ketel het tapwater maakt, speelt dit niet |

### O3 — Gevolg voor de rate-limiting van ADR-062

ADR-062 houdt de uniforme rate-limiting aan, omdat die de vervuiling door niet-herkend
tapwater dempt. Krijgt Aurora II een tapwater- én een bijstookpoort (O1 en O2), dan is
haar data even schoon als die van Aurora III, en kan de keuze voor Aurora II opnieuw
worden bekeken.

## 4. Fasering

| Fase | Inhoud | Bewijs |
|---|---|---|
| **1** | `DiagnoseEventRecorder`, route `/api/diagnose-events`, pagina `/diagnose` | Unit-tests recorder; HTTP-contracttest route; `homey app validate` |
| **2** | Waarnemingen op de eigen installatie met het scherm (a2-9a t/m a2-9d) | Notities op de hardwaretestpagina, het overgangslog |
| **3** | Besluit O1, O2 en O3, als aanvulling op dit ADR | Simulatie met nagebootste bijstook; de waarnemingen |

## 5. Testaanpak (fase 1)

- **Recorder:** een overgang van elk bewaakt bit wordt vastgelegd met de juiste
  temperaturen; een wijziging van een ander bit in hetzelfde register niet; het log
  houdt maximaal 200 regels; zonder het optionele blok geen fouten.
- **Route:** `/api/diagnose-events` geeft JSON met de afgesproken velden; `/diagnose`
  serveert de pagina; de bestaande routes blijven ongewijzigd (de HTTP-contracttest uit
  ADR-005 fase 1, voor zover aanwezig).
- **Pagina:** handmatig op de eigen installatie, ook met een ontbrekende sensor.

## 6. Consequenties

### Voor gebruikers

- Aurora II-gebruikers krijgen een extra dashboardpagina. Er verandert niets aan de
  regeling, het leren of de instellingen.
- Gebruikers met een hybride installatie kunnen zien wanneer de CV-ketel bijstookt en
  hoeveel warmte die ongeveer levert.

### Voor onderhoud

- Eén nieuwe service, één route en één pagina, alleen bij Aurora II.
- Het overgangslog is ook bruikbaar voor ander diagnosewerk aan de regeling.

## 7. Niet doen

- Geen schrijfacties vanaf het diagnosescherm.
- Geen nieuwe capabilities in deel 1.
- Geen wijziging aan het gebouwmodel in deel 1; dat is deel 2.
- Het overgangslog niet persistent maken; een herstart mag het wissen.

## 8. Te verifiëren

1. **V1** — Volgt 0x001B bit 9 de CV-ketel (a2-9a)?
2. **V2** — Zit de sensor van de totale wateruitgang achter de ketel (a2-9b, a2-9c)?
3. **V3** — Schakelt een tapwaterrelais om in modus 5/7 (a2-9d)?
4. **V4** — Is een poll van 30 seconden genoeg voor de kortste ketelcycli?
5. **V5** — Heeft Aurora III een vergelijkbaar AHS-signaal?
