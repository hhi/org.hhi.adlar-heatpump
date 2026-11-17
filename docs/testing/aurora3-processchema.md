# Aurora III-processchema

Open `http://<homey-ip>:8091/processchema` (of de ingestelde dashboardpoort).
De pagina gebruikt Aurora III-inputregisters via FC04 en de bestaande snapshot-API.

## Automatische controles

- `npm test`: registermapping, pagina en gedeelde assets, eenheden, ontbrekende
  sensoren, pomp-/klepstatus en omschakelen tussen Demo en Live.
- `npm run lint` en `homey app validate`.

## Handmatige regressie op Homey

1. Vergelijk aanvoer TA (3-43), retour TE1 (3-42), buitenlucht T4 (3-50),
   buitenwisselaar T3 (3-49), persgas TP (3-52) en zuiggas TH (3-53) met `/expert`.
2. Controleer dat een geschaalde waarde van 1,2 m³/h uit 3-64 als 20,0 L/min
   verschijnt. Met een externe debietmeter volgt het schema het effectieve debiet
   uit de COP-snapshot, inclusief de bestaande geldigheidsduur van die meting.
3. Vergelijk HD/LD (3-86/87) in kPa, buffer TW (3-45) en totale aanvoer TC (3-41).
   De bestaande registerdefinities bevatten nog hardwarevragen over onder meer
   druk- en debietschaling; deze wijziging past de transportschaling niet aan.
4. Controleer hoofdpomp (3-80), pomp-PWM (3-62) en omkeerklep (3-81). Bij alleen
   pompcirculatie staat de compressoranimatie stil. Klepwaarde 0 toont Verwarmen;
   waarde 1 toont Koelen of Ontdooien, afhankelijk van de ontdooistatus.
5. Zonder HX-, IPM- of EVI-temperatuursensor verschijnen geen vervangende
   meetwaarden. Een ontbrekende pomp-/klepmeting blijft onbekend (`—`).
6. Controleer dat Live vóór de eerste snapshot geen voorbeeldmetingen of
   voorbeeldhistorie toont. Demo vermeldt expliciet Voorbeelddata. Omschakelen
   naar Live herstelt actuele waarden of onbekende waarden zolang data ontbreekt.
7. Controleer historie na meerdere polls, donkere/lichte weergave en een smal
   scherm. De werkpuntgrafiek toont geen verzonnen Aurora II-referentiecurve.
8. Open ook de Tuya- en Aurora I/II-processchema's: bestaande labels en eenheden
   blijven behouden.

De pagina bevat geen schrijfbediening. De backup-aanvraag is een ingestelde
aanvraag uit 4-2103, geen bevestiging van een daadwerkelijk ingeschakelde heater.
