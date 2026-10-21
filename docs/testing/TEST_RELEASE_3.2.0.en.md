# Test version 3.2.0 — Aurora III via Modbus

Version 3.2.0 of **Adlar Castra Heatpump** adds a driver for the **Aurora III / PRO via Modbus**. It replaces the separate app *Adlar Castra Heatpump (Aurora-III Modbus)*. Before 3.2.0 goes live, I am looking for testers with real hardware.

## Who

| You have | What you test |
|---|---|
| An Aurora III / PRO with a Modbus gateway (e.g. Elfin EW11A) | Everything below, especially A to E |
| An Aurora I/II via Modbus or via Tuya | F: does everything keep working after the update? |
| The old Aurora III app in use | G: moving over with the migration guide |

## Before you start

- **This is a test version.** Going back to the current version (3.1.4) is not automatic. An Aurora III device paired in the test version stops working after going back.
- **Take screenshots** of your flows and device settings first.
- **Do not let the old Aurora III app and the new driver talk to the same heat pump at the same time.** Stop the old app first (step G). Two apps polling and writing through one gateway cause failures.
- **The drivers have new names.** Under *Add device* you will see *Aurora I/II via Tuya*, *Aurora I/II via Modbus* and *Aurora III via Modbus*. Existing devices keep their own names.

## Install

1. Open the test link: <https://homey.app/a/org.hhi.adlar-heatpump/test/>
2. Install test version 3.2.0.
3. For the Aurora III device, set **Settings → Diagnostics → Log Level** to *DEBUG* while testing.

## What to test

For each step, note: ✅ works, ❌ does not work (what did you see?), or ➖ not tested.

### A. Pairing (Aurora III)

1. Gateway set to `9600 8N2`, `Serial protocol` = `Modbus` — see the [Elfin guide](https://github.com/hhi/org.hhi.adlar-heatpump/blob/main/docs/setup/modbus-elfin-ew11-setup.md) (Dutch).
2. *Add device* → **Aurora III via Modbus** → enter IP address, port and Unit ID.
3. Does the device appear, and do values come in within a minute?

### B. Compare values

Compare Homey and the dashboard `http://<homey-ip>:8091/live` with the display or controller of the heat pump:

- supply (TA), return (TE1) and outdoor temperature (T4)
- operating mode (Off / Cooling / Heating / Auto)
- compressor frequency and compressor running/stopped
- hot water tank temperature (TZ2), if you have hot water

### C. Control

Change via Homey (or `http://<homey-ip>:8091/interactive`) and check on the heat pump:

1. Heating setpoint
2. Silent mode (Off / Level 1; Level 2 only on R290)
3. Hot water function on/off
4. Forced backup heater — **only if you deliberately want to test this**, and switch it off afterwards

### D. Flows

1. Trigger **Heating mode changed**: does it fire when you change the mode, and is the tag *Cooling* / *Heating* / *Off* / *Auto*?
2. Conditions **Silent mode is** and **Heating mode is**
3. Action **Set target (setpoint) temperature** for the Aurora III device

### E. Power measurement (Aurora III only)

Switch on **Enable internal power measurement capabilities** (app restart required). Can you then select the trigger **Power threshold exceeded** for the Aurora III device in a flow?

### F. Existing Aurora I/II and Tuya devices

1. Do your existing devices and flows work unchanged after the update?
2. Does the dashboard `http://<homey-ip>:8090/` (Aurora I/II via Modbus) still work?

### G. Moving over from the old Aurora III app

Follow the [migration guide](https://github.com/hhi/org.hhi.adlar-heatpump/blob/main/docs/setup/MIGRATION_AURORA3.en.md). Was it clear enough, and is anything missing?

## Reporting

Reply in this topic with:

```text
Model:            Aurora III / PRO / Aurora I/II   (refrigerant: R32 / R290)
Gateway:          (e.g. Elfin EW11A, firmware version)
Connection:       Modbus / Tuya
App version:      3.2.0
A Pairing:        ✅ / ❌ / ➖
B Values:         ✅ / ❌ / ➖   (which value differs?)
C Control:        ✅ / ❌ / ➖
D Flows:          ✅ / ❌ / ➖
E Power:          ✅ / ❌ / ➖
F Existing:       ✅ / ❌ / ➖
G Moving over:    ✅ / ❌ / ➖
Notes:
```

For a ❌: send a diagnostics report for this app from the Homey app and mention the code you receive. Screenshots help.

Thanks for testing!
