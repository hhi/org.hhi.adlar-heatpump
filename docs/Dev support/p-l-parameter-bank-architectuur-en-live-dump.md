# Aurora II: P- en L-banken, metingen en toepasselijkheid

## Bron en reikwijdte

De vastlegging van 11 november 2026 betreft één Adlar Castra Aurora II
(SolarEast BLN-006TB1, R32), programma `433`, protocol `143`. De aanvullende
uitlezing van `0x0370–0x037F` is van 14 november. Serienummer en firmwarebuild
zijn onbekend. De uitlezing was niet atomair. Er is uitsluitend gelezen met
FC03; er zijn geen schrijfproeven uitgevoerd.

Dit document bewaart de ruwe tabellen uit het oorspronkelijke todo-naslagdocument.
De oorspronkelijke duiding is hieronder opnieuw beoordeeld. Namen in de
P-tabel komen uit bestaande documentatie; de functie van P263–P300 is onbekend.
De kolom **Code Bereik** is de referentie vóór de gerichte correcties en wordt
niet achteraf aangepast aan de nieuwe code.

De machineleesbare transcriptie staat in
[`p-l-433-143.json`](../../test/fixtures/modbus/p-l-433-143.json).
Elke parameter bevat adressen, rawwaarden, bronsecties en het oorspronkelijke
codebereik. P-actuele waarden zijn uit de int16-tabel teruggecodeerd naar uint16;
dit is in het bestand aangegeven. De actuele wachtwoordwaarde P183 is weggelaten.
Onbekende gegevens blijven `null`.

## Gemeten waarden en afgeleide bankindeling

| Groep | Actuele waarden | Maxima | Minima |
| --- | --- | --- | --- |
| P000–P303 | `0x0100–0x022F` | `0x0400–0x052F` | `0x0600–0x072F` |
| L11–L74 | `0x0800–0x083F` | `0x0840–0x087F` | `0x0880–0x08BF` |

De waarden zijn gemeten. De interpretatie van de banken als gerapporteerde
minima en maxima wordt ondersteund door de vergelijking met onafhankelijke
handleidingbereiken: 203/263 P-paren en 19/25 L-paren komen exact overeen.
Bij één positie terug verschuiven blijven voor P 89 overeenkomsten over
(één positie vooruit: 88); bij
verwisselde P-banken nul. De constatering dat 301/301 actuele P-waarden binnen
de geïnterpreteerde grenzen vallen is aanvullend bewijs en is op zichzelf
onvoldoende voor de adresindeling.

De baseline bevat 60 P-verschillen en 7 L-verschillen (L13, L14, L15, L19, L20,
L23, L30). L14 had nog geen numeriek codebereik. De reproductie gebeurt zonder
apparaatverbinding via `node scripts/validation/p-l-parameter-banks.js` na de build.
Het script toont zowel de historische afwijkingen als die tegenover de huidige code.
Van de 60 P-afwijkingen zijn 39 bereiken volledig ruimer, 20 volledig smaller en
is P150 verschoven van `0..3` naar `1..4`. De eerdere telling van 40 ruimer nam
P150 mee hoewel daar ook de ondergrens stijgt.

## Vlagpatronen en onbekende functies

Gemeten: `0x0370–0x038F` bevat 301 aaneengesloten enen gevolgd door 211 nullen.
`0x08C0–0x08CF` bevat 50 aaneengesloten enen gevolgd door nullen. Deze aantallen
passen bij de veronderstelde parameterposities. Of een bit aanwezigheid,
paneelzichtbaarheid, schrijfbaarheid of een unair aantal betekent is onbekend.
De patronen bewijzen geen individuele schrijfbaarheid.

De historische OEM-updatevermeldingen noemen grenswaarden en vlagselectie.
De exacte koppeling aan ontbrekende hoofdstukken 7–10 is een hypothese.
De duiding van L37–L60 als extra stooklijnen of tienpuntscurve, van L55 als
fabrieksdefault en van L67–L70 als werkregisters is eveneens onbewezen.

Het expertdashboard duidt L42–L51 daarom aan als **vermoedelijke customstooklijnpunten
c0–c9**. Ook de bijbehorende minimum- en maximumbanken verwijzen naar deze punten.
De gemeten reeks 55, 52, 49, 46, 43, 40, 37, 34, 31, 28 past bij de huidige
appstooklijn (55 bij −15 °C en 40 bij +15 °C) als de buitentemperatuurankers
−15, −9, −3, +3, +9, +15, +21, +27, +33 en +39 °C zijn. Deze ankers zijn
teruggerekend, niet gemeten, en worden daarom niet als vaste coördinaten getoond.
De aanduiding wijzigt geen eenheden, schaalfactoren, grenzen of schrijfbaarheid.

L37/L38, L56/L57 en L59/L60 krijgen de vermoedelijke rollen **stooklijncoëfficiënt k**
en **stooklijnconstante b**. L39/L40 heten **Vermoedelijke uurinstelling 1/2**;
L41/L58 heten **Binaire parameter — functie onbekend**. Deze benamingen leggen
geen curvenummer, formule, schaal, eenheid of schakelrichting vast. De plaatsing
bewijst niet welke vlag of uurinstelling bij welke curve hoort. L27–L29 blijven
ongewijzigd. De min/max-banken verwijzen naar dezelfde vermoedelijke rollen.

De gewone L-registerlijst blijft beperkt tot **L11–L60**. De 50 opeenvolgende
vlagbits en niet-nul bereiken tot L60 ondersteunen deze weergavegrens, zonder
de vlagbetekenis of schrijfbaarheid te bewijzen. De diagnostische min/max-banken
behouden alle 64 posities, dus ook de 14 posities L61–L74. Die krijgen expliciet
**parameterfunctie onbevestigd**: in de vastgelegde dump zijn hun grenzen 0..0
en hun vlagbits 0. Zij worden niet als bevestigde instelbare parameters benoemd.
De waargenomen inhoud buiten L60 blijft in de ruwe dump bewaard.

## Kloktijd warmtepomp: 0x0309

Het waargenomen gedrag past bij `waarde = uur × 256 + minuut`: de hoge byte
bevat het uur, de lage byte de minuut. `5411` = `0x1523` = **21:35** en `5412`
= `0x1524` = **21:36**. Een uitlezing op 14 november 2026 om 21:38:36 lokale tijd
gaf `5414` = `0x1526` = **21:38**. Dit vervangt de eerdere minutentellerhypothese.
De OEM-tabel noemt dit adres gereserveerd; deze duiding is gebaseerd op de meting.
Uur- en dagovergangen zijn nog niet gemeten. Een uurwisseling zou numeriek +197
moeten geven, bijvoorbeeld `5435` (21:59) naar `5632` (22:00).

Het expertdashboard noemt dit register **Kloktijd warmtepomp** en toont de geldige
uitlezing als `0x1523 = 21:35`, ook in het Markdown-rapport. Rawwaarden blijven
numeriek. Ongeldige uur- of minuutbytes blijven eveneens numeriek. Het register
is alleen-lezen; het bestaande pollschema blijft gelijk.

## Volledig User Control-adresblok

Blok 3 van het expertdashboard toont alle 48 posities van `0x0300–0x032F`.
De bestaande 16 control-definities en de waargenomen klok op `0x0309` blijven
behouden. De overige 31 posities krijgen **Betekenis onbekend**, zonder verzonnen
eenheid, schaal of bereik. Zij zijn alleen-lezen, ook via de expert-schrijf-API.
Een opname in deze lijst bewijst geen ondersteuning of functie op het toestel.

`0x0308`, `0x030A–0x030B` en `0x0318` vallen binnen bestaande pollreads; de
andere onbekende posities worden alleen op verzoek gelezen. Het ophalen van
de registerlijst verandert de polling niet en leest geen hardware. Bij een
niet-ondersteund adres blijft de normale leesfout zichtbaar. `0x0319` was alleen
het laatste expliciet benoemde register in de codelijst, geen bewezen hardwaregrens.

`0xFFFB` is signed `-5`: bij L28, L37, L56 en L59 past dat binnen de gemeten
negatieve bereiken. Bij L55 valt dezelfde waarde buiten `0..240`; de oorzaak
is onbekend en de waarde wordt niet afgevlakt of gewijzigd.
`0x0900–0x091F` retourneert `65535` (`0xFFFF`, signed `-1`). Dit bewijst geen
ongemapt geheugen en is geen algemene ongeldigwaarde.

## Gerealiseerde gerichte correcties

P006 krijgt bereik `0..3`; de betekenis van enumwaarde 3 blijft onbekend.
P049 krijgt `0..100`, P083 `0..480` en P145 `-30..10`.
L14 wordt voor de aangetoonde uurrepresentatie `0..23 h`, default `23`.
Deze metadata is op de gemeten unit gebaseerd en is geen firmwaredetectie;
voor andere modellen/firmware is de toepasselijkheid nog niet vastgesteld.
Er worden geen bestaande apparaatinstellingen herschreven.

L28 behoudt rawbereik `-50..0`. De bestaande runtime leest met `/10` en schrijft
met `×10`: raw `-5` betekent `k=-0,5`. De expertpagina toont rawbereik en beschrijving;
er wordt geen tweede schaalfactor toegevoegd.

De specifieke setters gebruiken de overige, bestaande grenzen. De ruwe
expert- en flow-schrijfroutes krijgen door deze wijziging geen nieuw schrijfbeleid.
De 56 overige P- en 6 overige L-verschillen blijven afzonderlijk te beoordelen.
P045 tot 256 of P208/P209 tot 500 wordt niet als veilige schrijfgrens overgenomen.
Min/max- en vlaggenbanken worden niet toegevoegd aan periodieke polling.
De min/maxbanken kunnen inmiddels wel op aanvraag via het expertdashboard
worden uitgelezen. Beschikbare bankgrenzen worden per toestelsessie gecachet
en gebruikt voor diagnostische bereikweergave en waarschuwingen. De vaste
appdefinitie blijft zichtbaar en de schrijfgrenzen worden niet gewijzigd.
Ongedocumenteerde dashboardblokken blijven alleen-lezen en zonder verzonnen functies.

## Ruwe brondata

De onderstaande rawtabellen zijn overgenomen uit de vastlegging; de synthetische
L-labels boven L74 zijn uitleesscriptlabels, geen nieuwe L-parameters.

## 6. Bijlage: Volledige Ruwe Registerdumps per Adresblok

### 6.1 Ruwe Dump `0x0800–0x08CF` (Rekenlabels `L11–L218`)

