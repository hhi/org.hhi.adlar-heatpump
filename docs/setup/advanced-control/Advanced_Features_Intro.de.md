# Adlar Wärmepumpen-App - Einführung in Erweiterte Funktionen

Diese Anleitung zeigt Ihnen, wie Sie die erweiterten Funktionen der Adlar Wärmepumpen-App aktivieren können, indem Sie externe Daten verbinden, und demonstriert die leistungsstarken Rechner-Flow-Karten.

---

## Teil 1: Externe Daten Verbinden (Einrichtung)

Um die volle Funktionalität der App zu nutzen, können Sie externe Sensoren und Daten über Homey-Flows verbinden. Dies schaltet Funktionen wie COP-Berechnung, adaptive Temperaturregelung und Preisoptimierung frei.

### 1.1 Externes Leistungsmessgerät Verbinden (für COP-Berechnung)

Verbinden Sie ein externes Leistungsmessgerät (z.B. aus Ihrem Sicherungskasten) für eine genaue COP-Berechnung.

![Externe Leistungsmessung Setup](../images/Setup%20-%20extern%20vermogen.png)

**So richten Sie es ein:**
```
WENN: [Wärmepumpe kWh-Zähler] Leistung hat sich geändert
DANN: [Intelligent Heat Pump] Sende {{Leistung}} W an Wärmepumpe für COP-Berechnung
```

**Was dies freischaltet:**
- ✅ Genaue Echtzeit-COP-Berechnung (±5% Genauigkeit)
- ✅ Tägliche und monatliche COP-Trends
- ✅ COP Flow-Karten-Trigger und -Bedingungen
- ✅ COP-Optimierungsfunktion

> [!NOTE]
> **Was wenn Sie keine Leistungsmessung haben?**
> 
> Wenn Sie **kein** externes Leistungsmessgerät haben und Ihre Wärmepumpe **keine** interne Leistungsmessung hat (kein DPS für Spannung/Strom/Leistung), dann sind folgende Funktionen **nicht verfügbar**:
>
> | ❌ Nicht Verfügbar | ✅ Funktioniert Weiterhin |
> |-------------------|--------------------------|
> | Echtzeit-COP-Berechnung | Adaptive Temperaturregelung |
> | Täglicher/Monatlicher COP | Gebäudemodell-Lernen |
> | COP-Optimierung | Building Insights (ohne €-Einsparungen) |
> | COP Flow-Karten | Witterungskompensation Heizkurve |
> | Energy Dashboard-Integration | Status/Modus-Überwachung |
> | Energiekostenberechnung | Preisoptimierung (theoretisch) |
>
> **Lösungen:**
> - **Smart Plug mit Leistungsmessung** (Shelly PM, FIBARO) - Hinweis: muss 2000-4000W verkraften
> - **Separater kWh-Zähler im Sicherungskasten** (Qubino, Eastron SDM) - Genauer, erfordert Installation
> - **P1-Zähler Untergruppe** - Wenn Ihre P1-App Gruppen unterscheiden kann

---

### 1.2 Externe Innentemperatur Verbinden (für Adaptive Regelung)

Verbinden Sie einen Raumthermostat oder Temperatursensor für adaptive Temperaturregelung.

![Externe Innentemperatur Setup](../images/Setup%20-%20externe%20binnentemperatuur.png)

**So richten Sie es ein:**
```
WENN: [Wohnzimmer-Sensor] Temperatur hat sich geändert
DANN: [Intelligent Heat Pump] Sende {{Temperatur}} °C Innentemperatur für adaptive Regelung
```

**Was dies freischaltet:**
- ✅ Adaptive Temperaturregelung (PI-Regler)
- ✅ Stabile Innentemperatur (±0.3°C)
- ✅ Gebäudemodell-Lernen (Wärmespeicherfähigkeit, Dämmung)
- ✅ Building Insights mit Sparempfehlungen

---

### 1.3 Externe Außentemperatur Verbinden (für Thermisches Modell)

Verbinden Sie eine Wetterstation oder Wetterdienst-Daten für bessere thermische Vorhersagen.

![Externe Außentemperatur Setup](../images/Setup%20-%20externe%20buitentemperatuur.png)

