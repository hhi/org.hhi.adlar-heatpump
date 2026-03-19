Deze app geeft u volledige controle over uw Adlar Castra Aurora warmtepomp rechtstreeks via uw Homey smart home systeem. U kunt uw warmtepomp monitoren, bedienen en optimaliseren zonder afhankelijk te zijn van internetverbindingen.

Ondersteunde talen
🇬🇧 English
🇩🇪 Deutsch
🇫🇷 Français
🇳🇱 Nederlands

BELANGRIJKSTE VOORDELEN

LOKALE CONTROLE
- Rechtstreekse verbinding met uw warmtepomp via het lokale netwerk
- Geen internetverbinding nodig voor dagelijks gebruik
- Snelle reactietijden en betrouwbare verbinding

GEAVANCEERDE MONITORING
- Real-time temperatuurmetingen (warmtepomp interne sensoren)
- Stroomverbruik en efficiëntie monitoring
- Automatische COP (prestatiecoëfficiënt) berekening met 8 verschillende methoden
- Seizoensgebonden SCOP analyse volgens Europese normen
- Uitgebreide capabilities voor volledige controle

VOLLEDIGE BEDIENING
- Temperatuur instelling en verwarmingsmodi
- Stooklijn (verwarmingscurve) aanpassingen
- Warmwater temperatuur controle
- Timer en automatische functies

INTELLIGENTE AUTOMATISERING
- Uitgebreide flow kaarten voor geavanceerde automatisering
- Slimme foutdetectie en herstel
- Weersafhankelijke optimalisatie
- Energie-efficiëntie trends en waarschuwingen
- Tijdgebaseerde planning en seizoensmodus detectie
- Adaptieve temperatuurregeling met PI-regelaar
- Gebouwmodel leren met machine learning
- Gebouw Inzichten & Aanbevelingen met ROI-schattingen
- Energieprijs optimalisatie met day-ahead prijzen
- COP optimalisatie voor maximale efficiëntie
- Weerprognose service voor COP-geoptimaliseerd verwarmingsadvies en wind- & vorstcorrecties
- Uitgebreide diagnostische tools voor probleemoplossing
- Wind en zonne-integratie voor gebouwmodel
  * Externe windsnelheid voor windchill correctie van warmteverlies
  * Zonnestraling en PV-vermogen voor nauwkeurige zonnewinst berekening
  * Verbetert gebouwmodel leer-nauwkeurigheid met realtime weerdata

GEBRUIKSVRIENDELIJK
- Volledig Nederlandse interface
- Mobielvriendelijke weergave
- Duidelijke status indicatoren
- Begrijpelijke foutmeldingen

INSTALLATIE

WAT HEEFT U NODIG?
- Homey Pro (firmware versie 12.2.0 of hoger)
- Adlar Castra Aurora warmtepomp
- Lokale netwerkverbinding met de warmtepomp
- Apparaat gegevens (ID, Lokale Sleutel, lokaal IP-adres)

HOE VERKRIJGT U DE APPARAAT GEGEVENS?
De benodigde lokale sleutel en andere gegevens kunt u verkrijgen door de instructies te volgen in:
/docs/setup/Tuya_LocalKey_Homey_Guide_NL.pdf op de Source-Code pagina van deze App.
 
INSTALLATIESTAPPEN
1. Installeer de app via de Homey App Store
2. Voeg een nieuw apparaat toe en selecteer "Intelligent Heat Pump"
3. Voer uw apparaat gegevens in:
   - Apparaat ID
   - Lokale Sleutel
   - lokaal IP-adres
   - Protocolversie (kies 3.3, 3.4 of 3.5)
4. Voltooi het koppelingsproces

PROTOCOLVERSIE SELECTIE
De protocolversie bepaalt hoe de app communiceert met uw warmtepomp:
- 3.3 (Standaard): Werkt voor de meeste Adlar/Aurora warmtepompen
- 3.4: Vereist voor sommige nieuwere modellen
- 3.5: Vereist voor nieuwste firmware versies

