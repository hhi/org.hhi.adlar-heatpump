# Leitfaden zur Fehlerbehebung bei Protokollversionen

## Für Benutzer mit ECONNRESET- oder Verbindungsproblemen

Wenn Sie häufige Verbindungsresets, Verbindungsabbrüche oder wiederholt nicht verfügbare Geräte erleben, kann das Problem durch eine **Protokollversions-Inkompatibilität** zwischen der App und Ihrem Wärmepumpengerät verursacht werden.

### Symptome einer Protokollversions-Inkompatibilität

- ✗ Häufige "ECONNRESET"-Fehler in den Logs
- ✗ Gerät verbindet sich ständig neu (Status zeigt "Wiederverbinden")
- ✗ Gerät wird wiederholt nicht verfügbar
- ✗ Verbindung funktioniert kurz und fällt dann aus
- ✗ App scheint abzustürzen oder nicht mehr zu reagieren

### So beheben Sie das Problem: Aktualisieren Sie Ihre Protokollversion

#### Schritt 1: Bestimmen Sie die Protokollversion Ihres Geräts

Die meisten Adlar/Castra-Wärmepumpen verwenden Protokollversion **3.3** (Standard), aber einige neuere Modelle benötigen **3.4** oder **3.5**.

**Wenn Sie unsicher sind, welche Version Ihr Gerät verwendet:**
- Prüfen Sie Ihr Gerätehandbuch oder die Spezifikationen
- Kontaktieren Sie den Adlar-Support mit Ihrer Gerätemodellnummer
- Probieren Sie die Versionen der Reihe nach aus: zuerst 3.4 (häufigste Alternative), dann 3.5

#### Schritt 2: Protokollversion in den Geräteeinstellungen aktualisieren

1. **Öffnen Sie die Homey-App** auf Ihrem Smartphone/Tablet
2. **Navigieren Sie zu Ihrem Wärmepumpengerät**
3. **Tippen Sie auf das Einstellungssymbol (Zahnrad)** oben rechts
4. **Scrollen Sie nach oben** zum Abschnitt Verbindungseinstellungen
5. **Aktualisieren Sie Ihre Geräteanmeldedaten:**
   - **Protokollversion** ← **WÄHLEN SIE HIER DIE RICHTIGE VERSION**
     - Versuchen Sie **3.4**, wenn Sie Verbindungsprobleme haben
     - Versuchen Sie **3.5**, wenn 3.4 nicht funktioniert
   - Geräte-ID (unverändert lassen oder bei Bedarf aktualisieren)
   - Lokaler Schlüssel (unverändert lassen oder bei Bedarf aktualisieren)
   - IP-Adresse (unverändert lassen oder bei Bedarf aktualisieren)
6. **Tippen Sie auf "Speichern"** und warten Sie auf die Wiederverbindung

#### Schritt 3: Verbindung überprüfen

Nach dem Aktualisieren der Einstellungen:
- Überprüfen Sie den Gerätestatus - er sollte innerhalb von 1-2 Minuten "verbunden" anzeigen
- Überprüfen Sie die Verbindungsstatus-Capability: `adlar_connection_status`
- Überwachen Sie 10-15 Minuten lang, um eine stabile Verbindung sicherzustellen
- Wenn immer noch Probleme auftreten, versuchen Sie eine andere Protokollversion

### Protokollversions-Referenz

| Version | Häufiger Anwendungsfall |
|---------|------------------------|
| **3.3** | Ältere Adlar/Aurora-Modelle (STANDARD) |
| **3.4** | Neuere Adlar-Modelle, häufigste Alternative |
| **3.5** | Neueste Modelle, weniger häufig |

### Erfolgsindikatoren

✓ Verbindungsstatus zeigt "verbunden" und bleibt verbunden
✓ Keine ECONNRESET-Fehler in den Logs
✓ Sensordaten werden regelmäßig aktualisiert (alle 20-30 Sekunden)
✓ Gerätebefehle funktionieren sofort
✓ Keine "nicht verfügbar"-Meldungen

### Haben Sie immer noch Probleme?

Wenn Sie alle drei Protokollversionen ausprobiert haben und immer noch Verbindungsprobleme haben:

1. **Netzwerkkonnektivität überprüfen:**
   - Wärmepumpe hat stabile WLAN-/LAN-Verbindung
   - Homey kann die IP-Adresse der Wärmepumpe erreichen
   - Keine Firewall blockiert die Kommunikation

2. **Geräteanmeldedaten prüfen:**
   - Geräte-ID ist korrekt
   - Lokaler Schlüssel hat sich nicht geändert
   - IP-Adresse ist aktuell (hat sich nicht über DHCP geändert)

3. **Support kontaktieren:**
   - Teilen Sie mit, welche Protokollversionen Sie ausprobiert haben
   - Teilen Sie Fehler-Logs von Homey
   - Geben Sie Ihre Gerätemodellnummer an

## Für neue Gerätekopplung

Beim Koppeln eines neuen Geräts sehen Sie jetzt das Dropdown-Menü für die Protokollversion:

1. Geben Sie Geräte-ID, Lokaler Schlüssel und IP-Adresse ein
2. **Protokollversion auswählen:**
   - **3.3 (Standard)** - Beginnen Sie hier für die meisten Geräte
   - **3.4** - Versuchen Sie diese, wenn 3.3 Verbindungsprobleme hat
   - **3.5** - Versuchen Sie diese, wenn 3.4 Verbindungsprobleme hat
3. Fahren Sie mit der Kopplung fort

**Tipp:** Wenn Sie unsicher sind, beginnen Sie mit 3.3. Sie können es später in den Geräteeinstellungen immer ändern.

## Technischer Hintergrund

Die Tuya-Protokollversion bestimmt, wie die App auf Netzwerkebene mit Ihrem Gerät kommuniziert. Die Verwendung der falschen Version verursacht:
- Fehlerhafte Netzwerkpakete
- Socket-Verbindungsfehler (ECONNRESET)
- Authentifizierungsfehler
- Datenbeschädigung

Verschiedene Wärmepumpenmodelle/Firmware-Versionen benötigen unterschiedliche Protokollversionen. Es schadet nicht, verschiedene Versionen auszuprobieren - aktualisieren Sie einfach die Protokollversion in den Geräteeinstellungen, um zu wechseln.

## Versionsverlauf

- **v0.99.62** - Reparaturablauf entfernt, Anmeldedaten jetzt direkt in Geräteeinstellungen bearbeitbar
- **v0.99.59** - Protokollversionsauswahl während der Kopplung hinzugefügt
- **v0.99.58 und früher** - Fest auf Version 3.3 eingestellt (verursachte Probleme für einige Benutzer)

---

**Benötigen Sie Hilfe?** Melden Sie Probleme unter: https://github.com/your-repo/issues
