# Building model sample-gating: `blocked_dhw_mode` en `blocked_defrost`

**Project:** org.hhi.adlar-heatpump (Tuya local)
**Gerelateerd:** ADR-057 W2b (sample-gating), ADR-060 (geharmoniseerd gedrag — identieke uitleg geldt voor het Modbus-project, met eigen detectiebronnen)
**Code:** `lib/services/building-model-service.ts` → `collectAndLearn()`

Het gebouwmodel (RLS) leert vier thermische parameters — C (thermische massa), UA (warmteverlies), g (zonnewinst), P_int (interne winst) — uit de relatie tussen **toegevoerd thermisch vermogen** en **verandering van de binnentemperatuur**. Die relatie geldt alleen wanneer het thermisch vermogen daadwerkelijk het gebouw in gaat. Twee bedrijfssituaties breken die aanname structureel; daarvoor bestaan de gates `blocked_dhw_mode` en `blocked_defrost`.

---

## 1. `blocked_dhw_mode` — "Not in heating mode"

### Waarom het ertoe doet

Tijdens tapwaterproductie (DHW) gaat het thermisch vermogen van de warmtepomp de **boiler** in, niet het gebouw. Het model ziet dan wél vermogen (`pHeating = P_elektrisch × COP`) maar géén bijpassende binnentemperatuurrespons. RLS interpreteert dat als: "veel energie nodig voor weinig temperatuurstijging" → **structurele overschatting van C** (het gebouw lijkt zwaarder/trager dan het is) en **onderschatting van UA**. Dit is geen ruis maar bias: DHW-cycli komen dagelijks voor en vertekenen altijd in dezelfde richting, dus middelen ze niet uit. Hetzelfde geldt voor koelmodi: daar is het teken van het thermisch effect omgekeerd.

### Hoe het wordt herkend

De **geconfigureerde bedrijfsmodus** via capability `adlar_enum_mode` (DPS 2). Sample wordt geblokkeerd bij modus ∈ `{hot_water, cold, cold_and_hotwater}` — modi waarin het vermogen per definitie niet (of negatief) het gebouw verwarmt.

**Bekende beperking:** in combimodi (`heating_and_hot_water` e.d.) is DPS 2 de *geconfigureerde* modus, niet de *actuele* operatie. Een DHW-cyclus bínnen een combimodus is niet detecteerbaar en wordt geaccepteerd als modelruis (kortdurend, deels uitmiddelend — wezenlijk anders dan een permanent verkeerd geconfigureerde pure DHW-modus).

### Hoe erop wordt gestuurd

De check zit in `collectAndLearn()` **vóór** `learner.addMeasurement()`:

1. Sample wordt volledig overgeslagen — geen RLS-update.
2. `lastBlockingReason` + `lastBlockingReasonKey = 'building_model.blocked_dhw_mode'` worden gezet → zichtbaar als **BLOCKED** in de Tau-capability-titel en met reden in Building Insights / het diagnostics-capability (bestaand v2.8.1 guard-rail-mechanisme).
3. Volledig zelfherstellend: zodra de modus weer een verwarmingsmodus is, loopt het leren door zonder reset.

### Impact

- **Mét gate:** lagere sample-rate in DHW-/koelperiodes → tragere convergentie. Bewuste afweging (ADR-057 §4): RLS met forgetting factor 0.999 heeft een effectief geheugen van ~1000 samples; ontbrekende samples zijn onschuldig, systematisch vertekende samples domineren op termijn de schatting.
- **Zónder gate:** structureel te hoge C / te lage UA → te lange tijdconstante τ → alle afgeleide adviezen kantelen mee: preheat start te vroeg, overshoot-preventie remt te vroeg af, de thermische component in de weighted decision maker adviseert verkeerd. De individuele meetwaarden zijn plausibel, dus geen enkele bestaande bounds-check vangt dit af.

---

## 2. `blocked_defrost` — "Defrost active"

### Waarom het ertoe doet

Tijdens ontdooien keert de warmtepomp de koudemiddelcyclus om en **onttrekt warmte aan het afgiftesysteem** om de verdamper ijsvrij te maken. Het elektrisch verbruik is hoog, maar het thermisch effect op het gebouw is *negatief* — exact het omgekeerde van de modelaanname (`pHeating > 0`). Eén defrost-sample is daarmee "geïnverteerd": het duwt de parameters de verkeerde kant op. Extra schadelijk: defrost treedt juist op bij koud, vochtig weer — precies de condities waarin het warmteverlies (UA) het best meetbaar is. De vervuiling landt dus op het meest informatieve leermoment. En omdat een geïnverteerd sample een grote predictiefout geeft, verhoogt het VFF-λ-mechanisme ("grote fout → sneller leren") het gewicht van precies dit foute sample — dubbel schadelijk.

### Hoe het wordt herkend

Capability `adlar_state_defrost_state` (DPS 33, boolean). Bij `true` wordt het sample geblokkeerd.

### Hoe erop wordt gestuurd

Zelfde mechanisme als de modus-gate: skip vóór `addMeasurement()`, blocking reason `building_model.blocked_defrost`, zichtbaar in de guard-rail-UI, zelfherstellend zodra defrost eindigt.

### Impact

- **Mét gate:** een defrost-cyclus duurt typisch 5–15 minuten → hooguit 1–3 gemiste samples per cyclus. Verwaarloosbaar verlies. Het eerste sample ná een korte blokkade bevat de temperatuurdip van de defrost deels in dT/dt — geaccepteerd als ruis; bij langere blokkades grijpt de dt-gap-guard (> 15 min → baseline-verversing, ADR-057 W2a) in.
- **Zónder gate:** elke defrost injecteert een tegengesteld sample dat alle validatielagen passeert en door VFF-λ extra gewicht krijgt. Bij vriesweer (meerdere defrosts per dag) stapelt dit tot merkbare parameterdrift, gemaskeerd door de bounds-revert-laag — zichtbaar als parameters die "plakken" tegen hun fysieke grenzen (zie excitatie-tellers, ADR-057 W3).

---

## Samenvattend

| | `blocked_dhw_mode` | `blocked_defrost` |
|---|---|---|
| Fout zonder gate | Vermogen zonder gebouwrespons → C te hoog, UA te laag (bias) | Geïnverteerd sample → parameters verkeerde kant op |
| Detectie (dit project) | `adlar_enum_mode` (DPS 2) ∈ {hot_water, cold, cold_and_hotwater} | `adlar_state_defrost_state` (DPS 33) = true |
| Frequentie | Dagelijks (DHW-cycli), structureel | Bij koud/vochtig weer, episodisch |
| Sturing | Sample-skip + blocking reason, zelfherstellend | idem |
| Restrisico | DHW binnen combimodus niet detecteerbaar (ruis) | Dip in eerste post-defrost-sample (ruis); lange blokkade → dt-gap-guard |
