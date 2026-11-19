# Processchema: livegegevens en bronkeuze

De processchema’s voor Tuya, Aurora I/II en Aurora III tonen de Homey-COP en de daadwerkelijk
gekozen vermogensbron. De Modbus-snapshot bevat daarvoor dezelfde livegegevens als de
apparaatwidget. Externe Modbus-metingen verlopen volgens de bestaande TTL van één uur; een
expliciete nulmeting valt niet terug op een interne vermogensschatting.

Live bevat geen voorbeeldwaarden, voorbeeldhistorie of vaste bedrijfsstatussen. Een ontbrekende
waarde wordt als `—` weergegeven. Het historische tijdvak volgt de echte meetmomenten; ontbrekende
reeksen blijven leeg. Een stooklijn wordt alleen uit bekende parameters getekend. De schema-indeling
is een schematische voorstelling van het CV-circuit.

Het tarief van het huidige uur wordt weergegeven in €/kWh, inclusief nul- en negatieve tarieven.
‘Kosten nu’ is het actuele vermogen in kW maal dat tarief: een bedrag per uur bij gelijkblijvend
vermogen. Het is geen opgeteld uurverbruik. Een ontbrekend tarief blijft onbekend.

## Regressiescenario’s

- 17 L/min en 5 °C temperatuurverschil, intern 490 W en extern 1.420 W: de Homey-COP rond 4,18, het
  externe vermogen en de vermogensbron moeten overeenkomen. De oude interne COP 12,10 krijgt geen
  voorrang meer.
- De stroomkalibratie geldt uitsluitend voor de interne AC-sensoren; extern vermogen krijgt geen
  marnie-correctie.
- Externe Modbus-meting ouder dan één uur: interne bron kiezen. Nieuwe nulmeting: geen schatting als
  vervanging presenteren.
- Tarief wisselen tussen 0,30, 0,00, -0,10 en ontbrekend: bij 1,42 kW zijn de kosten
  achtereenvolgens 0,43, 0,00, -0,14 en onbekend in €/uur.
- Voor de eerste meting en zonder gekoppeld apparaat: waarden en grafieklijnen leeg, geen fictieve
  storingsvrije of uitgeschakelde toestand.
- Demo naar Live, vóór en na ontvangst van data: alleen in Demo voorbeeldgegevens; daarna
  ontbrekende series en parameters wissen.
- Geschiedenis met onregelmatige meetmomenten en ontbrekende sensoren: tijdas op werkelijke tijd,
  onderbrekingen in lijnen en geen voorbeeldcurves.
- Een ingestelde Tuya-appcurve of Aurora II-DIY-curve tekenen; verwijderen wanneer de parameters
  ontbreken.
- Bij stilstand, ontdooien, CV en tapwaterbedrijf de werkelijk beschikbare status controleren; geen
  status van een fysieke klep afleiden die niet wordt gemeten.

Geautomatiseerde controles: `test/unit/process-schema.test.js` en `test/unit/process-schema-
power.test.js`; bestaande driverspecifieke schematests blijven behouden. Een browsercontrole met
gesimuleerde data controleert tevens de leesbaarheid van het schema. Hardwaremetingen en de Shelly-
flow van de gebruiker zijn niet live gecontroleerd.

## COP-kwaliteitscontrole

Een afgekeurde of ontbrekende COP is onbekend (`null` / `—`), geen gemeten nul. De ruwe
berekening en de gebruikte meetwaarden blijven beschikbaar als `copDiagnostic` in de
snapshot en bij de COP-controle in het schema. Een bevestigde compressorstilstand blijft
een aparte toestand met COP 0. Afgekeurde waarden worden niet toegevoegd aan COP- of
SCOP-gemiddelden; het gebouwmodel slaat verwarmingsmetingen zonder geldige COP over.
De bestaande controlegrens van 8 is behouden.

## Altijd actieve energietracking

De oude instelling is verwijderd. Een oude opgeslagen waarde `false` schakelt tracking niet meer uit.
De bron is een actuele externe meting (ook 0 W), anders een actuele interne meting, anders onbekend.
De Homey-vermogenscapability en de widgets volgen diezelfde bronkeuze. Een externe meter kan blijven
meten terwijl de verbinding met de warmtepomp wegvalt. Interne meetwaarden worden alleen gebruikt
bij een actieve verbinding en een recente ontvangst. De vaste standby- en frequentieschatting is
verwijderd; een ontbrekende meting wordt niet als nul of fictief vermogen geboekt.

De telling integreert de vorige geldige vermogensmeting tot het volgende meetmoment. Nulmetingen
verzetten de meetcursor ook. Ontbrekende metingen, een herstart en onderbrekingen langer dan een
minuut breken de telperiode: de eerstvolgende waarde vult het gat niet achteraf op. Bestaande
levensduurtotalen blijven behouden. Dagtellers wisselen in de Homey-tijdzone. Zonder prijspunt
wordt geen kostentoename geboekt; 0 en negatieve tarieven zijn geldige prijspunten.

Regressies staan in `test/unit/measured-energy-tracking.test.js`: oude instelling op uit, herstart,
geen meting, nulmeting, extern meten zonder warmtepompverbinding, verlopen metingen, terugkeer van
data, gelijktijdige updates, prijsbeschikbaarheid en timeropruiming.

## Gelijke presentatie

De processchema’s gebruiken dezelfde themaknoppen (Dark, Light en Auto) rechts in de navigatiebalk.
De paginatitel en schematitel volgen `Adlar Aurora <model> (<protocol>) — Processchema`; Tuya
gebruikt de ingestelde paginataal. Tuya behoudt de apparaatnaam en taalkeuze als extra context.
Alle dashboardpagina’s verwijzen naar `/favicon.png`, dat een 32×32 PNG van het bestaande logo uit `assets/icon.svg`
van de betreffende app levert. Het browsericoon bevat geen storings- of apparaatnummer.

Browsercontrole: bij elke driver de drie themaknoppen in de navigatiebalk controleren, Dark/Light
en Auto omschakelen, browser- en schematitel vergelijken en `/favicon.png` op HTTP 200 met
`image/png` controleren. De kleuren en titels zijn met voorbeelddata gecontroleerd.