Bij verbindingsproblemen (frequente onderbrekingen, ECONNRESET fouten),
probeer een andere protocolversie via apparaatinstellingen.
- ECONNRESET om 00:00 uur treedt doorgaans op vanwege dagelijkse reset van je router
- HMAC mismatch: standaard is protocol versie 3.3, ga over naar 3.4 (of 3.5)
- ECONNREFUSED <ip-adres>: na alle waarschijnlijkheid een verkeerd IP-adres,
  ken een statisch (DHCP) adres toe aan je warmtepomp

BELANGRIJKE MOGELIJKHEDEN

TEMPERATUUR MONITORING
- Water inlaat en uitlaat temperaturen
- Buitentemperatuur
- Tapwater temperatuur
- Compressor temperaturen
- Warmtewisselaar temperaturen

ENERGIE EN EFFICIËNTIE
- Real-time stroomverbruik
- Dagelijks en totaal energieverbruik
- COP berekening (hoe efficiënt uw warmtepomp werkt)
- Trend analyse voor optimalisatie
- Seizoensgebonden prestatie monitoring
- Uurlijkse en dagelijkse kostenberekening

SYSTEEM CONTROLE
- Aan/uit schakeling
- Verwarmingsmodus selectie
- Temperatuur doelen instellen
- Stooklijn aanpassingen
- Warmwater instellingen

AUTOMATISERING MET FLOW KAARTEN
- Temperatuur waarschuwingen
- Energie verbruik monitoring
- Efficiëntie optimalisatie
- Weersafhankelijke aanpassingen
- Systeem timer meldingen
- Dynamische curve calculator voor geavanceerde optimalisatie

CURVE CALCULATOR (Geavanceerde Functie)
Bereken outputwaarden op basis van configureerbare curves voor intelligente automatisering:
- Weerafhankelijke verwarming: Automatische setpoint aanpassing op basis van buitentemperatuur
- Tijdgebonden optimalisatie: Instellingen aanpassen per uur/dag/seizoen
- COP-gebaseerde fine-tuning: Dynamische temperatuur aanpassingen op basis van efficiëntie
- Ondersteunt 6 operatoren: >, >=, <, <=, ==, != met standaard fallback
- Maximum 50 curve entries voor complexe scenario's
- Real-time berekening met gebruiksvriendelijke foutmeldingen

Voorbeeld: Weerafhankelijke Verwarming
"Wanneer buitentemperatuur verandert, bereken verwarmingssetpoint met curve:
< -5°C : 60°C, < 0°C : 55°C, < 5°C : 50°C, < 10°C : 45°C, default : 35°C"
Resultaat: Past verwarming automatisch aan op basis van weersomstandigheden.
Het invoerveld accepteert getallen, variabelen of Homey-ondersteunde {{ expression }} syntax.

ADLAR CUSTOM STOOKLIJN CALCULATOR (L28/L29)
Berekent de aanvoertemperatuur direct uit de Adlar Custom stooklijn parameters:

Wat zijn L28 en L29?
- L29: Gewenste aanvoertemperatuur bij -15°C buitentemp (referentiepunt, bijv. 55°C)
- L28: Hellingsgraad per 10°C temperatuurverandering (bijv. -5 = -0.5°C per graad)

Hoe werkt het?
De formule y = ax + b wordt automatisch berekend:
- Helling (a) = L28 ÷ 10
- Intercept (b) = L29 - (helling × -15°C)
Voorbeeld: L29=55°C, L28=-5 → formule: y = -0.5x + 47.5

Voorbeeld Flow:
"Wanneer buitentemperatuur verandert, bereken Custom stooklijn
met L29=55°C bij -15°C, L28=-5 per 10°C, buitentemp {{outdoor_temperature}}"
Resultaat bij 5°C buiten → aanvoertemp 45°C

Retourneert:
- supply_temperature: Berekende aanvoertemperatuur (°C)
- formula: Mathematische formule (bijv. "y = -0.5x + 47.5")

