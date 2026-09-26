# HA-modbus-Adlar-aurora-Pro-III
Package for connecting home assistant and Adlar Aurora Pro III Heatpump through Modbus

## Configuration

Add the following lines to you configuration.yaml

homeassistant:
  packages: !include_dir_named packages

Create a folder named 'packages' in your home assistant config folder and copy the adlar_heatpump.yaml into this folder.

https://www.home-assistant.io/docs/configuration/packages/
Read more about packages here:  


### Waveshare installation:

Connect, using a twisted pair cable, the JAN-module with Waveshare in parallel.

```
JAN   <--> Waveshare
 A    <-->   A
 B    <-->   B
GND   <-->  GND
```

### Waveshare Setttings: 

Mode: Modbus TCP ==> Modbus RTU 

- Baudrate: 9600
- Databits: 8
- Parity: none
- Stop: 2
- Baudrate adaptive (RFC2117): Disable

### Adlar configurration

To control you heatpump using Home Assistant it's import to turn off the weather compensation through the installer level in the adlar contolpanel. 

--TO DO -- look up correct parameter to turn of weather compensation





