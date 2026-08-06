# Adlar Castra / Aurora II — Modbus Developer Reference (v2.2)

> **Audience:** integrators building **non-Homey** Modbus TCP clients (Node-RED, Home Assistant,
> custom PLC/SCADA, Python/pymodbus, etc.) for the Adlar Castra / Aurora II air-to-water heat pump
> family (SolarEast/HBG OEM controller) reached over an **Elfin EW11A** (or any RS485→TCP gateway).
>
> **The register model in `lib/modbus/adlar-modbus-registers.ts` is authoritative.** This document is
> generated directly from that module (names, ranges, defaults, scaling, descriptions, bitmasks) and
> annotated with a **live register snapshot** from the reference unit. Where a register exists in the
> model but was not polled, the snapshot columns read `—` / `not polled`.

| | |
|---|---|
| **Register model** | v2.2 (`adlar-modbus-registers.ts`) — 401 defined registers |
| **Snapshot taken** | 2026-06-15 10:13 (local) |
| **Reference unit** | Adlar Castra Aurora II, refrigerant **R32** (P119 = 2) |
| **Program version** | 0x0360 = 433 → V4.3.3 |
| **Protocol version** | 0x0363 = 143 → coils + separate curve registers supported (≥ 130) |
| **Product type** | 0x0361 = 0 / 0x0362 = 1 → Domestic ON/OFF, inverter sub-type |
| **Out of documented range (snapshot)** | 4 (see §3) |

---

## 1. Transport & framing

| Property | Value |
|---|---|
| Protocol | Modbus **TCP** (gateway bridges to RS485 / Modbus RTU on the controller) |
| Default unit/slave id | **1** (configurable via P45 `0x012D`, range 1–16) |
| Read holding registers | **FC03** `readHoldingRegisters` |
| Write single register | **FC06** `writeSingleRegister` |
| Write coil | **FC05** `writeCoil` (required for `0x1000–0x1023`, see §7) |
| Read coils | **FC01** `readCoils` |
| Word size | 16-bit big-endian; signed values are **two's complement** |
| Address base | Addresses are **protocol/PDU addresses** as sent on the wire (e.g. `0x004A`). Some clients add +1 or +40001 — verify against the snapshot. |

> **Signed decoding.** Negative-capable registers are 16-bit two's complement. Example: P13 `0x010D`
> reads wire `65496` → decoded `-40`. Apply `if (raw > 32767) raw -= 65536` before scaling.

---

## 2. The scaling model (and why it depends on the refrigerant)

### 2a. Refrigerant-dependent temperature scaling (P119)

A fixed set of temperature registers is scaled by the configured refrigerant type in **P119**
(`0x0177`), via `refrigerantToTemperatureScale(p119)` = `p119 === 3 ? 'x10' : 'x1'`:

| P119 | Refrigerant | Temp scale | Decode |
|---:|---|---|---|
| 1 | R410A | **×1** | `value = raw` |
| 2 | **R32** (this unit) | **×1** | `value = raw` |
| 3 | R290 | **×10** | `value = raw / 10` (raw 255 → 25.5 °C) |

> **Read P119 first**, then pick the column. Registers governed by this rule are marked **🌡** in the
> master table. Note: these entries carry `multiply: 0.1` in the source, but `scaleRegisterValue()`
> **ignores that field** for these addresses and applies the P119 scale instead (matches the R32 snapshot).

### 2b. Refrigerant-independent factors

All other scaled registers use a fixed multiplier (shown identically in all three columns):
voltage `0x0044` ×0.99, currents `0x0045`/`0x0046` ×0.1, `0x005B`/`0x0077`/`0x0079` ×0.01,
power `0x005C` ×0.01. Everything else is ×1 (Hz, valve steps P, %, L/min, kWh/W, counters, enums, bitmasks).

### 2c. AC input current calibration curve (0x0045)

The clamp sensor is non-linear (up to ~38 % low below ~5 A). Interpolate the raw (÷10) value:

| raw | A | raw | A | raw | A |
|---:|---:|---:|---:|---:|---:|
| 0.0 | 0.0 | 4.0 | 2.9 | 8.0 | 6.8 |
| 1.0 | 1.0 | 5.0 | 3.4 | 9.0 | 7.8 |
| 2.0 | 2.0 | 6.0 | 4.6 | 10.0 | 8.5 |
| 3.0 | 2.5 | 7.0 | 5.5 | 11.0 | 9.0 |

---

## 3. Out-of-range readings (snapshot)

| Register | Addr | Name | Value | Documented range | Unit |
|---|---|---|---:|---:|---|
| P06_fanType | 0x0106 | Fan type | 3 | 0–2 |  |
| P49_hotWaterFreqPercentage | 0x0131 | Hot water freq running percentage | 0 | 30–100 | % |
| P83_auxValveMinOpening | 0x0153 | EEV aux valve min opening | 30 | 50–300 | P |
| P145_outletAntifreezeProtection | 0x0191 | Outlet water antifreeze protection | -30 | -20–10 | °C |

> **Sensor sentinels.** Unpopulated optional sensors report sentinels, not null: e.g. `0x0072`
> Solar Water Heater Temp = **−50 °C**, `0x007C` Zone 1 Mixing Temp = 0. Treat temperatures ≤ −40 °C
> as "no sensor". Flagged ⚑ in the master table.

---

## 4. Register 0x0309 — undocumented day/minute counter

`0x0309` is **not in the register model** and was not polled, but field observation suggests a
**minutes-of-day counter** (wraps at midnight). Probe `0x0308–0x030B` (the gap between `runningMode`
0x0307 and the legacy curve pair 0x030C/0x030D) and validate empirically before relying on it.

---

## 5. Master register table (code-leading)

🌡 = P119-dependent scaling (§2a). Snapshot = live raw (→scaled when different); `—` = not polled.