| Rekenlabel | Adres | Raw (uint16) | Signed (int16) | Bank-rol |
| :--- | :--- | :---: | :---: | :--- |
| `L11` | `0x0800` | `30` | `30` | Bank 0: Huidige waarde `L11` |
| `L12` | `0x0801` | `1` | `1` | Bank 0: Huidige waarde `L12` |
| `L13` | `0x0802` | `7` | `7` | Bank 0: Huidige waarde `L13` |
| `L14` | `0x0803` | `23` | `23` | Bank 0: Huidige waarde `L14` |
| `L15` | `0x0804` | `10` | `10` | Bank 0: Huidige waarde `L15` |
| `L16` | `0x0805` | `70` | `70` | Bank 0: Huidige waarde `L16` |
| `L17` | `0x0806` | `1` | `1` | Bank 0: Huidige waarde `L17` |
| `L18` | `0x0807` | `1` | `1` | Bank 0: Huidige waarde `L18` |
| `L19` | `0x0808` | `45` | `45` | Bank 0: Huidige waarde `L19` |
| `L20` | `0x0809` | `5` | `5` | Bank 0: Huidige waarde `L20` |
| `L21` | `0x080A` | `1` | `1` | Bank 0: Huidige waarde `L21` |
| `L22` | `0x080B` | `0` | `0` | Bank 0: Huidige waarde `L22` |
| `L23` | `0x080C` | `40` | `40` | Bank 0: Huidige waarde `L23` |
| `L24` | `0x080D` | `5` | `5` | Bank 0: Huidige waarde `L24` |
| `L25` | `0x080E` | `30` | `30` | Bank 0: Huidige waarde `L25` |
| `L26` | `0x080F` | `5` | `5` | Bank 0: Huidige waarde `L26` |
| `L27` | `0x0810` | `0` | `0` | Bank 0: Huidige waarde `L27` |
| `L28` | `0x0811` | `65531` | `-5` | Bank 0: Huidige waarde `L28` |
| `L29` | `0x0812` | `55` | `55` | Bank 0: Huidige waarde `L29` |
| `L30` | `0x0813` | `0` | `0` | Bank 0: Huidige waarde `L30` |
| `L31` | `0x0814` | `0` | `0` | Bank 0: Huidige waarde `L31` |
| `L32` | `0x0815` | `0` | `0` | Bank 0: Huidige waarde `L32` |
| `L33` | `0x0816` | `0` | `0` | Bank 0: Huidige waarde `L33` |
| `L34` | `0x0817` | `0` | `0` | Bank 0: Huidige waarde `L34` |
| `L35` | `0x0818` | `0` | `0` | Bank 0: Huidige waarde `L35` |
| `L36` | `0x0819` | `0` | `0` | Bank 0: Huidige waarde `L36` |
| `L37` | `0x081A` | `65531` | `-5` | Bank 0: Huidige waarde `L37` |
| `L38` | `0x081B` | `50` | `50` | Bank 0: Huidige waarde `L38` |
| `L39` | `0x081C` | `22` | `22` | Bank 0: Huidige waarde `L39` |
| `L40` | `0x081D` | `22` | `22` | Bank 0: Huidige waarde `L40` |
| `L41` | `0x081E` | `1` | `1` | Bank 0: Huidige waarde `L41` |
| `L42` | `0x081F` | `55` | `55` | Bank 0: Huidige waarde `L42` |
| `L43` | `0x0820` | `52` | `52` | Bank 0: Huidige waarde `L43` |
| `L44` | `0x0821` | `49` | `49` | Bank 0: Huidige waarde `L44` |
| `L45` | `0x0822` | `46` | `46` | Bank 0: Huidige waarde `L45` |
| `L46` | `0x0823` | `43` | `43` | Bank 0: Huidige waarde `L46` |
| `L47` | `0x0824` | `40` | `40` | Bank 0: Huidige waarde `L47` |
| `L48` | `0x0825` | `37` | `37` | Bank 0: Huidige waarde `L48` |
| `L49` | `0x0826` | `34` | `34` | Bank 0: Huidige waarde `L49` |
| `L50` | `0x0827` | `31` | `31` | Bank 0: Huidige waarde `L50` |
| `L51` | `0x0828` | `28` | `28` | Bank 0: Huidige waarde `L51` |
| `L52` | `0x0829` | `5` | `5` | Bank 0: Huidige waarde `L52` |
| `L53` | `0x082A` | `1` | `1` | Bank 0: Huidige waarde `L53` |
| `L54` | `0x082B` | `420` | `420` | Bank 0: Huidige waarde `L54` |
| `L55` | `0x082C` | `65531` | `-5` | Bank 0: Huidige waarde `L55` |
| `L56` | `0x082D` | `65531` | `-5` | Bank 0: Huidige waarde `L56` |
| `L57` | `0x082E` | `30` | `30` | Bank 0: Huidige waarde `L57` |
| `L58` | `0x082F` | `1` | `1` | Bank 0: Huidige waarde `L58` |
| `L59` | `0x0830` | `65531` | `-5` | Bank 0: Huidige waarde `L59` |
| `L60` | `0x0831` | `50` | `50` | Bank 0: Huidige waarde `L60` |
| `L61` | `0x0832` | `0` | `0` | Bank 0: Huidige waarde `L61` |
| `L62` | `0x0833` | `0` | `0` | Bank 0: Huidige waarde `L62` |
| `L63` | `0x0834` | `0` | `0` | Bank 0: Huidige waarde `L63` |
| `L64` | `0x0835` | `0` | `0` | Bank 0: Huidige waarde `L64` |
| `L65` | `0x0836` | `0` | `0` | Bank 0: Huidige waarde `L65` |
| `L66` | `0x0837` | `0` | `0` | Bank 0: Huidige waarde `L66` |
| `L67` | `0x0838` | `65531` | `-5` | Bank 0: Huidige waarde `L67` |
| `L68` | `0x0839` | `50` | `50` | Bank 0: Huidige waarde `L68` |
| `L69` | `0x083A` | `6` | `6` | Bank 0: Huidige waarde `L69` |
| `L70` | `0x083B` | `22` | `22` | Bank 0: Huidige waarde `L70` |
| `L71` | `0x083C` | `0` | `0` | Bank 0: Huidige waarde `L71` |
| `L72` | `0x083D` | `0` | `0` | Bank 0: Huidige waarde `L72` |
| `L73` | `0x083E` | `0` | `0` | Bank 0: Huidige waarde `L73` |
| `L74` | `0x083F` | `0` | `0` | Bank 0: Huidige waarde `L74` |
| `L75` | `0x0840` | `300` | `300` | Bank 1 (`+0x40`): Maximum van `L11` (`0x0800`) |
| `L76` | `0x0841` | `2` | `2` | Bank 1 (`+0x40`): Maximum van `L12` (`0x0801`) |
| `L77` | `0x0842` | `999` | `999` | Bank 1 (`+0x40`): Maximum van `L13` (`0x0802`) |
| `L78` | `0x0843` | `23` | `23` | Bank 1 (`+0x40`): Maximum van `L14` (`0x0803`) |
| `L79` | `0x0844` | `999` | `999` | Bank 1 (`+0x40`): Maximum van `L15` (`0x0804`) |
| `L80` | `0x0845` | `80` | `80` | Bank 1 (`+0x40`): Maximum van `L16` (`0x0805`) |
| `L81` | `0x0846` | `2` | `2` | Bank 1 (`+0x40`): Maximum van `L17` (`0x0806`) |
| `L82` | `0x0847` | `1` | `1` | Bank 1 (`+0x40`): Maximum van `L18` (`0x0807`) |
| `L83` | `0x0848` | `50` | `50` | Bank 1 (`+0x40`): Maximum van `L19` (`0x0808`) |
| `L84` | `0x0849` | `15` | `15` | Bank 1 (`+0x40`): Maximum van `L20` (`0x0809`) |
| `L85` | `0x084A` | `2` | `2` | Bank 1 (`+0x40`): Maximum van `L21` (`0x080A`) |
| `L86` | `0x084B` | `3` | `3` | Bank 1 (`+0x40`): Maximum van `L22` (`0x080B`) |
| `L87` | `0x084C` | `65` | `65` | Bank 1 (`+0x40`): Maximum van `L23` (`0x080C`) |
| `L88` | `0x084D` | `15` | `15` | Bank 1 (`+0x40`): Maximum van `L24` (`0x080D`) |
| `L89` | `0x084E` | `90` | `90` | Bank 1 (`+0x40`): Maximum van `L25` (`0x080E`) |
| `L90` | `0x084F` | `30` | `30` | Bank 1 (`+0x40`): Maximum van `L26` (`0x080F`) |
| `L91` | `0x0850` | `1` | `1` | Bank 1 (`+0x40`): Maximum van `L27` (`0x0810`) |
| `L92` | `0x0851` | `0` | `0` | Bank 1 (`+0x40`): Maximum van `L28` (`0x0811`) |
| `L93` | `0x0852` | `80` | `80` | Bank 1 (`+0x40`): Maximum van `L29` (`0x0812`) |
| `L94` | `0x0853` | `0` | `0` | Bank 1 (`+0x40`): Maximum van `L30` (`0x0813`) |
| `L95` | `0x0854` | `999` | `999` | Bank 1 (`+0x40`): Maximum van `L31` (`0x0814`) |
| `L96` | `0x0855` | `9999` | `9999` | Bank 1 (`+0x40`): Maximum van `L32` (`0x0815`) |
| `L97` | `0x0856` | `9999` | `9999` | Bank 1 (`+0x40`): Maximum van `L33` (`0x0816`) |
| `L98` | `0x0857` | `9999` | `9999` | Bank 1 (`+0x40`): Maximum van `L34` (`0x0817`) |
| `L99` | `0x0858` | `9999` | `9999` | Bank 1 (`+0x40`): Maximum van `L35` (`0x0818`) |
| `L100` | `0x0859` | `9999` | `9999` | Bank 1 (`+0x40`): Maximum van `L36` (`0x0819`) |
| `L101` | `0x085A` | `0` | `0` | Bank 1 (`+0x40`): Maximum van `L37` (`0x081A`) |
| `L102` | `0x085B` | `80` | `80` | Bank 1 (`+0x40`): Maximum van `L38` (`0x081B`) |
| `L103` | `0x085C` | `23` | `23` | Bank 1 (`+0x40`): Maximum van `L39` (`0x081C`) |
| `L104` | `0x085D` | `23` | `23` | Bank 1 (`+0x40`): Maximum van `L40` (`0x081D`) |
| `L105` | `0x085E` | `1` | `1` | Bank 1 (`+0x40`): Maximum van `L41` (`0x081E`) |
| `L106` | `0x085F` | `75` | `75` | Bank 1 (`+0x40`): Maximum van `L42` (`0x081F`) |
| `L107` | `0x0860` | `75` | `75` | Bank 1 (`+0x40`): Maximum van `L43` (`0x0820`) |
| `L108` | `0x0861` | `75` | `75` | Bank 1 (`+0x40`): Maximum van `L44` (`0x0821`) |
| `L109` | `0x0862` | `75` | `75` | Bank 1 (`+0x40`): Maximum van `L45` (`0x0822`) |
| `L110` | `0x0863` | `75` | `75` | Bank 1 (`+0x40`): Maximum van `L46` (`0x0823`) |
| `L111` | `0x0864` | `75` | `75` | Bank 1 (`+0x40`): Maximum van `L47` (`0x0824`) |
| `L112` | `0x0865` | `75` | `75` | Bank 1 (`+0x40`): Maximum van `L48` (`0x0825`) |
| `L113` | `0x0866` | `75` | `75` | Bank 1 (`+0x40`): Maximum van `L49` (`0x0826`) |
| `L114` | `0x0867` | `75` | `75` | Bank 1 (`+0x40`): Maximum van `L50` (`0x0827`) |
| `L115` | `0x0868` | `75` | `75` | Bank 1 (`+0x40`): Maximum van `L51` (`0x0828`) |
| `L116` | `0x0869` | `60` | `60` | Bank 1 (`+0x40`): Maximum van `L52` (`0x0829`) |
| `L117` | `0x086A` | `1` | `1` | Bank 1 (`+0x40`): Maximum van `L53` (`0x082A`) |
| `L118` | `0x086B` | `2000` | `2000` | Bank 1 (`+0x40`): Maximum van `L54` (`0x082B`) |
| `L119` | `0x086C` | `240` | `240` | Bank 1 (`+0x40`): Maximum van `L55` (`0x082C`) |
| `L120` | `0x086D` | `0` | `0` | Bank 1 (`+0x40`): Maximum van `L56` (`0x082D`) |
| `L121` | `0x086E` | `80` | `80` | Bank 1 (`+0x40`): Maximum van `L57` (`0x082E`) |
| `L122` | `0x086F` | `1` | `1` | Bank 1 (`+0x40`): Maximum van `L58` (`0x082F`) |
| `L123` | `0x0870` | `65535` | `-1` | Bank 1 (`+0x40`): Maximum van `L59` (`0x0830`) |
| `L124` | `0x0871` | `80` | `80` | Bank 1 (`+0x40`): Maximum van `L60` (`0x0831`) |
| `L125` | `0x0872` | `0` | `0` | Bank 1 (`+0x40`): Maximum van `L61` (`0x0832`) |
| `L126` | `0x0873` | `0` | `0` | Bank 1 (`+0x40`): Maximum van `L62` (`0x0833`) |
| `L127` | `0x0874` | `0` | `0` | Bank 1 (`+0x40`): Maximum van `L63` (`0x0834`) |
| `L128` | `0x0875` | `0` | `0` | Bank 1 (`+0x40`): Maximum van `L64` (`0x0835`) |
| `L129` | `0x0876` | `0` | `0` | Bank 1 (`+0x40`): Maximum van `L65` (`0x0836`) |
| `L130` | `0x0877` | `0` | `0` | Bank 1 (`+0x40`): Maximum van `L66` (`0x0837`) |
| `L131` | `0x0878` | `0` | `0` | Bank 1 (`+0x40`): Maximum van `L67` (`0x0838`) |
| `L132` | `0x0879` | `0` | `0` | Bank 1 (`+0x40`): Maximum van `L68` (`0x0839`) |
| `L133` | `0x087A` | `0` | `0` | Bank 1 (`+0x40`): Maximum van `L69` (`0x083A`) |
| `L134` | `0x087B` | `0` | `0` | Bank 1 (`+0x40`): Maximum van `L70` (`0x083B`) |
| `L135` | `0x087C` | `0` | `0` | Bank 1 (`+0x40`): Maximum van `L71` (`0x083C`) |
| `L136` | `0x087D` | `0` | `0` | Bank 1 (`+0x40`): Maximum van `L72` (`0x083D`) |
| `L137` | `0x087E` | `0` | `0` | Bank 1 (`+0x40`): Maximum van `L73` (`0x083E`) |
| `L138` | `0x087F` | `0` | `0` | Bank 1 (`+0x40`): Maximum van `L74` (`0x083F`) |
| `L139` | `0x0880` | `1` | `1` | Bank 2 (`+0x80`): Minimum van `L11` (`0x0800`) |
| `L140` | `0x0881` | `0` | `0` | Bank 2 (`+0x80`): Minimum van `L12` (`0x0801`) |
| `L141` | `0x0882` | `1` | `1` | Bank 2 (`+0x80`): Minimum van `L13` (`0x0802`) |
| `L142` | `0x0883` | `0` | `0` | Bank 2 (`+0x80`): Minimum van `L14` (`0x0803`) |
| `L143` | `0x0884` | `0` | `0` | Bank 2 (`+0x80`): Minimum van `L15` (`0x0804`) |
| `L144` | `0x0885` | `50` | `50` | Bank 2 (`+0x80`): Minimum van `L16` (`0x0805`) |
| `L145` | `0x0886` | `0` | `0` | Bank 2 (`+0x80`): Minimum van `L17` (`0x0806`) |
| `L146` | `0x0887` | `0` | `0` | Bank 2 (`+0x80`): Minimum van `L18` (`0x0807`) |
| `L147` | `0x0888` | `20` | `20` | Bank 2 (`+0x80`): Minimum van `L19` (`0x0808`) |
| `L148` | `0x0889` | `1` | `1` | Bank 2 (`+0x80`): Minimum van `L20` (`0x0809`) |
| `L149` | `0x088A` | `0` | `0` | Bank 2 (`+0x80`): Minimum van `L21` (`0x080A`) |
| `L150` | `0x088B` | `0` | `0` | Bank 2 (`+0x80`): Minimum van `L22` (`0x080B`) |
| `L151` | `0x088C` | `30` | `30` | Bank 2 (`+0x80`): Minimum van `L23` (`0x080C`) |
| `L152` | `0x088D` | `1` | `1` | Bank 2 (`+0x80`): Minimum van `L24` (`0x080D`) |
| `L153` | `0x088E` | `3` | `3` | Bank 2 (`+0x80`): Minimum van `L25` (`0x080E`) |
| `L154` | `0x088F` | `1` | `1` | Bank 2 (`+0x80`): Minimum van `L26` (`0x080F`) |
| `L155` | `0x0890` | `0` | `0` | Bank 2 (`+0x80`): Minimum van `L27` (`0x0810`) |
| `L156` | `0x0891` | `65486` | `-50` | Bank 2 (`+0x80`): Minimum van `L28` (`0x0811`) |
| `L157` | `0x0892` | `30` | `30` | Bank 2 (`+0x80`): Minimum van `L29` (`0x0812`) |
| `L158` | `0x0893` | `0` | `0` | Bank 2 (`+0x80`): Minimum van `L30` (`0x0813`) |
| `L159` | `0x0894` | `0` | `0` | Bank 2 (`+0x80`): Minimum van `L31` (`0x0814`) |
| `L160` | `0x0895` | `0` | `0` | Bank 2 (`+0x80`): Minimum van `L32` (`0x0815`) |
| `L161` | `0x0896` | `0` | `0` | Bank 2 (`+0x80`): Minimum van `L33` (`0x0816`) |
| `L162` | `0x0897` | `0` | `0` | Bank 2 (`+0x80`): Minimum van `L34` (`0x0817`) |
| `L163` | `0x0898` | `0` | `0` | Bank 2 (`+0x80`): Minimum van `L35` (`0x0818`) |
| `L164` | `0x0899` | `0` | `0` | Bank 2 (`+0x80`): Minimum van `L36` (`0x0819`) |
| `L165` | `0x089A` | `65486` | `-50` | Bank 2 (`+0x80`): Minimum van `L37` (`0x081A`) |
| `L166` | `0x089B` | `30` | `30` | Bank 2 (`+0x80`): Minimum van `L38` (`0x081B`) |
| `L167` | `0x089C` | `0` | `0` | Bank 2 (`+0x80`): Minimum van `L39` (`0x081C`) |
| `L168` | `0x089D` | `0` | `0` | Bank 2 (`+0x80`): Minimum van `L40` (`0x081D`) |
| `L169` | `0x089E` | `0` | `0` | Bank 2 (`+0x80`): Minimum van `L41` (`0x081E`) |
| `L170` | `0x089F` | `15` | `15` | Bank 2 (`+0x80`): Minimum van `L42` (`0x081F`) |
| `L171` | `0x08A0` | `15` | `15` | Bank 2 (`+0x80`): Minimum van `L43` (`0x0820`) |
| `L172` | `0x08A1` | `15` | `15` | Bank 2 (`+0x80`): Minimum van `L44` (`0x0821`) |
| `L173` | `0x08A2` | `15` | `15` | Bank 2 (`+0x80`): Minimum van `L45` (`0x0822`) |
| `L174` | `0x08A3` | `15` | `15` | Bank 2 (`+0x80`): Minimum van `L46` (`0x0823`) |
| `L175` | `0x08A4` | `15` | `15` | Bank 2 (`+0x80`): Minimum van `L47` (`0x0824`) |
| `L176` | `0x08A5` | `15` | `15` | Bank 2 (`+0x80`): Minimum van `L48` (`0x0825`) |
| `L177` | `0x08A6` | `15` | `15` | Bank 2 (`+0x80`): Minimum van `L49` (`0x0826`) |
| `L178` | `0x08A7` | `15` | `15` | Bank 2 (`+0x80`): Minimum van `L50` (`0x0827`) |
| `L179` | `0x08A8` | `15` | `15` | Bank 2 (`+0x80`): Minimum van `L51` (`0x0828`) |
| `L180` | `0x08A9` | `3` | `3` | Bank 2 (`+0x80`): Minimum van `L52` (`0x0829`) |
| `L181` | `0x08AA` | `0` | `0` | Bank 2 (`+0x80`): Minimum van `L53` (`0x082A`) |
| `L182` | `0x08AB` | `0` | `0` | Bank 2 (`+0x80`): Minimum van `L54` (`0x082B`) |
| `L183` | `0x08AC` | `0` | `0` | Bank 2 (`+0x80`): Minimum van `L55` (`0x082C`) |
| `L184` | `0x08AD` | `65486` | `-50` | Bank 2 (`+0x80`): Minimum van `L56` (`0x082D`) |
| `L185` | `0x08AE` | `10` | `10` | Bank 2 (`+0x80`): Minimum van `L57` (`0x082E`) |
| `L186` | `0x08AF` | `0` | `0` | Bank 2 (`+0x80`): Minimum van `L58` (`0x082F`) |
| `L187` | `0x08B0` | `65516` | `-20` | Bank 2 (`+0x80`): Minimum van `L59` (`0x0830`) |
| `L188` | `0x08B1` | `20` | `20` | Bank 2 (`+0x80`): Minimum van `L60` (`0x0831`) |
| `L189` | `0x08B2` | `0` | `0` | Bank 2 (`+0x80`): Minimum van `L61` (`0x0832`) |
| `L190` | `0x08B3` | `0` | `0` | Bank 2 (`+0x80`): Minimum van `L62` (`0x0833`) |
| `L191` | `0x08B4` | `0` | `0` | Bank 2 (`+0x80`): Minimum van `L63` (`0x0834`) |
| `L192` | `0x08B5` | `0` | `0` | Bank 2 (`+0x80`): Minimum van `L64` (`0x0835`) |
| `L193` | `0x08B6` | `0` | `0` | Bank 2 (`+0x80`): Minimum van `L65` (`0x0836`) |
| `L194` | `0x08B7` | `0` | `0` | Bank 2 (`+0x80`): Minimum van `L66` (`0x0837`) |
| `L195` | `0x08B8` | `0` | `0` | Bank 2 (`+0x80`): Minimum van `L67` (`0x0838`) |
| `L196` | `0x08B9` | `0` | `0` | Bank 2 (`+0x80`): Minimum van `L68` (`0x0839`) |
| `L197` | `0x08BA` | `0` | `0` | Bank 2 (`+0x80`): Minimum van `L69` (`0x083A`) |
| `L198` | `0x08BB` | `0` | `0` | Bank 2 (`+0x80`): Minimum van `L70` (`0x083B`) |
| `L199` | `0x08BC` | `0` | `0` | Bank 2 (`+0x80`): Minimum van `L71` (`0x083C`) |
| `L200` | `0x08BD` | `0` | `0` | Bank 2 (`+0x80`): Minimum van `L72` (`0x083D`) |
| `L201` | `0x08BE` | `0` | `0` | Bank 2 (`+0x80`): Minimum van `L73` (`0x083E`) |
| `L202` | `0x08BF` | `0` | `0` | Bank 2 (`+0x80`): Minimum van `L74` (`0x083F`) |
| `L203` | `0x08C0` | `65535` | `-1` | Bank 3 (`+0xC0`): Aanwezigheids-bitmasker / gereserveerd |
| `L204` | `0x08C1` | `65535` | `-1` | Bank 3 (`+0xC0`): Aanwezigheids-bitmasker / gereserveerd |
| `L205` | `0x08C2` | `65535` | `-1` | Bank 3 (`+0xC0`): Aanwezigheids-bitmasker / gereserveerd |
| `L206` | `0x08C3` | `3` | `3` | Bank 3 (`+0xC0`): Aanwezigheids-bitmasker / gereserveerd |
| `L207` | `0x08C4` | `0` | `0` | Bank 3 (`+0xC0`): Aanwezigheids-bitmasker / gereserveerd |
| `L208` | `0x08C5` | `0` | `0` | Bank 3 (`+0xC0`): Aanwezigheids-bitmasker / gereserveerd |
| `L209` | `0x08C6` | `0` | `0` | Bank 3 (`+0xC0`): Aanwezigheids-bitmasker / gereserveerd |
| `L210` | `0x08C7` | `0` | `0` | Bank 3 (`+0xC0`): Aanwezigheids-bitmasker / gereserveerd |
| `L211` | `0x08C8` | `0` | `0` | Bank 3 (`+0xC0`): Aanwezigheids-bitmasker / gereserveerd |
| `L212` | `0x08C9` | `0` | `0` | Bank 3 (`+0xC0`): Aanwezigheids-bitmasker / gereserveerd |
| `L213` | `0x08CA` | `0` | `0` | Bank 3 (`+0xC0`): Aanwezigheids-bitmasker / gereserveerd |
| `L214` | `0x08CB` | `0` | `0` | Bank 3 (`+0xC0`): Aanwezigheids-bitmasker / gereserveerd |
| `L215` | `0x08CC` | `0` | `0` | Bank 3 (`+0xC0`): Aanwezigheids-bitmasker / gereserveerd |
| `L216` | `0x08CD` | `0` | `0` | Bank 3 (`+0xC0`): Aanwezigheids-bitmasker / gereserveerd |
| `L217` | `0x08CE` | `0` | `0` | Bank 3 (`+0xC0`): Aanwezigheids-bitmasker / gereserveerd |
| `L218` | `0x08CF` | `0` | `0` | Bank 3 (`+0xC0`): Aanwezigheids-bitmasker / gereserveerd |

