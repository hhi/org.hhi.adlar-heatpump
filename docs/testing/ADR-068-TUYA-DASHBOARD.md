# ADR-068: Verificatie Tuya-dashboard

Datum: 2026-11-09. Branch: `codex/tuya-dashboard`.

## Lokaal gecontroleerd

- `npm run build`: geslaagd.
- `npm test`: 480 tests geslaagd, waaronder acht nieuwe dashboardtests.
- `npm run check:caps`: geslaagd, geen nieuwe wezen.
- `python3 scripts/migration/verify.py`: geslaagd.
- `homey app validate`: geslaagd op niveau `publish`.
- ESLint op gewijzigde productiecode: geslaagd.
- Algemene `npm run lint`: niet geslaagd door bestaande broncodefouten en
  uitgesloten testbestanden in `tsconfig.json`. Ook de nieuwe test valt onder
  dat configuratieprobleem. Geen algemene lintconfiguratie aangepast.

De nieuwe tests staan in `test/unit/tuya-dashboard.test.js` en controleren:

1. Gedeeltelijke DPS-updates, schaalfactoren en meerdere capabilities per DPS.
2. Ontbrekende waarden, onbekende status en afwezige curveparameters.
3. Whitelist, type-, bereik-, stap- en enumvalidatie; offline bediening.
4. Optimistische Homey-updates versus werkelijk ontvangen DPS-terugkoppeling.
5. Terugkoppeling tijdens verzending, transportfout en timeout zonder retry.
6. Maximaal 500 events en 100 opdrachten; verwijderen en late callbacks.
7. Alle HTTP-pagina's, vertalingen, apparaatscheiding en ongeldige requests.
8. Bezette poort, behoud van bestaande server en vervangen van registraties.

Gericht opnieuw uitvoeren:

```sh
npm run build
node --test test/unit/tuya-dashboard.test.js
npx eslint app.ts drivers/intelligent-heat-pump/device.ts \
  lib/tuya/services/service-coordinator.ts \
  lib/tuya/services/dashboard-*.ts public/tuya/dashboard.js
```

## Browsercontrole met gesimuleerde apparaten

Playwright gebruikte een lokale previewserver met twee gesimuleerde apparaten.
Er zijn geen opdrachten aan een echte warmtepomp verzonden.

- Dashboard en Live renderen gegroepeerde waarden.
- Interactief: doeltemperatuur wijzigen geeft 'Overeenkomende waarde ontvangen'.
- Apparaatscheiding is via de API getest; de UI toont het eerste geregistreerde
  apparaat zonder warmtepompkeuze.
- Expert: zoeken naar DPS 104 toont de ruwe en geschaalde vermogenswaarde en
  de oorspronkelijke ontvangsttijd met melding voor verouderde gegevens.
  Het schrijfbaarheidsfilter en het bedieningsvenster zijn gecontroleerd.
- Wijzigingen: één regel per bekende of ontvangen DPS; zoeken, sorteren en
  alleen gewijzigd zijn gecontroleerd. JSON-export volgt de actieve filters.
- Stooklijn: app-curve verschijnt; Tuya-curvekeuze blijft afzonderlijk.
- Nederlands en Engels, mobiele breedte 390 pixels en desktop 1440 pixels.
- Licht en donker; mobiele stooklijnpagina heeft geen horizontale pagina-overloop.
- Geen JavaScript-runtimefouten tijdens deze controle.

## Hardwareacceptatie: nog uit te voeren

Gebruik een Homey-installatie met de gewijzigde app en een Tuya-apparaat.
Open `http://HOMEY-IP:8092`, of de ingestelde dashboardpoort.

1. Vergelijk temperaturen, status, vermogen en COP met de Homey-capabilities.
   Controleer interne en externe bronnen en een installatie zonder vermogensmeter.
2. Wijzig een ondersteund setpoint via Interactief en Expert. Controleer de
   werkelijke apparaatwaarde, Homey-terugkoppeling en het parameteroverzicht.
3. Herhaal met adaptieve regeling aan. De bestaande regelaar moet zijn gedrag
   behouden; het dashboard meldt dat deze het setpoint opnieuw kan aanpassen.