| Addr | Register | Cat | Name | Unit | ×R410A | ×R32 | ×R290 | Range | Default | Snapshot | Status | Notes |
|---|---|---|---|---|---|---|---|---:|---:|---:|---|---|
| 0x0000 | runningStatus1 | Status/Fault | runningStatus1 |  | bitmask | bitmask | bitmask | — | — | 0 | read |  |
| 0x0001 | runningStatus2 | Status/Fault | runningStatus2 |  | bitmask | bitmask | bitmask | — | — | 0 | read |  |
| 0x0002 | faultState1 | Status/Fault | faultState1 |  | bitmask | bitmask | bitmask | — | — | 0 | read |  |
| 0x0003 | faultState2 | Status/Fault | faultState2 |  | bitmask | bitmask | bitmask | — | — | 0 | read |  |
| 0x0004 | faultState3 | Status/Fault | faultState3 |  | bitmask | bitmask | bitmask | — | — | 0 | read |  |
| 0x0005 | sys1FaultState1 | Status/Fault | sys1FaultState1 |  | bitmask | bitmask | bitmask | — | — | 0 | read |  |
| 0x0006 | sys1FaultState2 | Status/Fault | sys1FaultState2 |  | bitmask | bitmask | bitmask | — | — | 0 | read |  |
| 0x0007 | sys1DriveFault1 | Status/Fault | sys1DriveFault1 |  | bitmask | bitmask | bitmask | — | — | 0 | read |  |
| 0x0008 | sys1DriveFault2 | Status/Fault | sys1DriveFault2 |  | bitmask | bitmask | bitmask | — | — | 0 | read |  |
| 0x0009 | sys1DriveFault3 | Status/Fault | sys1DriveFault3 |  | bitmask | bitmask | bitmask | — | — | 0 | read |  |
| 0x0019 | relayOutput1 | Status/Fault | relayOutput1 |  | bitmask | bitmask | bitmask | — | — | 16448 | read |  |
| 0x001A | relayOutput2 | Status/Fault | relayOutput2 |  | bitmask | bitmask | bitmask | — | — | 0 | read |  |
| 0x001B | relayOutput3 | Status/Fault | relayOutput3 |  | bitmask | bitmask | bitmask | — | — | 0 | read |  |
| 0x001C | relayOutput4 | Status/Fault | relayOutput4 |  | bitmask | bitmask | bitmask | — | — | 0 | read |  |
| 0x001D | switchPortState1 | Status/Fault | switchPortState1 |  | bitmask | bitmask | bitmask | — | — | 7679 | read |  |
| 0x001E | switchPortState2 | Status/Fault | switchPortState2 |  | bitmask | bitmask | bitmask | — | — | 7708 | read |  |
| 0x001F | switchPortState3 | Status/Fault | switchPortState3 |  | bitmask | bitmask | bitmask | — | — | 96 | read |  |
| 0x0027 | compressorTargetFreq1 | Status/Fault | Compressor target frequency 1 | Hz | ×1 | ×1 | ×1 | — | — | 0 | read |  |
| 0x0028 | compressorTargetFreq2 | Status/Fault | Compressor target frequency 2 | Hz | ×1 | ×1 | ×1 | — | — | 0 | read |  |
| 0x0040 | compressorRunningFreq | Sensor | Compressor Running Frequency | Hz | ×1 | ×1 | ×1 | — | — | 0 | read |  |
| 0x0041 | fanRunningSpeed | Sensor | Fan Running Speed | RPM | ×1 | ×1 | ×1 | — | — | 0 | read |  |
| 0x0042 | eevOpenStep | Sensor | EEV Open Step | P | ×1 | ×1 | ×1 | — | — | 250 | read |  |
| 0x0043 | eviValveOpenStep | Sensor | EVI Valve Open Step | P | ×1 | ×1 | ×1 | — | — | 0 | read |  |
| 0x0044 | acInputVoltage | Sensor | AC Input Voltage | V | ×0.99 | ×0.99 | ×0.99 | — | — | 227→224.7 | read | Kalibratie: 0.99 correctiefactor (marnie). Raw waarde is ~1% te hoog. |
| 0x0045 | acInputCurrent | Sensor | AC Input Current | A | ×0.1 | ×0.1 | ×0.1 | — | — | 0 | read | NON-LINEAIRE sensor — gebruik calibrationCurve voor nauwkeurige COP-berekening · non-linear — see §2c calibration curve |
| 0x0046 | compressorPhaseCurrent | Sensor | Compressor Phase Current | A | ×0.1 | ×0.1 | ×0.1 | — | — | 0 | read |  |
| 0x0047 | compressorIpmTemp 🌡 | Sensor | Compressor IPM Temp | °C | ×1 | ×1 | ×0.1 | — | — | 25 | read |  |
| 0x0048 | highPressureSatTemp 🌡 | Sensor | High Pressure Saturation Temp | °C | ×1 | ×1 | ×0.1 | — | — | 13 | read |  |
| 0x0049 | lowPressureSatTemp 🌡 | Sensor | Low Pressure Saturation Temp | °C | ×1 | ×1 | ×0.1 | — | — | 14 | read |  |
| 0x004A | ambientTempT1 🌡 | Sensor | Ambient Temp (T1) | °C | ×1 | ×1 | ×0.1 | — | — | 15 | read |  |
| 0x004B | outerCoilTempT2 🌡 | Sensor | Outer Coil Temp (T2) | °C | ×1 | ×1 | ×0.1 | — | — | 15 | read |  |
| 0x004C | innerCoilTempT3 🌡 | Sensor | Inner Coil Temp (T3) | °C | ×1 | ×1 | ×0.1 | — | — | 24 | read |  |
| 0x004D | suctionTempT4 🌡 | Sensor | Suction Temp (T4) | °C | ×1 | ×1 | ×0.1 | — | — | 19 | read |  |
| 0x004E | exhaustTempT5 🌡 | Sensor | Exhaust Temp (T5) | °C | ×1 | ×1 | ×0.1 | — | — | 18 | read |  |
| 0x004F | waterInletTempT6 🌡 | Sensor | Water Inlet Temp (T6) | °C | ×1 | ×1 | ×0.1 | — | — | 36 | read |  |
| 0x0050 | waterOutletTempT7 🌡 | Sensor | Water Outlet Temp (T7) | °C | ×1 | ×1 | ×0.1 | — | — | 35 | read |  |
| 0x0051 | economizerInletT8 🌡 | Sensor | Economizer Inlet Temp (T8) | °C | ×1 | ×1 | ×0.1 | — | — | 20 | read |  |
| 0x0052 | economizerOutletT9 🌡 | Sensor | Economizer Outlet Temp (T9) | °C | ×1 | ×1 | ×0.1 | — | — | 19 | read |  |
| 0x0053 | deviceToolingNo | Sensor | Device Tooling No |  | ×1 | ×1 | ×1 | — | — | 118 | read |  |
| 0x0054 | waterTankTemp 🌡 | Sensor | DHW Tank Temperature | °C | ×1 | ×1 | ×0.1 | — | — | 25 | read |  |
| 0x0055 | plateHxExhaustTemp 🌡 | Sensor | Plate HX Exhaust Temp | °C | ×1 | ×1 | ×0.1 | — | — | 25 | read |  |
| 0x0056 | driveManufacturer | Sensor | Drive Manufacturer Code |  | ×1 | ×1 | ×1 | — | — | 0 | read |  |
| 0x0057 | waterPumpSpeedPWM | Sensor | Water Pump Speed PWM | % | ×1 | ×1 | ×1 | — | — | 0 | read |  |
| 0x0058 | waterFlow | Sensor | Water Flow | L/min | ×1 | ×1 | ×1 | — | — | 0 | read |  |
| 0x0059 | dhwReturnWaterTemp 🌡 | Sensor | DHW Return Water Temp | °C | ×1 | ×1 | ×0.1 | — | — | 18 | read |  |
| 0x005A | deviceInputVoltage | Sensor | Unit Input Voltage | V | ×1 | ×1 | ×1 | — | — | 0 | read |  |
| 0x005B | deviceInputCurrent | Sensor | Unit Input Current | A | ×0.01 | ×0.01 | ×0.01 | — | — | 0 | read |  |
| 0x005C | deviceInputPower | Sensor | Unit Input Power | kW | ×0.01 | ×0.01 | ×0.01 | — | — | 0 | read |  |
| 0x005D | totalEnergyConsumption | Sensor | Total Energy Consumption | kWh | ×1 | ×1 | ×1 | — | — | 0 | read |  |
| 0x0072 | solarWaterHeaterTemp 🌡 | Sensor | Solar Water Heater Temp | °C | ×1 | ×1 | ×0.1 | — | — | -50 | ⚑ sensor sentinel |  |
| 0x0073 | zone2Temp 🌡 | Sensor | Zone 2 Temp | °C | ×1 | ×1 | ×0.1 | — | — | 17 | read |  |
| 0x0074 | bufferTankTemp 🌡 | Sensor | Buffer Tank Temp | °C | ×1 | ×1 | ×0.1 | — | — | 20 | read |  |
| 0x0075 | totalWaterOutletTemp 🌡 | Sensor | Total Water Outlet Temp | °C | ×1 | ×1 | ×0.1 | — | — | 35 | read |  |
| 0x0076 | bPhaseVoltage | Sensor | B Phase Input Voltage | V | ×1 | ×1 | ×1 | — | — | 0 | read |  |
| 0x0077 | bPhaseCurrent | Sensor | B Phase Input Current | A | ×0.01 | ×0.01 | ×0.01 | — | — | 0 | read |  |
| 0x0078 | cPhaseVoltage | Sensor | C Phase Input Voltage | V | ×1 | ×1 | ×1 | — | — | 0 | read |  |
| 0x0079 | cPhaseCurrent | Sensor | C Phase Input Current | A | ×0.01 | ×0.01 | ×0.01 | — | — | 0 | read |  |
| 0x007A | smartGridStatus | Sensor | Smart Grid Status |  | ×1 | ×1 | ×1 | — | — | 0 | read |  |
| 0x007B | zone2MixingValve | Sensor | Zone 2 Mixing Valve Opening | % | ×1 | ×1 | ×1 | — | — | 105 | read |  |
| 0x007C | zone1MixingTemp 🌡 | Sensor | Zone 1 Mixing Temp | °C | ×1 | ×1 | ×0.1 | — | — | 0 | read |  |
| 0x007D | zone1MixingValve | Sensor | Zone 1 Mixing Valve Opening | % | ×1 | ×1 | ×1 | — | — | 105 | read |  |
| 0x00FA | heatingTempUpperLimit 🌡 | Sensor | Heating Temp Upper Limit | °C | ×1 | ×1 | ×0.1 | — | — | 50 | read |  |
| 0x00FB | heatingTempLowerLimit 🌡 | Sensor | Heating Temp Lower Limit | °C | ×1 | ×1 | ×0.1 | — | — | 15 | read |  |
| 0x00FC | hotWaterTempUpperLimit 🌡 | Sensor | Hot Water Temp Upper Limit | °C | ×1 | ×1 | ×0.1 | — | — | 55 | read |  |
| 0x00FD | hotWaterTempLowerLimit 🌡 | Sensor | Hot Water Temp Lower Limit | °C | ×1 | ×1 | ×0.1 | — | — | 20 | read |  |
| 0x00FE | coolingTempUpperLimit 🌡 | Sensor | Cooling Temp Upper Limit | °C | ×1 | ×1 | ×0.1 | — | — | 25 | read |  |
| 0x00FF | coolingTempLowerLimit 🌡 | Sensor | Cooling Temp Lower Limit | °C | ×1 | ×1 | ×0.1 | — | — | 18 | read |  |
| 0x0100 | P00_ambientTempSensor | P-parameter | T1 Ambient temp sensor |  | ×1 | ×1 | ×1 | 0–1 | 0 | 0 | in range | 0=enable, 1=disable |
| 0x0101 | P01_highVoltageSwitch | P-parameter | High voltage switch |  | ×1 | ×1 | ×1 | 0–1 | 0 | 0 | in range | 0=enable, 1=disable |
| 0x0102 | P02_lowPressureSwitch | P-parameter | Low pressure switch |  | ×1 | ×1 | ×1 | 0–1 | 0 | 0 | in range | 0=enable, 1=disable |
| 0x0103 | P03_waterFlowSwitch | P-parameter | Water flow switch |  | ×1 | ×1 | ×1 | 0–1 | 1 | 1 | in range | 0=enable, 1=disable. NB: R290 doc zegt range 1~2, Adlar R32 is 0/1 |
| 0x0104 | P04_thermalOverload | P-parameter | Thermal overload protection |  | ×1 | ×1 | ×1 | 0–1 | 0 | 1 | in range | 0=enable, 1=disable |
| 0x0105 | P05_linkageSwitch | P-parameter | Linkage switch (host) |  | ×1 | ×1 | ×1 | 0–3 | 0 | 1 | in range | 0=enable, 1=disable, 2=thermostatic, 3=heating thermostat |
| 0x0106 | P06_fanType | P-parameter | Fan type |  | ×1 | ×1 | ×1 | 0–2 | 1 | 3 | ⚠️ **OUT OF RANGE** | 0=AC, 1=DC, 2=EC |
| 0x0107 | P07_highVoltageLock | P-parameter | High voltage lock |  | ×1 | ×1 | ×1 | 0–1 | 0 | 0 | in range | 0=3 locks, 1=no lock |
| 0x0108 | P08_lowVoltageLock | P-parameter | Low voltage lock |  | ×1 | ×1 | ×1 | 0–1 | 0 | 0 | in range | 0=3 locks, 1=no lock |
| 0x0109 | P09_exhaustLock | P-parameter | Exhaust lock |  | ×1 | ×1 | ×1 | 0–1 | 0 | 0 | in range | 0=3 locks, 1=no lock |
| 0x010A | P10_waterFlowLock | P-parameter | Water flow lock |  | ×1 | ×1 | ×1 | 0–1 | 0 | 0 | in range | 0=3 locks, 1=no lock |
| 0x010B | P11_highPressureProtect | P-parameter | High pressure protection value | °C | ×1 | ×1 | ×1 | 40–150 | — | 65 | in range |  |
| 0x010C | P12_highPressureFreqLimit | P-parameter | High pressure freq limit | °C | ×1 | ×1 | ×1 | 40–150 | — | 59 | in range | Must be P11-5 |
| 0x010D | P13_lowPressureProtect | P-parameter | Low pressure protection value | °C | ×1 | ×1 | ×1 | -50–-10 | — | -40 | in range |  |
| 0x010E | P14_lowPressureFreqLimit | P-parameter | Low pressure freq limit | °C | ×1 | ×1 | ×1 | -50–-10 | — | -35 | in range |  |
| 0x010F | P15_exhaustTempProtect | P-parameter | Exhaust temp protection | °C | ×1 | ×1 | ×1 | 100–130 | — | 115 | in range |  |
| 0x0110 | P16_exhaustTempFreqLimit | P-parameter | Exhaust temp freq limit | °C | ×1 | ×1 | ×1 | 90–120 | — | 95 | in range | Must be P15-10 |
| 0x0111 | P17_coolingFanSpeedIncrease | P-parameter | Cooling fan speed-up value | °C | ×1 | ×1 | ×1 | 0–60 | — | 37 | in range |  |
| 0x0112 | P18_coolingFanSpeedReduction | P-parameter | Cooling fan speed-down value | °C | ×1 | ×1 | ×1 | 0–60 | — | 32 | in range |  |
| 0x0113 | P19_heatingFanSpeedReduction | P-parameter | Heating fan speed-down value | °C | ×1 | ×1 | ×1 | 0–60 | — | 12 | in range |  |
| 0x0114 | P20_heatingFanSpeedIncrease | P-parameter | Heating fan speed-up value | °C | ×1 | ×1 | ×1 | 0–60 | — | 8 | in range |  |
| 0x0115 | P21_lowTempProhibitStart | P-parameter | Low temp unit prohibit start | °C | ×1 | ×1 | ×1 | -40–-10 | -15 | -26 | in range |  |
| 0x0116 | P22_eHeatingStartAmb | P-parameter | E-heating start ambient | °C | ×1 | ×1 | ×1 | -15–40 | 0 | 0 | in range | If Ambient Temp P22 enter defrost. R290 doc noemt dit ook "Unit no starting" (misleidend) |
| 0x0117 | P23_excessiveTempDiff | P-parameter | Excessive temp diff alarm | °C | ×1 | ×1 | ×1 | 10–30 | 20 | 12 | in range |  |
| 0x0118 | P24_returnWaterCompensation | P-parameter | Return water compensation | °C | ×1 | ×1 | ×1 | -10–10 | 0 | 2 | in range | Sensor offset correctie. Adlar Aurora II: T6 (return/inlet) |
| 0x0119 | P25_outletWaterCompensation | P-parameter | Outlet water compensation | °C | ×1 | ×1 | ×1 | -10–10 | 0 | 2 | in range | Sensor offset correctie. Adlar Aurora II: T7 (outlet/discharge) |
| 0x011A | P26_acReturnDiff | P-parameter | H&C Hysteresis return differential value | °C | ×1 | ×1 | ×1 | 0–10 | 5 | 5 | in range |  |
| 0x011B | P27_floorReturnDiff | P-parameter | Floor heating return differential value | °C | ×1 | ×1 | ×1 | 0–10 | 5 | 0 | in range |  |
| 0x011C | P28_pumpAtShutdown | P-parameter | Pump mode at shutdown |  | ×1 | ×1 | ×1 | 0–4 | 0 | 0 | in range | 0=keep running, 1=stop, 2=cooling only, 3=AC/heating only, 4=floor only |
| 0x011D | P29_antifreezePumpTime | P-parameter | Antifreeze pump running time | min | ×1 | ×1 | ×1 | 0–10 | 2 | 2 | in range |  |
| 0x011E | P30_defrostMode | P-parameter | Defrost mode |  | ×1 | ×1 | ×1 | 0–3 | 0 | 0 | in range | 0=smart, 1=timing, 2=fast, 3=dew point |
| 0x011F | P31_defrostAccumThreshold | P-parameter | Defrost accumulated threshold |  | ×1 | ×1 | ×1 | 0–120 | 45 | 45 | in range |  |
| 0x0120 | P32_defrostEntryCoilTemp | P-parameter | Defrost entry coil temp | °C | ×1 | ×1 | ×1 | -30–0 | -5 | -5 | in range |  |
| 0x0121 | P33_defrostEntryDiff1 | P-parameter | Defrost entry temp diff 1 | °C | ×1 | ×1 | ×1 | 0–20 | 9 | 9 | in range |  |
| 0x0122 | P34_defrostEntryDiff2 | P-parameter | Defrost entry temp diff 2 | °C | ×1 | ×1 | ×1 | 0–20 | 7 | 9 | in range |  |
| 0x0123 | P35_defrostMaxTime | P-parameter | Max defrost time | min | ×1 | ×1 | ×1 | 0–30 | 10 | 10 | in range |  |
| 0x0124 | P36_defrostExitCoilTemp | P-parameter | Defrost exit coil temp | °C | ×1 | ×1 | ×1 | 0–30 | 12 | 12 | in range |  |
| 0x0125 | P37_shutdownMode | P-parameter | Shutdown mode (aka "Darwin") |  | ×1 | ×1 | ×1 | 0–2 | 0 | 0 | in range | 0=Smart (unit decides), 1=Direct/Darwin (immediate off at target), 2=Refrig Smart |
| 0x0126 | P38_heatingMainValveOpeningConst | P-parameter | Heating main valve initial opening constant |  | ×1 | ×1 | ×1 | -999–999 | — | 300 | in range |  |
| 0x0127 | P39_pressureSensor | P-parameter | Pressure sensor settings |  | ×1 | ×1 | ×1 | 0–1 | 0 | 0 | in range | 0=enable, 1=disable |
| 0x0128 | P40_coolingSuperheatCorrection | P-parameter | EEV cooling target superheat correction | °C | ×1 | ×1 | ×1 | -5–10 | — | -2 | in range |  |
| 0x0129 | P41_heatingHpFreqLimitCorrection | P-parameter | EEV heating HP freq limit correction | °C | ×1 | ×1 | ×1 | -10–10 | — | 2 | in range |  |
| 0x012A | P42_heatingSuperheatCorrection | P-parameter | EEV heating target superheat correction | °C | ×1 | ×1 | ×1 | -5–10 | — | -1 | in range |  |
| 0x012B | P43_mvSwitch | P-parameter | MV switch setting |  | ×1 | ×1 | ×1 | 0–1 | 0 | 0 | in range | 0=disable, 1=enable |
| 0x012C | P44_waterFlowFailDetect | P-parameter | Water flow switch failure detect |  | ×1 | ×1 | ×1 | 0–1 | 0 | 0 | in range | 0=enable, 1=disable |
| 0x012D | P45_commAddress | P-parameter | Modbus slave address |  | ×1 | ×1 | ×1 | 1–16 | 1 | 1 | in range |  |
| 0x012E | P46_liquidInjectionReturnDiff | P-parameter | EVI liquid injection valve return diff | °C | ×1 | ×1 | ×1 | 0–15 | — | 8 | in range |  |
| 0x012F | P47_eviTargetSuperheat | P-parameter | EVI target superheat constant |  | ×1 | ×1 | ×1 | 0–12 | — | 1 | in range |  |
| 0x0130 | P48_dhwTankTempSensor | P-parameter | Enable DHW tank temp sensor |  | ×1 | ×1 | ×1 | 0–1 | 0 | 0 | in range | 0=disable, 1=enable |
| 0x0131 | P49_hotWaterFreqPercentage | P-parameter | Hot water freq running percentage | % | ×1 | ×1 | ×1 | 30–100 | 30 | 0 | ⚠️ **OUT OF RANGE** |  |
| 0x0132 | P50_coolingFreqConstantA | P-parameter | Cooling target freq constant A |  | ×1 | ×1 | ×1 | -100–100 | — | 10 | in range |  |
| 0x0133 | P51_coolingMinFreq | P-parameter | Cooling min freq | Hz | ×1 | ×1 | ×1 | 15–60 | — | 30 | in range |  |
| 0x0134 | P52_coolingTargetFreqUpper | P-parameter | Cooling target freq upper | Hz | ×1 | ×1 | ×1 | 40–120 | — | 70 | in range |  |
| 0x0135 | P53_coolingTargetFreqLower | P-parameter | Cooling target freq lower | Hz | ×1 | ×1 | ×1 | 15–120 | — | 42 | in range | Must be P52 |
| 0x0136 | P54_heatingFreqConstantB | P-parameter | Heating target freq constant B |  | ×1 | ×1 | ×1 | -100–100 | — | 85 | in range |  |
| 0x0137 | P55_heatingTargetFreqUpper | P-parameter | Heating target freq upper | Hz | ×1 | ×1 | ×1 | 50–120 | — | 85 | in range |  |
| 0x0138 | P56_heatingTargetFreqLower | P-parameter | Heating target freq lower | Hz | ×1 | ×1 | ×1 | 20–120 | — | 50 | in range |  |
| 0x0139 | P57_heatingMinFreq_above0 | P-parameter | Heating min freq (ambient > 0°C) | Hz | ×1 | ×1 | ×1 | 15–60 | — | 20 | in range | COP: lagere waarde = beter COP bij mild weer |
| 0x013A | P58_heatingMinFreq_neg10to0 | P-parameter | Heating min freq (-10°C  ambient < 0°C) | Hz | ×1 | ×1 | ×1 | 15–60 | — | 35 | in range |  |
| 0x013B | P59_heatingMinFreq_below10 | P-parameter | Heating min freq (ambient < -10°C) | Hz | ×1 | ×1 | ×1 | 15–60 | — | 40 | in range |  |
| 0x013C | P60_hotWaterFreqConstant | P-parameter | Hot water target freq constant |  | ×1 | ×1 | ×1 | -100–100 | — | 85 | in range |  |
| 0x013D | P61_hotWaterFreqUpper | P-parameter | Hot water target freq upper | Hz | ×1 | ×1 | ×1 | 50–120 | — | 85 | in range |  |
| 0x013E | P62_hotWaterFreqLower | P-parameter | Hot water target freq lower | Hz | ×1 | ×1 | ×1 | 15–120 | — | 50 | in range | Must be P61 |
| 0x013F | P63_hotWaterMinFreq_above0 | P-parameter | Hot water min freq (ambient > 0°C) | Hz | ×1 | ×1 | ×1 | 15–60 | — | 40 | in range | COP: lagere waarde = beter COP bij mild weer |
| 0x0140 | P64_hotWaterMinFreq_neg10to0 | P-parameter | Hot water min freq (-10°C  ambient < 0°C) | Hz | ×1 | ×1 | ×1 | 15–60 | — | 40 | in range |  |
| 0x0141 | P65_hotWaterMinFreq_below10 | P-parameter | Hot water min freq (ambient < -10°C) | Hz | ×1 | ×1 | ×1 | 15–60 | — | 45 | in range |  |
| 0x0142 | P66_dcFanInitFreq | P-parameter | DC fan initial freq | Hz | ×1 | ×1 | ×1 | 20–60 | — | 40 | in range | RPM = freq 15. Range 300900 RPM |
| 0x0143 | P67_dcFanHeatMinFreq | P-parameter | DC fan heating min freq | Hz | ×1 | ×1 | ×1 | 20–60 | — | 20 | in range |  |
| 0x0144 | P68_dcFanHeatMaxFreq | P-parameter | DC fan heating max freq | Hz | ×1 | ×1 | ×1 | 20–80 | — | 50 | in range |  |
| 0x0145 | P69_dcFanCoolMinFreq | P-parameter | DC fan cooling min freq | Hz | ×1 | ×1 | ×1 | 20–60 | — | 20 | in range |  |
| 0x0146 | P70_dcFanCoolMaxFreq | P-parameter | DC fan cooling max freq | Hz | ×1 | ×1 | ×1 | 20–80 | — | 55 | in range |  |
| 0x0147 | P71_enthalpyOnFreq | P-parameter | EEV enthalpy control on frequency | Hz | ×1 | ×1 | ×1 | 20–80 | — | 45 | in range |  |
| 0x0148 | P72_enthalpyStopFreq | P-parameter | EEV enthalpy stop increase frequency | Hz | ×1 | ×1 | ×1 | 20–80 | — | 35 | in range |  |
| 0x0149 | P73_coolingMainValveOpening1 | P-parameter | EEV cooling main valve opening 1 | P | ×1 | ×1 | ×1 | 20–480 | — | 400 | in range |  |
| 0x014A | P74_coolingMainValveOpening2 | P-parameter | EEV cooling main valve opening 2 | P | ×1 | ×1 | ×1 | 20–480 | — | 300 | in range |  |
| 0x014B | P75_coolingMainValveOpening3 | P-parameter | EEV cooling main valve opening 3 | P | ×1 | ×1 | ×1 | 20–480 | — | 350 | in range |  |
| 0x014C | P76_coolingMainValveMinOpening | P-parameter | EEV cooling main valve min opening | P | ×1 | ×1 | ×1 | 0–300 | — | 100 | in range |  |
| 0x014D | P77_heatingMainValveMinOpening | P-parameter | EEV heating main valve min opening | P | ×1 | ×1 | ×1 | 0–300 | — | 40 | in range |  |
| 0x014E | P78_mainValveMaxOpening | P-parameter | EEV main valve max opening | P | ×1 | ×1 | ×1 | 100–500 | — | 480 | in range |  |
| 0x014F | P79_mainValveOpeningConstC | P-parameter | EEV main valve initial opening const c |  | ×1 | ×1 | ×1 | 20–300 | — | 80 | in range |  |
| 0x0150 | P80_mainValveOpeningCoeffA | P-parameter | EEV main valve initial opening coeff a |  | ×1 | ×1 | ×1 | -999–999 | — | 60 | in range |  |
| 0x0151 | P81_mainValveOpeningCoeffB | P-parameter | EEV main valve initial opening coeff b |  | ×1 | ×1 | ×1 | -999–999 | — | 40 | in range |  |
| 0x0152 | P82_auxValveMaxOpening | P-parameter | EEV aux valve max opening | P | ×1 | ×1 | ×1 | 100–500 | — | 480 | in range |  |
| 0x0153 | P83_auxValveMinOpening | P-parameter | EEV aux valve min opening | P | ×1 | ×1 | ×1 | 50–300 | — | 30 | ⚠️ **OUT OF RANGE** |  |
| 0x0154 | P84_mainValveRegulationPeriod | P-parameter | EEV main valve regulation period | s | ×1 | ×1 | ×1 | 10–120 | — | 40 | in range |  |
| 0x0155 | P85_auxValveOpeningConstC | P-parameter | EEV aux valve initial opening const c |  | ×1 | ×1 | ×1 | -200–900 | — | 50 | in range |  |
| 0x0156 | P86_auxValveOpeningCoeffA | P-parameter | EEV aux valve initial opening coeff a |  | ×1 | ×1 | ×1 | -999–999 | — | 30 | in range |  |
| 0x0157 | P87_auxValveOpeningCoeffB | P-parameter | EEV aux valve initial opening coeff b |  | ×1 | ×1 | ×1 | -999–999 | — | 20 | in range |  |
| 0x0158 | P88_silentCompressorFreq | P-parameter | Silent mode compressor freq | Hz | ×1 | ×1 | ×1 | 20–70 | — | 50 | in range |  |
| 0x0159 | P89_silentFanFreq | P-parameter | Silent mode fan freq | Hz | ×1 | ×1 | ×1 | 20–60 | — | 40 | in range |  |
| 0x015A | P90_eviEntryAmbientTemp | P-parameter | EVI entry ambient temperature | °C | ×1 | ×1 | ×1 | 0–45 | — | 23 | in range |  |
| 0x015B | P91_eviForbidEntryTime | P-parameter | EVI forbid entry time | min | ×1 | ×1 | ×1 | 0–30 | — | 3 | in range |  |
| 0x015C | P92_eviEntryTempDiff | P-parameter | EVI entry temperature difference | °C | ×1 | ×1 | ×1 | 0–60 | — | 2 | in range |  |
| 0x015D | P93_eviCompressorRunTime | P-parameter | EVI compressor run time to enter | min | ×1 | ×1 | ×1 | 0–20 | — | 1 | in range |  |
| 0x015E | P94_auxValveAdjCycle | P-parameter | EVI aux valve adjustment cycle | s | ×1 | ×1 | ×1 | 10–120 | — | 40 | in range |  |
| 0x015F | P95_networkPumpMode | P-parameter | Network pump mode |  | ×1 | ×1 | ×1 | 0–1 | — | 0 | in range | 0=shared, 1=independent |
| 0x0160 | P96_hotWaterReturnDiff | P-parameter | DHW differential value | °C | ×1 | ×1 | ×1 | 0–10 | 5 | 5 | in range |  |
| 0x0161 | P97_tankTempAutoCompensation | P-parameter | Tank temperature auto compensation |  | ×1 | ×1 | ×1 | 0–1 | — | 0 | in range | 0=enable, 1=disable |
| 0x0162 | P98_tankTempManualCompensation | P-parameter | Tank temperature manual compensation | °C | ×1 | ×1 | ×1 | -10–10 | — | 0 | in range |  |
| 0x0163 | P99_pumpSpeedTempDiff | P-parameter | Pump speed regulation temp diff | °C | ×1 | ×1 | ×1 | 2–10 | 5 | 7 | in range |  |
| 0x0164 | P100_pumpMinSpeed | P-parameter | PWM pump minimum speed | % | ×1 | ×1 | ×1 | 20–80 | — | 70 | in range |  |
| 0x0165 | P101_pumpControlMode | P-parameter | Pump control mode |  | ×1 | ×1 | ×1 | 0–1 | — | 1 | in range | 0=AC(on/off), 1=DC(PWM) |
| 0x0166 | P102_fourWayValveMode | P-parameter | Four-way valve control mode |  | ×1 | ×1 | ×1 | 0–1 | — | 0 | in range | 0=cooling power on, 1=heating power on |
| 0x0167 | P103_modeSwitchMinRun | P-parameter | Mode switch min run time | min | ×1 | ×1 | ×1 | 0–10 | — | 3 | in range | 0=unlimited |
| 0x0168 | P104_modeSwitchFreqPct | P-parameter | Mode switch operating frequency % | % | ×1 | ×1 | ×1 | 20–100 | — | 25 | in range |  |
| 0x0169 | P105_coolingAmbientLimit | P-parameter | Cooling ambient temp limit | °C | ×1 | ×1 | ×1 | 10–60 | — | 14 | in range |  |
| 0x016A | P106_heatingAmbientLimit | P-parameter | Heating ambient temp limit | °C | ×1 | ×1 | ×1 | 10–60 | — | 40 | in range |  |
| 0x016B | P107_hotWaterAmbientLimit | P-parameter | Hot water ambient temp limit | °C | ×1 | ×1 | ×1 | 10–60 | — | 55 | in range |  |
| 0x016C | P108_hotWaterTempUpper | P-parameter | Hot water set temp upper | °C | ×1 | ×1 | ×1 | 30–80 | — | 55 | in range |  |
| 0x016D | P109_hotWaterTempLower | P-parameter | Hot water set temp lowest | °C | ×1 | ×1 | ×1 | 10–30 | — | 20 | in range |  |
| 0x016E | P110_heatingTempUpper | P-parameter | Heating set temp upper | °C | ×1 | ×1 | ×1 | 30–80 | — | 50 | in range |  |
| 0x016F | P111_heatingTempLower | P-parameter | Heating set temp lowest | °C | ×1 | ×1 | ×1 | 15–30 | — | 15 | in range |  |
| 0x0170 | P112_coolingTempUpper | P-parameter | Cooling set temp upper | °C | ×1 | ×1 | ×1 | 20–40 | — | 25 | in range |  |
| 0x0171 | P113_coolingTempLower | P-parameter | Cooling set temp lowest | °C | ×1 | ×1 | ×1 | 5–20 | — | 18 | in range |  |
| 0x0172 | P114_nrCompressors | P-parameter | Nr of compressors |  | ×1 | ×1 | ×1 | 1–2 | — | 1 | in range | 1=single, 2=pair |
| 0x0173 | P115_modelSelection | P-parameter | Model selection |  | ×1 | ×1 | ×1 | 0–5 | — | 1 | in range | 0=double supply, 1=triple, ... |
| 0x0174 | P116_tempControlMode | P-parameter | Temp control mode |  | ×1 | ×1 | ×1 | 0–1 | 0 | 0 | in range | Adlar Aurora II: 0=inlet T6 (return water), 1=outlet T7 (discharge) |
| 0x0175 | P117_antifreezeAmbient | P-parameter | Antifreeze ambient temp | °C | ×1 | ×1 | ×1 | 0–10 | 5 | 5 | in range |  |
| 0x0176 | P118_antifreezeOutlet | P-parameter | Antifreeze outlet water | °C | ×1 | ×1 | ×1 | 0–20 | 3 | 3 | in range |  |
| 0x0177 | P119_refrigerantType | P-parameter | Refrigerant type |  | ×1 | ×1 | ×1 | 1–3 | — | 2 | in range | 1=R410A, 2=R32 (Adlar Aurora II), 3=R290. Validatie: moet 2 zijn. |
| 0x0178 | P120_antiCondensation | P-parameter | Anti-condensation function |  | ×1 | ×1 | ×1 | 0–1 | 0 | 1 | in range | 0=enable, 1=disable |
| 0x0179 | P121_heatingFreqShield1Low | P-parameter | Heating freq shield zone 1 low | Hz | ×1 | ×1 | ×1 | 0–120 | — | 0 | in range |  |
| 0x017A | P122_heatingFreqShield1High | P-parameter | Heating freq shield zone 1 high | Hz | ×1 | ×1 | ×1 | 0–120 | — | 0 | in range |  |
| 0x017B | P123_heatingFreqShield2Low | P-parameter | Heating freq shield zone 2 low | Hz | ×1 | ×1 | ×1 | 0–120 | — | 0 | in range |  |
| 0x017C | P124_heatingFreqShield2High | P-parameter | Heating freq shield zone 2 high | Hz | ×1 | ×1 | ×1 | 0–120 | — | 0 | in range |  |
| 0x017D | P125_heatingFreqShield3Low | P-parameter | Heating freq shield zone 3 low | Hz | ×1 | ×1 | ×1 | 0–120 | — | 0 | in range |  |
| 0x017E | P126_heatingFreqShield3High | P-parameter | Heating freq shield zone 3 high | Hz | ×1 | ×1 | ×1 | 0–120 | — | 0 | in range |  |
| 0x017F | P127_coolingFreqShield1Low | P-parameter | Cooling freq shield zone 1 low | Hz | ×1 | ×1 | ×1 | 0–120 | — | 0 | in range |  |
| 0x0180 | P128_coolingFreqShield1High | P-parameter | Cooling freq shield zone 1 high | Hz | ×1 | ×1 | ×1 | 0–120 | — | 0 | in range |  |
| 0x0181 | P129_coolingFreqShield2Low | P-parameter | Cooling freq shield zone 2 low | Hz | ×1 | ×1 | ×1 | 0–120 | — | 0 | in range |  |
| 0x0182 | P130_coolingFreqShield2High | P-parameter | Cooling freq shield zone 2 high | Hz | ×1 | ×1 | ×1 | 0–120 | — | 0 | in range |  |
| 0x0183 | P131_coolingFreqShield3Low | P-parameter | Cooling freq shield zone 3 low | Hz | ×1 | ×1 | ×1 | 0–120 | — | 0 | in range |  |
| 0x0184 | P132_coolingFreqShield3High | P-parameter | Cooling freq shield zone 3 high | Hz | ×1 | ×1 | ×1 | 0–120 | — | 0 | in range |  |
| 0x0185 | P133_fanModule | P-parameter | Fan module |  | ×1 | ×1 | ×1 | 0–1 | — | 1 | in range | 0=integral module, 1=individual module |
| 0x0186 | P134_lowWaterFlow | P-parameter | Low water flow protection | L/min | ×1 | ×1 | ×1 | 0–100 | — | 0 | in range | 0=disabled |
| 0x0187 | P135_antiCondensationTempDiff | P-parameter | Anti-condensation start temp diff | °C | ×1 | ×1 | ×1 | 0–50 | — | 5 | in range |  |
| 0x0188 | P136_throttleBypassAmbientTemp | P-parameter | Throttle bypass valve open ambient temp | °C | ×1 | ×1 | ×1 | -20–50 | — | 25 | in range |  |
| 0x0189 | P137_throttleBypassDelay | P-parameter | Throttle bypass delay compressor | s | ×1 | ×1 | ×1 | 0–999 | — | 0 | in range |  |
| 0x018A | P138_defrostCompressorFreq | P-parameter | Defrost compressor frequency | Hz | ×1 | ×1 | ×1 | 40–120 | — | 70 | in range |  |
| 0x018B | P139_bufferTankEHeating | P-parameter | Buffer tank electric heater |  | ×1 | ×1 | ×1 | 0–2 | 0 | 0 | in range | 0=enable, 1=disable, 2=AHS (Auxiliary Heat Source) |
| 0x018C | P140_dhwEHeating | P-parameter | DHW electric heater |  | ×1 | ×1 | ×1 | 0–2 | 0 | 0 | in range | 0=enable, 1=disable, 2=AHS |
| 0x018D | P141_dewPointDefrostDuration | P-parameter | Dew point defrost duration | min | ×1 | ×1 | ×1 | 0–60 | — | 5 | in range |  |
| 0x018E | P142_dewPointDefrostConstant | P-parameter | Dew point defrost constant |  | ×1 | ×1 | ×1 | 0–60 | — | 11 | in range |  |
| 0x018F | P143_waterTempEnterDefrost | P-parameter | Water temp to enter defrost | °C | ×1 | ×1 | ×1 | 0–60 | — | 7 | in range |  |
| 0x0190 | P144_ambientTempEnterDefrost | P-parameter | Ambient temp to enter defrost | °C | ×1 | ×1 | ×1 | -20–30 | — | 17 | in range |  |
| 0x0191 | P145_outletAntifreezeProtection | P-parameter | Outlet water antifreeze protection | °C | ×1 | ×1 | ×1 | -20–10 | — | -30 | ⚠️ **OUT OF RANGE** |  |
| 0x0192 | P146_pumpRangeSetting | P-parameter | Pump PWM range setting | L/min | ×1 | ×1 | ×1 | 0–100 | — | 35 | in range |  |
| 0x0193 | P147_coolingAntifreezeMode | P-parameter | Cooling antifreeze mode |  | ×1 | ×1 | ×1 | 0–2 | — | 2 | in range | 0=low pressure, 1=temp, 2=low pressure + temp |
| 0x0194 | P148_coolingAntifreezeTemp | P-parameter | Cooling antifreeze temperature | °C | ×1 | ×1 | ×1 | -30–10 | — | 1 | in range |  |
| 0x0195 | P149_outletHighLimitTemp | P-parameter | Outlet water high limit temperature | °C | ×1 | ×1 | ×1 | 40–80 | — | 58 | in range |  |
| 0x0196 | P150_secondaryHeatingPump | P-parameter | Secondary heating pump select |  | ×1 | ×1 | ×1 | 0–3 | 2 | 2 | in range | 0=power on run, 1=power on, 2=linkage demand switch, 3=temperature control |
| 0x0197 | P151_returnDiffHwSource | P-parameter | Return diff - hot water heat source | °C | ×1 | ×1 | ×1 | 0–40 | 0 | 0 | in range |  |
| 0x0198 | P152_returnDiffHeatSource | P-parameter | Return diff - heating heat source | °C | ×1 | ×1 | ×1 | 0–40 | 0 | 1 | in range |  |
| 0x0199 | P153_dhwHeatSourceUpperTemp | P-parameter | DHW heat source upper temp | °C | ×1 | ×1 | ×1 | 15–80 | — | 70 | in range |  |
| 0x019A | P154_heatingHeatSourceUpperTemp | P-parameter | Heating heat source upper temp | °C | ×1 | ×1 | ×1 | 15–80 | — | 60 | in range |  |
| 0x019B | P155_compressorCode | P-parameter | Compressor code (reserved) |  | ×1 | ×1 | ×1 | 0–9999 | — | 0 | in range |  |
| 0x019C | P156_auxEevSelection | P-parameter | Aux EEV selection |  | ×1 | ×1 | ×1 | 0–1 | — | 0 | in range | 0=enable, 1=disable |
| 0x019D | P157_auxEevTempDiffReduce | P-parameter | Aux EEV temp diff to reduce | °C | ×1 | ×1 | ×1 | 0–99 | — | 0 | in range |  |
| 0x019E | P158_heatingLimitWaterTempStartAmb | P-parameter | Heating limit water temp start ambient | °C | ×1 | ×1 | ×1 | -45–30 | — | -15 | in range |  |
| 0x019F | P159_limitTempConstant | P-parameter | Limit temperature constant |  | ×1 | ×1 | ×1 | 0–150 | — | 68 | in range |  |
| 0x01A0 | P160_limitTempCoefficient | P-parameter | Limit temperature coefficient |  | ×1 | ×1 | ×1 | -500–500 | — | 14 | in range |  |
| 0x01A1 | P161_auxPumpSelection | P-parameter | Aux pump selection |  | ×1 | ×1 | ×1 | 0–4 | 0 | 0 | in range | 0=DHW, 1=AC, 2=floor, 3=AC/floor, 4=all |
| 0x01A2 | P162_antifreezeDHWInterval | P-parameter | Antifreeze DHW pipe interval | min | ×1 | ×1 | ×1 | 0–360 | 90 | 0 | in range | 0=disabled |
| 0x01A3 | P163_pumpMinSpeedFeedback | P-parameter | Min pump speed feedback | % | ×1 | ×1 | ×1 | 0–70 | — | 30 | in range | FIX v2.0: OEM doc zegt L/min, Excel zegt %. Range 0-70 past bij % minimum PWM feedback drempel |
| 0x01A4 | P164_energyLevelControl | P-parameter | Energy level control |  | ×1 | ×1 | ×1 | 0–3 | — | 0 | in range | 0=all enable, 1=E-heat disable, 2=compressor disable, 3=all disable |
| 0x01A5 | P165_loadReturnDiff | P-parameter | Load shedding return difference | °C | ×1 | ×1 | ×1 | 1–15 | — | 3 | in range |  |
| 0x01A6 | P166_loadSheddingHysteresis | P-parameter | Load shedding hysteresis | °C | ×1 | ×1 | ×1 | 1–15 | — | 2 | in range |  |
| 0x01A7 | P167_emergencyStopReturnDiff | P-parameter | Load shedding emergency stop return diff | °C | ×1 | ×1 | ×1 | 1–15 | — | 3 | in range |  |
| 0x01A8 | P168_hotWaterStartRatio | P-parameter | Load shedding hot water start ratio | % | ×1 | ×1 | ×1 | 1–100 | — | 50 | in range |  |
| 0x01A9 | P169_nonHotWaterStartRatio | P-parameter | Load shedding non-hot water start ratio | % | ×1 | ×1 | ×1 | 1–100 | — | 100 | in range |  |
| 0x01AA | P170_loadingCycle | P-parameter | Load shedding loading cycle | min | ×1 | ×1 | ×1 | 3–60 | — | 7 | in range |  |
| 0x01AB | P171_shieldLowVoltageAmbient | P-parameter | Load shedding shield low voltage ambient | °C | ×1 | ×1 | ×1 | -50–0 | — | -30 | in range |  |
| 0x01AC | P172_dcFanTargetFreqConstC | P-parameter | DC fan target frequency constant c | Hz | ×1 | ×1 | ×1 | 40–70 | — | 65 | in range |  |
| 0x01AD | P173_heatingFanFreqLowerLimit | P-parameter | Heating fan target frequency lower limit | Hz | ×1 | ×1 | ×1 | 20–65 | — | 40 | in range |  |
| 0x01AE | P174_defrostOpening | P-parameter | Defrost valve opening | P | ×1 | ×1 | ×1 | 0–480 | 450 | 450 | in range |  |
| 0x01AF | P175_constTempOperationCycle | P-parameter | Constant temp operation cycle | min | ×1 | ×1 | ×1 | 0–360 | — | 10 | in range |  |
| 0x01B0 | P176_minDefrostTime | P-parameter | Minimum defrost time | s | ×1 | ×1 | ×1 | 0–999 | — | 0 | in range |  |
| 0x01B1 | P177_defrostSegmentedWaterTemp | P-parameter | Defrost segmented water temperature | °C | ×1 | ×1 | ×1 | 0–80 | — | 40 | in range |  |
| 0x01B2 | P178_highWaterTempDefrostFreq | P-parameter | High water temp defrost frequency | Hz | ×1 | ×1 | ×1 | 40–120 | — | 70 | in range |  |
| 0x01B3 | P179_strongModeFreqIncrease | P-parameter | Strong mode frequency increase | Hz | ×1 | ×1 | ×1 | 0–40 | — | 15 | in range |  |
| 0x01B4 | P180_powerfulModeFreqCap | P-parameter | Powerful mode frequency cap | Hz | ×1 | ×1 | ×1 | 0–40 | — | 5 | in range |  |
| 0x01B5 | P181_defrostEvapSide | P-parameter | Defrost selection - evaporate side |  | ×1 | ×1 | ×1 | 0–2 | 0 | 0 | in range | 0=current mode, 1=heating, 2=DHW |
| 0x01B6 | P182_pipeEHeatingOption | P-parameter | Pipe electric heating option |  | ×1 | ×1 | ×1 | 0–3 | — | 3 | in range | 0=3kW+6kW, 1=3kW, 2=6kW, 3=disabled |
| 0x01B7 | P183_parameterPassword | P-parameter | Parameter password |  | ×1 | ×1 | ×1 | 0–9999 | — | 998 | in range | 0=disable |
| 0x01B8 | P184_35D_compressorFreq | Working condition | Working cond 35D compressor frequency | Hz | ×1 | ×1 | ×1 | 0–120 | — | 25 | in range |  |
| 0x01B9 | P185_35C_compressorFreq | Working condition | Working cond 35C compressor frequency | Hz | ×1 | ×1 | ×1 | 0–120 | — | 25 | in range |  |
| 0x01BA | P186_35B_compressorFreq | Working condition | Working cond 35B compressor frequency | Hz | ×1 | ×1 | ×1 | 0–120 | — | 39 | in range |  |
| 0x01BB | P187_35A_compressorFreq | Working condition | Working cond 35A compressor frequency | Hz | ×1 | ×1 | ×1 | 0–120 | — | 78 | in range |  |
| 0x01BC | P188_35E_compressorFreq | Working condition | Working cond 35E compressor frequency | Hz | ×1 | ×1 | ×1 | 0–120 | — | 85 | in range |  |
| 0x01BD | P189_55D_compressorFreq | Working condition | Working cond 55D compressor frequency | Hz | ×1 | ×1 | ×1 | 0–120 | — | 25 | in range |  |
| 0x01BE | P190_55C_compressorFreq | Working condition | Working cond 55C compressor frequency | Hz | ×1 | ×1 | ×1 | 0–120 | — | 25 | in range |  |
| 0x01BF | P191_55B_compressorFreq | Working condition | Working cond 55B compressor frequency | Hz | ×1 | ×1 | ×1 | 0–120 | — | 39 | in range |  |
| 0x01C0 | P192_55A_compressorFreq | Working condition | Working cond 55A compressor frequency | Hz | ×1 | ×1 | ×1 | 0–120 | — | 78 | in range |  |
| 0x01C1 | P193_55E_compressorFreq | Working condition | Working cond 55E compressor frequency | Hz | ×1 | ×1 | ×1 | 0–120 | — | 85 | in range |  |
| 0x01C2 | P194_35D_fanFreq | Working condition | Working cond 35D fan frequency | Hz | ×1 | ×1 | ×1 | 0–60 | — | 25 | in range |  |
| 0x01C3 | P195_35C_fanFreq | Working condition | Working cond 35C fan frequency | Hz | ×1 | ×1 | ×1 | 0–60 | — | 25 | in range |  |
| 0x01C4 | P196_35B_fanFreq | Working condition | Working cond 35B fan frequency | Hz | ×1 | ×1 | ×1 | 0–60 | — | 45 | in range |  |
| 0x01C5 | P197_35A_fanFreq | Working condition | Working cond 35A fan frequency | Hz | ×1 | ×1 | ×1 | 0–60 | — | 55 | in range |  |
| 0x01C6 | P198_35E_fanFreq | Working condition | Working cond 35E fan frequency | Hz | ×1 | ×1 | ×1 | 0–60 | — | 55 | in range |  |
| 0x01C7 | P199_55D_fanFreq | Working condition | Working cond 55D fan frequency | Hz | ×1 | ×1 | ×1 | 0–60 | — | 25 | in range |  |
| 0x01C8 | P200_55C_fanFreq | Working condition | Working cond 55C fan frequency | Hz | ×1 | ×1 | ×1 | 0–60 | — | 25 | in range |  |
| 0x01C9 | P201_55B_fanFreq | Working condition | Working cond 55B fan frequency | Hz | ×1 | ×1 | ×1 | 0–60 | — | 45 | in range |  |
| 0x01CA | P202_55A_fanFreq | Working condition | Working cond 55A fan frequency | Hz | ×1 | ×1 | ×1 | 0–60 | — | 55 | in range |  |
| 0x01CB | P203_55E_fanFreq | Working condition | Working cond 55E fan frequency | Hz | ×1 | ×1 | ×1 | 0–60 | — | 55 | in range |  |
| 0x01CC | P204_35D_mainValveSuperheat | Working condition | Working cond 35D main valve superheat | °C | ×1 | ×1 | ×1 | -10–10 | — | 1 | in range |  |
| 0x01CD | P205_35C_mainValveSuperheat | Working condition | Working cond 35C main valve superheat | °C | ×1 | ×1 | ×1 | -10–10 | — | 1 | in range |  |
| 0x01CE | P206_35B_mainValveSuperheat | Working condition | Working cond 35B main valve superheat | °C | ×1 | ×1 | ×1 | -10–10 | — | 2 | in range |  |
| 0x01CF | P207_35A_mainValveSuperheat | Working condition | Working cond 35A main valve superheat | °C | ×1 | ×1 | ×1 | -10–10 | — | 2 | in range |  |
| 0x01D0 | P208_35E_mainValveSuperheat | Working condition | Working cond 35E main valve superheat | °C | ×1 | ×1 | ×1 | -10–10 | — | 2 | in range |  |
| 0x01D1 | P209_55D_mainValveSuperheat | Working condition | Working cond 55D main valve superheat | °C | ×1 | ×1 | ×1 | -10–10 | — | 2 | in range |  |
| 0x01D2 | P210_55C_mainValveSuperheat | Working condition | Working cond 55C main valve superheat | °C | ×1 | ×1 | ×1 | -10–10 | — | 2 | in range |  |
| 0x01D3 | P211_55B_mainValveSuperheat | Working condition | Working cond 55B main valve superheat | °C | ×1 | ×1 | ×1 | -10–10 | — | 2 | in range |  |
| 0x01D4 | P212_55A_mainValveSuperheat | Working condition | Working cond 55A main valve superheat | °C | ×1 | ×1 | ×1 | -10–10 | — | 2 | in range |  |
| 0x01D5 | P213_55E_mainValveSuperheat | Working condition | Working cond 55E main valve superheat | °C | ×1 | ×1 | ×1 | -10–10 | — | 2 | in range |  |
| 0x01D6 | P214_35D_mainValveOpening | Working condition | Working cond 35D main valve opening | P | ×1 | ×1 | ×1 | 0–500 | — | 130 | in range |  |
| 0x01D7 | P215_35C_mainValveOpening | Working condition | Working cond 35C main valve opening | P | ×1 | ×1 | ×1 | 0–500 | — | 90 | in range |  |
| 0x01D8 | P216_35B_mainValveOpening | Working condition | Working cond 35B main valve opening | P | ×1 | ×1 | ×1 | 0–500 | — | 100 | in range |  |
| 0x01D9 | P217_35A_mainValveOpening | Working condition | Working cond 35A main valve opening | P | ×1 | ×1 | ×1 | 0–500 | — | 150 | in range |  |
| 0x01DA | P218_35E_mainValveOpening | Working condition | Working cond 35E main valve opening | P | ×1 | ×1 | ×1 | 0–500 | — | 130 | in range |  |
| 0x01DB | P219_55D_mainValveOpening | Working condition | Working cond 55D main valve opening | P | ×1 | ×1 | ×1 | 0–500 | — | 110 | in range |  |
| 0x01DC | P220_55C_mainValveOpening | Working condition | Working cond 55C main valve opening | P | ×1 | ×1 | ×1 | 0–500 | — | 85 | in range |  |
| 0x01DD | P221_55B_mainValveOpening | Working condition | Working cond 55B main valve opening | P | ×1 | ×1 | ×1 | 0–500 | — | 90 | in range |  |
| 0x01DE | P222_55A_mainValveOpening | Working condition | Working cond 55A main valve opening | P | ×1 | ×1 | ×1 | 0–500 | — | 120 | in range |  |
| 0x01DF | P223_55E_mainValveOpening | Working condition | Working cond 55E main valve opening | P | ×1 | ×1 | ×1 | 0–500 | — | 100 | in range |  |
| 0x01E0 | P224_35D_auxValveSuperheat | Working condition | Working cond 35D aux valve superheat | °C | ×1 | ×1 | ×1 | -10–10 | — | 2 | in range |  |
| 0x01E1 | P225_35C_auxValveSuperheat | Working condition | Working cond 35C aux valve superheat | °C | ×1 | ×1 | ×1 | -10–10 | — | 2 | in range |  |
| 0x01E2 | P226_35B_auxValveSuperheat | Working condition | Working cond 35B aux valve superheat | °C | ×1 | ×1 | ×1 | -10–10 | — | 2 | in range |  |
| 0x01E3 | P227_35A_auxValveSuperheat | Working condition | Working cond 35A aux valve superheat | °C | ×1 | ×1 | ×1 | -10–10 | — | 2 | in range |  |
| 0x01E4 | P228_35E_auxValveSuperheat | Working condition | Working cond 35E aux valve superheat | °C | ×1 | ×1 | ×1 | -10–10 | — | 2 | in range |  |
| 0x01E5 | P229_55D_auxValveSuperheat | Working condition | Working cond 55D aux valve superheat | °C | ×1 | ×1 | ×1 | -10–10 | — | 2 | in range |  |
| 0x01E6 | P230_55C_auxValveSuperheat | Working condition | Working cond 55C aux valve superheat | °C | ×1 | ×1 | ×1 | -10–10 | — | 2 | in range |  |
| 0x01E7 | P231_55B_auxValveSuperheat | Working condition | Working cond 55B aux valve superheat | °C | ×1 | ×1 | ×1 | -10–10 | — | 2 | in range |  |
| 0x01E8 | P232_55A_auxValveSuperheat | Working condition | Working cond 55A aux valve superheat | °C | ×1 | ×1 | ×1 | -10–10 | — | 2 | in range |  |
| 0x01E9 | P233_55E_auxValveSuperheat | Working condition | Working cond 55E aux valve superheat | °C | ×1 | ×1 | ×1 | -10–10 | — | 2 | in range |  |
| 0x01EA | P234_35D_auxValveOpening | Working condition | Working cond 35D aux valve opening | P | ×1 | ×1 | ×1 | 0–500 | — | 125 | in range |  |
| 0x01EB | P235_35C_auxValveOpening | Working condition | Working cond 35C aux valve opening | P | ×1 | ×1 | ×1 | 0–500 | — | 85 | in range |  |
| 0x01EC | P236_35B_auxValveOpening | Working condition | Working cond 35B aux valve opening | P | ×1 | ×1 | ×1 | 0–500 | — | 35 | in range |  |
| 0x01ED | P237_35A_auxValveOpening | Working condition | Working cond 35A aux valve opening | P | ×1 | ×1 | ×1 | 0–500 | — | 65 | in range |  |
| 0x01EE | P238_35E_auxValveOpening | Working condition | Working cond 35E aux valve opening | P | ×1 | ×1 | ×1 | 0–500 | — | 85 | in range |  |
| 0x01EF | P239_55D_auxValveOpening | Working condition | Working cond 55D aux valve opening | P | ×1 | ×1 | ×1 | 0–500 | — | 140 | in range |  |
| 0x01F0 | P240_55C_auxValveOpening | Working condition | Working cond 55C aux valve opening | P | ×1 | ×1 | ×1 | 0–500 | — | 330 | in range |  |
| 0x01F1 | P241_55B_auxValveOpening | Working condition | Working cond 55B aux valve opening | P | ×1 | ×1 | ×1 | 0–500 | — | 200 | in range |  |
| 0x01F2 | P242_55A_auxValveOpening | Working condition | Working cond 55A aux valve opening | P | ×1 | ×1 | ×1 | 0–500 | — | 350 | in range |  |
| 0x01F3 | P243_55E_auxValveOpening | Working condition | Working cond 55E aux valve opening | P | ×1 | ×1 | ×1 | 0–500 | — | 350 | in range |  |
| 0x01F4 | P244_35lowWaterFlow | Working condition | Working cond 35 low water target flow | L/min | ×1 | ×1 | ×1 | 0–100 | — | 22 | in range |  |
| 0x01F5 | P245_55highWaterFlow | Working condition | Working cond 55 high water target flow | L/min | ×1 | ×1 | ×1 | 0–100 | — | 15 | in range |  |
| 0x01F6 | P246_35ratedFanFreq | Working condition | Working cond 35 rated fan frequency | Hz | ×1 | ×1 | ×1 | 0–60 | — | 50 | in range |  |
| 0x01F7 | P247_35ratedMainValveOpening | Working condition | Working cond 35 rated main valve opening | P | ×1 | ×1 | ×1 | 0–500 | — | 220 | in range |  |
| 0x01F8 | P248_55ratedFanFreq | Working condition | Working cond 55 rated fan frequency | Hz | ×1 | ×1 | ×1 | 0–60 | — | 50 | in range |  |
| 0x01F9 | P249_55ratedMainValveOpening | Working condition | Working cond 55 rated main valve opening | P | ×1 | ×1 | ×1 | 0–500 | — | 170 | in range |  |
| 0x01FA | P250_35ratedMainValveSuperheat | Working condition | Working cond 35 rated main valve superheat | °C | ×1 | ×1 | ×1 | -10–10 | — | 4 | in range |  |
| 0x01FB | P251_pfcShutdownCurrent | Working condition | Working cond PFC shutdown current | A | ×1 | ×1 | ×1 | 0–50 | — | 5 | in range |  |
| 0x01FC | P252_55ratedMainValveSuperheat | Working condition | Working cond 55 rated main valve superheat | °C | ×1 | ×1 | ×1 | -10–10 | — | 3 | in range |  |
| 0x01FD | P253_pfcTurnOnCurrent | Working condition | Working cond PFC turn-on current | A | ×1 | ×1 | ×1 | 0–50 | — | 6 | in range |  |
| 0x01FE | P254_heatingMedium | P-parameter | Heating medium |  | ×1 | ×1 | ×1 | 0–1 | 0 | 0 | in range | 0=water, 1=antifreeze liquid |
| 0x01FF | P255_smartGridOptions | P-parameter | Smart Grid enable |  | ×1 | ×1 | ×1 | 0–1 | — | 1 | in range | 0=enable, 1=disable (inverse logica!) |
| 0x0200 | P256_peakGridRuntime | P-parameter | Peak grid runtime | min | ×1 | ×1 | ×1 | 30–999 | — | 30 | in range |  |
| 0x0201 | P257_dualZoneSelection | P-parameter | Dual temperature zone selection |  | ×1 | ×1 | ×1 | 0–2 | — | 2 | in range | 0=auto, 1=manual, 2=disable |
| 0x0202 | P258_mixingValveCycle | P-parameter | Mixing water valve cycle | min | ×1 | ×1 | ×1 | 5–20 | — | 7 | in range |  |
| 0x0203 | P259_mixingValveFullCycle | P-parameter | Mixing valve full cycle time | s | ×1 | ×1 | ×1 | 0–180 | — | 120 | in range |  |
| 0x0204 | P260_pumpMaxSpeed | P-parameter | Max DC pump speed | % | ×1 | ×1 | ×1 | 50–99 | — | 99 | in range |  |
| 0x0205 | P261_pumpConstTempSpeed | P-parameter | DC pump constant temp speed | % | ×1 | ×1 | ×1 | 20–99 | — | 30 | in range |  |
| 0x0206 | P262_floorHeatingTestMode | P-parameter | Floor heating test mode selection |  | ×1 | ×1 | ×1 | 0–1 | — | 1 | in range | 0=Enable, 1=Disable |
| 0x0300 | tempSetCooling 🌡 | User control | Cooling Set Temperature | °C | ×1 | ×1 | ×0.1 | 7–25 | 12 | 24 | in range |  |
| 0x0301 | tempSetHeating 🌡 | User control | Heating Set Temperature | °C | ×1 | ×1 | ×0.1 | 15–60 | 55 | 40 | in range |  |
| 0x0302 | tempSetHotWater 🌡 | User control | Hot Water Set Temperature | °C | ×1 | ×1 | ×0.1 | 20–75 | 55 | 40 | in range |  |
| 0x0303 | tempSetFloorHeating 🌡 | User control | Floor Heating Set Temperature | °C | ×1 | ×1 | ×0.1 | 20–60 | 50 | 36 | in range |  |
| 0x0304 | mode | User control | Set Mode |  | ×1 | ×1 | ×1 | — | — | 1 | read | 0=Cooling, 1=Heating, 2=Hot Water, 3=Floor Heating, 4=Hot Water+Cooling, 5=Hot Water+Heating, 6=Reserve, 7=Hot Water+Floor Heating |
| 0x0305 | mainSwitch | User control | On/Off |  | ×1 | ×1 | ×1 | — | — | 1 | read | 0=OFF, 1=ON |
| 0x0306 | indoorTempSetpoint 🌡 | User control | Indoor Temperature Set Point | °C | ×1 | ×1 | ×0.1 | — | — | 22 | read |  |
| 0x0307 | runningMode | User control | User Function Mode |  | ×1 | ×1 | ×1 | — | — | 0 | read | 0=Standard, 1=Powerful, 2=Silent |
| 0x030C | heatingFloorCurveLegacy | User control | Heating/Floor Curve (legacy) |  | ×1 | ×1 | ×1 | — | — | 18 | read | High byte = floor curve, Low byte = heating curve. Protocol < 130 |
| 0x030D | coolingHwCurveLegacy | User control | Cooling/HW Curve (legacy) |  | ×1 | ×1 | ×1 | — | — | 0 | read | High byte = cooling curve, Low byte = hot water curve. Protocol < 130 |
| 0x0313 | coolingCurve | User control | Cooling Curve Setting |  | ×1 | ×1 | ×1 | 0–18 | — | 0 | in range | 0=off, 1-8=high temp, 11-18=low temp. Vereist protocol 130 |
| 0x0314 | heatingCurve | User control | Heating Curve Setting |  | ×1 | ×1 | ×1 | 0–18 | — | 18 | in range | 0=off, 1-8=high temp, 11-18=low temp. Vereist protocol 130 |
| 0x0315 | hotWaterCurve | User control | Hot Water Curve Setting |  | ×1 | ×1 | ×1 | 0–4 | — | 0 | in range | 0=off, 1-4=curve. Vereist protocol 130 |
| 0x0316 | floorHeatingCurve | User control | Floor Heating Curve Setting |  | ×1 | ×1 | ×1 | 0–18 | — | 0 | in range | 0=off, 1-8=high temp, 11-18=low temp. Vereist protocol 130 |
| 0x0317 | zone2Temp 🌡 | User control | Zone 2 Temperature | °C | ×1 | ×1 | ×0.1 | — | — | 35 | read |  |
| 0x0319 | zone1Temp 🌡 | User control | Zone 1 Temperature | °C | ×1 | ×1 | ×0.1 | — | — | 55 | read |  |
| 0x0330 | unitControl | User command | Unit Control |  | bitmask | bitmask | bitmask | — | — | 1536 | read |  |
| 0x0331 | loadForcingControl | User command | Load Forcing Control |  | bitmask | bitmask | bitmask | — | — | 0 | read | ⚙ **service-only** |
| 0x0332 | compressor1ForcedFreq | User command | Compressor 1 forced freq | Hz | ×1 | ×1 | ×1 | 0–120 | — | 0 | in range | ⚙ **service-only** |
| 0x0333 | compressor2ForcedFreq | User command | Compressor 2 forced freq | Hz | ×1 | ×1 | ×1 | 0–120 | — | 0 | in range | ⚙ **service-only** |
| 0x0336 | eev1ForcedOpen | User command | EEV 1 forced open | P | ×1 | ×1 | ×1 | 0–500 | — | 0 | in range | ⚙ **service-only** |
| 0x0337 | eev2ForcedOpen | User command | EEV 2 forced open | P | ×1 | ×1 | ×1 | 0–500 | — | 0 | in range | ⚙ **service-only** |
| 0x033A | evi1ForcedOpen | User command | EVI EEV 1 forced open | P | ×1 | ×1 | ×1 | 0–500 | — | 0 | in range | ⚙ **service-only** |
| 0x033B | evi2ForcedOpen | User command | EVI EEV 2 forced open | P | ×1 | ×1 | ×1 | 0–500 | — | 0 | in range | ⚙ **service-only** |
| 0x033E | fanForcedSpeed | User command | Fan forced speed | Hz | ×1 | ×1 | ×1 | 0–80 | — | 0 | in range | ⚙ **service-only** |
| 0x0343 | dcPumpControl | User command | DC Pump Control |  | ×1 | ×1 | ×1 | 0–1 | — | 0 | in range | 0=Auto, 1=Manual |
| 0x0344 | dcPumpOutput | User command | DC Pump Output | % | ×1 | ×1 | ×1 | 0–100 | — | 0 | in range |  |
| 0x0345 | pfcControl | User command | PFC Control |  | ×1 | ×1 | ×1 | 0–2 | — | 0 | in range | 0=Auto, 1=Open/Close, 2=Open · ⚙ **service-only** |
| 0x0360 | programVersion | Version | Program Version |  | ×1 | ×1 | ×1 | — | — | 433 | read | 100 = V1.0.0 |
| 0x0361 | productType | Version | Product Type |  | ×1 | ×1 | ×1 | — | — | 0 | read | 0=Commercial inverter, 1=Domestic ON/OFF, 2=Commercial ON/OFF |
| 0x0362 | productTypeId | Version | Product Type ID |  | ×1 | ×1 | ×1 | — | — | 1 | read | Sub-type. 1-domestic: 0=inverter. 0-commercial: 0=2-unit, 1=3-unit |
| 0x0363 | protocolVersion | Version | Protocol Version |  | ×1 | ×1 | ×1 | — | — | 143 | read | 100=V1.0.0. 130 = coil support (01H/05H) + separate curve registers (0x0313-0x0316) |
| 0x0800 | L11_pipeElecHeatingTime | L-parameter | Pipe electricity heating cycle | min | ×1 | ×1 | ×1 | 1–300 | — | 30 | in range |  |
| 0x0801 | L12_sterilizationMode | L-parameter | Sterilization mode |  | ×1 | ×1 | ×1 | 0–2 | 0 | 1 | in range | 0=auto, 1=off, 2=manual |
| 0x0802 | L13_sterilizationInterval | L-parameter | Days between sterilizations | days | ×1 | ×1 | ×1 | 5–30 | 7 | 7 | in range |  |
| 0x0803 | L14_sterilizationStartTime | L-parameter | Sterilization start time |  | ×1 | ×1 | ×1 | — | 2300 | 23 | read | Format: HHMM (bijv. 2300 = 23:00). Default: 23:00 |
| 0x0804 | L15_sterilizationRunTime | L-parameter | Sterilization run time | min | ×1 | ×1 | ×1 | 0–50 | 10 | 10 | in range |  |
| 0x0805 | L16_sterilizationTemp | L-parameter | Sterilization temperature | °C | ×1 | ×1 | ×1 | 50–80 | 70 | 70 | in range |  |
| 0x0806 | L17_waterLevelControl | L-parameter | Water level control |  | ×1 | ×1 | ×1 | 0–2 | — | 1 | in range | 0=Off, 1=Hi/Lo switch, 2=Hi/Hi/Lo switch |
| 0x0807 | L18_hydrationControl | L-parameter | Hydration control |  | ×1 | ×1 | ×1 | 0–1 | — | 1 | in range | 0=level only, 1=temp + level |
| 0x0808 | L19_allowWaterTemp | L-parameter | Allow water temperature | °C | ×1 | ×1 | ×1 | 0–99 | 45 | 45 | in range |  |
| 0x0809 | L20_hysteresisReplenishment | L-parameter | Hysteresis replenishment water | °C | ×1 | ×1 | ×1 | 0–20 | 5 | 5 | in range |  |
| 0x080A | L21_lowWaterCutoff | L-parameter | Low water cut-off operation |  | ×1 | ×1 | ×1 | 0–2 | — | 1 | in range | 0=no start, 1=on but no start, 2=start |
| 0x080B | L22_backwaterMode | L-parameter | DHW return water setting |  | ×1 | ×1 | ×1 | 0–3 | 0 | 0 | in range | 0=disable, 1=continuous return, 2=cycle return, 3=temperature diff return |
| 0x080C | L23_backwaterSetTemp | L-parameter | Return water temp setting | °C | ×1 | ×1 | ×1 | 20–65 | 40 | 40 | in range |  |
| 0x080D | L24_backwaterHysteresis | L-parameter | Return water temp differential | °C | ×1 | ×1 | ×1 | 1–15 | 5 | 5 | in range |  |
| 0x080E | L25_backwaterCycle | L-parameter | Return water interval period | min | ×1 | ×1 | ×1 | 3–90 | 30 | 30 | in range |  |
| 0x080F | L26_backwaterReturnTime | L-parameter | Return water running period | min | ×1 | ×1 | ×1 | 1–30 | 5 | 5 | in range |  |
| 0x0810 | L27_heatingLowTempCurveDIY | L-parameter | Heating low temp curve DIY |  | ×1 | ×1 | ×1 | 0–1 | 0 | 0 | in range | 0=enable DIY curve, 1=disable. Wanneer enabled, gebruikt L28/L29 i.p.v. preset curves |
| 0x0811 | L28_heatingCurveCoeffK | L-parameter | Heating low temp curve coefficient k |  | ×1 | ×1 | ×1 | -50–0 | — | -5 | in range | Negatief: dalende lijn. Tset = k (Tamb + 15) + b. Bijv. k=-1.5 bij stooklijn RC=-1.5 |
| 0x0812 | L29_heatingCurveConstantB | L-parameter | Heating low temp curve constant b |  | ×1 | ×1 | ×1 | 30–80 | — | 55 | in range | Y-intercept van de stooklijn. Bijv. b=52.5 voor typische VT installatie |
| 0x0813 | L30_heatingCapacityStats | L-parameter | Heating capacity statistics |  | ×1 | ×1 | ×1 | 0–1 | 0 | 0 | in range | 0=enable, 1=disable. Schakelt interne energieboekhouding in. |
| 0x0814 | L31_externalPumpFlowRate | L-parameter | External pump flow rate | L/min | ×1 | ×1 | ×1 | 0–999 | — | 0 | in range | Vaste waarde als er geen flowmeter is. Gebruikt voor COP berekening. |
| 0x0815 | L32_dhwEHeaterPower | L-parameter | DHW electric heater power | W | ×1 | ×1 | ×1 | 0–9999 | — | 0 | in range |  |
| 0x0816 | L33_pipeEHeater1Power | L-parameter | Pipe electric heater 1 power | W | ×1 | ×1 | ×1 | 0–9999 | — | 0 | in range |  |
| 0x0817 | L34_pipeEHeater2Power | L-parameter | Pipe electric heater 2 power | W | ×1 | ×1 | ×1 | 0–9999 | — | 0 | in range |  |
| 0x0818 | L35_heatingEHeaterPower | L-parameter | Heating electric heater power | W | ×1 | ×1 | ×1 | 0–9999 | — | 0 | in range |  |
| 0x0819 | L36_externalPumpPower | L-parameter | External water pump power | W | ×1 | ×1 | ×1 | 0–9999 | — | 0 | in range |  |
| 0x1000 | powerfulMode | Coil | Powerful Mode |  | bool | bool | bool | — | — | 0→uit | read | write via FC05 |
| 0x1001 | silentMode | Coil | Silent Mode |  | bool | bool | bool | — | — | 0→uit | read | write via FC05 |
| 0x1012 | quickHeatMode | Coil | Quick Heat Mode |  | bool | bool | bool | — | — | 0→uit | read | write via FC05 |
| 0x1013 | forceDefrost | Coil | Force Defrost |  | bool | bool | bool | — | — | 0→uit | read | write via FC05 |
| 0x1014 | systemDrainMode | Coil | System Drain Mode |  | bool | bool | bool | — | — | 0→uit | read | write via FC05 |
| 0x1015 | refrigerantRecovery | Coil | Refrigerant Recovery |  | bool | bool | bool | — | — | 0→uit | read | write via FC05 |
| 0x1018 | forceSterilization | Coil | Force Sterilization |  | bool | bool | bool | — | — | 0→uit | read | write via FC05 |
| 0x101A | allowWaterReturn | Coil | Allow Water Return |  | bool | bool | bool | — | — | 1→aan | read | write via FC05 |
| 0x101D | restoreFactorySettings | Coil | Restore Factory Settings |  | bool | bool | bool | — | — | 0→uit | read | write via FC05 |
| 0x1020 | compressorForcedControl | Coil | Compressor Forced Control |  | bool | bool | bool | — | — | 0→uit | read | ⚙ **service-only** · write via FC05 |
| 0x1021 | eevForcedControl | Coil | EEV Forced Control |  | bool | bool | bool | — | — | 0→uit | read | ⚙ **service-only** · write via FC05 |
| 0x1022 | eviForcedControl | Coil | EVI Forced Control |  | bool | bool | bool | — | — | 0→uit | read | ⚙ **service-only** · write via FC05 |
| 0x1023 | fanForcedControl | Coil | Fan Forced Control |  | bool | bool | bool | — | — | 0→uit | read | ⚙ **service-only** · write via FC05 |

