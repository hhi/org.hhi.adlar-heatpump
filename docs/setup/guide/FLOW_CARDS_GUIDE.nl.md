# Flow Cards Implementatiegids: Basis Device Flow Cards (v2.7.x)

> **Scope**: Deze gids documenteert **basis device flow cards** voor apparaatmonitoring, energie tracking en calculators.
> **Geavanceerde features**: Zie [Advanced Flow Cards Guide](../advanced-control/ADVANCED_FLOWCARDS_GUIDE.nl.md) voor adaptieve regeling, building model, COP optimizer, energy optimizer, building insights en wind/solar integratie.

Deze gids biedt praktische voorbeelden, configuratietips en probleemoplossingadvies voor de basis flow cards van de Adlar Warmtepomp app.

---

## Overzicht

Versie 1.0.7 introduceert **5 nieuwe flow cards** die kritieke functionaliteitslacunes vullen die tijdens de uitgebreide flow card audit zijn geïdentificeerd:

| Flow Card | Type | Categorie | Prioriteit |
|-----------|------|-----------|------------|
| `fault_detected` | Trigger | Apparaatveiligheid | 🔴 Kritiek |
| `power_threshold_exceeded` | Trigger | Energiebeheer | 🔴 Kritiek |
| `total_consumption_milestone` | Trigger | Doelen Tracking | 🔴 Kritiek |
| `cop_efficiency_check` | Voorwaarde | Prestaties | 🔴 Kritiek |
| `daily_cop_above_threshold` | Voorwaarde | Prestaties | 🔴 Kritiek |
| `monthly_cop_above_threshold` | Voorwaarde | Prestaties | 🔴 Kritiek |

Daarnaast is **1 bestaande flow card** geverifieerd als productie-klaar:
- `temperature_differential` (Voorwaarde) - Systeemgezondheid ✅

---

## Triggers

### 1. 🚨 Storing Gedetecteerd

**ID**: `fault_detected`
**Categorie**: Apparaatveiligheid
**Wanneer het triggert**: Wanneer de warmtepomp een systeemstoring meldt (DPS 15 > 0)

#### Configuratie

```yaml
WHEN: Storingscode [fault_code] gedetecteerd
```

**Parameters**:
- `fault_code` (bereik 1-100): Specifieke storingscode om te monitoren
  - Laat leeg om te triggeren op ELKE storing
  - Specificeer code (bijv. 3) om alleen op die storing te triggeren

**Beschikbare Tokens**:
- `fault_code` (nummer): Het storingscodenummer
- `fault_description` (tekst): Leesbare beschrijving in jouw taal

#### Ondersteunde Storingscodes

| Code | Engels | Nederlands |
|------|--------|------------|
| 0 | No fault | Geen storing |
| 1 | High pressure protection | Hogedrukbeveiliging |
| 2 | Low pressure protection | Lagedrukbeveiliging |
| 3 | Compressor overheating | Compressor oververhitting |
| 4 | Discharge temperature too high | Uitlaattemperatuur te hoog |
| 5 | Water flow sensor fault | Waterdoorstroomsensor storing |
| 6 | Inlet temperature sensor fault | Inlaattemperatuursensor storing |
| 7 | Outlet temperature sensor fault | Uitlaattemperatuursensor storing |
| 8 | Ambient temperature sensor fault | Omgevingstemperatuursensor storing |
| 9 | Coil temperature sensor fault | Spoeltemperatuursensor storing |
| 10 | Low water flow protection | Lage waterdoorstroom beveiliging |
| 11 | Antifreeze protection active | Vorstbeveiliging actief |
| 12 | Phase loss or reverse phase | Faseuitval of omkeerde fase |
| 13 | Communication error | Communicatiefout |
| 14 | EEV valve fault | EEV-klep storing |
| 15 | System pressure abnormal | Systeemdruk abnormaal |

#### Voorbeeld Flows

**Kritieke Storingsnotificatie**:
```
WHEN: Storing gedetecteerd
  AND fault_code is 1, 2, 3, of 4
THEN: Stuur notificatie "Kritieke warmtepomp storing: {{fault_description}}"
  AND Schakel apparaat uit
  AND Stuur e-mail naar onderhoud
```

**Sensor Storing Auto-Herstel**:
```
WHEN: Storing gedetecteerd
  AND fault_code is 6, 7, 8, of 9
THEN: Wacht 5 minuten
  AND Herstart apparaat
  AND Controleer of storing is opgeheven
```

