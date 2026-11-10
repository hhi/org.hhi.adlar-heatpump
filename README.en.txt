Control and monitor your Adlar Castra Aurora heat pump locally with Homey Pro.
This app includes three drivers for connecting via Tuya or Modbus.
Daily communication takes place over your local network.

CHOOSE YOUR DRIVER

Aurora I/II via Tuya
For an Aurora I/II with a Tuya Wi-Fi connection. Requires the heat pump's Device ID, Local Key, local IP address and Tuya protocol version.
Local dashboard: http://HOMEY-IP:8092

Aurora I/II via Modbus
For an Aurora I/II with an RS485/Modbus connection. Requires a Modbus TCP gateway. During pairing, enter the gateway's IP address, TCP port and Modbus Unit ID.
Local dashboard: http://HOMEY-IP:8090

Aurora III via Modbus
For an Aurora III with an RS485/Modbus connection. Requires a Modbus TCP gateway and uses the dedicated Aurora III register map. During pairing, enter the gateway's IP address, TCP port and Modbus Unit ID.
Local dashboard: http://HOMEY-IP:8091

Replace HOMEY-IP with your Homey Pro's local IP address. The ports shown are the defaults. Use your configured port if you have changed it.

MONITORING AND CONTROL

View temperatures, operating status, faults and available power, energy consumption and water-flow measurements. Control on/off, operating mode, setpoints and supported heating-curve selections.

Use Homey Flows for control, notifications and external measurements. Monitor COP and seasonal efficiency or use optional adaptive control, building-model learning, energy-price optimisation and COP optimisation.

Available measurements, settings and Flow cards vary by model and driver. COP calculations depend on usable power, temperature and water-flow data.

LOCAL DASHBOARDS

All three drivers provide dashboard pages for monitoring, control and diagnostics.

Dashboard and Live show available values and operating status. Controls lets you adjust supported settings. Expert provides a searchable overview of datapoints or registers. Changes shows values and recorded changes. Heating curve provides insight into the available curve settings and control.

Tuya displays DPS datapoints. The Modbus drivers display the registers for the corresponding heat-pump model. Available dashboard features vary by driver.

INSTALLATION

When adding a device, select the driver that matches your heat-pump model and connection.

Tuya requires the local device details. For Modbus, the gateway must first be connected and configured correctly. Consult the installation guide for your model.

A fixed local IP address or DHCP reservation for the heat pump or gateway helps prevent connection problems.

Advanced write controls can change heat-pump settings. Check what a setting does and record its original value before changing it.

DOCUMENTATION

The source-code page provides guides for Tuya pairing, Modbus connections, gateway configuration, dashboards, Homey Flows, fault diagnostics, COP, heating curves and adaptive control.