---

## 6. Snapshot-only registers (read but **not in the code model**)

These addresses were returned by the controller but have **no definition** in the register model.
Treat as undocumented; do not write to them. (`P309`/`L60` etc. are the expert tool's sequential
labels, not official names.)

| Addr | Label | Raw | Scaled | Note |
|---|---|---:|---:|---|
| 0x0207 | P263 | 3 | 3 |  |
| 0x0208 | P264 | 100 | 100 |  |
| 0x0209 | P265 | 1 | 1 |  |
| 0x020A | P266 | 0 | 0 |  |
| 0x020B | P267 | 5 | 5 |  |
| 0x020C | P268 | 1 | 1 |  |
| 0x020D | P269 | 125 | 125 |  |
| 0x020E | P270 | 85 | 85 |  |
| 0x020F | P271 | 400 | 400 |  |
| 0x0210 | P272 | 0 | 0 |  |
| 0x0211 | P273 | 0 | 0 |  |
| 0x0212 | P274 | 0 | 0 |  |
| 0x0213 | P275 | 0 | 0 |  |
| 0x0214 | P276 | 10 | 10 |  |
| 0x0215 | P277 | 80 | 80 |  |
| 0x0216 | P278 | 60 | 60 |  |
| 0x0217 | P279 | 120 | 120 |  |
| 0x0218 | P280 | 25 | 25 |  |
| 0x0219 | P281 | 15 | 15 |  |
| 0x021A | P282 | 70 | 70 |  |
| 0x021B | P283 | 0 | 0 |  |
| 0x021C | P284 | 25 | 25 |  |
| 0x021D | P285 | 30 | 30 |  |
| 0x021E | P286 | 35 | 35 |  |
| 0x021F | P287 | 40 | 40 |  |
| 0x0220 | P288 | 45 | 45 |  |
| 0x0221 | P289 | 3 | 3 |  |
| 0x0222 | P290 | 1 | 1 |  |
| 0x0223 | P291 | 1 | 1 |  |
| 0x0224 | P292 | 1 | 1 |  |
| 0x0225 | P293 | 1 | 1 |  |
| 0x0226 | P294 | 0 | 0 |  |
| 0x0227 | P295 | 55 | 55 |  |
| 0x0228 | P296 | 45 | 45 |  |
| 0x0229 | P297 | 20 | 20 |  |
| 0x022A | P298 | 10 | 10 |  |
| 0x022B | P299 | 8 | 8 |  |
| 0x022C | P300 | 6 | 6 |  |
| 0x022D | P301 | 0 | 0 |  |
| 0x022E | P302 | 0 | 0 |  |
| 0x022F | P303 | 0 | 0 |  |
| 0x0230 | P304 | 0 | 0 |  |
| 0x0231 | P305 | 0 | 0 |  |
| 0x0232 | P306 | 0 | 0 |  |
| 0x0233 | P307 | 0 | 0 |  |
| 0x0234 | P308 | 0 | 0 |  |
| 0x0235 | P309 | 0 | 0 |  |
| 0x081A | L37 | 65531 | 65531 | 0xFFFB — uninitialised? |
| 0x081B | L38 | 50 | 50 |  |
| 0x081C | L39 | 22 | 22 |  |
| 0x081D | L40 | 22 | 22 |  |
| 0x081E | L41 | 1 | 1 |  |
| 0x081F | L42 | 55 | 55 |  |
| 0x0820 | L43 | 52 | 52 |  |
| 0x0821 | L44 | 49 | 49 |  |
| 0x0822 | L45 | 46 | 46 |  |
| 0x0823 | L46 | 43 | 43 |  |
| 0x0824 | L47 | 40 | 40 |  |
| 0x0825 | L48 | 37 | 37 |  |
| 0x0826 | L49 | 34 | 34 |  |
| 0x0827 | L50 | 31 | 31 |  |
| 0x0828 | L51 | 28 | 28 |  |
| 0x0829 | L52 | 5 | 5 |  |
| 0x082A | L53 | 1 | 1 |  |
| 0x082B | L54 | 420 | 420 |  |
| 0x082C | L55 | 65531 | 65531 | 0xFFFB — uninitialised? |
| 0x082D | L56 | 65531 | 65531 | 0xFFFB — uninitialised? |
| 0x082E | L57 | 30 | 30 |  |
| 0x082F | L58 | 1 | 1 |  |
| 0x0830 | L59 | 65531 | 65531 | 0xFFFB — uninitialised? |
| 0x0831 | L60 | 50 | 50 |  |