**Vorstbeveiliging Alarm**:
```
WHEN: Storing gedetecteerd
  AND fault_code is 11
THEN: Stuur notificatie "Vorstbeveiliging geactiveerd"
  AND Verhoog doeltemperatuur met 2°C
```

#### Technische Details

- **Detectie**: Monitort DPS 15 (`adlar_fault` capability)
- **Trigger Logica**: Triggert alleen op **nieuwe** storingen (wijzigingsdetectie)
- **Deduplicatie**: Dezelfde storingscode hertriggert niet totdat opgeheven (code keert terug naar 0)
- **Taalondersteuning**: Storingsbeschrijvingen automatisch gelokaliseerd (EN/NL)
- **Prestaties**: Nul overhead wanneer geen storing aanwezig

#### Probleemoplossing

**Probleem**: Storing trigger vuurt herhaaldelijk voor dezelfde storing
**Oplossing**: Dit zou niet moeten gebeuren door wijzigingsdetectie. Controleer apparaatlogs op storingscode oscillatie.

**Probleem**: Storingsbeschrijving toont "Unknown fault (code: X)"
**Oplossing**: De storingscode zit niet in de standaard mappingtabel. Meld code aan ontwikkelaar voor toevoeging.

---

### 2. ⚡ Vermogensdrempel Overschreden

**ID**: `power_threshold_exceeded`
**Categorie**: Energiebeheer
**Wanneer het triggert**: Wanneer vermogensverbruik geconfigureerde drempel overschrijdt

#### Configuratie

```yaml
WHEN: Vermogensverbruik overschreed [threshold] W
```

**Parameters**:
- `threshold` (100-10000W): Vermogensdrempel in watts
  - Standaard: 3000W
  - Aanbevolen: Stel in op 120% van normaal maximum

**Beschikbare Tokens**:
- `current_power` (nummer): Huidig vermogensverbruik in watts
- `threshold_power` (nummer): De geconfigureerde drempel

#### Slimme Functies

**Hysterese Bescherming** (5%):
- Eenmaal getriggerd op 3000W, moet onder 2850W zakken om te resetten
- Voorkomt trigger spam van vermogensoscillaties
- Voorbeeld: 2990W → 3010W → TRIGGER → 2995W → (geen hertrigger)

**Rate Limiting** (5 minuten):
- Maximum 1 trigger per 5 minuten
- Voorkomt notificatie-overvloed tijdens aanhoudende overbelasting
- Logt rate-limited events voor diagnostiek

#### Voorbeeld Flows

**Hoog Verbruik Alarm**:
```
WHEN: Vermogensdrempel overschreden 3500W
THEN: Stuur notificatie "Hoog vermogensgebruik: {{current_power}}W"
  AND Log naar Google Sheets met timestamp
```

**Overbelasting Bescherming**:
```
WHEN: Vermogensdrempel overschreden 4500W
THEN: Verlaag doeltemperatuur met 2°C
  AND Wacht 5 minuten
  AND Controleer of vermogen onder 4000W is gezakt
```

**Tijd-van-Gebruik Optimalisatie**:
```
WHEN: Vermogensdrempel overschreden 3000W
  AND Tijd is tussen 17:00 en 21:00 (piekuren)
THEN: Schakel naar Economy modus
  AND Stuur notificatie "Geschakeld naar economy modus tijdens piekuren"
```

---

### 3. 🎯 Totaal Verbruik Mijlpaal

**ID**: `total_consumption_milestone`
**Categorie**: Doelen Tracking
**Wanneer het triggert**: Wanneer cumulatief energieverbruik 100 kWh mijlpalen bereikt

#### Configuratie

```yaml
WHEN: Totaal verbruik bereikt [milestone] kWh
```

**Parameters**:
- `milestone` (100-50000 kWh): Mijlpaalwaarde
  - Auto-triggert op: 100, 200, 300, ..., 1000, 1100, etc.
  - **Increment**: Vast op 100 kWh stappen

**Beschikbare Tokens**:
- `total_consumption` (nummer): Huidig totaal verbruik in kWh
- `milestone_value` (nummer): De mijlpaal die is bereikt

#### Mijlpaal Gedrag

**Eerste Run Inhaalslag**:
Als je de app installeert met bestaand verbruik (bijv. 523 kWh):
- Zal triggeren voor ALLE mijlpalen: 100, 200, 300, 400, 500
- Dit is opzettelijk om gemiste mijlpalen in te halen
- Volgende mijlpalen triggeren normaal (alleen nieuwe)

