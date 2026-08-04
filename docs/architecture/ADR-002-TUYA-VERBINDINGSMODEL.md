# ADR-002 — Tuya-verbindingsmodel: persistente socket of polling?

- **Status**: Onderzoek — géén besluit. Meetfase moet eerst worden uitgevoerd.
- **Datum**: 2026-08-03
- **Afhankelijkheid**: uitvoeren **ná** ADR-001 (v3.0.0). Niet gelijktijdig.
- **Aanleiding**: de vraag of een eigen, op onze situatie toegesneden tuyapi-variant de
  defensieve lagen overbodig zou maken.

## Samenvatting

De defensieve lagen in `tuya-connection-service.ts` compenseren niet de codekwaliteit van
tuyapi, maar het **verbindingsmodel**: een persistente TCP-socket met push-events. Een
eigen protocolimplementatie verandert daar niets aan.

Wat de lagen wél overbodig zou maken is overstappen op een request/response-pollmodel — en
dat kan met tuyapi ongewijzigd.

Deze ADR legt vast wat we eerst moeten meten voordat die stap te verantwoorden is.

## Context — de meting die deze ADR uitlokte

Twee transports, dezelfde ontwikkelaar, dezelfde defensieve filosofie:

| Term (case-insensitive) | `tuya-connection-service.ts` | `modbus-tcp-service.ts` |
|---|---|---|
| `heartbeat` | 119 | **0** |
| `zombie` | 27 | **0** |
| `recover` | 58 | **0** |
| `reconnect` | 165 | 31 |
| `backoff` | 39 | 10 |
| `timeout` | 65 | 28 |
| **Regels totaal** | **2333** | **787** |

De Modbus-service heeft geen heartbeat, geen zombie-detectie en geen recovery-escalatie.
Niet omdat `jsmodbus` beter is dan `tuyapi`, maar omdat het verbindingsmodel verschilt.

### Waarom het model bepalend is

**Tuya vandaag** — persistente socket, push-gestuurd:

```typescript
this.tuya.on('data',       (data) => …);   // regel 1095
this.tuya.on('dp-refresh', (data) => …);   // regel 1131
this.tuya.on('connected',  () => …);
this.tuya.on('disconnected', () => …);
```

De socket kan stil sterven zonder dat het OS een `close`-event levert: de zombie-toestand.
Er is geen natuurlijk moment waarop je merkt dat er niets meer komt, dus moet je dat
kunstmatig creëren — vandaar vijf detectielagen:

| Laag | Interval (code) | Mechanisme |
|---|---|---|
| 0 | 35 s | Native `heartbeat`-events van tuyapi |
| 1–2 | 5 min | Hybride probe: `get({schema:true})`, daarna `set({dps:1})` |
| 3 | 15 min | DPS-refresh als NAT keep-alive |
| 4 | 15 min | Stale-connection force-reconnect |

**Modbus vandaag** — request/response met deadline. Een poll die niet terugkomt *ís* de
gezondheidscheck. Een zombie-verbinding kan niet bestaan als elke cyclus een verse aanvraag
met timeout is. Poll-groepen: superfast 5 s, fast 10 s, medium 30 s, slow 300 s.

### Bijvangst uit de analyse

De constanten dragen sporen van herhaald bijstellen op basis van veldmeldingen:

```typescript
/** … (v0.99.98, v1.0.25→10min, v1.0.32→5min for TCP resilience) */
HEARTBEAT_TIMEOUT_MS = 20 * 1000;              // "increased for poor signal conditions"
HEARTBEAT_DATA_EVENT_TIMEOUT_MS = 10 * 1000;   // "was hardcoded 5s - too aggressive for high latency"
STALE_CONNECTION_THRESHOLD_MS = 15 * 60 * 1000; // v1.0.25→30min, v1.0.32→15min
```

Dat is tweeledig bewijs: het probleem is reëel, én het is inmiddels flink gemitigeerd. Een
herschrijving concurreert dus tegen een systeem dat al door tientallen iteraties is
gegaan — dat is een hogere lat dan hij op het eerste gezicht lijkt.