---

## 7. Write-access & coils

| Block | Range | Access | FC |
|---|---|---|---|
| Status / faults | 0x0000–0x0028 | read-only | FC03 |
| Sensors | 0x0040–0x00FF | read-only | FC03 |
| User control | 0x0300–0x0319 | read/write | FC03 / FC06 |
| P-parameters | 0x0100–0x0234 | read/write | FC03 / FC06 |
| L-parameters | 0x0800–0x0831 | read/write | FC03 / FC06 |
| Command coils | 0x1000–0x1023 | write / FC01 read | **FC05** |
| User commands | 0x0330–0x0345 | read/write | FC03 / FC06 |
| Version info | 0x0360–0x0363 | read-only | FC03 |

> **Write safety.** Clamp every write to the register's min/max first; out-of-range writes to
> protection/valve parameters can damage hardware. `⚙ service-only` registers bypass safety logic.

**Command coils (FC05)** and their `0x0330` bitmask equivalent (FC06):

| Coil | Addr | 0x0330 bit | Service-only |
|---|---|---:|---|
| Powerful Mode | 0x1000 | — | |
| Silent Mode | 0x1001 | — | |
| Quick Heat Mode | 0x1012 | bit2 | |
| Force Defrost | 0x1013 | bit3 | |
| System Drain Mode | 0x1014 | bit4 | |
| Refrigerant Recovery | 0x1015 | bit5 | |
| Force Sterilization | 0x1018 | bit8 | |
| Allow Water Return | 0x101A | bit10 | |
| Restore Factory Settings | 0x101D | bit13 | |
| Compressor Forced Control | 0x1020 | — | ⚙ |
| EEV Forced Control | 0x1021 | — | ⚙ |
| EVI Forced Control | 0x1022 | — | ⚙ |
| Fan Forced Control | 0x1023 | — | ⚙ |

