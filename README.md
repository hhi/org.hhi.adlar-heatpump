# Adlar Castra Heatpump

Local control and monitoring for Adlar Castra Aurora heat pumps on Homey Pro.
The app provides three separate device drivers, so choose the one that matches
your connection method and heat-pump model:

| Driver | Connection | When to choose it |
| --- | --- | --- |
| **Aurora I/II via Tuya** | Tuya Local API over the local network | Your heat pump is connected to Wi-Fi and you have its Device ID and Local Key. |
| **Aurora I/II via Modbus** | RS485 through a Modbus TCP gateway | Aurora I/II model with Modbus/RS485 and a gateway such as an Elfin EW11A (`9600 8N1`). |
| **Aurora III via Modbus** | RS485 through a Modbus TCP gateway | Aurora III / PRO model with Modbus/RS485 and a gateway such as an Elfin EW11A (`9600 8N2`). |

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

1. Select **Aurora I/II via Tuya**.
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
3. Select **Aurora I/II via Modbus** or **Aurora III via Modbus**, matching
   your model.
4. Enter the gateway IP address, TCP port and Modbus Unit ID.
5. Adjust the polling intervals only when necessary.

The usual defaults are TCP port `502` and Modbus Unit ID `1`. Give the gateway
a fixed DHCP lease or static IP address to prevent avoidable reconnect issues.
The [gateway setup guide](docs/setup/modbus-elfin-ew11-setup.md) (Dutch) covers
both models; gateway reference material is available in
[the Modbus documentation](docs/Heatpump%20specs/modbus/Elfin%20EW11A/).

Moving from the separate Aurora III app? See the
[migration guide](docs/setup/MIGRATION_AURORA3.en.md).

## Local Dashboards

All three drivers offer local dashboards. From a browser on the same network,
open the address for your driver:

| Driver | Default dashboard address |
| --- | --- |
| Aurora I/II via Tuya | `http://<homey-ip>:8092` |
| Aurora I/II via Modbus | `http://<homey-ip>:8090` |
| Aurora III via Modbus | `http://<homey-ip>:8091` |

Replace `<homey-ip>` with the local IP address of your Homey Pro. If you change
the Dashboard port setting, use that port instead.

The following pages are available for all three drivers:

- `/` — heat-pump overview with available measurements and operating status
- `/interactive` — controls for supported settings
- `/live` — device capabilities grouped by category
- `/expert` — searchable overview of Tuya DPS datapoints or model-specific
  Modbus registers, with supported write controls
- `/changelog` — an overview per datapoint or register, with current and previous
  values and change statistics

Tuya Expert supports searches by DPS number, name, unit, value and capability.
It offers views by DPS number, function and unit, plus a writable-only filter.
The Tuya Changes page supports searching, sorting, a changed-only filter and
filtered JSON or Markdown exports. Statistics are kept while the app runs,
including when the page is closed, and reset when the app restarts.

Heating-curve pages differ by driver:

- Tuya: `http://<homey-ip>:8092/heating-curve` shows the reported Tuya curve
  selections and the app's linear heating curve when its parameters are
  available. It does not reconstruct the Tuya H/L preset curves.
- Aurora I/II via Modbus: `http://<homey-ip>:8090/heating-curve` provides the
  DIY heating-curve editor.
- Aurora III via Modbus has no separate heating-curve dashboard page.

Tuya uses the existing device connection and received DPS values. Modbus
register tools and poll recommendations are specific to the Modbus drivers.
Available measurements and controls depend on the driver and heat-pump model.

See the [Modbus dashboard guide](docs/setup/MODBUS_DASHBOARD_GUIDE.en.md) for
Modbus-specific instructions. The [Tuya dashboard architecture decision](docs/architecture/ADR-068-TUYA-DASHBOARD.md)
describes the Tuya implementation and its limitations.

> **Caution:** Dashboard write controls and direct Modbus read/write Flow cards
> can change heat-pump behaviour. Check the meaning of a setting and record its
> original value before changing it.

## Important Limitations

- The Aurora I/II Modbus driver targets the R32 register map and warns when another
  refrigerant is detected.
- The floor-heating setpoint is available as a Modbus device capability, but
  does not yet have its own Flow action.
- COP can be unavailable or less accurate when usable power or flow data is
  missing.
- Tuya Local and Modbus are separate drivers. A Modbus gateway cannot be used
  with the Tuya driver, and the Modbus drivers do not use Tuya credentials.
- The Aurora I/II and Aurora III drivers are not interchangeable: each reads and
  writes the register map of its own model.
- The local dashboards have no password; anyone on the local network can open
  them, including the write functions.

## Documentation and Support

The `docs/` directory contains installation and user guides, troubleshooting,
efficiency calculations, device specifications and developer documentation.
Start with the documentation index in your preferred language:

[Nederlands](docs/README.nl.md) · [English](docs/README.en.md) ·
[Deutsch](docs/README.de.md) · [Français](docs/README.fr.md)

Most user guides are available in these four languages. Technical reference
material and some installation guides are available in one language only.
Use the instructions for your driver and model; Tuya credentials and DPS
references differ from Modbus gateway settings and register maps.

| What do you want to do? | Start here |
| --- | --- |
| Connect a heat pump | [Choose a driver and pair it](#installation), [Tuya LocalKey guide](docs/setup/Tuya_LocalKey_Homey_Guide_EN.pdf), [Modbus gateway setup for Aurora I/II and III](docs/setup/modbus-elfin-ew11-setup.md) (Dutch) |
| Use dashboards, settings and Flows | [Dashboards for all three drivers](#local-dashboards), [Modbus dashboard guide](docs/setup/MODBUS_DASHBOARD_GUIDE.en.md), [configuration reference](docs/setup/advanced-settings/CONFIGURATION_GUIDE.en.md), [Flow Cards guide](docs/setup/guide/FLOW_CARDS_GUIDE.en.md) |
| Configure control and understand efficiency | [Advanced features](docs/setup/advanced-control/Advanced_Features_Intro.en.md), [COP setup](docs/setup/COP%20flow-card-setup.en.md), [COP/SCOP methodology](docs/COP%20calculation/), [adaptive control](docs/ADAPTIVE_CONTROL_OVERVIEW.en.md), [building model and insights](docs/BUILDINGMODEL_INSIGHTS_OVERVIEW.en.md) |
| Resolve problems or migrate | [Tuya quick fixes](docs/setup/USER_QUICK_FIX.en.md), [Tuya protocol versions](docs/setup/PROTOCOL_VERSION_GUIDE.en.md), [Modbus diagnostics](docs/setup/MODBUS_DASHBOARD_GUIDE.en.md), [Aurora III migration](docs/setup/MIGRATION_AURORA3.en.md) |
| Explore technical details or contribute | [Heat-pump specifications and mappings](docs/Heatpump%20specs/), [architecture and design decisions](docs/architecture/), [developer resources](docs/Dev%20support/), [verification and test scenarios](docs/testing/) |

Please report bugs and feature requests through the repository's GitHub
[issues](https://github.com/hhi/org.hhi.adlar-heatpump/issues). Include the driver,
heat-pump model, app version and steps needed to reproduce the problem.

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