**Documentatiedrift geconstateerd**: `HEARTBEAT_MECHANISM.md` noemt Layer 3 op 5 minuten en
Layer 4 op 10 minuten; de constanten staan beide op 15 minuten. Los van deze ADR te
corrigeren.

## Over de aanleiding: "Home Assistant-gebruikers hebben dit niet"

Te verifiëren voordat er conclusies aan worden verbonden, maar de architectuur verklaart
het vermoedelijk:

- De **officiële** Tuya-integratie in Home Assistant is cloud-gebaseerd. Andere faalmodus,
  geen geldige vergelijking.
- De lokale alternatieven (`tinytuya`, `localtuya`) pollen overwegend: een `status()`-aanroep
  per cyclus met timeout. Een mislukte poll wordt stil bij de volgende cyclus herhaald en
  bereikt de gebruiker niet.
- Er is daar dus geen langlevende socket die zombie kan worden — de foutklasse bestaat niet
  in plaats van dat hij beter wordt afgehandeld.

De waarneming "HA heeft dit niet" ondersteunt daarmee juist de modelhypothese, niet de
bibliotheekhypothese.

## Wat we niet gaan doen: tuyapi forken

Een eigen protocolimplementatie lost het gestelde probleem niet op — de zombie-socket
blijft — en brengt permanente eigen verantwoordelijkheid mee:

- Protocolversies 3.1 / 3.3 / 3.4 / 3.5
- AES-ECB én AES-GCM
- Session-key-handshake voor 3.4 en hoger
- Sequence numbers, CRC32, framing

Ter kalibratie: `tinytuya` besteedt hier grofweg 3000 regels aan.

**Wel los op te pakken**: de dependency staat gepind op een git-commit
(`git+ssh://…/tuyapi.git#0f134079…`, versie 7.7.1) in plaats van een npm-release. Dat is een
toeleveringsketen- en onderhoudsvraag die losstaat van het verbindingsmodel, en die sowieso
aandacht verdient.

## Fase A — meten (verplicht, voorafgaand aan elk besluit)

De telemetrie bestaat al: `adlar_daily_disconnect_count`, `adlar_connection_status`,
`adlar_connection_active`. Wat ontbreekt is **attributie** — welke laag greep in.

### A1. Instrumentatie toevoegen

Eén teller per detectielaag, plus de aard van de verbreking:

| Metriek | Waarom |
|---|---|
| `disconnects_layer0` … `disconnects_layer4` | Welke laag detecteert feitelijk? |
| `disconnects_clean` | Socket netjes gesloten (router-reboot, wifi-drop) |
| `disconnects_zombie` | Socket open, geen data — de klasse die polling elimineert |
| `time_to_recovery_ms` | Hoelang staat een device echt stil? |
| `reconnect_attempts_per_incident` | Hoe vaak escaleert het naar Layer 2 wake-up? |

### A2. Beslissende verhouding

> **Welk aandeel van de disconnects is zombie versus clean?**

- **Overwegend zombie** → polling elimineert de hele foutklasse. Fase B is verantwoord.
- **Overwegend clean** (router herstart, wifi weg) → polling helpt nauwelijks; je moet
  daarna hoe dan ook opnieuw verbinden. De 2333 regels zijn dan verzekering en Fase B
  levert weinig op.

### A3. Meetduur

Minimaal 14 dagen over meerdere installaties, zodat wifi-kwaliteit en routergedrag variëren.
Kortere metingen vangen geen weekendpatronen of nachtelijke ISP-resets.

**Fase A is goedkoop en risicoloos**: alleen tellers, geen gedragsverandering.

## Fase B — poll-prototype (alleen bij groen licht uit A2)

Uit te voeren met **tuyapi ongewijzigd**. De bibliotheek ondersteunt beide modi: `_send()`
roept zelf `connect()` aan (regel 479) en kent een `disconnect()`-pad (regel 518). De exacte
semantiek moet in het prototype worden vastgesteld, niet aangenomen.

