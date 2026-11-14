# Modbus-afsluiten en P/L-parameterbanken

Implementatie: 14 november 2026, branch
`fix/modbus-lifecycle-parameter-metadata` in beide repositories.

## Wijzigingen

Aurora II sluit de TCP-socket direct met `destroy()` en wacht op het
`close`-event. jsmodbus handelt dat event af en beëindigt de actieve request,
de wachtrij en de requesttimeout. Nieuwe requests worden tijdens afsluiten
geweigerd. Pollrondes, reconnects en cache-updates controleren of hun sessie
nog actief is. Batchtimers worden opgeruimd en hun wachtende promises vrijgegeven.
Handmatig afsluiten blijft van kracht tot een expliciete `connect()`; een
vernietigde service kan niet opnieuw verbinden.

De initialisatie van de Aurora II-adapter controleert ook de sessie voordat
zij verder leest of events uitstuurt. De hoofdrepo bevat dezelfde transportfix
voor Aurora III, inclusief FC04. De zusterrepo bevat alleen Aurora II.

P006, P049, P083, P145 en L14 krijgen de gerichte metadatacorrecties uit het
assessment.

**L28: de lees- en schrijflogica is niet gewijzigd.** Al vóór deze branch
las de runtime L28 met `/10` en schreef zij met `×10`: raw `-5` betekent
`k=-0,5`. Ook het rawbereik `-50..0` is ongewijzigd. De oorspronkelijke
L28-beschrijving is na feedback hersteld; de toegevoegde dashboardvertalingen
voor L28 zijn verwijderd. Voor L28 blijven alleen regressietests toegevoegd
die het bestaande gedrag bewaken.

Nieuwe expertbeschrijvingen bestaan in Nederlands, Engels, Duits en Frans;
de browsertaal bepaalt de vertaling met Engels als terugval.

De bronmetingen en hun beperkingen staan in het
[naslagdocument](../Dev%20support/p-l-parameter-bank-architectuur-en-live-dump.md).
Het machineleesbare referentiebestand bewaart de oorspronkelijke bereiken,
zodat de 60 P- en 7 L-afwijkingen na correcties reproduceerbaar blijven.
De overige 56 P- en 6 L-afwijkingen blijven verschillen tegenover de vaste
appdefinities. Het expertdashboard kan nu de bankgrenzen van het aangesloten
toestel ophalen en voor zijn bereikweergave en waarschuwingen gebruiken.
De vaste definities blijven daarnaast zichtbaar. Er wordt geen periodieke
polling van metadata-banken toegevoegd en geen schrijfbeleid op bankgrenzen gebaseerd.

## Bankgrenzen in het expertdashboard

Een handmatige uitlezing van een P- of L-register haalt voortaan ook ontbrekende
min/max op via dezelfde runtime. De reactie bevat `parameterRange`, zodat de
warmtepompgrenzen en bereikcontrole direct bij de waarde verschijnen. Reeds
gelezen grenzen, inclusief onbeschikbare of ongeldige resultaten, worden binnen
de toestelsessie hergebruikt. **Grenswaarden ophalen** blijft expliciet verversen.
Een fout bij metadata maakt een geslaagde registeruitlezing niet ongeldig.
Sensor-, control-, coil- en bankwoordreads vragen geen extra grensparen op.

Bij **Ververs blok** worden P/L-grenzen vooraf in batches van maximaal 32
parameters opgevraagd met `refresh: false`. De server bepaalt wat in zijn
sessiecache ontbreekt. Daarna lezen de regels alleen waarden en nemen beschikbare
gecachete grenzen mee. Een mislukte bankbatch leidt dus niet tot een nieuwe
bankpoging voor elke regel. Automatische polling blijft ongewijzigd en de
periodieke dashboardverversing leest uitsluitend servercache. Ook na reconnect
wordt de grenscache van de browser met de servercache verzoend.

