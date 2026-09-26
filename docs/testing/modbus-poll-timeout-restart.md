# Modbus-statusherstel na app-herstart

## Handmatige regressiecontrole

1. Begin met een Modbus-apparaat dat `Disconnected: … (poll timeout)` toont.
2. Herstart de Homey-app en herstel de bereikbaarheid van de warmtepomp.
3. Controleer dat alleen een TCP-verbinding de status nog niet op verbonden zet.
4. Wacht op een succesvolle FAST-poll en nieuwe meetwaarden.
5. Controleer dat het apparaat beschikbaar is, de waarschuwing verdwenen is,
   `adlar_connection_active` op `true` staat en `adlar_connection_status`
   `Connected: …` met een nieuw tijdstip toont.
6. Controleer hetzelfde herstel zonder app-herstart.

## Automatische regressiecontrole

`npm run build && node --test test/unit/service-coordinator.test.js`

De test controleert herstel binnen dezelfde sessie en met de interne startwaarden
van een nieuwe coordinator terwijl de eerder geschreven offline-status blijft
staan. Een TCP-connect alleen mag die status niet wissen; een geldige
FAST-snapshot moet beide verbindingscapabilities herstellen.
