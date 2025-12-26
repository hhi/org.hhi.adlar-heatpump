# Adlar Warmtepomp App - Configuratiegids

Deze gids beschrijft alle configureerbare instellingen van de Adlar Warmtepomp Homey app. Elke instelling wordt uitgelegd met praktische voorbeelden en aanbevelingen.

## 📖 Inhoudsopgave

1. [Verbindingsinstellingen](#1-verbindingsinstellingen)
2. [COP (Prestatiecoëfficiënt) Instellingen](#2-cop-prestatiecoëfficiënt-instellingen)
3. [Functie Instellingen](#3-functie-instellingen)
4. [Flow Kaart Afhandeling](#4-flow-kaart-afhandeling)
5. [Energie Beheer](#5-energie-beheer)
6. [Adaptieve Temperatuur Regeling](#6-adaptieve-temperatuur-regeling)
7. [Gebouwmodel Leren](#7-gebouwmodel-leren)
8. [Energieprijs Optimalisatie](#8-energieprijs-optimalisatie)
9. [COP Optimalisatie](#9-cop-optimalisatie)
10. [Systeem Integratie](#10-systeem-integratie)
11. [Diagnostiek](#11-diagnostiek)

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

**Praktijkvoorbeeld**:
```
Scenario 1: Je hebt een slimme stekker met vermogensmeting
→ Kies "Vermogen module auto-detectie" voor ±8% nauwkeurigheid

Scenario 2: Alleen standaard warmtepomp sensoren
→ Laat op "Auto" staan, app gebruikt "Koelmiddel circuit analyse" (±12%)

Scenario 3: Je wilt experimenteren met nauwkeurigheid
→ Schakel tussen methoden en vergelijk resultaten in Insights
```

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
- **Praktijk voorbeelden**:
  - **COP < 0.5**: Zeer onwaarschijnlijk - mogelijk sensor defect
  - **COP 0.5-1.0**: Extreem inefficiënt - mogelijk fout of ontdooien cyclus
  - **COP 1.0-2.0**: Inefficiënt maar mogelijk bij zeer lage buitentemperaturen
- **Aanbeveling**: Standaard 0.5 is veilig voor de meeste situaties

### Maximale Geldige COP
- **Standaard**: 8.0
- **Bereik**: 4.0 - 15.0
- **Functie**: Waarden boven deze drempel worden als outlier gemarkeerd
- **Praktijk voorbeelden**:
  - **COP > 8.0**: Zeer onwaarschijnlijk - mogelijk sensor fout of metingsprobleem
  - **COP 5.0-8.0**: Excellent maar mogelijk bij milde temperaturen met vloerverwarming
  - **COP 4.0-5.0**: Goede prestaties onder optimale condities
- **Aanbeveling**: 8.0 voor lucht-water warmtepompen, mogelijk hoger voor bodem-water

---

## 3. Functie Instellingen

Deze instellingen bepalen welke functies zichtbaar zijn in de Homey app interface. **Let op: Wijzigingen vereisen app herstart en afsluiten.**

### Curve Instelbediening Tonen
- **Standaard**: Uitgeschakeld
- **Functie**: Toont/verbergt instelknoppen voor:
  - Verwarmingscurve (stooklijn)
  - Warmwatercurve
- **Uitgeschakeld**: Alleen sensor weergave (alleen-lezen)
- **Ingeschakeld**: Volledige bediening met instelknoppen
- **Flow kaarten**: Werken altijd, ongeacht deze instelling
- **Wanneer inschakelen**:
  - Je wilt curves aanpassen vanuit Homey app
  - Je gebruikt geen flows voor curve aanpassing
- **Wanneer uitschakelen**:
  - Schonere interface gewenst
  - Alle aanpassingen via flows
  - Voorkomen van onbedoelde handmatige wijzigingen

### Vermogingsmeting Capabilities
- **Standaard**: Uitgeschakeld
- **Functie**: Toont/verbergt 9 vermogingsmetingen:
  - Stroomverbruik (totaal + per fase)
  - Spanning (L1, L2, L3)
  - Stroomsterkte (L1, L2, L3)
- **Wanneer inschakelen**:
  - Je warmtepomp heeft ingebouwde vermogensmeting
  - Je wilt gedetailleerde monitoring per fase
  - Diagnose van elektrische problemen
- **Wanneer uitschakelen**:
  - Je warmtepomp heeft geen vermogensmeting
  - Je gebruikt externe slimme meter
  - Schonere interface gewenst

### Slider Management Capabilities
- **Standaard**: Uitgeschakeld
- **Functie**: Toont/verbergt 3 schuifbalken:
  - Warmwater temperatuur instelling
  - Water modus selectie
  - Volume instellingen
- **Wanneer inschakelen**:
  - Je wilt directe controle via schuifbalken
  - Visuele feedback bij aanpassingen
- **Wanneer uitschakelen**:
  - Alles via flows/automations geregeld
  - Minimale interface gewenst

### Intelligente Energie Tracking
- **Standaard**: Ingeschakeld
- **Functie**: Slimme selectie van vermogensmeting bron
- **Hoe het werkt**:
  1. **Prioriteit 1**: Externe vermogensmeting (via flow kaart)
  2. **Prioriteit 2**: Interne sensoren (indien beschikbaar)
  3. **Resultaat**: Nauwkeurigste meting altijd actief
- **Homey Energy Dashboard**: Apparaat verschijnt automatisch met accurate data
- **Praktijk scenario**:
  ```
  Je hebt een Shelly 3EM die het totale stroomverbruik meet.
  1. Schakel "Intelligente energie tracking" in
  2. Stuur metingen via flow kaart "Voer externe vermogensmeting in"
  3. App gebruikt automatisch de externe meting (nauwkeuriger)
  4. Interne sensoren blijven beschikbaar voor diagnose
  ```
- **Aanbeveling**: Altijd ingeschakeld voor beste resultaten

---

## 4. Flow Kaart Afhandeling

Bepaalt welke flow kaarten (triggers/conditions/actions) zichtbaar zijn in de Homey Flow editor. **Herstart aanbevolen na wijzigingen.**

### Algemene Opties (voor alle categorieën):
- **Disabled (Uitgeschakeld)**: Flow kaarten altijd verborgen
- **Auto** (aanbevolen): Toon alleen als relevante sensoren beschikbaar zijn
- **Force enabled (Geforceerd)**: Altijd tonen, ook zonder sensoren

### Temperatuur Gerelateerde Alarmen
- **Standaard**: Auto
- **Flow kaarten**: Triggers voor temperatuur drempels
  - Aanvoer/retour temperatuur te hoog/laag
  - Binnen/buiten temperatuur alarmen
  - Delta-T afwijkingen
- **Wanneer Auto**: Alleen zichtbaar als temperatuur sensoren beschikbaar
- **Wanneer Force enabled**: Bruikbaar voor toekomstige uitbreiding of handmatige input

### Spanning Gerelateerde Alarmen
- **Standaard**: Auto
- **Flow kaarten**: Triggers voor spanningsafwijkingen
  - Onder-spanning (< 207V per fase)
  - Over-spanning (> 253V per fase)
  - Fase onevenwichtigheid
- **Praktijk nut**: Vroege detectie netproblemen

### Stroom Gerelateerde Alarmen
- **Standaard**: Auto
- **Flow kaarten**: Triggers voor stroomafwijkingen
  - Overcurrent detectie
  - Fase onevenwichtigheid
  - Plotselinge veranderingen
- **Praktijk nut**: Compressor/pomp problemen detecteren

### Vermogen Gerelateerde Alarmen
- **Standaard**: Auto
- **Flow kaarten**: Triggers voor vermogensafwijkingen
  - Piek verbruik detectie
  - Afwijkend verbruikspatroon
  - Efficiency alarmen

### Pulse-Stappen Gerelateerde Alarmen
- **Standaard**: Auto
- **Flow kaarten**: Triggers voor klep/compressor posities
  - EEV klep positie afwijkingen
  - Compressor modulatie
  - Systeem stabiliteit
- **Voor experts**: HVAC diagnostiek en optimalisatie

### Status Wijziging Alarmen
- **Standaard**: Auto
- **Flow kaarten**: Triggers voor operationele status wijzigingen
  - Mode wijzigingen (heating/cooling/auto)
  - Aan/uit events
  - Fout codes
  - Ontdooien cycli
- **Meest gebruikte**: Basis automatiseringen

### Efficiëntie (S)COP Alarmen
- **Standaard**: Auto
- **Flow kaarten**: Triggers voor efficiency metrics
  - COP onder drempel
  - SCOP seizoens rapportage
  - Efficiency trends
- **Vereist**: COP berekening ingeschakeld

### Expert HVAC Functie Kaarten
- **Standaard**: Ingeschakeld
- **Flow kaarten**: Geavanceerde diagnose triggers
  - Compressor operationele parameters
  - Ventilator motor analyse
  - Water flow monitoring
  - Refrigerant circuit analyse
- **Doelgroep**: HVAC professionals, geavanceerde gebruikers
- **Waarom standaard aan**: Geen nadelen, waardevolle data voor optimalisatie

### Dagelijkse Disconnect Telling
- **Standaard**: Uitgeschakeld
- **Functie**: Telt aantal keer dat verbinding verbroken werd
- **Wanneer inschakelen**:
  - Diagnose van verbindingsstabiliteit
  - Netwerk problemen identificeren
  - Tuya firmware issues detecteren
- **Normale waarde**: 0-2 per dag
- **Problematisch**: > 5 per dag → WiFi signaal verbeteren of vaste IP instellen

---

## 5. Energie Beheer

Beheer van energie tellers voor tracking en rapportage.

### Reset Externe Energie Totaal Teller
- **Type**: Eenmalige actie (checkbox)
- **Functie**: Zet de cumulatieve energie teller op nul
- **Data bron**: Metingen via flow kaart "Voer externe vermogensmeting in"
- **Wanneer gebruiken**:
  - Start van nieuw verwarmingsseizoen
  - Na vervangen van warmtepomp
  - Reset na test periode
- **Let op**: Actie is onomkeerbaar, data verdwijnt
- **Tip**: Export eerst data uit Homey Insights

### Reset Externe Energie Dagelijkse Teller
- **Type**: Eenmalige actie (checkbox)
- **Functie**: Zet de dagelijkse energie teller op nul
- **Automatische reset**: Gebeurt normaal automatisch om 00:00 uur
- **Wanneer handmatig gebruiken**:
  - Corrigeren na foutieve metingen
  - Testen van flows
  - Handmatige herstart van dagcyclus

**Praktijk scenario**:
```
Je installeert een nieuwe slimme meter op 15 maart.
Oude metingen waren onnauwkeurig.

1. Reset "Externe energie totaal teller"
   → Start met schone lei vanaf 15 maart

2. Configureer flow om elk uur meting door te sturen
   WHEN: Elke 60 minuten
   THEN: Adlar > Voer externe vermogensmeting in
         Vermogen: {{Shelly.measure_power}}

3. Monitor dagelijks verbruik in Insights
4. Dagelijkse teller reset automatisch elke nacht
```

---

## 6. Adaptieve Temperatuur Regeling

Automatische regeling van de doeltemperatuur op basis van externe binnentemperatuur sensor voor stabiele kamertemperatuur.

### Adaptieve Temperatuurregeling Inschakelen
- **Standaard**: Uitgeschakeld
- **Functie**: PI (Proportioneel-Integraal) regelaar voor stabiele binnentemperatuur
- **Vereisten**:
  - Externe temperatuur sensor (via flow kaart)
  - Target temperatuur ingesteld
  - Flow "Stuur binnentemperatuur" actief
- **Prestaties**: ±0.3°C stabiliteit (deadband instelbaar)
- **Update frequentie**: Elke 5 minuten (configurable via code)

**Hoe het werkt**:
```
1. Externe sensor meet kamertemperatuur: 20.5°C
2. Gewenste temperatuur: 21.0°C
3. Fout: -0.5°C (te koud)
4. PI regelaar berekent: verhoog aanvoer met +1.2°C
5. Warmtepomp past setpoint aan
6. Na 30 minuten: kamer is 20.9°C
7. Systeem stabiliseert binnen deadband (±0.3°C)
```

### Adaptieve Regeling Uitvoeringsmodus
- **Standaard**: Automatisch (aanbevolen)

#### Automatische Modus
- **Gedrag**: App past aanvoertemperatuur direct aan
- **Voor wie**: De meeste gebruikers
- **Voordelen**:
  - Geen extra flows nodig
  - Snelle respons
  - Set-and-forget
- **Wanneer gebruiken**: Standaard keuze voor normale werking

#### Flow-ondersteunde Modus (Gevorderd)
- **Gedrag**: App triggert flow kaart met aanbeveling
- **Voor wie**: Geavanceerde gebruikers met complexe automations
- **Voordelen**:
  - Volledige controle over uitvoering
  - Eigen condities toevoegen (bijv. alleen tussen 06:00-23:00)
  - Logging en notificaties
- **Praktijk voorbeeld**:
  ```
  WHEN: Adlar > Adaptieve regeling heeft actie aanbevolen
  AND:  Tijd is tussen 06:00 en 23:00
  AND:  Niemand is thuis = Nee
  THEN: Adlar > Stel curve in
        Waarde: {{aanbevolen_offset}}
        Reden: "PI regelaar: {{reden}}"
  AND:  Stuur notificatie: "Verwarming aangepast: {{reden}}"
  ```

### PI Regelaar Parameters (Expert Instellingen)

**Alleen zichtbaar met "Expert HVAC functie kaarten" ingeschakeld**

#### Proportionele Versterking (Kp)
- **Standaard**: 3.0
- **Bereik**: 0.5 - 10.0
- **Functie**: Bepaalt hoe snel systeem reageert op huidige fout
- **Hogere waarde** (bijv. 5.0):
  - ✅ Snellere correctie
  - ❌ Risico op overshoot (te ver doorschiet)
  - Gebruik bij: Trage systemen, grote ruimtes
- **Lagere waarde** (bijv. 1.5):
  - ✅ Stabielere regeling
  - ❌ Langzamere correctie
  - Gebruik bij: Snelle systemen, kleine ruimtes
- **Default 3.0**: Goed evenwicht voor meeste situaties

#### Integrale Versterking (Ki)
- **Standaard**: 1.5
- **Bereik**: 0.1 - 5.0
- **Functie**: Elimineert blijvende afwijkingen (steady-state error)
- **Hogere waarde** (bijv. 3.0):
  - ✅ Snellere eliminatie van blijvende afwijking
  - ❌ Kan oscillatie veroorzaken
  - Gebruik bij: Grote thermische massa, trage correctie
- **Lagere waarde** (bijv. 0.5):
  - ✅ Stabielere regeling
  - ❌ Langzamere eliminatie offset
  - Gebruik bij: Snelle systemen met goede isolatie
- **Default 1.5**: Bewezen stabiel voor diverse gebouwen

#### Deadband (Dode Zone)
- **Standaard**: 0.3°C
- **Bereik**: 0.1 - 1.0°C
- **Functie**: Tolerantie voordat aanpassingen worden gemaakt
- **Kleinere deadband** (bijv. 0.1°C):
  - ✅ Zeer stabiele temperatuur
  - ❌ Meer regelacties, meer slijtage
  - Gebruik bij: Kritische toepassingen (bijv. babykamer)
- **Grotere deadband** (bijv. 0.5°C):
  - ✅ Minder regelacties, minder slijtage
  - ❌ Grotere temperatuurvariatie
  - Gebruik bij: Normale woonruimtes
- **Default 0.3°C**: Goede balans comfort/efficiency

**Tuning Tip - Stap voor stap**:
```
Start situatie: Kp=3.0, Ki=1.5, Deadband=0.3°C

Probleem 1: Temperatuur schommelt (oscilleert)
→ Verlaag Kp naar 2.0
→ Test 24 uur
→ Nog oscillatie? Verlaag Ki naar 1.0

Probleem 2: Trage reactie, bereikt target niet
→ Verhoog Kp naar 4.0
→ Test 24 uur
→ Nog te traag? Verhoog Ki naar 2.0

Probleem 3: Veel kleine aanpassingen, slijtage
→ Vergroot Deadband naar 0.5°C
→ Accepteer iets meer variatie voor langere levensduur
```

---

## 7. Gebouwmodel Leren

Machine learning algoritme dat de thermische eigenschappen van je woning leert voor temperatuurvoorspellingen en optimalisatie.

### Gebouwmodel Leren Inschakelen
- **Standaard**: Ingeschakeld
- **Functie**: Leert 4 thermische parameters:
  - **C** (Thermische massa): Hoe snel temperatuur verandert
  - **UA** (Warmteverlies coëfficiënt): Hoeveel warmte verloren gaat
  - **g** (Zonnewinst factor): Hoeveel warmte van zonlicht bijdraagt
  - **P_int** (Interne warmtewinsten): Warmte van mensen, apparaten, koken
- **Voordelen**:
  - Nauwkeurige temperatuurvoorspellingen (N uren vooruit)
  - Optimale pre-heat timing
  - Energie besparing door beter inzicht
- **Leertijd**: 24-72 uur voor basismodel, 2-4 weken voor nauwkeurig model
- **Algoritme**: Recursive Least Squares (RLS) met forgetting factor

### Vergeetfactor (Expert Instelling)
- **Standaard**: 0.998
- **Bereik**: 0.990 - 0.999
- **Functie**: Hoe snel model zich aanpast aan veranderingen
- **Lagere waarde** (bijv. 0.990):
  - Snellere adaptatie (~1 week)
  - Geschikt voor: Seizoenswisselingen, recente verbouwingen
- **Hogere waarde** (bijv. 0.999):
  - Langzamere adaptatie (~4 weken)
  - Geschikt voor: Stabiele situaties, lange termijn optimalisatie
- **Default 0.998**: Adapteert in ~2 weken, goede balans

**Technisch**:
```
λ = 0.998 betekent:
- Metingen van 1 dag geleden: 100% × 0.998^288 = 56% gewicht
- Metingen van 1 week geleden: 16% gewicht
- Metingen van 2 weken geleden: 3% gewicht
→ Model "vergeet" oude data geleidelijk
```

### Gebouwtype
- **Standaard**: Gemiddeld (typisch NL huis)
- **Functie**: Startwaarden voor sneller leren
- **Belangrijke opmerking**: Model past zich aan je WERKELIJKE gebouw aan!

#### Light (Licht Construction)
**Kenmerken**:
- Hout/prefab constructie
- Basis isolatie (Rc 2.0-2.5)
- Enkel glas of oud dubbel glas
- Snelle temperatuur wisselingen

**Parameters**:
- C = 7 kWh/°C (lage thermische massa)
- UA = 0.35 kW/°C (matig warmteverlies)
- τ = C/UA = 20 uur (tijd constant)

**Gedrag**:
- Snel opwarmen (1-2 uur tot comfortabel)
- Snel afkoelen bij geen verwarming
- Snelle reactie op zonlicht

**Voorbeelden**: Chalets, tijdelijke woningen, oude houten huizen

#### Average (Gemiddeld - Typisch NL Huis)
**Kenmerken**:
- Baksteen constructie
- Spouwmuur met isolatie
- Dubbel glas (HR of HR+)
- Gebouwd 1980-2010

**Parameters**:
- C = 15 kWh/°C (medium thermische massa)
- UA = 0.30 kW/°C (gemiddeld warmteverlies)
- τ = 50 uur (tijd constant)

**Gedrag**:
- Normale opwarmtijd (3-4 uur)
- Stabiel gedrag
- Goede balans reactie/stabiliteit

**Voorbeelden**: Standaard rijtjeshuizen, vrijstaande woningen jaren '90

#### Heavy (Zwaar Construction)
**Kenmerken**:
- Beton/steen massieve muren
- Goede isolatie (Rc 3.5-4.5)
- HR++ glas
- Recente nieuwbouw (2010-2020)

**Parameters**:
- C = 20 kWh/°C (hoge thermische massa)
- UA = 0.25 kW/°C (lage warmteverlies)
- τ = 80 uur (tijd constant)

**Gedrag**:
- Langzame opwarming (6-8 uur)
- Zeer stabiele temperatuur
- Weinig reactie op korte zon periodes
- Ideaal voor nacht verlaging

**Voorbeelden**: Moderne beton huizen, goed geïsoleerde renovaties

#### Passive (Passiefhuis)
**Kenmerken**:
- Passiefhuis standaard
- Uitstekende isolatie (Rc > 6.0)
- HR+++ glas (triple glas)
- Luchtdicht met WTW (warmte terugwinning)

**Parameters**:
- C = 30 kWh/°C (zeer hoge thermische massa)
- UA = 0.05 kW/°C (minimaal warmteverlies)
- τ = 600 uur (tijd constant)

**Gedrag**:
- Zeer langzame temperatuurverandering
- Dagen stabiel zonder verwarming
- Grote invloed van interne warmtewinsten
- Zonlicht kan oververhitting veroorzaken

**Voorbeelden**: Gecertificeerde passiefhuizen, nul-energie woningen

**Praktijk Voorbeeld - Hoe kiezen**:
```
Test: Zet verwarming uit op milde dag (10°C buiten)

Na 6 uur:
- Temperatuur gedaald 2-3°C → Light
- Temperatuur gedaald 1-2°C → Average
- Temperatuur gedaald 0.5-1°C → Heavy
- Temperatuur nauwelijks gedaald → Passive

Of kijk naar bouwjaar:
- Voor 1980 → Light of Average
- 1980-2010 → Average
- 2010-2020 → Average of Heavy
- Na 2020 / passiefhuis → Heavy of Passive
```

### Dynamische Interne Warmtewinsten
- **Standaard**: Ingeschakeld
- **Functie**: Houdt rekening met variërende warmte van mensen/apparaten
- **Nauwkeurigheid verbetering**: 10-15% betere voorspellingen

**Dag Patroon**:
- **Nacht (23:00-06:00)**: 40% van basis (0.12 kW bij basis 0.3 kW)
  - Alleen mensen in bed
  - Geen apparaten
  - Geen koken

- **Dag (06:00-18:00)**: 100% van basis (0.3 kW)
  - Normale activiteit
  - Basis apparaten (koelkast, etc.)
  - Mogelijk thuiswerken

- **Avond (18:00-23:00)**: 180% van basis (0.54 kW)
  - Meeste mensen thuis
  - Koken (0.5-1.5 kW tijdens koken)
  - TV, verlichting, etc.

**Wanneer uitschakelen**:
- Wisselende bezetting (soms thuis, soms niet)
- Onregelmatig dagritme
- Effect wordt teniet gedaan door andere variabelen

### Seizoensgebonden Zonnewinst Aanpassing
- **Standaard**: Ingeschakeld
- **Functie**: Corrigeert voor veranderende zonnehoek door het jaar
- **Nauwkeurigheid bijdrage**: 5-20% van totale warmte (afhankelijk van raamoppervlak)

**Seizoens Multipliers**:
```
Winter (Dec-Feb):  60% - Lage zonnehoek, korte dagen
Lente (Mrt-Mei):   70-100% - Oplopend
Zomer (Jun-Aug):   110-130% - Hoge zonnehoek, lange dagen
Herfst (Sep-Nov):  70-100% - Aflopend
```

**Raamoriëntatie Effect**:
- **Zuid**: Grootste effect (winter 2-3 kW, zomer tot 5 kW)
- **Oost/West**: Matig effect (ochtend/middag pieken)
- **Noord**: Minimaal effect (diffuus licht)

**Praktijk Scenario**:
```
Woonkamer met 6m² glas op het zuiden:
- December: 300 W/m² × 6m² × 0.6 × g-factor 0.5 = 540W
- Juni:     800 W/m² × 6m² × 1.3 × g-factor 0.5 = 3120W

→ In juni 2.5 kW gratis zonnewinst!
→ Model leert dit patroon en past voorspellingen aan
```

**Wanneer uitschakelen**:
- Weinig ramen (<5% van vloeroppervlak)
- Alle ramen op noord
- Altijd gesloten gordijnen/screens
- Zware bewolking klimaat (zeer zeldzaam in NL)

---

## 8. Energieprijs Optimalisatie

Automatische optimalisatie op basis van day-ahead energieprijzen (dynamisch contract vereist).

### Prijsoptimalisatie Inschakelen
- **Standaard**: Uitgeschakeld
- **Functie**: Benut lage prijzen, vermijd hoge prijzen
- **Vereisten**:
  - Dynamisch energiecontract (bijv. ANWB Energie, Tibber, EnergyZero)
  - Gebouwmodel learning ingeschakeld (voor voorspellingen)
  - Adaptieve temperatuurregeling actief
- **Data bron**: EnergyZero API (gratis, geen account nodig)
- **Geschatte besparing**: €400-600 per jaar (afhankelijk van gebruik)

**Hoe het werkt**:
```
1. App haalt morgen's prijzen om 14:00 uur op (day-ahead markt)
2. Algoritme berekent optimale strategie:
   - Voorverwarmen in goedkope uren (+1.5°C max)
   - Afkoelen toegestaan in dure uren (-1.0°C max binnen comfort)
3. Gebouwmodel voorspelt hoelang voorkeur temperatuur blijft
4. Comfort blijft gewaarborgd (nooit te koud)
```

### Prijsdrempels

Alle drempels configureerbaar voor jouw situatie. Defaults zijn gebaseerd op Nederlandse markt gemiddelden (2024).

#### Zeer Lage Prijs Drempel
- **Standaard**: €0.10/kWh
- **Actie**: Maximum voorverwarmen (+1.5°C)
- **Wanneer**: Nachttarieven, overschot wind/zon
- **Praktijk voorbeelden**:
  - Negatieve prijzen (betaald krijgen om stroom te verbruiken!)
  - Winderige nachten
  - Zonnige middagen in zomer (overproductie)

#### Lage Prijs Drempel
- **Standaard**: €0.15/kWh
- **Actie**: Matig voorverwarmen (+0.75°C)
- **Wanneer**: Gunstige uren buiten piek
- **Praktijk**: Normale nachttarieven

#### Normale Prijs Drempel
- **Standaard**: €0.25/kWh
- **Actie**: Handhaven (0°C aanpassing)
- **Wanneer**: Gemiddelde dagprijzen
- **Praktijk**: Standaard verbruik zonder optimalisatie

#### Hoge Prijs Drempel
- **Standaard**: €0.35/kWh
- **Actie**: Lichte verlaging (-0.5°C binnen comfort)
- **Wanneer**: Avondpieken, hoge vraag
- **Praktijk**: 17:00-21:00 werkdagen

**Boven Hoge Drempel** (>€0.35/kWh):
- **Actie**: Sterke verlaging (-1.0°C binnen minimum comfort)
- **Wanneer**: Extreme pieken, koude winter avonden
- **Praktijk**: 18:00-19:00 op koudste dagen

### Maximum Voorverwarm Offset
- **Standaard**: 1.5°C
- **Bereik**: 0.0 - 3.0°C
- **Functie**: Beperkt hoeveel warmer dan gewenst
- **Afweging**:
  - **Hoger** (2.5°C): Meer besparing, minder comfort
  - **Lager** (1.0°C): Meer comfort, minder besparing
- **Comfort bescherming**: Gebouwmodel berekent of te warm wordt

### Dagelijkse Kosten Waarschuwings Drempel
- **Standaard**: €10/dag
- **Bereik**: €1 - €50/dag
- **Functie**: Trigger flow kaart bij overschrijding
- **Gebruik scenario's**:
  - Budget bewaking
  - Detectie abnormaal verbruik
  - Notificaties bij hoge kosten

**Praktijk Flow**:
```
WHEN: Adlar > Dagelijkse kosten overschrijden drempel
      Kosten: {{daily_cost}} (bijv. €12.50)
THEN: Stuur notificatie
      "⚠️ Verwarming kosten vandaag: €12.50
       Budget: €10/dag
       Oorzaak: Hoge energieprijzen (€0.45/kWh piek)
       Tip: Overweeg temperatuur 1°C lager"
```

**Praktijk Rekenvoorbeeld**:
```
Scenario: Gemiddelde winterdag

Zonder optimalisatie:
- 06:00-09:00: 6 kW × 3u × €0.35 = €6.30
- 09:00-17:00: 4 kW × 8u × €0.25 = €8.00
- 17:00-23:00: 7 kW × 6u × €0.40 = €16.80
- 23:00-06:00: 3 kW × 7u × €0.15 = €3.15
Totaal: €34.25/dag

Met optimalisatie:
- 23:00-06:00: 5 kW × 7u × €0.08 = €2.80 (voorverwarmd)
- 06:00-09:00: 4 kW × 3u × €0.35 = €4.20 (minder nodig)
- 09:00-17:00: 4 kW × 8u × €0.25 = €8.00 (normaal)
- 17:00-23:00: 5 kW × 6u × €0.40 = €12.00 (lagere temp)
- Thermische massa: -€1.25 (voorraad)
Totaal: €25.75/dag

Besparing: €8.50/dag = €255/maand = €3060/jaar!
(Realistischer: €400-600/jaar door wisselende prijzen)
```

---

## 9. COP Optimalisatie

Automatische optimalisatie van aanvoertemperatuur voor maximale efficiency op basis van historische COP data.

### COP Optimalisatie Inschakelen
- **Standaard**: Uitgeschakeld
- **Functie**: Leert optimale aanvoertemperatuur per buitentemperatuur
- **Vereisten**:
  - COP berekening actief
  - Minimaal 1 week data
  - Adaptive control ingeschakeld
- **Geschatte besparing**: €200-300/jaar
- **Leertijd**: 2-4 weken voor betrouwbare optimalisatie

**Principe**:
```
Normale curve:      T_uit = -10°C → T_aanvoer = 45°C → COP 2.8
Na optimalisatie:   T_uit = -10°C → T_aanvoer = 42°C → COP 3.2

Waarom werkt dit?
- Lagere aanvoer = hogere COP
- Systeem leert: "Bij -10°C kan ik met 42°C ook comfortabel houden"
- Resultaat: 14% efficiënter (3.2/2.8 = 1.14)
```

### Minimaal Acceptabele COP
- **Standaard**: 2.5
- **Bereik**: 1.5 - 4.0
- **Functie**: Trigger voor optimalisatie actie
- **Wanneer COP < drempel**:
  1. Log waarschuwing
  2. Analyseer oorzaak (te hoge aanvoer? storing?)
  3. Stel verlaging voor indien mogelijk

**Praktijk drempels**:
- **COP < 1.5**: Kritiek - mogelijk defect of ontdooien
- **COP 1.5-2.0**: Slecht - onderhoud overwegen
- **COP 2.0-2.5**: Matig - optimalisatie mogelijk
- **COP 2.5-3.5**: Goed - normale werking
- **COP > 3.5**: Excellent - optimaal afgesteld

### Doel COP
- **Standaard**: 3.5
- **Bereik**: 2.0 - 5.0
- **Functie**: Streefwaarde voor optimalisatie algoritme
- **Realistisch**:
  - **Lucht-water**: 2.5-4.0 (afhankelijk van buitentemp)
  - **Bodem-water**: 3.5-5.0 (stabielere bron)
- **Te hoog instellen**: Optimalisatie kan comfort opofferen
- **Te laag instellen**: Weinig verbetering, gemiste kansen

### Optimalisatie Strategie
Bepaalt hoe agressief het systeem optimalisatie doorvoert.

#### Conservative (Conservatief)
- **Gedrag**: Kleine stappen, lange observatie
- **Aanpassing**: ±0.5°C per week
- **Observatie**: 3-7 dagen per stap
- **Voor wie**:
  - Eerste gebruik
  - Huishoudens met strikte comfort eisen
  - Systemen met onbekende karakteristieken
- **Voordelen**: Veilig, geen comfort risico
- **Nadelen**: Langzame optimalisatie (2-3 maanden)

#### Balanced (Gebalanceerd) - AANBEVOLEN
- **Gedrag**: Matige stappen, normale observatie
- **Aanpassing**: ±1.0°C per week
- **Observatie**: 2-3 dagen per stap
- **Voor wie**: Meeste gebruikers
- **Voordelen**: Goede balans snelheid/veiligheid
- **Nadelen**: Geen - beste algemene keuze
- **Optimalisatie tijd**: 4-6 weken

#### Aggressive (Agressief)
- **Gedrag**: Grote stappen, snelle iteratie
- **Aanpassing**: ±2.0°C per week
- **Observatie**: 1 dag per stap
- **Voor wie**:
  - Ervaren gebruikers
  - Test/experimenteer fase
  - Systemen met goede monitoring
- **Voordelen**: Snelle optimalisatie (2 weken)
- **Nadelen**: Risico op tijdelijk comfort verlies

**Praktijk Scenario - Balanced strategie**:
```
Week 1: Buitentemp -5°C
- Huidige curve: 40°C aanvoer → COP 3.0 → Comfortabel
- Systeem test: 39°C aanvoer
- Resultaat: COP 3.2, nog steeds comfortabel
- Actie: Curve -1°C aangepast

Week 2: Buitentemp -5°C
- Nieuwe curve: 39°C aanvoer
- Systeem test: 38°C aanvoer
- Resultaat: COP 3.4, maar kamer wordt traag warm
- Actie: Terug naar 39°C (optimum gevonden)

Conclusie: Bij -5°C buiten is 39°C de optimale aanvoer
→ Systeem onthoudt dit en past curve permanent aan
```

---

## 10. Systeem Integratie

Geavanceerde instellingen voor integratie van alle optimalisatie componenten.

### Monitoring Modus
- **Standaard**: Ingeschakeld (veiligheid)
- **Functie**: Test adaptive control zonder echte aanpassingen
- **Gedrag**:
  - **Ingeschakeld**: Alle aanbevelingen alleen gelogd via flow kaart
  - **Uitgeschakeld**: Aanbevelingen worden uitgevoerd

**Waarom standaard aan?**
Veiligheid - laat je eerst zien wat het systeem zou doen voordat het echt ingrijpt.

**Aanbevolen Procedure**:
```
Stap 1: Laat monitoring mode 1 week aan
- Analyseer gelogde acties in flows
- Controleer of aanbevelingen logisch zijn
- Test of je comfortabel bent met beslissingen

Stap 2: Maak test flow
WHEN: Adlar > Adaptieve regeling heeft actie gelogd
THEN: Stuur notificatie
      "🤖 Zou aanpassen: {{action}}
       Reden: {{reason}}
       Van {{current}}°C naar {{target}}°C"

Stap 3: Na 1 week tevreden?
→ Zet monitoring mode UIT
→ Systeem voert nu echt aanpassingen uit
→ Monitor eerste week extra op comfort

Stap 4: Altijd terugval optie
→ Zet monitoring mode weer AAN indien onverwacht gedrag
```

### Prioriteiten (Comfort / Efficiency / Cost)

Deze drie prioriteiten bepalen samen hoe het systeem beslissingen maakt. **Waarden worden automatisch genormaliseerd naar totaal 100%.**

**Belangrijke Opmerking**: Er is een bekend bug waarbij prioriteiten NIET automatisch renormaliseren wanneer een component uitgeschakeld is. Dit wordt in een toekomstige update gefixed.

#### Comfort Prioriteit
- **Standaard**: 60%
- **Functie**: Gewicht voor PI temperatuurregeling
- **Hoog comfort** (80-90%):
  - Temperatuur altijd stabiel binnen ±0.3°C
  - Voorrang boven efficiency en kosten
  - Geschikt voor: Gezinnen met kinderen, ouderen
- **Laag comfort** (30-40%):
  - Meer temperatuur variatie toegestaan
  - Efficiency en kosten krijgen voorrang
  - Geschikt voor: Flexibele gebruikers, vaak afwezig

#### Efficiency Prioriteit
- **Standaard**: 25%
- **Functie**: Gewicht voor COP optimalisatie
- **Hoge efficiency** (40-50%):
  - Focus op maximale COP
  - Langere opwarmtijden acceptabel
  - Lagere aanvoertemperaturen
  - Geschikt voor: Milieubewuste gebruikers, subsidie rendement
- **Lage efficiency** (10-20%):
  - COP minder belangrijk
  - Snellere response
  - Hogere aanvoertemperaturen indien gewenst
  - Geschikt voor: Comfort boven efficiency

#### Cost Prioriteit
- **Standaard**: 15%
- **Functie**: Gewicht voor prijsoptimalisatie
- **Hoge cost** (30-40%):
  - Maximale besparing op energiekosten
  - Voorverwarmen in goedkope uren
  - Temperatuur verlaging in dure uren
  - Geschikt voor: Dynamisch contract, budget focus
- **Lage cost** (5-10%):
  - Minimale invloed van energieprijzen
  - Stabiele regeling ongeacht prijs
  - Geschikt voor: Vast contract, geen budget druk

**Praktijk Voorbeelden**:

**Profiel 1: Gezin met Baby (Max Comfort)**
```
Comfort:    90%
Efficiency: 10%
Cost:       0%

Gedrag:
- Temperatuur altijd exact op target (±0.2°C)
- Hoge aanvoertemperaturen voor snelle reactie
- Geen compromis op comfort voor kosten
- COP optimalisatie alleen als comfort behouden blijft
```

**Profiel 2: Milieubewust Thuiswerker (Balanced)**
```
Comfort:    50%
Efficiency: 40%
Cost:       10%

Gedrag:
- Temperatuur binnen ±0.5°C acceptabel
- Lagere aanvoertemperaturen voor hogere COP
- Kleine prijs optimalisatie tijdens werkuren
- Goede balans alle aspecten
```

**Profiel 3: Budget Focus met Dynamisch Contract**
```
Comfort:    30%
Efficiency: 30%
Cost:       40%

Gedrag:
- Temperatuur variatie ±1.0°C toegestaan
- Voorverwarmen in goedkope nachttarieven
- Lagere temperatuur tijdens dure avonduren
- Maximale besparing op energierekening
```

**Profiel 4: Vaak Afwezig (Efficiency Focus)**
```
Comfort:    20%
Efficiency: 60%
Cost:       20%

Gedrag:
- Temperatuur kan variëren bij afwezigheid
- Zeer lage aanvoertemperaturen (max COP)
- Langzame opwarming acceptabel
- Ideaal voor maximum rendement
```

**Normalisatie Voorbeeld**:
```
Ingevoerd:
- Comfort:    70%
- Efficiency: 50%
- Cost:       30%
Totaal:       150%

Genormaliseerd (automatisch):
- Comfort:    46.7% (70/150 × 100)
- Efficiency: 33.3% (50/150 × 100)
- Cost:       20.0% (30/150 × 100)
Totaal:       100.0%
```

**Bug Waarschuwing (bekende issue)**:
```
Als COP optimalisatie uitgeschakeld:
Input: Comfort 60%, Efficiency 25% (uitgeschakeld), Cost 15%
→ VERWACHT: Renormaliseer naar Comfort 80%, Cost 20%
→ WERKELIJK: Blijft Comfort 60%, Cost 15% (totaal 75%)
→ IMPACT: Beslissingen minder sterk dan verwacht

Workaround tot fix:
Pas percentages handmatig aan:
- Comfort: 80% (= 60/75 × 100)
- Cost: 20% (= 15/75 × 100)
```

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
  - Na wijzigen IP-adres
- **Effect**:
  - Omzeilt normale reconnect delays
  - Reset error recovery state
  - Start fresh heartbeat monitoring
- **Let op**: Verbreekt actieve verbinding - gebruik alleen bij problemen

**Normale Reconnect vs Force Reconnect**:
```
Normale reconnect (automatisch):
- Wacht 30 sec na disconnect
- Exponential backoff bij fouten (30s → 60s → 120s)
- Max 5 pogingen, dan pauze 10 min

Force reconnect (handmatig):
- Onmiddellijk, geen delay
- Reset alle error counters
- Bypass alle restricties
- Garantie voor verse poging
```

### Genereer Capability Diagnostiek Rapport
- **Type**: Eenmalige actie (checkbox)
- **Functie**: Gedetailleerd overzicht van alle capabilities status
- **Output**: Gelogd in Homey app logs
- **Wanneer gebruiken**:
  - Capabilities tonen "null" waarden
  - Na Homey app update
  - Voor support aanvraag
  - Diagnose welke sensoren werken

**Rapport Format**:
```
=== CAPABILITY DIAGNOSTICS REPORT ===
Timestamp: 2024-01-15 14:23:45

Working Capabilities (32):
✅ measure_temperature.indoor: 21.5°C
✅ measure_temperature.outdoor: 5.2°C
✅ measure_temperature.supply: 38.0°C
✅ target_temperature: 40.0°C
✅ measure_cop: 3.45
...

Null Value Capabilities (8):
❌ measure_power.phase_l1: null (sensor not available)
❌ measure_voltage.l1: null (sensor not available)
...

Capability Health: 80% (32/40 working)
Last DPS Update: 12 seconds ago
Connection: Connected (uptime 3d 12h)
```

### Log Niveau
- **Standaard**: ERROR (aanbevolen productie)
- **Functie**: Controleert hoeveel logging wordt gegenereerd

#### ERROR - Alleen Kritieke Fouten (Aanbevolen)
- **Wat wordt gelogd**:
  - Connection failures
  - Sensor defecten
  - API errors
  - Crashes en exceptions
- **Voor wie**: Normale dagelijkse gebruik
- **Log grootte**: Minimaal (~10 regels/dag)
- **Prestaties**: Geen impact

#### WARN - Fouten + Waarschuwingen
- **Extra logs**:
  - COP outlier detecties
  - Reconnect pogingen
  - Sensor timeout warnings
  - Configuratie issues
- **Voor wie**: Bij intermitterende problemen
- **Log grootte**: Klein (~50 regels/dag)
- **Prestaties**: Verwaarloosbaar

#### INFO - Fouten + Waarschuwingen + Belangrijke Gebeurtenissen
- **Extra logs**:
  - Connection status changes
  - Adaptive control actions
  - COP calculation results
  - Flow card triggers
  - Settings changes
- **Voor wie**: Monitoring systeem gedrag
- **Log grootte**: Medium (~200 regels/dag)
- **Prestaties**: Minimaal

#### DEBUG - Alle Logs (Probleemoplossing)
- **Extra logs**:
  - Elke DPS update (alle sensor waarden)
  - RLS algorithm iterations
  - PI controller berekeningen
  - Heartbeat monitoring details
  - Internal state changes
- **Voor wie**:
  - Bug rapportage
  - Ontwikkelaar diagnostiek
  - Diepgaande analyse
- **Log grootte**: Groot (2000+ regels/dag)
- **Prestaties**: Klein impact (extra disk I/O)
- **Waarschuwing**: Vult Homey logs snel - alleen tijdelijk gebruiken!

**Aanbevolen Gebruik**:
```
Dagelijks gebruik:
→ ERROR level (standaard)

Probleem dat je wilt analyseren:
1. Zet naar INFO of DEBUG
2. Reproduceer probleem
3. Export logs via Homey Developer Tools
4. Zet terug naar ERROR
5. Stuur logs naar support

Ontwikkeling/Testing:
→ DEBUG level, maar reset na test
```

---

## 💡 Veelgestelde Configuratie Scenario's

### Scenario 1: "Ik wil gewoon een stabiele kamertemperatuur"
```
✅ Adaptieve Temperatuur Regeling: AAN
   - Mode: Automatisch
   - Kp: 3.0, Ki: 1.5, Deadband: 0.3°C
✅ Gebouwmodel Leren: AAN
   - Building type: Average (of jouw type)
   - Dynamic P_int: AAN
   - Seasonal g: AAN
❌ Prijsoptimalisatie: UIT (eerst comfort onder controle)
❌ COP Optimalisatie: UIT (eerst systeem laten stabiliseren)
✅ Monitoring Mode: AAN (eerste week)

Prioriteiten:
- Comfort: 80%
- Efficiency: 15%
- Cost: 5%
```

### Scenario 2: "Maximale besparing, heb dynamisch contract"
```
✅ Adaptieve Temperatuur Regeling: AAN
✅ Gebouwmodel Leren: AAN
✅ Prijsoptimalisatie: AAN
   - Drempels: Defaults (of afstemmen op jouw contract)
   - Max preheat: 1.5°C
✅ COP Optimalisatie: AAN (na 2 weken)
   - Min COP: 2.5
   - Target: 3.5
   - Strategy: Balanced
✅ Monitoring Mode: AAN (eerste 2 weken)

Prioriteiten:
- Comfort: 40%
- Efficiency: 30%
- Cost: 30%
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
❌ Prijsoptimalisatie: Optioneel (weinig effect door lage verbruik)

Prioriteiten:
- Comfort: 30%
- Efficiency: 60%
- Cost: 10%
```

### Scenario 4: "Vaak weg, minimaal toezicht"
```
✅ Intelligente energie tracking: AAN
✅ COP berekening: AAN
   - Outlier detection: AAN
✅ Adaptieve controle: UIT (geen dynamische aanpassingen)
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

## 📚 Gerelateerde Documentatie

- **[Flow Cards Guide](FLOW_CARDS_GUIDE.md)** - Gebruik van flow kaarten voor automations
- **[Adaptive Control Architecture](../Dev%20support/Architectural%20overview/adaptive-control-architecture.md)** - Technische werking van adaptive control
- **[Calculator Utilities](../Dev%20support/CALCULATORS.md)** - Curve calculator, time schedules, seasonal modes

---

*Laatste update: 2024-12-26*
*Versie: 2.2.0*
