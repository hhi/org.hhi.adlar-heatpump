# Building model sample-gating: `blocked_dhw_mode`, `blocked_dhw_active` en `blocked_defrost`

**Project:** org.hhi.adlar-heatpump, driver `intelligent-heatpump-aurora3` (overgenomen uit org.hhi.adlar3-heatpump-modbus v1.9.4; ADR-004)
**Status:** geïmplementeerd (2026-06-09, ADR-060 §5 actiepunt 3); gedrag vastgelegd in ADR-060 (gedeelde gedragsspecificatie, `plans/decisions/`).
**Gerelateerd:** ADR-056 (building model hardening), referentieproject-ADR-057 W2b
**Code:** `lib/aurora3/services/building-model-service.ts` → `collectAndLearn()`
**Varianten per driver:** [Tuya](<../Architectural overview/building-model-sample-gating.md>) · [Aurora II](building-model-sample-gating.md) · Aurora III (dit document)

Het gebouwmodel (RLS) leert vier thermische parameters — C (thermische massa), UA (warmteverlies), g (zonnewinst), P_int (interne winst) — uit de relatie tussen **toegevoerd thermisch vermogen** en **verandering van de binnentemperatuur**. Die relatie geldt alleen wanneer het thermisch vermogen daadwerkelijk het gebouw in gaat. Drie bedrijfssituaties breken die aanname structureel; daarvoor bestaan de gates `blocked_dhw_mode`, `blocked_dhw_active` (sinds v1.9.0) en `blocked_defrost`.

Volgorde in `collectAndLearn()`: modus-gate → tapwater-gate → defrost-gate.

---

## 1. `blocked_dhw_mode` — "Not in heating mode"

### Waarom het ertoe doet

Tijdens koelen of uitgeschakelde HVAC-modus gaat het thermisch vermogen niet als gebouwverwarming de woning in. Het model ziet dan mogelijk wél vermogen (`pHeating = P_elektrisch × COP`) maar geen bijpassende verwarmingsrespons. RLS interpreteert dat als: "veel energie nodig voor weinig temperatuurstijging" → **structurele overschatting van C** (het gebouw lijkt zwaarder/trager dan het is) en **onderschatting van UA**. Dit is geen ruis maar bias. Voor Aurora III blijft de bestaande blocking key `blocked_dhw_mode` hergebruikt voor "niet in verwarmingsmodus".

### Hoe het wordt herkend (Modbus)

De **geconfigureerde bedrijfsmodus** uit holding register **4-2100 "Air Conditioning Modes"** (`CONTROL_REGISTERS.hvacMode` in `adlar3-modbus-registers.ts`), via snapshot `control.mode` → capability `adlar_mode_aurora3` (string van het modusnummer):

| Waarde 4-2100 | Modus | Gate |
|---|---|---|
| 0 | Off | ⛔ blokkeren |
| 1 | Cool | ⛔ blokkeren |
| 2 | Heat | ✅ leren |
| 4 | Auto | ✅ leren (zie beperking) |

**Bekende beperking:** 4-2100 is de *geconfigureerde* modus, niet noodzakelijk de actuele verwarmings-/koeloperatie binnen Auto. Auto wordt geaccepteerd omdat Aurora III hier geen betrouwbare actuele heating/cooling gate aanbiedt in deze service. Een mogelijke latere verfijning is actuele operatie afleiden uit `currentTargetOpMode`/`actualOpMode` (3-102/3-103), maar die enumwaarden zijn nog niet gevalideerd.

### Hoe erop wordt gestuurd

De check zit in `collectAndLearn()` **vóór** `learner.addMeasurement()`:

1. Sample wordt volledig overgeslagen — geen RLS-update.
2. `lastBlockingReason` + `lastBlockingReasonKey = 'building_model.blocked_dhw_mode'` worden gezet → zichtbaar als **BLOCKED** in de Tau-capability-titel en met reden in de diagnostics (bestaand v2.8.1 guard-rail-mechanisme; localeteksten identiek aan het referentieproject, conform ADR-060).
3. Volledig zelfherstellend: zodra de modus weer een verwarmingsmodus is, loopt het leren door zonder reset.

### Impact

- **Mét gate:** lagere sample-rate in uit-/koelperiodes → tragere convergentie. Bewuste afweging: RLS met forgetting factor 0.999 heeft een effectief geheugen van ~1000 samples; ontbrekende samples zijn onschuldig, systematisch vertekende samples domineren op termijn de schatting.
- **Zónder gate:** structureel te hoge C / te lage UA → te lange tijdconstante τ → alle afgeleide adviezen kantelen mee: preheat start te vroeg, overshoot-preventie remt te vroeg af, de thermische component in de weighted decision maker adviseert verkeerd. De individuele meetwaarden zijn plausibel, dus geen enkele bestaande bounds-check vangt dit af.

---

## 2. `blocked_dhw_active` — "Hot water heating"

### Waarom het ertoe doet

