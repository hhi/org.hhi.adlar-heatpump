# Snelle Oplossing voor ECONNRESET Verbindingsproblemen

## 🚨 Voor Gebruikers met Verbindingsresets

Als je warmtepomp steeds de verbinding verbreekt met ECONNRESET fouten, is het probleem waarschijnlijk een **protocol versie mismatch**.

## ✅ Oplossing: Wijzig Protocol Versie naar 3.4

### Stappen (Duurt 2 minuten):

1. Open **Homey app** → Ga naar je warmtepomp apparaat
2. Tik op **⚙️ Instellingen** (rechtsboven)
3. Scroll naar **boven** naar de verbindingsinstellingen sectie
4. Werk je instellingen bij:
   - **Protocol Versie: SELECTEER 3.4** ← **WIJZIG DIT**
   - Device ID: *(behoud hetzelfde of update indien nodig)*
   - Local Key: *(behoud hetzelfde of update indien nodig)*
   - IP-adres: *(behoud hetzelfde of update indien nodig)*
5. Tik op **Opslaan**
6. Wacht 1-2 minuten voor herverbinding

### Verwacht Resultaat:
- ✓ Verbindingsstatus toont "connected"
- ✓ Geen ECONNRESET fouten meer
- ✓ Sensordata updatet soepel
- ✓ Apparaat blijft verbonden

### Werkt het Nog Steeds Niet?
Probeer protocol versie **3.5** via dezelfde stappen (wijzig Protocol Versie in Instellingen naar 3.5).

### Waarom Gebeurt Dit?
Verschillende warmtepomp modellen gebruiken verschillende Tuya protocol versies. De app gebruikte standaard 3.3, maar veel nieuwere modellen hebben 3.4 of 3.5 nodig.

---
