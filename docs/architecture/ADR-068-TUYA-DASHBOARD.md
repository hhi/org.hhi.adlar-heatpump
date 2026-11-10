<!-- markdownlint-configure-file { "MD013": { "tables": false } } -->

# ADR-068: Dashboardpagina's voor Aurora I/II via Tuya

**Status:** Geïmplementeerd; hardwareacceptatie open
**Datum:** 2026-11-09
**Beslissers:** -
**Branch:** `codex/tuya-dashboard`
**Testversie:** 3.8.0 (vastgesteld op 2026-11-10)
**Gerelateerd:** [ADR-002](ADR-002-TUYA-VERBINDINGSMODEL.md)
(Tuya-verbinding); [ADR-004](ADR-004-AURORA3-DRIVER-MERGE.md)
(gescheiden dashboards per driver); [ADR-005](ADR-005-MODBUS-CONVERGENCE.md)
(onderhoud van de Modbus-drivers)

## Samenvatting voor de eigenaar

- De Tuya-driver krijgt dashboardpagina's met dezelfde vormgeving en navigatie
  als Aurora II Modbus: Dashboard, Live, Interactief, Expert, Wijzigingen en
  Stooklijn.
- De inhoud komt uit Tuya-datapunten (DPS), bestaande Homey-capabilities en
  bestaande services. Expert toont DPS in plaats van Modbus-registers.
- Een eigen dashboardservice gebruikt standaard poort 8092. De bestaande
  Tuya-verbinding levert de gegevens; een open browser veroorzaakt geen extra
  verbinding met de warmtepomp.
- Eerst komen Dashboard, Live en Interactief. Daarna volgen de DPS-browser,
  het wijzigingenlog en de stooklijnweergave.
- Beide fasen zijn geïmplementeerd en lokaal geverifieerd. Hardwareacceptatie
  staat nog open; testversie is 3.8.0. Zie paragraaf 8.

## 1. Context

Aurora II Modbus heeft een dashboard via `app.dashboard`, standaard op poort
8090, met pagina's in `public/`. Aurora III heeft een afzonderlijke service
via `app.aurora3Dashboard`, standaard op poort 8091, met pagina's in
`public/aurora3/`. De Tuya-driver heeft nog geen overeenkomstige dashboardserver.

De Tuya-driver beschikt wel over een bruikbare basis:

| Onderdeel | Bestaande bron | Gebruik in het voorstel |
| --- | --- | --- |
| Live bedrijfsgegevens | `lib/tuya/services/widget-state-service.ts` | Temperaturen, status, debiet, vermogen, COP en gegevensouderdom |
| DPS-definities | `lib/tuya/definitions/adlar-mapping.ts` | Namen, capability-koppelingen en schaalfactoren |
| Verbinding en ontvangen data | `lib/tuya/services/tuya-connection-service.ts` | Verbindingsstatus en ontvangsttijd |
| Verwerking van Tuya-data | `lib/tuya/services/service-coordinator.ts` | Gegevens bijwerken vanuit `data` en `dp-refresh` |
| Capabilities en bediening | `drivers/intelligent-heat-pump/device.ts` | Actuele waarden en bestaande afhandeling van opdrachten |
| Stooklijnvisualisatie | `lib/tuya/services/heating-curve-visualization-service.ts` | Onderzoeken welke curvegegevens herbruikbaar zijn |

De driver biedt daarnaast capabilities voor onder meer COP/SCOP, externe
metingen, energieprijzen, gebouwinzichten en adaptieve regeling. Of een waarde
daadwerkelijk beschikbaar is, hangt af van het apparaat en de configuratie.

Een rechtstreekse kopie van het Modbus-dashboard past niet bij het protocol.
Tuya rapporteert DPS, soms als gedeeltelijke update, en heeft niet dezelfde
registers, coils, P-/L-parameters of pollgroepen. Eén DPS kan bovendien meerdere
Homey-capabilities bijwerken, bijvoorbeeld een keuzelijst en een statusweergave.

## 2. Besluiten

### D1 — Zes herkenbare pagina's

| Pagina | Route | Inhoud |
| --- | --- | --- |
| Dashboard | `/` | Technisch overzicht: temperaturen, compressor, debiet, vermogen, verbruik, bedrijfsstatus en storingen |
| Live | `/live` | Tegels per onderwerp: verwarming, warmwater, energie, rendement en adaptieve regeling |
| Interactief | `/interactive` | Ondersteunde bediening: aan/uit, doeltemperatuur, bedrijfsmodus, warmwater en curvekeuze |
| Expert | `/expert` | DPS-browser met ruwe en omgerekende waarden, metadata, ontvangsttijd en gekoppelde capabilities |
| Wijzigingen | `/changelog` | Doorzoekbaar overzicht per DPS, huidige/vorige waarde en wijzigingsstatistieken |
| Stooklijn | `/heating-curve` | Geselecteerde Tuya-curve, buitentemperatuur, actuele doeltemperatuur en beschikbare informatie over adaptieve regeling |

