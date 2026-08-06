Control and monitor your Adlar Castra Aurora heat pump locally with Homey Pro.
The app supports two connection methods in one app: Tuya Local API and Modbus
RS485 through a Modbus TCP gateway. Choose the device driver that matches your
installation; both work on your local network without a cloud connection for
daily operation.

🇬🇧 English  🇩🇪 Deutsch 🇫🇷 Français 🇳🇱 Nederlands

CHOOSE A DRIVER

TUYA LOCAL API
- Select "Adlar Castra Aurora Heat Pump (Tuya)"
- Requires the heat pump's Device ID, Local Key, local IP address and Tuya
  protocol version (3.3, 3.4 or 3.5)
- Use this for a Wi-Fi-connected heat pump

MODBUS TCP GATEWAY
- Select "Adlar Castra Aurora Heat Pump (Modbus)"
- Requires an RS485/Modbus connection and a reachable Modbus TCP gateway,
  such as an Elfin EW11A
- Enter the gateway IP address, TCP port and Modbus Unit ID
- The usual defaults are port 502 and Unit ID 1

KEY FEATURES
- Local temperatures, operating state, defrost, antifreeze, sterilization and
  decoded fault information
- Power, energy, voltage, current, compressor, fan, valve, pump and water-flow
  measurements when supported by the heat pump
- Control of on/off, operating mode, heating, cooling and hot-water setpoints,
  and supported heating and hot-water curves
- COP and seasonal efficiency monitoring using available power, temperature
  difference and water-flow data
- Homey Flow cards for alerts, faults, setpoints, external data and advanced
  curve, schedule and seasonal calculations
- Optional adaptive temperature control, building-model learning, energy-price
  and COP optimisation, plus weather-based advice

MODBUS DASHBOARDS

The Modbus driver provides local dashboards at
http://<homey-ip>:8090/ by default:
- /              live heat-pump overview
- /interactive   overview with direct setpoint controls
- /live          all capabilities grouped by category
- /expert        Modbus registers, P/L parameter IDs and read/write tools
- /changelog     register changes and polling recommendations
- /heating-curve DIY heating-curve editor

Replace <homey-ip> with your Homey Pro IP address. The dashboard port can be
changed in the device settings.

IMPORTANT
- Advanced Modbus write tools can change heat-pump behaviour. Use them only
  when you understand the register and have recorded its original value.
- The Modbus driver targets the R32 register map and warns for other
  refrigerants.
- COP can be unavailable or less accurate if usable power or flow data is
  missing.
- A fixed DHCP lease or static IP address for the heat pump or gateway helps
  prevent reconnect issues.

DOCUMENTATION

The source-code page contains setup, Flow, COP and advanced-control guides.
For Tuya pairing, see /docs/setup/Tuya_LocalKey_Homey_Guide_EN.pdf and
/docs/setup/PROTOCOL_VERSION_GUIDE.en.md.