`0x0331` Load Forcing (service-only) bitmask: bit0 Compressor, bit1 EEV, bit2 EVI, bit3 Fan — paired
with forced-value registers 0x0332/0x0333 (freq), 0x0336/0x0337 (EEV), 0x033A/0x033B (EVI), 0x033E (fan).

---

## 8. Bitmask registers (full bit-level definitions)

Every bit comes straight from the model's `*_BITS` exports. **Snapshot decode** shows which bits were
set in the live read; bits set without a documented meaning are flagged *undefined bits set*.

System 2–4 fault registers `0x000A–0x0018` mirror System 1 (`0x0005–0x0009`) with a **+5 address
offset per system** and identical bit layouts.

### 0x0000 — Running Status 1

| Bit | Mask | Meaning |
|---:|---:|---|
| 0 | 0x0001 | Refrigerant recovery |
| 1 | 0x0002 | Primary antifreeze |
| 2 | 0x0004 | Secondary antifreeze |
| 3 | 0x0008 | Fault alarm |
| 4 | 0x0010 | System oil return |
| 8 | 0x0100 | System defrost |
| 12 | 0x1000 | Const temp shutdown |
| 13 | 0x2000 | Fault shutdown |
| 14 | 0x4000 | Machine run |
| 15 | 0x8000 | Machine wait |

