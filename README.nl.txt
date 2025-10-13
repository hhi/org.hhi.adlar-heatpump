Deze app geeft u volledige controle over uw Adlar Castra Aurora warmtepomp rechtstreeks via uw Homey smart home systeem. U kunt uw warmtepomp monitoren, bedienen en optimaliseren zonder afhankelijk te zijn van internetverbindingen.

BELANGRIJKSTE VOORDELEN

LOKALE CONTROLE
- Rechtstreekse verbinding met uw warmtepomp via het lokale netwerk
- Geen internetverbinding nodig voor dagelijks gebruik
- Snelle reactietijden en betrouwbare verbinding

GEAVANCEERDE MONITORING
- Real-time temperatuurmetingen (12 verschillende sensoren)
- Stroomverbruik en efficiëntie monitoring
- Automatische COP (prestatiecoëfficiënt) berekening met 8 verschillende methoden
- Seizoensgebonden SCOP analyse volgens Europese normen

VOLLEDIGE BEDIENING
- Temperatuur instelling en verwarmingsmodi
- Stooklijn (verwarmingscurve) aanpassingen
- Warmwater temperatuur controle
- Timer en automatische functies

INTELLIGENTE AUTOMATISERING
- 67 flow kaarten voor geavanceerde automatisering
- Slimme foutdetectie en herstel
- Weersafhankelijke optimalisatie
- Energie-efficiëntie trends en waarschuwingen

GEBRUIKSVRIENDELIJK
- Volledig Nederlandse interface (Engels/Nederlands)
- Mobielvriendelijke weergave
- Duidelijke status indicatoren
- Begrijpelijke foutmeldingen

INSTALLATIE

WAT HEEFT U NODIG?
- Homey Pro (firmware versie 12.2.0 of hoger)
- Adlar Castra Aurora warmtepomp
- Lokale netwerkverbinding met de warmtepomp
- Apparaat gegevens (ID, Lokale Sleutel, IP-adres)

HOE VERKRIJGT U DE APPARAAT GEGEVENS?
De benodigde lokale sleutel en andere gegevens kunt u verkrijgen door de instructies te volgen in:
docs/Get Local Keys - instruction.pdf

INSTALLATIESTAPPEN
1. Installeer de app via de Homey App Store
2. Voeg een nieuw apparaat toe en selecteer "Intelligent Heat Pump"
3. Voer uw apparaat gegevens in:
   - Apparaat ID
   - Lokale Sleutel
   - IP-adres
   - Protocolversie (kies 3.3, 3.4 of 3.5)
4. Voltooi het koppelingsproces

PROTOCOLVERSIE SELECTIE
De protocolversie bepaalt hoe de app communiceert met uw warmtepomp:
- 3.3 (Standaard): Werkt voor de meeste Adlar/Aurora warmtepompen
- 3.4: Vereist voor sommige nieuwere modellen
- 3.5: Vereist voor nieuwste firmware versies

Bij verbindingsproblemen (frequente onderbrekingen, ECONNRESET fouten),
probeer een andere protocolversie via apparaatreparatie (zie Troubleshooting).

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

COP (PRESTATIECOËFFICIËNT) MONITORING

De app berekent automatisch hoe efficiënt uw warmtepomp werkt (zie de directory /docs/COP calculation/ in de broncode):
- COP waarde: Verhouding tussen opgewekte warmte en verbruikte stroom
- Dagelijkse gemiddelden: 24-uurs trends
- Wekelijkse analyse: Langetermijn prestaties
- Seizoensgebonden monitoring: SCOP volgens Europese normen
- Diagnostische feedback: Wat beïnvloedt de efficiëntie

WAT BETEKENEN COP WAARDEN?
- COP 2.0-3.0: Gemiddelde prestatie
- COP 3.0-4.0: Goede prestatie
- COP 4.0+: Uitstekende prestatie

TROUBLESHOOTING EN ONDERSTEUNING

VEELVOORKOMENDE PROBLEMEN

Verbindingsproblemen (ECONNRESET Fouten)
Als uw apparaat steeds opnieuw verbinding verbreekt of reset fouten toont:

