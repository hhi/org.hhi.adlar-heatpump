# Tuya: zichtbare verbindingsstatus

De technische status blijft direct beschikbaar voor herstel en diagnostiek.
De gebruikerstijdlijn, getoonde verbindingsstatus en beschikbaarheid volgen
bevestigde uitval: minstens 15 minuten zonder gegevensherstel en minstens
3 verbindingspogingen sinds het begin van dat incident. Een socketverbinding
of heartbeat sluit het zichtbare incident niet af. Een niet-leeg `data`- of
`dp-refresh`-antwoord doet dat wel, ook bij ongewijzigde meetwaarden.

## Regressiecontrole op Homey

1. Onderbreek de verbinding kort en laat herstel binnen 15 minuten slagen.
   Verwacht geen nieuwe Verbroken/Verbonden-registraties of notificaties.
2. Houd het apparaat langer dan 15 minuten onbereikbaar en controleer in de
   technische logs dat minstens drie verbindingspogingen zijn uitgevoerd.
   Verwacht één zichtbare uitval, onbeschikbaarheid en één storingsnotificatie.
3. Herstel alleen de socket/heartbeat zonder meetgegevens.
   Verwacht nog geen zichtbare herstelmelding.
4. Laat een geldig gegevensantwoord binnenkomen.
   Verwacht beschikbaarheid en één Verbonden-registratie plus herstelnotificatie.
5. Herhaal korte onderbrekingen en herstart de app tijdens een herstelpoging.
   Controleer dat de gestopte service geen late statusupdates meer publiceert.

De dagelijkse technische disconnectteller blijft ruwe detecties tellen;
deze hoeft niet overeen te komen met het aantal bevestigde gebruikersincidenten.
Automatische regressietests staan in
`test/unit/tuya-connection-service.zombie.test.js`.