### 6.2 Ruwe Dump `0x0400–0x052F` (P-Parameter Maxima `P000–P303`) en `0x0600–0x072F` (P-Parameter Minima `P000–P303`)

| Parameter | Max-adres | Max (raw uint16) | Max (int16) | Min-adres | Min (raw uint16) | Min (int16) |
| :--- | :--- | :---: | :---: | :--- | :---: | :---: |
| `P000` (`0x0100`) | `0x0400` | `10` | `10` | `0x0600` | `0` | `0` |
| `P001` (`0x0101`) | `0x0401` | `1` | `1` | `0x0601` | `0` | `0` |
| `P002` (`0x0102`) | `0x0402` | `1` | `1` | `0x0602` | `0` | `0` |
| `P003` (`0x0103`) | `0x0403` | `1` | `1` | `0x0603` | `0` | `0` |
| `P004` (`0x0104`) | `0x0404` | `10` | `10` | `0x0604` | `0` | `0` |
| `P005` (`0x0105`) | `0x0405` | `4` | `4` | `0x0605` | `0` | `0` |
| `P006` (`0x0106`) | `0x0406` | `3` | `3` | `0x0606` | `0` | `0` |
| `P007` (`0x0107`) | `0x0407` | `1` | `1` | `0x0607` | `0` | `0` |
| `P008` (`0x0108`) | `0x0408` | `1` | `1` | `0x0608` | `0` | `0` |
| `P009` (`0x0109`) | `0x0409` | `1` | `1` | `0x0609` | `0` | `0` |
| `P010` (`0x010A`) | `0x040A` | `1` | `1` | `0x060A` | `0` | `0` |
| `P011` (`0x010B`) | `0x040B` | `150` | `150` | `0x060B` | `40` | `40` |
| `P012` (`0x010C`) | `0x040C` | `150` | `150` | `0x060C` | `40` | `40` |
| `P013` (`0x010D`) | `0x040D` | `65526` | `-10` | `0x060D` | `65486` | `-50` |
| `P014` (`0x010E`) | `0x040E` | `65526` | `-10` | `0x060E` | `65486` | `-50` |
| `P015` (`0x010F`) | `0x040F` | `120` | `120` | `0x060F` | `100` | `100` |
| `P016` (`0x0110`) | `0x0410` | `120` | `120` | `0x0610` | `90` | `90` |
| `P017` (`0x0111`) | `0x0411` | `60` | `60` | `0x0611` | `0` | `0` |
| `P018` (`0x0112`) | `0x0412` | `60` | `60` | `0x0612` | `0` | `0` |
| `P019` (`0x0113`) | `0x0413` | `60` | `60` | `0x0613` | `0` | `0` |
| `P020` (`0x0114`) | `0x0414` | `60` | `60` | `0x0614` | `0` | `0` |
| `P021` (`0x0115`) | `0x0415` | `10` | `10` | `0x0615` | `65496` | `-40` |
| `P022` (`0x0116`) | `0x0416` | `40` | `40` | `0x0616` | `65521` | `-15` |
| `P023` (`0x0117`) | `0x0417` | `30` | `30` | `0x0617` | `10` | `10` |
| `P024` (`0x0118`) | `0x0418` | `10` | `10` | `0x0618` | `65526` | `-10` |
| `P025` (`0x0119`) | `0x0419` | `10` | `10` | `0x0619` | `65526` | `-10` |
| `P026` (`0x011A`) | `0x041A` | `10` | `10` | `0x061A` | `0` | `0` |
| `P027` (`0x011B`) | `0x041B` | `10` | `10` | `0x061B` | `0` | `0` |
| `P028` (`0x011C`) | `0x041C` | `4` | `4` | `0x061C` | `0` | `0` |
| `P029` (`0x011D`) | `0x041D` | `10` | `10` | `0x061D` | `0` | `0` |
| `P030` (`0x011E`) | `0x041E` | `3` | `3` | `0x061E` | `0` | `0` |
| `P031` (`0x011F`) | `0x041F` | `120` | `120` | `0x061F` | `0` | `0` |
| `P032` (`0x0120`) | `0x0420` | `0` | `0` | `0x0620` | `65506` | `-30` |
| `P033` (`0x0121`) | `0x0421` | `20` | `20` | `0x0621` | `0` | `0` |
| `P034` (`0x0122`) | `0x0422` | `20` | `20` | `0x0622` | `0` | `0` |
| `P035` (`0x0123`) | `0x0423` | `30` | `30` | `0x0623` | `0` | `0` |
| `P036` (`0x0124`) | `0x0424` | `30` | `30` | `0x0624` | `0` | `0` |
| `P037` (`0x0125`) | `0x0425` | `2` | `2` | `0x0625` | `0` | `0` |
| `P038` (`0x0126`) | `0x0426` | `999` | `999` | `0x0626` | `64537` | `-999` |
| `P039` (`0x0127`) | `0x0427` | `2` | `2` | `0x0627` | `0` | `0` |
| `P040` (`0x0128`) | `0x0428` | `10` | `10` | `0x0628` | `65526` | `-10` |
| `P041` (`0x0129`) | `0x0429` | `10` | `10` | `0x0629` | `65526` | `-10` |
| `P042` (`0x012A`) | `0x042A` | `10` | `10` | `0x062A` | `65526` | `-10` |
| `P043` (`0x012B`) | `0x042B` | `1` | `1` | `0x062B` | `0` | `0` |
| `P044` (`0x012C`) | `0x042C` | `1` | `1` | `0x062C` | `0` | `0` |
| `P045` (`0x012D`) | `0x042D` | `256` | `256` | `0x062D` | `1` | `1` |
| `P046` (`0x012E`) | `0x042E` | `15` | `15` | `0x062E` | `0` | `0` |
| `P047` (`0x012F`) | `0x042F` | `12` | `12` | `0x062F` | `0` | `0` |
| `P048` (`0x0130`) | `0x0430` | `2` | `2` | `0x0630` | `0` | `0` |
| `P049` (`0x0131`) | `0x0431` | `100` | `100` | `0x0631` | `0` | `0` |
| `P050` (`0x0132`) | `0x0432` | `100` | `100` | `0x0632` | `65436` | `-100` |
| `P051` (`0x0133`) | `0x0433` | `60` | `60` | `0x0633` | `15` | `15` |
| `P052` (`0x0134`) | `0x0434` | `120` | `120` | `0x0634` | `40` | `40` |
| `P053` (`0x0135`) | `0x0435` | `120` | `120` | `0x0635` | `15` | `15` |
| `P054` (`0x0136`) | `0x0436` | `150` | `150` | `0x0636` | `65436` | `-100` |
| `P055` (`0x0137`) | `0x0437` | `120` | `120` | `0x0637` | `50` | `50` |
| `P056` (`0x0138`) | `0x0438` | `120` | `120` | `0x0638` | `20` | `20` |
| `P057` (`0x0139`) | `0x0439` | `60` | `60` | `0x0639` | `15` | `15` |
| `P058` (`0x013A`) | `0x043A` | `60` | `60` | `0x063A` | `15` | `15` |
| `P059` (`0x013B`) | `0x043B` | `60` | `60` | `0x063B` | `15` | `15` |
| `P060` (`0x013C`) | `0x043C` | `100` | `100` | `0x063C` | `65436` | `-100` |
| `P061` (`0x013D`) | `0x043D` | `120` | `120` | `0x063D` | `50` | `50` |
| `P062` (`0x013E`) | `0x043E` | `120` | `120` | `0x063E` | `15` | `15` |
| `P063` (`0x013F`) | `0x043F` | `60` | `60` | `0x063F` | `15` | `15` |
| `P064` (`0x0140`) | `0x0440` | `60` | `60` | `0x0640` | `15` | `15` |
| `P065` (`0x0141`) | `0x0441` | `60` | `60` | `0x0641` | `15` | `15` |
| `P066` (`0x0142`) | `0x0442` | `60` | `60` | `0x0642` | `20` | `20` |
| `P067` (`0x0143`) | `0x0443` | `60` | `60` | `0x0643` | `20` | `20` |
| `P068` (`0x0144`) | `0x0444` | `80` | `80` | `0x0644` | `20` | `20` |
| `P069` (`0x0145`) | `0x0445` | `60` | `60` | `0x0645` | `20` | `20` |
| `P070` (`0x0146`) | `0x0446` | `80` | `80` | `0x0646` | `20` | `20` |
| `P071` (`0x0147`) | `0x0447` | `80` | `80` | `0x0647` | `20` | `20` |
| `P072` (`0x0148`) | `0x0448` | `80` | `80` | `0x0648` | `20` | `20` |
| `P073` (`0x0149`) | `0x0449` | `480` | `480` | `0x0649` | `0` | `0` |
| `P074` (`0x014A`) | `0x044A` | `480` | `480` | `0x064A` | `0` | `0` |
| `P075` (`0x014B`) | `0x044B` | `480` | `480` | `0x064B` | `0` | `0` |
| `P076` (`0x014C`) | `0x044C` | `300` | `300` | `0x064C` | `0` | `0` |
| `P077` (`0x014D`) | `0x044D` | `300` | `300` | `0x064D` | `0` | `0` |
| `P078` (`0x014E`) | `0x044E` | `500` | `500` | `0x064E` | `100` | `100` |
| `P079` (`0x014F`) | `0x044F` | `300` | `300` | `0x064F` | `20` | `20` |
| `P080` (`0x0150`) | `0x0450` | `999` | `999` | `0x0650` | `64537` | `-999` |
| `P081` (`0x0151`) | `0x0451` | `999` | `999` | `0x0651` | `64537` | `-999` |
| `P082` (`0x0152`) | `0x0452` | `500` | `500` | `0x0652` | `100` | `100` |
| `P083` (`0x0153`) | `0x0453` | `480` | `480` | `0x0653` | `0` | `0` |
| `P084` (`0x0154`) | `0x0454` | `120` | `120` | `0x0654` | `10` | `10` |
| `P085` (`0x0155`) | `0x0455` | `900` | `900` | `0x0655` | `65336` | `-200` |
| `P086` (`0x0156`) | `0x0456` | `999` | `999` | `0x0656` | `64537` | `-999` |
| `P087` (`0x0157`) | `0x0457` | `999` | `999` | `0x0657` | `64537` | `-999` |
| `P088` (`0x0158`) | `0x0458` | `70` | `70` | `0x0658` | `20` | `20` |
| `P089` (`0x0159`) | `0x0459` | `60` | `60` | `0x0659` | `20` | `20` |
| `P090` (`0x015A`) | `0x045A` | `45` | `45` | `0x065A` | `0` | `0` |
| `P091` (`0x015B`) | `0x045B` | `30` | `30` | `0x065B` | `0` | `0` |
| `P092` (`0x015C`) | `0x045C` | `60` | `60` | `0x065C` | `0` | `0` |
| `P093` (`0x015D`) | `0x045D` | `20` | `20` | `0x065D` | `0` | `0` |
| `P094` (`0x015E`) | `0x045E` | `120` | `120` | `0x065E` | `10` | `10` |
| `P095` (`0x015F`) | `0x045F` | `1` | `1` | `0x065F` | `0` | `0` |
| `P096` (`0x0160`) | `0x0460` | `10` | `10` | `0x0660` | `0` | `0` |
| `P097` (`0x0161`) | `0x0461` | `1` | `1` | `0x0661` | `0` | `0` |
| `P098` (`0x0162`) | `0x0462` | `10` | `10` | `0x0662` | `65526` | `-10` |
| `P099` (`0x0163`) | `0x0463` | `10` | `10` | `0x0663` | `2` | `2` |
| `P100` (`0x0164`) | `0x0464` | `80` | `80` | `0x0664` | `20` | `20` |
| `P101` (`0x0165`) | `0x0465` | `1` | `1` | `0x0665` | `0` | `0` |
| `P102` (`0x0166`) | `0x0466` | `1` | `1` | `0x0666` | `0` | `0` |
| `P103` (`0x0167`) | `0x0467` | `10` | `10` | `0x0667` | `0` | `0` |
| `P104` (`0x0168`) | `0x0468` | `100` | `100` | `0x0668` | `20` | `20` |
| `P105` (`0x0169`) | `0x0469` | `60` | `60` | `0x0669` | `10` | `10` |
| `P106` (`0x016A`) | `0x046A` | `60` | `60` | `0x066A` | `10` | `10` |
| `P107` (`0x016B`) | `0x046B` | `60` | `60` | `0x066B` | `10` | `10` |
| `P108` (`0x016C`) | `0x046C` | `75` | `75` | `0x066C` | `30` | `30` |
| `P109` (`0x016D`) | `0x046D` | `30` | `30` | `0x066D` | `10` | `10` |
| `P110` (`0x016E`) | `0x046E` | `75` | `75` | `0x066E` | `30` | `30` |
| `P111` (`0x016F`) | `0x046F` | `30` | `30` | `0x066F` | `15` | `15` |
| `P112` (`0x0170`) | `0x0470` | `40` | `40` | `0x0670` | `20` | `20` |
| `P113` (`0x0171`) | `0x0471` | `25` | `25` | `0x0671` | `5` | `5` |
| `P114` (`0x0172`) | `0x0472` | `2` | `2` | `0x0672` | `1` | `1` |
| `P115` (`0x0173`) | `0x0473` | `2` | `2` | `0x0673` | `0` | `0` |
| `P116` (`0x0174`) | `0x0474` | `1` | `1` | `0x0674` | `0` | `0` |
| `P117` (`0x0175`) | `0x0475` | `10` | `10` | `0x0675` | `0` | `0` |
| `P118` (`0x0176`) | `0x0476` | `20` | `20` | `0x0676` | `0` | `0` |
| `P119` (`0x0177`) | `0x0477` | `20` | `20` | `0x0677` | `0` | `0` |
| `P120` (`0x0178`) | `0x0478` | `1` | `1` | `0x0678` | `0` | `0` |
| `P121` (`0x0179`) | `0x0479` | `120` | `120` | `0x0679` | `0` | `0` |
| `P122` (`0x017A`) | `0x047A` | `120` | `120` | `0x067A` | `0` | `0` |
| `P123` (`0x017B`) | `0x047B` | `120` | `120` | `0x067B` | `0` | `0` |
| `P124` (`0x017C`) | `0x047C` | `120` | `120` | `0x067C` | `0` | `0` |
| `P125` (`0x017D`) | `0x047D` | `120` | `120` | `0x067D` | `0` | `0` |
| `P126` (`0x017E`) | `0x047E` | `120` | `120` | `0x067E` | `0` | `0` |
| `P127` (`0x017F`) | `0x047F` | `120` | `120` | `0x067F` | `0` | `0` |
| `P128` (`0x0180`) | `0x0480` | `120` | `120` | `0x0680` | `0` | `0` |
| `P129` (`0x0181`) | `0x0481` | `120` | `120` | `0x0681` | `0` | `0` |
| `P130` (`0x0182`) | `0x0482` | `120` | `120` | `0x0682` | `0` | `0` |
| `P131` (`0x0183`) | `0x0483` | `120` | `120` | `0x0683` | `0` | `0` |
| `P132` (`0x0184`) | `0x0484` | `120` | `120` | `0x0684` | `0` | `0` |
| `P133` (`0x0185`) | `0x0485` | `1` | `1` | `0x0685` | `0` | `0` |
| `P134` (`0x0186`) | `0x0486` | `100` | `100` | `0x0686` | `0` | `0` |
| `P135` (`0x0187`) | `0x0487` | `50` | `50` | `0x0687` | `0` | `0` |
| `P136` (`0x0188`) | `0x0488` | `50` | `50` | `0x0688` | `65516` | `-20` |
| `P137` (`0x0189`) | `0x0489` | `999` | `999` | `0x0689` | `0` | `0` |
| `P138` (`0x018A`) | `0x048A` | `120` | `120` | `0x068A` | `40` | `40` |
| `P139` (`0x018B`) | `0x048B` | `2` | `2` | `0x068B` | `0` | `0` |
| `P140` (`0x018C`) | `0x048C` | `3` | `3` | `0x068C` | `0` | `0` |
| `P141` (`0x018D`) | `0x048D` | `60` | `60` | `0x068D` | `0` | `0` |
| `P142` (`0x018E`) | `0x048E` | `60` | `60` | `0x068E` | `0` | `0` |
| `P143` (`0x018F`) | `0x048F` | `60` | `60` | `0x068F` | `0` | `0` |
| `P144` (`0x0190`) | `0x0490` | `30` | `30` | `0x0690` | `65516` | `-20` |
| `P145` (`0x0191`) | `0x0491` | `10` | `10` | `0x0691` | `65506` | `-30` |
| `P146` (`0x0192`) | `0x0492` | `150` | `150` | `0x0692` | `0` | `0` |
| `P147` (`0x0193`) | `0x0493` | `3` | `3` | `0x0693` | `0` | `0` |
| `P148` (`0x0194`) | `0x0494` | `10` | `10` | `0x0694` | `0` | `0` |
| `P149` (`0x0195`) | `0x0495` | `85` | `85` | `0x0695` | `40` | `40` |
| `P150` (`0x0196`) | `0x0496` | `4` | `4` | `0x0696` | `1` | `1` |
| `P151` (`0x0197`) | `0x0497` | `40` | `40` | `0x0697` | `0` | `0` |
| `P152` (`0x0198`) | `0x0498` | `40` | `40` | `0x0698` | `0` | `0` |
| `P153` (`0x0199`) | `0x0499` | `75` | `75` | `0x0699` | `15` | `15` |
| `P154` (`0x019A`) | `0x049A` | `75` | `75` | `0x069A` | `15` | `15` |
| `P155` (`0x019B`) | `0x049B` | `9999` | `9999` | `0x069B` | `0` | `0` |
| `P156` (`0x019C`) | `0x049C` | `1` | `1` | `0x069C` | `0` | `0` |
| `P157` (`0x019D`) | `0x049D` | `99` | `99` | `0x069D` | `0` | `0` |
| `P158` (`0x019E`) | `0x049E` | `30` | `30` | `0x069E` | `65491` | `-45` |
| `P159` (`0x019F`) | `0x049F` | `150` | `150` | `0x069F` | `40` | `40` |
| `P160` (`0x01A0`) | `0x04A0` | `500` | `500` | `0x06A0` | `65036` | `-500` |
| `P161` (`0x01A1`) | `0x04A1` | `4` | `4` | `0x06A1` | `0` | `0` |
| `P162` (`0x01A2`) | `0x04A2` | `360` | `360` | `0x06A2` | `0` | `0` |
| `P163` (`0x01A3`) | `0x04A3` | `150` | `150` | `0x06A3` | `0` | `0` |
| `P164` (`0x01A4`) | `0x04A4` | `3` | `3` | `0x06A4` | `0` | `0` |
| `P165` (`0x01A5`) | `0x04A5` | `15` | `15` | `0x06A5` | `1` | `1` |
| `P166` (`0x01A6`) | `0x04A6` | `15` | `15` | `0x06A6` | `1` | `1` |
| `P167` (`0x01A7`) | `0x04A7` | `15` | `15` | `0x06A7` | `1` | `1` |
| `P168` (`0x01A8`) | `0x04A8` | `100` | `100` | `0x06A8` | `1` | `1` |
| `P169` (`0x01A9`) | `0x04A9` | `100` | `100` | `0x06A9` | `1` | `1` |
| `P170` (`0x01AA`) | `0x04AA` | `60` | `60` | `0x06AA` | `3` | `3` |
| `P171` (`0x01AB`) | `0x04AB` | `0` | `0` | `0x06AB` | `65486` | `-50` |
| `P172` (`0x01AC`) | `0x04AC` | `70` | `70` | `0x06AC` | `40` | `40` |
| `P173` (`0x01AD`) | `0x04AD` | `65` | `65` | `0x06AD` | `20` | `20` |
| `P174` (`0x01AE`) | `0x04AE` | `500` | `500` | `0x06AE` | `0` | `0` |
| `P175` (`0x01AF`) | `0x04AF` | `240` | `240` | `0x06AF` | `1` | `1` |
| `P176` (`0x01B0`) | `0x04B0` | `999` | `999` | `0x06B0` | `0` | `0` |
| `P177` (`0x01B1`) | `0x04B1` | `80` | `80` | `0x06B1` | `0` | `0` |
| `P178` (`0x01B2`) | `0x04B2` | `120` | `120` | `0x06B2` | `40` | `40` |
| `P179` (`0x01B3`) | `0x04B3` | `40` | `40` | `0x06B3` | `0` | `0` |
| `P180` (`0x01B4`) | `0x04B4` | `40` | `40` | `0x06B4` | `0` | `0` |
| `P181` (`0x01B5`) | `0x04B5` | `2` | `2` | `0x06B5` | `0` | `0` |
| `P182` (`0x01B6`) | `0x04B6` | `4` | `4` | `0x06B6` | `0` | `0` |
| `P183` (`0x01B7`) | `0x04B7` | `999` | `999` | `0x06B7` | `0` | `0` |
| `P184` (`0x01B8`) | `0x04B8` | `120` | `120` | `0x06B8` | `0` | `0` |
| `P185` (`0x01B9`) | `0x04B9` | `120` | `120` | `0x06B9` | `1` | `1` |
| `P186` (`0x01BA`) | `0x04BA` | `120` | `120` | `0x06BA` | `1` | `1` |
| `P187` (`0x01BB`) | `0x04BB` | `120` | `120` | `0x06BB` | `1` | `1` |
| `P188` (`0x01BC`) | `0x04BC` | `120` | `120` | `0x06BC` | `1` | `1` |
| `P189` (`0x01BD`) | `0x04BD` | `120` | `120` | `0x06BD` | `1` | `1` |
| `P190` (`0x01BE`) | `0x04BE` | `120` | `120` | `0x06BE` | `1` | `1` |
| `P191` (`0x01BF`) | `0x04BF` | `120` | `120` | `0x06BF` | `1` | `1` |
| `P192` (`0x01C0`) | `0x04C0` | `120` | `120` | `0x06C0` | `1` | `1` |
| `P193` (`0x01C1`) | `0x04C1` | `120` | `120` | `0x06C1` | `1` | `1` |
| `P194` (`0x01C2`) | `0x04C2` | `60` | `60` | `0x06C2` | `0` | `0` |
| `P195` (`0x01C3`) | `0x04C3` | `60` | `60` | `0x06C3` | `0` | `0` |
| `P196` (`0x01C4`) | `0x04C4` | `60` | `60` | `0x06C4` | `0` | `0` |
| `P197` (`0x01C5`) | `0x04C5` | `60` | `60` | `0x06C5` | `0` | `0` |
| `P198` (`0x01C6`) | `0x04C6` | `60` | `60` | `0x06C6` | `0` | `0` |
| `P199` (`0x01C7`) | `0x04C7` | `60` | `60` | `0x06C7` | `0` | `0` |
| `P200` (`0x01C8`) | `0x04C8` | `60` | `60` | `0x06C8` | `0` | `0` |
| `P201` (`0x01C9`) | `0x04C9` | `60` | `60` | `0x06C9` | `0` | `0` |
| `P202` (`0x01CA`) | `0x04CA` | `60` | `60` | `0x06CA` | `0` | `0` |
| `P203` (`0x01CB`) | `0x04CB` | `60` | `60` | `0x06CB` | `0` | `0` |
| `P204` (`0x01CC`) | `0x04CC` | `10` | `10` | `0x06CC` | `65526` | `-10` |
| `P205` (`0x01CD`) | `0x04CD` | `10` | `10` | `0x06CD` | `65526` | `-10` |
| `P206` (`0x01CE`) | `0x04CE` | `10` | `10` | `0x06CE` | `65526` | `-10` |
| `P207` (`0x01CF`) | `0x04CF` | `10` | `10` | `0x06CF` | `65526` | `-10` |
| `P208` (`0x01D0`) | `0x04D0` | `500` | `500` | `0x06D0` | `65526` | `-10` |
| `P209` (`0x01D1`) | `0x04D1` | `500` | `500` | `0x06D1` | `65526` | `-10` |
| `P210` (`0x01D2`) | `0x04D2` | `100` | `100` | `0x06D2` | `65526` | `-10` |
| `P211` (`0x01D3`) | `0x04D3` | `100` | `100` | `0x06D3` | `65526` | `-10` |
| `P212` (`0x01D4`) | `0x04D4` | `100` | `100` | `0x06D4` | `65526` | `-10` |
| `P213` (`0x01D5`) | `0x04D5` | `100` | `100` | `0x06D5` | `65526` | `-10` |
| `P214` (`0x01D6`) | `0x04D6` | `500` | `500` | `0x06D6` | `0` | `0` |
| `P215` (`0x01D7`) | `0x04D7` | `500` | `500` | `0x06D7` | `0` | `0` |
| `P216` (`0x01D8`) | `0x04D8` | `500` | `500` | `0x06D8` | `0` | `0` |
| `P217` (`0x01D9`) | `0x04D9` | `500` | `500` | `0x06D9` | `0` | `0` |
| `P218` (`0x01DA`) | `0x04DA` | `500` | `500` | `0x06DA` | `0` | `0` |
| `P219` (`0x01DB`) | `0x04DB` | `500` | `500` | `0x06DB` | `0` | `0` |
| `P220` (`0x01DC`) | `0x04DC` | `500` | `500` | `0x06DC` | `0` | `0` |
| `P221` (`0x01DD`) | `0x04DD` | `500` | `500` | `0x06DD` | `0` | `0` |
| `P222` (`0x01DE`) | `0x04DE` | `500` | `500` | `0x06DE` | `0` | `0` |
| `P223` (`0x01DF`) | `0x04DF` | `500` | `500` | `0x06DF` | `0` | `0` |
| `P224` (`0x01E0`) | `0x04E0` | `60` | `60` | `0x06E0` | `65526` | `-10` |
| `P225` (`0x01E1`) | `0x04E1` | `60` | `60` | `0x06E1` | `65526` | `-10` |
| `P226` (`0x01E2`) | `0x04E2` | `60` | `60` | `0x06E2` | `65526` | `-10` |
| `P227` (`0x01E3`) | `0x04E3` | `10` | `10` | `0x06E3` | `65526` | `-10` |
| `P228` (`0x01E4`) | `0x04E4` | `10` | `10` | `0x06E4` | `65526` | `-10` |
| `P229` (`0x01E5`) | `0x04E5` | `10` | `10` | `0x06E5` | `65526` | `-10` |
| `P230` (`0x01E6`) | `0x04E6` | `10` | `10` | `0x06E6` | `65526` | `-10` |
| `P231` (`0x01E7`) | `0x04E7` | `10` | `10` | `0x06E7` | `65526` | `-10` |
| `P232` (`0x01E8`) | `0x04E8` | `10` | `10` | `0x06E8` | `65526` | `-10` |
| `P233` (`0x01E9`) | `0x04E9` | `10` | `10` | `0x06E9` | `65526` | `-10` |
| `P234` (`0x01EA`) | `0x04EA` | `500` | `500` | `0x06EA` | `0` | `0` |
| `P235` (`0x01EB`) | `0x04EB` | `500` | `500` | `0x06EB` | `0` | `0` |
| `P236` (`0x01EC`) | `0x04EC` | `500` | `500` | `0x06EC` | `0` | `0` |
| `P237` (`0x01ED`) | `0x04ED` | `500` | `500` | `0x06ED` | `0` | `0` |
| `P238` (`0x01EE`) | `0x04EE` | `500` | `500` | `0x06EE` | `0` | `0` |
| `P239` (`0x01EF`) | `0x04EF` | `500` | `500` | `0x06EF` | `0` | `0` |
| `P240` (`0x01F0`) | `0x04F0` | `500` | `500` | `0x06F0` | `0` | `0` |
| `P241` (`0x01F1`) | `0x04F1` | `500` | `500` | `0x06F1` | `0` | `0` |
| `P242` (`0x01F2`) | `0x04F2` | `500` | `500` | `0x06F2` | `0` | `0` |
| `P243` (`0x01F3`) | `0x04F3` | `500` | `500` | `0x06F3` | `0` | `0` |
| `P244` (`0x01F4`) | `0x04F4` | `100` | `100` | `0x06F4` | `0` | `0` |
| `P245` (`0x01F5`) | `0x04F5` | `100` | `100` | `0x06F5` | `0` | `0` |
| `P246` (`0x01F6`) | `0x04F6` | `60` | `60` | `0x06F6` | `0` | `0` |
| `P247` (`0x01F7`) | `0x04F7` | `500` | `500` | `0x06F7` | `0` | `0` |
| `P248` (`0x01F8`) | `0x04F8` | `60` | `60` | `0x06F8` | `0` | `0` |
| `P249` (`0x01F9`) | `0x04F9` | `500` | `500` | `0x06F9` | `0` | `0` |
| `P250` (`0x01FA`) | `0x04FA` | `10` | `10` | `0x06FA` | `65526` | `-10` |
| `P251` (`0x01FB`) | `0x04FB` | `50` | `50` | `0x06FB` | `0` | `0` |
| `P252` (`0x01FC`) | `0x04FC` | `10` | `10` | `0x06FC` | `65526` | `-10` |
| `P253` (`0x01FD`) | `0x04FD` | `50` | `50` | `0x06FD` | `0` | `0` |
| `P254` (`0x01FE`) | `0x04FE` | `1` | `1` | `0x06FE` | `0` | `0` |
| `P255` (`0x01FF`) | `0x04FF` | `2` | `2` | `0x06FF` | `0` | `0` |
| `P256` (`0x0200`) | `0x0500` | `999` | `999` | `0x0700` | `30` | `30` |
| `P257` (`0x0201`) | `0x0501` | `3` | `3` | `0x0701` | `0` | `0` |
| `P258` (`0x0202`) | `0x0502` | `20` | `20` | `0x0702` | `1` | `1` |
| `P259` (`0x0203`) | `0x0503` | `180` | `180` | `0x0703` | `30` | `30` |
| `P260` (`0x0204`) | `0x0504` | `99` | `99` | `0x0704` | `50` | `50` |
| `P261` (`0x0205`) | `0x0505` | `99` | `99` | `0x0705` | `20` | `20` |
| `P262` (`0x0206`) | `0x0506` | `2` | `2` | `0x0706` | `0` | `0` |
| `P263` (`0x0207`) | `0x0507` | `240` | `240` | `0x0707` | `3` | `3` |
| `P264` (`0x0208`) | `0x0508` | `100` | `100` | `0x0708` | `30` | `30` |
| `P265` (`0x0209`) | `0x0509` | `10` | `10` | `0x0709` | `1` | `1` |
| `P266` (`0x020A`) | `0x050A` | `1` | `1` | `0x070A` | `0` | `0` |
| `P267` (`0x020B`) | `0x050B` | `30` | `30` | `0x070B` | `1` | `1` |
| `P268` (`0x020C`) | `0x050C` | `1` | `1` | `0x070C` | `0` | `0` |
| `P269` (`0x020D`) | `0x050D` | `125` | `125` | `0x070D` | `95` | `95` |
| `P270` (`0x020E`) | `0x050E` | `125` | `125` | `0x070E` | `85` | `85` |
| `P271` (`0x020F`) | `0x050F` | `500` | `500` | `0x070F` | `50` | `50` |
| `P272` (`0x0210`) | `0x0510` | `500` | `500` | `0x0710` | `0` | `0` |
| `P273` (`0x0211`) | `0x0511` | `500` | `500` | `0x0711` | `0` | `0` |
| `P274` (`0x0212`) | `0x0512` | `500` | `500` | `0x0712` | `0` | `0` |
| `P275` (`0x0213`) | `0x0513` | `240` | `240` | `0x0713` | `0` | `0` |
| `P276` (`0x0214`) | `0x0514` | `240` | `240` | `0x0714` | `0` | `0` |
| `P277` (`0x0215`) | `0x0515` | `200` | `200` | `0x0715` | `0` | `0` |
| `P278` (`0x0216`) | `0x0516` | `200` | `200` | `0x0716` | `0` | `0` |
| `P279` (`0x0217`) | `0x0517` | `200` | `200` | `0x0717` | `0` | `0` |
| `P280` (`0x0218`) | `0x0518` | `30` | `30` | `0x0718` | `0` | `0` |
| `P281` (`0x0219`) | `0x0519` | `30` | `30` | `0x0719` | `0` | `0` |
| `P282` (`0x021A`) | `0x051A` | `100` | `100` | `0x071A` | `5` | `5` |
| `P283` (`0x021B`) | `0x051B` | `1` | `1` | `0x071B` | `0` | `0` |
| `P284` (`0x021C`) | `0x051C` | `100` | `100` | `0x071C` | `0` | `0` |
| `P285` (`0x021D`) | `0x051D` | `100` | `100` | `0x071D` | `0` | `0` |
| `P286` (`0x021E`) | `0x051E` | `100` | `100` | `0x071E` | `0` | `0` |
| `P287` (`0x021F`) | `0x051F` | `100` | `100` | `0x071F` | `0` | `0` |
| `P288` (`0x0220`) | `0x0520` | `100` | `100` | `0x0720` | `0` | `0` |
| `P289` (`0x0221`) | `0x0521` | `10` | `10` | `0x0721` | `0` | `0` |
| `P290` (`0x0222`) | `0x0522` | `10` | `10` | `0x0722` | `0` | `0` |
| `P291` (`0x0223`) | `0x0523` | `10` | `10` | `0x0723` | `0` | `0` |
| `P292` (`0x0224`) | `0x0524` | `10` | `10` | `0x0724` | `0` | `0` |
| `P293` (`0x0225`) | `0x0525` | `10` | `10` | `0x0725` | `0` | `0` |
| `P294` (`0x0226`) | `0x0526` | `100` | `100` | `0x0726` | `0` | `0` |
| `P295` (`0x0227`) | `0x0527` | `75` | `75` | `0x0727` | `20` | `20` |
| `P296` (`0x0228`) | `0x0528` | `75` | `75` | `0x0728` | `20` | `20` |
| `P297` (`0x0229`) | `0x0529` | `20` | `20` | `0x0729` | `0` | `0` |
| `P298` (`0x022A`) | `0x052A` | `30` | `30` | `0x072A` | `65526` | `-10` |
| `P299` (`0x022B`) | `0x052B` | `30` | `30` | `0x072B` | `65526` | `-10` |
| `P300` (`0x022C`) | `0x052C` | `30` | `30` | `0x072C` | `65526` | `-10` |
| `P301` (`0x022D`) | `0x052D` | `0` | `0` | `0x072D` | `0` | `0` |
| `P302` (`0x022E`) | `0x052E` | `0` | `0` | `0x072E` | `0` | `0` |
| `P303` (`0x022F`) | `0x052F` | `0` | `0` | `0x072F` | `0` | `0` |

