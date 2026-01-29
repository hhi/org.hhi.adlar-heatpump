# 🏠 Neue Funktion: Gebäudemodell & Building Insights

> **Status**: Verfügbar ab Version 2.5.x  
> **Voraussetzung**: Adaptive Temperaturregelung aktiv + Innen-/Außentemperatur  
> **Windkorrektur (W_corr)**: Verfügbar ab 2.7.0+ (optional)

---

## Was ist das Gebäudemodell?

Die App **lernt automatisch** die thermischen Eigenschaften Ihres Hauses durch Analyse von Temperaturdaten. Nach 48-72 Stunden kennt die App Ihr Haus besser als Sie selbst.

### Was Lernt die App?

| Parameter | Was es bedeutet | Beispiel |
|-----------|-----------------|----------|
| **C** (Thermische Masse) | Wie viel Wärme Ihr Haus speichern kann | Betonboden = hoch, Holzrahmen = niedrig |
| **UA** (Wärmeverlust) | Wie schnell Wärme entweicht | Gut gedämmt = niedriger UA |
| **τ** (Zeitkonstante) | Stunden bis stabile Temperatur | τ = 50h = langsame Abkühlung |
| **g** (Solargewinn) | Heizungsbeitrag durch Sonnenlicht | Südglas = hoher g-Wert |
| **P_int** (Interne Wärme) | Wärmeproduktion durch Bewohner/Geräte | Familie mit PCs = höherer P_int |
| **W_corr** (Windkorrektur) | Zusätzlicher Wärmeverlust bei starkem Wind | Sturm = +20-50% UA (v2.7.0+) |

---

## Was ist Building Insights?

Nach dem Lernen Ihres Gebäudes liefert die App **konkrete Empfehlungen** mit geschätztem ROI (Return on Investment).

### Beispiele für Insights:

| Insight | Empfehlung | Geschätzte Einsparungen |
|---------|------------|-------------------------|
| 🌡️ **Hoher UA** | "Dachdämmung erwägen" | €200-400/Jahr |
| ⏰ **Langes τ** | "Vorheizen ist effektiv" | €100-150/Jahr |
| ☀️ **Hoher g-Wert** | "Beschattung = weniger Kühlung nötig" | €50-100/Jahr |
| 🔥 **Hoher P_int** | "Nachttemperatur kann niedriger sein" | €50-80/Jahr |

---

## Wie Funktioniert Es?

```
┌─────────────────────────────────────────────────────────────┐
│  Schritt 1: Daten Sammeln                                   │
│  ────────────────────────                                   │
│  • Raumtemperatur (Sensor)                                  │
│  • Außentemperatur (Wetterdienst/Sensor)                    │
│  • Wärmepumpenleistung (optional)                           │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  Schritt 2: Machine Learning                                │
│  ───────────────────────────                                │
│  • Nach 10 Samples: erste Analyse                           │
│  • Nach 48 Stunden: 70% Konfidenz                           │
│  • Nach 72 Stunden: vollständige Profilkonfiguration        │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  Schritt 3: Insights Generieren                             │
│  ──────────────────────────────                             │
│  • Vergleich mit Referenzwerten                             │
│  • ROI-Berechnung pro Empfehlung                            │
│  • Max 3 aktive Insights gleichzeitig                       │
└─────────────────────────────────────────────────────────────┘
```

---

## Konfidenzniveaus

| Konfidenz | Was es bedeutet | Aktion |
|-----------|-----------------|--------|
| 0-30% | Unzureichende Daten | Auf mehr Samples warten |
| 30-70% | Basismodell | Erste Vorhersagen möglich |
| 70-90% | Zuverlässiges Modell | Insights verfügbar |
| 90-100% | Vollständiges Profil | Saisonale Anpassungen aktiv |

**Standard**: Insights erscheinen erst bei 70% Konfidenz (einstellbar).

---

## Einstellungen

| Einstellung | Standard | Beschreibung |
|-------------|----------|--------------|
| `building_model_enabled` | Aus | Gebäudemodell-Lernen aktivieren |
| `building_insights_enabled` | Aus | Empfehlungen aktivieren |
| `building_insights_min_confidence` | 70% | Minimale Sicherheit für Insights |
| `building_insights_max_active` | 3 | Max gleichzeitige Empfehlungen |

---

## Voraussetzungen

**Minimum:**
- ✅ Adaptive Temperaturregelung aktiv
- ✅ Raumtemperatursensor

**Empfohlen:**
- ✅ Externe Außentemperatur (Wetterdienst/Wetterstation)
- ✅ Externe Leistungsmessung (für €-Einsparungen in Insights)
- ☁️ Windsensor (für genaue UA-Korrektur bei Wind)
- ☀️ Sonneneinstrahlungssensor (für optimales g-Faktor-Lernen)

---

*Mehr Infos: [Advanced Features Introduction](setup/advanced-control/Advanced_Features_Intro.de.md)*
*Mehr Infos: [Configuration Guide](setup/advanced-settings/CONFIGURATION_GUIDE.de.md) - Abschnitt 6 & 7*