**Snapshot decode** (0 = 0x0000): all clear (0x0000)

### 0x0001 — Running Status 2

| Bit | Mask | Meaning |
|---:|---:|---|
| 0 | 0x0001 | High temp sterilization |
| 1 | 0x0002 | High temp steril preserve |
| 10 | 0x0400 | Controller on off |

**Snapshot decode** (0 = 0x0000): all clear (0x0000)

### 0x0002 — Fault State 1

| Bit | Mask | Meaning |
|---:|---:|---|
| 0 | 0x0001 | Wrong phase |
| 1 | 0x0002 | Lack of phase |
| 2 | 0x0004 | Water flow |
| 3 | 0x0008 | Communication |
| 4 | 0x0010 | Emergency |
| 5 | 0x0020 | Use time expired |
| 6 | 0x0040 | Water tank temp |
| 7 | 0x0080 | Water inlet temp |
| 8 | 0x0100 | Indoor temp |
| 9 | 0x0200 | Environmental temp |
| 10 | 0x0400 | User backwater temp |
| 11 | 0x0800 | Cooling outlet low |
| 12 | 0x1000 | Water level switch |
| 13 | 0x2000 | Water outlet temp |
| 14 | 0x4000 | Heating outlet high |
| 15 | 0x8000 | Excessive temp diff |