SNELLE OPLOSSING (duurt minder dan 2 minuten):
1. Open apparaat Instellingen in Homey app
2. Scroll naar boven naar de verbindingsinstellingen
3. Wijzig Protocolversie naar 3.4 (of probeer 3.5 als 3.4 niet werkt)
4. Optioneel: werk andere gegevens bij (IP-adres, Lokale Sleutel, Apparaat ID)
5. Klik op "Opslaan" en wacht 1-2 minuten voor herverbinding

Succes indicatoren:
- Verbindingsstatus toont "verbonden"
- Geen ECONNRESET fouten meer
- Sensor gegevens worden normaal bijgewerkt
- Apparaat blijft beschikbaar

Andere Veelvoorkomende Problemen:
- Geen verbinding: Controleer IP-adres, lokale sleutel en netwerkverbinding
- Wisselende waarden: Normaal tijdens opstarten van het systeem
- Foutcodes: Zie de app voor specifieke uitleg per foutcode
- Koppelen mislukt: Probeer verschillende protocolversies (3.3, 3.4, 3.5)

APPARAAT GEGEVENS BIJWERKEN
U kunt apparaatgegevens bijwerken zonder opnieuw te koppelen:
1. Ga naar apparaat Instellingen in Homey app
2. Scroll naar boven naar de verbindingsinstellingen
3. Werk gegevens bij (IP-adres, Lokale Sleutel, Apparaat ID, Protocolversie)
4. Klik op "Opslaan" - apparaat verbindt automatisch opnieuw

HULP NODIG?
- Documentatie: Bekijk de /docs map in de broncode op Github voor gedetailleerde informatie
- Community: Homey Community Forum (Topic ID: 143690)
- Issues: Meld problemen op GitHub

GEAVANCEERDE FUNCTIES

APPARAAT INSTELLINGEN (Configureer per apparaat)
Toegang via apparaat Instellingen in Homey app:

Verbindingsinstellingen:
- Protocolversie: Tuya protocolversie (3.3, 3.4, 3.5)
- Apparaat ID, Lokale Sleutel, IP-adres: Verbindingsgegevens

COP Berekeningsinstellingen:
- COP berekening in-/uitschakelen
- Externe vermogensmetingintegratie
- Externe doorstroomgegevens integratie
- Externe buitentemperatuur integratie

Flow Kaart Controle:
U kunt regelen welke flow kaarten zichtbaar zijn (uitgeschakeld/auto/ingeschakeld):
- Temperatuurwaarschuwingen: Temperatuurdrempel meldingen
- Spanning/stroommonitoring: Elektrisch systeem monitoring
- Vermogenwaarschuwingen: Stroomverbruik meldingen
- Systeemstatuswijzigingen: Compressor, ontdooien, systeem toestanden
- Efficiëntiemonitoring: COP trends en afwijkingen
- Expertfuncties: Geavanceerde diagnostische flow kaarten

Auto Modus (aanbevolen):
Toont alleen flow kaarten voor sensoren met adequate gegevens (recent bijgewerkt, geen fouten).

Curve Controles (optioneel):
- Schakel picker controles in voor verwarmings- en warmwatercurves
- Standaard: Uitgeschakeld (sensoren altijd zichtbaar, pickers verborgen)
- Inschakelen voor gevorderde gebruikers die directe curve aanpassing willen

Vermogensmetingsinstellingen:
- Vermogensmetingen van warmtepomp in-/uitschakelen
- Beheert automatisch gerelateerde flow kaart zichtbaarheid
- Nuttig als u externe vermogensmonitoring heeft

CROSS-APP INTEGRATIE
Verbind met andere Homey apps voor verbeterde COP berekening (zie /docs/COP flow-card-setup.md):
- Externe vermogensmetingen (van uw slimme meter)
- Externe water doorstroom gegevens
- Externe buitentemperatuur gegevens

VEILIGHEID EN BETROUWBAARHEID

AUTOMATISCHE MONITORING
- Kritieke temperatuur waarschuwingen
- Verbindingsstatus controle
- Systeemfout detectie
- Systeem timer meldingen

INTELLIGENTE HERSTEL
- Automatische herverbinding
- Foutcorrectie
- Status herstel
- Gebruiksvriendelijke foutmeldingen