**Deduplicatie**:
- Elke mijlpaal triggert slechts één keer (ooit)
- Bijgehouden in device store: `triggered_energy_milestones`
- Overleeft app herstarten en updates
- Kan handmatig worden gereset indien nodig

#### Voorbeeld Flows

**Maandelijks Budget Tracking**:
```
WHEN: Mijlpaal bereikt 300 kWh
THEN: Stuur notificatie "Maandelijks budget bereikt: {{total_consumption}} kWh"
  AND Bereken kosten: {{total_consumption}} * €0.30
  AND Log naar Insights
```

**Seizoensgebonden Doel Tracking**:
```
WHEN: Mijlpaal bereikt 1000 kWh
THEN: Stuur notificatie "Seizoensmijlpaal: {{milestone_value}} kWh"
  AND Vergelijk met vorig jaar data
  AND Stuur efficiëntierapport
```

---

## Voorwaarden

### 4. 🎯 COP Efficiëntie Check

**ID**: `cop_efficiency_check`
**Categorie**: Prestatiemonitoring
**Wanneer waar**: Wanneer huidige COP drempel overschrijdt EN compressor draait

#### Configuratie

```yaml
IF: COP efficiëntie is boven/onder [threshold]
```

**Parameters**:
- `threshold` (1.0-8.0): COP drempelwaarde
  - Standaard: 2.0
  - Typisch bereik: 2.5-4.5 voor warmtepompen
  - Uitstekend: > 4.0, Goed: 3.0-4.0, Slecht: < 2.5

#### Slim Gedrag

**Compressor Status Check**:
- **Retourneert `false` wanneer compressor idle** (zelfs als COP > drempel)
- Waarom? COP=0 tijdens idle is technisch correct maar misleidend in flows
- Voorkomt vals positieven in "IF COP < 2.0" flows

**Real-Time Monitoring**:
- Gebruikt huidige `adlar_cop` capability (elke 30 seconden bijgewerkt)
- Weerspiegelt instantane efficiëntie, geen gemiddeldes

#### Voorbeeld Flows

**Efficiëntie Alarm**:
```
IF: COP efficiëntie is onder 2.5
  AND Apparaat is aan
THEN: Stuur notificatie "Lage efficiëntie: COP {{adlar_cop}}"
  AND Controleer op problemen
```

**Optimalisatie Trigger**:
```
IF: COP efficiëntie is boven 4.0
  AND Buitentemperatuur < 0°C
THEN: Stuur notificatie "Uitstekende efficiëntie ondanks koud weer!"
  AND Log als referentiepunt
```

---

### 5. 📊 Dagelijkse COP Boven Drempel

**ID**: `daily_cop_above_threshold`
**Categorie**: Prestatiemonitoring
**Wanneer waar**: Wanneer 24-uurs voortschrijdend gemiddelde COP drempel overschrijdt

#### Configuratie

```yaml
IF: Dagelijkse COP is boven/onder [threshold]
```

**Parameters**:
- `threshold` (1.0-8.0): Dagelijkse COP drempel
  - Standaard: 2.5
  - Aanbevolen: 3.0 voor goede dagelijkse prestaties

#### Slim Gedrag

**Data Beschikbaarheid Check**:
- **Retourneert `false` als onvoldoende data** (dailyCOP = 0)
- Vereist minimaal 10 datapunten (~5 minuten operatie)
- Dit voorkomt vals positieven bij opstarten

**Voortschrijdend Gemiddelde**:
- Berekent COP over laatste 24 uur
- Gewogen naar looptijd (idle periodes uitgesloten)
- Stabieler dan real-time COP

---

### 6. 📈 Maandelijkse COP Boven Drempel

**ID**: `monthly_cop_above_threshold`
**Categorie**: Lange-Termijn Prestaties
**Wanneer waar**: Wanneer 30-dagen voortschrijdend gemiddelde COP drempel overschrijdt

#### Configuratie

```yaml
IF: Maandelijkse COP is boven/onder [threshold]
```

**Parameters**:
- `threshold` (1.0-8.0): Maandelijkse COP drempel
  - Standaard: 3.0
  - Doel: > 3.5 voor uitstekende seizoensprestaties

#### Voorbeeld Flows

**Maandelijks Rapport**:
```
ELKE 1e dag van maand om 09:00:
IF: Maandelijkse COP boven 3.5
THEN: Stuur notificatie "Uitstekende maandelijkse efficiëntie: {{adlar_cop_monthly}}"
  AND Bereken geschatte kosten
  AND Vergelijk met vorige maanden
```