Live gecontroleerd op de self-hosted Homey met versie 3.10.0: de grenscache
bevatte aanvankelijk geen P208 of L37. Eén losse uitlezing gaf voor P208 waarde
2 met grenzen −10..500 en voor L37 waarde −5 met grenzen −50..0. De tweede
P208-uitlezing behield dezelfde grens-uitleestijd (`readAt`): cachehergebruik.
Er is niet op **Grenswaarden ophalen** geklikt en er zijn geen registers geschreven.
De gerichte bank- en dashboardcontroles slagen: 31 per repository.

Gebruik **Grenswaarden ophalen** om de grenzen van de zichtbare P- en
L-parameters te lezen. Een zoek- of weergavefilter beperkt de selectie.
Het dashboard verstuurt maximaal 32 parameters per verzoek. De runtime leest
bij elkaar liggende adressen in blokken via de bestaande Modbus-verbinding,
met de bestaande pauze tussen requests. Er wordt geen tweede verbinding geopend.

De parameterlijst heeft twee afzonderlijke kolommen: **Appgrenzen** bevat de
vaste `min`/`max` uit de registerdefinitie; **Warmtepompgrenzen** bevat de gelezen
bankwaarden. Als alleen een minimum of maximum is gelezen, toont die kolom
beide afzonderlijk, bijvoorbeeld `minimum: Niet gelezen; maximum: 500`.
Pas na beide uitlezingen gebruikt de bereikcontrole het volledige bankbereik.
De oorspronkelijke parameterwaarde bepaalt de grenzen niet.

Er zijn vier aparte alleen-lezen registerblokken, ook in de functionele en
eenheidweergave:

| Blok | Adressen | Posities |
| --- | --- | --- |
| P-maxima | `0x0400–0x05FF` | P000–P511 |
| P-minima | `0x0600–0x07FF` | P000–P511 |
| L-maxima | `0x0840–0x087F` | L11–L74 |
| L-minima | `0x0880–0x08BF` | L11–L74 |

Elk bankregister vermeldt de parameter waarvoor het de grens bevat. Lees een
blok met **Ververs blok**; filters beperken de te lezen regels. Ook deze
uitlezing gebeurt in blokjes van maximaal 32 woorden. De gelezen bankwoorden
vullen dezelfde grenscache als **Grenswaarden ophalen**. Geen van deze blokken
biedt schrijfknoppen; writes naar deze bankadressen worden geweigerd.
Dat een positie in de bank voorkomt, bewijst geen actieve parameter of enum-betekenis.

Waarschuwingen, het filter Buiten bereik en het Markdown-rapport gebruiken het
beschikbare volledige bankbereik. Het rapport vermeldt de bron van het bereik.
De datum van de uitlezing staat in de tooltip van de warmtepompgrenzen.
De API bewaart ook de rawwaarden en min/max-adressen.

De bankcache hoort bij de runtime van één toestel. Disconnect, reconnect en
vernietigen wissen zowel de grenscache als de gecachete bankwoorden; callbacks uit de oude sessie kunnen deze niet
opnieuw vullen. Heropenen van het dashboard gebruikt beschikbare cachegegevens.
Een nieuwe klik leest opnieuw. De normale dashboardverversing leest alleen
servercache en verricht geen extra Modbus-bankreads.

Bij een leesfout, ontbrekende bank of een minimum boven het maximum valt de
weergave terug op de appdefinitie en vermeldt dat. Na een bankleesfout worden
niet alle resterende groepen van hetzelfde verzoek geprobeerd. Het dashboard
stopt verdere batches als een batch geen bruikbare bankgegevens bevat.
Een gelijk minimum en maximum is toegestaan. `0xFFFF` wordt als signed `-1`
gelezen en niet algemeen als ongeldig gemarkeerd.

