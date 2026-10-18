# Overstappen naar de Aurora III-driver

Deze handleiding is voor gebruikers van de aparte app **Adlar Castra Warmtepomp (Aurora-III Modbus)**. Vanaf versie 3.2.0 zit de Aurora III-ondersteuning in de app **Adlar Castra Warmtepomp**, als driver *Adlar Castra Aurora III Heat Pump (Modbus)*.

Homey kan apparaten niet van de ene app naar de andere verhuizen. Overstappen betekent: het apparaat opnieuw koppelen in de nieuwe app en flows opnieuw opbouwen.

## Wat er verloren gaat

- **Flows**: flows die kaarten van de oude app gebruiken, moeten opnieuw worden opgebouwd.
- **Instellingen**: de apparaatinstellingen worden niet overgenomen.
- **Insights**: de historie van het oude apparaat gaat niet mee naar het nieuwe apparaat.

## Stap 1 — Voorbereiden

1. Noteer de apparaatinstellingen van het oude apparaat die u hebt aangepast (bijvoorbeeld poll-intervallen, adaptieve regeling, energieprijzen, vermogensmeting).
2. Noteer welke flows het oude apparaat gebruiken. Een schermafbeelding per flow is handig bij het opnieuw opbouwen.
3. Noteer het IP-adres, de TCP-poort en de Modbus Unit ID van de gateway.

## Stap 2 — Oude app stilzetten

Laat de oude app en de nieuwe driver **niet tegelijk** met dezelfde warmtepomp praten. Beide zouden dan via dezelfde gateway pollen en schrijven (setpoints, adaptieve regeling), met kans op time-outs en tegenstrijdige opdrachten.

Doe daarom eerst één van de twee:

- verwijder het apparaat uit de oude app, of
- zet in de oude app de adaptieve regeling en alle flows die naar de warmtepomp schrijven uit.

## Stap 3 — Koppelen in de nieuwe app

1. Installeer of update de app **Adlar Castra Warmtepomp** naar versie 3.2.0 of hoger.
2. Voeg een apparaat toe en kies **Adlar Castra Aurora III Heat Pump (Modbus)**. Kies niet de Aurora II-driver: die gebruikt andere registeradressen.
3. Vul het IP-adres, de TCP-poort en de Modbus Unit ID van de gateway in.
4. Zet de genoteerde instellingen terug in de apparaatinstellingen.

De gateway-instellingen veranderen niet. Voor Aurora III blijft het `9600 8N2` met `Serial protocol` = `Modbus`; zie de [Elfin-gids](modbus-elfin-ew11-setup.md).

## Stap 4 — Flows opnieuw opbouwen

Bouw de flows opnieuw op met het nieuwe apparaat. De kaarten hebben dezelfde titels als in de oude app. In de Flow-editor ziet u per apparaat de kaarten van zijn eigen driver; kies dus steeds het Aurora III-apparaat.

Nieuwe, alleen voor Aurora III: stille modus instellen, tapwaterfunctie schakelen, geforceerde bijverwarming schakelen, en de voorwaarden *Tapwater wordt verwarmd* en *Stille modus is*. Zie de [Flow Cards Guide](guide/FLOW_CARDS_GUIDE.nl.md).

## Stap 5 — Dashboards

Het lokale dashboard van de Aurora III-driver draait standaard op poort **8091** (de oude app gebruikte 8090):

```text
http://<homey-ip>:8091/
```

Zie de [dashboardgids](MODBUS_DASHBOARD_GUIDE.nl.md).

## Stap 6 — Oude app verwijderen

Werkt alles in de nieuwe app, verwijder dan de oude app **Adlar Castra Warmtepomp (Aurora-III Modbus)**.
