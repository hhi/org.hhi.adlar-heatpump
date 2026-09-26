# Modbus TCP gateway setup voor Adlar Aurora II / Castra

*De app werkt met elke gateway die RS485 (Modbus RTU) naar Modbus TCP vertaalt — zoals de Elfin EW11A, USR-W610 of een Raspberry Pi met `mbusd`. Vereisten: TCP Server mode, poort `502`, half-duplex serieel op `9600 8N1`.*

Deze map bevat screenshots en aansluitbeelden voor de **Elfin EW11A** als voorbeeldgateway.

## Aansluiten

Schakel de warmtepomp spanningsloos voordat je de RS485-draden aansluit.

Gebruik de aansluitbeelden:

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

Gebruik de screenshots als referentie:

- [Serial Port Settings](<Elfin EW11 - Adlar Aurora 2/EW11 - serial port settings - Aurora II series.png>)
- [Communication Settings](<Elfin EW11 - Adlar Aurora 2/EW11 - communication settngs - Aurora II series.png>)
- [System Settings](<Elfin EW11 - Adlar Aurora 2/EW11 - system settings - Aurora II series.png>)

## Wifi-verbinding

Voordat je de EW11 kunt configureren, moet je eerst verbinding maken met het Wifi-netwerk van de EW11:

1. Selecteer het Wifi-netwerk `EW11_xxxx` (waarbij `xxxx` afhankelijk is van de identificatie van jouw Elfin)
2. De EW11 is bereikbaar op het IP-adres `10.10.100.254`
3. Stel de Wifi-mode in op `AP+STA` zodat de EW11 onder een eigen lokaal IP-adres bereikbaar is
4. **Belangrijk:** Stel een statisch IP-adres in. Dit is nodig voor configuratie en voor gebruik door de Homey app.


### Aanbevolen instellingen voor Aurora I en II series 

| Onderdeel | Instelling |
|---|---|
| Serial baud rate | `9600` |
| Data bits | `8` |
| Stop bits | `1` |
| Parity | `None` |
| Flow control | `Half Duplex` |
| Serial protocol | `Modbus` |
| TCP mode | `TCP Server` |
| Local port | `502` |
| Route | `UART` |
| Web interface | enabled, port `80` |

Netwerk:

- geef de EW11A bij voorkeur een vast IP-adres of DHCP-reservering
- noteer dit IP-adres voor het koppelen in Homey
- gebruik in Homey poort `502`
- gebruik Modbus Unit ID `1`, tenzij de warmtepomp anders is ingesteld

## Koppelen in Homey

Vul bij het toevoegen van het apparaat in Homey in:

- IP-adres van de EW11A
- TCP-poort `502`
- Modbus Unit ID `1`

Bij verbindingsproblemen:

1. controleer voeding en netwerkbereikbaarheid van de EW11A;
2. controleer TCP Server / poort `502`;
3. controleer seriele instellingen: `9600`, `8N1`, parity `None`;
4. controleer Modbus Unit ID;
5. wissel RS485 `A/B` als alle instellingen kloppen maar er geen antwoord komt.

## Dashboards openen

Als de app draait, start Homey een lokale dashboardserver. De standaardpoort is `8090`; deze poort is instelbaar via de device setting `Dashboardpoort`.

Open vanaf een apparaat op hetzelfde lokale netwerk:

| URL | Doel |
|---|---|
| `http://<homey-ip>:8090/` | Live read-only dashboard met actuele warmtepompwaarden |
| `http://<homey-ip>:8090/interactive` | Interactief dashboard voor veelgebruikte bediening |
| `http://<homey-ip>:8090/expert` | Expertdashboard met Modbus-adressen, P/L-parameter-ID's en live lees-/schrijftools |
| `http://<homey-ip>:8090/heating-curve` | Editor voor de DIY-stooklijn |

Vervang `<homey-ip>` door het IP-adres van je Homey Pro.
Als je de dashboardpoort hebt aangepast, vervang `8090` door de ingestelde poort.

Als de pagina niet opent:

1. controleer of Homey en je browser op hetzelfde netwerk zitten;
2. controleer het IP-adres van Homey;
3. herstart de app of het apparaat als de dashboardserver nog niet gestart is;
4. controleer of poort `8090` niet geblokkeerd wordt.

Gebruik het expertdashboard zorgvuldig: schrijfbare Modbus-registers kunnen het gedrag van de warmtepomp wijzigen.