4. Verbreek en herstel de Tuya-verbinding. Controleer verbindingsstatus,
   gegevensouderdom en weigering van bediening zolang het apparaat offline is.
5. Open meerdere browsertabs. Controleer dat er één bestaande Tuya-verbinding
   blijft en de apparaatpolling niet versnelt.
6. Sluit alle tabs, wijzig een waarde via de normale bediening en open het
   parameteroverzicht opnieuw. De ontvangen wijziging moet aanwezig zijn.
7. Herstart de app. Cache en log beginnen opnieuw; oude waarden worden niet als
   nieuw ontvangen voorgesteld. Controleer opnieuw de dashboardpoort.
8. Gebruik zo mogelijk twee Tuya-apparaten. Controleer aparte caches, opdrachten
   en logs; verwijder één apparaat en daarna het laatste apparaat.
9. Open tegelijkertijd de Aurora II- en Aurora III-dashboards. Controleer
   onafhankelijke werking en weigering van overlappende poortinstellingen.
10. Kies een bezette poort. De instelling moet worden geweigerd en het bestaande
    dashboard moet blijven werken. Warmtepompbediening moet blijven werken.
11. Controleer iOS/Safari, lange apparaatnamen en lege/ontbrekende sensoren.

Leg Homey-model, appversie, Tuya-firmware, uitgevoerde scenario's en resultaten
vast voordat hardwareacceptatie wordt afgetekend.

## Gedeelde vormgeving gecontroleerd (2026-11-10)

- Alle zes geëxtraheerde CSS-bestanden zijn byte voor byte vergeleken met
  de oorspronkelijke inline Aurora II-stijlen; geen verschil.
- Beide HTTP-servers leveren de gedeelde stylesheets aan de browser.
- Alle zes Tuya-pagina's zijn met hun Aurora II-equivalent vergeleken in
  licht én donker: achtergrondkleur, lettertype, tekstkleur en navigatiegrootte,
  padding, afronding en kleur zijn gelijk.
- Live bekeken op 1440 en 390 pixels; geen horizontale pagina-overloop op mobiel.
- Interactief op mobiel: bediening met gesimuleerde terugkoppeling blijft werken.
- Geen JavaScript-runtimefouten bij deze controle.

## Testversie 3.8.0 (2026-11-10)

De versienummers in Homey Compose, het gegenereerde appmanifest, `package.json`
en `package-lock.json` zijn gelijkgetrokken op 3.8.0. De changelog bevat het
Tuya-dashboard en het toepassen van de COP- en voorverwarmingsinstellingen.

De huidige checkout bevat ook de aanvullende wijzigingen voor
optimizerinstellingen uit ADR-067 D1. Voor deze gecombineerde checkout zijn
494 tests geslaagd; de Homey-validatie op publicatieniveau is geslaagd.
Versie 3.8.0 is op 2026-11-10 geïnstalleerd op Homey Pro van H. De appstatus
toont `enabled: true`, `crashed: false` en geen fout. Het Tuya-dashboard op
poort 8092 is bereikbaar en toont het gekoppelde apparaat. De functionele
hardwareacceptatie hierboven staat nog open.

## Herstel capability-opties op Homey Pro (2026-11-10)

Op de echte Homey Pro gaven `/capabilities` en `/dps` eerst HTTP 500,
terwijl `/snapshot`, `/events` en `/heating-curve` wel werkten. Het uitlezen
van runtime-opties faalde voor capabilities zonder eigen opties.

De dashboardadapter valt nu per capability terug op het appmanifest. De
validatie van schrijfbare capabilities blijft actief; ontbrekende runtime-opties
maken ongeldige enumwaarden niet toegestaan. Een nieuwe HTTP-regressietest
controleert dit gedrag. Alle negen gerichte dashboardtests slagen.

De correctie is binnen testversie 3.8.0 opnieuw geïnstalleerd op Homey Pro van H.
Daarna zijn de vijf gegevensroutes met HTTP 200 gecontroleerd (91 capabilities,
40 DPS-definities). Alle zes pagina's zijn in de browser op de echte Homey
bekeken: geen zichtbare dashboardfout en geen JavaScript-runtimefouten.
Deze controle was alleen-lezen; er zijn geen warmtepompopdrachten verzonden.