Voordelen t.o.v. algemene Curve Calculator:
- Gebruikt dezelfde L28/L29 waarden als je warmtepomp display
- Geen handmatige curve definitie nodig
- Mathematisch exact volgens Adlar specificatie

TIJDGEBASEERDE PLANNING & SEIZOENSMODUS (Geavanceerde Functies)
Twee calculators voor intelligente tijd- en seizoensgebonden automatisering:

Tijdgebaseerde Planning:
Bereken waarden op basis van dagschema's voor dagelijkse temperatuurprogrammering.
Voorbeeld: "06:00-09:00: 22, 09:00-17:00: 19, 17:00-23:00: 21, 23:00-06:00: 18"
- Ondersteunt nachtelijke bereiken (bijv. 23:00-06:00)
- Maximum 30 tijdsbereiken met standaard fallback
- Perfect voor comfortplanning en tijd-van-gebruik optimalisatie

Seizoensmodus Detectie:
Automatische detectie van verwarmings-/koelseizoen op basis van datum.
- Stookseizoen: 1 okt - 15 mei (conform EN 14825 SCOP standaard)
- Retourneert modus, seizoensvlaggen en dagen tot seizoenswissel
- Perfect voor automatisch schakelen tussen winter-/zomerschema's

COP (PRESTATIECOËFFICIËNT) MONITORING

De app berekent automatisch hoe efficiënt uw warmtepomp werkt:
- COP waarde: Verhouding tussen opgewekte warmte en verbruikte stroom
- Dagelijkse gemiddelden: 24-uurs trends
- Wekelijkse analyse: Langetermijn prestaties
- Seizoensgebonden monitoring: SCOP volgens Europese normen
- Diagnostische feedback: Wat beïnvloedt de efficiëntie
- Outlier detectie: Signaleren van onrealistische waarden (< 0.5 of > 8.0)

WAT BETEKENEN COP WAARDEN?
- COP 2.0-3.0: Gemiddelde prestatie
- COP 3.0-4.0: Goede prestatie
- COP 4.0+: Uitstekende prestatie


GEAVANCEERDE FEATURES
Zie de inleiding op /docs/setup/advanced-control/Advanced_Features_Intro.nl.md
Om de onderstaande componten mogelijk te maken is de ervaring om eerst de externe databronnen aan te sluiten. 
Vervolgends actief je de Adaptieve Temperatuur Regeling in combinatie met onderstaande componenten naar gelang.

ADAPTIEVE TEMPERATUURREGELING
Automatische regeling van de doeltemperatuur op basis van externe binnentemperatuur sensor:
- PI (Proportioneel-Integraal) regelaar voor stabiele binnentemperatuur
- Prestaties: ±0.3°C stabiliteit
- Vereist: Externe temperatuursensor via flow kaart
- Passieve Koelmodus: Stopt automatisch verwarming wanneer de
  kamertemperatuur boven het setpoint stijgt, zodat het gebouw passief afkoelt
- Voorkomt overshoot na zonne-instraling of interne warmtebronnen

GEBOUWMODEL LEREN
Machine learning algoritme dat de thermische eigenschappen van je woning leert:
- Leert 4 thermische parameters (C, UA, g, P_int)
- Leertijd: 24-72 uur voor basismodel, 2-4 weken voor nauwkeurig model
- Gebouwtype selectie: Licht/Gemiddeld/Zwaar/Passief
- Dynamische interne warmtewinsten per tijdstip
- Locatie- en seizoensafhankelijke zonneberekening op basis van breedtegraad

GEBOUW INZICHTEN & AANBEVELINGEN
Geautomatiseerde analyse van het thermische gebouwmodel:
- Energie-besparende aanbevelingen met ROI-schattingen
- Inzichten verschijnen na 24-48 uur leren (70% betrouwbaarheid)

ENERGIEPRIJS OPTIMALISATIE
Automatische optimalisatie op basis van day-ahead energieprijzen:
- Prijsdrempels: Zeer Laag/Laag/Normaal/Hoog gebaseerd op 2024 percentielen
- Prijsberekening modus: Marktprijs/Markt+/All-in prijs
- Configureerbare leveranciersopslag en energiebelasting
- Prijsblok detectie voor goedkoopste/duurste periodes