### Go/no-go-criteria

| # | Criterium | Faalt het, dan |
|---|---|---|
| B1 | **Alle** DPS zijn leesbaar via `get({schema:true})` | Blokkerend. Komt een DPS alleen via `dp-refresh` binnen, dan is polling incompleet. Toets tegen de volledige lijst in `lib/definitions/adlar-mapping.ts` |
| B2 | Het device accepteert de pollcadans zonder verbindingen te weigeren | Blokkerend. Veel Tuya-devices staan één lokale verbinding tegelijk toe en goedkope firmware verdraagt snel connect/disconnect-verkeer slecht |
| B3 | Schrijfpad blijft werken (`set`, incl. `shouldWaitForResponse`) | Blokkerend |
| B4 | Latentie acceptabel — updates komen nu push-gewijs, straks per pollinterval | Afweging, geen blokkade. Poll-groepen kunnen dit grotendeels opvangen |
| B5 | Netwerkbelasting vergelijkbaar of lager | Afweging |

### Ontwerp bij groen licht

Hergebruik de bewezen poll-engine uit de Modbus-driver: `POLL_GROUP_FAST / MEDIUM / SLOW /
ONCE` met instelbare intervallen. Snel wisselende DPS (vermogen, temperaturen) in FAST,
configuratiewaarden in SLOW.

Wat dan kan vervallen: Layer 0 t/m 4, de zombie-recovery-escalatie (ADR-026), en het
grootste deel van de reconnect-logica. Schatting op basis van de termtelling: 800 à 1200
regels.

### Strategische bijvangst

Slaagt Fase B, dan convergeren beide transports naar hetzelfde model. Dat maakt de in
ADR-001 uitgestelde service-convergentie — `AbstractServiceCoordinator`, `TransportAdapter`
— aanzienlijk eenvoudiger, omdat het verschil dan alleen nog in decoderen zit en niet meer
in levenscyclusbeheer.

## Fase C — besluit

Pas na A en B, met de meetresultaten erbij. Mogelijke uitkomsten:

1. **Polling** — persistente socket vervangen, defensieve lagen opruimen
2. **Hybride** — polling als basis, push-events als optionele versnelling wanneer beschikbaar
3. **Ongewijzigd** — de meting toont dat het huidige model afdoende presteert

Uitkomst 3 is een geldige en waarschijnlijk goedkope uitkomst. Deze ADR is niet geschreven
om een herschrijving te rechtvaardigen.

## Risico's

| Risico | Kans | Impact | Beheersing |
|---|---|---|---|
| Device weigert frequente reconnects (B2) | Middel | Hoog | Fase B op één fysiek device vóór elke bredere uitrol |
| DPS uitsluitend via `dp-refresh` (B1) | Middel | Hoog | Volledige DPS-lijst aftoetsen vóór implementatie |
| Regressie voor de 90% Tuya-basis | Laag bij fasering | Hoog | Nooit gelijktijdig met ADR-001; aparte release, aparte changelog |
| Verlies van reactiesnelheid | Hoog | Laag–middel | Poll-groepen; FAST-interval afstemmen op de traagste acceptabele latentie |
| Meting is niet representatief | Middel | Middel | Minimaal 14 dagen, meerdere installaties |

## Openstaande vragen

1. Welk aandeel van de disconnects is zombie versus clean? *(Fase A — beslissend)*
2. Komen alle DPS door via `get({schema:true})`? *(Fase B1 — blokkerend)*
3. Hoe reageert de Adlar-firmware op een connect/disconnect per pollcyclus? *(Fase B2)*
4. Is de tuyapi-pin op een git-SHA een acceptabel toeleveringsrisico? *(los van deze ADR)*

## Verhouding tot ADR-001

Strikt daarna. De merge naar v3.0.0 verandert geen transportgedrag; deze ADR verandert
niets aan de merge. Gelijktijdig uitvoeren maakt een regressie niet toewijsbaar aan één van
beide — en het raakt precies de gebruikersgroep die bij ADR-001 juist ongemoeid moest
blijven.
