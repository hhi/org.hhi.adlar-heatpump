# Modbus TCP gateway setup voor Adlar Castra Aurora II en Aurora III

*De app werkt met elke gateway die RS485 (Modbus RTU) naar Modbus TCP vertaalt — zoals de Elfin EW11A, USR-W610 of een Raspberry Pi met `mbusd`. Vereisten: TCP Server mode, half-duplex serieel op `9600` baud. Aurora I/II gebruikt `8N1`, Aurora III / PRO `8N2`.*

Deze gids gebruikt de **Elfin EW11A** als voorbeeldgateway en geldt voor beide Modbus-modellen. Waar de modellen verschillen, staat dat per model aangegeven.

## Welk model heb je?

Kies in Homey de driver die past bij het model op het typeplaatje van de warmtepomp:

| Model | Driver in Homey | Seriële instelling | Dashboardpoort |
|---|---|---|---|
| Aurora I / II | *Adlar Castra Aurora II Heat Pump (Modbus)* | `9600 8N1` | `8090` |
| Aurora III / PRO | *Adlar Castra Aurora III Heat Pump (Modbus)* | `9600 8N2` | `8091` |

Met de verkeerde driver of de verkeerde seriële instelling komt er geen bruikbare verbinding, zonder duidelijke foutmelding.

## Aansluiten

Schakel de warmtepomp spanningsloos voordat je de RS485-draden aansluit.

Gebruik de aansluitbeelden (gelijk voor beide modellen):

- [Elfin EW11 overzicht](<Elfin EW11 - Adlar Aurora 2/elfin-ew11a-485-rs485-naar-ethernet-wifi.jpg>)
- [USB 5V voeding rood/zwart](<Elfin EW11 - Adlar Aurora 2/usb2-5v-rood-zwart.pdf>)
- [Elfin EW11 aansluiting zijkant](<Elfin EW11 - Adlar Aurora 2/Elfin EW11 aansluiting zijkant.pdf>)

Algemene RS485-regel:

- RS485 `A/+` van de warmtepomp naar `A/+` op de EW11A (linker connector op afbeelding)
- RS485 `B/-` van de warmtepomp naar `B/-` op de EW11A (rechter connector op afbeelding)
- gebruik bij voorkeur een getwist aderpaar
- houd de RS485-kabel weg van 230V-bekabeling
- sluit `GND` alleen aan als de warmtepompdocumentatie of gateway dit voorschrijft

Als er geen Modbus-verbinding komt, controleer dan eerst of `A/B` niet omgewisseld moet worden. RS485-labels worden in de praktijk niet altijd consequent gebruikt.

## EW11A configuratie

Gebruik de screenshots van jouw model als referentie:

| Scherm | Aurora I / II | Aurora III / PRO |
|---|---|---|
| Serial Port Settings | [Aurora II](<Elfin EW11 - Adlar Aurora 2/EW11 - serial port settings - Aurora II series.png>) | [Aurora III](<Elfin EW11 - Adlar Aurora 3/EW11 - serial port settings - Aurora III.png>) |
| Communication Settings | [Aurora II](<Elfin EW11 - Adlar Aurora 2/EW11 - communication settngs - Aurora II series.png>) | [Aurora III](<Elfin EW11 - Adlar Aurora 3/EW11 - communication settngs - Aurora III.png>) |
| System Settings | [Aurora II](<Elfin EW11 - Adlar Aurora 2/EW11 - system settings - Aurora II series.png>) | [Aurora III](<Elfin EW11 - Adlar Aurora 3/EW11 - system settings - Aurora III.png>) |

## Wifi-verbinding

Voordat je de EW11 kunt configureren, moet je eerst verbinding maken met het Wifi-netwerk van de EW11:

1. Selecteer het Wifi-netwerk `EW11_xxxx` (waarbij `xxxx` afhankelijk is van de identificatie van jouw Elfin)
2. De EW11 is bereikbaar op het IP-adres `10.10.100.254`
3. Stel de Wifi-mode in op `AP+STA` zodat de EW11 onder een eigen lokaal IP-adres bereikbaar is
4. **Belangrijk:** Stel een statisch IP-adres in. Dit is nodig voor configuratie en voor gebruik door de Homey app.

