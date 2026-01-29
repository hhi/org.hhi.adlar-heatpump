# 🏠 Nieuwe Functionaliteit: Gebouwmodel & Building Insights

> **Status**: Beschikbaar vanaf versie 2.5.x  
> **Vereist**: Adaptieve Temperatuurregeling actief + binnen-/buitentemperatuur  
> **Windcorrectie (W_corr)**: Beschikbaar vanaf 2.7.0+ (optioneel)

---

## Wat is het Gebouwmodel?

De app leert **automatisch** de thermische eigenschappen van jouw woning door temperatuurdata te analyseren. Na 48-72 uur kent de app je huis beter dan jijzelf.

### Wat Leert de App?

| Parameter | Wat het betekent | Voorbeeld |
|-----------|------------------|-----------|
| **C** (Thermische massa) | Hoeveel warmte je huis kan opslaan | Betonvloer = hoog, houtskelet = laag |
| **UA** (Warmteverlies) | Hoe snel warmte weglekt | Goed geïsoleerd = laag UA |
| **τ** (Tijdsconstante) | Uren tot stabiele temperatuur | τ = 50u = trage afkoeling |
| **g** (Zonnewinst) | Bijverwarming door zonlicht | Zuid-glas = hoge g |
| **P_int** (Interne warmte) | Warmteproductie door bewoners/apparaten | Gezin met PC's = hogere P_int |
| **W_corr** (Windcorrectie) | Extra warmteverlies bij harde wind | Storm = +20-50% UA (v2.7.0+) |

---

## Wat is Building Insights?

Na het leren van je gebouw geeft de app **concrete aanbevelingen** met geschatte ROI (Return on Investment).

### Voorbeelden van Insights:

| Insight | Aanbeveling | Geschatte Besparing |
|---------|-------------|---------------------|
| 🌡️ **Hoge UA** | "Overweeg dakisolatie" | €200-400/jaar |
| ⏰ **Lange τ** | "Voorverwarmen effectief" | €100-150/jaar |
| ☀️ **Hoge g-waarde** | "Zonwering = minder koeling nodig" | €50-100/jaar |
| 🔥 **Hoge P_int** | "Nachttemperatuur kan lager" | €50-80/jaar |

---

## Hoe Werkt Het?

```
┌─────────────────────────────────────────────────────────────┐
│  Stap 1: Data Verzamelen                                    │
│  ─────────────────────                                      │
│  • Binnentemperatuur (sensor)                               │
│  • Buitentemperatuur (KNMI/sensor)                          │
│  • Warmtepomp vermogen (optioneel)                          │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  Stap 2: Machine Learning                                   │
│  ────────────────────────                                   │
│  • Na 10 samples: eerste analyse                            │
│  • Na 48 uur: 70% confidence                                │
│  • Na 72 uur: volledige profielconfiguratie                 │
│  • Continu: bijleren bij veranderende omstandigheden        │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  Stap 3: Insights Genereren                                 │
│  ──────────────────────────                                 │
│  • Vergelijking met referentiewaarden                       │
│  • ROI-berekening per aanbeveling                           │
│  • Max 3 actieve insights tegelijk                          │
└─────────────────────────────────────────────────────────────┘
```

---

## Confidence Levels

| Confidence | Wat het betekent | Actie |
|------------|------------------|-------|
| 0-30% | Onvoldoende data | Wachten op meer samples |
| 30-70% | Basis model | Eerste voorspellingen mogelijk |
| 70-90% | Betrouwbaar model | Insights beschikbaar |
| 90-100% | Volledig profiel | Seizoensaanpassingen actief |

**Standaard**: Insights verschijnen pas bij 70% confidence (instelbaar).

---

## Instellingen

| Setting | Standaard | Omschrijving |
|---------|-----------|--------------|
| `building_model_enabled` | Uit | Schakel gebouwmodel learning in |
| `building_insights_enabled` | Uit | Schakel aanbevelingen in |
| `building_insights_min_confidence` | 70% | Minimale zekerheid voor insights |
| `building_insights_max_active` | 3 | Max aantal gelijktijdige aanbevelingen |

---

## Vereisten

**Minimaal:**

- ✅ Adaptieve temperatuurregeling actief
- ✅ Binnentemperatuur sensor

**Aanbevolen:**

- ✅ Externe buitentemperatuur (KNMI/weerstation)
- ✅ Externe vermogensmeting (voor €-besparingen in insights)
- ☁️ Windsnelheid sensor (voor nauwkeurige UA-correctie bij wind)
- ☀️ Zonnestraling sensor (voor optimale g-factor learning)

---

*Meer info: [Advanced Features Introduction](setup/advanced-control/Advanced_Features_Intro.nl.md)*
*Meer info: [Configuration Guide](setup/advanced-settings/CONFIGURATION_GUIDE.nl.md) - Sectie 6 & 7*