Navigatie, licht/donkermodus en mobiele indeling sluiten aan op Aurora II.
Dashboard blijft een compact technisch overzicht; Live groepeert de gegevens
voor dagelijks gebruik. Nog niet gerealiseerde pagina's worden niet als
werkende navigatielinks aangeboden.

### D2 — Eigen service, poort en levenscyclus

- Nieuwe service: `lib/tuya/services/dashboard-service.ts`.
- Nieuwe pagina's: `public/tuya/`.
- Getypeerde app-toegang: `app.tuyaDashboard`.
- Standaardpoort: 8092, instelbaar, met controle op geldige waarden en conflicten
  met de andere dashboardservers.
- Start bij registratie van het eerste Tuya-apparaat; verwijder de bijbehorende
  registratie bij verwijderen van een apparaat. Stop wanneer geen Tuya-apparaten
  meer geregistreerd zijn en bij afsluiten van de app.
- Een bezette poort levert een duidelijke dashboardfout op en mag de gewone
  warmtepompbediening niet verhinderen.
- Timers gebruiken Homey-timers en worden samen met server, callbacks en
  apparaatregistraties opgeruimd.

De ontwikkeling gebruikt de bestaande checkout op de featurebranch, zonder
worktrees. De andere dashboards hoeven voor deze toevoeging niet te worden
omgebouwd.

### D3 — Bestaande datastroom en afzonderlijke apparaatregistraties

De dashboardservice krijgt per apparaat een adapter voor lezen en bedienen.
Alle opgeslagen waarden, callbacks en logs horen bij een expliciet apparaat-ID.
De pagina toont automatisch het eerste geregistreerde Tuya-apparaat, zonder
apparaatkeuze; de apparaatnaam blijft zichtbaar. Een schrijfopdracht
zonder geldig apparaat-ID wordt geweigerd; de laatst geïnitialiseerde warmtepomp
mag nooit stilzwijgend het doel worden.

De browser leest standaard iedere vijf seconden de actuele appgegevens.
Dit interval bepaalt alleen de schermverversing. Het verandert de Tuya-polling
niet en opent geen tweede TuyAPI-verbinding. Onderbreek schermverversing zolang
de pagina verborgen is en ververs direct bij terugkeer.

Voor Expert houdt de app een DPS-cache bij vanuit de bestaande ontvangststroom:

- Voeg gedeeltelijke updates samen; niet meegeleverde DPS behouden hun laatste
  waarde en oorspronkelijke ontvangsttijd.
- Leg per DPS ruwe waarde, laatste ontvangsttijd en laatste wijziging vast.
- Een ongewijzigde waarde die opnieuw binnenkomt krijgt wel een nieuwe
  ontvangsttijd, maar geen nieuw wijzigingsevent.
- Gebruik de bestaande mapping en omzetting; dupliceer geen schaalfactoren in
  HTML of JavaScript van de pagina's.

### D4 — Betekenis, herkomst en ouderdom van waarden blijven zichtbaar

Hergebruik waar passend het bestaande live-widgetcontract en de bronselectie.
Maak voor extra dashboardgegevens een expliciete uitbreiding of adapter.

- Ontbrekende gegevens verschijnen als 'niet beschikbaar', nooit automatisch
  als nul, uit of storingsvrij.
- Toon verbindingsstatus en gegevensouderdom afzonderlijk. Een open verbinding
  garandeert geen recente meetwaarden.
- Gebruik bij DPS de eigen ontvangsttijd. Een bericht over één datapunt maakt
  de overige datapunten niet opnieuw actueel.
- Bij capability-waarden zonder betrouwbare individuele ontvangsttijd blijft
  die ouderdom onbekend; presenteer de algemene ontvangsttijd niet als bewijs
  dat iedere meting recent is.
- Vermeld interne of externe meetbron voor vermogen en debiet. Onderscheid
  berekend thermisch vermogen en geschatte live-COP van andere COP-uitkomsten.
- Toon de beschikbare COP-methode en SCOP-kwaliteit bij die waarden.

### D5 — Bediening volgt de bestaande driverafhandeling

