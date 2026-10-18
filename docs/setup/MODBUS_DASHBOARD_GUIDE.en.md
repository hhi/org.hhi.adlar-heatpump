# Modbus Diagnostics & Dashboard Guide (Adlar Castra Aurora)

This guide describes the built-in local diagnostic and service tools of the **Modbus drivers** in the Adlar Castra Homey app: the Aurora II driver and the Aurora III driver.

---

## 1. Overview

Both Modbus drivers (`intelligent-heatpump-modbus` for Aurora II, `intelligent-heatpump-aurora3` for Aurora III) include an optional local HTTP service for deep diagnostics, live monitoring, and advanced register inspection. This tool runs directly on your Homey Pro and is accessible via your local web browser. Each model has its own dashboard server on its own port.

### Key Highlights
- **100% Local**: No external cloud connection required.
- **Real-time Monitoring**: Live display of all measured temperatures, pressure levels, fan speeds, and compressor states.
- **Heating Curve Editor** (Aurora II only): Visual fine-tuning and simulation of your heating curve.
- **Register Inspection**: Detailed insight into Modbus registers (P and L parameters on Aurora II, input and holding registers on Aurora III).

---

## 2. Access and Configuration

### Port Configuration

| Model | Default port |
|---|---|
| Aurora II | **8090** |
| Aurora III | **8091** |

The dashboard server starts as soon as a device of that model is paired. You can change the port in the Homey app:
1. Open the Homey app on your mobile device or desktop.
2. Navigate to your Modbus heat pump device.
3. Open **Device Settings** (gear icon) → **Advanced Settings**.
4. Locate the **Local Dashboards** section and update the **Dashboard Port** if the port is already in use by another service.

Do not choose the same port for both models: only the first dashboard server will start.

### Opening the Dashboard
Open a web browser on any computer or tablet connected to the same local network and browse to:

```text
http://<homey-ip>:8090/   (Aurora II)
http://<homey-ip>:8091/   (Aurora III)
```

*(Replace `<homey-ip>` with the local IP address of your Homey Pro, for example `http://192.168.1.50:8090/`)*

---

## 3. Available Views and Endpoints

| Endpoint | Description | Purpose | Aurora II | Aurora III |
|---|---|---|---|---|
| `/` | **Live Overview** | Main dashboard with real-time status, temperatures, power, and COP. | ✓ | ✓ |
| `/interactive` | **Interactive Controls** | Direct overview with setpoint controls and operational mode toggles. On Aurora III also hot water function, silent mode, backup heater and (experimental) on/off. | ✓ | ✓ |
| `/live` | **Capability Groups** | All active Homey capabilities organized by category. | ✓ | ✓ |
| `/expert` | **Expert Registers** | Complete Modbus register inspection table with direct read and write tools. | ✓ | ✓ |
| `/changelog` | **Register Changelog** | Real-time register change log and polling optimization advice. | ✓ | ✓ |
| `/heating-curve` | **Heating Curve Editor** | Visual simulator and configuration tool for custom heating curves. | ✓ | — |

---

## 4. Safety Instructions for Expert Tools

> [!WARNING]
> **Exercise Caution When Writing Registers**
> Manually writing Modbus registers via the `/expert` view directly alters the heat pump controller firmware state.
> - Only modify registers if you understand Adlar's technical documentation and register specifications.
> - Always record the original register value before applying any changes.
> - The Aurora II driver register mapping is primarily optimized for the R32 series.

> [!IMPORTANT]
> **No password on the dashboards**
> The dashboards can be opened without signing in by any device on your local network, including the write functions. With a device of each model, two such ports are open. Use the dashboards only on a trusted network and do not expose them to the internet.