COP OPTIMALISATIE
Automatische optimalisatie van aanvoertemperatuur voor maximale efficiëntie:
- Leert optimale aanvoertemperatuur per buitentemperatuur
- Strategieën: Conservatief/Gebalanceerd/Agressief

WEERPROGNOSE SERVICE
COP-geoptimaliseerd verwarmingsadvies en wind- & vorstcorrecties met Open-Meteo weerprognoses:
- Automatische weerdata ophaling via Open-Meteo API (geen API-sleutel vereist): temperatuur, windsnelheid en luchtvochtigheid
- COP-schatting met geleerde data van COP Optimizer of met fallback via lineaire extrapolatie
- Wind & Vorst COP effect: real-time correctiepercentage voor wind- en vorstinvloed op COP
- Defrost statistieken: 24-uurs rollend aantal ontdooicycli en totaal minuten
- Capabilities: Advies tekst, optimale vertraging in uren, Wind & Vorst COP correctie
- Flow trigger: forecast_heating_advice vuurt wanneer COP-gebaseerd advies verandert (tokens: delay_hours, expected_cop, current_cop, advice_text)
- Instellingen: Weerprognose aan/uit, configureerbare locatie coördinaten

ADAPTIEVE REGELING WEGINGSFACTOREN
Vijf prioriteiten die samen bepalen hoe het systeem beslissingen maakt:
- Comfort Prioriteit (standaard 50%): Gewicht voor PI temperatuurregeling
- Efficiëntie Prioriteit (standaard 15%): Gewicht voor COP optimalisatie
- Kosten Prioriteit (standaard 15%): Gewicht voor prijsoptimalisatie
- Thermische Warmte Prioriteit (standaard 20%): Gewicht voor meeweging thermische eigenschappen woning
- Coast Prioriteit (standaard 80% bij activatie): Passieve koeling bij overshoot — domineert de beslissing
- Waarden worden automatisch genormaliseerd naar totaal 100%

GEBOUWMODEL DIAGNOSTIEK
Probleemoplossing voor thermische leer-problemen wanneer uw gebouwmodel niet update:
- Diagnostische informatie via building_model_diagnostics capability
- Controleer binnen/buiten temperatuur sensor status
- Monitor leerproces (samples, betrouwbaarheid, tijdsconstante)
- Identificeer specifieke blokkerende redenen met oplossingen
- Volg leer tijdlijn (T+0 → T+50min → T+24u)

WIND & ZONNE-INTEGRATIE
Verbeter de nauwkeurigheid van het thermische gebouwmodel met externe weerdata:

Windsnelheid Correctie:
- Automatische aanpassing van warmteverlies op basis van windchill effect
- Flow card: "Stel externe windsnelheid in" (km/h)
- Verbetert nauwkeurigheid gebouwmodel warmteverlies berekening
- Compatibel met KNMI Weer app en andere wind sensoren

Zonnestraling Integratie:
- Nauwkeurige berekening van zonnewinsten via gebouwoppervlak
- Flow card: "Stel externe zonnestraling in" (W/m²)
- Astronomische schatting als fallback: zonsopgang/ondergang berekend op basis van breedtegraad
- Ondersteunt KNMI zonnestraling data

PV-vermogen Tracking:
- Real-time monitoring van zonnepaneel opbrengst
- Flow card: "Stel extern PV-vermogen in" (W)
- Gebruikt voor interne warmtewinst correctie
- Verbetert gebouwmodel nauwkeurigheid met extra databron


CROSS-APP INTEGRATIE

Data bronnen: KNMI Weer app, Homey Energy app, of eigen sensoren