## 3.4 Transcriptie van alle 304 P-posities (`P000–P303`, `0x0100–0x022F`)

| Param | Adres | Huidig | Min-adres | HW Min | Max-adres | HW Max | Code Bereik | Eenheid | Naam / Beschrijving |
| :--- | :--- | :---: | :--- | :---: | :--- | :---: | :---: | :---: | :--- |
| `P000` | `0x0100` | `0` | `0x0600` | `0` | `0x0400` | `10` | `0..1` | — | **T1 Ambient temp sensor** (0=enable, 1=disable) *(HW wijkt af)* |
| `P001` | `0x0101` | `0` | `0x0601` | `0` | `0x0401` | `1` | `0..1` | — | **High voltage switch** (0=enable, 1=disable) |
| `P002` | `0x0102` | `0` | `0x0602` | `0` | `0x0402` | `1` | `0..1` | — | **Low pressure switch** (0=enable, 1=disable) |
| `P003` | `0x0103` | `1` | `0x0603` | `0` | `0x0403` | `1` | `0..1` | — | **Water flow switch** (0=enable, 1=disable. NB: R290 doc zegt range 1~2, Adlar R32 is 0/1) |
| `P004` | `0x0104` | `1` | `0x0604` | `0` | `0x0404` | `10` | `0..1` | — | **Thermal overload protection** (0=enable, 1=disable) *(HW wijkt af)* |
| `P005` | `0x0105` | `1` | `0x0605` | `0` | `0x0405` | `4` | `0..3` | — | **Linkage switch (host)** (0=enable, 1=disable, 2=thermostatic, 3=heating thermostat) *(HW wijkt af)* |
| `P006` | `0x0106` | `3` | `0x0606` | `0` | `0x0406` | `3` | `0..2` | — | **Fan type** (0=AC, 1=DC, 2=EC) *(HW wijkt af)* |
| `P007` | `0x0107` | `0` | `0x0607` | `0` | `0x0407` | `1` | `0..1` | — | **High voltage lock** (0=3 locks, 1=no lock) |
| `P008` | `0x0108` | `0` | `0x0608` | `0` | `0x0408` | `1` | `0..1` | — | **Low voltage lock** (0=3 locks, 1=no lock) |
| `P009` | `0x0109` | `0` | `0x0609` | `0` | `0x0409` | `1` | `0..1` | — | **Exhaust lock** (0=3 locks, 1=no lock) |
| `P010` | `0x010A` | `0` | `0x060A` | `0` | `0x040A` | `1` | `0..1` | — | **Water flow lock** (0=3 locks, 1=no lock) |
| `P011` | `0x010B` | `65` | `0x060B` | `40` | `0x040B` | `150` | `40..150` | °C | **High pressure protection value** |
| `P012` | `0x010C` | `59` | `0x060C` | `40` | `0x040C` | `150` | `40..150` | °C | **High pressure freq limit** (Must be P11-5) |
| `P013` | `0x010D` | `-40` | `0x060D` | `-50` | `0x040D` | `-10` | `-50..-10` | °C | **Low pressure protection value** |
| `P014` | `0x010E` | `-35` | `0x060E` | `-50` | `0x040E` | `-10` | `-50..-10` | °C | **Low pressure freq limit** |
| `P015` | `0x010F` | `115` | `0x060F` | `100` | `0x040F` | `120` | `100..130` | °C | **Exhaust temp protection** *(HW wijkt af)* |
| `P016` | `0x0110` | `95` | `0x0610` | `90` | `0x0410` | `120` | `90..120` | °C | **Exhaust temp freq limit** (Must be  P15-10) |
| `P017` | `0x0111` | `37` | `0x0611` | `0` | `0x0411` | `60` | `0..60` | °C | **Cooling fan speed-up value** |
| `P018` | `0x0112` | `32` | `0x0612` | `0` | `0x0412` | `60` | `0..60` | °C | **Cooling fan speed-down value** |
| `P019` | `0x0113` | `12` | `0x0613` | `0` | `0x0413` | `60` | `0..60` | °C | **Heating fan speed-down value** |
| `P020` | `0x0114` | `8` | `0x0614` | `0` | `0x0414` | `60` | `0..60` | °C | **Heating fan speed-up value** |
| `P021` | `0x0115` | `-26` | `0x0615` | `-40` | `0x0415` | `10` | `-40..-10` | °C | **Low temp unit prohibit start** *(HW wijkt af)* |
| `P022` | `0x0116` | `0` | `0x0616` | `-15` | `0x0416` | `40` | `-15..40` | °C | **E-heating start ambient** (If Ambient Temp P22 enter defrost. R290 doc noemt dit ook "Unit no starting" (misleidend)) |
| `P023` | `0x0117` | `12` | `0x0617` | `10` | `0x0417` | `30` | `10..30` | °C | **Excessive temp diff alarm** |
| `P024` | `0x0118` | `2` | `0x0618` | `-10` | `0x0418` | `10` | `-10..10` | °C | **Return water compensation** (Sensor offset correctie. Adlar Aurora II: T6 (return/inlet)) |
| `P025` | `0x0119` | `2` | `0x0619` | `-10` | `0x0419` | `10` | `-10..10` | °C | **Outlet water compensation** (Sensor offset correctie. Adlar Aurora II: T7 (outlet/discharge)) |
| `P026` | `0x011A` | `5` | `0x061A` | `0` | `0x041A` | `10` | `0..10` | °C | **H&C Hysteresis return differential value** |
| `P027` | `0x011B` | `0` | `0x061B` | `0` | `0x041B` | `10` | `0..10` | °C | **Floor heating return differential value** |
| `P028` | `0x011C` | `0` | `0x061C` | `0` | `0x041C` | `4` | `0..4` | — | **Pump mode at shutdown** (0=keep running, 1=stop, 2=cooling only, 3=AC/heating only, 4=floor only) |
| `P029` | `0x011D` | `2` | `0x061D` | `0` | `0x041D` | `10` | `0..10` | min | **Antifreeze pump running time** |
| `P030` | `0x011E` | `0` | `0x061E` | `0` | `0x041E` | `3` | `0..3` | — | **Defrost mode** (0=smart, 1=timing, 2=fast, 3=dew point) |
| `P031` | `0x011F` | `45` | `0x061F` | `0` | `0x041F` | `120` | `0..120` | — | **Defrost accumulated threshold** |
| `P032` | `0x0120` | `-5` | `0x0620` | `-30` | `0x0420` | `0` | `-30..0` | °C | **Defrost entry coil temp** |
| `P033` | `0x0121` | `9` | `0x0621` | `0` | `0x0421` | `20` | `0..20` | °C | **Defrost entry temp diff 1** |
| `P034` | `0x0122` | `9` | `0x0622` | `0` | `0x0422` | `20` | `0..20` | °C | **Defrost entry temp diff 2** |
| `P035` | `0x0123` | `10` | `0x0623` | `0` | `0x0423` | `30` | `0..30` | min | **Max defrost time** |
| `P036` | `0x0124` | `12` | `0x0624` | `0` | `0x0424` | `30` | `0..30` | °C | **Defrost exit coil temp** |
| `P037` | `0x0125` | `0` | `0x0625` | `0` | `0x0425` | `2` | `0..2` | — | **Shutdown mode (aka "Darwin")** (0=Smart (unit decides), 1=Direct/Darwin (immediate off at target), 2=Refrig Smart) |
| `P038` | `0x0126` | `300` | `0x0626` | `-999` | `0x0426` | `999` | `-999..999` | — | **Heating main valve initial opening constant** |
| `P039` | `0x0127` | `0` | `0x0627` | `0` | `0x0427` | `2` | `0..1` | — | **Pressure sensor settings** (0=enable, 1=disable) *(HW wijkt af)* |
| `P040` | `0x0128` | `-2` | `0x0628` | `-10` | `0x0428` | `10` | `-5..10` | °C | **EEV cooling target superheat correction** *(HW wijkt af)* |
| `P041` | `0x0129` | `2` | `0x0629` | `-10` | `0x0429` | `10` | `-10..10` | °C | **EEV heating HP freq limit correction** |
| `P042` | `0x012A` | `-1` | `0x062A` | `-10` | `0x042A` | `10` | `-5..10` | °C | **EEV heating target superheat correction** *(HW wijkt af)* |
| `P043` | `0x012B` | `0` | `0x062B` | `0` | `0x042B` | `1` | `0..1` | — | **MV switch setting** (0=disable, 1=enable) |
| `P044` | `0x012C` | `0` | `0x062C` | `0` | `0x042C` | `1` | `0..1` | — | **Water flow switch failure detect** (0=enable, 1=disable) |
| `P045` | `0x012D` | `1` | `0x062D` | `1` | `0x042D` | `256` | `1..16` | — | **Modbus slave address** *(HW wijkt af)* |
| `P046` | `0x012E` | `8` | `0x062E` | `0` | `0x042E` | `15` | `0..15` | °C | **EVI liquid injection valve return diff** |
| `P047` | `0x012F` | `1` | `0x062F` | `0` | `0x042F` | `12` | `0..12` | — | **EVI target superheat constant** |
| `P048` | `0x0130` | `0` | `0x0630` | `0` | `0x0430` | `2` | `0..1` | — | **Enable DHW tank temp sensor** (0=disable, 1=enable) *(HW wijkt af)* |
| `P049` | `0x0131` | `0` | `0x0631` | `0` | `0x0431` | `100` | `30..100` | % | **Hot water freq running percentage** *(HW wijkt af)* |
| `P050` | `0x0132` | `10` | `0x0632` | `-100` | `0x0432` | `100` | `-100..100` | — | **Cooling target freq constant A** |
| `P051` | `0x0133` | `30` | `0x0633` | `15` | `0x0433` | `60` | `15..60` | Hz | **Cooling min freq** |
| `P052` | `0x0134` | `70` | `0x0634` | `40` | `0x0434` | `120` | `40..120` | Hz | **Cooling target freq upper** |
| `P053` | `0x0135` | `42` | `0x0635` | `15` | `0x0435` | `120` | `15..120` | Hz | **Cooling target freq lower** (Must be  P52) |
| `P054` | `0x0136` | `85` | `0x0636` | `-100` | `0x0436` | `150` | `-100..100` | — | **Heating target freq constant B** *(HW wijkt af)* |
| `P055` | `0x0137` | `85` | `0x0637` | `50` | `0x0437` | `120` | `50..120` | Hz | **Heating target freq upper** |
| `P056` | `0x0138` | `50` | `0x0638` | `20` | `0x0438` | `120` | `20..120` | Hz | **Heating target freq lower** |
| `P057` | `0x0139` | `20` | `0x0639` | `15` | `0x0439` | `60` | `15..60` | Hz | **Heating min freq (ambient > 0°C)** ( COP: lagere waarde = beter COP bij mild weer) |
| `P058` | `0x013A` | `35` | `0x063A` | `15` | `0x043A` | `60` | `15..60` | Hz | **Heating min freq (-10°C  ambient < 0°C)** |
| `P059` | `0x013B` | `40` | `0x063B` | `15` | `0x043B` | `60` | `15..60` | Hz | **Heating min freq (ambient < -10°C)** |
| `P060` | `0x013C` | `85` | `0x063C` | `-100` | `0x043C` | `100` | `-100..100` | — | **Hot water target freq constant** |
| `P061` | `0x013D` | `85` | `0x063D` | `50` | `0x043D` | `120` | `50..120` | Hz | **Hot water target freq upper** |
| `P062` | `0x013E` | `50` | `0x063E` | `15` | `0x043E` | `120` | `15..120` | Hz | **Hot water target freq lower** (Must be  P61) |
| `P063` | `0x013F` | `40` | `0x063F` | `15` | `0x043F` | `60` | `15..60` | Hz | **Hot water min freq (ambient > 0°C)** ( COP: lagere waarde = beter COP bij mild weer) |
| `P064` | `0x0140` | `40` | `0x0640` | `15` | `0x0440` | `60` | `15..60` | Hz | **Hot water min freq (-10°C  ambient < 0°C)** |
| `P065` | `0x0141` | `45` | `0x0641` | `15` | `0x0441` | `60` | `15..60` | Hz | **Hot water min freq (ambient < -10°C)** |
| `P066` | `0x0142` | `40` | `0x0642` | `20` | `0x0442` | `60` | `20..60` | Hz | **DC fan initial freq** (RPM = freq  15. Range 300900 RPM) |
| `P067` | `0x0143` | `20` | `0x0643` | `20` | `0x0443` | `60` | `20..60` | Hz | **DC fan heating min freq** |
| `P068` | `0x0144` | `50` | `0x0644` | `20` | `0x0444` | `80` | `20..80` | Hz | **DC fan heating max freq** |
| `P069` | `0x0145` | `20` | `0x0645` | `20` | `0x0445` | `60` | `20..60` | Hz | **DC fan cooling min freq** |
| `P070` | `0x0146` | `55` | `0x0646` | `20` | `0x0446` | `80` | `20..80` | Hz | **DC fan cooling max freq** |
| `P071` | `0x0147` | `45` | `0x0647` | `20` | `0x0447` | `80` | `20..80` | Hz | **EEV enthalpy control on frequency** |
| `P072` | `0x0148` | `35` | `0x0648` | `20` | `0x0448` | `80` | `20..80` | Hz | **EEV enthalpy stop increase frequency** |
| `P073` | `0x0149` | `400` | `0x0649` | `0` | `0x0449` | `480` | `20..480` | P | **EEV cooling main valve opening 1** *(HW wijkt af)* |
| `P074` | `0x014A` | `300` | `0x064A` | `0` | `0x044A` | `480` | `20..480` | P | **EEV cooling main valve opening 2** *(HW wijkt af)* |
| `P075` | `0x014B` | `350` | `0x064B` | `0` | `0x044B` | `480` | `20..480` | P | **EEV cooling main valve opening 3** *(HW wijkt af)* |
| `P076` | `0x014C` | `100` | `0x064C` | `0` | `0x044C` | `300` | `0..300` | P | **EEV cooling main valve min opening** |
| `P077` | `0x014D` | `40` | `0x064D` | `0` | `0x044D` | `300` | `0..300` | P | **EEV heating main valve min opening** |
| `P078` | `0x014E` | `480` | `0x064E` | `100` | `0x044E` | `500` | `100..500` | P | **EEV main valve max opening** |
| `P079` | `0x014F` | `80` | `0x064F` | `20` | `0x044F` | `300` | `20..300` | — | **EEV main valve initial opening const c** |
| `P080` | `0x0150` | `60` | `0x0650` | `-999` | `0x0450` | `999` | `-999..999` | — | **EEV main valve initial opening coeff a** |
| `P081` | `0x0151` | `40` | `0x0651` | `-999` | `0x0451` | `999` | `-999..999` | — | **EEV main valve initial opening coeff b** |
| `P082` | `0x0152` | `480` | `0x0652` | `100` | `0x0452` | `500` | `100..500` | P | **EEV aux valve max opening** |
| `P083` | `0x0153` | `30` | `0x0653` | `0` | `0x0453` | `480` | `50..300` | P | **EEV aux valve min opening** *(HW wijkt af)* |
| `P084` | `0x0154` | `40` | `0x0654` | `10` | `0x0454` | `120` | `10..120` | s | **EEV main valve regulation period** |
| `P085` | `0x0155` | `50` | `0x0655` | `-200` | `0x0455` | `900` | `-200..900` | — | **EEV aux valve initial opening const c** |
| `P086` | `0x0156` | `30` | `0x0656` | `-999` | `0x0456` | `999` | `-999..999` | — | **EEV aux valve initial opening coeff a** |
| `P087` | `0x0157` | `20` | `0x0657` | `-999` | `0x0457` | `999` | `-999..999` | — | **EEV aux valve initial opening coeff b** |
| `P088` | `0x0158` | `50` | `0x0658` | `20` | `0x0458` | `70` | `20..70` | Hz | **Silent mode compressor freq** |
| `P089` | `0x0159` | `40` | `0x0659` | `20` | `0x0459` | `60` | `20..60` | Hz | **Silent mode fan freq** |
| `P090` | `0x015A` | `23` | `0x065A` | `0` | `0x045A` | `45` | `0..45` | °C | **EVI entry ambient temperature** |
| `P091` | `0x015B` | `3` | `0x065B` | `0` | `0x045B` | `30` | `0..30` | min | **EVI forbid entry time** |
| `P092` | `0x015C` | `2` | `0x065C` | `0` | `0x045C` | `60` | `0..60` | °C | **EVI entry temperature difference** |
| `P093` | `0x015D` | `1` | `0x065D` | `0` | `0x045D` | `20` | `0..20` | min | **EVI compressor run time to enter** |
| `P094` | `0x015E` | `40` | `0x065E` | `10` | `0x045E` | `120` | `10..120` | s | **EVI aux valve adjustment cycle** |
| `P095` | `0x015F` | `0` | `0x065F` | `0` | `0x045F` | `1` | `0..1` | — | **Network pump mode** (0=shared, 1=independent) |
| `P096` | `0x0160` | `5` | `0x0660` | `0` | `0x0460` | `10` | `0..10` | °C | **DHW differential value** |
| `P097` | `0x0161` | `0` | `0x0661` | `0` | `0x0461` | `1` | `0..1` | — | **Tank temperature auto compensation** (0=enable, 1=disable) |
| `P098` | `0x0162` | `0` | `0x0662` | `-10` | `0x0462` | `10` | `-10..10` | °C | **Tank temperature manual compensation** |
| `P099` | `0x0163` | `7` | `0x0663` | `2` | `0x0463` | `10` | `2..10` | °C | **Pump speed regulation temp diff** |
| `P100` | `0x0164` | `70` | `0x0664` | `20` | `0x0464` | `80` | `20..80` | % | **PWM pump minimum speed** |
| `P101` | `0x0165` | `1` | `0x0665` | `0` | `0x0465` | `1` | `0..1` | — | **Pump control mode** (0=AC(on/off), 1=DC(PWM)) |
| `P102` | `0x0166` | `0` | `0x0666` | `0` | `0x0466` | `1` | `0..1` | — | **Four-way valve control mode** (0=cooling power on, 1=heating power on) |
| `P103` | `0x0167` | `3` | `0x0667` | `0` | `0x0467` | `10` | `0..10` | min | **Mode switch min run time** (0=unlimited) |
| `P104` | `0x0168` | `25` | `0x0668` | `20` | `0x0468` | `100` | `20..100` | % | **Mode switch operating frequency %** |
| `P105` | `0x0169` | `14` | `0x0669` | `10` | `0x0469` | `60` | `10..60` | °C | **Cooling ambient temp limit** |
| `P106` | `0x016A` | `40` | `0x066A` | `10` | `0x046A` | `60` | `10..60` | °C | **Heating ambient temp limit** |
| `P107` | `0x016B` | `55` | `0x066B` | `10` | `0x046B` | `60` | `10..60` | °C | **Hot water ambient temp limit** |
| `P108` | `0x016C` | `55` | `0x066C` | `30` | `0x046C` | `75` | `30..80` | °C | **Hot water set temp upper** *(HW wijkt af)* |
| `P109` | `0x016D` | `20` | `0x066D` | `10` | `0x046D` | `30` | `10..30` | °C | **Hot water set temp lowest** |
| `P110` | `0x016E` | `50` | `0x066E` | `30` | `0x046E` | `75` | `30..80` | °C | **Heating set temp upper** *(HW wijkt af)* |
| `P111` | `0x016F` | `15` | `0x066F` | `15` | `0x046F` | `30` | `15..30` | °C | **Heating set temp lowest** |
| `P112` | `0x0170` | `25` | `0x0670` | `20` | `0x0470` | `40` | `20..40` | °C | **Cooling set temp upper** |
| `P113` | `0x0171` | `18` | `0x0671` | `5` | `0x0471` | `25` | `5..20` | °C | **Cooling set temp lowest** *(HW wijkt af)* |
| `P114` | `0x0172` | `1` | `0x0672` | `1` | `0x0472` | `2` | `1..2` | — | **Nr of compressors** (1=single, 2=pair) |
| `P115` | `0x0173` | `1` | `0x0673` | `0` | `0x0473` | `2` | `0..5` | — | **Model selection** (0=double supply, 1=triple, ...) *(HW wijkt af)* |
| `P116` | `0x0174` | `0` | `0x0674` | `0` | `0x0474` | `1` | `0..1` | — | **Temp control mode** (Adlar Aurora II: 0=inlet T6 (return water), 1=outlet T7 (discharge)) |
| `P117` | `0x0175` | `5` | `0x0675` | `0` | `0x0475` | `10` | `0..10` | °C | **Antifreeze ambient temp** |
| `P118` | `0x0176` | `3` | `0x0676` | `0` | `0x0476` | `20` | `0..20` | °C | **Antifreeze outlet water** |
| `P119` | `0x0177` | `2` | `0x0677` | `0` | `0x0477` | `20` | `1..3` | — | **Refrigerant type** (1=R410A, 2=R32 (Adlar Aurora II), 3=R290. Validatie: moet 2 zijn.) *(HW wijkt af)* |
| `P120` | `0x0178` | `1` | `0x0678` | `0` | `0x0478` | `1` | `0..1` | — | **Anti-condensation function** (0=enable, 1=disable) |
| `P121` | `0x0179` | `0` | `0x0679` | `0` | `0x0479` | `120` | `0..120` | Hz | **Heating freq shield zone 1 low** |
| `P122` | `0x017A` | `0` | `0x067A` | `0` | `0x047A` | `120` | `0..120` | Hz | **Heating freq shield zone 1 high** |
| `P123` | `0x017B` | `0` | `0x067B` | `0` | `0x047B` | `120` | `0..120` | Hz | **Heating freq shield zone 2 low** |
| `P124` | `0x017C` | `0` | `0x067C` | `0` | `0x047C` | `120` | `0..120` | Hz | **Heating freq shield zone 2 high** |
| `P125` | `0x017D` | `0` | `0x067D` | `0` | `0x047D` | `120` | `0..120` | Hz | **Heating freq shield zone 3 low** |
| `P126` | `0x017E` | `0` | `0x067E` | `0` | `0x047E` | `120` | `0..120` | Hz | **Heating freq shield zone 3 high** |
| `P127` | `0x017F` | `0` | `0x067F` | `0` | `0x047F` | `120` | `0..120` | Hz | **Cooling freq shield zone 1 low** |
| `P128` | `0x0180` | `0` | `0x0680` | `0` | `0x0480` | `120` | `0..120` | Hz | **Cooling freq shield zone 1 high** |
| `P129` | `0x0181` | `0` | `0x0681` | `0` | `0x0481` | `120` | `0..120` | Hz | **Cooling freq shield zone 2 low** |
| `P130` | `0x0182` | `0` | `0x0682` | `0` | `0x0482` | `120` | `0..120` | Hz | **Cooling freq shield zone 2 high** |
| `P131` | `0x0183` | `0` | `0x0683` | `0` | `0x0483` | `120` | `0..120` | Hz | **Cooling freq shield zone 3 low** |
| `P132` | `0x0184` | `0` | `0x0684` | `0` | `0x0484` | `120` | `0..120` | Hz | **Cooling freq shield zone 3 high** |
| `P133` | `0x0185` | `1` | `0x0685` | `0` | `0x0485` | `1` | `0..1` | — | **Fan module** (0=integral module, 1=individual module) |
| `P134` | `0x0186` | `0` | `0x0686` | `0` | `0x0486` | `100` | `0..100` | L/min | **Low water flow protection** (0=disabled) |
| `P135` | `0x0187` | `5` | `0x0687` | `0` | `0x0487` | `50` | `0..50` | °C | **Anti-condensation start temp diff** |
| `P136` | `0x0188` | `25` | `0x0688` | `-20` | `0x0488` | `50` | `-20..50` | °C | **Throttle bypass valve open ambient temp** |
| `P137` | `0x0189` | `0` | `0x0689` | `0` | `0x0489` | `999` | `0..999` | s | **Throttle bypass delay compressor** |
| `P138` | `0x018A` | `70` | `0x068A` | `40` | `0x048A` | `120` | `40..120` | Hz | **Defrost compressor frequency** |
| `P139` | `0x018B` | `0` | `0x068B` | `0` | `0x048B` | `2` | `0..2` | — | **Buffer tank electric heater** (0=enable, 1=disable, 2=AHS (Auxiliary Heat Source)) |
| `P140` | `0x018C` | `0` | `0x068C` | `0` | `0x048C` | `3` | `0..2` | — | **DHW electric heater** (0=enable, 1=disable, 2=AHS) *(HW wijkt af)* |
| `P141` | `0x018D` | `5` | `0x068D` | `0` | `0x048D` | `60` | `0..60` | min | **Dew point defrost duration** |
| `P142` | `0x018E` | `11` | `0x068E` | `0` | `0x048E` | `60` | `0..60` | — | **Dew point defrost constant** |
| `P143` | `0x018F` | `7` | `0x068F` | `0` | `0x048F` | `60` | `0..60` | °C | **Water temp to enter defrost** |
| `P144` | `0x0190` | `17` | `0x0690` | `-20` | `0x0490` | `30` | `-20..30` | °C | **Ambient temp to enter defrost** |
| `P145` | `0x0191` | `-30` | `0x0691` | `-30` | `0x0491` | `10` | `-20..10` | °C | **Outlet water antifreeze protection** *(HW wijkt af)* |
| `P146` | `0x0192` | `35` | `0x0692` | `0` | `0x0492` | `150` | `0..100` | L/min | **Pump PWM range setting** *(HW wijkt af)* |
| `P147` | `0x0193` | `2` | `0x0693` | `0` | `0x0493` | `3` | `0..2` | — | **Cooling antifreeze mode** (0=low pressure, 1=temp, 2=low pressure + temp) *(HW wijkt af)* |
| `P148` | `0x0194` | `1` | `0x0694` | `0` | `0x0494` | `10` | `-30..10` | °C | **Cooling antifreeze temperature** *(HW wijkt af)* |
| `P149` | `0x0195` | `58` | `0x0695` | `40` | `0x0495` | `85` | `40..80` | °C | **Outlet water high limit temperature** *(HW wijkt af)* |
| `P150` | `0x0196` | `2` | `0x0696` | `1` | `0x0496` | `4` | `0..3` | — | **Secondary heating pump select** (0=power on run, 1=power on, 2=linkage demand switch, 3=temperature control) *(HW wijkt af)* |
| `P151` | `0x0197` | `0` | `0x0697` | `0` | `0x0497` | `40` | `0..40` | °C | **Return diff - hot water heat source** |
| `P152` | `0x0198` | `1` | `0x0698` | `0` | `0x0498` | `40` | `0..40` | °C | **Return diff - heating heat source** |
| `P153` | `0x0199` | `70` | `0x0699` | `15` | `0x0499` | `75` | `15..80` | °C | **DHW heat source upper temp** *(HW wijkt af)* |
| `P154` | `0x019A` | `60` | `0x069A` | `15` | `0x049A` | `75` | `15..80` | °C | **Heating heat source upper temp** *(HW wijkt af)* |
| `P155` | `0x019B` | `0` | `0x069B` | `0` | `0x049B` | `9999` | `0..9999` | — | **Compressor code (reserved)** |
| `P156` | `0x019C` | `0` | `0x069C` | `0` | `0x049C` | `1` | `0..1` | — | **Aux EEV selection** (0=enable, 1=disable) |
| `P157` | `0x019D` | `0` | `0x069D` | `0` | `0x049D` | `99` | `0..99` | °C | **Aux EEV temp diff to reduce** |
| `P158` | `0x019E` | `-15` | `0x069E` | `-45` | `0x049E` | `30` | `-45..30` | °C | **Heating limit water temp start ambient** |
| `P159` | `0x019F` | `68` | `0x069F` | `40` | `0x049F` | `150` | `0..150` | — | **Limit temperature constant** *(HW wijkt af)* |
| `P160` | `0x01A0` | `14` | `0x06A0` | `-500` | `0x04A0` | `500` | `-500..500` | — | **Limit temperature coefficient** |
| `P161` | `0x01A1` | `0` | `0x06A1` | `0` | `0x04A1` | `4` | `0..4` | — | **Aux pump selection** (0=DHW, 1=AC, 2=floor, 3=AC/floor, 4=all) |
| `P162` | `0x01A2` | `0` | `0x06A2` | `0` | `0x04A2` | `360` | `0..360` | min | **Antifreeze DHW pipe interval** (0=disabled) |
| `P163` | `0x01A3` | `30` | `0x06A3` | `0` | `0x04A3` | `150` | `0..70` | % | **Min pump speed feedback** ( FIX v2.0: OEM doc zegt L/min, Excel zegt %. Range 0-70 past bij %  minimum PWM feedback drempel) *(HW wijkt af)* |
| `P164` | `0x01A4` | `3` | `0x06A4` | `0` | `0x04A4` | `3` | `0..3` | — | **Energy level control** (0=all enable, 1=E-heat disable, 2=compressor disable, 3=all disable) |
| `P165` | `0x01A5` | `3` | `0x06A5` | `1` | `0x04A5` | `15` | `1..15` | °C | **Load shedding return difference** |
| `P166` | `0x01A6` | `2` | `0x06A6` | `1` | `0x04A6` | `15` | `1..15` | °C | **Load shedding hysteresis** |
| `P167` | `0x01A7` | `3` | `0x06A7` | `1` | `0x04A7` | `15` | `1..15` | °C | **Load shedding emergency stop return diff** |
| `P168` | `0x01A8` | `50` | `0x06A8` | `1` | `0x04A8` | `100` | `1..100` | % | **Load shedding hot water start ratio** |
| `P169` | `0x01A9` | `100` | `0x06A9` | `1` | `0x04A9` | `100` | `1..100` | % | **Load shedding non-hot water start ratio** |
| `P170` | `0x01AA` | `7` | `0x06AA` | `3` | `0x04AA` | `60` | `3..60` | min | **Load shedding loading cycle** |
| `P171` | `0x01AB` | `-30` | `0x06AB` | `-50` | `0x04AB` | `0` | `-50..0` | °C | **Load shedding shield low voltage ambient** |
| `P172` | `0x01AC` | `65` | `0x06AC` | `40` | `0x04AC` | `70` | `40..70` | Hz | **DC fan target frequency constant c** |
| `P173` | `0x01AD` | `40` | `0x06AD` | `20` | `0x04AD` | `65` | `20..65` | Hz | **Heating fan target frequency lower limit** |
| `P174` | `0x01AE` | `450` | `0x06AE` | `0` | `0x04AE` | `500` | `0..480` | P | **Defrost valve opening** *(HW wijkt af)* |
| `P175` | `0x01AF` | `10` | `0x06AF` | `1` | `0x04AF` | `240` | `0..360` | min | **Constant temp operation cycle** *(HW wijkt af)* |
| `P176` | `0x01B0` | `0` | `0x06B0` | `0` | `0x04B0` | `999` | `0..999` | s | **Minimum defrost time** |
| `P177` | `0x01B1` | `40` | `0x06B1` | `0` | `0x04B1` | `80` | `0..80` | °C | **Defrost segmented water temperature** |
| `P178` | `0x01B2` | `70` | `0x06B2` | `40` | `0x04B2` | `120` | `40..120` | Hz | **High water temp defrost frequency** |
| `P179` | `0x01B3` | `15` | `0x06B3` | `0` | `0x04B3` | `40` | `0..40` | Hz | **Strong mode frequency increase** |
| `P180` | `0x01B4` | `5` | `0x06B4` | `0` | `0x04B4` | `40` | `0..40` | Hz | **Powerful mode frequency cap** |
| `P181` | `0x01B5` | `0` | `0x06B5` | `0` | `0x04B5` | `2` | `0..2` | — | **Defrost selection - evaporate side** (0=current mode, 1=heating, 2=DHW) |
| `P182` | `0x01B6` | `3` | `0x06B6` | `0` | `0x04B6` | `4` | `0..3` | — | **Pipe electric heating option** (0=3kW+6kW, 1=3kW, 2=6kW, 3=disabled) *(HW wijkt af)* |
| `P183` | `0x01B7` | *(weggelaten)* | `0x06B7` | `0` | `0x04B7` | `999` | `0..9999` | — | **Parameter password** (0=disable) *(HW wijkt af)* |
| `P184` | `0x01B8` | `25` | `0x06B8` | `0` | `0x04B8` | `120` | `0..120` | Hz | **Working cond 35D compressor frequency** |
| `P185` | `0x01B9` | `25` | `0x06B9` | `1` | `0x04B9` | `120` | `0..120` | Hz | **Working cond 35C compressor frequency** *(HW wijkt af)* |
| `P186` | `0x01BA` | `39` | `0x06BA` | `1` | `0x04BA` | `120` | `0..120` | Hz | **Working cond 35B compressor frequency** *(HW wijkt af)* |
| `P187` | `0x01BB` | `78` | `0x06BB` | `1` | `0x04BB` | `120` | `0..120` | Hz | **Working cond 35A compressor frequency** *(HW wijkt af)* |
| `P188` | `0x01BC` | `85` | `0x06BC` | `1` | `0x04BC` | `120` | `0..120` | Hz | **Working cond 35E compressor frequency** *(HW wijkt af)* |
| `P189` | `0x01BD` | `25` | `0x06BD` | `1` | `0x04BD` | `120` | `0..120` | Hz | **Working cond 55D compressor frequency** *(HW wijkt af)* |
| `P190` | `0x01BE` | `25` | `0x06BE` | `1` | `0x04BE` | `120` | `0..120` | Hz | **Working cond 55C compressor frequency** *(HW wijkt af)* |
| `P191` | `0x01BF` | `39` | `0x06BF` | `1` | `0x04BF` | `120` | `0..120` | Hz | **Working cond 55B compressor frequency** *(HW wijkt af)* |
| `P192` | `0x01C0` | `78` | `0x06C0` | `1` | `0x04C0` | `120` | `0..120` | Hz | **Working cond 55A compressor frequency** *(HW wijkt af)* |
| `P193` | `0x01C1` | `85` | `0x06C1` | `1` | `0x04C1` | `120` | `0..120` | Hz | **Working cond 55E compressor frequency** *(HW wijkt af)* |
| `P194` | `0x01C2` | `25` | `0x06C2` | `0` | `0x04C2` | `60` | `0..60` | Hz | **Working cond 35D fan frequency** |
| `P195` | `0x01C3` | `25` | `0x06C3` | `0` | `0x04C3` | `60` | `0..60` | Hz | **Working cond 35C fan frequency** |
| `P196` | `0x01C4` | `45` | `0x06C4` | `0` | `0x04C4` | `60` | `0..60` | Hz | **Working cond 35B fan frequency** |
| `P197` | `0x01C5` | `55` | `0x06C5` | `0` | `0x04C5` | `60` | `0..60` | Hz | **Working cond 35A fan frequency** |
| `P198` | `0x01C6` | `55` | `0x06C6` | `0` | `0x04C6` | `60` | `0..60` | Hz | **Working cond 35E fan frequency** |
| `P199` | `0x01C7` | `25` | `0x06C7` | `0` | `0x04C7` | `60` | `0..60` | Hz | **Working cond 55D fan frequency** |
| `P200` | `0x01C8` | `25` | `0x06C8` | `0` | `0x04C8` | `60` | `0..60` | Hz | **Working cond 55C fan frequency** |
| `P201` | `0x01C9` | `45` | `0x06C9` | `0` | `0x04C9` | `60` | `0..60` | Hz | **Working cond 55B fan frequency** |
| `P202` | `0x01CA` | `55` | `0x06CA` | `0` | `0x04CA` | `60` | `0..60` | Hz | **Working cond 55A fan frequency** |
| `P203` | `0x01CB` | `55` | `0x06CB` | `0` | `0x04CB` | `60` | `0..60` | Hz | **Working cond 55E fan frequency** |
| `P204` | `0x01CC` | `1` | `0x06CC` | `-10` | `0x04CC` | `10` | `-10..10` | °C | **Working cond 35D main valve superheat** |
| `P205` | `0x01CD` | `1` | `0x06CD` | `-10` | `0x04CD` | `10` | `-10..10` | °C | **Working cond 35C main valve superheat** |
| `P206` | `0x01CE` | `2` | `0x06CE` | `-10` | `0x04CE` | `10` | `-10..10` | °C | **Working cond 35B main valve superheat** |
| `P207` | `0x01CF` | `2` | `0x06CF` | `-10` | `0x04CF` | `10` | `-10..10` | °C | **Working cond 35A main valve superheat** |
| `P208` | `0x01D0` | `2` | `0x06D0` | `-10` | `0x04D0` | `500` | `-10..10` | °C | **Working cond 35E main valve superheat** *(HW wijkt af)* |
| `P209` | `0x01D1` | `2` | `0x06D1` | `-10` | `0x04D1` | `500` | `-10..10` | °C | **Working cond 55D main valve superheat** *(HW wijkt af)* |
| `P210` | `0x01D2` | `2` | `0x06D2` | `-10` | `0x04D2` | `100` | `-10..10` | °C | **Working cond 55C main valve superheat** *(HW wijkt af)* |
| `P211` | `0x01D3` | `2` | `0x06D3` | `-10` | `0x04D3` | `100` | `-10..10` | °C | **Working cond 55B main valve superheat** *(HW wijkt af)* |
| `P212` | `0x01D4` | `2` | `0x06D4` | `-10` | `0x04D4` | `100` | `-10..10` | °C | **Working cond 55A main valve superheat** *(HW wijkt af)* |
| `P213` | `0x01D5` | `2` | `0x06D5` | `-10` | `0x04D5` | `100` | `-10..10` | °C | **Working cond 55E main valve superheat** *(HW wijkt af)* |
| `P214` | `0x01D6` | `130` | `0x06D6` | `0` | `0x04D6` | `500` | `0..500` | P | **Working cond 35D main valve opening** |
| `P215` | `0x01D7` | `90` | `0x06D7` | `0` | `0x04D7` | `500` | `0..500` | P | **Working cond 35C main valve opening** |
| `P216` | `0x01D8` | `100` | `0x06D8` | `0` | `0x04D8` | `500` | `0..500` | P | **Working cond 35B main valve opening** |
| `P217` | `0x01D9` | `150` | `0x06D9` | `0` | `0x04D9` | `500` | `0..500` | P | **Working cond 35A main valve opening** |
| `P218` | `0x01DA` | `130` | `0x06DA` | `0` | `0x04DA` | `500` | `0..500` | P | **Working cond 35E main valve opening** |
| `P219` | `0x01DB` | `110` | `0x06DB` | `0` | `0x04DB` | `500` | `0..500` | P | **Working cond 55D main valve opening** |
| `P220` | `0x01DC` | `85` | `0x06DC` | `0` | `0x04DC` | `500` | `0..500` | P | **Working cond 55C main valve opening** |
| `P221` | `0x01DD` | `90` | `0x06DD` | `0` | `0x04DD` | `500` | `0..500` | P | **Working cond 55B main valve opening** |
| `P222` | `0x01DE` | `120` | `0x06DE` | `0` | `0x04DE` | `500` | `0..500` | P | **Working cond 55A main valve opening** |
| `P223` | `0x01DF` | `100` | `0x06DF` | `0` | `0x04DF` | `500` | `0..500` | P | **Working cond 55E main valve opening** |
| `P224` | `0x01E0` | `2` | `0x06E0` | `-10` | `0x04E0` | `60` | `-10..10` | °C | **Working cond 35D aux valve superheat** *(HW wijkt af)* |
| `P225` | `0x01E1` | `2` | `0x06E1` | `-10` | `0x04E1` | `60` | `-10..10` | °C | **Working cond 35C aux valve superheat** *(HW wijkt af)* |
| `P226` | `0x01E2` | `2` | `0x06E2` | `-10` | `0x04E2` | `60` | `-10..10` | °C | **Working cond 35B aux valve superheat** *(HW wijkt af)* |
| `P227` | `0x01E3` | `2` | `0x06E3` | `-10` | `0x04E3` | `10` | `-10..10` | °C | **Working cond 35A aux valve superheat** |
| `P228` | `0x01E4` | `2` | `0x06E4` | `-10` | `0x04E4` | `10` | `-10..10` | °C | **Working cond 35E aux valve superheat** |
| `P229` | `0x01E5` | `2` | `0x06E5` | `-10` | `0x04E5` | `10` | `-10..10` | °C | **Working cond 55D aux valve superheat** |
| `P230` | `0x01E6` | `2` | `0x06E6` | `-10` | `0x04E6` | `10` | `-10..10` | °C | **Working cond 55C aux valve superheat** |
| `P231` | `0x01E7` | `2` | `0x06E7` | `-10` | `0x04E7` | `10` | `-10..10` | °C | **Working cond 55B aux valve superheat** |
| `P232` | `0x01E8` | `2` | `0x06E8` | `-10` | `0x04E8` | `10` | `-10..10` | °C | **Working cond 55A aux valve superheat** |
| `P233` | `0x01E9` | `2` | `0x06E9` | `-10` | `0x04E9` | `10` | `-10..10` | °C | **Working cond 55E aux valve superheat** |
| `P234` | `0x01EA` | `125` | `0x06EA` | `0` | `0x04EA` | `500` | `0..500` | P | **Working cond 35D aux valve opening** |
| `P235` | `0x01EB` | `85` | `0x06EB` | `0` | `0x04EB` | `500` | `0..500` | P | **Working cond 35C aux valve opening** |
| `P236` | `0x01EC` | `35` | `0x06EC` | `0` | `0x04EC` | `500` | `0..500` | P | **Working cond 35B aux valve opening** |
| `P237` | `0x01ED` | `65` | `0x06ED` | `0` | `0x04ED` | `500` | `0..500` | P | **Working cond 35A aux valve opening** |
| `P238` | `0x01EE` | `85` | `0x06EE` | `0` | `0x04EE` | `500` | `0..500` | P | **Working cond 35E aux valve opening** |
| `P239` | `0x01EF` | `140` | `0x06EF` | `0` | `0x04EF` | `500` | `0..500` | P | **Working cond 55D aux valve opening** |
| `P240` | `0x01F0` | `330` | `0x06F0` | `0` | `0x04F0` | `500` | `0..500` | P | **Working cond 55C aux valve opening** |
| `P241` | `0x01F1` | `200` | `0x06F1` | `0` | `0x04F1` | `500` | `0..500` | P | **Working cond 55B aux valve opening** |
| `P242` | `0x01F2` | `350` | `0x06F2` | `0` | `0x04F2` | `500` | `0..500` | P | **Working cond 55A aux valve opening** |
| `P243` | `0x01F3` | `350` | `0x06F3` | `0` | `0x04F3` | `500` | `0..500` | P | **Working cond 55E aux valve opening** |
| `P244` | `0x01F4` | `22` | `0x06F4` | `0` | `0x04F4` | `100` | `0..100` | L/min | **Working cond 35 low water target flow** |
| `P245` | `0x01F5` | `15` | `0x06F5` | `0` | `0x04F5` | `100` | `0..100` | L/min | **Working cond 55 high water target flow** |
| `P246` | `0x01F6` | `50` | `0x06F6` | `0` | `0x04F6` | `60` | `0..60` | Hz | **Working cond 35 rated fan frequency** |
| `P247` | `0x01F7` | `220` | `0x06F7` | `0` | `0x04F7` | `500` | `0..500` | P | **Working cond 35 rated main valve opening** |
| `P248` | `0x01F8` | `50` | `0x06F8` | `0` | `0x04F8` | `60` | `0..60` | Hz | **Working cond 55 rated fan frequency** |
| `P249` | `0x01F9` | `170` | `0x06F9` | `0` | `0x04F9` | `500` | `0..500` | P | **Working cond 55 rated main valve opening** |
| `P250` | `0x01FA` | `4` | `0x06FA` | `-10` | `0x04FA` | `10` | `-10..10` | °C | **Working cond 35 rated main valve superheat** |
| `P251` | `0x01FB` | `5` | `0x06FB` | `0` | `0x04FB` | `50` | `0..50` | A | **Working cond PFC shutdown current** |
| `P252` | `0x01FC` | `3` | `0x06FC` | `-10` | `0x04FC` | `10` | `-10..10` | °C | **Working cond 55 rated main valve superheat** |
| `P253` | `0x01FD` | `6` | `0x06FD` | `0` | `0x04FD` | `50` | `0..50` | A | **Working cond PFC turn-on current** |
| `P254` | `0x01FE` | `0` | `0x06FE` | `0` | `0x04FE` | `1` | `0..1` | — | **Heating medium** (0=water, 1=antifreeze liquid) |
| `P255` | `0x01FF` | `1` | `0x06FF` | `0` | `0x04FF` | `2` | `0..1` | — | **Smart Grid enable** (0=enable, 1=disable (inverse logica!)) *(HW wijkt af)* |
| `P256` | `0x0200` | `30` | `0x0700` | `30` | `0x0500` | `999` | `30..999` | min | **Peak grid runtime** |
| `P257` | `0x0201` | `2` | `0x0701` | `0` | `0x0501` | `3` | `0..2` | — | **Dual temperature zone selection** (0=auto, 1=manual, 2=disable) *(HW wijkt af)* |
| `P258` | `0x0202` | `7` | `0x0702` | `1` | `0x0502` | `20` | `5..20` | min | **Mixing water valve cycle** *(HW wijkt af)* |
| `P259` | `0x0203` | `120` | `0x0703` | `30` | `0x0503` | `180` | `0..180` | s | **Mixing valve full cycle time** *(HW wijkt af)* |
| `P260` | `0x0204` | `99` | `0x0704` | `50` | `0x0504` | `99` | `50..99` | % | **Max DC pump speed** |
| `P261` | `0x0205` | `30` | `0x0705` | `20` | `0x0505` | `99` | `20..99` | % | **DC pump constant temp speed** |
| `P262` | `0x0206` | `1` | `0x0706` | `0` | `0x0506` | `2` | `0..1` | — | **Floor heating test mode selection** (0=Enable, 1=Disable) *(HW wijkt af)* |
| `P263` | `0x0207` | `3` | `0x0707` | `3` | `0x0507` | `240` | — | — | Functie onbekend; eventuele eerdere duiding is hypothese |
| `P264` | `0x0208` | `100` | `0x0708` | `30` | `0x0508` | `100` | — | — | Functie onbekend; eventuele eerdere duiding is hypothese |
| `P265` | `0x0209` | `1` | `0x0709` | `1` | `0x0509` | `10` | — | — | Functie onbekend; eventuele eerdere duiding is hypothese |
| `P266` | `0x020A` | `0` | `0x070A` | `0` | `0x050A` | `1` | — | — | Functie onbekend; eventuele eerdere duiding is hypothese |
| `P267` | `0x020B` | `5` | `0x070B` | `1` | `0x050B` | `30` | — | — | Functie onbekend; eventuele eerdere duiding is hypothese |
| `P268` | `0x020C` | `1` | `0x070C` | `0` | `0x050C` | `1` | — | — | Functie onbekend; eventuele eerdere duiding is hypothese |
| `P269` | `0x020D` | `125` | `0x070D` | `95` | `0x050D` | `125` | — | — | Functie onbekend; eventuele eerdere duiding is hypothese |
| `P270` | `0x020E` | `85` | `0x070E` | `85` | `0x050E` | `125` | — | — | Functie onbekend; eventuele eerdere duiding is hypothese |
| `P271` | `0x020F` | `400` | `0x070F` | `50` | `0x050F` | `500` | — | — | Functie onbekend; eventuele eerdere duiding is hypothese |
| `P272` | `0x0210` | `0` | `0x0710` | `0` | `0x0510` | `500` | — | — | Functie onbekend; eventuele eerdere duiding is hypothese |
| `P273` | `0x0211` | `0` | `0x0711` | `0` | `0x0511` | `500` | — | — | Functie onbekend; eventuele eerdere duiding is hypothese |
| `P274` | `0x0212` | `0` | `0x0712` | `0` | `0x0512` | `500` | — | — | Functie onbekend; eventuele eerdere duiding is hypothese |
| `P275` | `0x0213` | `0` | `0x0713` | `0` | `0x0513` | `240` | — | — | Functie onbekend; eventuele eerdere duiding is hypothese |
| `P276` | `0x0214` | `10` | `0x0714` | `0` | `0x0514` | `240` | — | — | Functie onbekend; eventuele eerdere duiding is hypothese |
| `P277` | `0x0215` | `80` | `0x0715` | `0` | `0x0515` | `200` | — | — | Functie onbekend; eventuele eerdere duiding is hypothese |
| `P278` | `0x0216` | `60` | `0x0716` | `0` | `0x0516` | `200` | — | — | Functie onbekend; eventuele eerdere duiding is hypothese |
| `P279` | `0x0217` | `120` | `0x0717` | `0` | `0x0517` | `200` | — | — | Functie onbekend; eventuele eerdere duiding is hypothese |
| `P280` | `0x0218` | `25` | `0x0718` | `0` | `0x0518` | `30` | — | — | Functie onbekend; eventuele eerdere duiding is hypothese |
| `P281` | `0x0219` | `15` | `0x0719` | `0` | `0x0519` | `30` | — | — | Functie onbekend; eventuele eerdere duiding is hypothese |
| `P282` | `0x021A` | `70` | `0x071A` | `5` | `0x051A` | `100` | — | — | Functie onbekend; eventuele eerdere duiding is hypothese |
| `P283` | `0x021B` | `0` | `0x071B` | `0` | `0x051B` | `1` | — | — | Functie onbekend; eventuele eerdere duiding is hypothese |
| `P284` | `0x021C` | `25` | `0x071C` | `0` | `0x051C` | `100` | — | — | Functie onbekend; eventuele eerdere duiding is hypothese |
| `P285` | `0x021D` | `30` | `0x071D` | `0` | `0x051D` | `100` | — | — | Functie onbekend; eventuele eerdere duiding is hypothese |
| `P286` | `0x021E` | `35` | `0x071E` | `0` | `0x051E` | `100` | — | — | Functie onbekend; eventuele eerdere duiding is hypothese |
| `P287` | `0x021F` | `40` | `0x071F` | `0` | `0x051F` | `100` | — | — | Functie onbekend; eventuele eerdere duiding is hypothese |
| `P288` | `0x0220` | `45` | `0x0720` | `0` | `0x0520` | `100` | — | — | Functie onbekend; eventuele eerdere duiding is hypothese |
| `P289` | `0x0221` | `3` | `0x0721` | `0` | `0x0521` | `10` | — | — | Functie onbekend; eventuele eerdere duiding is hypothese |
| `P290` | `0x0222` | `1` | `0x0722` | `0` | `0x0522` | `10` | — | — | Functie onbekend; eventuele eerdere duiding is hypothese |
| `P291` | `0x0223` | `1` | `0x0723` | `0` | `0x0523` | `10` | — | — | Functie onbekend; eventuele eerdere duiding is hypothese |
| `P292` | `0x0224` | `1` | `0x0724` | `0` | `0x0524` | `10` | — | — | Functie onbekend; eventuele eerdere duiding is hypothese |
| `P293` | `0x0225` | `1` | `0x0725` | `0` | `0x0525` | `10` | — | — | Functie onbekend; eventuele eerdere duiding is hypothese |
| `P294` | `0x0226` | `0` | `0x0726` | `0` | `0x0526` | `100` | — | — | Functie onbekend; eventuele eerdere duiding is hypothese |
| `P295` | `0x0227` | `55` | `0x0727` | `20` | `0x0527` | `75` | — | — | Functie onbekend; eventuele eerdere duiding is hypothese |
| `P296` | `0x0228` | `45` | `0x0728` | `20` | `0x0528` | `75` | — | — | Functie onbekend; eventuele eerdere duiding is hypothese |
| `P297` | `0x0229` | `20` | `0x0729` | `0` | `0x0529` | `20` | — | — | Functie onbekend; eventuele eerdere duiding is hypothese |
| `P298` | `0x022A` | `10` | `0x072A` | `-10` | `0x052A` | `30` | — | — | Functie onbekend; eventuele eerdere duiding is hypothese |
| `P299` | `0x022B` | `8` | `0x072B` | `-10` | `0x052B` | `30` | — | — | Functie onbekend; eventuele eerdere duiding is hypothese |
| `P300` | `0x022C` | `6` | `0x072C` | `-10` | `0x052C` | `30` | — | — | Functie onbekend; eventuele eerdere duiding is hypothese |
| `P301` | `0x022D` | `0` | `0x072D` | `0` | `0x052D` | `0` | — | — | Functie onbekend; eventuele eerdere duiding is hypothese |
| `P302` | `0x022E` | `0` | `0x072E` | `0` | `0x052E` | `0` | — | — | Functie onbekend; eventuele eerdere duiding is hypothese |
| `P303` | `0x022F` | `0` | `0x072F` | `0` | `0x052F` | `0` | — | — | Functie onbekend; eventuele eerdere duiding is hypothese |

---
