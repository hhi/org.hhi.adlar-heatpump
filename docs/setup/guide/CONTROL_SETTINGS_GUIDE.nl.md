# Adaptieve regeling instellen

Een handleiding voor de instellingen van de adaptieve regeling: de zes groepen
waarvan de titel met **Adaptieve regeling** begint. Welke keuze u maakt, welke
instellingen daarbij meetellen en welke u kunt laten staan. Geldt voor versie 3.6.2 en voor alle drie de drivers (Tuya,
Aurora I/II en Aurora III); verschillen staan bij [Verschillen per
driver](#verschillen-per-driver).

## Inhoud

- [In het kort](#in-het-kort)
- [Stap voor stap](#stap-voor-stap)
- [Welke instelling telt bij welke regelmodus](#welke-instelling-telt-bij-welke-regelmodus)
- [Klassiek en Positioneel](#klassiek-en-positioneel)
- [De stooklijn bij Positioneel](#de-stooklijn-bij-positioneel)
- [Coast](#coast)
- [De instellingen één voor één](#de-instellingen-één-voor-één)
- [Buitentemperatuur](#buitentemperatuur)
- [Verschillen per driver](#verschillen-per-driver)
- [Vragen](#vragen)

## In het kort

- De app berekent elke 5 minuten een **advies** voor de watertemperatuur. U
  ziet het in **Gesimuleerde Doeltemperatuur** (`adlar_simulated_target`).
- Het advies verandert niets aan de warmtepomp. Pas een flow die het advies
  uitvoert, maakt het een regeling.
- De warmtepomp houdt een setpoint van buitenaf alleen vast als zijn eigen
  stooklijnkeuze op **OFF** staat (Aurora I/II: stooklijnkeuze; Tuya:
  verwarmingscurve).
- Met de **regelmodus** kiest u hoe het advies wordt berekend. Bij elke modus
  telt maar een deel van de instellingen; de rest kunt u laten staan.

## Stap voor stap

### 1. Voorwaarden

- Een flow die elke paar minuten de binnentemperatuur stuurt met de kaart
  **Stuur binnentemperatuur naar warmtepomp**. Zonder binnentemperatuur start de
  regeling niet.
- Schakel **Adaptieve regeling aan** in. Staat die uit, dan wordt er geen
  advies berekend en tellen de overige instellingen niet.
- Het kamerdoel is **Binnentemperatuur gewenst** op het apparaat. U stelt het
  daar in of met de kaart **Gewenste binnentemperatuur instellen** (15–25 °C).
  Zonder kamerdoel slaat de regeling elke cyclus over.

### 2. Alleen advies of echt regelen?

| U wilt | Wat u doet |
| --- | --- |
| Eerst kijken wat de app zou doen | Geen uitvoerende flow. Laat de stooklijnkeuze van de warmtepomp zoals hij is |
| De app laten regelen | Een flow met de trigger **Adaptieve regeling beveelt temperatuur aanpassing aan** die de doeltemperatuur van de warmtepomp op `recommended_temperature` zet. Zet de stooklijnkeuze van de warmtepomp op **OFF** |

Kijk in beide gevallen eerst een dag mee. Vergelijk het advies met wat de
warmtepomp nu zelf doet.

Bij Positioneel zonder uitvoerende flow staat het I-deel stil zodra het setpoint
van de warmtepomp meer dan 1 °C van het advies afwijkt. U ziet dan vooral de
stooklijn plus het P-deel, niet hoe de regeling op den duur bijstuurt.

### 3. Regelmodus kiezen

| Situatie | Regelmodus |
| --- | --- |
| U regelt al met de app en het werkt goed | Klassiek |
| Radiatoren of ventilatorconvectoren, setpoint kruipt weg of slingert | Positioneel – Radiatoren |
| Vloerverwarming, setpoint kruipt weg of slingert | Positioneel – Vloerverwarming |
| Gemengd: vloer en radiatoren | Positioneel – Vloerverwarming als de vloer de grootste of traagste afgifte is, anders – Radiatoren |
| U wilt zelf Kp, Ti of coast kiezen | Positioneel – Handmatig |

De positionele modi zijn **experimenteel**: in de simulatie beter dan Klassiek,
in de praktijk nog weinig getest. Terugzetten kan altijd.

### 4. Stooklijn kiezen (alleen Positioneel)

| Wat de warmtepomp nu gebruikt | Wat u kiest |
| --- | --- |
| Een vaste curve (HH1–HH8, HL1–HL8; Tuya H1–H8, L1–L8) | **Eenmalig overnemen in de app-stooklijn** → die curve. Daarna de stooklijnkeuze op OFF |
| Een eigen DIY-stooklijn (Aurora I/II, L28/L29) | Eén keer overnemen met **Eenmalig overnemen in de app-stooklijn** → **DIY-stooklijn**, of steeds volgen met **Basis van het advies** → **Stooklijn van de warmtepomp (steeds gevolgd)**. Zie [Eenmalig overnemen of steeds volgen](#eenmalig-overnemen-of-steeds-volgen) |
| Weet ik niet | Niets: de app vult bij de keuze van de regelmodus een startstooklijn in |

### 5. Grenzen

Stel **Laagste** en **Hoogste watertemperatuur in het advies** in. Bij vloerverwarming:
rond het bereik van uw eigen stooklijn, bijvoorbeeld 2 °C eronder en 3 °C
erboven, met ruimte voor koud weer.

### 6. Controleren

- **Gesimuleerde Doeltemperatuur**: volgt het advies de buitentemperatuur
  ongeveer zoals uw stooklijn?
- **Adaptieve Controle Diagnostiek** (`adaptive_control_diagnostics`): toont de
  modus, Kp en Ti met hun bron, de basis (stooklijn) met zijn bron en de P- en
  I-term.
- Ligt de I-term dagenlang boven 0, dan staat de stooklijn te laag; onder 0 te
  hoog. Zie [Stooklijn bijstellen](#stooklijn-bijstellen).

## Welke instelling telt bij welke regelmodus

Homey toont altijd alle instellingen. Ze staan in zes groepen; de titel van een
groep zegt bij welke regelmodus hij telt. Deze tabel laat zien welke meetellen.

| Groep: instellingen | Klassiek | Positioneel – Radiatoren / Vloerverwarming | Positioneel – Handmatig |
| --- | --- | --- | --- |
| Adaptieve regeling: aan, regelmodus, laagste en hoogste watertemperatuur | Ja | Ja | Ja |
| Stooklijn (Positioneel): basis van het advies, eenmalig overnemen, water bij −15 °C en +15 °C | Nee | Ja | Ja |
| Fijnafstelling (Positioneel – Handmatig): Kp, Ti | Nee | Nee, vaste waarden | Ja |
| Fijnafstelling (Klassiek): Kp, Ki, dode zone | Ja | Nee | Nee |
| Coast (Klassiek, Positioneel – Handmatig) | Ja | Nee, coast staat altijd uit | Ja |
| Wegingsfactoren: Comfort, Gebouwmodel | Ja | Nee | Nee |
| Wegingsfactoren: Efficiëntie, Kosten | Ja | Ja, alleen voor de verschuiving van het kamerdoel | Ja, idem |

## Klassiek en Positioneel

### Klassiek

Elke 5 minuten berekent de app een kleine correctie en telt die op bij het
huidige advies. Die stappen tellen op: na een koude nacht kan het advies ver
omhoog zijn gelopen, en het duurt even voordat het weer zakt. Binnen de dode zone
(standaard 0,3 °C) verandert er niets. Klassiek heeft geen stooklijn nodig.

### Positioneel

Het advies wordt elke 5 minuten opnieuw berekend uit drie delen:

1. **Basis**: de watertemperatuur die bij de buitentemperatuur hoort, uit een
   stooklijn.
2. **P-deel**: Kp × (kamerdoel − binnentemperatuur). Reageert direct.
3. **I-deel**: groeit langzaam zolang het te koud of te warm blijft, en werkt
   zo een stooklijn weg die iets te hoog of te laag staat. Ti bepaalt hoe
   langzaam.

Voorbeeld: buiten 5 °C, stooklijn 50 / 35 geeft een basis van 40 °C. Binnen
20,5 °C bij een kamerdoel van 21 °C geeft een P-deel van 3 × 0,5 = 1,5 °C. Het
advies is dan 41,5 °C plus het I-deel, afgerond op hele graden.

Grenzen: het P- en I-deel samen maximaal ±8 °C, het I-deel alleen maximaal
±6 °C. Het I-deel staat stil bij een afwijking tot 0,1 °C, tijdens ontdooien en
tapwater, op een grens, en zolang de warmtepomp het vorige advies nog niet heeft
overgenomen.

### De drie positionele varianten

| | Radiatoren | Vloerverwarming | Handmatig |
| --- | --- | --- | --- |
| Kp | 3 | 3 | Instelling, standaard 3 |
| Ti | 3 uur | 6 uur | Instelling, standaard 3 uur |
| Coast | Uit | Uit | Schakelaar **Coast aan**, **standaard aan** |
| Startstooklijn | 50 / 35 | 35 / 27 | Geen |

Alleen Ti verschilt tussen de afgiftesystemen: een vloer reageert pas na uren,
dus het I-deel moet langzamer groeien. Kp maakt per afgiftesysteem weinig uit.

Let op bij **Handmatig**: met de standaardwaarden is het gelijk aan Radiatoren,
**maar met coast aan**. Wilt u dat niet, zet dan **Coast aan** uit.

## De stooklijn bij Positioneel

### App-stooklijn

Een rechte lijn door twee punten: de watertemperatuur bij −15 °C en bij +15 °C
buiten. Tussen die punten rekent de app de waarde uit; daarbuiten loopt de lijn
door, binnen de grenzen.

Wanneer u een positionele regelmodus kiest, vult de app een startstooklijn in
(Radiatoren 50 / 35, Vloerverwarming 35 / 27). Dat gebeurt alleen zolang u de
twee waarden nooit zelf heeft veranderd. Hebt u ze één keer aangepast of laten
invullen vanuit een vaste curve, dan blijven ze staan, ook als u later van modus
wisselt.

### Vaste curve overnemen

**Eenmalig overnemen in de app-stooklijn** vult de twee waarden één keer
in vanuit een curve van de warmtepomp. Daarna springt de lijst terug naar "—".
Open de instellingen opnieuw om de nieuwe waarden te zien.

| Curve | −15 °C | +15 °C | Curve | −15 °C | +15 °C |
| --- | --- | --- | --- | --- | --- |
| HH1 | 54 | 51 | HL1 | 37 | 33 |
| HH2 | 54 | 46 | HL2 | 34 | 31 |
| HH3 | 53 | 42 | HL3 | 32 | 30 |
| HH4 | 49 | 46 | HL4 | 34 | 29 |
| HH5 | 49 | 41 | HL5 | 32 | 29 |
| HH6 | 44 | 41 | HL6 | 30 | 27 |
| HH7 | 44 | 36 | HL7 | 28 | 27 |
| HH8 | 39 | 36 | HL8 | 28 | 25 |

De vaste curves zijn trappen met treden van 1 °C. De waarden volgen het midden
van die trap, afgerond op hele graden.

Aurora I/II met een DIY-stooklijn: kies **DIY-stooklijn van de warmtepomp
(L28/L29)**. De app neemt L29 over als waarde bij −15 °C en L29 + 30 × L28 als
waarde bij +15 °C. Voorbeeld: L28 = −0,5 en L29 = 55 geeft 55 / 40. Kan de app
de DIY-stooklijn nog niet lezen of is hij niet bruikbaar, dan krijgt u een
melding en verandert er niets.

### Eenmalig overnemen of steeds volgen

Bij de Aurora I/II kunt u een DIY-stooklijn op twee manieren gebruiken:

| | Eenmalig overnemen | Steeds volgen |
| --- | --- | --- |
| Instelling | Eenmalig overnemen in de app-stooklijn → **DIY-stooklijn van de warmtepomp** | Basis van het advies → **Stooklijn van de warmtepomp (steeds gevolgd)** |
| Wat de app doet | Zet de DIY-waarden één keer in de app-stooklijn | Rekent elke cyclus met de DIY-stooklijn van de warmtepomp |
| Buitentemperatuur | Die van de app (zie [Buitentemperatuur](#buitentemperatuur)) | De sensor van de warmtepomp |
| U past de DIY-stooklijn later aan | De app neemt het niet mee; opnieuw overnemen | De app volgt direct |
| DIY staat uit of is onbruikbaar | Melding bij opslaan, er verandert niets | De app rekent zonder melding met de app-stooklijn |

U kunt beide combineren: eerst overnemen, dan volgen. Valt het volgen weg, dan
rekent de app met dezelfde stooklijn verder.

Bij de Aurora III betekent **Stooklijn van de warmtepomp** de klimaatcurve van de
warmtepomp. Kies dit alleen als u die curve zelf heeft ingesteld. Tuya heeft deze
keuze niet.

### Stooklijn bijstellen

| Wat u merkt | Aanpassing |
| --- | --- |
| Te koud bij vorst, goed bij zacht weer | Waarde bij −15 °C 1–2 °C hoger |
| Te koud bij zacht weer | Waarde bij +15 °C 1–2 °C hoger |
| Overal iets te koud | Beide waarden 1 °C hoger |
| Te warm | Omgekeerd: verlagen |

Pas één waarde per keer aan en wacht een dag (vloerverwarming: twee dagen).

## Coast

### Wat coast doet

Coast laat het huis passief afkoelen als het te warm wordt. Is de kamer twee
cycli achter elkaar meer dan de startdrempel (**Coast: startdrempel boven
gewenst**, standaard 0,3 °C) boven het kamerdoel en daalt hij niet, dan trekt
coast het advies naar de huidige watertemperatuur min **Coast: advies onder de
watertemperatuur** (standaard 1 °C). De warmtepomp stopt dan met stoken.

Coast stopt als de kamer onder het kamerdoel plus de halve startdrempel komt
(standaard 21,15 °C bij een doel van 21 °C), als de kamer daalt en coast nog
nauwelijks iets doet, of na het maximale aantal cycli (Aurora: standaard 24,
2 uur).

### Waarom Positioneel zonder coast

**Waarvoor coast bedoeld was.** Klassiek telt elke 5 minuten een kleine stap
op bij het advies. Na een koude periode is het advies zo ver opgelopen. Wordt
het daarna te warm, dan moeten al die stappen eerst weer terug, en intussen
blijft de warmtepomp stoken: de kamer schiet door. Coast is als noodrem
toegevoegd: het trekt het advies onder de watertemperatuur, zodat de compressor
stopt.

**Waarom Positioneel die noodrem niet nodig heeft.** Positioneel berekent het
advies elke cyclus opnieuw vanaf de stooklijn. Er zijn geen opgetelde stappen
die eerst terug moeten. Wordt het te warm, dan is het P-deel meteen negatief:
0,5 °C te warm geeft in dezelfde cyclus een advies dat 1,5 °C lager ligt, 1 °C
te warm 3 °C lager. Het I-deel daalt daarna langzaam mee.

**Wat coast bij Positioneel misgaat.** Coast richt zich op de watertemperatuur
min 1 °C, en die watertemperatuur beweegt met de compressor mee:

1. De kamer is te warm. Coast trekt het advies omlaag en de compressor stopt.
2. Coast eindigt. Het advies springt in één cyclus terug naar stooklijn plus
   P- en I-deel, in de simulatie tot 9 °C hoger.
3. De compressor start weer en de watertemperatuur stijgt boven het advies.
   Daardoor valt coast weg zolang de compressor draait, en grijpt het weer in
   zodra hij stopt.
4. Staat de stooklijn iets te hoog, dan blijft de kamer te warm en herhalen
   stap 1 tot 3 zich.

In de simulatie gaf dat 14–23 compressorstarts per dag. Veel korte starts
verslijten de compressor en kosten rendement.

**Wat de toets liet zien.** 24 gesimuleerde situaties: drie woningen (gemiddeld,
licht, zwaar), mild en koud weer, vier stooklijnen (passend, 35 / 27, HL2 te
hoog, HL8 te laag), elk 14 dagen. Coast uit tegen coast aan:

| Uitkomst | Aantal |
| --- | --- |
| Coast uit beter | 11 |
| Gelijk | 9 |
| Coast uit iets slechter | 4, alle met de te lage stooklijn HL8: tot ongeveer 1 uur per dag meer dan 0,5 °C te koud bij mild weer |

Met coast uit startte de compressor gemiddeld 0,4 keer per dag, met coast aan
2,9 keer. Een sprong van meer dan 1 °C in het advies kwam met coast uit niet
voor. Bij een te lage stooklijn is de oplossing de stooklijn verhogen, niet
coast.

**Wat is geprobeerd om coast te houden.** Het coast-doel vastzetten op zijn
laagste waarde (slechter), het advies na coast geleidelijk laten stijgen (helpt
nauwelijks), en alleen het I-deel pauzeren zonder het advies omlaag te trekken
(slechter bij een te hoge stooklijn).

**Geschiedenis.** In 3.5.0 en 3.5.1 stond coast bij Vloerverwarming aan. Die
keuze kwam uit simulaties met een stooklijn die precies past; daar maakt coast
weinig uit. Met de app-stooklijn met twee punten, zoals gebruikers die hebben,
bleek het slingeren. Sinds 3.5.2 staat coast bij beide presets uit.

**Toch coast?** Kies Positioneel – Handmatig en schakel **Coast aan** in. Het slingeren
hierboven blijft dan mogelijk. Er is geen situatie getoetst waarin coast bij
Positioneel beter uitkomt.

De presets zetten coast uit, wat de schakelaar **Coast aan** ook zegt. Bij Klassiek en
Handmatig geldt de schakelaar wel.

## De instellingen één voor één

In de volgorde van de groepen.

| Instelling | Wat het doet | Telt bij | Standaard |
| --- | --- | --- | --- |
| **Groep Adaptieve regeling** | | | |
| Adaptieve regeling aan | Zet de berekening van het advies aan | Alle | Uit |
| Regelmodus | Klassiek of een van de drie positionele varianten | Alle | Klassiek |
| Laagste watertemperatuur in het advies | Laagste advies; stem af op P111 | Alle | 18 °C |
| Hoogste watertemperatuur in het advies | Hoogste advies; minstens 2 °C boven het minimum | Alle | 60 °C (Tuya 65 °C) |
| **Groep stooklijn (Positioneel)** | | | |
| Basis van het advies | App-stooklijn of stooklijn van de warmtepomp (steeds gevolgd) | Positioneel | App-stooklijn |
| Eenmalig overnemen in de app-stooklijn | Vult de twee waarden hieronder één keer in | Positioneel | — |
| App-stooklijn: water bij −15 °C / +15 °C buiten | De twee punten van de app-stooklijn | Positioneel | 45 / 30, of de startstooklijn van de modus |
| **Groep fijnafstelling (Positioneel – Handmatig)** | | | |
| Kp: graden water per graad binnen | Graden watertemperatuur per graad afwijking binnen | Handmatig | 3 |
| Ti: integratietijd | Hoe langzaam het I-deel groeit | Handmatig | 3 uur |
| **Groep fijnafstelling (Klassiek)** | | | |
| Kp: proportionele versterking | Grootte van de correctie per graad afwijking | Klassiek | 5,0 |
| Ki: integrale versterking | Hoe sterk een blijvende afwijking wordt bijgestuurd | Klassiek | 1,5 |
| Dode zone | Afwijking waarbinnen niets verandert | Klassiek | 0,3 °C |
| **Groep coast** | | | |
| Coast aan | Coast aan of uit | Klassiek, Handmatig | Aan |
| Coast: advies onder de watertemperatuur | Hoeveel graden onder de watertemperatuur coast richt | Klassiek, Handmatig | 1 °C |
| Coast: startdrempel boven gewenst | Marge boven het kamerdoel voordat coast begint | Klassiek, Handmatig | 0,3 °C |
| Coast: aandeel in het advies | Hoe zwaar coast meeweegt | Klassiek, Handmatig | 0,80 |
| Coast: maximale duur (Aurora) | Maximaal aantal cycli van 5 minuten | Klassiek, Handmatig | 24 |
| **Groep wegingsfactoren** | | | |
| Comfort | Gewicht van de temperatuurregeling; bij Positioneel de ruimte voor Efficiëntie en Kosten | Alle | 50 % |
| Efficiëntie | Gewicht van de COP-optimalisatie | Alle | 15 % |
| Kosten | Gewicht van de prijsoptimalisatie | Alle | 15 % |
| Gebouwmodel — alleen Klassiek | Gewicht van het gebouwmodel | Klassiek | 20 % |

De wegingsfactoren worden samen naar 100 % omgerekend. Efficiëntie en Kosten doen
alleen iets als de COP- of prijsoptimalisatie aan staat. Bij Positioneel
verschuiven ze het kamerdoel, met hooguit 1,5 °C; de stooklijn schuift mee.
Comfort bepaalt daar hoeveel ruimte ze krijgen: een lagere waarde geeft ze meer
ruimte.

## Buitentemperatuur

De regeling, en vooral de stooklijn bij Positioneel, rekent met de
buitentemperatuur. De app neemt de eerste die beschikbaar is:

1. de buitentemperatuur van een flowkaart, als die minder dan 1 uur oud is;
2. de weersvoorspelling van Open-Meteo voor het huidige uur;
3. de buitensensor van de warmtepomp.

Staat de locatie nog op de standaardwaarde (Amsterdam), dan gaat de
buitensensor van de warmtepomp vóór de weersvoorspelling (sinds v3.7.1).

De weersvoorspelling wordt elk uur opgehaald, ook als **Weersvoorspelling
integratie inschakelen** uit staat; die schakelaar toont of verbergt alleen de
voorspellingssensoren. De voorspelling geldt voor de locatie in de instellingen. Vul daar uw eigen locatie
in, of stuur de buitentemperatuur minstens elk uur via een flowkaart.

Uitzondering: **Stooklijn van de warmtepomp** rekent met de buitensensor van de
warmtepomp.

## Verschillen per driver

| | Tuya | Aurora I/II | Aurora III |
| --- | --- | --- | --- |
| Basis van het advies | Niet aanwezig: altijd de app-stooklijn | App-stooklijn of DIY-stooklijn | App-stooklijn of klimaatcurve |
| Eenmalig overnemen | H1–H8, L1–L8 | HH1–HH8, HL1–HL8 en DIY (L28/L29) | Niet aanwezig |
| Coast: maximale duur | Niet instelbaar | Instelbaar | Instelbaar |
| Hoogste watertemperatuur in het advies | 25–65 °C, standaard 65 °C | 25–60 °C, standaard 60 °C | 25–60 °C, standaard 60 °C |
| Setpoint blijft alleen staan bij | Verwarmingscurve OFF | Stooklijnkeuze OFF | — |

## Vragen

**Het advies verandert, maar de warmtepomp niet.**
Er is geen flow die het advies uitvoert, of de stooklijnkeuze van de warmtepomp
staat niet op OFF.

**Het setpoint springt na een tijdje terug.**
De stooklijnkeuze (Tuya: verwarmingscurve) staat niet op OFF. De warmtepomp zet
dan zijn eigen stooklijnwaarde terug.

**Het advies staat stil.**
Staat **Adaptieve regeling aan** aan, komt de binnentemperatuur binnen, en
heeft **Binnentemperatuur gewenst** een waarde? Zonder die drie wordt er geen
nieuw advies berekend. De regeling meldt dat alleen in de debuglog.

**Ik heb Kp aangepast, maar er verandert niets.**
Bij Positioneel telt **Kp: proportionele versterking** (groep fijnafstelling
Klassiek) niet; daar geldt **Kp: graden water per graad binnen**, en alleen bij
Handmatig.

**Ik heb een instelling opgeslagen, maar er verandert niets.**
Open het instellingenscherm opnieuw en kijk of de waarde bewaard is. Na een
foutmelding toont het scherm soms nog de ingevulde waarde, terwijl de app de
oude houdt. Vóór 3.6.2 blokkeerde een vergeetfactor onder 0,9985 elke opslag;
3.6.2 zet zo'n waarde op 0,999.

**Ik heb coast uitgezet, of aangezet, maar er verandert niets.**
Bij Positioneel – Radiatoren en – Vloerverwarming staat coast altijd uit.

**Na het kiezen van een regelmodus staan de stooklijnwaarden niet op 50 / 35.**
U heeft de waarden eerder zelf aangepast of laten invullen vanuit een vaste
curve. De app overschrijft uw eigen stooklijn niet.

**Het advies ligt ver van wat de warmtepomp nu doet.**
De stooklijn van de app wijkt af van die van de warmtepomp. Neem de stooklijn
van de warmtepomp over (zie [Stooklijn kiezen](#4-stooklijn-kiezen-alleen-positioneel)).
Controleer ook de locatie voor de buitentemperatuur.
