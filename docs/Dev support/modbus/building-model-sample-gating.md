# Building model sample-gating: `blocked_dhw_mode` en `blocked_defrost`

**Project:** org.hhi.adlar-heatpump-modbus
**Status:** geïmplementeerd (2026-06-09, ADR-060 §5 actiepunt 3); gedrag vastgelegd in ADR-060 (gedeelde gedragsspecificatie, `plans/decisions/`).
**Gerelateerd:** ADR-056 (building model hardening), referentieproject-ADR-057 W2b
**Code:** `lib/services/building-model-service.ts` → `collectAndLearn()`

Het gebouwmodel (RLS) leert vier thermische parameters — C (thermische massa), UA (warmteverlies), g (zonnewinst), P_int (interne winst) — uit de relatie tussen **toegevoerd thermisch vermogen** en **verandering van de binnentemperatuur**. Die relatie geldt alleen wanneer het thermisch vermogen daadwerkelijk het gebouw in gaat. Twee bedrijfssituaties breken die aanname structureel; daarvoor bestaan de gates `blocked_dhw_mode` en `blocked_defrost`.

---

## 1. `blocked_dhw_mode` — "Not in heating mode"

### Waarom het ertoe doet

Tijdens tapwaterproductie (DHW) gaat het thermisch vermogen van de warmtepomp de **boiler** in, niet het gebouw. Het model ziet dan wél vermogen (`pHeating = P_elektrisch × COP`) maar géén bijpassende binnentemperatuurrespons. RLS interpreteert dat als: "veel energie nodig voor weinig temperatuurstijging" → **structurele overschatting van C** (het gebouw lijkt zwaarder/trager dan het is) en **onderschatting van UA**. Dit is geen ruis maar bias: DHW-cycli komen dagelijks voor en vertekenen altijd in dezelfde richting, dus middelen ze niet uit. Hetzelfde geldt voor koelmodi: daar is het teken van het thermisch effect omgekeerd.

### Hoe het wordt herkend (Modbus)

De **geconfigureerde bedrijfsmodus** uit holding register **0x0304 "Set Mode"** (`CONTROL_REGISTERS.mode` in `adlar-modbus-registers.ts`), via snapshot `control.mode` → capability `adlar_mode` (string van het modusnummer):

| Waarde 0x0304 | Modus | Gate |
|---|---|---|
| 0 | Cooling | ⛔ blokkeren |
| 1 | Heating | ✅ leren |
| 2 | Hot Water | ⛔ blokkeren |
| 3 | Floor Heating | ✅ leren |
| 4 | Hot Water + Cooling | ⛔ blokkeren |
| 5 | Hot Water + Heating | ✅ leren (combimodus, zie beperking) |
| 7 | Hot Water + Floor Heating | ✅ leren (combimodus, zie beperking) |

**Bekende beperking:** 0x0304 is de *geconfigureerde* modus, niet de *actuele* operatie. Een DHW-cyclus bínnen een combimodus (5/7) is via dit register niet detecteerbaar en wordt geaccepteerd als modelruis (kortdurend, deels uitmiddelend — wezenlijk anders dan een permanent verkeerd geconfigureerde pure DHW-modus). Een mogelijke latere verfijning is actuele DHW-operatie afleiden uit de driewegklep-/statusregisters, maar dat valt buiten de geharmoniseerde gedragsspecificatie.

### Hoe erop wordt gestuurd

De check zit in `collectAndLearn()` **vóór** `learner.addMeasurement()`:

1. Sample wordt volledig overgeslagen — geen RLS-update.
2. `lastBlockingReason` + `lastBlockingReasonKey = 'building_model.blocked_dhw_mode'` worden gezet → zichtbaar als **BLOCKED** in de Tau-capability-titel en met reden in de diagnostics (bestaand v2.8.1 guard-rail-mechanisme; localeteksten identiek aan het referentieproject, conform ADR-060).
3. Volledig zelfherstellend: zodra de modus weer een verwarmingsmodus is, loopt het leren door zonder reset.

### Impact

