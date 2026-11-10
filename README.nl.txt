Bedien en monitor uw Adlar Castra Aurora-warmtepomp lokaal met Homey Pro.
Deze app bevat drie drivers voor aansluiting via Tuya of Modbus.
De dagelijkse communicatie verloopt via uw lokale netwerk.

KIES UW DRIVER

Aurora I/II via Tuya
Voor een Aurora I/II met een Tuya-wifiverbinding. Vereist de Device ID, Local Key, het lokale IP-adres en de Tuya-protocolversie van de warmtepomp.
Lokaal dashboard: http://HOMEY-IP:8092

Aurora I/II via Modbus
Voor een Aurora I/II met een RS485/Modbus-aansluiting. Vereist een Modbus TCP-gateway. Bij het koppelen voert u het IP-adres van de gateway, de TCP-poort en de Modbus Unit ID in.
Lokaal dashboard: http://HOMEY-IP:8090

Aurora III via Modbus
Voor een Aurora III met een RS485/Modbus-aansluiting. Vereist een Modbus TCP-gateway en gebruikt de eigen Aurora III-registerindeling. Bij het koppelen voert u het IP-adres van de gateway, de TCP-poort en de Modbus Unit ID in.
Lokaal dashboard: http://HOMEY-IP:8091

Vervang HOMEY-IP door het lokale IP-adres van uw Homey Pro. De genoemde poorten zijn de standaardwaarden. Gebruik uw eigen poort als u deze heeft gewijzigd.

MONITORING EN BEDIENING

Bekijk temperaturen, bedrijfsstatus, storingen en beschikbare metingen van vermogen, energieverbruik en waterflow. Bedien aan/uit, bedrijfsmodus, setpunten en ondersteunde stooklijnkeuzes.

Gebruik Homey Flows voor bediening, meldingen en externe meetgegevens. Volg COP en seizoensrendement of gebruik de optionele adaptieve regeling, gebouwmodel-leren en energieprijs- en COP-optimalisatie.

Beschikbare metingen, instellingen en Flow-kaarten verschillen per model en driver. COP-berekeningen zijn afhankelijk van bruikbare vermogens-, temperatuur- en waterflowgegevens.

LOKALE DASHBOARDS

Alle drie de drivers bieden dashboardpagina's voor monitoring, bediening en diagnose.

Dashboard en Live tonen beschikbare waarden en bedrijfsstatus. Interactief biedt bediening van ondersteunde instellingen. Expert geeft een doorzoekbaar overzicht van datapunten of registers. Wijzigingen toont waarden en geregistreerde veranderingen. Stooklijn geeft inzicht in de beschikbare curve-instellingen en regeling.

Tuya toont DPS-datapunten. De Modbus-drivers tonen de registers van het betreffende warmtepompmodel. De beschikbare dashboardfuncties verschillen per driver.

INSTALLATIE

Kies bij het toevoegen van een apparaat de driver die overeenkomt met uw warmtepompmodel en aansluiting.

Voor Tuya zijn de lokale apparaatgegevens nodig. Voor Modbus moet de gateway vooraf correct zijn aangesloten en ingesteld. Raadpleeg de installatiehandleiding van uw model.

Een vast lokaal IP-adres of een DHCP-reservering voor de warmtepomp of gateway helpt verbindingsproblemen te voorkomen.

Geavanceerde schrijfbediening kan instellingen van de warmtepomp veranderen. Controleer de betekenis en noteer de oorspronkelijke waarde voordat u een instelling wijzigt.

DOCUMENTATIE

Via de broncodepagina vindt u handleidingen voor Tuya-koppeling, Modbus-aansluiting, gatewayconfiguratie, dashboards, Homey Flows, storingsdiagnose, COP, stooklijnen en adaptieve regeling.
