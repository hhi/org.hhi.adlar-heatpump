# Adlar Warmtepomp App - Configuratiegids

Deze gids beschrijft alle configureerbare instellingen van de Adlar Warmtepomp Homey app. Elke instelling wordt uitgelegd met praktische voorbeelden en aanbevelingen.

---

## 🔗 Instellingen Groepen & Afhankelijkheden

| # | Groep | Vereist | Optioneel |
|---|-------|---------|-----------|
| 1 | **Verbindingsinstellingen** | - | - |
| 2 | **COP Instellingen** | - | Vermogensmeting (voor nauwkeurigheid) |
| 3 | **Functie Instellingen** | App herstart | - |
| 4 | **Flow Kaart Afhandeling** | App herstart | - |
| 5 | **Adaptieve Temperatuur Regeling** | Externe temp sensor | - |
| 6 | **Gebouwmodel Leren** | - | - |
| 7 | **Gebouw Inzichten** | Gebouwmodel Leren AAN | Min. betrouwbaarheid |
| 8 | **Energieprijs Optimalisatie** | Adaptive Control AAN, Internet | Dynamisch tarief |
| 9 | **COP Optimalisatie** | COP Berekening AAN, Adaptive Control | 1+ week data |
| 10 | **Wegingsfactoren** | Adaptive Control AAN | - |
| 11 | **Diagnostiek** | - | - |
| 12 | **Energie Beheer** | - | Vermogensmeting |

```
┌──────────────────┐
│ 1. Verbinding    │  Basis - altijd nodig
└────────┬─────────┘
         │
         ▼
┌──────────────────┐     ┌──────────────────┐
│ 2. COP Settings  │────▶│ 9. COP Optimizer │
└──────────────────┘     └──────────────────┘
         │                        ▲
         │                        │
         ▼                        │
┌──────────────────┐              │
│ 5. Adaptive Temp │──────────────┤
│    Control       │              │
└────────┬─────────┘              │
         │                        │
    ┌────┴────┬───────────────────┤
    ▼         ▼                   │
┌────────┐ ┌────────────────┐     │
│ 10.    │ │ 8. Price       │─────┘
│Weights │ │    Optimizer   │
└────────┘ └────────────────┘

┌──────────────────┐     ┌──────────────────┐
│ 6. Building      │────▶│ 7. Building      │
│    Model         │     │    Insights      │
└──────────────────┘     └──────────────────┘
```

---

## 📖 Inhoudsopgave

