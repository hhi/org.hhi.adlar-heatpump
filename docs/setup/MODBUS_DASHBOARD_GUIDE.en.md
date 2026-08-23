# Modbus Diagnostics & Dashboard Guide (Adlar Castra Aurora)

This guide describes the built-in local diagnostic and service tools of the **Modbus driver** in the Adlar Castra Homey app.

---

## 1. Overview

The Modbus driver (`intelligent-heatpump-modbus`) includes an optional local HTTP service for deep diagnostics, live monitoring, and advanced register inspection. This tool runs directly on your Homey Pro and is accessible via your local web browser.

### Key Highlights
- **100% Local**: No external cloud connection required.
- **Real-time Monitoring**: Live display of all measured temperatures, pressure levels, fan speeds, and compressor states.
- **Heating Curve Editor**: Visual fine-tuning and simulation of your heating curve.
- **Register Inspection**: Detailed insight into Modbus holding registers and coils (P and L parameters).

---

## 2. Access and Configuration

### Port Configuration
By default, the HTTP service runs on port **8090**. You can change this port in the Homey app:
1. Open the Homey app on your mobile device or desktop.
2. Navigate to your Modbus heat pump device.
3. Open **Device Settings** (gear icon) → **Advanced Settings**.
4. Locate the **Local Dashboards** section and update the **Dashboard Port** if port 8090 is already in use by another service.

### Opening the Dashboard
Open a web browser on any computer or tablet connected to the same local network and browse to:

```text
http://<homey-ip>:8090/
```

*(Replace `<homey-ip>` with the local IP address of your Homey Pro, for example `http://192.168.1.50:8090/`)*

---

## 3. Available Views and Endpoints

| Endpoint | Description | Purpose |
|---|---|---|
| `/` | **Live Overview** | Main dashboard with real-time status, temperatures, power, and COP. |
| `/interactive` | **Interactive Controls** | Direct overview with setpoint controls and operational mode toggles. |
| `/live` | **Capability Groups** | All active Homey capabilities organized by category. |
| `/expert` | **Expert Registers** | Complete Modbus register inspection table with direct read and write tools. |
| `/changelog` | **Register Changelog** | Real-time register change log and polling optimization advice. |
| `/heating-curve` | **Heating Curve Editor** | Visual simulator and configuration tool for custom heating curves. |

---

## 4. Safety Instructions for Expert Tools

> [!WARNING]
> **Exercise Caution When Writing Registers**
> Manually writing Modbus registers via the `/expert` view directly alters the heat pump controller firmware state.
> - Only modify registers if you understand Adlar's technical documentation and register specifications.
> - Always record the original register value before applying any changes.
> - The Modbus driver register mapping is primarily optimized for the R32 series.