Tijdens tapwaterverwarming stuurt de driewegklep het aanvoerwater naar de boiler. Het elektrisch vermogen en de berekende COP blijven plausibel, maar de warmte gaat in het tapwatervat en niet in het gebouw. Het model ziet dan vermogen zonder bijpassende stijging van de binnentemperatuur — dezelfde bias als bij de modus-gate (C te hoog, UA te laag). De modus-gate vangt dit niet af: `4-2100` blijft tijdens een tapwaterrun gewoon op Heat of Auto staan.

### Hoe het wordt herkend (Modbus)

**Input register 3-9, bit 2** ("effective mode": DHW actief) → snapshot `status.dhwActive` → capability `adlar_dhw_active` (boolean). Dit is een actuele statusbit, gelezen in de medium-pollgroep (standaard elke 30 s).

### Hoe erop wordt gestuurd

Zelfde mechanisme als de andere gates: skip vóór `addMeasurement()`, blocking reason `building_model.blocked_dhw_active` ("Hot water heating" / "Tapwater verwarmen"), zelfherstellend zodra de tapwaterrun eindigt.

### Impact

- **Mét gate:** een tapwaterrun duurt typisch 20–60 minuten, een paar keer per dag → enkele gemiste samples per run. Na de run kan de eerste meting nog een naijleffect bevatten; bij een blokkade > 15 min grijpt de dt-gap-guard in.
- **Zónder gate:** elke tapwaterrun voegt samples toe met vermogen maar zonder gebouwrespons, juist in de ochtend- en avondpieken.

---

## 3. `blocked_defrost` — "Defrost active"

### Waarom het ertoe doet

Tijdens ontdooien keert de warmtepomp de koudemiddelcyclus om en **onttrekt warmte aan het afgiftesysteem** om de verdamper ijsvrij te maken. Het elektrisch verbruik is hoog, maar het thermisch effect op het gebouw is *negatief* — exact het omgekeerde van de modelaanname (`pHeating > 0`). Eén defrost-sample is daarmee "geïnverteerd": het duwt de parameters de verkeerde kant op. Extra schadelijk: defrost treedt juist op bij koud, vochtig weer — precies de condities waarin het warmteverlies (UA) het best meetbaar is. De vervuiling landt dus op het meest informatieve leermoment. En omdat een geïnverteerd sample een grote predictiefout geeft, verhoogt het VFF-λ-mechanisme ("grote fout → sneller leren") het gewicht van precies dit foute sample — dubbel schadelijk.

### Hoe het wordt herkend (Modbus)

**Input register 3-38, bit 1** → snapshot `status.defrosting` → capability `adlar_state_defrost_state` (boolean; ook gespiegeld in `adlar_defrosting`). Bij `true` wordt het sample geblokkeerd. Dit is een *actuele* statusbit (anders dan de modus-gate), dus defrost wordt exact gedurende de cyclus gedetecteerd.

### Hoe erop wordt gestuurd

Zelfde mechanisme als de modus-gate: skip vóór `addMeasurement()`, blocking reason `building_model.blocked_defrost`, zichtbaar in de guard-rail-UI, zelfherstellend zodra defrost eindigt.

### Impact

- **Mét gate:** een defrost-cyclus duurt typisch 5–15 minuten → hooguit 1–3 gemiste samples per cyclus. Verwaarloosbaar verlies. Het eerste sample ná een korte blokkade bevat de temperatuurdip van de defrost deels in dT/dt — geaccepteerd als ruis; bij langere blokkades grijpt de bestaande dt-gap-guard (> 15 min → baseline-verversing, ADR-056 tranche 1) in.
- **Zónder gate:** elke defrost injecteert een tegengesteld sample dat alle validatielagen passeert en door VFF-λ extra gewicht krijgt. Bij vriesweer (meerdere defrosts per dag) stapelt dit tot merkbare parameterdrift, gemaskeerd door de bounds-revert-laag — zichtbaar als parameters die "plakken" tegen hun fysieke grenzen.

---

## Samenvattend

| | `blocked_dhw_mode` | `blocked_dhw_active` | `blocked_defrost` |
|---|---|---|---|
| Fout zonder gate | Vermogen zonder gebouwrespons → C te hoog, UA te laag (bias) | Vermogen gaat naar de boiler → zelfde bias | Geïnverteerd sample → parameters verkeerde kant op |
| Detectie (dit project) | Register 4-2100 via `adlar_mode_aurora3` ∈ {0, 1} | Register 3-9 bit 2 via `adlar_dhw_active` | Register 3-38 bit 1 via `adlar_state_defrost_state` |
| Frequentie | Tijdens uit-/koelmodus, structureel zolang actief | Enkele tapwaterruns per dag | Bij koud/vochtig weer, episodisch |
| Sturing | Sample-skip + blocking reason, zelfherstellend | idem | idem |
| Restrisico | Auto kan actuele koeling bevatten zolang 3-102/3-103 niet gevalideerd zijn | Naijleffect in eerste sample na de run; 3-9 wordt elke 30 s gelezen | Dip in eerste post-defrost-sample (ruis); lange blokkade → dt-gap-guard |