**Voorspellend Onderhoud**:
```
ELKE MAAND:
IF: Maandelijkse COP gedaald met > 10% vs vorige maand
THEN: Stuur alarm "Efficiëntie daalt"
  AND Aanbeveel filtercontrole
  AND Plan professionele inspectie
```

---

### 7. ✅ Temperatuurverschil

**ID**: `temperature_differential`
**Categorie**: Systeemgezondheid
**Status**: ✅ **Productie-klaar** (beschikbaar in v2.7.x)

#### Configuratie

```yaml
IF: Temperatuurverschil is boven/onder [differential]°C
```

**Parameters**:
- `differential` (1-50°C): Temperatuurverschil drempel
  - Typisch: 5-10°C voor efficiënte operatie
  - Te laag (< 3°C): Slechte warmteoverdracht
  - Te hoog (> 15°C): Mogelijke debietproblemen

#### Voorbeeld Flows

**Warmteoverdracht Efficiëntie**:
```
IF: Temperatuurverschil onder 3°C
  AND Compressor draait
THEN: Stuur notificatie "Slechte warmteoverdracht gedetecteerd"
  AND Controleer waterdebiet
  AND Verifieer pompwerking
```

**Debiet Probleem Detectie**:
```
IF: Temperatuurverschil boven 15°C
  AND Waterdebiet onder 20 L/min
THEN: Stuur alarm "Mogelijke debietbeperking"
  AND Aanbeveel filtercontrole
```

---

## Acties

### 8. 🕐 Bereken Waarde van Tijdschema

**ID**: `calculate_time_based_value`
**Categorie**: Tijdgebaseerde Automatisering
**Doel**: Evalueer huidige tijd tegen dagelijkse schema's om outputwaarden te berekenen

#### Overzicht

De tijdschema calculator maakt **tijd-van-dag programmering** mogelijk voor geautomatiseerde temperatuurschema's, tijd-van-gebruik optimalisatie en dagelijkse routines.

#### Configuratie

```yaml
ACTION: Bereken waarde van tijdschema
  Tijdschema: 06:00-09:00: 22, 09:00-17:00: 19, 17:00-23:00: 21, 23:00-06:00: 18
  Retourneert: {{result_value}}
```

**Parameters**:
- `schedule` (tekst): Tijdschema definitiestring (komma of newline gescheiden)

**Retourneert**:
- `result_value` (nummer): Berekende outputwaarde gebaseerd op huidige tijd

#### Schema Formaat

**Syntax**: `UU:MM-UU:MM: output_waarde`

**Functies**:
- Ondersteunt **overnight bereiken** (bijv. `23:00-06:00` overspant middernacht)
- Maximum **30 tijdbereiken** per schema
- **Default fallback** ondersteuning (`default: waarde`)
- Komma of newline gescheiden invoer

#### Voorbeeld Flows

**Dagelijkse Temperatuur Programmering**:
```
ELKE 5 MINUTEN:
THEN: Bereken waarde van tijdschema
      Schema: 06:00-09:00: 22, 09:00-17:00: 19, 17:00-23:00: 21, 23:00-06:00: 18
  AND Stel doeltemperatuur in op {{result_value}}
```

**Tijd-van-Gebruik Optimalisatie**:
```
ELK UUR:
THEN: Bereken waarde van tijdschema
      Schema: 17:00-21:00: 2500, default: 4000
  AND Stel maximum vermogenslimiet in op {{result_value}}W
```

---

### 9. 🌡️ Ontvang Seizoensmodus

**ID**: `get_seasonal_mode`
**Categorie**: Seizoensgebonden Automatisering
**Doel**: Automatisch verwarming/koeling seizoen detecteren op basis van huidige datum

#### Overzicht

De seizoensmodus calculator biedt **automatische seizoensdetectie** afgestemd op de EN 14825 SCOP standaard. Perfect voor schakelen tussen winter en zomer schema's zonder handmatige interventie.

#### Configuratie

```yaml
ACTION: Ontvang seizoensmodus
  Retourneert 4 tokens:
    - {{mode}} - "heating" of "cooling"
    - {{is_heating_season}} - true/false
    - {{is_cooling_season}} - true/false
    - {{days_until_season_change}} - nummer
```

**Parameters**: Geen (gebruikt huidige datum)