**Snapshot decode** (0 = 0x0000): all clear (0x0000)

### 0x0003 — Fault State 2

| Bit | Mask | Meaning |
|---:|---:|---|
| 0 | 0x0001 | Env low temp protect |
| 6 | 0x0040 | Indoor humidity |
| 11 | 0x0800 | Phase order dial |
| 13 | 0x2000 | Water pump 1 feedback |
| 14 | 0x4000 | Water pump 2 feedback |
| 15 | 0x8000 | Low water flow |

**Snapshot decode** (0 = 0x0000): all clear (0x0000)

### 0x0004 — Fault State 3

| Bit | Mask | Meaning |
|---:|---:|---|
| 0 | 0x0001 | Phase seq disconnect |
| 1 | 0x0002 | Expansion board comm |
| 2 | 0x0004 | Plate HX temp |
| 3 | 0x0008 | Fan motor 1 comm |
| 4 | 0x0010 | Fan motor 2 comm |
| 5 | 0x0020 | Online model mismatch |
| 6 | 0x0040 | Solar HW sensor |
| 7 | 0x0080 | AHS temp sensor |
| 8 | 0x0100 | Buffer tank |
| 9 | 0x0200 | Main outlet temp |
| 12 | 0x1000 | Zone 1 temp sensor |

**Snapshot decode** (0 = 0x0000): all clear (0x0000)

