# Umstieg auf den Aurora III-Treiber

Dieser Leitfaden richtet sich an Nutzer der separaten App **Adlar Castra Wärmepumpe (Aurora-III Modbus)**. Ab Version 3.2.0 ist die Aurora III-Unterstützung Teil der App **Adlar Castra Wärmepumpe**, als Treiber *Aurora III über Modbus*.

Homey kann Geräte nicht von einer App in eine andere verschieben. Umsteigen bedeutet: das Gerät in der neuen App erneut koppeln und die Flows neu aufbauen.

## Was verloren geht

- **Flows**: Flows mit Karten der alten App müssen neu aufgebaut werden.
- **Einstellungen**: Die Geräteeinstellungen werden nicht übernommen.
- **Insights**: Der Verlauf des alten Geräts wird nicht auf das neue Gerät übertragen.

## Schritt 1 — Vorbereiten

1. Notieren Sie die Geräteeinstellungen des alten Geräts, die Sie geändert haben (zum Beispiel Abfrageintervalle, adaptive Regelung, Energiepreise, Leistungsmessung).
2. Notieren Sie, welche Flows das alte Gerät verwenden. Ein Screenshot pro Flow hilft beim Neuaufbau.
3. Notieren Sie IP-Adresse, TCP-Port und Modbus-Unit-ID des Gateways.

## Schritt 2 — Alte App stilllegen

Lassen Sie die alte App und den neuen Treiber **nicht gleichzeitig** mit derselben Wärmepumpe kommunizieren. Beide würden dann über dasselbe Gateway abfragen und schreiben (Sollwerte, adaptive Regelung), mit dem Risiko von Zeitüberschreitungen und widersprüchlichen Befehlen.

Erledigen Sie daher zuerst eines von beiden:

- entfernen Sie das Gerät aus der alten App, oder
- schalten Sie in der alten App die adaptive Regelung und alle Flows aus, die auf die Wärmepumpe schreiben.

## Schritt 3 — In der neuen App koppeln

1. Installieren oder aktualisieren Sie die App **Adlar Castra Wärmepumpe** auf Version 3.2.0 oder höher.
2. Fügen Sie ein Gerät hinzu und wählen Sie **Aurora III über Modbus**. Wählen Sie nicht *Aurora I/II über Modbus*: Er verwendet andere Registeradressen.
3. Geben Sie IP-Adresse, TCP-Port und Modbus-Unit-ID des Gateways ein.
4. Stellen Sie die notierten Einstellungen in den Geräteeinstellungen wieder her.

Die Gateway-Einstellungen ändern sich nicht. Für Aurora III bleibt es `9600 8N2` mit `Serial protocol` = `Modbus`; siehe den [Elfin-Leitfaden](modbus-elfin-ew11-setup.md) (Niederländisch).

## Schritt 4 — Flows neu aufbauen

Bauen Sie die Flows mit dem neuen Gerät neu auf. Die Karten haben dieselben Titel wie in der alten App. Im Flow-Editor zeigt jedes Gerät die Karten seines eigenen Treibers; wählen Sie also immer das Aurora III-Gerät.

Neu, nur für Aurora III: Leisemodus einstellen, Warmwasserfunktion schalten, erzwungene Zusatzheizung schalten sowie die Bedingungen *Warmwasser wird bereitet* und *Leisemodus ist*. Siehe den [Flow-Karten-Leitfaden](guide/FLOW_CARDS_GUIDE.de.md).

## Schritt 5 — Dashboards

Das lokale Dashboard des Aurora III-Treibers läuft standardmäßig auf Port **8091** (die alte App verwendete 8090):

```text
http://<homey-ip>:8091/
```

Siehe den [Dashboard-Leitfaden](MODBUS_DASHBOARD_GUIDE.de.md).

## Schritt 6 — Alte App entfernen

Wenn in der neuen App alles funktioniert, entfernen Sie die alte App **Adlar Castra Wärmepumpe (Aurora-III Modbus)**.