**Retourneert**:
- `mode` (tekst): Huidige seizoensmodus ("heating" of "cooling")
- `is_heating_season` (boolean): True als 1 okt - 15 mei
- `is_cooling_season` (boolean): True als 16 mei - 30 sep
- `days_until_season_change` (nummer): Dagen tot volgend seizoen begint

#### Seizoen Definities

**Verwarmingsseizoen**: 1 oktober - 15 mei (227 dagen)
- Afgestemd op **EN 14825 SCOP standaard**
- Komt overeen met bestaande SCOP berekeningsperiode
- Typisch Europees verwarmingsseizoen

**Koelseizoen**: 16 mei - 30 september (138 dagen)
- Schouderseizoen + zomer
- Verminderde verwarmingsvraag periode

#### Voorbeeld Flows

**Automatisch Schema Schakelen**:
```
ELKE DAG om 00:00:
THEN: Ontvang seizoensmodus
  AND IF {{is_heating_season}} is true
    THEN: Schakel winterschema in (hoge temperaturen)
    ELSE: Schakel zomerschema in (lagere temperaturen)
```

**Seizoenswissel Notificatie**:
```
ELKE DAG om 09:00:
THEN: Ontvang seizoensmodus
  AND IF {{days_until_season_change}} < 7
    THEN: Stuur notificatie "Seizoen wisselt over {{days_until_season_change}} dagen"
```

---

### 10. 📊 Bereken Waarde van Curve

**ID**: `calculate_curve_value`
**Categorie**: Dynamische Optimalisatie
**Doel**: Bereken outputwaarden op basis van inputcondities met configureerbare curves

#### Overzicht

De curve calculator is een krachtige utility voor dynamische waardeberekeningen. Hoewel primair ontworpen voor **weersgecompenseerde verwarming** (buitentemperatuur → verwarming setpoint), is het veelzijdig genoeg voor elke input-output mapping scenario's.

#### Configuratie

```yaml
ACTION: Bereken waarde van curve
  Input Waarde: {{outdoor_temperature}}
  Curve Definitie: < 0 : 55, < 5 : 50, < 10 : 45, default : 35
  Retourneert: {{result_value}}
```

**Parameters**:
- `input_value` (nummer of expressie): De inputwaarde om te evalueren
- `curve` (tekst): Curve definitiestring (komma of newline gescheiden)

**Retourneert**:
- `result_value` (nummer): Berekende outputwaarde gebaseerd op curve

#### Curve Formaat

**Syntax**: `[operator] drempel : output_waarde`

**Ondersteunde Operators**:
- `>` - Groter dan
- `>=` - Groter dan of gelijk
- `<` - Kleiner dan
- `<=` - Kleiner dan of gelijk
- `==` - Gelijk aan
- `!=` - Niet gelijk aan
- `default` of `*` - Fallback waarde (komt altijd overeen, gebruik als laatste regel)

**Evaluatie Regels**:
1. Evalueert van **boven naar beneden**
2. Retourneert **eerste overeenkomende** conditie
3. Valt terug naar `default` als geen match (aanbevolen om altijd te includeren)
4. Maximum 50 invoeren per curve

#### Voorbeeld Flows

**Weersgecompenseerde Verwarming** (Primair Gebruik):
```
WHEN: Buitentemperatuur veranderd
THEN: Bereken waarde van curve
      Input: {{outdoor_temperature}}
      Curve: < -5 : 60, < 0 : 55, < 5 : 50, < 10 : 45, < 15 : 40, default : 35
  AND Stel doeltemperatuur in op {{result_value}}
```

**COP-Gebaseerde Dynamische Aanpassing**:
```
WHEN: COP veranderd
THEN: Bereken waarde van curve
      Input: {{adlar_cop}}
      Curve: < 2.0 : -5, < 2.5 : -3, >= 3.5 : +2, default : 0
  AND Pas doeltemperatuur aan met {{result_value}}°C
```

**Multi-Stage Verwarmingscurve**:
```
WHEN: Buitentemperatuur veranderd
THEN: Bereken waarde van curve
      Input: {{outdoor_temperature}}
      Curve:
        < -10 : 65
        < -5  : 60
        < 0   : 55
        < 5   : 50
        < 10  : 45
        < 15  : 40
        default : 35
  AND Stel verwarming setpoint in op {{result_value}}
```

#### Best Practices

**✅ DOE**:
- Voeg altijd `default : <waarde>` toe als laatste regel (voorkomt fouten)
- Gebruik newlines of komma's om regels te scheiden (beide ondersteund)
- Test je curve met verschillende inputs voor deployment
- Houd curves simpel (onder 20 invoeren aanbevolen)
- Documenteer je curve logica in flow beschrijving