**So richten Sie es ein:**
```
WENN: [Wetterdienst] Aktuelle Temperatur hat sich geändert
DANN: [Intelligent Heat Pump] Sende {{Aktuelle Temperatur}} °C an Wärmepumpe für COP/Wärmespeicher-Berechnung
```

**Was dies freischaltet:**
- ✅ Verbesserte COP-Berechnung (Carnot-Referenz)
- ✅ Genaueres Gebäudemodell-Lernen
- ✅ Witterungskompensation für Heizkurve
- ✅ Saisonale Optimierungen

> [!NOTE]
> **Funktioniert es auch ohne externe Außentemperatur?**
> 
> Ja! Die App verwendet automatisch den **internen Ambient-Sensor (DPS 25)** der Wärmepumpe als Fallback. Alle Funktionen arbeiten auch mit diesem Sensor, aber mit geringerer Genauigkeit.
>
> | Quelle | Genauigkeit | Hinweis |
> |--------|-------------|---------|
> | **Externer Sensor** (Wetterdienst, Wetterstation) | ±0.5°C | Empfohlen für beste Ergebnisse |
> | **Interner Sensor** (DPS 25) | ±2-3°C | Beeinflusst durch Abwärme der Außeneinheit |
>
> **Auswirkungen auf Funktionen:**
> - Gebäudemodell: τ (Zeitkonstante) kann ~10% abweichen
> - COP Carnot-Referenz: ~5% weniger genau
> - Vorhersagen: Etwas weniger genaue Planung
>
> **Fazit:** Externe Verbindung ist *optional* für bessere Genauigkeit, nicht erforderlich.

---

### 1.4 Externe Energiepreise Verbinden (für Preisoptimierung)

Verbinden Sie eine dynamische Energiepreis-App (z.B. PBTH oder EnergyZero) für intelligente Preisoptimierung.

![Externe Energiepreise Setup](../images/Setup%20-%20externe%20energietarieven.png)

**So richten Sie es ein:**
```
WENN: [Energiepreis-App] Neue Preise für kommende Stunden erhalten
DANN: [Intelligent Heat Pump] Sende externe Energiepreise {{Preise}} für Preisoptimierung
```

**Was dies freischaltet:**
- ✅ Automatische Preisoptimierung
- ✅ Vorheizen während günstiger Stunden
- ✅ Vermeidung von Spitzenpreisen
- ✅ Geschätzte Einsparungen: 400-600€/Jahr

---

### 1.5 Externe Sonnenstrahlung Koppeln (für Gebäudemodell Solargewinn)

Koppeln Sie einen Sonnenstrahlungssensor (z.B. KNMI) für präzise Berechnung des Solargewinns im Gebäudemodell.

![KNMI Strahlungsintensität Setup](../images/Setup%20-%20KNMI%20stralingsintensiteit.png)

**So richten Sie es ein:**
```
WENN: [KNMI] Strahlungsintensität hat sich geändert
DANN: [Intelligent Heat Pump] Sende Sonnenstrahlung {{Strahlungsintensität}} W/m² an Wärmepumpe
```

**Was dies freischaltet:**

- ✅ Präziser g-Faktor (Solargewinn-Koeffizient) im Gebäudemodell
- ✅ Bessere Vorhersage des Wärmebedarfs an sonnigen Tagen
- ✅ Optimale Nutzung passiven Solargewinns
- ✅ Reduzierter Heizbedarf bei hoher Einstrahlung

> [!NOTE]
> **Vorteil eines externen Sonnenstrahlungssensors:**
>
> Ohne externen Sensor kann die App Solargewinn nur indirekt aus Temperaturanstiegen ableiten. Mit direkter Strahlungsmessung wird der **g-Faktor 30-40% genauer** bestimmt.
>
> | Quelle | g-Faktor Genauigkeit | Anmerkung |
> |--------|----------------------|-----------|
> | **Mit Strahlungssensor** | ±15% | Direkte Einstrahlungsmessung |
> | **Ohne Sensor** | ±40-50% | Abgeleitet aus Temp-Deltas |
>
> **Auswirkung:**
>
> - Gebäudemodell: g-Faktor repräsentiert tatsächliche Glasfläche und Ausrichtung
> - Vorhersagen: Bessere Antizipation sonniger Perioden
> - Energieeinsparung: Bis zu 5-10% Reduktion des Heizbedarfs an sonnigen Tagen
>
> **Fazit:** Externe Kopplung ist *optional*, bietet aber deutlich bessere Solargewinn-Modellierung.