Verbind met conforme Homey apps voor verbeterde COP berekening en adaptieve regeling en gebouwmodel:
- Externe vermogensmetingen (van uw slimme meter)
- Externe water doorstroom gegevens
- Externe buitentemperatuur gegevens (bijv. KNMI weer-app)
- Externe binnentemperatuur voor adaptieve regeling
- Windsnelheid data voor windchill compensatie
- Zonnestraling intensiteit voor zonnewinst berekening
- PV-vermogen voor realtime zonne-energiewinsten


VEILIGHEID EN BETROUWBAARHEID

AUTOMATISCHE MONITORING
- Kritieke temperatuur waarschuwingen
- Verbindingsstatus controle
- Systeemfout detectie
- Systeem timer meldingen
- COP outlier detectie

INTELLIGENTE HERSTEL
- Automatische herverbinding
- Foutcorrectie
- Status herstel
- Gebruiksvriendelijke foutmeldingen

TROUBLESHOOTING EN ONDERSTEUNING

GEAVANCEERDE INTEGRATIE SETUP en DOCUMENTATIE

Voor gedetailleerde instructies en externe data integratie:
- Adaptieve Temperatuur Regeling Guide: /docs/setup/guide/ADAPTIVE_CONTROL_GUIDE.nl.md
- Adaptieve regeling Componenten: /docs/setup/advanced-control/ADAPTIVE_CONTROL_COMPONENTS.nl.md
- Advanced Features Flow Cards: /docs/setup/advanced-control/ADVANCED_FLOWCARDS_GUIDE.nl.md
- Wind & Zonne Setup: /docs/setup/guide/BUILDING_INSIGHTS_GUIDE.nl.md
- Flow Cards Gids: /docs/setup/guide/FLOW_CARDS_GUIDE.nl.md
- Volledige Configuratie: /docs/setup/advanced-settings/CONFIGURATION_GUIDE.nl.md
- Info en Specs Warmtepomp: /docs/Heatpump specs/ directory
- COP Calculatie Methodes: /docs/COP calculation/COP-calculation.md
- SCOP Calculatie: /docs/COP calculation/SCOP-calculation.md

VEELVOORKOMENDE PROBLEMEN

Verbindingsproblemen (ECONNRESET Fouten)
Als uw apparaat steeds opnieuw verbinding verbreekt of reset fouten toont:

SNELLE OPLOSSING (duurt minder dan 2 minuten):
1. Open apparaat Instellingen in Homey app
2. Scroll naar boven naar de verbindingsinstellingen
3. Wijzig Protocolversie naar 3.4 (of probeer 3.5 als 3.4 niet werkt)
4. Optioneel: werk andere gegevens bij (lokaal IP-adres, Lokale Sleutel, Apparaat ID)
5. Klik op "Opslaan" en wacht 1-2 minuten voor herverbinding

Succes indicatoren:
- Verbindingsstatus toont "verbonden"
- Geen ECONNRESET fouten meer
- Sensor gegevens worden normaal bijgewerkt
- Apparaat blijft beschikbaar

Andere Veelvoorkomende Problemen:
- Geen verbinding: Controleer lokaal IP-adres, lokale sleutel en netwerkverbinding
- Wisselende waarden: Normaal tijdens opstarten van het systeem
- Foutcodes: Zie de app voor specifieke uitleg per foutcode
- Koppelen mislukt: Probeer verschillende protocolversies (3.3, 3.4, 3.5)

APPARAAT GEGEVENS BIJWERKEN
U kunt apparaatgegevens bijwerken zonder opnieuw te koppelen:
1. Ga naar apparaat Instellingen in Homey app
2. Scroll naar boven naar de verbindingsinstellingen
3. Werk gegevens bij (lokaal IP-adres, Lokale Sleutel, Apparaat ID, Protocolversie)
4. Klik op "Opslaan" - apparaat verbindt automatisch opnieuw

HULP NODIG?
- Documentatie: Bekijk de /docs map in de broncode op GitHub voor gedetailleerde informatie
- Configuratiegids: /docs/setup/advanced-settings/CONFIGURATION_GUIDE.nl.md (complete instellingen referentie)
- Community: Homey Community Forum (Topic ID: 143690)
- Issues: Meld problemen op GitHub