# Modbus Diagnose- en Dashboardhandleiding (Adlar Castra Aurora)

Deze handleiding beschrijft de ingebouwde lokale diagnose- en servicetools van de **Modbus-driver** in de Adlar Castra Homey-app.

---

## 1. Overzicht

De Modbus-driver (`intelligent-heatpump-modbus`) bevat een optionele, lokale HTTP-service voor diepgaande diagnose, live-monitoring en geavanceerde registerinspectie. Deze tool draait direct op uw Homey Pro en is toegankelijk via uw lokale webbrowser.

### Belangrijkste eigenschappen
- **100% lokaal**: Geen externe cloudverbinding vereist.
- **Realtime monitoring**: Live weergave van alle gemeten temperaturen, drukwaarden, ventilatortoerentallen en compressorstatussen.
- **Stooklijneditor**: Visuele afstelling van de verwarmingscurve.
- **Registerinspectie**: Gedetailleerd inzicht in Modbus-registers (P- en L-parameters).

---

## 2. Toegang en Configuratie

### Poortinstelling
Standaard is de HTTP-service actief op poort **8090**. U kunt deze poort wijzigen in de Homey-app:
1. Open de Homey-app op uw smartphone of desktop.
2. Ga naar het Modbus-warmtepompapparaat.
3. Open **Instellingen** (tandwielicoon) → **Geavanceerde instellingen**.
4. Zoek de sectie **Lokale dashboards** en pas het veld **Dashboardpoort** aan indien poort 8090 reeds bezet is.

### Het dashboard openen
Open een webbrowser op een computer of tablet verbonden met hetzelfde lokale netwerk en navigeer naar:

```text
http://<homey-ip>:8090/
```

*(Vervang `<homey-ip>` door het lokale IP-adres van uw Homey Pro, bijvoorbeeld `http://192.168.1.50:8090/`)*

---

## 3. Beschikbare Weergaven en Endpoints

| Endpoint | Omschrijving | Doel |
|---|---|---|
| `/` | **Live-overzicht** | Hoofdweergave met realtime status, temperaturen, vermogen en COP. |
| `/interactive` | **Interactieve bediening** | Direct overzicht met mogelijkheid om doeltemperaturen en werkmodi in te stellen. |
| `/live` | **Categorieënoverzicht** | Alle actieve Homey capabilities gegroepeerd per categorie. |
| `/expert` | **Expert Registerweergave** | Overzicht van alle Modbus-registers, P- en L-parameters met lees- en schrijftools. |
| `/changelog` | **Registerwijzigingen** | Logboek van recente registerwijzigingen en polladviezen. |
| `/heating-curve` | **Stooklijneditor** | Visuele simulator en editor voor een eigen lineaire stooklijn (curve slope & offset). |

---

## 4. Veiligheidsinstructies voor Expert-tools

> [!WARNING]
> **Voorzichtigheid geboden bij registerschrijfopdrachten**
> Het handmatig wijzigen van Modbus-registers via de `/expert` weergave beïnvloedt direct de interne werking van de warmtepompcontroller.
> - Wijzig registers uitsluitend als u bekend bent met de fabrikantspecificaties van Adlar.
> - Noteer altijd de oorspronkelijke registerwaarde vóórdat u een wijziging doorvoert.
> - De Modbus-driver is standaard geoptimaliseerd voor de R32-registermap.