---

### 1.6 Externe Windgeschwindigkeit Koppeln (für Gebäudemodell Windkorrektur)

Koppeln Sie einen Windgeschwindigkeitssensor (z.B. KNMI) für präzise Berechnung windbedingter Wärmeverluste.

![KNMI Windgeschwindigkeit Setup](../images/Setup%20-%20KNMI%20windsnelheid%20kmh.png)

**So richten Sie es ein:**
```
WENN: [KNMI] Windgeschwindigkeit hat sich geändert
DANN: [Intelligent Heat Pump] Sende Windgeschwindigkeit {{Windgeschwindigkeit}} km/h an Wärmepumpe
```

**Was dies freischaltet:**

- ✅ W_corr Parameter im Gebäudemodell (Windkorrekturfaktor)
- ✅ Dynamische UA-Korrektur bei starkem Wind (+20-50% zusätzlicher Wärmeverlust)
- ✅ Bessere Vorhersage des Wärmebedarfs bei Sturm
- ✅ Genauere τ (Zeitkonstante) Berechnung

> [!NOTE]
> **Einfluss von Wind auf Wärmeverluste:**
>
> Wind erhöht Wärmeverluste durch **konvektive Kühlung** der Fassaden. Bei Sturm (>50 km/h) können Wärmeverluste **20-50% höher** sein als bei Windstille.
>
> | Windgeschwindigkeit | Extra Wärmeverlust | W_corr typisch |
> |---------------------|--------------------|--------------: |
> | 0-10 km/h | Vernachlässigbar | 0.00-0.03 |
> | 10-30 km/h | +5-15% | 0.03-0.07 |
> | 30-50 km/h | +15-30% | 0.07-0.10 |
> | >50 km/h | +30-50% | 0.10-0.12 |
>
> **Funktionen ohne Windkorrektur:**
>
> - Gebäudemodell funktioniert noch, aber UA-Wert ist Durchschnitt ohne Windkorrektur
> - Bei Stürmen kann Vorhersage 10-20% abweichen
>
> **Fazit:** Externe Kopplung ist *optional*, bietet aber deutlich bessere Vorhersagen bei wechselndem Wind.

---

### 1.7 Externes Solarpanel-Leistung Koppeln (für Sonnenstrahlungsberechnung)

Koppeln Sie Ihren Solarwechselrichter (z.B. SolarEdge, Enphase) für präzise Sonnenstrahlungsberechnung basierend auf aktueller PV-Leistung.

![PV aktuelle Leistung Setup](../images/Setup%20-%20PV%20actueel%20vermogen.png)

**So richten Sie es ein:**
```
WENN: [SolarEdge] Die Leistung hat sich geändert
DANN: [Intelligent Heat Pump] Sende Solarleistung {{Leistung}}W an Wärmepumpe
```

**Was dies freischaltet:**

- ✅ Berechnung der Sonnenstrahlung aus PV-Leistung und Panel-Spezifikationen
- ✅ Alternative zu direktem Strahlungssensor (falls nicht verfügbar)
- ✅ Präzise g-Faktor Bestimmung im Gebäudemodell
- ✅ Optimale Solargewinn-Modellierung