De bankgrenzen zijn diagnostische toestelgegevens. Zij wijzigen geen enums,
parameternamen, schrijfbaarheid of invoergrenzen. Het schrijfvenster blijft de
vaste appgrenzen gebruiken; een ruimer bankbereik verruimt die niet. Het
L28-register en de oorspronkelijke L28-beschrijving blijven ongewijzigd.
De diagnostische weergave decodeert signed parameterwaarden, ook een waarde
zoals L55 `-5` buiten zijn gerapporteerde bereik `0..240`, zonder afkappen.

## Geautomatiseerde controles

```sh
npm test
npm run lint
homey app validate
node scripts/validation/p-l-parameter-banks.js
```

De transporttests gebruiken de geïnstalleerde jsmodbus-dependency met een
Duplex-socket die bij `end()` de andere kant openhoudt. Ze omvatten actieve
en wachtende FC03/FC01/FC06/FC05-requests, disconnect, destroy, afgebroken connect,
herhaald opruimen, late socketevents, oude responses, batchtimer-cleanup,
automatisch reconnect en hervatte polling. Een integratietest voert de echte
`ModbusConnectionService.forceReconnect('poll timeout')` uit, inclusief het
vernietigen van de oude adapter en het starten van een nieuwe. Aurora III
test daarnaast FC04 op de oude en nieuwe sessie.

Parametertests controleren adresoffsets, signed decoding, onbekende enumwaarde 3,
L14-uren, de al bestaande L28-omzetting van raw `-5` naar `k=-0,5`, overige bereiken,
alleen-lezen ongedocumenteerde dashboardblokken, vier vertalingen voor P006
en L14 en de oorspronkelijke L28-beschrijving via de register-API. Tegenproeven op de referentiedata vergelijken verschoven en
verwisselde banken met de historische handleidingbereiken.

Volledige tests en Homey-validatie moeten buiten een sandbox worden uitgevoerd
als lokale HTTP-poorten daar geblokkeerd zijn. Er is geen warmtepompverbinding
nodig. Het validatiescript rapporteert 203 exacte P-bereiken, 19 exacte
numerieke L-bereiken en 60/7 historische verschillen. Van de 60 P-verschillen
zijn 39 bereiken ruimer, 20 smaller en één verschoven (P150, `0..3` → `1..4`).

Bekende lintbeperkingen: de hoofdrepo heeft bestaande bronfouten en een
ESLint/tsconfig-conflict voor de hele testmap; in de zusterrepo crasht de
bestaande import-rule op de geïnstalleerde minimatch-versie. De gewijzigde
bestaande TypeScript-bestanden zijn ook tegen hun HEAD-versie gelint, om nieuwe
meldingen van bestaande meldingen te onderscheiden. Voor gerichte JS-lint
kunnen `parserOptions.project` en de twee type-afhankelijke promise-regels
worden uitgezet; de tests blijven buiten de build-tsconfig.

## Uitgevoerde eindcontrole

| Controle | Hoofdrepo | Zusterrepo |
| --- | --- | --- |
| TypeScript-build via `npm test` | Geslaagd | Geslaagd |
| Volledige testsuite | 590 geslaagd | 328 geslaagd |
| Homey-validatie, niveau `publish` | Geslaagd | Geslaagd |
| Gehele ESLint-run | Bestaande bron-/tsconfig-fouten | Bestaande minimatch-crash |
| Gerichte nieuwe JS-lint met genoemde parserinstellingen | Geslaagd | Zelfde gesynchroniseerde bestanden |
| Nieuwe TypeScript-lintmeldingen tegenover HEAD | Geen | Gesynchroniseerde wijzigingen |

De bankfunctie is met de referentiemeting gesimuleerd en in een browser
gecontroleerd: P208 schakelt van appbereik `-10..10` naar bankbereik `-10..500`,
met beide bereiken zichtbaar. De tests dekken ook fallback, cache-isolatie,
verouderde sessies en ongewijzigde invoergrenzen.

## Installatie en live controle van 3.10.0

Op 14 november 2026 is de hoofdapp `org.hhi.adlar-heatpump` versie **3.10.0**
geïnstalleerd op de **Homey Self-Hosted Server**, met behoud van appgegevens.
De server rapporteert versie `3.10.0`, ingeschakeld en niet gecrasht; het
bestaande Aurora I/II Modbus-apparaat is beschikbaar.

