# Testversie 3.2.0 — Aurora III via Modbus

Versie 3.2.0 van **Adlar Castra Warmtepomp** voegt een driver toe voor de **Aurora III / PRO via Modbus**. Daarmee vervangt deze app de aparte app *Adlar Castra Warmtepomp (Aurora-III Modbus)*. Voordat 3.2.0 live gaat, zoek ik testers met echte hardware.

## Voor wie

| Je hebt | Wat je test |
|---|---|
| Een Aurora III / PRO met Modbus-gateway (bijv. Elfin EW11A) | Alles hieronder, vooral A t/m E |
| Een Aurora I/II via Modbus of via Tuya | F: blijft alles werken na de update? |
| De oude Aurora III-app in gebruik | G: de overstap volgens de migratiehandleiding |

## Vooraf: lees dit

- **Dit is een testversie.** Terug naar de huidige versie (3.1.4) gaat niet vanzelf. Een Aurora III-device dat je in de testversie koppelt, werkt niet meer na een terugval.
- **Maak eerst schermafbeeldingen** van je flows en apparaatinstellingen.
- **Laat de oude Aurora III-app en de nieuwe driver niet tegelijk met dezelfde warmtepomp praten.** Zet eerst de oude app stil (stap G). Twee apps die tegelijk via één gateway pollen en schrijven, geven storingen.
- **De drivers hebben nieuwe namen.** Bij *Apparaat toevoegen* zie je *Aurora I/II via Tuya*, *Aurora I/II via Modbus* en *Aurora III via Modbus*. Bestaande apparaten houden hun eigen naam.

## Installeren

1. Open de testlink: <https://homey.app/a/org.hhi.adlar-heatpump/test/>
2. Installeer de testversie 3.2.0.
3. Zet bij het Aurora III-device onder **Instellingen → Diagnostiek → Log Niveau** het niveau op *DEBUG* zolang je test.

## Wat testen

Noteer per stap: ✅ werkt, ❌ werkt niet (wat zag je?), of ➖ niet getest.

### A. Koppelen (Aurora III)

1. Gateway ingesteld op `9600 8N2`, `Serial protocol` = `Modbus` — zie de [Elfin-gids](https://github.com/hhi/org.hhi.adlar-heatpump/blob/main/docs/setup/modbus-elfin-ew11-setup.md).
2. *Apparaat toevoegen* → **Aurora III via Modbus** → IP-adres, poort en Unit ID invullen.
3. Verschijnt het apparaat en komen er binnen een minuut waarden binnen?

### B. Waarden vergelijken

Vergelijk in Homey en op het dashboard `http://<homey-ip>:8091/live` met het display of de bediening van de warmtepomp:

- aanvoer- (TA), retour- (TE1) en buitentemperatuur (T4)
- bedrijfsmodus (Uit / Koeling / Verwarming / Auto)
- compressorfrequentie en draaiende/stilstaande compressor
- tapwatertemperatuur (TZ2), als je tapwater hebt

### C. Bedienen

Wijzig via Homey (of `http://<homey-ip>:8091/interactive`) en controleer op de warmtepomp:

1. Verwarmingssetpoint
2. Stille modus (Uit / Niveau 1; Niveau 2 alleen bij R290)
3. Tapwaterfunctie aan/uit
4. Geforceerde bijverwarming — **alleen als je dit bewust wilt testen**, en daarna weer uit

### D. Flows

1. Trigger **Verwarmingsmodus gewijzigd**: komt hij binnen als je de modus wijzigt, en is de tag *Cooling* / *Heating* / *Off* / *Auto*?
2. Voorwaarde **Stille modus is** en **Verwarmingsmodus is**
3. Actie **Doel (setpoint) temperatuur instellen** voor het Aurora III-device

### E. Vermogensmeting (alleen Aurora III)

Zet **Interne vermogingsmeting capabilities inschakelen** aan (herstart van de app vereist). Kun je daarna in een flow de trigger **Vermogen drempel overschreden** voor het Aurora III-device kiezen?

### F. Bestaande Aurora I/II- en Tuya-apparaten

1. Werken je bestaande apparaten en flows na de update ongewijzigd?
2. Dashboard `http://<homey-ip>:8090/` (Aurora I/II via Modbus) werkt nog?

### G. Overstappen vanuit de oude Aurora III-app

Volg de [migratiehandleiding](https://github.com/hhi/org.hhi.adlar-heatpump/blob/main/docs/setup/MIGRATION_AURORA3.nl.md). Was die duidelijk genoeg, en mis je iets?

## Terugmelden

Reageer in dit topic met:

```text
Model:            Aurora III / PRO / Aurora I/II   (koudemiddel: R32 / R290)
Gateway:          (bijv. Elfin EW11A, firmwareversie)
Verbinding:       Modbus / Tuya
Appversie:        3.2.0
A Koppelen:       ✅ / ❌ / ➖
B Waarden:        ✅ / ❌ / ➖   (welke waarde wijkt af?)
C Bedienen:       ✅ / ❌ / ➖
D Flows:          ✅ / ❌ / ➖
E Vermogen:       ✅ / ❌ / ➖
F Bestaand:       ✅ / ❌ / ➖
G Overstap:       ✅ / ❌ / ➖
Opmerkingen:
```

Bij een ❌: stuur via de Homey-app een diagnoserapport van deze app en vermeld de code die je krijgt. Schermafbeeldingen helpen.

Dank voor het testen!
