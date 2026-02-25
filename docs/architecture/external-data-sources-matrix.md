# Externe Data Bronnen & Feature Afhankelijkheden

Dit overzicht documenteert welke feature toggles in de geavanceerde instellingen (Advanced Settings) van de Adlar app afhankelijk zijn van externe databronnen of specifieke invoer. Bij features die meerdere databronnen ondersteunen, hanteren we een vaste prioriteitsvolgorde om de meest accurate data te garanderen.

## Afhankelijkheidsmatrix

| Feature Toggle (`Setting ID`)                                             | Benodigde Data                | Bronnen in volgorde van Prioriteit (1 = Hoogste)                                                                                                     |
| :------------------------------------------------------------------------ | :---------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Adaptieve Controle**<br>`adaptive_control_enabled`                      | **Buitentemperatuur**         | **1.** Externe Sensor (`adlar_external_ambient`) <br> **2.** Interne WP Sensor (`measure_temperature.temp_ambient`)                                  |
|                                                                           | **Binnentemperatuur**         | **1.** Homey Subcapability (`measure_temperature.indoor`) <br> **2.** Legacy Sensor (`adlar_external_indoor_temperature`)                            |
| **Gebouwmodel / Inzichten**<br>`building_model_enabled`                   | **Buitentemperatuur**         | **1.** Externe Sensor (`adlar_external_ambient`) <br> **2.** Interne WP Sensor (`measure_temperature.temp_ambient`)                                  |
|                                                                           | **Binnentemperatuur**         | **1.** Homey Subcapability (`measure_temperature.indoor`) <br> **2.** Legacy Sensor (`adlar_external_indoor_temperature`)                            |
|                                                                           | **Omgevingsdata** (optioneel) | **1.** Windsnelheid (`adlar_external_wind_speed`) <br> **2.** Zonnestraling (`adlar_external_solar_radiation`)                                       |
| **Stooklijn regeling**<br>`enable_curve_controls`                         | **Buitentemperatuur**         | **1.** Externe Sensor (`adlar_external_ambient`) <br> **2.** Interne WP Sensor (`measure_temperature.temp_ambient`)                                  |
| **Prijsoptimalisatie**<br>`price_optimizer_enabled`                       | **Energieprijzen**            | **1.** Flow Triggercard _"Ontvang Externe Energie Prijzen"_ (input via bijv. EPEX Spot, Power by the Hour)                                           |
| **Weersverwachting integratie**<br>`enable_weather_forecast`              | **Weer & Omgeving**           | **1.** Invoer via flows (Windsnelheid, Zonnestraling, Zonne-energie) <br> **2.** Fallback / API: OpenMeteo integratie (`adlar_openmeteo_last_fetch`) |
| **Intelligente Energie Tracking**<br>`enable_intelligent_energy_tracking` | **Stroomverbruik / Vermogen** | **1.** Externe P1 / kWh Meter (via Homey flows) <br> **2.** Interne stroommeting van de warmtepomp (indien ondersteund)                              |
| **COP Berekening**<br>`cop_calculation_enabled`                           | **Stroomverbruik / Vermogen** | **1.** Externe P1 / kWh Meter (via Homey flows) <br> **2.** Interne stroommeting van de warmtepomp                                                   |

### Toelichting Databronnen

1. **Externe Sensor (`adlar_external_ambient` of subcapabilities):** Externe databronnen zoals gekoppelde lokale weerstations, temperatuursensoren of slimme thermostaten in Homey hebben altijd de hoogste prioriteit omdat ze de werkelijkheid beter benaderen.
2. **Interne WP Sensor (`measure_temperature.temp_ambient`):** De sensoren van de warmtepomp zelf zijn een uiterste fallback-mechanisme. Voor buitentemperatuur kan deze onnauwkeurig zijn omdat de compressor warmte afgeeft tijdens operatie of een ontdooicyclus.
3. **Legacy Sensoren:** Voor backwards backward-compatibility blijven oudere specifieke variabelen (zoals `adlar_external_indoor_temperature`) behouden, maar deze hebben een lagere prioriteit.
