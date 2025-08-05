# Installatiehandleiding voor Adlar Warmtepomp App - voor lokale executie

## Vereisten

Zorg ervoor dat je het volgende hebt voordat je de app installeert:

### Software Vereisten

- **Node.js** (versie 16 of hoger) - Download van [nodejs.org](https://nodejs.org/)
- **Homey CLI** - Installeer met: `npm install -g homey`
- **Bestand extractie software** (ingebouwd op de meeste systemen)

### Account & Apparaat Vereisten

- **Homey Pro apparaat** verbonden met je netwerk
- **Athom account** (hetzelfde account gebruikt voor je Homey)
- **Netwerkverbinding** tussen je computer en Homey apparaat

### Warmtepomp Gegevens (Vereist voor Apparaat Koppeling)

Je hebt deze gegevens nodig van je warmtepomp setup:

- **Apparaat ID** - Te vinden in Tuya/Smart Life app apparaatinstellingen
- **Local Key** - Zie `docs/Get Local Keys - instruction.pdf` voor gedetailleerde instructies
- **IP Adres** - Zoek naar "Nest Labs -WP" of vergelijkbaar in je router app

## Installatiestappen

### 1. Installeer en Configureer Homey CLI

1. **Installeer Node.js** van [nodejs.org](https://nodejs.org/) als nog niet geïnstalleerd
   - **Voor Mac gebruikers**: Je kunt ook installeren via Homebrew: `brew install node`

2. **Installeer Homey CLI**:

   ```bash
   npm install -g homey
   ```

3. **Verifieer installatie**:

   ```bash
   homey --version
   ```

4. **Log in op je Homey account**:

   ```bash
   homey login
   ```

### 2. Download en Pak de App uit

1. **Download de App**
   - Ga naar de [GitHub Releases pagina](https://github.com/hhi/org.hhi.adlar-heatpump/releases)
   - Download het **ZIP bestand** van release **v0.80.2**

2. **Pak het ZIP bestand uit**
   - Pak uit naar een gemakkelijk toegankelijke locatie (bijv. Bureaublad of Downloads map)
   - Onthoud het extractiepad voor de volgende stappen

### 3. Installeer de App

1. **Open terminal/opdrachtprompt**
2. **Navigeer naar de uitgepakte map**:

   ```bash
   cd pad/naar/uitgepakte/map
   ```

3. **Installeer dependencies** (uit package.json):

   ```bash
   npm install
   ```

4. **Installeer de app op je Homey**:

   ```bash
   homey app install
   ```

5. **Selecteer je Homey apparaat** indien gevraagd
6. **Wacht tot de installatie voltooid is**

## Apparaat Koppeling en Beheer

### Voeg je Warmtepomp toe

1. **Open de Homey app** op je telefoon
2. **Ga naar**: "Apparaten" → "Apparaat Toevoegen"
3. **Zoek naar**: "Adlar Heat Pump"
4. **Volg de koppelingsassistent** en voer in:
   - Apparaat ID (uit Tuya/Smart Life app)
   - Local Key (zie `docs/Get Local Keys - instruction.pdf`)
   - IP Adres (zoek naar "Nest Labs - WP" in router)

### Gebruik van Homey Developer Tools (Na Installatie)

Zodra de app geïnstalleerd is en je apparaat gekoppeld is, kun je live waarden monitoren:

1. **Bezoek**: [https://tools.developer.homey.app/tools/devices](https://tools.developer.homey.app/tools/devices)
2. **Voer zoekterm in**: `adlar`
3. **Bekijk real-time apparaatgegevens** en mogelijkheden

### Belangrijke Opmerkingen

- **Verwarmingscurve Keuzelijst**: De verwarmingscurve selectie is uitgeschakeld vanwege een bug die wordt waargenomen op iPhone apparaten. Om verwarmingscurve waarden te wijzigen, gebruik de speciale actie flow card.
- **Flow Cards**: De meeste apparaatinstellingen kunnen worden beheerd via Homey's flow cards voor automatiseringsdoeleinden.

### Verkrijgen van Vereiste Gegevens

#### Apparaat ID

- Open **Tuya/Smart Life app**
- Navigeer naar je warmtepomp apparaat
- Ga naar apparaatinstellingen → Apparaat Informatie
- Kopieer het Apparaat ID

#### Local Key

- **Gedetailleerde Instructies**: Zie `docs/Get Local Keys - instruction.pdf` voor complete stap-voor-stap handleiding
- Registreer bij [Tuya Developer Portal](https://iot.tuya.com/)
- Maak een project aan en koppel je apparaat
- Haal de Local Key uit de apparaatdetails

#### IP Adres

- Controleer je **router's admin panel** voor verbonden apparaten
- Zoek specifiek naar **"Nest Labs -WP"** of vergelijkbare apparaatnaam
- Gebruik een **netwerkscanner app** om Tuya apparaten te vinden indien nodig
- Zoek naar apparaten met "Tuya" of het MAC-adres van je warmtepomp

## Probleemoplossing

### Installatieproblemen

- **CLI niet gevonden**: Zorg ervoor dat Node.js en Homey CLI goed geïnstalleerd zijn
- **Authenticatie mislukt**: Voer `homey login` opnieuw uit en verifieer gegevens
- **Installatie timeout**: Controleer netwerkverbinding naar Homey apparaat
- **Rechten fouten**: Voer terminal uit als administrator (Windows) of gebruik `sudo` (macOS/Linux)

### Apparaat Koppelingsproblemen

- **Apparaat niet gevonden**: Verifieer IP adres en netwerkverbinding
- **Authenticatie mislukt**: Controleer Apparaat ID en Local Key nogmaals
- **Verbinding timeout**: Zorg ervoor dat warmtepomp en Homey op hetzelfde netwerk zijn
- **Ongeldige gegevens**: Verkrijg gegevens opnieuw van Tuya platform

### Algemene Problemen

- **App verschijnt niet**: Herstart Homey app en controleer geïnstalleerde apps lijst
- **Updates nodig**: Herhaal installatieproces met nieuwere releases
- **Netwerkproblemen**: Zorg voor stabiele verbinding tussen alle apparaten

## Verificatie

Na succesvolle installatie:

1. **Controleer Homey app** - De Adlar Heat Pump app zou moeten verschijnen in je apps lijst
2. **Verifieer apparaatverbinding** - Warmtepomp zou online status moeten tonen
3. **Test basis functies** - Probeer temperatuurwaarden te lezen of instellingen te wijzigen

## Ondersteuning

Voor extra hulp:

- **GitHub Issues**: [Rapporteer problemen hier](https://github.com/hhi/org.hhi.adlar-heatpump/issues)
- **Homey Community**: Zoek naar bestaande oplossingen of stel vragen
- **Documentatie**: Bekijk de app's README en documentatiebestanden