**⚠️ DOE NIET**:
- Overschrijd 50 invoeren (harde limiet)
- Vergeet de default fallback (veroorzaakt fouten bij geen match)
- Mix verwarming/koeling logica in dezelfde curve (gebruik aparte flows)
- Negeer evaluatie volgorde (boven naar beneden is belangrijk!)

#### Foutmeldingen

| Foutmelding | Oorzaak | Oplossing |
|-------------|---------|-----------|
| `"Input value must be a valid number"` | Ongeldige input tag of null waarde | Controleer je input token/variabele |
| `"No matching curve condition found"` | Geen conditie matched en geen default | Voeg `default : <waarde>` toe als laatste regel |
| `"Invalid curve syntax at line N"` | Misvormde conditie | Check formaat: `operator drempel : waarde` |
| `"Curve exceeds maximum allowed entries (50)"` | Te veel regels in curve | Vereenvoudig curve of splits in meerdere flows |

---

## Instellingen Configuratie

### Vermogensdrempel Instelling

Om aangepaste vermogensdrempel te configureren:
1. Ga naar Apparaatinstellingen → Geavanceerd
2. Vind "Power Threshold (W)" instelling
3. Stel gewenste drempel in (100-10000W)
4. Standaard: 3000W

**Opmerking**: Als instelling niet bestaat, gebruikt trigger hardcoded default (3000W).

---

## Probleemoplossingsgids

### Algemene Problemen

**Flow cards niet zichtbaar in Homey app**:
1. Controleer app versie is 1.0.7 of hoger
2. Herstart Homey app
3. Check flow card instellingen: Apparaatinstellingen → Flow Card Control
4. Verzeker dat relevante capability data heeft (niet null)

**Triggers vuren maar flows voeren niet uit**:
1. Controleer flow is ingeschakeld (niet gepauzeerd)
2. Verifieer flow logica condities
3. Check Homey's flow uitvoerings logs
4. Test met simpele flow eerst (alleen notificatie)

**Voorwaarden retourneren altijd false**:
1. Controleer capability heeft geldige data (niet null/0)
2. Verifieer apparaat is operationeel (niet offline)
3. Check specifieke voorwaarde vereisten (bijv. compressor draait voor COP)
4. Schakel debug modus in en controleer logs

### Diagnostische Commando's

**Controleer capability waarden**:
```javascript
// In Homey Developer Tools → Device Capabilities
adlar_cop // Zou huidige COP moeten tonen
adlar_fault // Zou 0 (geen storing) of storingscode moeten tonen
measure_power // Zou huidig vermogen in watts moeten tonen
meter_power.electric_total // Zou cumulatieve kWh moeten tonen
```

**Controleer getriggerde mijlpalen**:
```javascript
// In Homey Developer Tools → Device Storage
triggered_energy_milestones // Array van getriggerde mijlpalen
```

---

## Best Practices

### Flow Ontwerp

**1. Gebruik Gepaste Granulariteit**:
- Real-time COP: Voor directe alarmen
- Dagelijkse COP: Voor dagelijkse rapporten
- Maandelijkse COP: Voor trendanalyse

**2. Combineer Voorwaarden**:
```
IF: COP onder 2.0
  AND Vermogen boven 3000W
  AND Draait > 15 minuten
THEN: Onderzoek (niet normaal om lage COP met hoog vermogen te hebben)
```

**3. Voeg Hysterese toe in Flows**:
```
WHEN: Vermogensdrempel overschreden
THEN: Wacht 5 minuten
  AND IF nog steeds boven drempel
    THEN Neem actie
```

**4. Log voor Analyse**:
```
WHEN: Elke efficiëntie trigger
THEN: Log naar Insights met alle relevante data
  - Timestamp
  - COP waarde
  - Buitentemperatuur
  - Vermogensverbruik
```

### Notificatie Beheer

**Voorkom Spam**:
- Gebruik rate limiting (ingebouwd voor vermogen/storing triggers)
- Voeg tijdgebaseerde condities toe (niet tussen 22:00-08:00)
- Combineer meerdere checks voor notificeren

**Prioriteer Alarmen**:
- Kritiek: Storingen, vermogen overbelasting → Directe notificatie
- Waarschuwing: Lage COP, hoog verbruik → Dagelijks overzicht
- Info: Mijlpalen, goede prestaties → Wekelijkse samenvatting

---