> [!NOTE]
> **Sonnenstrahlung aus PV-Leistung ableiten:**
>
> Die App kann Sonnenstrahlung **berechnen** aus der aktuellen Leistung Ihrer Solarpanels:
>
> **Formel:** `Strahlung (W/m²) = PV-Leistung (W) / (Panel-Fläche (m²) × Wirkungsgrad (%))`
>
> **Beispiel:**
>
> - 10 Panels von 1,7m² mit 20% Wirkungsgrad = 3,4 m² effektive Fläche
> - Bei 2000W PV-Leistung → Strahlung = 2000 / 3,4 = ~588 W/m²
>
> **Vorteile vs. direkter Strahlungssensor:**
>
> - ✅ Kein zusätzlicher Sensor erforderlich (nutzt vorhandenes PV-Monitoring)
> - ✅ Repräsentiert tatsächliche Strahlung an Ihrem Standort und Ausrichtung
> - ⚠️ Jedoch weniger genau bei verschmutzten Panels oder Schatten
>
> **Wahl zwischen PV-Leistung und Strahlungssensor:**
>
> | Situation | Beste Wahl |
> |-----------|-------------|
> | Solarpanels verfügbar | PV-Leistung (pragmatisch) |
> | Keine Solarpanels | KNMI Strahlungssensor |
> | Optimale Genauigkeit | Beide koppeln (App nutzt beste Quelle) |
>
> **Fazit:** PV-Leistung ist eine *intelligente alternative Quelle* für Sonnenstrahlungsdaten.

---

### 1.8 Übersicht: Funktionen und Abhängigkeiten

Das untenstehende Diagramm zeigt die Beziehung zwischen erweiterten Funktionen und ihren erforderlichen Datenquellen.

![Feature Dependencies Diagram](../images/feature_dependencies.png)

**Legende:**
| Farbe | Bedeutung |
|-------|-----------|
| 🔵 **Blau** | Funktionen (aktivierbar über Einstellungen) |
| 🟢 **Grün** | Externe Datenquellen (über Flow-Karten) |
| ⚫ **Grau** | Interne Capabilities |

**Pfeile:**
- **Durchgezogene Linie** → Erforderliche Abhängigkeit
- **Gestrichelte Linie** → Optionale/verbessernde Abhängigkeit

**Wichtige Erkenntnisse:**
1. **Adaptive Temperature Control** ist der Kern - benötigt Innentemperatur und Zieltemperatur
2. **Energy Price Optimizer** und **COP Optimizer** bauen auf Adaptive Control auf
3. **Building Model Learning** benötigt Innentemperatur + Außentemperatur
4. **Building Insights** erfordert zuerst ein funktionierendes Building Model
5. **Weight Calculator** kombiniert alle vier Optimizer plus Coast-Strategie für Entscheidungen
6. **Coast-Strategie** (v2.8.0+) erkennt Überschwingung und stoppt Heizung passiv

---

## Teil 2: Erweiterte Flow-Karten-Funktionen (Demo-Beispiele)

Nach dem Verbinden externer Daten können Sie leistungsstarke Rechner-Flow-Karten nutzen.

### 2.1 Kurvenrechner - Witterungskompensation

Berechnen Sie automatisch die optimale Vorlauftemperatur basierend auf der Außentemperatur mit einer Heizkurve.

![Kurvenrechner Demo](../images/Curve%20calculator.png)

**So funktioniert es:**
```
WENN: [Aqara] Temperatur hat sich geändert
DANN: [Intelligent Heat Pump] Berechne Wert für {{Temperatur}} 
     mit Kurve: -10:35, -5:30, 0:27, 5:26, 10:25, 15:24, 20:22..., Standard: 35
DANN: [Timeline] Erstelle Benachrichtigung mit Heizwert: {{Berechneter Wert}} 
     für Außentemperatur: {{Temperatur}}
```

**Kurvendefinition erklärt:**
| Außentemp | Vorlauftemp |
|-----------|-------------|
| -10°C | 35°C |
| -5°C | 30°C |
| 0°C | 27°C |
| +10°C | 25°C |
| +20°C | 22°C |

**Anwendungen:**
- 🌡️ Witterungskompensation Heizkurve (L28/L29 Parameter)
- 🏠 Energieeinsparung durch niedrigere Vorlauftemperaturen bei mildem Wetter
- ⚡ Interpolation zwischen Punkten für sanfte Übergänge

---

### 2.2 Benutzerdefinierte Heizkurve - Lineare Berechnung

Berechnen Sie eine Heizkurve mit einer mathematischen Formel (y = ax + b), perfekt für Adlar L28/L29 Parameter.

![Benutzerdefinierte Heizkurve Demo](../images/custom%20stooklijn.png)

