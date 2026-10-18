# Modbus Diagnose- en Dashboardhandleiding (Adlar Castra Aurora)

Deze handleiding beschrijft de ingebouwde lokale diagnose- en servicetools van de **Modbus-drivers** in de Adlar Castra Homey-app: de Aurora II-driver en de Aurora III-driver.

---

## 1. Overzicht

Beide Modbus-drivers (`intelligent-heatpump-modbus` voor Aurora II, `intelligent-heatpump-aurora3` voor Aurora III) bevatten een optionele, lokale HTTP-service voor diepgaande diagnose, live-monitoring en geavanceerde registerinspectie. Deze tool draait direct op uw Homey Pro en is toegankelijk via uw lokale webbrowser. Elk model heeft een eigen dashboardserver op een eigen poort.

### Belangrijkste eigenschappen
- **100% lokaal**: Geen externe cloudverbinding vereist.
- **Realtime monitoring**: Live weergave van alle gemeten temperaturen, drukwaarden, ventilatortoerentallen en compressorstatussen.
- **Stooklijneditor** (alleen Aurora II): Visuele afstelling van de verwarmingscurve.
- **Registerinspectie**: Gedetailleerd inzicht in Modbus-registers (P- en L-parameters bij Aurora II, input- en holdingregisters bij Aurora III).

---

## 2. Toegang en Configuratie

### Poortinstelling

| Model | Standaardpoort |
|---|---|
| Aurora II | **8090** |
| Aurora III | **8091** |

De dashboardserver start zodra er een apparaat van dat model gekoppeld is. U kunt de poort wijzigen in de Homey-app:
1. Open de Homey-app op uw smartphone of desktop.
2. Ga naar het Modbus-warmtepompapparaat.
3. Open **Instellingen** (tandwielicoon) → **Geavanceerde instellingen**.
4. Zoek de sectie **Lokale dashboards** en pas het veld **Dashboardpoort** aan indien de poort reeds bezet is.

Kies voor de twee modellen niet dezelfde poort: dan start alleen de eerste dashboardserver.

### Het dashboard openen
Open een webbrowser op een computer of tablet verbonden met hetzelfde lokale netwerk en navigeer naar:

```text
http://<homey-ip>:8090/   (Aurora II)
http://<homey-ip>:8091/   (Aurora III)
```

*(Vervang `<homey-ip>` door het lokale IP-adres van uw Homey Pro, bijvoorbeeld `http://192.168.1.50:8090/`)*

---

## 3. Beschikbare Weergaven en Endpoints

| Endpoint | Omschrijving | Doel | Aurora II | Aurora III |
|---|---|---|---|---|
| `/` | **Live-overzicht** | Hoofdweergave met realtime status, temperaturen, vermogen en COP. | ✓ | ✓ |
| `/interactive` | **Interactieve bediening** | Direct overzicht met mogelijkheid om doeltemperaturen en werkmodi in te stellen. Bij Aurora III ook tapwaterfunctie, stille modus, bijverwarming en (experimenteel) aan/uit. | ✓ | ✓ |
| `/live` | **Categorieënoverzicht** | Alle actieve Homey capabilities gegroepeerd per categorie. | ✓ | ✓ |
| `/expert` | **Expert Registerweergave** | Overzicht van alle Modbus-registers met lees- en schrijftools. | ✓ | ✓ |
| `/changelog` | **Registerwijzigingen** | Logboek van recente registerwijzigingen en polladviezen. | ✓ | ✓ |
| `/heating-curve` | **Stooklijneditor** | Visuele simulator en editor voor een eigen lineaire stooklijn (curve slope & offset). | ✓ | — |

---

## 4. Veiligheidsinstructies voor Expert-tools

> [!WARNING]
> **Voorzichtigheid geboden bij registerschrijfopdrachten**
> Het handmatig wijzigen van Modbus-registers via de `/expert` weergave beïnvloedt direct de interne werking van de warmtepompcontroller.
> - Wijzig registers uitsluitend als u bekend bent met de fabrikantspecificaties van Adlar.
> - Noteer altijd de oorspronkelijke registerwaarde vóórdat u een wijziging doorvoert.
> - De Aurora II-driver is standaard geoptimaliseerd voor de R32-registermap.

> [!IMPORTANT]
> **Geen wachtwoord op de dashboards**
> De dashboards zijn zonder aanmelding bereikbaar voor ieder apparaat op uw lokale netwerk, inclusief de schrijffuncties. Met een apparaat van beide modellen staan er twee van zulke poorten open. Gebruik de dashboards alleen op een vertrouwd netwerk en stel ze niet open naar internet.
