# ADR-003 — Sanering Tuya-defensielagen en zombie-detectie

- **Status**: Fase 0 en Fase 1 geïmplementeerd en gereviewd (zie §8); wacht op uitrol en 14 dagen meetdata. Fase 2 en 3 niet begonnen
- **Datum**: 2026-08-22
- **Beslisser**: *(in te vullen)*
- **Doelversie**: v3.1.0 (Fase 0 + Fase 1), v3.2.0 (Fase 2)
- **Blokkeert**: [ADR-002](ADR-002-TUYA-VERBINDINGSMODEL.md) Fase A — die meetfase is ongeldig zolang Fase 0 hieronder niet is doorgevoerd
- **Bouwt voort op**: [TUYA-ZOMBIE-ASSESSMENT-EN-DEFENSIESTRATEGIE.md](TUYA-ZOMBIE-ASSESSMENT-EN-DEFENSIESTRATEGIE.md)
- **Doelsysteem**: [`TuyaConnectionService`](../../lib/tuya/services/tuya-connection-service.ts)
- **Revisies**: zie [Bijlage A](#bijlage-a--wijzigingen-ten-opzichte-van-v1)

---

## 1. Besluit in het kort

De zombie-meldingen komen niet uit laagoverlap voort maar uit **drie code-defecten**. We repareren die eerst, meten daarna, en saneren pas als de meting uitwijst welk mechanisme daadwerkelijk overbodig is.

| Fase | Inhoud | Versie |
|---|---|---|
| **0** | Impact tellen, test schrijven, drie defecten repareren | v3.1.0 |
| **1** | Telemetrie toevoegen, notificaties dempen, dode code opruimen | v3.1.0 |
| **2** | Mechanismen saneren op basis van meetdata | v3.2.0 |
| **3** | Pollmodel afwegen — [ADR-002](ADR-002-TUYA-VERBINDINGSMODEL.md) | toekomst |

Fase 0 is blokkerend voor al het overige, inclusief voor ADR-002.

---

## 2. Context

### 2.1 De drie defecten

Alle drie zijn code-geverifieerd; zie het [onderzoeksverslag §3](TUYA-ZOMBIE-ASSESSMENT-EN-DEFENSIESTRATEGIE.md) voor de volledige onderbouwing.

1. **`waitForDataEvent()` meet het verkeerde venster** (r. 1736). De wachtvlag gaat pas aan nádat `tuya.get({ schema: true })` is geresolved, terwijl TuyAPI het `data`-event al vóór die resolve uitzendt (`tuyapi/index.js` r. 885 versus r. 920-921). Layer 1 en Layer 2 melden daardoor "zombie" op gezonde verbindingen.
2. **De `dp-refresh`-handler werkt de zombie-velden niet bij** (r. 1131-1144). `lastDataEventReceived` en `waitingForDataEvent` blijven ongemoeid, dus antwoorden zonder `dps[1]` tellen voor geen enkele data-event-controle mee — ook niet voor de correcte controles in `verifyConnectionHealth()` en de periodieke DPS-refresh.
3. **De TuyAPI-instance wordt hergebruikt met een stale ping-timeout**. `_pingPongTimeout` wordt bij `disconnect()` niet op `null` gezet (`tuyapi/index.js` r. 944-945). Op een hergebruikte instance armeert TuyAPI geen nieuwe ping-timeout tot er een pong binnenkomt — dus juist niet wanneer de nieuwe socket stil blijft. Onze `disconnect()` (r. 463) nulld de instance alleen `if (this.isConnected)`, en `attemptReconnectionWithRecovery()` (r. 2008) omzeilt de wrapper volledig.

### 2.2 Wat géén probleem is

- **De stale-check werkt.** Hij draait elke 20 seconden via de health loop in `scheduleNextReconnectionAttempt()` (r. 1826-1837), gestart op alle relevante paden. Er hoeft niets gebouwd te worden; wat resteert is een leesbaarheidsrefactor (F2-6).
- **Layer 0 is niet redundant.** In het scenario van defect 3 is het de enige overgebleven detector. Verwijderen is uitgesloten zolang defect 3 bestaat.

### 2.3 Wat het besluit verder raakt

- **Notificatiedrempels**: de code kent 2, 10 en 30 minuten (r. 1841-1881), niet de 15 minuten die eerdere documenten noemden.
- **Deduplicatie**: de sleutel `${title}:${message}` (r. 2184) laat afwijkende tekst al na 5 seconden opnieuw door. Omdat de meldingen dynamische inhoud bevatten, is de feitelijke rem 5 seconden en niet 30 minuten.
- **Actieve `set()` als heartbeat**: Layer 2 stuurt `tuya.set({ dps: 1, set: currentOnOff })` als routineuze gezondheidscheck. Een schrijfcommando naar een warmtepomp hoort geen heartbeat te zijn.

---

## 3. Fasering

### Fase 0 — Reproduceren en repareren (v3.1.0, blokkerend)

- **F0-0 — impact tellen uit de bestaande logs.** Tel over een representatieve periode het aantal `Heartbeat probe at …`-regels tegenover het aantal `[LAYER 1-2] ZOMBIE DETECTED`-blokken. Bij defect 1 ligt die verhouding dicht bij 1:1. Kost minuten en toetst de analyse vóórdat er code verandert. Wijkt de verhouding sterk af, dan gaat dit besluit terug naar de tekentafel.
- **F0-1 — testdekking toevoegen.** `test/unit/tuya-connection-service.zombie.test.js`, in de stijl van de bestaande `node --test`-bestanden. Zie §4.3. **Eerst rood, dan pas F0-2.** *(Geplaatst op 2026-08-22; 6 tests, draait groen op Node v22.)*
- **F0-2 — `waitForDataEvent()` repareren in plaats van afschaffen.** Het `preQueryDataTime`-patroon dat elders in hetzelfde bestand al correct staat (`verifyConnectionHealth()` r. 487, `startPeriodicDpsRefresh()` r. 1360): timestamp vóór de query, daarna vergelijken. Zie §4.1.

  *Waarom niet simpelweg "resolvende `get()` = gezond"?* Omdat dat het onderscheid wegneemt tussen *request-path bereikbaar* en *telemetrie vers* — precies het onderscheid dat §5 nodig heeft als mitigatie voor een vastgelopen MCU.

- **F0-3 — `dp-refresh`-handler gelijktrekken** met de `data`-handler: ook `lastDataEventReceived` bijwerken, `waitingForDataEvent` resetten en `zombieRecoveryAttempts` resetten. Zie §4.2.
- **F0-4 — TuyAPI-instance niet hergebruiken na disconnect.** Introduceer één `destroyTuyaInstance()` die `tuya.disconnect()`, `removeAllListeners()` en `this.tuya = null` combineert, en leid **alle** afbraakpaden daarnaartoe:
  - de wrapper `disconnect()` (r. 463) — de guard `if (this.tuya && this.isConnected)` moet vervallen, want op het Layer 0-pad is `isConnected` al `false`;
  - de directe aanroep in `attemptReconnectionWithRecovery()` (r. 2008) — dit pad loopt bij élke geplande herverbinding en wordt door een wrapper-only fix gemist;
  - de aanroepen in `reinitialize()` (r. 258) en de teardown (r. 2317), voor consistentie.

### Fase 1 — Meten en stabiliseren (v3.1.0)

- **F1-1 — telemetrie toevoegen, samen met [ADR-002](ADR-002-TUYA-VERBINDINGSMODEL.md) Fase A1.** Minimaal: Layer 1-successen mét en zónder verse data; verdeling `data` versus `dp-refresh`; welke laag de eerste detector was; frequentie van instance-hergebruik.

  **Bouw dit één keer.** ADR-002 Fase A1 vraagt vrijwel dezelfde tellers vanuit een andere vraag. Twee losse tellersets naast elkaar levert twee waarheden op.

  **Deze fase blokkeert ADR-002.** Vraag A2 daar — *welk aandeel van de disconnects is zombie versus clean?* — beslist over een herschrijving van naar schatting 800 à 1200 regels. Met defect 1 actief valt dat antwoord onvermijdelijk uit op "overwegend zombie".

- **F1-2 — notificaties dempen en drempels expliciet herzien.** `sendCriticalNotification` vervalt bij routineuze `disconnected`-events, socket-errors en zombie-detecties binnen de normale herstellus. De drempels van 2, 10 en 30 minuten worden vervangen door één drempel voor aanhoudende uitval; de waarde daarvan is een productbeslissing (voorstel: 15 minuten, aansluitend op `STALE_CONNECTION_THRESHOLD_MS`).
- **F1-3 — deduplicatie per uitval.** Vervang de sleutel `${title}:${message}` door een **outage-id** dat bij aanvang van een uitval wordt aangemaakt en pas bij herstel vervalt.
- **F1-4 — dode referentiecode opruimen.** `startReconnectInterval()`, `scheduleNextReconnectionAttempt()`, `attemptReconnectionWithRecovery()` en `updateRecoveryStrategy()` in [`drivers/intelligent-heat-pump/device.ts`](../../drivers/intelligent-heat-pump/device.ts#L557-L745) staan al gemarkeerd met `// TODO: DEAD CODE`. Opruimwerk, geen onderdeel van de defensiestrategie.

### Fase 2 — Saneren op basis van meetdata (v3.2.0)

- **F2-1 — de-escalatie van Layer 2**: geen actieve `set()` meer als routineuze gezondheidscheck. De wake-up blijft op het herstelpad na langdurige uitval (`HEARTBEAT_DISCONNECTED_DELAY_MS`).
- **F2-2 — periodieke DPS-refresh heroverwegen**: zodra Layer 1 betrouwbaar is, zijn twee identieke `get({ schema: true })`-cycli (5 min en 15 min) redundant.
- **F2-3 — mechanismen pas verwijderen** wanneer de telemetrie aantoont dat ze in geen enkel gemeten scenario de eerste detector waren. Layer 0 komt hiervoor niet in aanmerking zolang F0-4 niet in productie is bevestigd.
- **F2-4 — health loop losknippen** van `scheduleNextReconnectionAttempt()`: eigen methode, eigen timer-handle in plaats van de gedeelde `reconnectInterval`. Puur leesbaarheid, geen gedragswijziging.

### Fase 3 — Transitie naar polling (conform ADR-002)

Na afronding van de meetfase wordt onderzocht of Tuya kan overstappen op hetzelfde poll-model als Modbus TCP. Pas na protocol- en praktijkvalidatie wordt bepaald welke watchdogs en verbindingslogica kunnen vervallen.

---

## 4. Technische specificatie

### 4.1 Herziene data-event-verificatie (F0-2)

Het venster opent **vóór** de query, niet erna:

```typescript
/**
 * Verifieer of een query daadwerkelijk verse telemetrie opleverde.
 * Het venster opent VOOR de query, zodat een data-event dat tijdens de
 * query binnenkomt (TuyAPI emit 'data' vóór de resolve van get()) meetelt.
 */
private async probeWithDataEvent(timeoutMs: number): Promise<{
  requestOk: boolean; dataFresh: boolean;
}> {
  const preQueryDataTime = this.lastDataEventReceived;   // (1) venster opent hier

  let timeoutHandle: NodeJS.Timeout | null = null;
  try {
    await Promise.race([
      this.tuya!.get({ schema: true }),
      new Promise((_, reject) => {
        timeoutHandle = this.device.homey.setTimeout(
          () => reject(new Error('Heartbeat get() timeout')),
          DeviceConstants.HEARTBEAT_TIMEOUT_MS,
        );
      }),
    ]);
  } catch (getError) {
    return { requestOk: false, dataFresh: false };       // (2) alleen dit escaleert direct
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }

  this.lastSuccessfulRequestAt = Date.now();             // (3) request-pad bewezen

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (this.lastDataEventReceived > preQueryDataTime) {
      return { requestOk: true, dataFresh: true };
    }
    await new Promise((resolve) => {
      this.device.homey.setTimeout(resolve, 100);
    });
  }

  return { requestOk: true, dataFresh: false };          // (4) bereikbaar, maar stil
}
```

**Escalatieregels:**

| Uitkomst | Betekenis | Actie |
|---|---|---|
| `requestOk: false` | Geen Tuya-protocolresponse | Escaleren naar herstel (`forceReconnect` / ADR-026) |
| `requestOk: true, dataFresh: true` | Verbinding gezond | Geen actie; `lastDataEventAt` bijwerken |
| `requestOk: true, dataFresh: false` | Bereikbaar, maar geen verse telemetrie | **Niet meteen reconnecten.** Tellen; pas na drie opeenvolgende keren escaleren (zie §5, regressierisico) |

`lastSuccessfulRequestAt` en `lastDataEventAt` blijven uitdrukkelijk **gescheiden**. Een succesvolle `get()` mag alleen de eerste bijwerken; `lastDataEventAt` blijft de enige bron voor dataversheid en capability-health.

### 4.2 Handler-pariteit (F0-3)

| Veld | `data`-handler | `dp-refresh` nu | `dp-refresh` na F0-3 |
|---|---|---|---|
| `lastDataEventTime` | ✅ | ✅ | ✅ |
| `lastDataEventReceived` | ✅ | ❌ | ✅ |
| `waitingForDataEvent` | ✅ | ❌ | ✅ (vervalt zodra §4.1 is doorgevoerd) |
| `zombieRecoveryAttempts` reset | ✅ | ❌ | ✅ |

### 4.3 Testdekking (F0-1)

Bestaande conventie: `npm test` draait `node --test test/unit/*.test.js` tegen de gebouwde `.homeybuild/`-output. Nieuw bestand: `test/unit/tuya-connection-service.zombie.test.js`, met een nep-TuyAPI die het emit-vóór-resolve-gedrag nabootst.

| Geval | Vóór F0-2 | Ná F0-2 |
|---|---|---|
| `get()` resolvet ná een `data`-event | detectie meldt "geen data event" | `dataFresh: true` |
| Antwoord komt binnen als `dp-refresh` | idem | `dataFresh: true` (na F0-3) |
| `get()` rejectet (timeout) | escalatie naar herstel | ongewijzigd |
| Geen antwoord, socket stil | escalatie naar herstel | ongewijzigd na drie probes |

De test is het objectieve criterium voor "F0-2 is klaar" en blijft daarna als regressiewachter staan — ook bij een toekomstige TuyAPI-upgrade.

---

## 5. Gevolgen en risico's

### Positieve gevolgen

- Werkende verbindingen worden niet langer verbroken door een meetfout.
- Apparaten die met `dp-refresh` antwoorden worden niet langer als stil beschouwd.
- De native ping-detectie blijft gearmeerd na een herverbinding.
- Geen notificatiestormen bij kortstondige Wi-Fi-dips.
- Minder netwerkverkeer: geen actieve `set()`-wake-up meer in de routineuze heartbeat (Fase 2).

### Risico's

| Risico | Kans | Impact | Mitigatie |
|---|---|---|---|
| **Trager herstel bij een echte zombie** — de valse detectie voert nu wél een `forceReconnect()` uit en herstelt conditie E daarmee bij toeval binnen 5 minuten. Na F0-2 valt dat weg en schuift herstel naar de stale-check op 15 minuten. | Middel | Middel | Escaleren na drie opeenvolgende probes zonder verse data (§4.1), zodat herstel binnen ±15 minuten blijft in plaats van 15 minuten te worden. Alternatief: `STALE_CONNECTION_THRESHOLD_MS` verlagen — maar pas ná F0-3, anders wordt een `dp-refresh`-only pomp onterecht als stale aangemerkt. |
| Vastgelopen MCU die protocolresponses geeft maar geen verse telemetrie | Middel | Middel | `lastSuccessfulRequestAt` en `lastDataEventAt` gescheiden houden; de bestaande 20s stale-check als vangnet; capability-health als tweede signaal |
| Mechanismen verwijderen die in zeldzame scenario's tóch de eerste detector zijn | Middel | Hoog | Fase 2 pas na de meetperiode; verwijderen alleen met meetbewijs |
| Regressie door F0-4 (instance-hergebruik wijzigen) | Laag | Middel | Bestaande stabilisatiedelay van 2s blijft; V0-3 en V0-4 dekken dit af |
| Gebruiker mist een echte netwerkstoring | Laag | Laag | Notificatie bij aanhoudende uitval blijft intact |
| Meetperiode vertraagt de sanering | Hoog | Laag | Bewuste keuze: saneren zonder schone meting is de duurdere fout gebleken |

---

## 6. Validatiecriteria

### Fase 0

- **V0-0 — logtelling uitgevoerd**: de verhouding probe/zombie-melding uit F0-0 is vastgelegd en bevestigt of weerlegt de analyse.
- **V0-1 — test faalt vóór en slaagt ná de fix**: `npm test` toont het defect aan op de ongerepareerde code.
- **V0-2 — geen valse zombie op een gezonde verbinding**: bij een normaal antwoordende pomp levert de probe `requestOk: true, dataFresh: true`. Nul `ZOMBIE DETECTED`-blokken over 24 uur.
- **V0-3 — geen instance-hergebruik**: na elke `disconnect()` — inclusief het Layer 0-pad waar `isConnected` al `false` is — is `this.tuya === null`.
- **V0-4 — native ping-timeout blijft gearmeerd**: na een reconnect leidt het uitschakelen van de pomp binnen circa 12 seconden tot een native `disconnected`-event, niet pas na 35 seconden via Layer 0.
- **V0-5 — stale-check blijft werken**: een apparaat dat protocolresponses geeft maar geen nieuwe DPS-data laat `lastSuccessfulRequestAt` vooruitgaan en `lastDataEventAt` niet; de 20s-check grijpt in binnen de drempel. Regressietest op bestaand gedrag.
- **V0-6 — hersteltijd bij conditie E niet verslechterd**: meet de tijd tot herstel vóór en ná F0-2 bij een gesimuleerde stille MCU. Mag niet oplopen van circa 5 naar 15 minuten.

### Fase 1

- **V1-1 — geen regressie bij harde uitval**: fysiek uitschakelen leidt binnen 35-45 seconden tot status `disconnected`, en de telemetrie registreert wélke laag het detecteerde.
- **V1-2 — nul zombie-pushnotificaties tijdens normaal 24-uursbedrijf.**
- **V1-3 — succesvolle automatische herverbinding**: na een router-herstart herstelt de verbinding binnen de backoff-tijd (20-60s) geruisloos.
- **V1-4 — deduplicatie per uitval**: één uitval van willekeurige duur produceert **exact één** notificatie, ook bij onderling verschillende meldingteksten.

### Doorlopend

- **V-D1**: `npm test` en `homey app validate` slagen foutloos, en `npm run lint` levert **geen nieuwe** bevindingen op.

> **Let op — `npm run lint` slaagt op dit moment niet.** De hele `test/`-boom (9 bestanden) geeft `Parsing error: ESLint was configured to run … using parserOptions.project … that TSConfig does not include this file`, plus vier `lib/`-bestanden met eigen bevindingen. Dat is een bestaande situatie, niet door dit besluit veroorzaakt: elk testbestand in de repository heeft hem. `test/unit/tuya-connection-service.zombie.test.js` voegt er één instantie aan toe en volgt daarmee exact de conventie van de bestaande tests.
>
> De oplossing is één regel — `test/` opnemen in een `.eslintignore`, of in `tsconfig.json` binnen `include` trekken. Los te pakken van dit besluit, maar wel voordat "lint slaagt foutloos" als criterium bruikbaar wordt.

---

## 7. Openstaande beslissingen

| # | Beslissing | Nodig vóór |
|---|---|---|
| 1 | Escaleren na hoeveel opeenvolgende probes zonder verse data? **Uitgesteld tot na de meting** — `layer1.none` beantwoordt dit met een cijfer (§8.3). | na 14 dagen meten |
| 2 | Blijft `STALE_CONNECTION_THRESHOLD_MS` op 15 minuten, of omlaag als extra dekking voor conditie E? | na 14 dagen meten |
| 3 | ~~Kan de `waitingForDataEvent`-vlag vervallen?~~ **Beslist: vlag is verwijderd.** | — |
| 4 | Welke van de twee `get()`-cycli verdwijnt in Fase 2: de 5-minuten heartbeat of de 15-minuten refresh? | F2-2 |
| 5 | ~~Welke enkele outage-drempel vervangt 2/10/30 minuten?~~ **Beslist: 15 minuten (`OUTAGE_NOTIFICATION_DELAY_MS`).** | — |
| 6 | `test/` uitsluiten in `.eslintignore` of opnemen in `tsconfig.json`, zodat `npm run lint` weer kan slagen? | V-D1 bruikbaar maken |
| 7 | `outageId` alsnog inzetten voor deduplicatie, of schrappen? | opruiming |
| 8 | `sendCriticalNotification()` gelijktrekken met `sendUserNotification()` of verwijderen? | opruiming |

---

## 8. Implementatiestatus

Geverifieerd op 2026-08-22 tegen de werkkopie. `tsc --noEmit` is schoon en `node --test test/unit/*.test.js` slaagt (46 tests). `homey app validate` is nog niet gedraaid — de CLI staat niet lokaal geïnstalleerd.

| Item | Status | Aantekening |
|---|---|---|
| F0-0 logtelling | ✗ open | Activiteit, geen code. **Moet vóór uitrol**, daarna is het "voor"-cijfer onherstelbaar weg |
| F0-1 testdekking | ✅ | `test/unit/tuya-connection-service.zombie.test.js`, 13 tests tegen de echte service in `.homeybuild` |
| F0-2 `waitForDataEvent` | ✅ | Meetfout verholpen. Escalatieregel bewust niet gebouwd — zie §8.3 |
| F0-3 `dp-refresh`-pariteit | ✅ | Verder dan de spec: ook `lastDataEventSource` voor telemetrie |
| F0-4 instance-opruiming | ✅ | `destroyTuyaInstance()`; geen directe `tuya.disconnect()`-aanroepen meer, en het hergebruik wordt nu geteld als invariantcontrole |
| F1-1 telemetrie | ✅ | `recordConnectionTelemetry` / `recordDetector`, per dag gepersisteerd, 14 dagen retentie, uitleesbaar via §8.1 |
| F1-2 notificaties | ✅ | 2/10/30 min vervangen door één melding na `OUTAGE_NOTIFICATION_DELAY_MS` (15 min) |
| F1-3 dedup per uitval | ✅ | Via `outageNotificationSent`; `outageId` blijft diagnostisch (§8.3) |
| F1-4 dode code | ✅ | `device.ts` −209 regels |
| Fase 2 / Fase 3 | ✗ | Niet begonnen; wacht op meetdata |

### 8.1 Hoe de telemetrie wordt uitgelezen

De tellers stonden aanvankelijk alleen in de device store en waren daarmee in de praktijk write-only: `getDiagnostics()` wordt nergens in de app aangeroepen. Voor een meetfase van veertien dagen is dat onbruikbaar.

Toegevoegd zijn daarom twee optionele capabilities, allebei `uiComponent: null`:

| Capability | Type | Rol |
|---|---|---|
| `adlar_zombie_detections_daily` | number, `insights: true` | `detectors.layer1 + detectors.layer2` — de heartbeat-detecties, oftewel de melding die gebruikers zagen. Insights levert de grafiek; naast `adlar_daily_disconnect_count` gelezen geeft dit de zombie-versus-clean-verhouding |
| `adlar_connection_diagnostics` | string | De volledige telemetrie als JSON: probe-uitkomsten, detector-attributie, herverbindingspogingen, hersteltijden |

Beide hangen aan de bestaande setting `show_disconnect_diagnostic`, die daarmee drie capabilities dekt in plaats van één; label en hint zijn navenant aangepast. Er is geen nieuwe setting bijgekomen.

**Gevolg voor bestaande installaties**: de setting staat standaard uit, dus een device dat nooit diagnostiek aanzette merkt niets van deze toevoeging. Zet de gebruiker hem aan, dan komen de capabilities erbij zonder op de tegel te verschijnen. Insights doet geen backfill — de reeks begint bij nul op het moment van aanzetten.

### 8.2 Bevindingen uit de review van de implementatie

De implementatie is vóór commit doorgelezen; twee defecten zijn daarbij gevonden en verholpen.

**Incident-lek (blokkerend, verholpen).** `attemptReconnectionWithRecovery()` keerde vroeg terug bij `isConnected === true` zonder het incident af te sluiten. Bereikbaar via de heartbeat-wake-upprobe bij een uitval ≥ 15 minuten: die `set()` laat TuyAPI intern opnieuw verbinden, waardoor `isConnected` al `true` was voordat de hersteltimer afging. Twee stille gevolgen: `recordDetector()` liet daarna élke detectie vallen — de telemetrie bevroor — en `outageStartTime` bleef staan waardoor de gebruiker **nooit meer** een uitvalmelding zou krijgen. Nu afgesloten op de vroege return én, als vangnet, in de gezonde tak van de health loop.

**`disconnectsZombie` telde requestfouten mee (verholpen).** Een `get()` of `set()` die een timeout gaf werd als zombie geteld, terwijl een gedetecteerde requestfout juist een schone disconnect is. Omdat ADR-002 A2 de zombie-verhouding gebruikt om een herschrijving van 800 à 1200 regels te rechtvaardigen, telde dat de verkeerde kant op. Nu alleen zombie wanneer beide probes het apparaat bereikten zonder verse telemetrie.

Beide zijn afgedekt door tests die aantoonbaar falen als de fix wordt teruggedraaid.

Drie kleinere punten uit dezelfde review zijn eveneens afgehandeld: `instancesReusedOnReconnect` wordt nu daadwerkelijk opgehoogd (invariantcontrole op F0-4), de deep socket error handler wordt weer expliciet van de rauwe socket losgekoppeld (herstel van `FIX v2.9.22`), en belangrijke telemetriegebeurtenissen worden direct weggeschreven in plaats van te wachten op de debounce van 60 seconden.

### 8.3 Wat er nog open staat

**F0-0 — de nulmeting.** Het enige item dat na uitrol niet meer in te halen is. Tel in de bestaande logs de verhouding tussen `Heartbeat probe at …` en `[LAYER 1-2] ZOMBIE DETECTED`.

**De escalatieregel — bewust uitgesteld.** §4.1 schrijft voor dat `requestOk: true, dataFresh: false` pas na drie opeenvolgende keren mag escaleren. Dat is niet gebouwd, en het advies is gewijzigd: de teller `layer1.none` meet precies de gevallen waar de regel over gaat. Is die na uitrol vrijwel nul, dan lost de regel een niet-bestaand probleem op; is hij dat niet, dan kies je de drempel met een cijfer in plaats van een schatting. De oorspronkelijke eis ("beslissen vóór F0-2") stamt van vóórdat de telemetrie bestond.

*Consequentie zolang de regel ontbreekt*: conditie C uit het onderzoeksverslag — een antwoord dat er langer dan tien seconden over doet — levert nog steeds een valse detectie op. Het regressierisico uit §7.3 van het verslag is daarentegen **niet** actueel: de directe reconnect is blijven staan, dus de hersteltijd bij een echte zombie is onveranderd.

**`outageId` is decoratief.** Het veld wordt aangemaakt en gelogd maar speelt geen rol in de deduplicatie; die loopt via `outageNotificationSent`. Óf alsnog inzetten, óf schrappen.

**`sendCriticalNotification()` bestaat nog** met de sleutel `${title}:${message}` en de ontsnapping van vijf seconden. Eén aanroeppad (`Device Connection Failed` bij niet-herstelbare fouten), dus kleine blootstelling — maar de val uit §2.3 staat er nog.

**`destroy()` is synchroon** en kan de laatste telemetrie-persist niet afwachten. Het verlies is nu begrensd tot de hoogfrequente tellers; de belangrijke gebeurtenissen worden direct weggeschreven. Volledig oplossen vraagt een async teardown-keten.

**Uitrol.** `homey app validate` draaien, `app.json` opnieuw laten samenstellen zodat de twee nieuwe capabilities landen, en de changelog van v3.1.0 concreter maken: noem de nieuwe notificatiedrempel van vijftien minuten, want gebruikers die de melding na twee minuten gewend waren zullen het verschil merken.

---

## Bijlage A — Wijzigingen ten opzichte van v1

| Onderwerp | v1 | Nu |
|---|---|---|
| Aard van het probleem | Overlappende lagen, vermoedelijke false positives | Drie bevestigde defecten; de overlap is secundair |
| Fasering | Sanering + poll | Reproduceren → repareren → meten → saneren → poll |
| Fix `waitForDataEvent` | Data-event-controle laten vervallen | Controle repareren met het `preQueryDataTime`-patroon |
| Layer 0 | "Redundante watchdog", mocht gedegradeerd worden | Onmisbaar zolang instances worden hergebruikt |
| Stale-datacontrole | Opgevoerd als bestaand vangnet | Bevestigd: draait elke 20s; een tussenversie beweerde ten onrechte het tegendeel |
| Reikwijdte instance-fix | n.v.t. | Ook de directe aanroep op r. 2008, niet alleen de wrapper |
| Notificatiedrempels | "15 minuten" | 2, 10 en 30 minuten; wijziging is een expliciet besluit |
| Deduplicatie | "bestaande throttling volstaat" | Niet robuust — 5 seconden bij afwijkende tekst |
| Testdekking | Ontbrak | F0-1, vóór de fix |
| Regressierisico van de fix | Ontbrak | Trager herstel bij conditie E; gemitigeerd via escalatie op herhaling |
| Dode code in `device.ts` | Besluitpunt | Opruimtaak in Fase 1 |