**So funktioniert es:**
```
WENN: Aktuelle Temperatur hat sich geändert
DANN: [Intelligent Heat Pump] Berechne Heizkurve: L29=55°C bei -15°C, L28=-5/10°C mit Außentemperatur
DANN: [Timeline] Erstelle Benachrichtigung mit benutzerdefinierter Heizkurve:
     {{Raumtemperatur}} mit Formel: {{Heizkurvenformel}} 
     von {{Alter Wert}} nach {{Neuer Wert}}
```

**Formelerklärung:**
- **L29**: Referenztemperatur (55°C bei -15°C Außentemperatur)
- **L28**: Steigung (-5°C pro 10°C Temperaturdifferenz)
- **Ergebnis**: `y = -0.5x + 47.5` → bei 0°C außen = 47.5°C Vorlauf

**Anwendungen:**
- 📐 Exakte Nachbildung der Adlar Heizkurvenparameter
- 🔧 Echtzeit-Anpassung über Flows
- 📊 Formel-Protokollierung für Analyse

---

### 2.3 Zeitfenster mit Variablen - Tagesprogrammierung

Berechnen Sie Werte aus Zeitperioden mit Unterstützung für dynamische Variablen.

![Zeitfenster mit Variablen Demo](../images/tijdsloten%20met%20vars.png)

**So funktioniert es:**
```
WENN: Alle 5 Minuten
DANN: [Intelligent Heat Pump] Berechne Wert aus Zeitperioden:
     00:00-20:00: {{Energiepreis}} +1}}
     20:00-23:59: {{Automatisierungsnummer}} +1}}
DANN: [Timeline] Erstelle Benachrichtigung mit Wert um {{Zeit}} ist: {{Ergebniswert}}
```

**Beispielergebnisse (aus dem Bild):**
| Zeit | Ergebnis | Quelle |
|------|----------|--------|
| 20:01 | 1.2445 | Energiepreis + 1 |
| 20:05 | 1.256 | Energiepreis + 1 |
| 19:58 | 1.256 | Automatisierungsnummer + 1 |

**Anwendungen:**
- ⏰ Tag/Nacht Temperaturprogrammierung
- 💰 Dynamische Preisberechnungen pro Zeitfenster
- 🏠 Komfort vs. Sparprogramme
- 📅 Wochenend- vs. Werktags-Zeitpläne

---

## Zusammenfassung: Was Schaltet Was Frei?

| Externe Daten | Freigeschaltete Funktionen |
|---------------|-----------------------------|
| **Leistung** (kWh-Zähler) | COP-Berechnung, Effizienz-Trends, COP-Optimierung |
| **Innentemperatur** (Sensor) | Adaptive Regelung, Gebäudemodell, Building Insights |
| **Außentemperatur** (Wetter) | Thermisches Modell, Witterungskompensation, Saisonanpassung |
| **Energiepreise** (dynamisch) | Preisoptimierung, Vorheizen, Kosteneinsparung |
| *Keine extra Daten* | **Coast-Strategie** (v2.8.0+): passive Kühlung bei Überschwingung |

---

## Nächste Schritte

1. **Beginnen Sie mit COP**: Verbinden Sie zuerst das Leistungsmessgerät für sofortige Einblicke
2. **Aktivieren Sie Adaptive Regelung**: Verbinden Sie den Innentemperatursensor
3. **Fügen Sie Wetterdaten hinzu**: Für bessere Vorhersagen
4. **Aktivieren Sie Preisoptimierung**: Maximale Einsparungen mit dynamischen Tarifen

---

*Siehe auch:*
- [Konfigurationshandbuch](../advanced-settings/CONFIGURATION_GUIDE.de.md) - Alle Einstellungen erklärt
- [Flow Cards Guide](../guide/FLOW_CARDS_GUIDE.de.md) - Vollständige Flow-Karten-Dokumentation
- [Adaptive Control Guide](../guide/ADAPTIVE_CONTROL_GUIDE.de.md) - Ausführliche Erklärung der adaptiven Regelung

---

*Letzte Aktualisierung: 2026-03-19*
*Version: 2.8.x*
