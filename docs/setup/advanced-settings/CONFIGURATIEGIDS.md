# Adlar Warmtepomp App - Configuratiegids

Deze gids beschrijft alle configureerbare instellingen van de Adlar Warmtepomp Homey app. Elke instelling wordt uitgelegd met praktische voorbeelden en aanbevelingen.

## 📖 Inhoudsopgave

1. [Verbindingsinstellingen](#1-verbindingsinstellingen)
2. [COP (Prestatiecoëfficiënt) Instellingen](#2-cop-prestatiecoëfficiënt-instellingen)
3. [Functie Instellingen](#3-functie-instellingen)
4. [Flow Kaart Afhandeling](#4-flow-kaart-afhandeling)
5. [Adaptieve Temperatuur Regeling](#5-adaptieve-temperatuur-regeling)
6. [Gebouwmodel Leren](#6-gebouwmodel-leren)
7. [Energieprijs Optimalisatie](#7-energieprijs-optimalisatie)
8. [COP Optimalisatie](#8-cop-optimalisatie)
9. [Adaptieve Regeling Wegingsfactoren](#9-adaptieve-regeling-wegingsfactoren)
10. [Diagnostiek](#10-diagnostiek)
11. [Energie Beheer](#11-energie-beheer)

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
- **Standaard**: 3.0
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

---

## 6. Gebouwmodel Leren

Machine learning algoritme dat de thermische eigenschappen van je woning leert.

### Gebouwmodel Leren Inschakelen
- **Standaard**: Ingeschakeld
- **Functie**: Leert 4 thermische parameters (C, UA, g, P_int)
- **Leertijd**: 24-72 uur voor basismodel, 2-4 weken voor nauwkeurig model
- **Algoritme**: Recursive Least Squares (RLS) met forgetting factor

### Vergeetfactor (Expert Instelling)
- **Standaard**: 0.998
- **Bereik**: 0.990 - 0.999
- **Functie**: Hoe snel model zich aanpast aan veranderingen
- **Alleen zichtbaar**: Met "Expert HVAC functie kaarten" ingeschakeld

### Gebouwtype
- **Standaard**: Gemiddeld (typisch NL huis)
- **Opties**:
  - **Licht**: Hout/prefab, basis isolatie, snelle temp wisselingen
  - **Gemiddeld**: Baksteen, spouwmuur, dubbel glas (typisch NL huis)
  - **Zwaar**: Beton/steen, goede isolatie, HR++ glas, stabiel
  - **Passief**: Passiefhuis, HR+++ glas, luchtdicht, WTW

### Reset Gebouwmodel Leren
- **Standaard**: Uitgeschakeld
- **Type**: Eenmalige actie (checkbox)
- **Functie**: Reset alle geleerde gebouwparameters (C, UA, τ, g, P_int) en start opnieuw met het geselecteerde gebouwprofiel
- **Automatische reset**: Schakelt automatisch uit na reset
- **Wanneer gebruiken**: Diagnostics tonen corrupte state (negatieve waarden, 0% confidence met veel samples)

### Dynamische Interne Warmtewinsten
- **Standaard**: Ingeschakeld
- **Functie**: Houdt rekening met variërende warmte van mensen/apparaten per tijdstip
- **Dag Patroon**:
  - Nacht (23:00-06:00): 40% (slapen)
  - Dag (06:00-18:00): 100% (normaal)
  - Avond (18:00-23:00): 180% (koken, TV)
- **Nauwkeurigheid verbetering**: ~10-15%

### Seizoensgebonden Zonnewinst Aanpassing
- **Standaard**: Ingeschakeld
- **Functie**: Corrigeert voor veranderende zonnehoek door het jaar
- **Seizoens Multipliers**:
  - Winter (Dec-Feb): 60%
  - Zomer (Jun-Jul): 130%
- **Nauwkeurigheid bijdrage**: 5-20% van totale warmte

---

## 7. Energieprijs Optimalisatie

Automatische optimalisatie op basis van day-ahead energieprijzen (dynamisch contract vereist).

### Prijsoptimalisatie Inschakelen
- **Standaard**: Uitgeschakeld
- **Functie**: Benut lage prijzen, vermijd hoge prijzen
- **Data bron**: EnergyZero API (gratis, geen account nodig)
- **Geschatte besparing**: €400-600 per jaar

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

## 8. COP Optimalisatie

Automatische optimalisatie van aanvoertemperatuur voor maximale efficiency.

### COP Optimalisatie Inschakelen
- **Standaard**: Uitgeschakeld
- **Functie**: Leert optimale aanvoertemperatuur per buitentemperatuur
- **Vereisten**:
  - COP berekening actief
  - Minimaal 1 week data
  - Adaptive control ingeschakeld
- **Geschatte besparing**: €200-300/jaar
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

## 9. Adaptieve Regeling Wegingsfactoren

Deze drie prioriteiten bepalen samen hoe het systeem beslissingen maakt. **Waarden worden automatisch genormaliseerd naar totaal 100%.**

### Comfort Prioriteit
- **Standaard**: 60%
- **Bereik**: 0 - 100%
- **Functie**: Gewicht voor PI temperatuurregeling
- **Hoog comfort** (80-90%): Temperatuur altijd stabiel binnen ±0.3°C

### Efficiëntie Prioriteit
- **Standaard**: 25%
- **Bereik**: 0 - 100%
- **Functie**: Gewicht voor COP optimalisatie
- **Hoge efficiency** (40-50%): Focus op maximale COP

### Kosten Prioriteit
- **Standaard**: 15%
- **Bereik**: 0 - 100%
- **Functie**: Gewicht voor prijsoptimalisatie
- **Hoge cost** (30-40%): Maximale besparing op energiekosten

**Praktijk Profielen**:

| Profiel | Comfort | Efficiency | Cost | Use Case |
|---------|---------|------------|------|----------|
| Gezin met Baby | 90% | 10% | 0% | Max comfort |
| Thuiswerker | 50% | 40% | 10% | Balanced |
| Budget Focus | 30% | 30% | 40% | Dynamisch contract |
| Vaak Afwezig | 20% | 60% | 20% | Max rendement |

---

## 10. Diagnostiek

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

## 11. Energie Beheer

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
   - Kp: 3.0, Ki: 1.5, Deadband: 0.3°C
✅ Gebouwmodel Leren: AAN
   - Building type: Average (of jouw type)
   - Dynamic P_int: AAN
   - Seasonal g: AAN
❌ Prijsoptimalisatie: UIT (eerst comfort onder controle)
❌ COP Optimalisatie: UIT (eerst systeem laten stabiliseren)

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
   - Prijsberekening modus: All-in prijs
   - Drempels: Check jouw contract percentages
   - Max preheat: 1.5°C
✅ COP Optimalisatie: AAN (na 2 weken)
   - Min COP: 2.5
   - Target: 3.5
   - Strategy: Balanced

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

*Laatste update: 2026-01-09*
*Versie: 2.3.0*