## Parameteroverzicht en verwijderde apparaatkeuze (2026-11-10)

Op gebruikersverzoek volgt Wijzigingen nu het parameteroverzicht van de
Modbus-dashboards. Dezelfde gedeelde CSS blijft in gebruik. Alle bekende en
ontvangen DPS krijgen één regel, ook als nog geen waarde is ontvangen.

- Huidige/vorige waarde, eerste ontvangst, laatste wijziging en wijzigingsteller.
- Gemiddelde, minimale en maximale intervalduur van de laatste 50 wijzigingen.
- Zoeken op nummer, naam, capability en waarde; filter alleen gewijzigd;
  sorteren op kolom; ingeklapte groepen blijven behouden bij verversing.
- De eerste ontvangst telt niet als wijziging. Identieke en gedeeltelijke
  berichten vervalsen de teller of ouderdom van andere datapunten niet.
- Geen warmtepompselector op de zes pagina's; de naam blijft zichtbaar.
- Elf dashboardtests geslaagd, inclusief intervalbegrenzing, nulwaarden,
  onbekende DPS en apparaatscheiding via de nieuwe `/changes`-route.
- Browserpreview: 41 regels, zoeken op DP104 geeft één regel; alleen gewijzigd
  geeft twee regels. JSON-export bevat uitsluitend de gefilterde regel.
- Geen browserfouten op de zes pagina's; mobiele breedte 390 px zonder
  horizontale pagina-overloop. Desktopweergave visueel gecontroleerd.

Volledige regressiesuite: 497 tests geslaagd. Homey-validatie op niveau `publish`
geslaagd. Versie 3.8.0 opnieuw geïnstalleerd op Homey Pro van H. App actief,
geen crash. Live `/changes`: HTTP 200, 40 datapunten waarvan 36 ontvangen bij
controle. Zoeken op DP104 geeft één regel. Alle zes pagina's laden zonder
foutmelding of JavaScript-fout en zonder apparaatselector. Deze livecontrole
was uitsluitend uitlezend; er zijn geen warmtepompopdrachten verstuurd.

## Expert zoeken en weergaven (2026-11-10)

Vergeleken met Modbus Expert: diens nummer-/functionele-/eenheidsweergave is
vertaald naar Tuya-DPS, met dezelfde gedeelde CSS. De Modbus-zoekbalk doorzoekt
naam, ID, beschrijving en adres; Tuya doorzoekt bovendien eenheid en waarden.

Browsercontrole op de lokale preview:

- 104, DP104, DPS104 en DPS 104 vinden elk hetzelfde datapunt.
- Nederlandse en Engelse namen, eenheden en ruwe/omgerekende waarden werken.
- °C en ℃ vinden dezelfde zes regels; Hz vindt één regel.
- Gecombineerd zoeken op vermogen W geeft één regel; onbekende term nul.
- Eenheidsweergave behoudt alle 41 regels zonder duplicaten.
- Alleen schrijfbaar gecombineerd met °C toont twee regels.
- Functionele groepen en ingeklapte toestand blijven behouden bij verversing.
- Ook Wijzigingen gebruikt de uitgebreidere zoekfunctie.
- Geen browserfouten; geen pagina-overloop op 390 px; desktopbeeld gecontroleerd.
- Gerichte ESLint-controle geslaagd. Geen backend- of bedieningslogica gewijzigd.

De gedeelde Expert-CSS corrigeert daarnaast het contrast van ruwe waarden,
eenheden en tabelregels in het lichte thema voor zowel Tuya als Aurora II.
TypeScript-compilatie en Homey-validatie (`debug`) tijdens installatie geslaagd.
Versie 3.8.0 opnieuw geïnstalleerd op Homey Pro van H.
Livecontrole op Homey Pro: alle drie weergaven bevatten dezelfde 40 datapunten.
DP104 vindt één regel, °C dertien, Hz twee en vermogen W één. Geen foutmelding
of JavaScript-fout. Alleen gelezen; geen bedieningsopdrachten verstuurd.
