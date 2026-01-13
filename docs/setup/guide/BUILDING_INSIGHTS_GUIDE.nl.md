# Gebouwinzichten & Aanbevelingen Gids

**Versie**: 2.6.0+ | **Laatst bijgewerkt**: Januari 2026

---

## Inhoudsopgave

1. [Introductie](#introductie)
2. [Wat zijn Gebouwinzichten?](#wat-zijn-gebouwinzichten)
3. [Hoe het werkt](#hoe-het-werkt)
4. [Inzicht Categorieën](#inzicht-categorieën)
5. [Inzichten begrijpen](#inzichten-begrijpen)
6. [Actie ondernemen](#actie-ondernemen)
7. [Voorbeeldflows](#voorbeeldflows)
8. [Instellingen](#instellingen)
9. [Probleemoplossing](#probleemoplossing)
10. [FAQ](#faq)

---

## Introductie

De **Gebouwinzichten & Aanbevelingen** functie transformeert je warmtepomp van een simpele temperatuurregelaar naar een intelligente energieadviseur. Na 24-48 uur leren van de thermische eigenschappen van je gebouw, geeft het systeem **concrete, bruikbare aanbevelingen** met geschatte besparingen in euro's per maand.

### Belangrijkste Voordelen

| Voordeel | Besparing |
|----------|-----------|
| 💰 Isolatie-inzichten | 10-30% |
| ⏱️ Voorverwarmen optimalisatie | 5-10% |
| 🏠 Thermische opslag strategieën | 10-25% (met dynamische prijzen) |
| 📊 ROI transparantie | Elke aanbeveling incl. maandelijkse besparing |

---

## Wat zijn Gebouwinzichten?

Gebouwinzichten analyseren de **5 thermische parameters** die door het Gebouwmodel worden geleerd:

| Parameter | Symbool | Betekenis | Typisch Bereik |
|-----------|---------|-----------|----------------|
| **Thermische Massa** | C | Warmtecapaciteit - hoeveel energie nodig voor 1°C | 7-30 kWh/°C |
| **Warmteverlies Coëfficiënt** | UA | Snelheid van warmteverlies per graad verschil | 0.05-0.5 kW/°C |
| **Tijdsconstante** | τ (tau) | Hoe snel gebouw opwarmt/afkoelt (τ = C/UA) | 5-25 uur |
| **Zonnewinst Factor** | g | Effectiviteit van zonnestraling opwarming | 0.3-0.6 |
| **Interne Warmtewinst** | P_int | Warmte van mensen, apparaten, koken | 0.2-0.5 kW |

Het systeem vergelijkt geleerde waarden met:
- **Je geselecteerde gebouwprofiel** (Licht/Gemiddeld/Zwaar/Passief)
- **Typische waarden voor goed geïsoleerde gebouwen**
- **Je energieprijsdata** (indien beschikbaar)

Bij optimalisatiekansen genereert het **inzichten** met specifieke aanbevelingen.

---

## Hoe het werkt

### Leerfase (24-48 uur)

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

**Wat het detecteert:**
- Snelle thermische respons (τ < 5 uur)
- Medium thermische respons (τ 5-15 uur)
- Trage thermische respons (τ > 15 uur)

**Voorbeeld Inzicht:**
> "⏱️ Snelle thermische respons - gebouw warmt op in 4.2 uur"

**Voorbeeld Aanbeveling:**
> "Schakel agressieve nachtverlaging naar 16°C in, voorverwarmen 2 uur voor wakker worden (05:00 → 07:00 klaar). Geschat 12% energiebesparing."

**Aanbevolen acties per type:**

| Respons Type | τ | Nachtverlaging | Voorverwarmen | Besparing |
|--------------|---|----------------|---------------|-----------|
| Snel | <5u | Agressief (16-17°C) | 2-3 uur | 10-15% |
| Medium | 5-15u | Matig (17-18°C) | 4-5 uur | 6-10% |
| Traag | >15u | Minimaal of geen | Niet praktisch | 3-5% |

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
> "🔄 Gebouw gedraagt zich als 'zwaar' (τ=18u vs 'gemiddeld' τ=10u)"

**Voorbeeld Aanbeveling:**
> "Wijzig gebouwprofiel naar 'zwaar' in apparaatinstellingen voor sneller leren en betere initiële parameters"

**Profiel Kenmerken:**

| Profiel | C (kWh/°C) | UA (kW/°C) | τ (uur) | Gebouwtype |
|---------|-----------|-----------|---------|------------|
| **Licht** | 7 | 0.35 | 20 | Houtskelet, basis isolatie, snelle temp wisselingen |
| **Gemiddeld** | 15 | 0.30 | 50 | Baksteen, spouwmuur, dubbel glas (typisch NL) |
| **Zwaar** | 20 | 0.25 | 80 | Beton/steen, goede isolatie, HR++ glas |
| **Passief** | 30 | 0.05 | 600 | Passiefhuis, HR+++, luchtdicht, WTW |

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
2. **"Voorverwarmen tijd aanbeveling"** — Dagelijkse trigger om 23:00
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

### Flow 5: Inzicht Tijdelijk Verbergen (Dismiss)

```
WHEN Gebouwinzicht gedetecteerd, categorie = "insulation_performance"

AND Gebruiker heeft besloten isolatie te negeren (bekend probleem)

THEN
  Verberg "insulation_performance" inzicht voor 90 dagen
    (actie: Dismiss insight)

  Notificatie: "Isolatie inzicht verborgen voor 3 maanden"
```

**Use case:** Na renovatie werk in progress, of als je weet dat isolatie op planning staat maar nog niet uitgevoerd.

---

### Flow 6: Forceer Inzicht Analyse (On-Demand)

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

### Flow 7: Reset na Renovatie

```
WHEN Virtuele knop "Renovatie Voltooid" ingedrukt

THEN
  1. Reset inzicht geschiedenis [✓ Bevestig reset]
     (actie: Reset insight history - checkbox MOET aangevinkt)

  2. Notificatie:
     "Inzichten gereset. Nieuw leren start - verwacht nieuwe inzichten na 24-48u"
```

**Use case:** Na grote gebouw wijzigingen (isolatie, nieuwe ramen, verbouwing) - reset insights maar behoud building model.

---

### Flow 8: Dynamische Confidence Drempel (Adaptief)

```
WHEN Gebouwmodel leermijlpaal bereikt
  milestone = "convergence_reached" (na 7 dagen stabiel leren)

THEN
  Stel betrouwbaarheidsdrempel in op 60%
    (actie: Set confidence threshold)

  Notificatie: "Model stabiel - confidence drempel verlaagd voor meer inzichten"
```

**Use case:** Start conservatief (70%), verlaag drempel als model stabiel is voor meer inzicht granulariteit.

---

### Flow 9: Alleen Hoge ROI Inzichten Notificeren (Condition)

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

### Flow 10: Thermische Opslag Alleen Wanneer Actief (Condition)

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

### Flow 11: Isolatie Inzicht Negeren tot Lente (Seasonal)

```
WHEN Gebouwinzicht gedetecteerd, categorie = "insulation_performance"

AND Huidige maand is tussen Oktober en Maart (winter)

THEN
  Verberg "insulation_performance" inzicht voor 180 dagen
    (actie: Dismiss insight)

  Notificatie:
    "Isolatie inzicht uitgesteld tot lente (april) voor warmere renovatieweersomstandigheden"
```

**Use case:** Strategisch plannen van isolatie werk in gunstige seizoenen.

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

**Triggert:** Dagelijks om 23:00 met optimale voorverwarmen starttijd

**Tokens:**

- `start_time` (string) - HH:MM formaat (bijv. "05:30")
- `target_time` (string) - Doeltijd (ingesteld via wake_time setting)
- `duration_hours` (number) - Voorverwarmen duur in uren
- `temp_rise` (number) - Temperatuurstijging in °C
- `confidence` (number 0-100) - Model betrouwbaarheid

**Voorwaarden:** Alleen als confidence ≥70%, herberekent bij τ wijziging >10%

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

### Actie Kaarten (4)

#### 1. Verberg inzicht (Dismiss insight)

**Functie:** Verberg specifieke inzicht categorie tijdelijk

**Parameters:**

- `category` (dropdown) - Categorie om te verbergen
- `duration` (number 1-365) - Aantal dagen

**Gebruik:** Na renovatie planning, bekend probleem negeren

---

#### 2. Forceer inzicht analyse

**Functie:** Trigger onmiddellijke evaluatie (niet wachten op 50-min interval)

**Returns:**

- `insights_detected` (number) - Aantal gedetecteerde inzichten
- `confidence` (number) - Huidige model betrouwbaarheid

**Gebruik:** On-demand analyse, debugging, dagelijks rapport

---

#### 3. Reset inzicht geschiedenis

**Functie:** Wis alle actieve inzichten en geschiedenis (gebouwmodel blijft intact)

**Parameters:**

- `confirm` (checkbox) - MOET aangevinkt om reset uit te voeren

**Gebruik:** Na grote gebouw wijzigingen (isolatie, renovatie, nieuwe ramen)

**BELANGRIJK:** Gebouwmodel (C, UA, τ, g, P_int) blijft behouden - alleen insights worden gereset

---

#### 4. Stel betrouwbaarheidsdrempel in

**Functie:** Pas dynamisch minimum confidence threshold aan

**Parameters:**

- `threshold` (number 50-90) - Nieuwe drempel in %

**Effec:** Hogere drempel = minder inzichten (zeer betrouwbaar), lagere = meer inzichten (vroeger, minder accuraat)

**Gebruik:** Adaptieve drempel - start 70%, verlaag naar 60% na convergentie

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
| **Wektijd** | 07:00 | UU:MM | Doeltijd voor voorverwarmen voltooiing |
| **Nachtverlaging (°C)** | 4.0 | 2.0-6.0 | Temperatuurreductie 's nachts |

> **Opmerking (v2.5.10):** De instelling "Max Actieve Inzichten" is verwijderd - elke categorie heeft nu een eigen sensor.

### Wektijd (wake_time) - Hoe het werkt

De `wake_time` instelling bepaalt wanneer het voorverwarmen voltooid moet zijn. Het systeem berekent automatisch de optimale starttijd:

**Formule:**
```
Voorverwarmen_duur = τ × ln(ΔT_doel / ΔT_rest)
Start_tijd = Wektijd - Voorverwarmen_duur
```

**Voorbeeld berekening:**
- Wektijd: **07:00**
- τ (tijdsconstante): **10 uur**
- Nachtverlaging: **4°C** (van 21°C naar 17°C)
- Residuele temperatuurdaling: **0.5°C** (aanname)

```
Voorverwarmen_duur = 10 × ln(4 / 0.5) = 10 × 2.08 = 20.8 uur
→ Dit is onrealistisch, dus systeem past aan voor thermische massa
```

**Praktische uitkomst per gebouwtype:**

| τ (uur) | Voorverwarmen | Start bij wektijd 07:00 |
|---------|---------------|-------------------------|
| 4 | 2 uur | 05:00 |
| 8 | 3.5 uur | 03:30 |
| 15 | 5 uur | 02:00 |
| 25+ | Niet praktisch | Overweeg continue verwarming |

### Aanbevolen Instellingen per Gebruikerstype

| Type | Confidence | Nachtverlaging |
|------|------------|----------------|
| **Beginner** (eerste 2 weken) | 70% | 2°C |
| **Gemiddeld** (na 1 maand) | 65% | 4°C |
| **Gevorderd** (na 3 maanden) | 60% | Op basis van τ |

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

**A:** 24-48 uur voor 70% confidence (standaard drempel). Je kunt verlagen naar 50% voor eerdere inzichten (minder accuraat). Volledige convergentie duurt 1-3 weken.

### V: Worden inzichten bijgewerkt als ik isolatie verbeter?

**A:** Ja! Het model leert continu. Na isolatie upgrades zou UA moeten dalen over 3-7 dagen. Het "slechte isolatie" inzicht verdwijnt en kan vervangen worden door "uitstekende isolatie" of "thermische opslag kans".

### V: Wat als mijn gebouw in geen enkel profiel past?

**A:** Profielen zijn alleen startpunten om leren te versnellen. Na 48 uur overschrijven de geleerde parameters het profiel volledig.

### V: Waarom lijkt mijn τ (tijdsconstante) hoog/laag?

**A:** τ hangt af van zowel thermische massa (C) als warmteverlies (UA):
- **Hoge τ** (>15u): Zwaar gebouw (hoge C) OF uitstekende isolatie (lage UA)
- **Lage τ** (<5u): Licht gebouw (lage C) OF slechte isolatie (hoge UA)

### V: Hoe accuraat zijn de besparingschattingen?

**A:** Doelnauwkeurigheid is ±20%. Ze zijn gebaseerd op conservatieve aannames (COP 3.5, 4000 stookuren, €0.30/kWh). Monitor werkelijke besparing via Homey Energy na implementatie.

### V: Wat gebeurt er als ik apparaatinstellingen wijzig tijdens leren?

**A:** Minimale impact. Het model leert gebouwkenmerken, niet warmtepomp instellingen. Maar vermijd:
- Gebouwprofiel wijzigen tijdens leren (reset parameters)
- Gebouwmodel resetten (verliest alle geleerde data)
- Frequente modus wisselingen (verwarring voor model)

---
