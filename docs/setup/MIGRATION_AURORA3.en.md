# Moving to the Aurora III driver

This guide is for users of the separate app **Adlar Castra Heatpump (Aurora-III Modbus)**. As of version 3.2.0, Aurora III support is part of the app **Adlar Castra Heatpump**, as the driver *Aurora III via Modbus*.

Homey cannot move devices from one app to another. Moving over means pairing the device again in the new app and rebuilding your flows.

## What is lost

- **Flows**: flows that use cards from the old app must be rebuilt.
- **Settings**: device settings are not carried over.
- **Insights**: the history of the old device does not move to the new device.

## Step 1 — Prepare

1. Write down the device settings of the old device that you changed (for example polling intervals, adaptive control, energy prices, power measurement).
2. Write down which flows use the old device. A screenshot per flow helps when rebuilding.
3. Write down the IP address, TCP port and Modbus Unit ID of the gateway.

## Step 2 — Stop the old app

Do **not** let the old app and the new driver talk to the same heat pump at the same time. Both would poll and write through the same gateway (setpoints, adaptive control), with a risk of timeouts and conflicting commands.

So first do one of the following:

- remove the device from the old app, or
- in the old app, switch off adaptive control and all flows that write to the heat pump.

## Step 3 — Pair in the new app

1. Install or update the app **Adlar Castra Heatpump** to version 3.2.0 or later.
2. Add a device and choose **Aurora III via Modbus**. Do not choose *Aurora I/II via Modbus*: it uses different register addresses.
3. Enter the IP address, TCP port and Modbus Unit ID of the gateway.
4. Restore the settings you wrote down in the device settings.

The gateway settings do not change. For Aurora III it remains `9600 8N2` with `Serial protocol` = `Modbus`; see the [Elfin guide](modbus-elfin-ew11-setup.md) (Dutch).

## Step 4 — Rebuild flows

Rebuild the flows with the new device. The cards have the same titles as in the old app. In the Flow editor each device shows the cards of its own driver, so always select the Aurora III device.

New, Aurora III only: set silent mode, switch hot water function, switch forced backup heater, and the conditions *Hot water is being heated* and *Silent mode is*. See the [Flow Cards Guide](guide/FLOW_CARDS_GUIDE.en.md).

## Step 5 — Dashboards

The local dashboard of the Aurora III driver runs on port **8091** by default (the old app used 8090):

```text
http://<homey-ip>:8091/
```

See the [dashboard guide](MODBUS_DASHBOARD_GUIDE.en.md).

## Step 6 — Remove the old app

Once everything works in the new app, remove the old app **Adlar Castra Heatpump (Aurora-III Modbus)**.
