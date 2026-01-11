# Flow Card Setup Snelgids

## Overzicht

De Adlar Warmtepomp kan externe meetgegevens ontvangen van andere Homey apparaten via flow cards om de nauwkeurigheid van COP berekeningen te verbeteren. Dit creëert een direct data-uitwisselingssysteem waarbij externe sensoren automatisch hun metingen naar de warmtepomp sturen.

**Service Architectuur (v0.99.23+)**: Externe data integratie wordt beheerd door de **EnergyTrackingService** en verwerkt door de **COPCalculator** service voor verbeterde efficiëntieberekeningen.

![Externe Vermogensmeting Setup](/docs/COP%20calculation/COP%20-%20external%20power%20measure.png)

## Vereiste vs Optionele Componenten

### ✅ **Vereiste Componenten**

- **WHEN Kaart**: Externe apparaat trigger (bijv. "Het vermogen is veranderd")
- **THEN Kaart**: Verstuur data actie (bijv. "Verstuur vermogensdata naar warmtepomp")
- **Data Verbinding**: Meetwaarde moet worden doorgegeven van trigger naar actie

### ⚠️ **Optionele Componenten**

- **AND Voorwaarden**: Voeg betrouwbaarheidscontroles toe (apparaat online, data geldig, etc.)
- **ELSE Acties**: Foutafhandeling en notificaties

## ⚠️ Belangrijk: Data Versheid

**Externe apparaten sturen data wanneer hun metingen veranderen.** De **EnergyTrackingService** van de warmtepomp bewaart de meest recente data ontvangen binnen de laatste 5 minuten. De **COPCalculator** service gebruikt deze gecachede data voor COP berekeningen. Frequentere updates resulteren in nauwkeurigere COP berekeningen.

**Service Timeout**: Externe data verzoeken verlopen na 5 seconden (`DeviceConstants.EXTERNAL_DEVICE_QUERY_TIMEOUT_MS`), configureerbaar in apparaatinstellingen.

## Basis Setup (Directe Data Uitwisseling)

### Stap 1: Maak Externe Data Flow

#### WHEN (Trigger)

- [Jouw Vermogensmeter] Het vermogen is veranderd
- Apparaat: Jouw externe vermogensmeter (bijv. "Warmtepomp kWh - Meterkast")

#### THEN (Actie)

- Verstuur vermogensdata naar warmtepomp voor COP berekening
- Apparaat: [Jouw Warmtepomp] (bijv. "Intelligent Heat Pump - Huis")
- power_value: `{{power}}` *(van trigger token - huidige meting)*

Deze flow stelt externe vermogensmeters in staat om automatisch hun metingen te delen met het warmtepomp apparaat, wat nauwkeurigere COP berekeningen mogelijk maakt met werkelijk gemeten vermogensverbruik.

## Uitgebreide Setup (Met AND Voorwaarden)

### WHEN (Uitgebreide Trigger)

- [Jouw Vermogensmeter] Het vermogen is veranderd

### AND *(Optioneel maar Aanbevolen)*

- Slimme meter is beschikbaar
- Vermogensmeting > 0W EN < 50000W
- Vermogensmeting verschilt van vorige waarde

### THEN (Uitgebreide Actie)

- Verstuur vermogensdata naar warmtepomp voor COP berekening

### ELSE *(Optionele Foutafhandeling)*

- Stuur notificatie: "Ongeldige vermogensdata gedetecteerd"

## Ondersteunde Datatypes

| Type | Externe Apparaat Trigger | Warmtepomp Actie Kaart | Data Veld |
|------|--------------------------|------------------------|-----------|
| Vermogen | Apparaat vermogensmeting is veranderd | `receive_external_power_data` | `power_value` (W) |
| Debiet | Apparaat debietmeting is veranderd | `receive_external_flow_data` | `flow_value` (L/min) |
| Temperatuur | Apparaat temperatuur is veranderd | `receive_external_ambient_data` | `temperature_value` (°C) |

## Veelvoorkomende Problemen & Oplossingen

### ❌ "Externe data wordt niet gebruikt"

**Oorzaak**: Flow triggert niet of data bereikt warmtepomp niet
**Oplossingen**:

- Controleer of flow is ingeschakeld en werkt
- Verifieer dat extern apparaat online is en data rapporteert
- Test flow handmatig om te verzekeren dat actiekaart wordt uitgevoerd

### ❌ "Datawaarden lijken incorrect"

**Oorzaak**: Verkeerde token of meeteenheid mismatch
**Oplossingen**:

- Verifieer dat correcte trigger token wordt gebruikt (bijv. `{{power}}` voor vermogensmetingen)
- Controleer of meeteenheden overeenkomen met verwachte waarden (W voor vermogen, L/min voor debiet, °C voor temperatuur)

