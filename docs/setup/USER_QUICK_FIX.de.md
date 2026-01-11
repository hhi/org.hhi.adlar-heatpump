# Schnellhilfe bei ECONNRESET-Verbindungsproblemen

## 🚨 Für Benutzer mit Verbindungsresets

Wenn Ihre Wärmepumpe ständig die Verbindung trennt und ECONNRESET-Fehler auftreten, liegt das Problem wahrscheinlich an einer **Protokollversions-Inkompatibilität**.

## ✅ Lösung: Protokollversion auf 3.4 ändern

### Schritte (dauert 2 Minuten):

1. Öffnen Sie die **Homey-App** → Gehen Sie zu Ihrem Wärmepumpengerät
2. Tippen Sie auf **⚙️ Einstellungen** (oben rechts)
3. Scrollen Sie nach **oben** zum Abschnitt Verbindungseinstellungen
4. Aktualisieren Sie Ihre Einstellungen:
   - **Protokollversion: WÄHLEN SIE 3.4** ← **ÄNDERN SIE DIES**
   - Geräte-ID: *(unverändert lassen oder bei Bedarf aktualisieren)*
   - Lokaler Schlüssel: *(unverändert lassen oder bei Bedarf aktualisieren)*
   - IP-Adresse: *(unverändert lassen oder bei Bedarf aktualisieren)*
5. Tippen Sie auf **Speichern**
6. Warten Sie 1-2 Minuten auf die Wiederverbindung

### Erwartetes Ergebnis:
- ✓ Verbindungsstatus zeigt "verbunden"
- ✓ Keine ECONNRESET-Fehler mehr
- ✓ Sensordaten werden reibungslos aktualisiert
- ✓ Gerät bleibt verbunden

### Funktioniert immer noch nicht?
Versuchen Sie Protokollversion **3.5** mit den gleichen Schritten (ändern Sie die Protokollversion in den Einstellungen auf 3.5).

### Warum passiert das?
Verschiedene Wärmepumpenmodelle verwenden unterschiedliche Tuya-Protokollversionen. Die App hatte zuvor standardmäßig 3.3 eingestellt, aber viele neuere Modelle benötigen 3.4 oder 3.5.

---