1. [Verbindingsinstellingen](#1-verbindingsinstellingen)
2. [COP (Prestatiecoëfficiënt) Instellingen](#2-cop-prestatiecoëfficiënt-instellingen)
3. [Functie Instellingen](#3-functie-instellingen)
4. [Flow Kaart Afhandeling](#4-flow-kaart-afhandeling)
5. [Adaptieve Temperatuur Regeling](#5-adaptieve-temperatuur-regeling)
6. [Gebouwmodel Leren](#6-gebouwmodel-leren)
7. [Gebouw Inzichten & Aanbevelingen](#7-gebouw-inzichten--aanbevelingen)
8. [Energieprijs Optimalisatie](#8-energieprijs-optimalisatie)
9. [COP Optimalisatie](#9-cop-optimalisatie)
10. [Adaptieve Regeling Wegingsfactoren](#10-adaptieve-regeling-wegingsfactoren)
11. [Diagnostiek](#11-diagnostiek)
12. [Energie Beheer](#12-energie-beheer)

---

## 1. Verbindingsinstellingen

Deze instellingen zijn nodig om verbinding te maken met je Adlar warmtepomp via het lokale Tuya protocol.

### Device ID (Apparaat ID)
- **Functie**: Unieke identificatie van je warmtepomp
- **Formaat**: Alfanumerieke code (bijv. `bf1234567890abcdef`)
- **Hoe verkrijgen**: Via Tuya IoT Platform of tijdens pairing proces
- **Let op**: Wijzigen triggert automatisch een herverbinding

### Local Key (Lokale Sleutel)
- **Functie**: Beveiligingssleutel voor versleutelde communicatie
- **Formaat**: Hexadecimale string (bijv. `a1b2c3d4e5f6g7h8`)
- **Hoe verkrijgen**: Via Tuya IoT Platform of tijdens pairing proces
- **Beveiliging**: Wordt versleuteld opgeslagen in Homey

### IP Address (IP-adres)
- **Functie**: Lokaal netwerkadres van je warmtepomp
- **Waarde**: IPv4 formaat (bijv. `192.168.1.100`)
- **Aanbeveling**: Stel een vast IP-adres in via je router (DHCP reservering)
- **Waarom vast IP**: Voorkomt verbindingsproblemen na router herstart

### Protocol Version (Protocolversie)
- **Functie**: Tuya communicatie protocol versie
- **Opties**:
  - **3.3** (standaard) - Meest gangbaar voor oudere apparaten
  - **3.4** - Nieuwere apparaten vanaf 2020
  - **3.5** - Nieuwste protocol met verbeterde beveiliging
- **Hoe kiezen**: Controleer in Tuya IoT Platform of gebruik 3.3 als default
- **Automatische herverbinding**: Apparaat maakt automatisch opnieuw verbinding na wijziging

---

## 2. COP (Prestatiecoëfficiënt) Instellingen

COP (Coefficient of Performance) meet de efficiëntie van je warmtepomp: hoeveel warmte (kW) je krijgt per verbruikte elektriciteit (kW). Bijvoorbeeld: COP 4.0 betekent 4 kW warmte uit 1 kW elektriciteit.

### COP Berekening Inschakelen
- **Standaard**: Ingeschakeld
- **Functie**: Berekent automatisch de efficiëntie van je warmtepomp
- **Waarom nuttig**:
  - Inzicht in prestaties
  - Vroeg detecteren van problemen (COP < 2.0 kan op storing wijzen)
  - Basis voor optimalisatie algoritmes
- **Aanbeveling**: Altijd ingeschakeld laten

### COP Berekenings Methode
De app ondersteunt 6 verschillende berekeningsmethoden met verschillende nauwkeurigheid:

| Methode | Nauwkeurigheid | Vereiste Sensoren | Wanneer Gebruiken |
|---------|---------------|-------------------|-------------------|
| **Auto** (aanbevolen) | Beste beschikbaar | Automatisch | Standaard - kiest beste methode |
| Direct thermisch | ±5% | Thermische vermogen sensor | Meest accuraat, indien beschikbaar |
| Vermogen module | ±8% | Externe vermogensmeter | Met slimme stekker of kWh-meter |
| Koelmiddel circuit | ±12% | Temperatuur + druk sensoren | Standaard interne sensoren |
| Carnot schatting | ±15% | In/uit temperaturen | Theoretische benadering |
| Klep correlatie | ±20% | Klep posities | Op basis van systeemgedrag |
| Temperatuur verschil | ±30% | Alleen temperaturen | Minst accuraat, basis schatting |

### COP Outlier Detectie
- **Standaard**: Ingeschakeld
- **Functie**: Detecteert onrealistische COP waarden die wijzen op:
  - Sensor storingen
  - Verkeerde metingen
  - Tijdelijke systeem afwijkingen
- **Waarom belangrijk**: Voorkomt dat foutieve data je gemiddeldes en optimalisaties verstoort

### Minimale Geldige COP
- **Standaard**: 0.5
- **Bereik**: 0.1 - 2.0
- **Functie**: Waarden onder deze drempel worden als outlier gemarkeerd

### Maximale Geldige COP
- **Standaard**: 8.0
- **Bereik**: 4.0 - 15.0
- **Functie**: Waarden boven deze drempel worden als outlier gemarkeerd

---

## 3. Functie Instellingen

Deze instellingen bepalen welke functies zichtbaar zijn in de Homey app interface. **Let op: Wijzigingen vereisen app herstart en afsluiten.**

### Curve Instelbediening Tonen
- **Standaard**: Uitgeschakeld
- **Functie**: Toont/verbergt instelknoppen voor verwarmings- en warmwatercurves
- **Flow kaarten**: Werken altijd, ongeacht deze instelling

### Interne Vermogingsmeting Capabilities
- **Standaard**: Uitgeschakeld
- **Functie**: Toont/verbergt 9 DPS vermogingsmetingen (stroomverbruik, spanning, stroomsterkte)
- **Wanneer inschakelen**: Je warmtepomp heeft ingebouwde vermogensmeting

### Slider Management Capabilities
- **Standaard**: Uitgeschakeld
- **Functie**: Toont/verbergt 3 schuifbalken (warmwater temperatuur, water modus, volume)

### Intelligente Energie Tracking
- **Standaard**: Ingeschakeld
- **Functie**: Slimme selectie van vermogensmeting bron
- **Hoe het werkt**:
  1. **Prioriteit 1**: Externe vermogensmeting (via flow kaart)
  2. **Prioriteit 2**: Interne sensoren (indien beschikbaar)
- **Homey Energy Dashboard**: Apparaat verschijnt automatisch met accurate data

---

## 4. Flow Kaart Afhandeling

Bepaalt welke flow kaarten zichtbaar zijn in de Homey Flow editor. **Herstart aanbevolen na wijzigingen.**

### Algemene Opties (voor alle categorieën):
- **Disabled (Uitgeschakeld)**: Flow kaarten altijd verborgen
- **Auto** (aanbevolen): Toon alleen als relevante sensoren beschikbaar zijn
- **Force enabled (Geforceerd)**: Altijd tonen, ook zonder sensoren

### Beschikbare Categorieën:
| Categorie | Standaard | Beschrijving |
|-----------|-----------|--------------|
| Temperatuur gerelateerde alarmen | Auto | Triggers voor temperatuur drempels |
| Spanning gerelateerde alarmen | Auto | Triggers voor spanningsafwijkingen |
| Stroom gerelateerde alarmen | Auto | Triggers voor stroomafwijkingen |
| Vermogen gerelateerde alarmen | Auto | Triggers voor vermogensafwijkingen |
| Pulse-stappen gerelateerde alarmen | Auto | Triggers voor klep/compressor posities |
| Status wijziging alarmen | Auto | Triggers voor operationele status wijzigingen |
| Efficiëntie (S)COP alarmen | Auto | Triggers voor COP en SCOP efficiency |

### Expert HVAC Functie Kaarten
- **Standaard**: Ingeschakeld
- **Functie**: Geavanceerde diagnose triggers (compressor, fan motor, water flow)
- **Doelgroep**: HVAC professionals, geavanceerde gebruikers

### Dagelijkse Disconnect Telling
- **Standaard**: Uitgeschakeld
- **Functie**: Telt aantal keer dat verbinding verbroken werd
- **Capability**: Bij inschakelen wordt de `adlar_daily_disconnect_count` sensor toegevoegd aan je apparaat
- **Persistentie**: Instelling blijft behouden na app updates en Homey herstarts
- **Normale waarde**: 0-2 per dag
- **Problematisch**: > 5 per dag → WiFi signaal verbeteren of vaste IP instellen

---

## 5. Adaptieve Temperatuur Regeling

Automatische regeling van de doeltemperatuur op basis van externe binnentemperatuur sensor.

### Adaptieve Temperatuurregeling Inschakelen
- **Standaard**: Uitgeschakeld
- **Functie**: PI (Proportioneel-Integraal) regelaar voor stabiele binnentemperatuur
- **Vereisten**:
  - Externe temperatuur sensor (via flow kaart)
  - Target temperatuur ingesteld
  - Flow "Stuur binnentemperatuur" actief
- **Prestaties**: ±0.3°C stabiliteit (deadband instelbaar)

### PI Regelaar Parameters (Expert Instellingen)

**Alleen zichtbaar met "Expert HVAC functie kaarten" ingeschakeld**

#### Proportionele Versterking (Kp)
- **Standaard**: 5.0
- **Bereik**: 0.5 - 10.0
- **Functie**: Bepaalt hoe snel systeem reageert op huidige fout
- **Hogere waarde**: Snellere correctie, risico op overshoot
- **Lagere waarde**: Stabielere regeling, langzamere correctie

#### Integrale Versterking (Ki)
- **Standaard**: 1.5
- **Bereik**: 0.1 - 5.0
- **Functie**: Elimineert blijvende afwijkingen (steady-state error)

#### Deadband (Dode Zone)
- **Standaard**: 0.3°C
- **Bereik**: 0.1 - 1.0°C
- **Functie**: Tolerantie voordat aanpassingen worden gemaakt

#### Minimale en Maximale Watertemperatuur (v3.4.3+)

- **Minimum — standaard**: 18°C, **bereik**: 15 - 30°C
- **Maximum — standaard**: 60°C (Tuya: 65°C), **bereik**: 25 - 60°C (Tuya: 25 -
  65°C)
- **Functie**: Laagste en hoogste watertemperatuur die de adaptieve regeling kan
  aanbevelen
- **Regel**: Het maximum moet minstens 2°C boven het minimum liggen; anders
  wordt de wijziging geweigerd
- **Grenzen warmtepomp (v3.4.4+)**: Het advies blijft ook binnen de
  verwarmingsgrenzen die in de warmtepomp zijn ingesteld (Aurora I/II:
  P110/P111, Aurora III: grenzen van zone 1). De diagnostiek van de adaptieve
  regeling toont welke grens geldt
- **Vloerverwarming**: Stel beide in rond het bereik van uw eigen stooklijn
  (bijv. 2°C eronder en 3°C erboven) en laat ruimte voor koud weer

#### Regelmodus en Stooklijn (v3.5.0+)

- **Regelmodus — standaard**: Klassiek
  - **Klassiek**: elke cyclus een kleine stap omhoog of omlaag; de stappen
    tellen op (bestaand gedrag)
  - **Positioneel – Radiatoren** (experimenteel): Kp 3, Ti 3 u, coast uit
  - **Positioneel – Vloerverwarming** (experimenteel): Kp 3, Ti 6 u, coast uit
  - **Positioneel – Handmatig** (experimenteel): Positionele PI Kp en Ti en de
    schakelaar Coast hieronder
  - Positioneel: advies = stooklijn + PI-correctie met een echte integraal,
    zonder brede dode zone; het setpoint blijft rustig, ook met een flow die elk
    advies uitvoert
- **Coast**: bij Klassiek en Positioneel – Handmatig geldt de schakelaar Coast;
  Radiatoren en Vloerverwarming zetten coast uit
- **Stooklijn (positionele modi) — standaard**: App-stooklijn
  - **App-stooklijn**: watertemperatuur bij −15 °C en bij +15 °C buiten.
    Startwaarden: Radiatoren 50 / 35, Vloerverwarming 35 / 27, anders 45 / 30;
    voorgevuld bij de keuze van de regelmodus, zolang u ze niet zelf heeft
    aangepast
  - **Stooklijn van de warmtepomp** (Aurora I/II: DIY-stooklijn, alleen als
    DIY aan staat; Aurora III: klimaatcurve): alleen als u die zelf heeft
    ingesteld; staat DIY uit of is hij niet bruikbaar, dan geldt de
    app-stooklijn. Tuya heeft deze keuze niet
- **Diagnostiek**: `adaptive_control_diagnostics` toont de modus, het
  afgiftesysteem, Kp en Ti met hun bron, de basis met zijn bron en de P- en
  I-term

##### Stooklijn bijstellen

| Wat u merkt | Aanpassing |
| --- | --- |
| Te koud bij vorst, goed bij zacht weer | Waarde bij −15 °C +1–2 |
| Te koud bij zacht weer | Waarde bij +15 °C +1–2 |
| Overal iets te koud | Beide waarden +1 |
| Te warm | Omgekeerd: verlagen |

- Pas één waarde per keer aan en wacht een dag (vloerverwarming: twee dagen). In
  de diagnostiek wijst een I-term die structureel boven 0 ligt op een te lage
  stooklijn, onder 0 op een te hoge

##### Overstappen van een vaste curve

Gebruikte u een vaste curve van de warmtepomp (Aurora I/II: stooklijnkeuze
HH1–HH8 of HL1–HL8; Tuya: verwarmingscurve H1–H8 of L1–L8)? Noteer die curve,
vul de twee waarden uit de tabel in bij de app-stooklijn en zet daarna de
stooklijnkeuze op OFF. Na OFF kan de app de curve niet meer uitlezen.

| Curve | −15 °C | +15 °C | Curve | −15 °C | +15 °C |
| --- | --- | --- | --- | --- | --- |
| HH1 | 55 | 50 | HL1 | 38 | 32 |
| HH2 | 54 | 46 | HL2 | 35 | 30 |
| HH3 | 54 | 41 | HL3 | 33 | 30 |
| HH4 | 50 | 46 | HL4 | 35 | 29 |
| HH5 | 49 | 41 | HL5 | 33 | 28 |
| HH6 | 45 | 40 | HL6 | 31 | 26 |
| HH7 | 44 | 36 | HL7 | 29 | 26 |
| HH8 | 40 | 35 | HL8 | 29 | 24 |

- Overgenomen uit de grafieken in de handleiding van de warmtepomp en afgerond
  op hele graden; afwijking ongeveer 1 °C

**Welke regelmodus kies ik?**

| Situatie | Keuze |
| --- | --- |
| Geen flow die het advies uitvoert | Maakt niet uit: alleen advies |
| De huidige regeling werkt goed | Klassiek |
| Setpoint kruipt weg of slingert, radiatoren | Positioneel – Radiatoren |
| Setpoint kruipt weg, vloerverwarming | Positioneel – Vloerverwarming |
| Stooklijn onbekend | Startwaarden, daarna bijstellen |

- **Aurora I/II en Tuya**: de warmtepomp houdt een nieuw setpoint alleen vast
  als de stooklijnkeuze (Tuya: verwarmingscurve) op OFF staat; anders voert geen
  van beide modi het advies uit. De app rekent de stooklijn dan zelf uit
- **Stooklijn van de warmtepomp** alleen bij een eigen DIY-stooklijn: staat DIY
  uit, dan rekent de app met de app-stooklijn. Een vaste curve neemt u over met
  de tabel hierboven
- **Veilig proberen**: zet de flow die het advies uitvoert uit, kies een
  positionele regelmodus en vergelijk een dag het gesimuleerde doel
  (`adlar_simulated_target`) met de stooklijn
- **Terugzetten** kan altijd; de integraal en de opgetelde correctie beginnen
  dan op 0
- **Nachtverlaging en thermostaatprogramma**: een warmtepomp heeft uren nodig om
  de woning weer op te warmen, in elke regelmodus. Laat het programma bij
  radiatoren 2–4 uur vóór het gewenste moment omhooggaan. Houd het bij
  vloerverwarming constant of verlaag hooguit 1 °C; Positioneel warmt anders in
  de ochtend op, met meer compressorstarts
- **Optimizers** (prijs, COP): verschuiven in Positioneel het kamerdoel, met
  hooguit 1,5 °C; de stooklijn schuift mee. Met de COP-optimalisatie aan kan het
  huis gemiddeld iets onder het kamerdoel blijven. De thermische component van
  het gebouwmodel doet in Positioneel niet mee
- **Experimenteel**: Positioneel is nog weinig in de praktijk getest

#### Coast Offset (v2.8.0+)
- **Standaard**: 1.0°C
- **Bereik**: 0.5 - 5.0°C
- **Functie**: Graden onder uitlaattemperatuur voor coast-doelwaarde
- **Lager**: Eerder stoppen van compressor, minder verwarming
- **Hoger**: Voorzichtiger coast, meer marge

#### Coast Hysterese (v2.8.0+)
- **Standaard**: 0.3°C
- **Bereik**: 0.1 - 1.0°C
- **Functie**: Overshoot-marge boven setpoint voor activatie coast-modus

#### Coast Sterkte (v2.8.0+)
- **Standaard**: 0.80
- **Bereik**: 0.60 - 0.95
- **Functie**: Gewichtsaandeel van coast in gewogen beslissing (dominant bij activatie)

---

## 6. Gebouwmodel Leren

Machine learning algoritme dat de thermische eigenschappen van je woning leert.

### Gebouwmodel Leren Inschakelen
- **Standaard**: Uitgeschakeld
- **Functie**: Leert 4 thermische parameters (C, UA, g, P_int)
- **Leertijd**: 24-72 uur voor basismodel, 2-4 weken voor nauwkeurig model
- **Algoritme**: Recursive Least Squares (RLS) met forgetting factor

### Vergeetfactor (Expert Instelling)
- **Standaard**: 0.999
- **Bereik**: 0.9985 - 0.9995
- **Functie**: Hoe snel model zich aanpast aan veranderingen. Hoger = stabieler, betere betrouwbaarheid (~75%). Lager = snellere aanpassing aan seizoensveranderingen.
- **Werking**: Werkt direct (v3.5.0+)

### Gebouwtype
- **Standaard**: Gemiddeld (typisch NL huis)
- **Opties**:
  - **Licht**: Hout/prefab, basis isolatie, snelle temp wisselingen
  - **Gemiddeld**: Baksteen, spouwmuur, dubbel glas (typisch NL huis)
  - **Zwaar**: Beton/steen, goede isolatie, HR++ glas, stabiel
  - **Passief**: Passiefhuis, HR+++ glas, luchtdicht, WTW
- **Wijzigen**: Werkt direct; het leren gaat verder vanaf de waarden van het nieuwe profiel, met de helft van de verzamelde samples

### Reset Gebouwmodel Leren
- **Standaard**: Uitgeschakeld
- **Type**: Eenmalige actie (checkbox)
- **Functie**: Reset alle geleerde gebouwparameters (C, UA, τ, g, P_int) en start opnieuw met het geselecteerde gebouwprofiel
- **Automatische reset**: Schakelt automatisch uit na reset
- **Wanneer gebruiken**: Diagnostics tonen corrupte state (negatieve waarden, 0% confidence met veel samples)

### Dynamische Interne Warmtewinsten
- **Standaard**: Ingeschakeld
- **Functie**: Houdt rekening met variërende warmte van mensen/apparaten per tijdstip
- **Dag Patroon** (tijden in de tijdzone van de Homey, v3.5.0+):
  - Nacht (23:00-06:00): 40% (slapen)
  - Dag (06:00-18:00): 100% (normaal)
  - Avond (18:00-23:00): 180% (koken, TV)
- **Nauwkeurigheid verbetering**: ~10-15%
- **Werking**: Werkt direct (v3.5.0+); het leren gaat verder vanaf de waarden van
  het gebouwprofiel, met de helft van de verzamelde samples

---

## 7. Gebouw Inzichten & Aanbevelingen

Geautomatiseerde analyse van het thermische gebouwmodel met energie-besparende aanbevelingen en ROI-schattingen.

### Gebouw Inzichten Inschakelen
- **Standaard**: Uitgeschakeld
- **Functie**: Analyseer thermisch gebouwmodel en geef energie-besparende aanbevelingen
- **Leertijd**: Inzichten verschijnen na ongeveer 1–2 dagen leren
- **Vereisten**: Gebouwmodel leren moet ingeschakeld zijn

### Minimale Betrouwbaarheid
- **Standaard**: 70%
- **Bereik**: 50% - 90%
- **Functie**: Toon alleen inzichten wanneer gebouwmodel betrouwbaarheid deze drempel overschrijdt
- **70%**: ongeveer 1–2 dagen leren
- **Lagere waarden**: Eerdere inzichten, minder nauwkeurigheid

---

## 8. Energieprijs Optimalisatie

Automatische optimalisatie op basis van day-ahead energieprijzen (dynamisch contract vereist).

### Prijsoptimalisatie Inschakelen
- **Standaard**: Uitgeschakeld
- **Functie**: Benut lage prijzen, vermijd hoge prijzen
- **Data bron**: EnergyZero API (gratis, geen account nodig)

### Prijsberekening Modus
- **Standaard**: All-in prijs (complete kosten)
- **Opties**:
  - **Marktprijs**: Spotprijs + BTW
  - **Marktprijs+**: Spotprijs + leveranciersopslag + BTW
  - **All-in prijs**: Complete kosten inclusief energiebelasting

### Leveranciersopslag (€/kWh incl. BTW)
- **Standaard**: €0.0182/kWh
- **Bereik**: €0 - €0.50/kWh
- **Functie**: Jouw leveranciersopslag per kWh, inclusief BTW
- **Tip**: Controleer uw energiecontract voor deze waarde

### Energiebelasting (€/kWh incl. BTW)
- **Standaard**: €0.11085/kWh
- **Bereik**: €0 - €0.50/kWh
- **Functie**: Energiebelasting per kWh, inclusief BTW
- **Nederland 2024**: ~€0.11085

### BTW-percentage
- **Standaard**: 21%
- **Bereik**: 0 - 30%
- **Functie**: BTW-percentage toegepast op marktprijs
- **Nederland**: 21% (standaard), 9% (verlaagd tarief)

### Prijsdrempels

De drempels zijn gebaseerd op percentielen van 2024 spotprijzen:

| Drempel | Standaard | Percentiel | Actie |
|---------|-----------|------------|-------|
| Zeer Laag | €0.04/kWh | P10 | Maximum voorverwarmen (+1.5°C) |
| Laag | €0.06/kWh | P30 | Matig voorverwarmen (+0.75°C) |
| Normaal | €0.10/kWh | P70 | Handhaven (0°C aanpassing) |
| Hoog | €0.12/kWh | P90 | Lichte verlaging (-0.5°C) |

> [!NOTE]
> Prijzen boven de "Hoge" drempel triggeren "Zeer hoog" actie met -1.0°C reductie.

### Maximum Voorverwarm Offset
- **Standaard**: 1.5°C
- **Bereik**: 0.0 - 3.0°C
- **Functie**: Beperkt hoeveel warmer dan gewenst tijdens zeer lage prijs periodes

### Dagelijkse Kosten Waarschuwings Drempel
- **Standaard**: €10/dag
- **Bereik**: €1 - €50/dag
- **Functie**: Trigger flow kaart bij overschrijding

### Prijsblok Grootte
- **Standaard**: 4 uren
- **Bereik**: 1 - 12 uren
- **Functie**: Grootte van goedkoopste/duurste blokken voor dag-vooruit planning
- **Gebruikt door**: 'Goedkoopste blok gestart' trigger en blok detectie

### Duur Blok Waarschuwingstijd
- **Standaard**: 2 uren
- **Bereik**: 1 - 4 uren
- **Functie**: Trigger 'dure periode nadert' flow N uur voor duur blok begint
- **Gebruik**: Om gebouw voor te verwarmen

### Prijstrend Analyse Venster
- **Standaard**: 6 uren
- **Bereik**: 3 - 24 uren
- **Functie**: Aantal toekomstige uren om te analyseren voor prijstrend detectie (stijgend/dalend/stabiel)
- **Gebruikt door**: 'Prijstrend veranderd' trigger

---

## 9. COP Optimalisatie

Automatische optimalisatie van aanvoertemperatuur voor maximale efficiency.

### COP Optimalisatie Inschakelen
- **Standaard**: Uitgeschakeld
- **Functie**: Leert optimale aanvoertemperatuur per buitentemperatuur
- **Vereisten**:
  - COP berekening actief
  - Minimaal 1 week data
  - Adaptive control ingeschakeld
- **Leertijd**: 2-4 weken voor betrouwbare optimalisatie

### Minimaal Acceptabele COP
- **Standaard**: 2.5
- **Bereik**: 1.5 - 4.0
- **Functie**: Trigger voor optimalisatie actie wanneer COP onder waarde komt

### Doel COP
- **Standaard**: 3.5
- **Bereik**: 2.0 - 5.0
- **Functie**: Streefwaarde voor optimalisatie algoritme

### Optimalisatie Strategie
- **Standaard**: Gebalanceerd (aanbevolen)
- **Opties**:
  - **Conservatief**: Langzaam, veilig - kleine stappen, lange observatie
  - **Gebalanceerd**: Matige stappen, normale observatie (aanbevolen)
  - **Agressief**: Snel, experimenteel - grote stappen, snelle iteratie

---

## 10. Adaptieve Regeling Wegingsfactoren

Deze vijf prioriteiten bepalen samen hoe het systeem beslissingen maakt. **Waarden worden automatisch genormaliseerd naar totaal 100%.** Bij actieve coast-modus domineert de coast-component (80% standaard).

### Comfort Prioriteit
- **Standaard**: 50%
- **Bereik**: 0 - 100%
- **Functie**: Gewicht voor PI temperatuurregeling
- **Hoog comfort** (70-80%): Temperatuur altijd stabiel binnen ±0.3°C

### Efficiëntie Prioriteit
- **Standaard**: 15%
- **Bereik**: 0 - 100%
- **Functie**: Gewicht voor COP optimalisatie
- **Hoge efficiency** (30-40%): Focus op maximale COP

### Kosten Prioriteit
- **Standaard**: 15%
- **Bereik**: 0 - 100%
- **Functie**: Gewicht voor prijsoptimalisatie
- **Dynamische multiplier** (v2.6.0):
  - Bij HOGE prijzen (reduce): gewicht ×2.0 tot ×3.0
  - Bij LAGE prijzen (preheat): gewicht ×1.2 tot ×1.5
- **Hoge cost** (25-35%): Maximale besparing op energiekosten

### Thermische Voorspelling Prioriteit
- **Standaard**: 20%
- **Bereik**: 0 - 50%
- **Functie**: Gewicht voor thermische voorspellingen (τ/C/UA)
- **Vereisten**: Gebouwmodel confidence ≥50%
- **0%**: Uitgeschakeld (geen influence van building model)

**Praktijk Profielen**:

| Profiel | Comfort | Efficiency | Cost | Thermal | Use Case |
|---------|---------|------------|------|---------|----------|
| Gezin met Baby | 80% | 5% | 5% | 10% | Max comfort |
| Thuiswerker | 50% | 15% | 15% | 20% | Balanced (default) |
| Budget Focus | 35% | 10% | 35% | 20% | Dynamisch contract |
| Vaak Afwezig | 30% | 40% | 10% | 20% | Max rendement |

---

## 11. Diagnostiek

Tools voor probleemoplossing en systeem analyse.

### Forceer Herverbinding
- **Type**: Eenmalige actie (checkbox)
- **Functie**: Immediate reconnect naar Tuya apparaat
- **Wanneer gebruiken**:
  - Status toont "Disconnected"
  - Na WiFi router herstart
  - Na firmware update warmtepomp

### Genereer Capability Diagnostiek Rapport
- **Type**: Eenmalige actie (checkbox)
- **Functie**: Gedetailleerd overzicht van alle capabilities status
- **Output**: Gelogd in Homey app logs

### Log Niveau
- **Standaard**: ERROR (aanbevolen productie)
- **Opties**:
  - **ERROR**: Alleen kritieke fouten (aanbevolen)
  - **WARN**: Fouten + waarschuwingen
  - **INFO**: Fouten + waarschuwingen + belangrijke gebeurtenissen
  - **DEBUG**: Alle logs (probleemoplossing) - tijdelijk gebruiken!

---

## 12. Energie Beheer

Beheer van energie tellers voor tracking en rapportage.

### Reset Externe Energie Totaal Teller
- **Type**: Eenmalige actie (checkbox)
- **Functie**: Zet de cumulatieve energie teller op nul
- **Data bron**: Metingen via flow kaart "Voer externe vermogensmeting in"
- **Let op**: Actie is onomkeerbaar, data verdwijnt

### Reset Externe Energie Dagelijkse Teller
- **Type**: Eenmalige actie (checkbox)
- **Functie**: Zet de dagelijkse energie teller op nul
- **Automatische reset**: Gebeurt normaal automatisch om 00:00 uur

---

## 💡 Veelgestelde Configuratie Scenario's

### Scenario 1: "Ik wil gewoon een stabiele kamertemperatuur"
```
✅ Adaptieve Temperatuur Regeling: AAN
   - Kp: 5.0, Ki: 1.5, Deadband: 0.3°C
✅ Gebouwmodel Leren: AAN
   - Building type: Average (of jouw type)
   - Dynamic P_int: AAN
   - Seasonal g: AAN
❌ Prijsoptimalisatie: UIT (eerst comfort onder controle)
❌ COP Optimalisatie: UIT (eerst systeem laten stabiliseren)

Prioriteiten:
- Comfort: 80%
- Efficiency: 5%
- Cost: 5%
- Thermal: 10%
```

### Scenario 2: "Maximale besparing, heb dynamisch contract"
```
✅ Adaptieve Temperatuur Regeling: AAN
✅ Gebouwmodel Leren: AAN
✅ Prijsoptimalisatie: AAN
   - Prijsberekening modus: All-in prijs
   - Drempels: Check jouw contract percentages
   - Max preheat: 1.5°C
✅ COP Optimalisatie: AAN (na 2 weken)
   - Min COP: 2.5
   - Target: 3.5
   - Strategy: Balanced

Prioriteiten:
- Comfort: 35%
- Efficiency: 10%
- Cost: 35%
- Thermal: 20%
```

### Scenario 3: "Passiefhuis, vooral efficiency belangrijk"
```
✅ Adaptieve Temperatuur Regeling: AAN
   - Kp: 2.0 (lager voor trage massa)
   - Ki: 1.0
   - Deadband: 0.5°C (meer tolerantie)
✅ Gebouwmodel Leren: AAN
   - Building type: Passive
   - Forgetting factor: 0.999 (langzame aanpassing)
✅ COP Optimalisatie: AAN
   - Strategy: Aggressive (passiefhuis tolereert experimenten)

Prioriteiten:
- Comfort: 25%
- Efficiency: 40%
- Cost: 10%
- Thermal: 25%
```

### Scenario 4: "Vaak weg, minimaal toezicht"
```
✅ Intelligente energie tracking: AAN
✅ COP berekening: AAN
   - Outlier detection: AAN
✅ Gebouwmodel: AAN (voor insights)
❌ Alle optimalisatie: UIT (set-and-forget)
✅ Flow alerts: Auto
✅ Daily cost threshold: €10 (notificatie bij hoge kosten)

Gebruik flows voor:
- Notificatie bij COP < 2.0 (mogelijk probleem)
- Notificatie bij disconnect > 5/dag
- Notificatie bij dagkosten > €10
```

---