- **Mét gate:** lagere sample-rate in DHW-/koelperiodes → tragere convergentie. Bewuste afweging: RLS met forgetting factor 0.999 heeft een effectief geheugen van ~1000 samples; ontbrekende samples zijn onschuldig, systematisch vertekende samples domineren op termijn de schatting.
- **Zónder gate:** structureel te hoge C / te lage UA → te lange tijdconstante τ → alle afgeleide adviezen kantelen mee: preheat start te vroeg, overshoot-preventie remt te vroeg af, de thermische component in de weighted decision maker adviseert verkeerd. De individuele meetwaarden zijn plausibel, dus geen enkele bestaande bounds-check vangt dit af.

---

## 2. `blocked_defrost` — "Defrost active"

### Waarom het ertoe doet

Tijdens ontdooien keert de warmtepomp de koudemiddelcyclus om en **onttrekt warmte aan het afgiftesysteem** om de verdamper ijsvrij te maken. Het elektrisch verbruik is hoog, maar het thermisch effect op het gebouw is *negatief* — exact het omgekeerde van de modelaanname (`pHeating > 0`). Eén defrost-sample is daarmee "geïnverteerd": het duwt de parameters de verkeerde kant op. Extra schadelijk: defrost treedt juist op bij koud, vochtig weer — precies de condities waarin het warmteverlies (UA) het best meetbaar is. De vervuiling landt dus op het meest informatieve leermoment. En omdat een geïnverteerd sample een grote predictiefout geeft, verhoogt het VFF-λ-mechanisme ("grote fout → sneller leren") het gewicht van precies dit foute sample — dubbel schadelijk.

### Hoe het wordt herkend (Modbus)

**Running Status 1-register 0x0000, bit 8** (`STATUS_1_BITS.SYSTEM_DEFROST = 0x0100`) → snapshot `status.defrosting` → capability `adlar_state_defrost_state` (boolean; ook gespiegeld in `adlar_defrosting`). Bij `true` wordt het sample geblokkeerd. Dit is een *actuele* statusbit (anders dan de modus-gate), dus defrost wordt exact gedurende de cyclus gedetecteerd.

### Hoe erop wordt gestuurd

Zelfde mechanisme als de modus-gate: skip vóór `addMeasurement()`, blocking reason `building_model.blocked_defrost`, zichtbaar in de guard-rail-UI, zelfherstellend zodra defrost eindigt.

### Impact

- **Mét gate:** een defrost-cyclus duurt typisch 5–15 minuten → hooguit 1–3 gemiste samples per cyclus. Verwaarloosbaar verlies. Het eerste sample ná een korte blokkade bevat de temperatuurdip van de defrost deels in dT/dt — geaccepteerd als ruis; bij langere blokkades grijpt de bestaande dt-gap-guard (> 15 min → baseline-verversing, ADR-056 tranche 1) in.
- **Zónder gate:** elke defrost injecteert een tegengesteld sample dat alle validatielagen passeert en door VFF-λ extra gewicht krijgt. Bij vriesweer (meerdere defrosts per dag) stapelt dit tot merkbare parameterdrift, gemaskeerd door de bounds-revert-laag — zichtbaar als parameters die "plakken" tegen hun fysieke grenzen.

---

## Samenvattend

| | `blocked_dhw_mode` | `blocked_defrost` |
|---|---|---|
| Fout zonder gate | Vermogen zonder gebouwrespons → C te hoog, UA te laag (bias) | Geïnverteerd sample → parameters verkeerde kant op |
| Detectie (dit project) | Register 0x0304 (Set Mode) via `adlar_mode` ∈ {0, 2, 4} | Register 0x0000 bit 8 (SYSTEM_DEFROST) via `adlar_state_defrost_state` |
| Frequentie | Dagelijks (DHW-cycli), structureel | Bij koud/vochtig weer, episodisch |
| Sturing | Sample-skip + blocking reason, zelfherstellend | idem |
| Restrisico | DHW binnen combimodus (5/7) niet detecteerbaar (ruis) | Dip in eerste post-defrost-sample (ruis); lange blokkade → dt-gap-guard |
