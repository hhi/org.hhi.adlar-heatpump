# Modbus-Diagnose- und Dashboard-Leitfaden (Adlar Castra Aurora)

Dieser Leitfaden beschreibt die integrierten lokalen Diagnose- und Servicewerkzeuge des **Modbus-Treibers** in der Adlar Castra Homey-App.

---

## 1. Übersicht

Der Modbus-Treiber (`intelligent-heatpump-modbus`) enthält einen optionalen lokalen HTTP-Dienst für detaillierte Diagnosen, Live-Überwachung und erweiterte Registerprüfungen. Dieses Tool läuft direkt auf Ihrem Homey Pro und ist über Ihren lokalen Webbrowser erreichbar.

### Wichtigste Funktionen
- **100 % lokal**: Keine externe Cloud-Verbindung erforderlich.
- **Echtzeit-Überwachung**: Live-Anzeige aller gemessenen Temperaturen, Druckwerte, Lüfterdrehzahlen und Kompressorzustände.
- **Heizkurven-Editor**: Visuelle Optimierung und Simulation Ihrer Heizkurve.
- **Registerprüfung**: Detaillierter Einblick in Modbus-Holding-Register und Coils (P- und L-Parameter).

---

## 2. Zugriff und Konfiguration

### Port-Konfiguration
Standardmäßig ist der HTTP-Dienst auf Port **8090** aktiv. Sie können diesen Port in der Homey-App ändern:
1. Öffnen Sie die Homey-App auf Ihrem Smartphone oder Computer.
2. Navigieren Sie zu Ihrem Modbus-Wärmepumpengerät.
3. Öffnen Sie **Geräteeinstellungen** (Zahnrad-Symbol) → **Erweiterte Einstellungen**.
4. Suchen Sie den Abschnitt **Lokale Dashboards** und passen Sie den **Dashboard-Port** an, falls Port 8090 bereits belegt ist.

### Dashboard öffnen
Öffnen Sie einen Webbrowser auf einem beliebigen Gerät im selben lokalen Netzwerk und rufen Sie auf:

```text
http://<homey-ip>:8090/
```

*(Ersetzen Sie `<homey-ip>` durch die lokale IP-Adresse Ihres Homey Pro, z. B. `http://192.168.1.50:8090/`)*

---

## 3. Verfügbare Ansichten und Endpunkte

| Endpunkt | Beschreibung | Zweck |
|---|---|---|
| `/` | **Live-Übersicht** | Hauptübersicht mit Echtzeitstatus, Temperaturen, Leistung und COP. |
| `/interactive` | **Interaktive Steuerung** | Übersicht mit direkter Anpassung von Sollwerten und Betriebsmodi. |
| `/live` | **Capabilities nach Kategorie** | Alle aktiven Homey-Capabilities nach Kategorien gegliedert. |
| `/expert` | **Experten-Registeransicht** | Vollständige Modbus-Registertabelle mit Lese- und Schreibwerkzeugen. |
| `/changelog` | **Registeränderungen** | Echtzeit-Protokoll der Registeränderungen und Polling-Empfehlungen. |
| `/heating-curve` | **Heizkurven-Editor** | Visueller Simulator und Editor für individuelle Heizkurven. |

---

## 4. Sicherheitshinweise für Experten-Werkzeuge

> [!WARNING]
> **Vorsicht beim Schreiben von Registern**
> Das manuelle Ändern von Modbus-Registern über die `/expert`-Ansicht beeinflusst direkt das Verhalten der Wärmepumpensteuerung.
> - Ändern Sie Register nur, wenn Sie mit der technischen Dokumentation von Adlar vertraut sind.
> - Notieren Sie vor jeder Änderung stets den ursprünglichen Registerwert.
> - Das Registermapping des Modbus-Treibers ist primär für die R32-Serie optimiert.
