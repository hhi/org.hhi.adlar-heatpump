# Adlar Castra Heatpump

Local control and monitoring for Adlar Castra Aurora heat pumps on Homey Pro.
The app provides three separate device drivers, so choose the one that matches
your connection method and heat-pump model:

| Driver | Connection | When to choose it |
| --- | --- | --- |
| **Adlar Castra Aurora Heat Pump (Tuya)** | Tuya Local API over the local network | Your heat pump is connected to Wi-Fi and you have its Device ID and Local Key. |
| **Adlar Castra Aurora II Heat Pump (Modbus)** | RS485 through a Modbus TCP gateway | Aurora I/II model with Modbus/RS485 and a gateway such as an Elfin EW11A (`9600 8N1`). |
| **Adlar Castra Aurora III Heat Pump (Modbus)** | RS485 through a Modbus TCP gateway | Aurora III / PRO model with Modbus/RS485 and a gateway such as an Elfin EW11A (`9600 8N2`). |

All drivers operate locally. The Modbus drivers do not require Tuya cloud or
Tuya Local credentials. The two Modbus drivers use different register maps:
choose the driver that matches the model on the type plate.

## Requirements

- Homey Pro with firmware `12.3.0` or newer
- An Adlar Castra Aurora-series heat pump on the same local network as Homey
- For the Tuya driver: Device ID, Local Key, IP address and the correct Tuya protocol version
- For the Modbus drivers: a wired RS485/Modbus connection and a reachable Modbus TCP gateway

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
3. Select **Adlar Castra Aurora II Heat Pump (Modbus)** or
   **Adlar Castra Aurora III Heat Pump (Modbus)**, matching your model.
4. Enter the gateway IP address, TCP port and Modbus Unit ID.
5. Adjust the polling intervals only when necessary.

The usual defaults are TCP port `502` and Modbus Unit ID `1`. Give the gateway
a fixed DHCP lease or static IP address to prevent avoidable reconnect issues.
The [gateway setup guide](docs/setup/modbus-elfin-ew11-setup.md) (Dutch) covers
both models; gateway reference material is available in
[the Modbus documentation](docs/Heatpump%20specs/modbus/Eflin%20EW11a/).

Moving from the separate Aurora III app? See the
[migration guide](docs/setup/MIGRATION_AURORA3.en.md).

## Modbus Dashboards

Each Modbus driver offers its own local dashboards. From a browser on the same
network, open one of the following URLs. The default port is `8090` for
Aurora II and `8091` for Aurora III:

- `http://<homey-ip>:<port>/` — live, read-only heat-pump overview
- `http://<homey-ip>:<port>/interactive` — live overview with direct setpoint controls
- `http://<homey-ip>:<port>/live` — all device capabilities grouped by category
- `http://<homey-ip>:<port>/expert` — register view with Modbus addresses
- `http://<homey-ip>:<port>/changelog` — observed register changes and poll recommendations
- `http://<homey-ip>:8090/heating-curve` — DIY heating-curve editor (Aurora II only)

Replace `<homey-ip>` with the IP address of your Homey Pro. If you change the
Dashboard port setting, use that port in the URL instead. See the
[dashboard guide](docs/setup/MODBUS_DASHBOARD_GUIDE.en.md) for details.

> **Caution:** The expert dashboard and direct Modbus read/write Flow cards can
> change heat-pump behaviour. Only write registers when you understand their
> purpose and have recorded the original value.

## Important Limitations

- The Aurora II driver targets the R32 register map and warns when another
  refrigerant is detected.
- The floor-heating setpoint is available as a Modbus device capability, but
  does not yet have its own Flow action.
- COP can be unavailable or less accurate when usable power or flow data is
  missing.
- Tuya Local and Modbus are separate drivers. A Modbus gateway cannot be used
  with the Tuya driver, and the Modbus drivers do not use Tuya credentials.
- The Aurora II and Aurora III drivers are not interchangeable: each reads and
  writes the register map of its own model.
- The local dashboards have no password; anyone on the local network can open
  them, including the write functions.

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
