# Adlar Castra Heatpump

Local control and monitoring for Adlar Castra Aurora heat pumps on Homey Pro.
The app provides two separate device drivers, so choose the connection method
that matches your installation:

| Driver | Connection | When to choose it |
| --- | --- | --- |
| **Adlar Castra Aurora Heat Pump (Tuya)** | Tuya Local API over the local network | Your heat pump is connected to Wi-Fi and you have its Device ID and Local Key. |
| **Adlar Castra Aurora Heat Pump (Modbus)** | RS485 through a Modbus TCP gateway | Your heat pump exposes Modbus/RS485 and you use a gateway such as an Elfin EW11A. |

Both drivers operate locally. The Modbus driver does not require Tuya cloud or
Tuya Local credentials.

## Requirements

- Homey Pro with firmware `12.3.0` or newer
- An Adlar Castra Aurora-series heat pump on the same local network as Homey
- For the Tuya driver: Device ID, Local Key, IP address and the correct Tuya protocol version
- For the Modbus driver: a wired RS485/Modbus connection and a reachable Modbus TCP gateway

## What the App Provides

- Local readout of temperatures, operating state, defrost, antifreeze,
  sterilization and decoded fault information
- Power, energy, voltage, current, compressor frequency, fan speed, valve
  position, pump PWM and water-flow measurements when the connected heat pump
  supplies them
- Control of main on/off, operating mode, heating, cooling and DHW setpoints,
  plus supported heating and hot-water curve settings
- COP calculation based on available power, water-temperature delta and flow;
  external power, flow, ambient, indoor-temperature, price, solar and wind
  data can also be supplied through Homey Flows
- Flow cards for thresholds, alerts, faults, setpoints, external data and
  advanced curve calculations
- Optional adaptive temperature control, building-model learning, COP and
  energy-price optimisation, and weather-based advice
- English, Dutch, German and French user interface strings

Available measurements and controls vary by driver and heat-pump firmware.

## Installation

1. Install the app from the Homey App Store.
2. In Homey, add a device and select the driver matching the connection method
   above.
3. Complete the driver-specific pairing steps below.

### Tuya Local API

1. Select **Adlar Castra Aurora Heat Pump (Tuya)**.
2. Enter the heat pump's Device ID, Local Key and local IP address.
3. Select the Tuya protocol version. Start with `3.3`; try `3.4` or `3.5` if
   the device cannot connect.

The [Tuya LocalKey guide](docs/setup/Tuya_LocalKey_Homey_Guide_EN.pdf) explains
how to obtain the credentials. For connection problems, use the
[protocol version guide](docs/setup/PROTOCOL_VERSION_GUIDE.en.md) and the
[quick-fix guide](docs/setup/USER_QUICK_FIX.en.md).

### Modbus TCP Gateway

1. Connect the heat pump's RS485/Modbus bus to an Elfin EW11A or equivalent
   Modbus TCP gateway.
2. Ensure that the gateway is reachable from Homey on the local network.
3. Select **Adlar Castra Aurora Heat Pump (Modbus)**.
4. Enter the gateway IP address, TCP port and Modbus Unit ID.
5. Adjust the polling intervals only when necessary.

The usual defaults are TCP port `502` and Modbus Unit ID `1`. Give the gateway
a fixed DHCP lease or static IP address to prevent avoidable reconnect issues.
Gateway reference material is available in
[the Modbus documentation](docs/Heatpump%20specs/modbus/Eflin%20EW11a/).

## Modbus Dashboards

The Modbus driver offers local dashboards. From a browser on the same network,
open one of the following URLs (the default port is `8090`):

- `http://<homey-ip>:8090/` — live, read-only heat-pump overview
- `http://<homey-ip>:8090/interactive` — live overview with direct setpoint controls
- `http://<homey-ip>:8090/live` — all device capabilities grouped by category
- `http://<homey-ip>:8090/expert` — register view with Modbus addresses and P/L parameter IDs
- `http://<homey-ip>:8090/changelog` — observed register changes and poll recommendations
- `http://<homey-ip>:8090/heating-curve` — DIY heating-curve editor

Replace `<homey-ip>` with the IP address of your Homey Pro. If you change the
Dashboard port setting, use that port in the URL instead.

> **Caution:** The expert dashboard and direct Modbus read/write Flow cards can
> change heat-pump behaviour. Only write registers when you understand their
> purpose and have recorded the original value.

## Important Limitations

- The Modbus driver targets the R32 register map and warns when another
  refrigerant is detected.
- The floor-heating setpoint is available as a Modbus device capability, but
  does not yet have its own Flow action.
- COP can be unavailable or less accurate when usable power or flow data is
  missing.
- Tuya Local and Modbus are separate drivers. A Modbus gateway cannot be used
  with the Tuya driver, and the Modbus driver does not use Tuya credentials.

## Documentation and Support

The [documentation portal](docs/README.en.md) contains configuration, COP,
Flow-card, adaptive-control and building-insights guides in English, Dutch,
German and French.

- [Advanced features introduction](docs/setup/advanced-control/Advanced_Features_Intro.en.md)
- [COP Flow Card setup](docs/setup/COP%20flow-card-setup.en.md)
- [Configuration guide](docs/setup/advanced-settings/CONFIGURATION_GUIDE.en.md)
- [Flow Cards guide](docs/setup/guide/FLOW_CARDS_GUIDE.en.md)

Please report bugs and feature requests through the repository's GitHub
[issues](https://github.com/hhi/org.hhi.adlar-heatpump/issues).

## Development

```sh
npm install
npm run build
npm run lint
homey app validate
```

Use `homey app run` for local development on a paired Homey Pro.

## License

Developed for the Homey platform following the Homey app-development
guidelines.
