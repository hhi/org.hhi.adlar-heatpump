# 3. Unit System Parameters P (0x0100 – 0x02FF)

> Access: Read-Write (RW)

| Address | Parameter Name | Range | Access | Note / Unit |
|---------|---------------|-------|--------|-------------|
| 0x0100 | T1 external ambient temperature sensor | 0~10 | RW | 0: Enable, 1: Disable |
| 0x0101 | High pressure switch settings | 0~10 | RW | 0: Enable, 1: Disable |
| 0x0102 | Low pressure switch settings | 0~10 | RW | 0: Enable, 1: Disable |
| 0x0103 | Water flow switch settings | 0~10 | RW | 0: Enable, 1: Disable |
| 0x0104 | Thermal overload protection switch settings | 0~10 | RW | 0: Enable, 1: Disable |
| 0x0105 | Linkage switch settings | 0~10 | RW | 0: Enable, 1: Disable  2: Constant Temperature  3: Heating Constant Temperature |
| 0x0106 | Fan motor type setting | 0~10 | RW | 0: Enable, 1: Disable |
| 0x0107 | High Pressure Protection Lockout Setting | 0~10 | RW | 0: Enable, 1: Disable |
| 0x0108 | Low Pressure Protection Lockout Setting | 0~10 | RW | 0: Enable, 1: Disable |
| 0x0109 | Exhaust Protection Lockout Setting | 0~10 | RW | 0: Enable, 1: Disable |
| 0x010A | Water flow switch protection lock setting | 0~10 | RW | 0: Enable, 1: Disable |
| 0x010B | High Pressure protection value | 40~150 | RW | °C |
| 0x010C | High Pressure frequency limit value | 40~150 | RW | °C |
| 0x010D | Low Pressure protection value | -50~-10 | RW | °C |
| 0x010E | Low Pressure frequency limit value | -50~-10 | RW | °C |
| 0x010F | Exhaust temperature protection value | 100~130 | RW | °C |
| 0x0110 | Exhaust temperature limit frequency | 90~120 | RW | °C |
| 0x0111 | Refrigeration fan speed increase value | 0~60 | RW | °C |
| 0x0112 | Cooling fan deceleration value | 0~60 | RW | °C |
| 0x0113 | Heating fan deceleration value | 0~60 | RW | °C |
| 0x0114 | Heating fan speed increase value | 0~60 | RW | °C |
| 0x0115 | The unit prohibits starting low temperature value | -40~-10 | RW | °C |
| 0x0116 | Electric heating start ambient temperature value | -15~40 | RW | °C |
| 0x0117 | Temperature difference between inlet and outlet water exceeds threshold | 10~30 | RW | °C |
| 0x0118 | Return water temperature compensation value | -10~10 | RW | °C |
| 0x0119 | Outlet water temperature compensation value | -10~10 | RW | °C |
| 0x011A | Air conditioner return difference | 0~10 | RW | °C |
| 0x011B | Floor heating difference | 0~10 | RW | °C |
| 0x011C | Pump control mode when device reaches target temp and shuts down | 0~10 | RW | 0: Run  1: Stop  2: Cooling Run  3: Air Conditioning Run  4: Floor Heating Run |
| 0x011D | Antifreeze water pump running time (every 10 min) | 0~10 | RW | min |
| 0x011E | Defrost mode selection | 0~10 | RW | 0: Intelligent  1: Timer  2: Fast  3: Dew Point |
| 0x011F | Enter defrost accumulated running time threshold | 0~120 | RW | °C |
| 0x0120 | Enter defrost coil temperature value | -30~0 | RW | °C |
| 0x0121 | Enter defrost temperature difference 1 | 0~20 | RW | °C |
| 0x0122 | Enter defrost temperature difference 2 | 0~20 | RW | °C |
| 0x0123 | Max defrost time | 0~30 | RW | min |
| 0x0124 | Exit defrost coil temperature | 0~30 | RW | °C |
| 0x0125 | Device reaching target temperature and shutdown mode | 0~10 | RW | 0: Intelligent shutdown  1: Reaching temperature shutdown  2: Intelligent Cooling |
| 0x0126 | Heating main valve initial opening constant | -999~999 | RW |  |
| 0x0127 | Pressure sensor settings | 0~10 | RW | 0: Enable, 1: Disable |
| 0x0128 | Cooling target superheat correction value | -5~10 | RW | °C |
| 0x0129 | Heating high pressure protection and frequency limit correction value | -10~10 | RW | °C |
| 0x012A | Heating target superheat correction value | -5~10 | RW | °C |
| 0x012B | Medium Pressure Switch Settings | 0~10 | RW | 0: Disable, 1: Enable |
| 0x012C | Water flow switch failure detection settings | 0~10 | RW | 0: Enable, 1: Disable |
| 0x012D | Communication address code | 1~16 | RW |  |
| 0x012E | Return difference of opening of liquid injection solenoid valve | 0~15 | RW | °C |
| 0x012F | EVI target superheat constant | 0~12 | RW |  |
| 0x0130 | Whether the tank temperature probe is enabled | 0~10 | RW | 0: Disable, 1: Enable |
| 0x0131 | Hot water frequency operating percentage | 30~100 | RW | % |
| 0x0132 | Cooling target frequency constant A, Y=9X/5+A | -100~100 | RW |  |
| 0x0133 | Cooling minimum frequency limit | 15~60 | RW | Hz |
| 0x0134 | Cooling target frequency upper limit | 40~120 | RW | Hz |
| 0x0135 | Cooling target frequency lower limit | 15~120 | RW | Hz |
| 0x0136 | Heating target frequency constant B, Y=B-X | -100~100 | RW |  |
| 0x0137 | Heating target frequency upper limit | 50~120 | RW | Hz |
| 0x0138 | Heating target frequency lower limit | 20~120 | RW | Hz |
| 0x0139 | Heating minimum frequency 1 | 15~60 | RW | Hz |
| 0x013A | Heating minimum frequency 2 | 15~60 | RW | Hz |
| 0x013B | Heating minimum frequency 3 | 15~60 | RW | Hz |
| 0x013C | Hot water target frequency constant B, Y=B-X | -100~100 | RW |  |
| 0x013D | Hot water target frequency upper limit, Y=B-X | 50~120 | RW | Hz |
| 0x013E | Hot water target frequency lower limit, Y=B-X | 15~120 | RW | Hz |
| 0x013F | Hot water minimum frequency 1 | 15~60 | RW | Hz |
| 0x0140 | Hot water minimum frequency 2 | 15~60 | RW | Hz |
| 0x0141 | Hot water minimum frequency 3 | 15~60 | RW | Hz |
| 0x0142 | DC fan initial frequency | 20~60 | RW | Hz |
| 0x0143 | DC fan heating minimum frequency | 20~60 | RW | Hz |
| 0x0144 | DC fan heating maximum frequency | 20~80 | RW | Hz |
| 0x0145 | DC fan cooling minimum frequency | 20~60 | RW | Hz |
| 0x0146 | DC fan cooling maximum frequency | 20~80 | RW | Hz |
| 0x0147 | Turn on enthalpy control frequency | 20~80 | RW | Hz |
| 0x0148 | Stop enthalpy increase frequency | 20~80 | RW | Hz |
| 0x0149 | Refrigeration main valve initial opening 1 | 20~480 | RW | P |
| 0x014A | Refrigeration main valve initial opening 2 | 20~480 | RW | P |
| 0x014B | Refrigeration main valve initial opening 3 | 20~480 | RW | P |
| 0x014C | Minimum opening of refrigeration main valve | 0~300 | RW | P |
| 0x014D | Minimum opening of heating main valve | 0~300 | RW | P |
| 0x014E | Main valve maximum opening | 100~500 | RW | P |
| 0x014F | Main valve initial opening constant c | 20~300 | RW | P |
| 0x0150 | Main valve initial opening coefficient a | -999~999 | RW |  |
| 0x0151 | Main valve initial opening coefficient b | -999~999 | RW |  |
| 0x0152 | Auxiliary valve maximum opening | 100~500 | RW | P |
| 0x0153 | Auxiliary valve minimum opening | 50~300 | RW | P |
| 0x0154 | Main Valve Regulation Period | 10~120 | RW | S |
| 0x0155 | Auxiliary valve initial opening constant c | -200~900 | RW |  |
| 0x0156 | Auxiliary valve initial opening coefficient a | -999~999 | RW |  |
| 0x0157 | Auxiliary valve initial opening coefficient b | -999~999 | RW |  |
| 0x0158 | Silent mode compressor frequency | 20~70 | RW | Hz |
| 0x0159 | Quiet mode fan frequency | 20~60 | RW | Hz |
| 0x015A | Ambient temperature to enter EVI | 0~45 | RW | °C |
| 0x015B | Time to forbid entering into EVI | 0~30 | RW | min |
| 0x015C | Temperature Difference to enter EVI | 0~60 | RW | °C |
| 0x015D | Compressor continuous running time to enter EVI | 0~20 | RW | min |
| 0x015E | Auxiliary valve adjustment cycle | 10~120 | RW | S |
| 0x015F | Cascade water pump running mode | 0~10 | RW | 0: Shared  1: Independent |
| 0x0160 | Hot water return difference | 0~10 | RW | °C |
| 0x0161 | Water tank temperature automatic compensation | 0~10 | RW | 0: Enable, 1: Disable |
| 0x0162 | Manual compensation value of water tank temperature | -10~10 | RW | °C |
| 0x0163 | Pump speed control temperature difference | 2~10 | RW | °C |
| 0x0164 | PWM water pump minimum speed | 20~80 | RW | % |
| 0x0165 | Pump control mode | 0~10 | RW | 0: AC  1: DC |
| 0x0166 | Four-way valve control mode | 0~10 | RW | 0: Cooling Power On  1: Heating Power On |
| 0x0167 | Mode switching minimum runtime | 0~10 | RW | min |
| 0x0168 | Operating frequency percentage when switching modes | 20~100 | RW | % |
| 0x0169 | Cooling mode operating ambient temperature limit | 10~60 | RW | °C |
| 0x016A | Heating mode operating ambient temperature limit | 10~60 | RW | °C |
| 0x016B | Hot water mode operating ambient temperature limit | 10~60 | RW | °C |
| 0x016C | Hot water setting temperature upper limit | 30~80 | RW | °C |
| 0x016D | Hot water setting temperature lower limit | 10~30 | RW | °C |
| 0x016E | Heating set temperature upper limit | 30~80 | RW | °C |
| 0x016F | Heating set temperature lower limit | 15~30 | RW | °C |
| 0x0170 | Cooling set temperature upper limit | 20~40 | RW | °C |
| 0x0171 | Cooling set temperature lower limit | 5~20 | RW | °C |
| 0x0172 | Selection of the number of compressors | 1~2 | RW |  |
| 0x0173 | Model selection | 0~10 | RW | 0: Heating & Cooling  1: Heating & Cooling & DHW  Others: reserved |
| 0x0174 | Unit temperature control method | 0~10 | RW | 0: Return water  1: Water Outlet |
| 0x0175 | Ambient temperature to enter Antifreeze Mode | 0~10 | RW | °C |
| 0x0176 | Antifreeze Inlet and Outlet Water Temperature | 0~20 | RW | °C |
| 0x0177 | Refrigerant type | 0~20 | RW | 1: R410A  2: R32  3: R290 |
| 0x0178 | Low temperature start limit | 0~10 | RW | 0: Enable, 1: Disable |
| 0x0179 | Heating frequency shield 1 stage low value | 0~120 | RW | Hz |
| 0x017A | Heating frequency shield 1 stage high value | 0~120 | RW | Hz |
| 0x017B | Heating frequency shield 2-stage low value | 0~120 | RW | Hz |
| 0x017C | Heating frequency shield 2-stage high value | 0~120 | RW | Hz |
| 0x017D | Heating frequency shield 3-stage low value | 0~120 | RW | Hz |
| 0x017E | Heating frequency shield 3-stage high value | 0~120 | RW | Hz |
| 0x017F | Cooling frequency shield 1 stage low value | 0~120 | RW | Hz |
| 0x0180 | Cooling frequency shield 1 stage high value | 0~120 | RW | Hz |
| 0x0181 | Cooling frequency shield 2-stage low value | 0~120 | RW | Hz |
| 0x0182 | Cooling frequency shield 2-stage high value | 0~120 | RW | Hz |
| 0x0183 | Cooling frequency shield 3-stage low value | 0~120 | RW | Hz |
| 0x0184 | Cooling frequency shield 3-stage high value | 0~120 | RW | Hz |
| 0x0185 | Fan module | 0~10 | RW | 0: Integral Module  1: Individual Module |
| 0x0186 | Water flow too low protection value | 0~100 | RW | L/min |
| 0x0187 | Temperature difference to start Anti-condensation | 0~50 | RW | °C |
| 0x0188 | Ambient temperature to open Throttle bypass valve | -20~50 | RW | °C |
| 0x0189 | Throttle Bypass Valve Delay Compressor | 0~999 | RW | S |
| 0x018A | Defrost compressor frequency | 40~120 | RW | Hz |
| 0x018B | Air conditioning electric heating options | 0~10 | RW | 0: Enable  1: Disable  2: Gas |
| 0x018C | Hot water electric heating options | 0~10 | RW | 0: Enable  1: Disable  2: Gas |
| 0x018D | Dew point duration of defrost | 0~60 | RW | min |
| 0x018E | Dew point constant of defrost | 0~60 | RW |  |
| 0x018F | Water Temperature to enter Defrost mode | 0~60 | RW | °C |
| 0x0190 | Ambient temperature to enter Defrost mode | -20~30 | RW | °C |
| 0x0191 | Water outlet antifreeze protection value | -20~10 | RW | °C |
| 0x0192 | Pump range setting value | 0~100 | RW | L/min |
| 0x0193 | Cooling Anti-Freeze Mode | 0~10 | RW | 0: Low pressure  1: Temp  2: Low pressure + temp |
| 0x0194 | Cooling Anti-Freeze Temperature Value | -30~10 | RW | °C |
| 0x0195 | Water out of the high limit frequency value | 40~80 | RW | °C |
| 0x0196 | Secondary heating pump selection | 0~10 | RW | 0: Power on  1: Turn on  2: When linkage switch is open  3: Temp control |
| 0x0197 | Hot water heat source return difference | 0~40 | RW | °C |
| 0x0198 | Heating heat source return difference | 0~40 | RW | °C |
| 0x0199 | Combined hot water heat source upper temperature limit | 15~80 | RW | °C |
| 0x019A | Combined heating heat source upper temperature limit | 15~80 | RW | °C |
| 0x019B | Compressor code (Function Reserved) | 0~9999 | RW |  |
| 0x019C | Auxiliary electronic expansion valve selection | 0~10 | RW | 0: Enable, 1: Disable |
| 0x019D | Auxiliary EEV – temperature difference to reduce | 0~99 | RW | °C |
| 0x019E | Heating limit water temperature, start ambient temperature | -45~30 | RW | °C |
| 0x019F | Limit temperature constant P159 | 0~150 | RW |  |
| 0x01A0 | Limit temperature coefficient P160 | -500~500 | RW |  |
| 0x01A1 | Auxiliary pump selection | 0~10 | RW | 0: Hot water  1: Cooling  2: Floor heating  3: Cooling and floor heating  4: All mode |
| 0x01A2 | Anti-freezing interval for hot water pipes | 0~360 | RW | min |
| 0x01A3 | Minimum feedback of pump speed regulation | 0~70 | RW | % |
| 0x01A4 | Level control | 0~10 | RW | 0: Enable  1: Only Hot water  2: Only Heating  3: Disable |
| 0x01A5 | Load return difference | 1~15 | RW | °C |
| 0x01A6 | Load shedding hysteresis | 1~15 | RW | °C |
| 0x01A7 | Emergency stop return difference | 1~15 | RW | °C |
| 0x01A8 | Hot water mode start ratio | 1~100 | RW | % |
| 0x01A9 | Non-hot water mode start ratio | 1~100 | RW | % |
| 0x01AA | Loading cycle | 3~60 | RW | min |
| 0x01AB | Shield low voltage switch ambient temperature | -50~0 | RW | °C |
| 0x01AC | Target frequency constant c of DC fan | 40~70 | RW | Hz |
| 0x01AD | Target frequency of heating fan lower limit | 20~65 | RW | Hz |
| 0x01AE | Defrost valve opening | 0~480 | RW | P |
| 0x01AF | Constant temperature operation cycle | 0~360 | RW | min |
| 0x01B0 | Minimum defrosting time | 0~999 | RW | S |
| 0x01B1 | Defrost segmented water temperature setting value | 0~80 | RW | °C |
| 0x01B2 | High water temperature defrosting frequency | 40~120 | RW | Hz |
| 0x01B3 | Strong mode frequency increase value | 0~40 | RW | Hz |
| 0x01B4 | Powerful mode frequency cap increase value | 0~40 | RW | Hz |
| 0x01B5 | Defrost mode | 0~2 | RW | 0: Current  1: Heating  2: Hot Water |
| 0x01B6 | Pipe electric heating option | 0~2 | RW | 0: Full electricity  1: 3 kW  2: 6 kW  3: Disable |
| 0x01B7 | Parameter password setting | 0~9999 | RW | 0: disable |
| 0x01B8 | 35D working condition compressor frequency | 0~120 | RW | Hz |
| 0x01B9 | 35C working condition compressor frequency | 0~120 | RW | Hz |
| 0x01BA | 35B working condition compressor frequency | 0~120 | RW | Hz |
| 0x01BB | 35A working condition compressor frequency | 0~120 | RW | Hz |
| 0x01BC | 35E working condition compressor frequency | 0~120 | RW | Hz |
| 0x01BD | 55D working condition compressor frequency | 0~120 | RW | Hz |
| 0x01BE | 55C working condition compressor frequency | 0~120 | RW | Hz |
| 0x01BF | 55B working condition compressor frequency | 0~120 | RW | Hz |
| 0x01C0 | 55A working condition compressor frequency | 0~120 | RW | Hz |
| 0x01C1 | 55E working condition compressor frequency | 0~120 | RW | Hz |
| 0x01C2 | 35D working condition fan frequency | 0~60 | RW | Hz |
| 0x01C3 | 35C working condition fan frequency | 0~60 | RW | Hz |
| 0x01C4 | 35B working condition fan frequency | 0~60 | RW | Hz |
| 0x01C5 | 35A working condition fan frequency | 0~60 | RW | Hz |
| 0x01C6 | 35E working condition fan frequency | 0~60 | RW | Hz |
| 0x01C7 | 55D working condition fan frequency | 0~60 | RW | Hz |
| 0x01C8 | 55C working condition fan frequency | 0~60 | RW | Hz |
| 0x01C9 | 55B working condition fan frequency | 0~60 | RW | Hz |
| 0x01CA | 55A working condition fan frequency | 0~60 | RW | Hz |
| 0x01CB | 55E working condition fan frequency | 0~60 | RW | Hz |
| 0x01CC | 35D operating condition main valve target superheat | -10~10 | RW | °C |
| 0x01CD | 35C working condition main valve target superheat | -10~10 | RW | °C |
| 0x01CE | 35B working condition main valve target superheat | -10~10 | RW | °C |
| 0x01CF | 35A working condition main valve target superheat | -10~10 | RW | °C |
| 0x01D0 | 35E working condition main valve target superheat | -10~10 | RW | °C |
| 0x01D1 | 55D operating condition main valve target superheat | -10~10 | RW | °C |
| 0x01D2 | 55C operating condition main valve target superheat | -10~10 | RW | °C |
| 0x01D3 | 55B working condition main valve target superheat | -10~10 | RW | °C |
| 0x01D4 | 55A working condition main valve target superheat | -10~10 | RW | °C |
| 0x01D5 | 55E working condition main valve target superheat | -10~10 | RW | °C |
| 0x01D6 | Initial opening of main valve in 35D working condition | 0~500 | RW | P |
| 0x01D7 | Initial opening of main valve in 35C working condition | 0~500 | RW | P |
| 0x01D8 | Initial opening of main valve in 35B working condition | 0~500 | RW | P |
| 0x01D9 | Initial opening of main valve in 35A working condition | 0~500 | RW | P |
| 0x01DA | Initial opening of main valve in 35E working condition | 0~500 | RW | P |
| 0x01DB | Initial opening of main valve in 55D working condition | 0~500 | RW | P |
| 0x01DC | Initial opening of main valve in 55C working condition | 0~500 | RW | P |
| 0x01DD | Initial opening of main valve in 55B working condition | 0~500 | RW | P |
| 0x01DE | Initial opening of main valve in 55A working condition | 0~500 | RW | P |
| 0x01DF | Initial opening of main valve in 55E working condition | 0~500 | RW | P |
| 0x01E0 | 35D operating condition auxiliary valve target superheat | -10~10 | RW | °C |
| 0x01E1 | 35C operating condition auxiliary valve target superheat | -10~10 | RW | °C |
| 0x01E2 | 35B operating condition auxiliary valve target superheat | -10~10 | RW | °C |
| 0x01E3 | 35A working condition auxiliary valve target superheat | -10~10 | RW | °C |
| 0x01E4 | 35E working condition auxiliary valve target superheat | -10~10 | RW | °C |
| 0x01E5 | 55D working condition auxiliary valve target superheat | -10~10 | RW | °C |
| 0x01E6 | 55C working condition auxiliary valve target superheat | -10~10 | RW | °C |
| 0x01E7 | 55B auxiliary valve target superheat | -10~10 | RW | °C |
| 0x01E8 | 55A auxiliary valve target superheat | -10~10 | RW | °C |
| 0x01E9 | 55E auxiliary valve target superheat | -10~10 | RW | °C |
| 0x01EA | Initial opening of auxiliary valve in 35D working condition | 0~500 | RW | P |
| 0x01EB | Initial opening of auxiliary valve in 35C working condition | 0~500 | RW | P |
| 0x01EC | Initial opening of auxiliary valve in 35B working condition | 0~500 | RW | P |
| 0x01ED | Initial opening of auxiliary valve in 35A working condition | 0~500 | RW | P |
| 0x01EE | Initial opening of auxiliary valve in 35E working condition | 0~500 | RW | P |
| 0x01EF | Initial opening of auxiliary valve in 55D working condition | 0~500 | RW | P |
| 0x01F0 | Initial opening of auxiliary valve in 55C working condition | 0~500 | RW | P |
| 0x01F1 | Initial opening of auxiliary valve in 55B working condition | 0~500 | RW | P |
| 0x01F2 | Initial opening of auxiliary valve in 55A working condition | 0~500 | RW | P |
| 0x01F3 | Initial opening of auxiliary valve in 55E working condition | 0~500 | RW | P |
| 0x01F4 | Target water flow in 35 low water temperature condition | 0~100 | RW | L/min |
| 0x01F5 | Target water flow under 55 high water temperature conditions | 0~100 | RW | L/min |
| 0x01F6 | 35 Low water temperature rated fan frequency | 0~60 | RW | Hz |
| 0x01F7 | Initial opening of main valve under 35 low water temperature rated condition | 0~500 | RW | P |
| 0x01F8 | Initial opening of main valve under 55 high water temperature rated condition (fan freq) | 0~60 | RW | Hz |
| 0x01F9 | Initial opening of main valve under 55 high water temperature rated condition | 0~500 | RW | P |
| 0x01FA | Target superheat of main valve under 35 low water temperature rated condition | -10~10 | RW | °C |
| 0x01FB | PFC shutdown current | 0~50 | RW | A |
| 0x01FC | Target superheat of main valve under 55 high water temperature rated condition | -10~10 | RW | °C |
| 0x01FD | PFC turn-on current | 0~50 | RW | A |
| 0x01FE | Heating medium | 0~1 | RW | 0: Water  1: Antifreeze |
| 0x01FF | Smart Grid Options | 0~1 | RW | 0: Enable  1: Disable |
| 0x0200 | Peak grid running time | 30~999 | RW | min |
| 0x0201 | Dual temperature zone selection | 0~2 | RW | 0: Auto  1: Manual  2: Disable |
| 0x0202 | Mixed water regulating valve cycle | 5~20 | RW | min |
| 0x0203 | Mixing valve full cycle time | 0~180 | RW | S |
| 0x0204 | Max rotate speed of DC Water Pump | 50~99 | RW | % |
| 0x0205 | Rotate speed of DC water pump under constant temperature | 20~99 | RW | % |
| 0x0206 | Floor heating test mode selection | 0~1 | RW | 0: Enable  1: Disable |