Interactief bedient expliciet ondersteunde capabilities via dezelfde logica
die de bestaande Homey-bediening gebruikt. Alleen een capabilitywaarde in
Homey aanpassen is geen vervanging voor een opdracht aan de warmtepomp.

Valideer op de server apparaat, capability, type, enumwaarden en grenzen.
Maak zichtbaar wanneer een waarde wordt aangevraagd, verzonden, bevestigd of
afgewezen. Een geslaagde verzending is nog geen bevestiging door het apparaat.
Gebruik ontvangen terugkoppeling en een begrensde wachttijd; schrijf niet
automatisch opnieuw bij ontbrekende bevestiging.

De bestaande omgang met handmatige bediening en adaptieve regeling blijft
leidend. Het dashboard voegt geen tweede regelaar toe. Toon bij een setpoint
wanneer de adaptieve regeling dit later opnieuw kan aanpassen.

### D6 — Expert is een DPS-browser

Per datapunt toont Expert nummer, functionele naam, ruwe waarde, omgerekende
waarde, eenheid, ontvangsttijd en alle gekoppelde capabilities. Zo zijn bij
DPS 104 zowel de ruwe vermogenswaarde als de waarde in watt te inspecteren.

De bestaande mapping is de basis, maar vormt op zichzelf geen volledige
beschrijving van schrijfbaarheid, grenzen en toegestane waarden. Vul de
ontbrekende metadata expliciet aan op basis van de bestaande driverbediening
en capability-definities.

- Schrijven is uitsluitend toegestaan voor een expliciete lijst ondersteunde
  bedieningspunten, via dezelfde afhandeling als Interactief.
- Ontvangen onbekende DPS zijn zichtbaar als onbekend en alleen leesbaar.
- Zoek op DPS-nummer (ook DP104/DPS104), Nederlandse/Engelse naam, eenheid,
  ruwe/omgerekende waarde en capability. Combineer zoekwoorden en het filter
  alleen schrijfbaar. Toon het aantal resultaten.
- Bied DPS-, functionele en eenheidsweergave met de gedeelde Expert-CSS.
  Groeperen behoudt ieder datapunt precies eenmaal; ontbrekende eenheden
  vallen onder Geen eenheid. De zoekfunctie werkt in alle weergaven.
- Gebruik geen fictieve Modbus-adressen, pollgroepen of P-/L-parameters.
- Exporteer diagnosegegevens zonder local keys of andere verbindingsgeheimen.

### D7 — Doorzoekbaar parameteroverzicht

Wijzigingen volgt de Modbus-dashboardopzet: één regel per bekende of ontvangen
DPS, gegroepeerd in instellingen (R/W) en meetwaarden (R). Toon huidige en vorige
waarde, vorige ingangsdatum, eerste ontvangst, laatste wijziging, wijzigingsteller
en gemiddelde/minimale/maximale intervalduur. Bewaar maximaal 50 intervallen per
DPS. De eerste ontvangst telt niet als wijziging; identieke ontvangst verandert
alleen de ontvangsttijd. Nog niet ontvangen waarden blijven zichtbaar als onbekend.

Zoek op DPS-nummer, naam, capability of waarde; filter op alleen gewijzigd en
sorteer op kolom. JSON- en Markdown-export volgen de actieve filters en sortering.
De statistieken lopen ook zonder geopende browser en vervallen bij appherstart.
De pagina toont Tuya-DPS-nummers, geen verzonnen Modbus P-/L-parameters.

De interne diagnosebuffer van maximaal 500 events en de afzonderlijke
opdrachtstatus blijven beschikbaar via de API, maar vormen niet de inhoud van
de wijzigingenpagina. Een verzonden opdracht is nog geen apparaatbevestiging.

### D8 — Stooklijn toont wat daadwerkelijk ondersteund is

Toon de geselecteerde verwarmings- en warmwatercurve met begrijpelijke namen.
Hergebruik bestaande curvegegevens en visualisatielogica waar deze de Tuya-curve
daadwerkelijk beschrijven. Verifieer dit voordat lijnen worden getekend.

Onderscheid een geselecteerde apparaatcurve, het actuele setpoint en een
eventuele aanbeveling van de adaptieve regeling. Een curvekeuze zonder bekende
formule blijft als keuze zichtbaar, zonder verzonnen grafiek. Een vrije DIY-curve
zoals bij Modbus valt buiten de scope zolang Tuya daarvoor geen ondersteunde
bediening heeft.

### D9 — Lokalisatie en gedeelde presentatie

Nieuwe gebruikersteksten komen uit `locales/`, ten minste Nederlands en Engels.
Gebruik dezelfde terminologie als de driver en capabilitytitels.

