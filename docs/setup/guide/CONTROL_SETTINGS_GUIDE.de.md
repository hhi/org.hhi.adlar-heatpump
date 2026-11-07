# Adaptive Regelung einrichten

Eine Anleitung zu den Einstellungen der adaptiven Regelung: den sechs Gruppen,
deren Titel mit **Adaptive Regelung** beginnt. Welche Wahl Sie treffen, welche
Einstellungen dabei zählen und welche Sie stehen lassen können. Gilt für
Version 3.6.2 und für alle drei Treiber (Tuya, Aurora I/II und
Aurora III); Unterschiede stehen unter [Unterschiede je
Treiber](#unterschiede-je-treiber).

## Inhalt

- [Kurz gesagt](#kurz-gesagt)
- [Schritt für Schritt](#schritt-für-schritt)
- [Welche Einstellung in welchem Regelmodus zählt](#welche-einstellung-in-welchem-regelmodus-zählt)
- [Klassisch und Positionell](#klassisch-und-positionell)
- [Die Heizkurve bei Positionell](#die-heizkurve-bei-positionell)
- [Coast](#coast)
- [Die Einstellungen einzeln](#die-einstellungen-einzeln)
- [Außentemperatur](#außentemperatur)
- [Unterschiede je Treiber](#unterschiede-je-treiber)
- [Fragen](#fragen)

## Kurz gesagt

- Die App berechnet alle 5 Minuten eine **Empfehlung** für die
  Wassertemperatur. Sie sehen sie in **Simulierte Zieltemperatur**
  (`adlar_simulated_target`).
- Die Empfehlung ändert nichts an der Wärmepumpe. Erst ein Flow, der die
  Empfehlung ausführt, macht daraus eine Regelung.
- Die Wärmepumpe hält einen von außen gesetzten Sollwert nur, wenn ihre eigene
  Heizkurvenwahl auf **OFF** steht (Aurora I/II: Heizkurvenwahl; Tuya:
  Heizkurve).
- Mit dem **Regelmodus** wählen Sie, wie die Empfehlung berechnet wird. In jedem
  Modus zählt nur ein Teil der Einstellungen; den Rest können Sie stehen lassen.

## Schritt für Schritt

### 1. Voraussetzungen

- Ein Flow, der alle paar Minuten die Raumtemperatur mit der Karte
  **Raumtemperatur an Wärmepumpe senden** schickt. Ohne Raumtemperatur startet
  die Regelung nicht.
- Schalten Sie **Adaptive Regelung ein** ein. Ist sie aus, wird keine
  Empfehlung berechnet und die übrigen Einstellungen zählen nicht.
- Das Raumziel ist **Gewünschte Innentemperatur** am Gerät. Sie stellen es dort
  ein oder mit der Karte **Gewünschte Innentemperatur einstellen** (15–25 °C).
  Ohne Raumziel wird jeder Zyklus übersprungen.

### 2. Nur Empfehlung oder wirklich regeln?

| Sie möchten | Was Sie tun |
| --- | --- |
| Erst sehen, was die App tun würde | Kein ausführender Flow. Lassen Sie die Heizkurvenwahl der Wärmepumpe, wie sie ist |
| Die App regeln lassen | Ein Flow mit dem Auslöser **Adaptive Regelung empfiehlt Temperaturanpassung**, der die Zieltemperatur der Wärmepumpe auf `recommended_temperature` setzt. Stellen Sie die Heizkurvenwahl der Wärmepumpe auf **OFF** |

Beobachten Sie in beiden Fällen zuerst einen Tag lang. Vergleichen Sie die
Empfehlung mit dem, was die Wärmepumpe jetzt selbst tut.

Bei Positionell ohne ausführenden Flow steht der I-Anteil still, sobald der
Sollwert der Wärmepumpe um mehr als 1 °C von der Empfehlung abweicht. Sie sehen
dann vor allem die Heizkurve plus den P-Anteil, nicht, wie die Regelung auf
Dauer nachsteuert.

### 3. Regelmodus wählen

| Situation | Regelmodus |
| --- | --- |
| Sie regeln bereits mit der App und es funktioniert gut | Klassisch |
| Heizkörper oder Gebläsekonvektoren, Sollwert driftet weg oder schwingt | Positionell – Heizkörper |
| Fußbodenheizung, Sollwert driftet weg oder schwingt | Positionell – Fußbodenheizung |
| Gemischt: Fußboden und Heizkörper | Positionell – Fußbodenheizung, wenn der Fußboden die größte oder trägste Abgabe ist, sonst – Heizkörper |
| Sie möchten Kp, Ti oder Coast selbst wählen | Positionell – Manuell |

Die positionellen Modi sind **experimentell**: in der Simulation besser als
Klassisch, in der Praxis noch wenig getestet. Zurückstellen ist jederzeit
möglich.

### 4. Heizkurve wählen (nur Positionell)

| Was die Wärmepumpe jetzt verwendet | Was Sie wählen |
| --- | --- |
| Eine feste Kurve (HH1–HH8, HL1–HL8; Tuya H1–H8, L1–L8) | **Einmalig in die App-Kurve übernehmen** → diese Kurve. Danach die Heizkurvenwahl auf OFF |
| Eine eigene DIY-Heizkurve (Aurora I/II, L28/L29) | Einmal übernehmen mit **Einmalig in die App-Kurve übernehmen** → **DIY-Heizkurve**, oder laufend folgen mit **Grundlage der Empfehlung** → **Heizkurve der Wärmepumpe (laufend gefolgt)**. Siehe [Einmal übernehmen oder laufend folgen](#einmal-übernehmen-oder-laufend-folgen) |
| Weiß ich nicht | Nichts: Die App füllt bei der Wahl des Regelmodus eine Startkurve aus |

### 5. Grenzen

Stellen Sie **Niedrigste** und **Höchste Wassertemperatur in der Empfehlung** ein. Bei
Fußbodenheizung: um den Bereich Ihrer eigenen Heizkurve herum, zum Beispiel 2 °C
darunter und 3 °C darüber, mit Spielraum für kaltes Wetter.

### 6. Prüfen

- **Simulierte Zieltemperatur**: Folgt die Empfehlung der Außentemperatur etwa
  wie Ihre Heizkurve?
- **Adaptive Steuerungsdiagnostik** (`adaptive_control_diagnostics`): zeigt den
  Modus, Kp und Ti mit ihrer Quelle, die Basis (Heizkurve) mit ihrer Quelle und
  den P- und I-Anteil.
- Liegt der I-Anteil tagelang über 0, ist die Heizkurve zu niedrig; unter 0 zu
  hoch. Siehe [Heizkurve nachstellen](#heizkurve-nachstellen).

## Welche Einstellung in welchem Regelmodus zählt

Homey zeigt immer alle Einstellungen. Sie stehen in sechs Gruppen; der Titel
einer Gruppe sagt, bei welchem Regelmodus sie zählt. Diese Tabelle zeigt,
welche zählen.

| Gruppe: Einstellungen | Klassisch | Positionell – Heizkörper / Fußbodenheizung | Positionell – Manuell |
| --- | --- | --- | --- |
| Adaptive Regelung: ein, Regelmodus, niedrigste und höchste Wassertemperatur | Ja | Ja | Ja |
| Heizkurve (Positionell): Grundlage der Empfehlung, einmalig übernehmen, Wasser bei −15 °C und +15 °C | Nein | Ja | Ja |
| Feineinstellung (Positionell – Manuell): Kp, Ti | Nein | Nein, feste Werte | Ja |
| Feineinstellung (Klassisch): Kp, Ki, Totzone | Ja | Nein | Nein |
| Coast (Klassisch, Positionell – Manuell) | Ja | Nein, Coast ist immer aus | Ja |
| Gewichtungsfaktoren: Komfort, Gebäudemodell | Ja | Nein | Nein |
| Gewichtungsfaktoren: Effizienz, Kosten | Ja | Ja, nur für die Verschiebung des Raumziels | Ja, ebenso |

## Klassisch und Positionell

### Klassisch

Alle 5 Minuten berechnet die App eine kleine Korrektur und addiert sie zur
aktuellen Empfehlung. Diese Schritte summieren sich: Nach einer kalten Nacht
kann die Empfehlung weit gestiegen sein, und es dauert, bis sie wieder sinkt.
Innerhalb der Totzone (Standard 0,3 °C) ändert sich nichts. Klassisch braucht
keine Heizkurve.

### Positionell

Die Empfehlung wird alle 5 Minuten neu aus drei Teilen berechnet:

1. **Basis**: die Wassertemperatur, die zur Außentemperatur gehört, aus einer
   Heizkurve.
2. **P-Anteil**: Kp × (Raumziel − Raumtemperatur). Reagiert sofort.
3. **I-Anteil**: wächst langsam, solange es zu kalt oder zu warm bleibt, und
   gleicht so eine Heizkurve aus, die etwas zu hoch oder zu niedrig liegt. Ti
   bestimmt, wie langsam.

Beispiel: außen 5 °C, Heizkurve 50 / 35 ergibt eine Basis von 40 °C. Innen
20,5 °C bei einem Raumziel von 21 °C ergibt einen P-Anteil von 3 × 0,5 = 1,5 °C.
Die Empfehlung ist dann 41,5 °C plus der I-Anteil, auf ganze Grad gerundet.

Grenzen: P- und I-Anteil zusammen höchstens ±8 °C, der I-Anteil allein
höchstens ±6 °C. Der I-Anteil steht still bei einer Abweichung bis 0,1 °C,
während Abtauen und Warmwasser, an einer Grenze und solange die Wärmepumpe die
vorige Empfehlung noch nicht übernommen hat.

### Die drei positionellen Varianten

| | Heizkörper | Fußbodenheizung | Manuell |
| --- | --- | --- | --- |
| Kp | 3 | 3 | Einstellung, Standard 3 |
| Ti | 3 Stunden | 6 Stunden | Einstellung, Standard 3 Stunden |
| Coast | Aus | Aus | Schalter **Coast ein**, **Standard an** |
| Startkurve | 50 / 35 | 35 / 27 | Keine |

Nur Ti unterscheidet sich zwischen den Abgabesystemen: Ein Fußboden reagiert
erst nach Stunden, also muss der I-Anteil langsamer wachsen. Kp hängt kaum vom
Abgabesystem ab.

Achtung bei **Manuell**: Mit den Standardwerten entspricht es Heizkörper,
**aber mit Coast an**. Wenn Sie das nicht möchten, schalten Sie **Coast ein** aus.

## Die Heizkurve bei Positionell

### App-Kurve

Eine Gerade durch zwei Punkte: die Wassertemperatur bei −15 °C und bei +15 °C
außen. Zwischen diesen Punkten berechnet die App den Wert; außerhalb läuft die
Gerade weiter, innerhalb der Grenzen.

Wenn Sie einen positionellen Regelmodus wählen, füllt die App eine Startkurve
aus (Heizkörper 50 / 35, Fußbodenheizung 35 / 27). Das geschieht nur, solange
Sie die beiden Werte nie selbst geändert haben. Haben Sie sie einmal geändert
oder aus einer festen Kurve ausfüllen lassen, bleiben sie stehen, auch wenn Sie
später den Modus wechseln.

### Feste Kurve übernehmen

**Einmalig in die App-Kurve übernehmen** füllt die beiden Werte einmal
aus einer Kurve der Wärmepumpe aus. Danach springt die Liste zurück auf "—".
Öffnen Sie die Einstellungen erneut, um die neuen Werte zu sehen.

| Kurve | −15 °C | +15 °C | Kurve | −15 °C | +15 °C |
| --- | --- | --- | --- | --- | --- |
| HH1 | 54 | 51 | HL1 | 37 | 33 |
| HH2 | 54 | 46 | HL2 | 34 | 31 |
| HH3 | 53 | 42 | HL3 | 32 | 30 |
| HH4 | 49 | 46 | HL4 | 34 | 29 |
| HH5 | 49 | 41 | HL5 | 32 | 29 |
| HH6 | 44 | 41 | HL6 | 30 | 27 |
| HH7 | 44 | 36 | HL7 | 28 | 27 |
| HH8 | 39 | 36 | HL8 | 28 | 25 |

Die festen Kurven sind Treppen mit Stufen von 1 °C. Die Werte folgen der Mitte
dieser Treppe, auf ganze Grad gerundet.

Aurora I/II mit einer DIY-Heizkurve: Wählen Sie **DIY-Heizkurve der Wärmepumpe
(L28/L29)**. Die App übernimmt L29 als Wert bei −15 °C und L29 + 30 × L28 als
Wert bei +15 °C. Beispiel: L28 = −0,5 und L29 = 55 ergibt 55 / 40. Kann die App
die DIY-Heizkurve noch nicht lesen oder ist sie nicht brauchbar, erhalten Sie
eine Meldung und es ändert sich nichts.

### Einmal übernehmen oder laufend folgen

Bei der Aurora I/II können Sie eine DIY-Heizkurve auf zwei Arten verwenden:

| | Einmal übernehmen | Laufend folgen |
| --- | --- | --- |
| Einstellung | Einmalig in die App-Kurve übernehmen → **DIY-Heizkurve der Wärmepumpe** | Grundlage der Empfehlung → **Heizkurve der Wärmepumpe (laufend gefolgt)** |
| Was die App tut | Übernimmt die DIY-Werte einmal in die App-Kurve | Rechnet in jedem Zyklus mit der DIY-Heizkurve der Wärmepumpe |
| Außentemperatur | Die der App (siehe [Außentemperatur](#außentemperatur)) | Der Sensor der Wärmepumpe |
| Sie ändern die DIY-Heizkurve später | Die App übernimmt es nicht; erneut übernehmen | Die App folgt sofort |
| DIY ist aus oder nicht brauchbar | Meldung beim Speichern, es ändert sich nichts | Die App rechnet ohne Meldung mit der App-Kurve |

Sie können beides kombinieren: erst übernehmen, dann folgen. Fällt das Folgen
weg, rechnet die App mit derselben Kurve weiter.

Bei der Aurora III bedeutet **Heizkurve der Wärmepumpe** die Klimakurve der
Wärmepumpe. Wählen Sie das nur, wenn Sie diese Kurve selbst eingestellt haben.
Tuya hat diese Wahl nicht.

### Heizkurve nachstellen

| Was Sie bemerken | Änderung |
| --- | --- |
| Zu kalt bei Frost, gut bei mildem Wetter | Wert bei −15 °C 1–2 °C höher |
| Zu kalt bei mildem Wetter | Wert bei +15 °C 1–2 °C höher |
| Überall etwas zu kalt | Beide Werte 1 °C höher |
| Zu warm | Umgekehrt: senken |

Ändern Sie einen Wert nach dem anderen und warten Sie einen Tag
(Fußbodenheizung: zwei Tage).

## Coast

### Was Coast tut

Coast lässt das Haus passiv abkühlen, wenn es zu warm wird. Liegt der Raum zwei
Zyklen hintereinander mehr als die Startschwelle (**Coast: Startschwelle über
der Wunschtemperatur**, Standard 0,3 °C) über dem Raumziel und sinkt nicht,
zieht Coast die Empfehlung auf die aktuelle Wassertemperatur minus **Coast:
Empfehlung unter der Wassertemperatur** (Standard 1 °C). Die Wärmepumpe hört dann auf zu heizen.

Coast endet, wenn der Raum unter das Raumziel plus die halbe Startschwelle fällt
(standardmäßig 21,15 °C bei einem Ziel von 21 °C), wenn der Raum sinkt und Coast
kaum noch etwas bewirkt, oder nach der maximalen Anzahl Zyklen (Aurora: Standard
24, 2 Stunden).

### Warum Positionell ohne Coast

**Wofür Coast gedacht war.** Klassisch addiert alle 5 Minuten einen kleinen
Schritt zur Empfehlung. Nach einer kalten Periode ist die Empfehlung so weit
gestiegen. Wird es danach zu warm, müssen all diese Schritte erst wieder
zurück, und währenddessen heizt die Wärmepumpe weiter: Der Raum schießt über.
Coast wurde als Notbremse hinzugefügt: Es zieht die Empfehlung unter die
Wassertemperatur, damit der Kompressor stoppt.

**Warum Positionell diese Notbremse nicht braucht.** Positionell berechnet die
Empfehlung in jedem Zyklus neu aus der Heizkurve. Es gibt keine summierten
Schritte, die erst zurück müssen. Wird es zu warm, ist der P-Anteil sofort
negativ: 0,5 °C zu warm ergibt im selben Zyklus eine 1,5 °C niedrigere
Empfehlung, 1 °C zu warm 3 °C niedriger. Der I-Anteil sinkt danach langsam mit.

**Was mit Coast bei Positionell schiefgeht.** Coast richtet sich auf die
Wassertemperatur minus 1 °C, und diese Wassertemperatur bewegt sich mit dem
Kompressor:

1. Der Raum ist zu warm. Coast zieht die Empfehlung nach unten und der
   Kompressor stoppt.
2. Coast endet. Die Empfehlung springt in einem Zyklus zurück auf Heizkurve plus
   P- und I-Anteil, in der Simulation bis zu 9 °C höher.
3. Der Kompressor startet wieder und die Wassertemperatur steigt über die
   Empfehlung. Dadurch fällt Coast weg, solange der Kompressor läuft, und greift
   wieder ein, sobald er stoppt.
4. Liegt die Heizkurve etwas zu hoch, bleibt der Raum zu warm und die Schritte
   1 bis 3 wiederholen sich.

In der Simulation ergab das 14–23 Kompressorstarts pro Tag. Viele kurze Starts
verschleißen den Kompressor und kosten Effizienz.

**Was der Test zeigte.** 24 simulierte Situationen: drei Häuser
(durchschnittlich, leicht, schwer), mildes und kaltes Wetter, vier Heizkurven
(passend, 35 / 27, HL2 zu hoch, HL8 zu niedrig), je 14 Tage. Coast aus gegen
Coast an:

| Ergebnis | Anzahl |
| --- | --- |
| Coast aus besser | 11 |
| Gleich | 9 |
| Coast aus etwas schlechter | 4, alle mit der zu niedrigen Kurve HL8: bis etwa 1 Stunde pro Tag mehr als 0,5 °C zu kalt bei mildem Wetter |

Mit Coast aus startete der Kompressor im Mittel 0,4-mal pro Tag, mit Coast an
2,9-mal. Ein Sprung von mehr als 1 °C in der Empfehlung kam mit Coast aus nicht
vor. Bei einer zu niedrigen Heizkurve ist die Lösung, die Kurve anzuheben, nicht
Coast.

**Was versucht wurde, um Coast zu behalten.** Das Coast-Ziel auf seinem
niedrigsten Wert festhalten (schlechter), die Empfehlung nach Coast allmählich
steigen lassen (hilft kaum), und nur den I-Anteil pausieren, ohne die Empfehlung
nach unten zu ziehen (schlechter bei einer zu hohen Heizkurve).

**Verlauf.** In 3.5.0 und 3.5.1 war Coast bei Fußbodenheizung an. Diese Wahl
kam aus Simulationen mit einer genau passenden Heizkurve; dort macht Coast wenig
aus. Mit der App-Kurve aus zwei Punkten, wie Nutzer sie haben, zeigte sich das
Schwingen. Seit 3.5.2 ist Coast in beiden Presets aus.

**Trotzdem Coast?** Wählen Sie Positionell – Manuell und schalten Sie **Coast ein** ein.
Das oben beschriebene Schwingen kann dann weiterhin auftreten. Es wurde keine
Situation getestet, in der Coast bei Positionell besser abschneidet.

Die Presets schalten Coast aus, was der Schalter **Coast ein** auch sagt. Bei Klassisch
und Manuell gilt der Schalter.

## Die Einstellungen einzeln

In der Reihenfolge der Gruppen.

| Einstellung | Was sie tut | Zählt bei | Standard |
| --- | --- | --- | --- |
| **Gruppe Adaptive Regelung** | | | |
| Adaptive Regelung ein | Schaltet die Berechnung der Empfehlung ein | Allen | Aus |
| Regelmodus | Klassisch oder eine der drei positionellen Varianten | Allen | Klassisch |
| Niedrigste Wassertemperatur in der Empfehlung | Niedrigste Empfehlung; auf P111 abstimmen | Allen | 18 °C |
| Höchste Wassertemperatur in der Empfehlung | Höchste Empfehlung; mindestens 2 °C über dem Minimum | Allen | 60 °C (Tuya 65 °C) |
| **Gruppe Heizkurve (Positionell)** | | | |
| Grundlage der Empfehlung | App-Kurve oder Heizkurve der Wärmepumpe (laufend gefolgt) | Positionell | App-Kurve |
| Einmalig in die App-Kurve übernehmen | Füllt die beiden Werte darunter einmal aus | Positionell | — |
| App-Kurve: Wasser bei −15 °C / +15 °C außen | Die beiden Punkte der App-Kurve | Positionell | 45 / 30, oder die Startkurve des Modus |
| **Gruppe Feineinstellung (Positionell – Manuell)** | | | |
| Kp: Grad Wasser pro Grad innen | Grad Wassertemperatur je Grad Abweichung innen | Manuell | 3 |
| Ti: Nachstellzeit | Wie langsam der I-Anteil wächst | Manuell | 3 Stunden |
| **Gruppe Feineinstellung (Klassisch)** | | | |
| Kp: Proportionalverstärkung | Größe der Korrektur je Grad Abweichung | Klassisch | 5,0 |
| Ki: Integralverstärkung | Wie stark eine bleibende Abweichung nachgeregelt wird | Klassisch | 1,5 |
| Totzone | Abweichung, innerhalb der sich nichts ändert | Klassisch | 0,3 °C |
| **Gruppe Coast** | | | |
| Coast ein | Coast an oder aus | Klassisch, Manuell | An |
| Coast: Empfehlung unter der Wassertemperatur | Wie viele Grad unter der Wassertemperatur Coast zielt | Klassisch, Manuell | 1 °C |
| Coast: Startschwelle über der Wunschtemperatur | Spielraum über dem Raumziel, bevor Coast beginnt | Klassisch, Manuell | 0,3 °C |
| Coast: Anteil an der Empfehlung | Wie stark Coast gewichtet wird | Klassisch, Manuell | 0,80 |
| Coast: maximale Dauer (Aurora) | Höchstzahl an 5-Minuten-Zyklen | Klassisch, Manuell | 24 |
| **Gruppe Gewichtungsfaktoren** | | | |
| Komfort — nur Klassisch | Gewicht der Temperaturregelung | Klassisch | 50 % |
| Effizienz | Gewicht der COP-Optimierung | Allen | 15 % |
| Kosten | Gewicht der Preisoptimierung | Allen | 15 % |
| Gebäudemodell — nur Klassisch | Gewicht des Gebäudemodells | Klassisch | 20 % |

Die Gewichtungsfaktoren werden zusammen auf 100 % umgerechnet. Effizienz und Kosten
wirken nur, wenn die COP- oder Preisoptimierung an ist. Bei Positionell
verschieben sie das Raumziel, um höchstens 1,5 °C; die Heizkurve verschiebt
sich mit.

## Außentemperatur

Die Regelung, und vor allem die Heizkurve bei Positionell, rechnet mit der
Außentemperatur. Die App nimmt die erste verfügbare:

1. die Außentemperatur aus einer Flow-Karte, wenn sie weniger als 1 Stunde alt
   ist;
2. die Wettervorhersage von Open-Meteo für die aktuelle Stunde;
3. den Außensensor der Wärmepumpe.

Die Vorhersage wird jede Stunde abgerufen, auch wenn
**Wettervorhersage-Integration aktivieren** aus ist; dieser Schalter blendet nur
die Vorhersagesensoren ein oder aus. Die Vorhersage gilt für den Standort in den
Einstellungen. Tragen Sie dort Ihren eigenen Standort ein, oder senden Sie die
Außentemperatur mindestens jede Stunde über eine Flow-Karte.

Ausnahme: **Heizkurve der Wärmepumpe** rechnet mit dem Außensensor der
Wärmepumpe.

## Unterschiede je Treiber

| | Tuya | Aurora I/II | Aurora III |
| --- | --- | --- | --- |
| Grundlage der Empfehlung | Nicht vorhanden: immer die App-Kurve | App-Kurve oder DIY-Heizkurve | App-Kurve oder Klimakurve |
| Einmalig übernehmen | H1–H8, L1–L8 | HH1–HH8, HL1–HL8 und DIY (L28/L29) | Nicht vorhanden |
| Coast: maximale Dauer | Nicht einstellbar | Einstellbar | Einstellbar |
| Höchste Wassertemperatur in der Empfehlung | 25–65 °C, Standard 65 °C | 25–60 °C, Standard 60 °C | 25–60 °C, Standard 60 °C |
| Sollwert bleibt nur bei | Heizkurve OFF | Heizkurvenwahl OFF | — |

## Fragen

**Die Empfehlung ändert sich, die Wärmepumpe aber nicht.**
Es gibt keinen Flow, der die Empfehlung ausführt, oder die Heizkurvenwahl der
Wärmepumpe steht nicht auf OFF.

**Der Sollwert springt nach einer Weile zurück.**
Die Heizkurvenwahl (Tuya: Heizkurve) steht nicht auf OFF. Die Wärmepumpe setzt
dann ihren eigenen Heizkurvenwert zurück.

**Die Empfehlung steht still.**
Ist **Adaptive Regelung ein** an, kommt die Raumtemperatur an, und hat
**Gewünschte Innentemperatur** einen Wert? Ohne alle drei wird keine neue
Empfehlung berechnet. Die Regelung meldet das nur im Debug-Log.

**Ich habe Kp geändert, aber nichts ändert sich.**
Bei Positionell zählt **Kp: Proportionalverstärkung** (Gruppe Feineinstellung
Klassisch) nicht; dort gilt **Kp: Grad Wasser pro Grad innen**, und nur bei
Manuell.

**Ich habe eine Einstellung gespeichert, aber nichts ändert sich.**
Öffnen Sie den Einstellungsbildschirm erneut und prüfen Sie, ob der Wert
gespeichert wurde. Nach einer Fehlermeldung zeigt der Bildschirm manchmal noch
den eingegebenen Wert, während die App den alten behält. Vor 3.6.2 blockierte
ein Vergissfaktor unter 0,9985 jedes Speichern; 3.6.2 setzt einen solchen Wert
auf 0,999.

**Ich habe Coast aus- oder eingeschaltet, aber nichts ändert sich.**
Bei Positionell – Heizkörper und – Fußbodenheizung ist Coast immer aus.

**Nach der Wahl eines Regelmodus stehen die Kurvenwerte nicht auf 50 / 35.**
Sie haben die Werte früher selbst geändert oder aus einer festen Kurve ausfüllen
lassen. Die App überschreibt Ihre eigene Heizkurve nicht.

**Die Empfehlung liegt weit von dem, was die Wärmepumpe jetzt tut.**
Die Heizkurve der App weicht von der der Wärmepumpe ab. Übernehmen Sie die
Heizkurve der Wärmepumpe (siehe [Heizkurve wählen](#4-heizkurve-wählen-nur-positionell)).
Prüfen Sie auch den Standort für die Außentemperatur.
