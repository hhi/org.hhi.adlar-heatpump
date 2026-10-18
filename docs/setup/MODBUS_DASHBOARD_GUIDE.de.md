# Modbus-Diagnose- und Dashboard-Leitfaden (Adlar Castra Aurora)

Dieser Leitfaden beschreibt die integrierten lokalen Diagnose- und Servicewerkzeuge der **Modbus-Treiber** in der Adlar Castra Homey-App: des Aurora II-Treibers und des Aurora III-Treibers.

---

## 1. Übersicht

Beide Modbus-Treiber (`intelligent-heatpump-modbus` für Aurora II, `intelligent-heatpump-aurora3` für Aurora III) enthalten einen optionalen lokalen HTTP-Dienst für detaillierte Diagnosen, Live-Überwachung und erweiterte Registerprüfungen. Dieses Tool läuft direkt auf Ihrem Homey Pro und ist über Ihren lokalen Webbrowser erreichbar. Jedes Modell hat einen eigenen Dashboard-Server auf einem eigenen Port.

### Wichtigste Funktionen
- **100 % lokal**: Keine externe Cloud-Verbindung erforderlich.
- **Echtzeit-Überwachung**: Live-Anzeige aller gemessenen Temperaturen, Druckwerte, Lüfterdrehzahlen und Kompressorzustände.
- **Heizkurven-Editor** (nur Aurora II): Visuelle Optimierung und Simulation Ihrer Heizkurve.
- **Registerprüfung**: Detaillierter Einblick in Modbus-Register (P- und L-Parameter bei Aurora II, Input- und Holding-Register bei Aurora III).

---

## 2. Zugriff und Konfiguration

### Port-Konfiguration

| Modell | Standard-Port |
|---|---|
| Aurora II | **8090** |
| Aurora III | **8091** |

Der Dashboard-Server startet, sobald ein Gerät dieses Modells gekoppelt ist. Sie können den Port in der Homey-App ändern:
1. Öffnen Sie die Homey-App auf Ihrem Smartphone oder Computer.
2. Navigieren Sie zu Ihrem Modbus-Wärmepumpengerät.
3. Öffnen Sie **Geräteeinstellungen** (Zahnrad-Symbol) → **Erweiterte Einstellungen**.
4. Suchen Sie den Abschnitt **Lokale Dashboards** und passen Sie den **Dashboard-Port** an, falls der Port bereits belegt ist.

Wählen Sie für beide Modelle nicht denselben Port: Dann startet nur der erste Dashboard-Server.

### Dashboard öffnen
Öffnen Sie einen Webbrowser auf einem beliebigen Gerät im selben lokalen Netzwerk und rufen Sie auf:

```text
http://<homey-ip>:8090/   (Aurora II)
http://<homey-ip>:8091/   (Aurora III)
```

*(Ersetzen Sie `<homey-ip>` durch die lokale IP-Adresse Ihres Homey Pro, z. B. `http://192.168.1.50:8090/`)*

---

## 3. Verfügbare Ansichten und Endpunkte

| Endpunkt | Beschreibung | Zweck | Aurora II | Aurora III |
|---|---|---|---|---|
| `/` | **Live-Übersicht** | Hauptübersicht mit Echtzeitstatus, Temperaturen, Leistung und COP. | ✓ | ✓ |
| `/interactive` | **Interaktive Steuerung** | Übersicht mit direkter Anpassung von Sollwerten und Betriebsmodi. Bei Aurora III auch Warmwasserfunktion, Leisemodus, Zusatzheizung und (experimentell) Ein/Aus. | ✓ | ✓ |
| `/live` | **Capabilities nach Kategorie** | Alle aktiven Homey-Capabilities nach Kategorien gegliedert. | ✓ | ✓ |
| `/expert` | **Experten-Registeransicht** | Vollständige Modbus-Registertabelle mit Lese- und Schreibwerkzeugen. | ✓ | ✓ |
| `/changelog` | **Registeränderungen** | Echtzeit-Protokoll der Registeränderungen und Polling-Empfehlungen. | ✓ | ✓ |
| `/heating-curve` | **Heizkurven-Editor** | Visueller Simulator und Editor für individuelle Heizkurven. | ✓ | — |

---

## 4. Sicherheitshinweise für Experten-Werkzeuge

> [!WARNING]
> **Vorsicht beim Schreiben von Registern**
> Das manuelle Ändern von Modbus-Registern über die `/expert`-Ansicht beeinflusst direkt das Verhalten der Wärmepumpensteuerung.
> - Ändern Sie Register nur, wenn Sie mit der technischen Dokumentation von Adlar vertraut sind.
> - Notieren Sie vor jeder Änderung stets den ursprünglichen Registerwert.
> - Das Registermapping des Aurora II-Treibers ist primär für die R32-Serie optimiert.

> [!IMPORTANT]
> **Kein Passwort für die Dashboards**
> Die Dashboards sind ohne Anmeldung für jedes Gerät in Ihrem lokalen Netzwerk erreichbar, einschließlich der Schreibfunktionen. Mit einem Gerät jedes Modells sind zwei solcher Ports offen. Verwenden Sie die Dashboards nur in einem vertrauenswürdigen Netzwerk und machen Sie sie nicht aus dem Internet erreichbar.