Hergebruik waar praktisch algemene presentatiedelen, bijvoorbeeld navigatie,
thema en waardeformattering. Protocolspecifieke data en bediening blijven in de
Tuya-adapter. Een algemene samenvoeging van alle drie dashboardimplementaties
is geen voorwaarde voor deze toevoeging.

## 3. Voorgesteld API-contract

Onderstaande routes vormen het startpunt voor de implementatie. Alle
apparaatgebonden routes krijgen een expliciet apparaat-ID.

| Route | Functie | Fase |
| --- | --- | --- |
| `GET /api/devices` | Geregistreerde Tuya-apparaten en beschikbare dashboardfuncties | 1 |
| `GET /api/devices/:id/snapshot` | Overzicht en livegegevens met bron- en statusinformatie | 1 |
| `GET /api/devices/:id/capabilities` | Waarden en metadata voor presentatie en ondersteunde bediening | 1 |
| `POST /api/devices/:id/commands` | Gevalideerde bedieningsopdracht met opdracht-ID | 1 |
| `GET /api/devices/:id/commands/:commandId` | Status van een opdracht, inclusief ontbrekende bevestiging | 1 |
| `GET /api/devices/:id/dps` | DPS-metadata en laatst ontvangen waarden | 2 |
| `GET /api/devices/:id/changes` | Parameteroverzicht met wijzigingsstatistieken | 2 |
| `GET /api/devices/:id/events` | Begrensd wijzigingenlog | 2 |
| `GET /api/devices/:id/heating-curve` | Beschikbare curvegegevens en actuele regelcontext | 2 |

Ook opdrachtstatussen worden begrensd bewaard en bij verwijderen van het
apparaat opgeruimd. De API retourneert duidelijke fouten voor onbekende
apparaten, ongeldige invoer en niet-beschikbare bediening.

## 4. Fasering en acceptatie

### Fase 1 — Dashboard, Live en Interactief

- Service, apparaatregistratie, poortinstelling en lifecycle toevoegen.
- Leesadapter en hergebruik van de widgetgegevens realiseren.
- Ondersteunde bediening aansluiten, inclusief terugkoppeling.
- Pagina's opleveren met mobiel ontwerp, thema's en lokalisatie.

Gereed wanneer de drie pagina's op een echte Tuya-installatie werken,
verbindingsverlies en ontbrekende waarden correct worden weergegeven en
dashboardbediening dezelfde uitkomst geeft als Homey-bediening.

### Fase 2 — Expert, Wijzigingen en Stooklijn

- DPS-cache, metadata en begrensd eventslog toevoegen.
- DPS-browser, filters en export realiseren.
- Curvegegevens verifiëren en de beschikbare visualisatie aansluiten.

Gereed wanneer gedeeltelijke DPS-updates correct blijven staan, metadata en
omrekening overeenkomen met de driver en het wijzigingenlog zonder open
browser blijft werken. Curveweergave moet overeenkomen met de ondersteunde
Tuya-curvekeuzes.

## 5. Verificatie bij implementatie

- Gerichte tests voor gedeeltelijke DPS-updates, schaalfactoren, dubbele
  capability-koppelingen, ontbrekende waarden en individuele ontvangsttijden.
- Tests voor apparaatscheiding, grens- en enumvalidatie en opdrachtstatus bij
  ontbrekende terugkoppeling.
- Tests voor logbegrenzing, identieke herhaalde waarden en lifecycle-cleanup.
- `npm run build`, `npm run lint` en `homey app validate`.
- Bij gewijzigde capability- of driverdefinities ook `npm run check:caps` en
  `python3 scripts/migration/verify.py` volgens de repositoryafspraken.
- Handmatig: desktop en mobiel, licht/donker, Nederlands/Engels, reconnect,
  appherstart, bezette poort, meerdere apparaten en gelijktijdige Modbus-dashboards.
- Handmatig: aantonen dat extra browsertabs geen extra Tuya-verbindingen openen
  of apparaatpolling verhogen; bediening controleren met adaptieve regeling aan.
- Leg de uitgevoerde scenario's en resultaten vast in `docs/` bij implementatie.

## 6. Alternatieven en gevolgen

| Alternatief | Afweging |
| --- | --- |
| Modbus-pagina's volledig kopiëren | Snel begin, maar registeraannames en dubbele protocol-/omrekenlogica veroorzaken onderhoudswerk |
| Meteen één dashboard voor alle drivers | Kan later nuttig zijn; vergroot nu de wijziging aan twee bestaande dashboards |
| Alleen de bestaande widget gebruiken | Biedt live-inzicht, maar geen volledige bediening, DPS-diagnose en wijzigingenlog |