### ❌ Data niet gebruikt in COP berekening

**Oorzaak**: Ongeldige datawaarden of late responses
**Oplossingen**:

- Zorg voor realistische databereiken (vermogen: 100-50000W)
- Controleer apparaatlogs op validatiefouten
- Test handmatige flow uitvoering

## Service Architectuur Integratie (v0.99.23+)

### Hoe Externe Data Door Services Stroomt

1. **Flow Trigger**: Extern apparaat (vermogensmeter, debietsensor) triggert Homey flow
2. **Flow Actie**: Gebruikersflow voert "Verstuur [datatype] naar warmtepomp" actiekaart uit
3. **EnergyTrackingService**: Ontvangt en valideert externe data (bereikcontroles, null validatie)
4. **Data Caching**: EnergyTrackingService bewaart data met timestamp (5 minuten TTL)
5. **COPCalculator Verzoek**: Wanneer COP berekening draait, vraagt EnergyTrackingService om verse data
6. **Methode Selectie**: COPCalculator upgradet automatisch naar hogere nauwkeurigheidsmethode indien externe data beschikbaar
7. **COP Berekening**: Gebruikt externe data in Direct Thermal methode (±5% nauwkeurigheid)
8. **Event Emissie**: COPCalculator emit `cop-calculated` event met resultaat
9. **RollingCOPCalculator**: Abonneert op event, voegt datapunt toe aan tijdreeks buffer
10. **Device Publicatie**: Bijgewerkte COP waarden gepubliceerd naar Homey capabilities

**Voordelen Service Coördinatie**:

- **Automatische Methode Selectie**: COPCalculator service kiest automatisch beste methode op basis van beschikbare data
- **Data Validatie**: EnergyTrackingService valideert externe data voor gebruik
- **Service Isolatie**: Externe data afhandeling geïsoleerd van berekeningslogica
- **Event-Driven**: Services communiceren via events, geen strakke koppeling

## Voordelen per Datatype

### Vermogensdata Integratie

- **Nauwkeurigheid**: ±5% vs ±30% met interne schattingen
- **Methode**: Upgradet naar "Direct Thermal" berekening (COPCalculator Methode 1)
- **Service**: EnergyTrackingService bewaart externe vermogensdata
- **Vereisten**: Slimme meter met realtime vermogensmetingen
- **Setup**: Externe vermogensmeter → "vermogen veranderd" trigger → "Verstuur vermogensdata naar warmtepomp" actie (verwerkt door EnergyTrackingService)

### Debietdata Integratie

- **Nauwkeurigheid**: ±8% thermische berekeningen
- **Methode**: Maakt nauwkeurige warmteoverdracht berekeningen mogelijk (COPCalculator Methodes 1-3)
- **Service**: EnergyTrackingService cachet debietmetingen
- **Vereisten**: Waterdebiet sensor in verwarmingscircuit

### Temperatuurdata Integratie

- **Nauwkeurigheid**: ±12% omgevingscompensatie
- **Methode**: Betere weersaangepaste efficiëntie (COPCalculator Methode 5: Carnot Schatting)
- **Service**: EnergyTrackingService valideert omgevingstemperatuur data
- **Vereisten**: Buitentemperatuur sensor

## Testen van Je Setup

1. **Handmatige Test**: Trigger je extern apparaat om nieuwe metingen te genereren
2. **Controleer Flow**: Verifieer dat flow uitvoert wanneer externe apparaat data verandert
3. **Controleer Logs**: Warmtepomp logs tonen inkomende externe data (EnergyTrackingService logs)
4. **Verifieer Data**: Externe data verschijnt in warmtepomp diagnostiek ("External Power Measurement" capability)
5. **Monitor COP Methode**: Controleer `adlar_cop_method` capability - moet "Direct Thermal" tonen bij gebruik van externe vermogensdata
6. **Service Gezondheid**: Gebruik apparaatinstellingen diagnostiek om te verifiëren dat EnergyTrackingService recente externe data heeft

**Service Diagnostiek** (Apparaatinstellingen → Capability Diagnostics):

- **EnergyTrackingService status**: Toont externe data beschikbaarheid en timestamps
- **COPCalculator methode**: Toont huidige berekeningsmethode en waarom deze is geselecteerd
- **Data versheid**: Geeft tijd aan sinds laatste externe data ontvangen

De **COPCalculator service** kiest automatisch de beste berekeningsmethode op basis van beschikbare databronnen, waarbij externe data de meest nauwkeurige COP berekeningen mogelijk maakt (Direct Thermal ±5%).