### 0x0005 — System 1 Fault 1

| Bit | Mask | Meaning |
|---:|---:|---|
| 0 | 0x0001 | High pressure switch |
| 1 | 0x0002 | Low pressure switch |
| 2 | 0x0004 | High pressure over |
| 3 | 0x0008 | Low pressure over |
| 4 | 0x0010 | Exhaust over |
| 5 | 0x0020 | Current protection |
| 6 | 0x0040 | Coil pressure high |
| 7 | 0x0080 | Coil temp fault |
| 8 | 0x0100 | Return air temp fault |
| 9 | 0x0200 | Exhaust temp fault |
| 10 | 0x0400 | Economizer inlet fault |
| 11 | 0x0800 | Economizer outlet fault |
| 12 | 0x1000 | Fan drive comm |
| 13 | 0x2000 | DC fan fault |
| 14 | 0x4000 | Refrig coil temp fault |

**Snapshot decode** (0 = 0x0000): all clear (0x0000)

### 0x0006 — System 1 Fault 2

| Bit | Mask | Meaning |
|---:|---:|---|
| 0 | 0x0001 | High pressure sensor |
| 1 | 0x0002 | Low pressure sensor |
| 2 | 0x0004 | Middle pressure switch |
| 3 | 0x0008 | Coil temp over high |
| 4 | 0x0010 | Comp drive board comm |

**Snapshot decode** (0 = 0x0000): all clear (0x0000)

### 0x0007 — System 1 Drive Fault 1

| Bit | Mask | Meaning |
|---:|---:|---|
| 0 | 0x0001 | IPM overcurrent |
| 1 | 0x0002 | Compressor drive |
| 2 | 0x0004 | Compressor overcurrent |
| 3 | 0x0008 | Input voltage loss |
| 4 | 0x0010 | IPM current sampling |
| 5 | 0x0020 | Power comp overheat |
| 6 | 0x0040 | Precharge failed |
| 7 | 0x0080 | DC bus overvoltage |
| 8 | 0x0100 | DC bus undervoltage |
| 9 | 0x0200 | AC input undervoltage |
| 10 | 0x0400 | AC input overvoltage |
| 11 | 0x0800 | Input volt sampling |
| 12 | 0x1000 | DSP PFC comm |
| 13 | 0x2000 | Radiator temp sensor |
| 14 | 0x4000 | DSP comm board |
| 15 | 0x8000 | Main control board |

**Snapshot decode** (0 = 0x0000): all clear (0x0000)

### 0x0008 — System 1 Drive Fault 2

| Bit | Mask | Meaning |
|---:|---:|---|
| 0 | 0x0001 | Compressor overcurrent alarm |
| 1 | 0x0002 | Weak magnetic protection |
| 2 | 0x0004 | PIM overheat |
| 3 | 0x0008 | PFC overheat |
| 4 | 0x0010 | AC input overcurrent |
| 5 | 0x0020 | EEPROM error |
| 7 | 0x0080 | EEPROM refresh complete |
| 8 | 0x0100 | Temp sensing limit |
| 9 | 0x0200 | AC undervolt freq limit |

**Snapshot decode** (0 = 0x0000): all clear (0x0000)

### 0x0009 — System 1 Drive Fault 3

| Bit | Mask | Meaning |
|---:|---:|---|
| 0 | 0x0001 | IPM overheat shutdown |
| 1 | 0x0002 | Compressor missing phase |
| 2 | 0x0004 | Compressor overload |
| 3 | 0x0008 | Input current sampling |
| 4 | 0x0010 | PIM supply voltage |
| 5 | 0x0020 | Precharge voltage |
| 6 | 0x0040 | EEPROM failure |
| 7 | 0x0080 | AC input overvoltage |
| 8 | 0x0100 | Microelectronics |
| 9 | 0x0200 | Compressor type code |
| 10 | 0x0400 | Current sampling overcurrent |

**Snapshot decode** (0 = 0x0000): all clear (0x0000)

### 0x0019 — Relay Output 1

| Bit | Mask | Meaning |
|---:|---:|---|
| 0 | 0x0001 | Hot water eheating |
| 1 | 0x0002 | Fan high wind |
| 3 | 0x0008 | Fan low wind |
| 4 | 0x0010 | AC eheating |
| 5 | 0x0020 | Floor eheating |
| 6 | 0x0040 | Main circulating pump |
| 9 | 0x0200 | Elec crankshaft heating |
| 10 | 0x0400 | Chassis eheating |
| 11 | 0x0800 | Return valve pump |
| 14 | 0x4000 | AC solenoid 3-way |
| 15 | 0x8000 | Floor solenoid 3-way |

**Snapshot decode** (16448 = 0x4040): bit6 Main circulating pump, bit14 AC solenoid 3-way

### 0x001A — Relay Output 2

| Bit | Mask | Meaning |
|---:|---:|---|
| 0 | 0x0001 | Compressor 1 |
| 1 | 0x0002 | Liquid injection 1 |
| 2 | 0x0004 | EVI EEV 1 |
| 3 | 0x0008 | Four way valve 1 |
| 4 | 0x0010 | Bypass valve 1 |
| 5 | 0x0020 | Fan motor 1 |
| 8 | 0x0100 | Aux heating pump |
| 10 | 0x0400 | Compressor 2 |
| 11 | 0x0800 | Liquid injection 2 |
| 12 | 0x1000 | EVI EEV 2 |
| 13 | 0x2000 | Four way valve 2 |

**Snapshot decode** (0 = 0x0000): all clear (0x0000)

### 0x001B — Relay Output 3

| Bit | Mask | Meaning |
|---:|---:|---|
| 6 | 0x0040 | Expansion tank eheating |
| 7 | 0x0080 | HW heat source pump |
| 8 | 0x0100 | Heating heat source pump |
| 9 | 0x0200 | AHS signal output |

**Snapshot decode** (0 = 0x0000): all clear (0x0000)

### 0x001C — Relay Output 4

| Bit | Mask | Meaning |
|---:|---:|---|
| 0 | 0x0001 | Pipe eheating 1 |
| 1 | 0x0002 | Pipe eheating 2 |
| 2 | 0x0004 | Aux water pump |
| 3 | 0x0008 | Zone 2 water pump |
| 4 | 0x0010 | Zone 1 water pump |

**Snapshot decode** (0 = 0x0000): all clear (0x0000)

### 0x001D — Switch Port 1

| Bit | Mask | Meaning |
|---:|---:|---|
| 0 | 0x0001 | SW1 |
| 1 | 0x0002 | SW2 |
| 2 | 0x0004 | SW3 |
| 3 | 0x0008 | SW4 |
| 4 | 0x0010 | SW5 |
| 5 | 0x0020 | SW6 |
| 6 | 0x0040 | SW7 |
| 7 | 0x0080 | SW8 |
| 8 | 0x0100 | Water flow switch |
| 10 | 0x0400 | House heating linkage |
| 11 | 0x0800 | Aux HW linkage |
| 12 | 0x1000 | Linkage switch |
| 13 | 0x2000 | Emergency switch |

**Snapshot decode** (7679 = 0x1DFF): bit0 SW1, bit1 SW2, bit2 SW3, bit3 SW4, bit4 SW5, bit5 SW6, bit6 SW7, bit7 SW8, bit8 Water flow switch, bit10 House heating linkage, bit11 Aux HW linkage, bit12 Linkage switch

### 0x001E — Switch Port 2

| Bit | Mask | Meaning |
|---:|---:|---|
| 7 | 0x0080 | High pressure switch 1 |
| 8 | 0x0100 | Low pressure switch 1 |
| 9 | 0x0200 | Middle pressure switch 1 |
| 10 | 0x0400 | High pressure switch 2 |
| 11 | 0x0800 | Low pressure switch 2 |
| 12 | 0x1000 | Middle pressure switch 2 |

**Snapshot decode** (7708 = 0x1E1C): bit9 Middle pressure switch 1, bit10 High pressure switch 2, bit11 Low pressure switch 2, bit12 Middle pressure switch 2 — undefined bits set: bit2, bit3, bit4

### 0x001F — Switch Port 3

| Bit | Mask | Meaning |
|---:|---:|---|
| 5 | 0x0020 | Buffer tank AHS linkage |

**Snapshot decode** (96 = 0x0060): bit5 Buffer tank AHS linkage — undefined bits set: bit6

### 0x0330 — Unit Control (write, FC06)

| Bit | Mask | Meaning |
|---:|---:|---|
| 2 | 0x0004 | Quick heat |
| 3 | 0x0008 | Force defrost |
| 4 | 0x0010 | System drain |
| 5 | 0x0020 | Refrigerant recovery |
| 8 | 0x0100 | Force sterilization |
| 10 | 0x0400 | Allow water return |
| 13 | 0x2000 | Restore factory |

**Snapshot decode** (1536 = 0x0600): bit10 Allow water return — undefined bits set: bit9

### 0x0331 — Load Forcing Control (write, service-only)

| Bit | Mask | Meaning |
|---:|---:|---|
| 0 | 0x0001 | Compressor |
| 1 | 0x0002 | EEV |
| 2 | 0x0004 | EVI |
| 3 | 0x0008 | Fan |

**Snapshot decode** (0 = 0x0000): all clear (0x0000)

---

## 9. Enum reference (complete)

**0x0304 Set Mode** — `0` = Cooling · `1` = Heating · `2` = Hot Water · `3` = Floor Heating · `4` = Hot Water + Cooling · `5` = Hot Water + Heating · `6` = Reserve · `7` = Hot Water + Floor Heating

**0x0307 Running Mode** — `0` = Standard · `1` = High Power (Boost) · `2` = Silent

**0x0313–0x0316 Curve Settings** — `0` = Off · `1` = High Temp Curve 1 · `2` = High Temp Curve 2 · `3` = High Temp Curve 3 · `4` = High Temp Curve 4 · `5` = High Temp Curve 5 · `6` = High Temp Curve 6 · `7` = High Temp Curve 7 · `8` = High Temp Curve 8 · `11` = Low Temp Curve 1 · `12` = Low Temp Curve 2 · `13` = Low Temp Curve 3 · `14` = Low Temp Curve 4 · `15` = Low Temp Curve 5 · `16` = Low Temp Curve 6 · `17` = Low Temp Curve 7 · `18` = Low Temp Curve 8

**P119 Refrigerant Type** — `1` = R410A · `2` = R32 · `3` = R290

**P30 Defrost Mode** — `0` = Smart · `1` = Timing · `2` = Fast · `3` = Dew Point

**P37 Shutdown Mode** — `0` = Smart · `1` = Direct (Darwin) · `2` = Refrig Smart

**P28 Pump Mode at Shutdown** — `0` = Keep Running · `1` = Stop · `2` = Cooling Only · `3` = AC/Heating Only · `4` = Floor Only

**P06 Fan Type** — `0` = AC · `1` = DC · `2` = EC

**P101 Pump Control Mode** — `0` = AC (on/off) · `1` = DC (PWM)

**P150 Secondary Heating Pump** — `0` = Power On Run · `1` = Power On · `2` = Linkage Demand Switch · `3` = Temperature Control

**P161 Aux Pump Selection** — `0` = DHW · `1` = AC · `2` = Floor · `3` = AC + Floor · `4` = All

**P164 Energy Level Control** — `0` = All Enable · `1` = E-heating Disable · `2` = Compressor Disable · `3` = All Disable

**P139/P140 Electric Heating** — `0` = Enable · `1` = Disable · `2` = AHS

**P181 Defrost Selection (Evap Side)** — `0` = Current Mode · `1` = Heating · `2` = DHW

**P182 Pipe Electric Heating** — `0` = 3kW + 6kW · `1` = 3kW · `2` = 6kW · `3` = Disabled

**P254 Heating Medium** — `0` = Water · `1` = Antifreeze Liquid

**P05 Linkage Switch** — `0` = Enable · `1` = Disable · `2` = Thermostatic · `3` = Heating Thermostat

**L12 Sterilization Mode** — `0` = Auto · `1` = Off · `2` = Manual

**L17 Water Level Control** — `0` = Off · `1` = Hi/Lo Switch · `2` = Hi/Hi/Lo Switch

**L22 DHW Return Water** — `0` = Disable · `1` = Continuous Return · `2` = Cycle Return · `3` = Temperature Diff Return

**L21 Low Water Cut-off** — `0` = No Start · `1` = On But No Start · `2` = Start

**0x0361 Product Type** — `0` = Commercial Inverter · `1` = Domestic ON/OFF · `2` = Commercial ON/OFF

---

## 10. Native heating curve (L27–L29) & energy accounting (L30–L36)

Built-in weather compensation (no external algorithm needed): `Set temp = k × (ambient + 15) + b`,
with L27 `0x0810` enable, L28 `0x0811` coefficient k (−50..0), L29 `0x0812` constant b (30..80 °C).
Snapshot: enabled, k = −5, b = 55.

Energy accounting: enable L30 `0x0813`; L31 `0x0814` external pump flow (L/min, fixed if no meter);
L32–L35 `0x0815–0x0818` e-heater powers (W); L36 `0x0819` external pump power (W).

---

*Generated directly from `lib/modbus/adlar-modbus-registers.ts` (v2.2, authoritative) merged with the
expert snapshot of 2026-06-15. Regenerate when the register model changes.*