Het voorstel volgt de bestaande scheiding per driver en hergebruikt bestaande
Tuya-logica. Er komen een HTTP-service en pagina's bij, met onderhoud voor
metadata, lokalisatie en compatibiliteit met uiteenlopende Tuya-installaties.
De hoeveelheid beschikbare informatie blijft begrensd door ontvangen DPS en
geconfigureerde externe bronnen. Langdurige historische opslag, nieuwe
regelalgoritmen en generiek schrijven naar willekeurige DPS vallen buiten scope.

## 7. Nog te verifiëren bij uitwerking

1. Welke bestaande bedieningshandlers direct herbruikbaar zijn en waar een
   gedeelde methode nodig is voor Homey- en dashboardbediening.
2. Welke curveformules en parameterwaarden de bestaande visualisatieservice
   bevat en of deze overeenkomen met de ondersteunde firmwarevarianten.
3. Welke individuele capability-tijdstippen beschikbaar zijn en welke nieuwe
   registratie nodig hebben, vooral voor externe meetbronnen.
4. Welke signalen daadwerkelijke terugkoppeling op een opdracht geven en welke
   alleen een latere overeenkomende toestand laten zien.
5. Testversie 3.8.0 is vastgesteld op 2026-11-10. Publicatie volgt na
   hardwareacceptatie.

## 8. Implementatie en verificatie (2026-11-09)

Beide fasen zijn gerealiseerd op `codex/tuya-dashboard`, zonder worktree:

- `dashboard-service.ts` beheert HTTP, metadata, apparaatregistraties en poorten.
- `dashboard-device.ts` beheert DPS-cache, opdrachten en events per apparaat.
- De Tuya-coördinator geeft ontvangen DPS en verbindingsovergangen synchroon
  door. De dashboardservice opent geen Tuya-verbinding.
- `public/tuya/` bevat één gedeelde pagina-opbouw voor alle zes routes, met
  aparte JavaScript en CSS. Teksten komen uit `locales/en.json` en `nl.json`.
- De apparaatinstelling `dashboard_port` heeft standaardwaarde 8092. Alle
  Tuya-apparaten delen één server; bij opstarten kiest het eerste apparaat de
  poort. Een expliciete wijziging van de instelling verplaatst die server.
  Als de nieuwe poort bezet is, blijft de bestaande server beschikbaar.
- De lineaire visualisatieservice bevat app-curveparameters, geen geverifieerde
  Tuya H/L-formules. Daarom toont Stooklijn de apparaatkeuzes afzonderlijk van
  de app-curve. Zonder parameters wordt geen grafiek verzonnen.
- Opdrachtstatus `observed` betekent een overeenkomende DPS-waarde na aanvraag,
  niet bewezen causaliteit. Een capability-update alleen bevestigt niets.

Build, alle 480 unit-tests (waarvan acht nieuwe dashboardtests), capability- en
migratiecontroles en Homey-validatie op publicatieniveau slagen. De gewijzigde
productiecode slaagt voor gerichte ESLint-controle. De algemene lintcheck heeft
bestaande fouten en sluit via de TypeScript-configuratie de testdirectory uit;
ook de nieuwe test valt onder dat configuratieprobleem.

De browsercontrole gebruikte uitsluitend gesimuleerde apparaten. De echte
Tuya-installatie is niet gewijzigd of bediend. Zie het
[testprotocol](../testing/ADR-068-TUYA-DASHBOARD.md) voor gecontroleerde
scenario's en de nog uit te voeren hardwareacceptatie.

### Vormgeving gelijkgetrokken (2026-11-10)

De zes Aurora II-pagina's en hun Tuya-equivalent laden nu dezelfde CSS-bestanden
uit `public/styles/`. De oorspronkelijke inline Aurora II-CSS is ongewijzigd
verplaatst; `lib/shared/dashboard-styles.ts` koppelt de routes aan deze bestanden.
Beide dashboardservers serveren uitsluitend deze toegestane stylesheetpaden.

`public/tuya/dashboard.css` bevat alleen aanvullingen voor de taalkeuze en
verschillen in de HTML-opbouw. De afzonderlijke Tuya-logobalk is verwijderd,
de tabvolgorde volgt Aurora II en Live gebruikt dezelfde rubriek- en tegelklassen.
Kleuren, lettertypen, navigatie, tabellen en bedieningskaarten komen uit de
bijbehorende Aurora II-stylesheet, inclusief licht/donker en mobiele indeling.
