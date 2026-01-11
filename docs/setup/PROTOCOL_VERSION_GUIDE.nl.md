# Protocol Versie Probleemoplossingsgids

## Voor Gebruikers met ECONNRESET of Verbindingsproblemen

Als je regelmatig verbindingsresets, disconnecties, of het apparaat onbeschikbaar wordt ervaart, kan het probleem worden veroorzaakt door een **protocol versie mismatch** tussen de app en je warmtepomp apparaat.

### Symptomen van Protocol Versie Mismatch

- ✗ Regelmatige "ECONNRESET" fouten in logs
- ✗ Apparaat verbindt constant opnieuw (status toont "reconnecting")
- ✗ Apparaat wordt herhaaldelijk onbeschikbaar
- ✗ Verbinding werkt kort dan faalt
- ✗ App lijkt te crashen of reageert niet meer

### Hoe te Repareren: Update Je Protocol Versie

#### Stap 1: Bepaal de Protocol Versie van Je Apparaat

De meeste Adlar/Castra warmtepompen gebruiken protocol versie **3.3** (standaard), maar sommige nieuwere modellen vereisen **3.4** of **3.5**.

**Als je niet zeker weet welke versie je apparaat gebruikt:**
- Controleer je apparaat handleiding of specificaties
- Neem contact op met Adlar support met je apparaat modelnummer
- Probeer de versies in volgorde: 3.4 eerst (meest voorkomende alternatief), dan 3.5

#### Stap 2: Update Protocol Versie in Apparaatinstellingen

1. **Open de Homey app** op je telefoon/tablet
2. **Navigeer naar je warmtepomp apparaat**
3. **Tik op het instellingen (tandwiel) icoon** rechtsboven
4. **Scroll naar boven** naar de verbindingsinstellingen sectie
5. **Werk je apparaatgegevens bij:**
   - **Protocol Versie** ← **SELECTEER HIER DE JUISTE VERSIE**
     - Probeer **3.4** als je verbindingsproblemen hebt
     - Probeer **3.5** als 3.4 niet werkt
   - Device ID (behoud hetzelfde of update indien nodig)
   - Local Key (behoud hetzelfde of update indien nodig)
   - IP-adres (behoud hetzelfde of update indien nodig)
6. **Tik op "Opslaan"** en wacht op herverbinding

#### Stap 3: Verifieer de Verbinding

Na het bijwerken van instellingen:
- Controleer de apparaatstatus - zou "connected" moeten tonen binnen 1-2 minuten
- Controleer de verbindingsstatus capability: `adlar_connection_status`
- Monitor 10-15 minuten om stabiele verbinding te verzekeren
- Als je nog steeds problemen hebt, probeer een andere protocol versie

### Protocol Versie Referentie

| Versie | Veelvoorkomend Gebruik |
|--------|------------------------|
| **3.3** | Oudere Adlar/Aurora modellen (STANDAARD) |
| **3.4** | Nieuwere Adlar modellen, meest voorkomende alternatief |
| **3.5** | Nieuwste modellen, minder voorkomend |

### Succes Indicatoren

✓ Verbindingsstatus toont "connected" en blijft verbonden
✓ Geen ECONNRESET fouten in logs
✓ Sensordata updatet regelmatig (elke 20-30 seconden)
✓ Apparaatcommando's werken direct
✓ Geen "unavailable" berichten

### Nog Steeds Problemen?

Als je alle drie protocol versies hebt geprobeerd en nog steeds verbindingsproblemen hebt:

1. **Verifieer netwerkconnectiviteit:**
   - Warmtepomp heeft stabiele WiFi/LAN verbinding
   - Homey kan het IP-adres van de warmtepomp bereiken
   - Geen firewall die communicatie blokkeert

2. **Controleer apparaatgegevens:**
   - Device ID is correct
   - Local Key is niet veranderd
   - IP-adres is actueel (niet veranderd via DHCP)

3. **Neem contact op met support:**
   - Deel welke protocol versies je hebt geprobeerd
   - Deel foutlogs van Homey
   - Geef je apparaat modelnummer

## Voor Nieuw Apparaat Pairen

Bij het pairen van een nieuw apparaat zie je nu de protocol versie dropdown:

1. Voer Device ID, Local Key en IP-adres in
2. **Selecteer Protocol Versie:**
   - **3.3 (Standaard)** - Begin hier voor de meeste apparaten
   - **3.4** - Probeer als 3.3 verbindingsproblemen heeft
   - **3.5** - Probeer als 3.4 verbindingsproblemen heeft
3. Ga verder met pairen

**Tip:** Als je niet zeker weet, begin met 3.3. Je kunt het later altijd wijzigen in apparaatinstellingen.

## Technische Achtergrond

De Tuya protocol versie bepaalt hoe de app communiceert met je apparaat op netwerkniveau. Het gebruik van de verkeerde versie veroorzaakt:
- Misvormde netwerkpakketten
- Socket verbindingsfouten (ECONNRESET)
- Authenticatiefouten
- Datacorruptie

Verschillende warmtepomp modellen/firmware versies vereisen verschillende protocol versies. Er is geen schade bij het proberen van verschillende versies - update gewoon de protocol versie in apparaatinstellingen om te wisselen.
