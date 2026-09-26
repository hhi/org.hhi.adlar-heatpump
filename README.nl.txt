Bedien en monitor uw Adlar Castra Aurora-warmtepomp lokaal met Homey Pro.
Deze ene app ondersteunt twee verbindingsmethoden: de Tuya Local API en Modbus
RS485 via een Modbus TCP-gateway. Kies de apparaatdriver die bij uw installatie
past; beide werken via uw lokale netwerk zonder cloudverbinding voor dagelijks
gebruik.

🇬🇧 English  🇩🇪 Deutsch 🇫🇷 Français 🇳🇱 Nederlands

KIES EEN DRIVER

TUYA LOCAL API
- Kies "Adlar Castra Aurora Heat Pump (Tuya)"
- Vereist de Device ID, Local Key, het lokale IP-adres en de Tuya-
  protocolversie (3.3, 3.4 of 3.5) van de warmtepomp
- Gebruik deze driver voor een warmtepomp met wifi-verbinding

MODBUS TCP-GATEWAY
- Kies "Adlar Castra Aurora Heat Pump (Modbus)"
- Vereist een RS485/Modbus-aansluiting en een bereikbare Modbus TCP-gateway,
  zoals een Elfin EW11A
- Voer het IP-adres van de gateway, de TCP-poort en de Modbus Unit ID in
- De gebruikelijke standaardwaarden zijn poort 502 en Unit ID 1

BELANGRIJKSTE FUNCTIES
- Lokale temperaturen, bedrijfsstatus, ontdooien, antivries, sterilisatie en
  gedecodeerde storingsinformatie
- Metingen van vermogen, energie, spanning, stroom, compressor, ventilator,
  klep, pomp en waterflow wanneer de warmtepomp deze ondersteunt
- Bediening van aan/uit, bedrijfsmodus, setpunten voor verwarmen, koelen en
  warm water, en ondersteunde verwarmings- en warmwatercurven
- COP- en seizoensrendementsbewaking met beschikbare vermogens-,
  temperatuurverschil- en waterflowgegevens
- Homey Flow-kaarten voor meldingen, storingen, setpunten, externe gegevens en
  geavanceerde curve-, tijdschema- en seizoensberekeningen
- Optionele adaptieve temperatuurregeling, gebouwmodel-leren, energieprijs- en
  COP-optimalisatie en weersafhankelijk advies
- Geavanceerde lokale diagnose- en registertools voor Modbus-installaties

BELANGRIJK
- Geavanceerde Modbus-schrijftools kunnen het gedrag van de warmtepomp
  veranderen. Gebruik ze alleen als u het register kent en de oorspronkelijke
  waarde hebt genoteerd.
- De Modbus-driver is gericht op de R32-registermap en waarschuwt bij andere
  koudemiddelen.
- De COP kan ontbreken of minder nauwkeurig zijn als bruikbare vermogens- of
  flowgegevens ontbreken.
- Een vaste DHCP-lease of een statisch IP-adres voor de warmtepomp of gateway
  voorkomt onnodige herverbindingsproblemen.

DOCUMENTATIE

Op de broncodepagina staan installatie-, Flow-, COP-, stooklijn- en
geavanceerde regelingshandleidingen, inclusief de Modbus diagnose- en
dashboardgids: /docs/setup/MODBUS_DASHBOARD_GUIDE.nl.md.
Voor Tuya-koppeling: /docs/setup/Tuya_LocalKey_Homey_Guide_NL.pdf
en /docs/setup/PROTOCOL_VERSION_GUIDE.nl.md.