Via de nieuwe dashboard-API zijn daarna de banken van twee parameters werkelijk
uitgelezen, zonder naar de warmtepomp te schrijven:

| Parameter | Min-register | Max-register | Raw min | Raw max | Gelezen bereik |
| --- | --- | --- | --- | --- | --- |
| P208 | `0x06D0` | `0x04D0` | `65526` | `500` | `-10..500` |
| L19 | `0x0888` | `0x0848` | `20` | `50` | `20..50` |

Beide resultaten hebben status `available`. Hiermee is de live bankuitlezing op
het gekoppelde toestel bevestigd.

Na de toevoeging van de vier definitieblokken is de 3.10.0-testinstallatie opnieuw
bijgewerkt. De live register-API bevestigt vier alleen-lezen blokken met
512 P-maxima, 512 P-minima, 64 L-maxima en 64 L-minima. Afzonderlijke reads via
`/api/parameter-bank-block` op `0x04D0` en `0x06D0` geven `500` en `65526`;
de gezamenlijke P208-grenscache wordt daardoor `-10..500`, status `available`.
Er zijn hierbij geen grenswaarden geschreven. Het volledige onderstaande hardwareprotocol,
waaronder verbindingsonderbrekingen, is nog niet doorlopen. De zusterrepo is
ook verhoogd en gevalideerd op 3.10.0; op deze server is alleen de bestaande
hoofdapp bijgewerkt. Tijdens deze livecontroles waren de wijzigingen nog niet
gecommit en was niets in de App Store gepubliceerd.

## Handmatige regressie op Homey

Nog op hardware uit te voeren:

1. Start de app en controleer normale Aurora II-polling en Homey-capabilities.
2. Onderbreek tijdelijk de bridgeverbinding tijdens polling. Herstel deze en
   controleer dat polltimeout-herstel en automatische reconnect hervatten,
   zonder `ERR_STREAM_WRITE_AFTER_END`, onbehandelde exception of rejection.
3. Herstart/verwijder het apparaat tijdens een lopende expert-read of poll.
   Controleer dat oude poll-complete/data-events en timers niet terugkomen.
4. Open `/expert` en controleer dat alleen openen geen bankreads veroorzaakt.
   Lees P208 met de uitleesknop en controleer dat bankbereik `-10..500` direct
   naast appdefinitie `-10..10` verschijnt. Een herhaalde read hergebruikt de
   grenzen; **Grenswaarden ophalen** ververst ze expliciet. Herhaal met L19
   (`20..50` naast `0..99`) en met een
   parameter waarvoor een bank ontbreekt. Controleer de vermelde terugval.
   Herverbind en controleer dat de bankcache leeg is en pas na een nieuwe klik
   opnieuw wordt gelezen.
5. Lees P006, P049, P083, P145, L14 en L28 op de gemeten unit.
   Verwacht bereik `0..3`, `0..100`, `0..480`, `-30..10`, `0..23 h` en raw
   `-50..0`. Controleer voor L28 het bestaande gedrag: raw `-5` verschijnt in
   de gewone DIY-weergave als `k=-0,5`. Dit is een regressiecontrole van de
   ongewijzigde conversie, geen nieuw ingevoerde omzetting.
6. Controleer dat een onbekende ventilatorwaarde als onbekend beschreven blijft,
   L55 niet wordt afgevlakt en ongedocumenteerde registers alleen-lezen blijven.
7. Herhaal verbindingsherstel met Aurora III in de hoofdapp. Controleer zowel
   FC03- als FC04-data na herstel.
8. Noteer model/programma/protocol bij andere testunits. De gemeten bankgrenzen
   zijn niet automatisch voor hun firmware bevestigd. Voer geen schrijfproef
   uit om bankgrenzen te verifiëren als onderdeel van deze regressie.
