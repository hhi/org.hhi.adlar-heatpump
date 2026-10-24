# Gebouwinzichten & Aanbevelingen Gids

**Versie**: 3.4.0+ | **Laatst bijgewerkt**: Oktober 2026

---

## Inhoudsopgave

1. [Introductie](#introductie)
2. [Wat zijn Gebouwinzichten?](#wat-zijn-gebouwinzichten)
3. [Hoe het werkt](#hoe-het-werkt)
4. [Zonnestraling Bronnen](#zonnestraling-bronnen)
5. [Inzicht Categorieën](#inzicht-categorieën)
6. [Inzichten begrijpen](#inzichten-begrijpen)
7. [Actie ondernemen](#actie-ondernemen)
8. [Voorbeeldflows](#voorbeeldflows)
9. [Instellingen](#instellingen)
10. [Probleemoplossing](#probleemoplossing)
11. [FAQ](#faq)

---

## Introductie

De **Gebouwinzichten & Aanbevelingen** functie transformeert je warmtepomp van een simpele temperatuurregelaar naar een intelligente energieadviseur. Na ongeveer 1–2 dagen leren van de thermische eigenschappen van je gebouw, geeft het systeem **concrete, bruikbare aanbevelingen** met geschatte besparingen in euro's per maand.

### Belangrijkste Voordelen

| Voordeel | Besparing |
|----------|-----------|
| 💰 Isolatie-inzichten | 10-30% |
| ⏱️ Voorverwarmen optimalisatie | 5-10% |
| 🏠 Thermische opslag strategieën | 10-25% (met dynamische prijzen) |
| 📊 ROI transparantie | Elke aanbeveling incl. maandelijkse besparing |

---

## Wat zijn Gebouwinzichten?

Gebouwinzichten analyseren de parameters van het Gebouwmodel: 4 geleerde parameters (C, UA, g, P_int), de tijdsconstante τ = C/UA, en de windcorrectie, die apart wordt geleerd:

| Parameter | Symbool | Betekenis | Typisch Bereik |
|-----------|---------|-----------|----------------|
| **Thermische Massa** | C | Warmtecapaciteit - hoeveel energie nodig voor 1°C | 7-30 kWh/°C |
| **Warmteverlies Coëfficiënt** | UA | Snelheid van warmteverlies per graad verschil | 0.05-0.5 kW/°C |
| **Tijdsconstante** | τ (tau) | Hoe snel gebouw opwarmt/afkoelt (τ = C/UA) | 20-600 uur (profielwaarden) |
| **Zonnewinst Factor** | g | Effectiviteit van zonnestraling opwarming | 0.3-0.6 |
| **Interne Warmtewinst** | P_int | Warmte van mensen, apparaten, koken | 0.2-0.5 kW |
| **Windcorrectie** | W_corr | Extra warmteverlies bij harde wind (v2.7.0+) | 0-50 W/°C |

Het systeem vergelijkt geleerde waarden met:
- **Je geselecteerde gebouwprofiel** (Licht/Gemiddeld/Zwaar/Passief)
- **Typische waarden voor goed geïsoleerde gebouwen**
- **Je energieprijsdata** (indien beschikbaar)

Bij optimalisatiekansen genereert het **inzichten** met specifieke aanbevelingen.

---

## Hoe het werkt

### Leerfase (1–2 dagen)

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Data Verzameling│───▶│ Parameter Leren │───▶│ Confidence groeit│
│   elke 5 min    │    │  RLS algoritme  │    │    0% → 100%    │
└─────────────────┘    └─────────────────┘    └────────┬────────┘
                                                       │
         ┌─────────────────────────────────────────────┘
         ▼
   ┌───────────┐
   │  ≥70%?    │
   └─────┬─────┘
         │
    ┌────┴────┐
    │         │
   Ja        Nee ──────────────────────────────┐
    │                                          │
    ▼                                          │
┌─────────────────┐                            │
│    Inzichten    │                            │
│   beschikbaar   │          ┌─────────────────┘
└─────────────────┘          │
                             ▼
                   (Terug naar Data Verzameling)
```

**Data die verzameld wordt:**
- Binnentemperatuur (externe sensor)
- Buitentemperatuur (warmtepomp of externe sensor)
- Elektrisch vermogen
- Geschatte zonnestraling

**Inzichten generatie:**
- Systeem evalueert elke 50 minuten (10 samples)
- Detecteert patronen: slechte isolatie, thermische opslag potentieel, voorverwarmen kansen
- Genereert aanbevelingen met ROI schattingen

### Continue Monitoring

- **Past aan bij seizoenen** (zonnewinst multipliers, interne warmte patronen)
- **Update inzichten** bij parameter drift >10%
- **Rate limited** om "advies-moeheid" te voorkomen (max 1 inzicht per categorie per dag)

---

## Zonnestraling Bronnen

Het gebouwmodel gebruikt zonnestraling om warmtewinst door ramen te berekenen. Vanaf versie 2.7.0 ondersteunt het systeem **drie databronnen** met automatische prioriteit.

### De Zonnewinst Factor (g)

De **g-factor** (0.3-0.6) bepaalt hoeveel van de invallende zonnestraling je gebouw effectief opwarmt:

| g-waarde | Betekenis | Typisch gebouw |
|----------|-----------|----------------|
| **0.3** | Weinig zonnewinst | Kleine ramen, noord-oriëntatie |
| **0.45** | Gemiddelde zonnewinst | Standaard woning |
| **0.6** | Hoge zonnewinst | Grote ramen op zuid |

**Formule:** `Zonnewinst (kW) = g × Zonnestraling (W/m²) / 1000 × Effectief raamoppervlak`

### Zonnestraling Prioriteit Cascade (v2.7.0)

Het systeem kiest automatisch de beste beschikbare bron:

```
┌─────────────────────────────────────────────────────────────┐
│  PRIORITEIT 1: Zonnepanelen                                 │
│  - Meest accurate real-time data                           │
│  - Omgerekend naar straling via: P_panel / Wp × 1000 W/m²  │
│  - Vereist: flow card "Ontvang externe zonnestroom"        │
└─────────────────────────────────────────────────────────────┘
                         ↓ (niet beschikbaar)
┌─────────────────────────────────────────────────────────────┐
│  PRIORITEIT 2: KNMI Stralingsdata                          │
│  - Werkelijke gemeten straling van weerstation             │
│  - Vereist: flow card "Ontvang externe zonnestraling"      │
│  - Bron: bijv. KNMI app of weerstation integratie          │
└─────────────────────────────────────────────────────────────┘
                         ↓ (niet beschikbaar)
┌─────────────────────────────────────────────────────────────┐
│  PRIORITEIT 3: Sinusoïdale Schatting (fallback)            │
│  - Berekend op basis van tijd en datum                     │
│  - Gebruikt formule: max(0, sin(π × (uur-6)/12)) × piek    │
│  - Seizoensafhankelijke piekwaarden (winter 200, zomer 800)│
└─────────────────────────────────────────────────────────────┘
```

### Seizoenscorrectie (g-multiplier)

De instelling **"Seizoensgebonden zonnewinst (g)"** past de effectiviteit van zonnestraling aan per seizoen:

| Maand | Multiplier | Reden |
|-------|------------|-------|
| Dec-Feb | 60% | Lage winterzon, veel bewolking |
| Mrt, Nov | 80% | Overgangsperioden |
| Apr, Okt | 100% | Referentie baseline |
| Mei, Sep | 120% | Hogere zon, betere invalshoek |
| Jun-Aug | 130% | Maximale zomer instraling |

> [!IMPORTANT]
> **Automatische detectie (v2.7.0):** De seizoenscorrectie wordt **alleen** toegepast bij geschatte straling (sinusoïdale fallback). Bij gebruik van zonnepanelen of KNMI data wordt de correctie automatisch uitgeschakeld, omdat deze bronnen al het werkelijke seizoens- en weereffect bevatten.

### Welke bron gebruik ik?

| Bron | Voordelen | Nadelen | Setup |
|------|-----------|---------|-------|
| **Zonnepanelen** | Meest accuraat, real-time | Vereist zonnepaneel-integratie | Flow: solar panel → ADLAR |
| **KNMI** | Gemeten data, geen panelen nodig | Kan 10-60 min vertraagd zijn | Flow: weer-app → ADLAR |
| **Schatting** | Geen setup nodig, altijd beschikbaar | Minder nauwkeurig bij bewolking | Automatisch actief |

**Aanbeveling:** Als je zonnepanelen hebt, stuur hun vermogen door. Anders is de sinusoïdale schatting met seizoenscorrectie voldoende nauwkeurig voor de meeste situaties.

---

## Inzicht Categorieën

Het systeem biedt **4 categorie-specifieke sensors** (v2.5.10+):

### 1. 🏠 Isolatie Prestatie Inzichten

**Wat het detecteert:**
- Hoog warmteverlies (UA > verwacht)
- Uitstekende isolatie (UA < verwacht)

**Voorbeeld Inzicht:**
> "🏠 Hoog warmteverlies - UA 0.52 kW/°C (verwacht: 0.30)"

**Voorbeeld Aanbeveling:**
> "Overweeg isolatie upgrades: dak (25% besparing), muren (15%), ramen (10%). Geschatte besparing: €120/maand"

**Wanneer het triggert:**
- Confidence ≥ 70%
- UA > 1.5× profiel UA **OF** UA > 0.5 kW/°C (absolute drempel)

**Wat te doen:**
1. **Verificeer de meting** - Check of deuren/ramen open stonden tijdens leren
2. **Prioriteer upgrades** - Dakisolatie geeft hoogste ROI (25% van totale besparing)
3. **Vraag offertes** - Gebruik €120/maand schatting om terugverdientijd te berekenen
4. **Implementeer nachtverlaging** - Reduceer warmteverlies tijdens onbewoonde uren

---

### 2. ⏱️ Voorverwarmen Strategie Inzichten

**Wat het detecteert:** zes responsklassen, op basis van τ:

| Respons | τ | Voorbeeld inzicht |
|---|---|---|
| Zeer snel | <5u | Zeer snel (~2 uur voor 2°C) |
| Snel | 5–10u | Snel (~4 uur voor 2°C) |
| Normaal | 10–20u | Normaal (~8 uur voor 2°C) |
| Langzaam | 20–40u | Langzaam (~16 uur voor 2°C) |
| Zeer langzaam | 40–80u | Zeer langzaam (~24 uur voor 2°C) |
| Extreem langzaam | ≥80u | Extreem langzaam (~32 uur voor 2°C) |

Bij een τ boven 250 uur (bijv. een passiefhuis) verschijnt geen voorverwarmingsinzicht.

---

### 3. 💰 Thermische Opslag Optimalisatie Inzichten

**Wat het detecteert:**
- Hoge thermische massa gebouwen (C > 18 kWh/°C) met trage respons (τ > 12u)
- Mogelijkheid om energie op te slaan tijdens goedkope uren, coasten tijdens dure uren

**Voorbeeld Inzicht (met dynamische prijzen):**
> "💰 Thermische opslag potentieel - C=24 kWh/°C, τ=18u"

**Voorbeeld Aanbeveling:**
> "Voorverwarmen +2°C tijdens goedkope uren (02:00-06:00), coasten -1°C tijdens piek (17:00-21:00). Geschatte besparing: €95/maand"

**Voorbeeld Inzicht (zonder dynamische prijzen):**
> "💡 Gebouw geschikt voor thermische opslag - C=24 kWh/°C, τ=18u"

**Voorbeeld Aanbeveling:**
> "Voeg dynamische energieprijzen toe via flow kaart 'Ontvang externe energieprijzen' om kostenoptimalisatie in te schakelen. Potentiële besparing: 15-25%"

**Thermische Opslag Berekening:**
```
Opgeslagen energie = C × Temp verschuiving = 24 kWh/°C × 2°C = 48 kWh
Dagelijkse besparing = Opgeslagen energie × Prijsverschil × Benuttingsfactor
                     = 48 kWh × €0.15/kWh × 0.70 = €5.04/dag
Maandelijkse besparing = €5.04 × 30 = €151/maand
```

---

### 4. 🔄 Gebouwprofiel Mismatch (Diagnostisch)

**Wat het detecteert:**
- Geselecteerd gebouwprofiel komt niet overeen met geleerd gedrag
- >30% afwijking in tijdsconstante (τ)

**Voorbeeld Inzicht:**
> "🔄 Gebouw gedraagt zich als 'zwaar' (τ=80u vs 'gemiddeld' τ=50u)"

**Voorbeeld Aanbeveling:**
> "Wijzig gebouwprofiel naar 'zwaar' in apparaatinstellingen voor sneller leren en betere initiële parameters"

**Profiel Kenmerken:**

| Profiel | C (kWh/°C) | UA (kW/°C) | τ (uur) | Gebouwtype |
|---------|-----------|-----------|---------|------------|
| **Licht** | 7 | 0.35 | 20 | Houtskelet, basis isolatie, snelle temp wisselingen |
| **Gemiddeld** | 15 | 0.30 | 50 | Baksteen, spouwmuur, dubbel glas (typisch NL) |
| **Zwaar** | 20 | 0.25 | 80 | Beton/steen, goede isolatie, HR++ glas |
| **Passief** | 30 | 0.05 | 600 | Passiefhuis, HR+++, luchtdicht, warmte terugwin ventilatie |

---

## Inzichten begrijpen

### Waar te vinden

**Apparaat Capabilities (v2.5.10+)** - Elke categorie heeft een eigen sensor:
1. **Isolatie Inzicht** (`building_insight_insulation`) — Warmteverlies analyse
2. **Voorverwarming Inzicht** (`building_insight_preheating`) — Thermische respons advies
3. **Thermische Opslag Inzicht** (`building_insight_thermal_storage`) — Load-shifting potentieel
4. **Gebouwprofiel Inzicht** (`building_insight_profile`) — Profiel mismatch detectie
5. **Gebouwinzichten Diagnostiek (JSON)** — Gedetailleerde technische data

**Flow Trigger Kaarten:**
1. **"Nieuw gebouwinzicht gedetecteerd"** — Triggert bij nieuwe inzichten
2. **"Voorverwarmen tijd aanbeveling"** — Triggert wanneer ΔT > 1.5°C (max 1x per 4 uur)
3. **"Gebouwprofiel mismatch gedetecteerd"** — Eenmalige trigger

### Inzicht Levenscyclus

| Status | Icoon | Beschrijving |
|--------|-------|--------------|
| Nieuw | 🆕 | Net gedetecteerd, notificatie verzonden |
| Actief | ✅ | Weergegeven in capabilities |
| Bevestigd | 👀 | Gebruiker heeft gezien |
| Afgewezen | 🚫 | Verborgen voor 30 dagen |
| Opgelost | ✔️ | Actie geïmplementeerd |

### Prioriteit Systeem

Inzichten worden gerangschikt 0-100 op basis van:
- **Confidence** (30%) — Model zekerheid
- **Energiebesparing potentieel** (40%) — €/maand schatting
- **Actie eenvoud** (20%) — Hoe makkelijk te implementeren
- **Directe impact** (10%) — Snel vs. lange termijn voordeel

**Weergave regel:** Elke categorie heeft zijn eigen sensor - alle inzichten worden parallel getoond (v2.5.10)

---

## Actie ondernemen

### Stap-voor-stap Actie Gids

#### Voor Isolatie Inzichten:

| Termijn | Acties |
|---------|--------|
| **Direct** (0-1 week) | ✅ Nachtverlaging inschakelen<br/>✅ Luchtlekken checken en afdichten |
| **Korte termijn** (1-3 maanden) | ✅ Offertes voor dakisolatie (€3000-6000, terugverdientijd 2-4 jaar)<br/>✅ Spouwmuurisolatie overwegen (€1500-3000)<br/>✅ Ramen evalueren voor HR++ glas |
| **Lange termijn** (6-12 maanden) | ✅ Uitgebreid isolatiepakket plannen<br/>✅ Subsidies checken (ISDE, gemeentelijke regelingen)<br/>✅ Totale ROI berekenen met maandelijkse besparing |

#### Voor Voorverwarmen Inzichten:

| Termijn | Acties |
|---------|--------|
| **Direct** | ✅ Automatisering flow maken met `pre_heat_recommendation` trigger<br/>✅ Nachtverlaging testen (start conservatief: 2°C reductie) |
| **Optimalisatie** | ✅ Verlaging verfijnen op basis van comfort<br/>✅ Wektijd instelling aanpassen indien nodig |

#### Voor Thermische Opslag Inzichten:

| Termijn | Acties |
|---------|--------|
| **Voorwaarden** (1-2 weken) | ✅ Aanmelden voor dynamisch energiecontract<br/>✅ Energy Prices app installeren<br/>✅ Flow opzetten om prijzen door te sturen |
| **Implementatie** | ✅ Thermische opslag automatisering maken<br/>✅ Conservatief starten (±1°C aanpassingen) |
| **Optimalisatie** | ✅ Temperatuurverschuiving verhogen indien comfortabel<br/>✅ Timing aanpassen op jouw prijscurve |

---

## Voorbeeldflows

### Flow 1: Automatisch Voorverwarmen Schema

```
WHEN Voorverwarmen tijd aanbeveling
  (triggert dagelijks om 23:00 met optimale starttijd)

THEN
  1. Zet doeltemperatuur op 17°C om 22:00
     (nachtverlaging - gebouw koelt langzaam)

  2. Zet doeltemperatuur op 21°C op {{start_time}} token
     (voorverwarmen begint - berekend op basis van τ)

  3. Notificatie: "Voorverwarmen gepland voor {{start_time}} ({{duration_hours}}u)"
```

---

### Flow 2: Thermische Opslag met Dynamische Prijzen

```
WHEN Goedkoopste energieblok gestart
  (van Energy Prices app - typisch 02:00-06:00)

AND Gebouwinzicht gedetecteerd, categorie = "thermal_storage"

THEN
  1. Verhoog doeltemperatuur met 2°C (sla thermische energie op)
  2. Notificatie: "Thermische opslag: voorverwarmen naar {{target}}°C"
```

```
WHEN Duurste energieblok gestart
  (typisch 17:00-21:00)

THEN
  1. Verlaag doeltemperatuur met 1°C (coast op opgeslagen energie)
  2. Notificatie: "Thermische opslag: coasten op {{target}}°C"
```

---

### Flow 3: Hoge-Prioriteit Inzicht Notificaties

```
WHEN Nieuw gebouwinzicht gedetecteerd

AND {{estimated_savings_eur_month}} is groter dan 70
AND {{priority}} is groter dan 70

THEN
  Stuur notificatie:
    "💰 Energiebesparing Kans!"
    "{{insight}}"
    "Actie: {{recommendation}}"
    "Potentieel: €{{estimated_savings_eur_month}}/maand"
```

---

### Flow 4: Profiel Mismatch Auto-Correctie

```
WHEN Gebouwprofiel mismatch gedetecteerd

AND {{deviation_percent}} is groter dan 40

THEN
  1. Wijzig apparaatinstelling "building_profile" naar {{suggested_profile}}
  2. Notificatie:
     "Gebouwprofiel bijgewerkt van {{current_profile}} naar {{suggested_profile}}"
```

---

### Flow 5: Forceer Inzicht Analyse (On-Demand)

```
WHEN Gebruiker drukt op virtuele knop "Analyseer Gebouw Nu"
  (of dagelijks om 08:00 voor ochtend rapport)

THEN
  1. Forceer inzicht analyse
     (actie: Force insight analysis)
     Retourneert: {{insights_detected}}, {{confidence}}

  2. WANNEER {{insights_detected}} is groter dan 0
     THEN Notificatie:
       "Gebouwanalyse: {{insights_detected}} inzicht(en) gevonden"
       "Model betrouwbaarheid: {{confidence}}%"
```

**Use case:** Direct controleren na grote veranderingen (weer, instellingen) zonder 50 minuten te wachten.

---

### Flow 6: Alleen Hoge ROI Inzichten Notificeren (Condition)

```
WHEN Gebouwinzicht gedetecteerd

AND Geschatte besparing is boven €100/maand
  (conditie: Savings above threshold - category, €100)

AND Model confidence is boven 75%
  (conditie: Confidence above threshold - 75%)

THEN
  Stuur pushbericht:
    "💰 Grote Besparingskans!"
    "{{insight}}"
    "Actie: {{recommendation}}"
    "Potentieel: €{{estimated_savings_eur_month}}/maand"
```

**Use case:** Filter "advies-ruis" - alleen notificaties voor significante besparingen met hoge zekerheid.

---

### Flow 7: Thermische Opslag Alleen Wanneer Actief (Condition)

```
WHEN Goedkoopste energieblok gestart
  (van Energy Prices app)

AND Thermische opslag inzicht is actief
  (conditie: Insight is active - category "thermal_storage")

THEN
  Verhoog doeltemperatuur met 2°C
  Notificatie: "Thermische opslag: voorverwarmen actief"

ELSE
  (Geen actie - thermische opslag niet mogelijk voor dit gebouw)
```

**Use case:** Conditionele automatisering - alleen thermische opslag strategie toepassen als gebouw geschikt is.

---

## Flow Kaarten Referentie

### Trigger Kaarten (3)

#### 1. Nieuw gebouwinzicht gedetecteerd

**Triggert:** Wanneer een nieuw inzicht wordt gedetecteerd (≥70% confidence, max 1× per categorie per dag)

**Tokens:**

- `category` (string) - Categorie: insulation_performance / pre_heating / thermal_storage
- `insight` (string) - Mensleesbaar inzicht bericht
- `recommendation` (string) - Aanbevolen actie
- `priority` (number 0-100) - Prioriteitsscore
- `confidence` (number 0-100) - Model betrouwbaarheid
- `estimated_savings_eur_month` (number) - Maandelijkse besparing in EUR (indien van toepassing)

**Frequentie:** Max 1× per categorie per 24 uur (advice fatigue prevention)

---

#### 2. Voorverwarmen tijd aanbeveling

**Triggert:** Wanneer ΔT (doel - binnen) > 1.5°C (max 1x per 4 uur)

**Tokens (v2.6.0):**

- `duration_hours` (number) - Voorverwarmen duur in uren
- `temp_rise` (number) - Benodigde temperatuurstijging in °C
- `current_temp` (number) - Huidige binnentemperatuur in °C
- `target_temp` (number) - Doeltemperatuur in °C
- `confidence` (number 0-100) - Model betrouwbaarheid

**Voorwaarden:** Alleen als confidence ≥70%, max 1x per 4 uur

---

#### 3. Gebouwprofiel mismatch gedetecteerd

**Triggert:** Eenmalig wanneer geleerd gedrag significant afwijkt van geselecteerd profiel

**Tokens:**

- `current_profile` (string) - Huidig profiel (bijv. "average")
- `suggested_profile` (string) - Voorgesteld profiel (bijv. "heavy")
- `tau_learned` (number) - Geleerde tijdsconstante in uren
- `tau_profile` (number) - Profiel tijdsconstante in uren
- `deviation_percent` (number) - Afwijkingspercentage
- `confidence` (number 0-100) - Model betrouwbaarheid (minimum 50%)

**Voorwaarden:** Afwijking >30%, confidence ≥50%

---

### Actie Kaarten (2)

#### 1. Forceer inzicht analyse

**Functie:** Trigger onmiddellijke evaluatie (niet wachten op 50-min interval)

**Returns:**

- `insights_detected` (number) - Aantal gedetecteerde inzichten
- `confidence` (number) - Huidige model betrouwbaarheid

**Gebruik:** On-demand analyse, debugging, dagelijks rapport

---

#### 2. Bereken voorverwarmen duur (v2.6.0)

**Functie:** Berekent de tijd nodig om X°C temperatuurstijging te bereiken

**Parameters:**

- `temperature_rise` (number) - Gewenste temperatuurstijging in °C (bijv. 2.0)

**Returns:**

- `preheat_hours` (number) - Voorverwarmen duur in uren
- `confidence` (number) - Model betrouwbaarheid (%)
- `building_tau` (number) - Thermische tijdsconstante τ (uren)

**Gebruik:** Voorverwarmen plannen voor specifieke tijdstippen, thermische opslag automatisering

**Voorbeeld flow:**
```
WHEN Goedkoopste prijsblok nadert (2 uur van tevoren)
THEN
  1. Bereken voorverwarmen duur (temperature_rise = 2.0)
  2. IF preheat_hours < 3 THEN
       → Start voorverwarmen nu
```

---

### Conditie Kaarten (3)

#### 1. Inzicht is actief

**Functie:** Check of specifieke categorie momenteel actief is

**Parameters:**

- `category` (dropdown) - Te checken categorie

**Returns:** `true` als actief EN niet dismissed, anders `false`

**Gebruik:** Conditionele automatisering (alleen thermische opslag als inzicht actief)

---

#### 2. Model confidence is boven drempel

**Functie:** Kwaliteitspoort voor flows

**Parameters:**

- `threshold` (number 0-100) - Confidence drempel in %

**Returns:** `true` als model confidence > threshold

**Gebruik:** Alleen notificaties/acties bij hoge zekerheid (bijv. >80%)

---

#### 3. Geschatte besparing is boven drempel

**Functie:** ROI-gebaseerde filtering

**Parameters:**

- `category` (dropdown) - Categorie om te checken (insulation_performance / pre_heating / thermal_storage)
- `threshold` (number 0-500) - EUR/maand drempel

**Returns:** `true` als geschatte maandelijkse besparing > threshold

**Gebruik:** Filter voor significante besparingen (bijv. alleen notificeren als >€100/maand)

---

## Instellingen

### Inzichten Instellingen

**Locatie:** Apparaatinstellingen → Gebouwinzichten & Aanbevelingen

| Instelling | Standaard | Bereik | Beschrijving |
|------------|-----------|--------|--------------|
| **Gebouwinzichten inschakelen** | AAN | AAN/UIT | Hoofdschakelaar |
| **Minimum Confidence (%)** | 70% | 50-90% | Drempel voor tonen inzichten |

> **Opmerking (v2.6.0):** De instellingen `wake_time` en `night_setback_delta` zijn verwijderd. Voorverwarmen wordt nu dynamisch berekend op basis van actuele binnen/doel temperaturen.

### Dynamische Voorverwarmen (v2.6.0)

Het systeem triggert automatisch wanneer ΔT (doel - binnen) > 1.5°C:

**Formule:**
```
Voorverwarmen_duur = τ × ln(ΔT / 0.3)
```

**Voorbeeld:**
- Doeltemperatuur: **21°C**
- Binnentemperatuur: **18°C**
- τ (tijdsconstante): **10 uur**
- ΔT = 21 - 18 = **3°C**

```
Voorverwarmen_duur = 10 × ln(3 / 0.3) = 10 × 2.30 = 23 uur → gemaximeerd
```

**Praktische uitkomsten:**

| τ (uur) | ΔT 2°C | ΔT 3°C | ΔT 4°C |
|---------|--------|--------|--------|
| 4 | 0.8u | 0.9u | 1.0u |
| 10 | 1.9u | 2.3u | 2.6u |
| 15 | 2.9u | 3.5u | 3.9u |

### Aanbevolen Instellingen per Gebruikerstype

| Type | Confidence |
|------|------------|
| **Beginner** (eerste 2 weken) | 70% |
| **Gemiddeld** (na 1 maand) | 65% |
| **Gevorderd** (na 3 maanden) | 60% |

---

## Probleemoplossing

### Geen Inzichten na 48 Uur

| Oorzaak | Oplossing |
|---------|-----------|
| Model confidence <70% | Wacht langer (tot 72 uur) of verlaag drempel naar 65% |
| Inzichten uitgeschakeld | Check Apparaatinstellingen → Gebouwinzichten inschakelen |
| Gebouw presteert exact zoals verwacht | Goed nieuws! Geen optimalisatie nodig |
| Ontbrekende databronnen | Zorg dat externe binnentemp sensor verbonden is |

### Inzichten Tonen Verkeerde Besparing Schattingen

| Oorzaak | Impact | Oplossing |
|---------|--------|-----------|
| Energieprijs ≠ €0.30/kWh | Schattingen proportioneel | Vermenigvuldig met (jouw prijs / 0.30) |
| COP ≠ 3.5 | Hogere COP = hogere besparing | Schattingen zijn conservatief |
| Stookuren ≠ 4000u/jaar | Meer uren = hogere besparing | Monitor werkelijke besparing na 1 maand |

### Voorverwarmen Aanbeveling Triggert Niet

| Oorzaak | Oplossing |
|---------|-----------|
| Model confidence <70% | Wacht op leren |
| Wektijd niet geconfigureerd | Stel in via Apparaatinstellingen |
| Flow kaart niet gemaakt | Maak flow met "Voorverwarmen tijd aanbeveling" trigger |

---

## FAQ

### V: Hoe lang duurt het leren?

**A:** Ongeveer 1–2 dagen voor 70% confidence (standaard drempel). Je kunt verlagen naar 50% voor eerdere inzichten (minder accuraat). Volledige convergentie duurt 1-3 weken.

### V: Worden inzichten bijgewerkt als ik isolatie verbeter?

**A:** Ja! Het model leert continu. Na isolatie upgrades zou UA moeten dalen over 3-7 dagen. Het "slechte isolatie" inzicht verdwijnt en kan vervangen worden door "uitstekende isolatie" of "thermische opslag kans".

### V: Wat als mijn gebouw in geen enkel profiel past?

**A:** Profielen zijn alleen startpunten om leren te versnellen. Na 48 uur overschrijven de geleerde parameters het profiel volledig.

### V: Waarom lijkt mijn τ (tijdsconstante) hoog/laag?

**A:** τ hangt af van zowel thermische massa (C) als warmteverlies (UA):
- **Hoge τ** (≥80u): Zwaar gebouw (hoge C) OF uitstekende isolatie (lage UA)
- **Lage τ** (<20u): Licht gebouw (lage C) OF slechte isolatie (hoge UA)

### V: Hoe accuraat zijn de besparingschattingen?

**A:** Doelnauwkeurigheid is ±20%. Ze zijn gebaseerd op conservatieve aannames (COP 3.5, 4000 stookuren, €0.30/kWh). Monitor werkelijke besparing via Homey Energy na implementatie.

### V: Wat gebeurt er als ik apparaatinstellingen wijzig tijdens leren?

**A:** Minimale impact. Het model leert gebouwkenmerken, niet warmtepomp instellingen. Maar vermijd:
- Gebouwprofiel wijzigen tijdens leren (reset parameters)
- Gebouwmodel resetten (verliest alle geleerde data)
- Frequente modus wisselingen (verwarring voor model)

---
