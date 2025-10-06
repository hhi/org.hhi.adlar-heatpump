ADLAR CASTRA WARMTEPOMP - HOMEY APP

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
4. Voltooi het koppelingsproces

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
- Geen verbinding: Controleer IP-adres en lokale sleutel
- Wisselende waarden: Normaal tijdens opstarten van het systeem
- Foutcodes: Zie de app voor specifieke uitleg per foutcode

HULP NODIG?
- Documentatie: Bekijk de /docs map in de broncode op Github voor gedetailleerde informatie
- Community: Homey Community Forum (Topic ID: 140621)
- Issues: Meld problemen op GitHub

GEAVANCEERDE FUNCTIES

FLOW KAART CATEGORIEËN
U kunt de zichtbaarheid van flow kaarten aanpassen (app instellingen):
- Temperatuur waarschuwingen
- Spanning en stroom monitoring
- Vermogen waarschuwingen
- Systeemstatus wijzigingen
- Efficiëntie monitoring
- Expert functies

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