### Aanbevolen instellingen

| Onderdeel | Aurora I / II | Aurora III / PRO |
|---|---|---|
| Serial baud rate | `9600` | `9600` |
| Data bits | `8` | `8` |
| Stop bits | `1` | `2` |
| Parity | `None` | `None` |
| Flow control | `Half Duplex` | `Half Duplex` |
| Serial protocol | `Modbus` | `Modbus` |
| TCP mode | `TCP Server` | `TCP Server` |
| Local port | `502` | `502` |
| Route | `UART` | `UART` |
| Web interface | enabled, port `80` | enabled, port `80` |

`Serial protocol` moet op `Modbus` staan: de EW11A vertaalt dan Modbus TCP naar Modbus RTU. Bij Aurora III is vastgesteld dat de app met `None` (transparant) geen geldige antwoorden krijgt; houd voor Aurora II dezelfde instelling aan.

Netwerk:

- geef de EW11A bij voorkeur een vast IP-adres of DHCP-reservering
- noteer dit IP-adres voor het koppelen in Homey
- gebruik in Homey dezelfde poort als `Local port` in de EW11A; deze gids gebruikt `502`
- gebruik Modbus Unit ID `1`, tenzij de warmtepomp anders is ingesteld

## Koppelen in Homey

Kies de driver van jouw model (zie de tabel bovenaan) en vul in:

- IP-adres van de EW11A
- TCP-poort `502` (gelijk aan `Local port` van de EW11A)
- Modbus Unit ID `1`

Bij verbindingsproblemen:

1. controleer of je de driver van het juiste model hebt gekozen;
2. controleer voeding en netwerkbereikbaarheid van de EW11A;
3. controleer TCP Server, `Serial protocol` = `Modbus` en dat de poort in Homey gelijk is aan `Local port`;
4. controleer de seriële instellingen: `9600`, parity `None`, `8N1` (Aurora I/II) of `8N2` (Aurora III);
5. controleer Modbus Unit ID;
6. wissel RS485 `A/B` als alle instellingen kloppen maar er geen antwoord komt.

## Dashboards openen

Als er een Modbus-apparaat gekoppeld is, start Homey een lokale dashboardserver per model: standaard poort `8090` voor Aurora II en `8091` voor Aurora III. De poort is per apparaat instelbaar via de device setting `Dashboardpoort`.

Open vanaf een apparaat op hetzelfde lokale netwerk (`<poort>` = `8090` of `8091`):

| URL | Doel | Aurora II | Aurora III |
|---|---|---|---|
| `http://<homey-ip>:<poort>/` | Live read-only dashboard met actuele warmtepompwaarden | ✓ | ✓ |
| `http://<homey-ip>:<poort>/interactive` | Interactief dashboard voor veelgebruikte bediening; bij Aurora III ook tapwaterfunctie, stille modus, bijverwarming en (experimenteel) aan/uit | ✓ | ✓ |
| `http://<homey-ip>:<poort>/live` | Live capability-dashboard met status, setpoints, sensoren en diagnostiek | ✓ | ✓ |
| `http://<homey-ip>:<poort>/expert` | Expertdashboard met Modbus-adressen en live lees-/schrijftools | ✓ | ✓ |
| `http://<homey-ip>:<poort>/changelog` | Register Change Log met wijzigingsstatistieken per Modbus-register | ✓ | ✓ |
| `http://<homey-ip>:<poort>/heating-curve` | Editor voor de DIY-stooklijn | ✓ | — |

Vervang `<homey-ip>` door het IP-adres van je Homey Pro.

Als de pagina niet opent:

1. controleer of Homey en je browser op hetzelfde netwerk zitten;
2. controleer het IP-adres van Homey en de poort van jouw model;
3. herstart de app of het apparaat als de dashboardserver nog niet gestart is;
4. controleer of de poort niet geblokkeerd wordt of al door iets anders gebruikt wordt.

Gebruik het expertdashboard zorgvuldig: schrijfbare Modbus-registers kunnen het gedrag van de warmtepomp wijzigen. De dashboards hebben geen wachtwoord; iedereen op het lokale netwerk kan ze openen.
