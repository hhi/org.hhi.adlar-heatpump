# 🚀 Neue Funktion: Adaptive Temperaturregelung

> **Status**: Verfügbar ab Version 2.5.x  
> **Voraussetzung**: Externer Raumtemperatursensor über Homey Flow

---

## Was ist Adaptive Temperaturregelung?

Die Adlar App **lernt** jetzt, wie sich Ihr Zuhause verhält und passt die Wärmepumpe automatisch für optimalen Komfort und maximale Einsparungen an.

### Die 3 Säulen: Komfort • Effizienz • Kosten

| Faktor | Was es tut | Einstellung |
|--------|------------|-------------|
| 🛋️ **Komfort** | Stabile Raumtemperatur (±0.3°C) via PI-Regelung | 60% (Standard) |
| ⚡ **Effizienz** | Optimaler COP durch intelligente Vorlauftemperatur | 25% (Standard) |
| 💰 **Kosten** | Vorheizen bei günstigem Strom, reduzieren bei teurem | 15% (Standard) |

*Gewichtungen sind einstellbar und normalisieren automatisch auf 100%.*

---

## Was Kann Es Erreichen?

### 1. Stabilere Temperatur
- **Problem**: Traditionelle Thermostate reagieren langsam, Temperatur schwankt 1-2°C
- **Lösung**: PI-Regler mit Vorhersage → Raumtemperatur bleibt innerhalb ±0.3°C

### 2. Niedrigere Energierechnungen
- **COP-Optimierung**: Lernt optimale Vorlauftemperatur pro Außentemperatur → €200-300/Jahr
- **Preisoptimierung**: Heizt vor während günstiger Stunden → €400-600/Jahr

### 3. Intelligenteres Gebäudemodell
Die App lernt automatisch:
- **Thermische Masse (C)**: Wie schnell Ihr Haus abkühlt
- **Wärmeverlust (UA)**: Dämmungsqualität
- **Zeitkonstante (τ)**: Stunden bis zur stabilen Temperatur
- **Solargewinn (g)**: Heizungsbeitrag durch Sonne

---

## Erforderliche Einrichtung

```
┌─────────────────────────────────────────────────────┐
│   Externer Sensor   →    Flow-Karte   →    App      │
│   (Thermostat)           (Trigger)        (lernt)   │
└─────────────────────────────────────────────────────┘
```

**Mindestanforderungen:**
1. ✅ Raumtemperatursensor (z.B. Aqara, Tado, Homey-Thermostat)
2. ✅ Flow: `WENN Temp sich ändert` → `An Wärmepumpe senden`

**Optional für zusätzliche Funktionen:**
- Außentemperatursensor (Wetterdienst, Wetterstation)
- Externes Leistungsmessgerät (für COP)
- Dynamischer Energievertrag (für Preisoptimierung)

---

## Wie Aktivieren?

1. **Geräteeinstellungen** → `Adaptive Temperaturregelung` aktivieren
2. Flow für Raumtemperatur erstellen
3. 24-48 Stunden für Gebäudemodell-Lernen warten
4. Optional: COP-/Preisoptimierung aktivieren

---

*Mehr Infos: [Advanced Features Introduction](setup/Advanced_Features_Intro.de.md)*
*Mehr Infos: [Configuration Guide](setup/advanced-settings/CONFIGURATION_GUIDE.de.md) - Abschnitt 5*
