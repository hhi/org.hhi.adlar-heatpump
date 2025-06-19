// Adlar mapping for Tuya devices

export interface DpsEntry {
  code: string;
  name: string;
  adlar: string;
}

export class AdlarMapping {
  static capabilities: Record<string, number[]> = {
    onoff: [1],
    target_temperature: [4],
    measure_power: [104],
    measure_water: [39],
  };

  static customCapabilities: Record<string, number[]> = {
    meter_power_power_consumption: [18],
    meter_power_electric_total: [105],
    measure_current_cur_current: [102],
    measure_current_b_cur: [109],
    measure_current_c_cur: [110],
    measure_voltage_voltage_current: [103],
    measure_voltage_bv: [111],
    measure_voltage_cv: [112],
    measure_frequency_compressor_strength: [20],
    measure_frequency_fan_motor_frequency: [40],
    measure_temperature_temp_top: [21],
    measure_temperature_temp_bottom: [22],
    measure_temperature_coiler_temp: [23],
    measure_temperature_venting_temp: [24],
    measure_temperature_around_temp: [26],
    measure_temperature_temp_current_f: [35],
    measure_temperature_top_temp_f: [36],
    measure_temperature_bottom_temp_f: [37],
    measure_temperature_around_temp_f: [38],
    measure_temperature_coiler_temp_f: [41],
    measure_temperature_eviout: [108],
    measure_temperature_evlin: [107],
  };

  static adlarCapabilities: Record<string, number[]> = {
    adlar_measure_pressure_temp_current: [16],
    adlar_measure_pressure_effluent_temp: [25],
    adlar_enum_mode: [2],
    adlar_enum_work_mode: [5],
    adlar_enum_water_mode: [10],
    adlar_enum_capacity_set: [11],
    adlar_enum_countdown_set: [13],
    adlar_enum_volume_set: [106],
    adlar_hotwater: [101],
    adlar_state_compressor_state: [27],
    adlar_state_backwater: [31],
    adlar_state_defrost_state: [33],
    adlar_time: [14],
    adlar_fault: [15],
  };

  static allCapabilities: Record<string, number[]> = {
    ...AdlarMapping.capabilities,
    ...AdlarMapping.customCapabilities,
    ...AdlarMapping.adlarCapabilities,
  };

  static allArraysSwapped: Record<number, string> = Object.fromEntries(
    Object.entries(AdlarMapping.allCapabilities).map(([key, value]) => [value[0], key]),
  );

  static dps: Record<string, DpsEntry> = {
    dps_1: { code: 'switch', name: 'Switch', adlar: 'Schakelaar' },
    dps_2: { code: 'mode', name: 'Mode', adlar: '(Verwarmings)modus' },
    dps_4: { code: 'temp_set', name: 'Target temp', adlar: 'Stel temperatuur' },
    dps_5: { code: 'work_mode', name: 'Working mode', adlar: 'Bedrijfsmodus' },
    dps_10: { code: 'water_mode', name: 'Control Temperature', adlar: 'Temperatuurregeling Water' },
    dps_11: { code: 'capacity_set', name: 'Hot water curve setting', adlar: 'Instelling warmwater curve' },
    dps_13: { code: 'countdown_set', name: 'Curve setting', adlar: 'Instellingen verwarmingscurve' },
    dps_14: { code: 'countdown_left', name: 'Countdown Left', adlar: 'Overgebleven tijd' },
    dps_15: { code: 'fault', name: 'Fault', adlar: 'Fout toestand' },
    dps_16: { code: 'temp_current', name: 'EEV Open', adlar: 'EEV Open' },
    dps_18: { code: 'power_consumption', name: 'Electricity Consumption of Today', adlar: 'Stroom dagverbruik' },
    dps_20: { code: 'compressor_strength', name: 'Compressor Frequency', adlar: 'Compressor frequentie' },
    dps_21: { code: 'temp_top', name: 'Inlet temp', adlar: 'Water intrede temperatuur' },
    dps_22: { code: 'temp_bottom', name: 'Outlet temp', adlar: 'Water uittrede temperatuur' },
    dps_23: { code: 'coiler_temp', name: 'Coiler temp', adlar: 'Verdampingscondensator temperatuur' },
    dps_24: { code: 'venting_temp', name: 'Discharge temp', adlar: 'Persgas temperatuur' },
    dps_25: { code: 'effluent_temp', name: 'EVI Open', adlar: 'EVI-openingsstop' },
    dps_26: { code: 'around_temp', name: 'Ambient temp', adlar: 'Buitentemperatuur' },
    dps_27: { code: 'compressor_state', name: 'Compressor state', adlar: 'compressor_status' },
    dps_31: { code: 'backwater', name: 'Backwater state', adlar: 'Retourwater status' },
    dps_33: { code: 'defrost_state', name: 'Defrosting', adlar: 'Ontdooi status' },
    dps_35: { code: 'temp_current_f', name: 'High pressure temp', adlar: 'Hogedruk verzadigingstemperatuur' },
    dps_36: { code: 'top_temp_f', name: 'Low presure temp', adlar: 'Lagedruk verzadigingstemperatuur' },
    dps_37: { code: 'bottom_temp_f', name: 'Incoiler temp', adlar: 'Condensor temperatuur' },
    dps_38: { code: 'around_temp_f', name: 'Tank temp', adlar: 'Tapwater temperatuur' },
    dps_39: { code: 'venting_temp_f', name: 'Water flow', adlar: 'Water flow' },
    dps_40: { code: 'effluent_temp_f', name: 'Fan motor frequency', adlar: 'Ventilator frequentie' },
    dps_41: { code: 'coiler_temp_f', name: 'Suction Temp', adlar: 'Zuiggas temperatuur' },
    dps_101: { code: 'minitemp_set', name: 'Hot Water Set Temp', adlar: 'Warmwater stel temperatuur' },
    dps_102: { code: 'cur_current', name: 'Current A', adlar: 'Hudige stroomsterkte' },
    dps_103: { code: 'voltage_current', name: 'Voltage A', adlar: 'Huidige spanning' },
    dps_104: { code: 'cur_power', name: 'Power', adlar: 'Huidig vermogen' },
    dps_105: { code: 'electric_total', name: 'Total Electricity Consumption', adlar: 'Totaal stroomverbruik' },
    dps_106: { code: 'volume_set', name: 'Electricity Consumption Checking', adlar: 'Stroomverbruik controle' },
    dps_107: { code: 'evlin', name: 'Economizer inlet Temp', adlar: 'EVI wamtewisselaar zuiggas temperatuur' },
    dps_108: { code: 'eviout', name: 'Economy outlet temp', adlar: 'EVI wamtewisselaar persgas temperatuur' },
    dps_109: { code: 'b_cur', name: 'Current B', adlar: 'Amperage B' },
    dps_110: { code: 'c_cur', name: 'Current C', adlar: 'Amperage C' },
    dps_111: { code: 'bv', name: 'Voltage B', adlar: 'Voltage B' },
    dps_112: { code: 'cv', name: 'Voltage C', adlar: 'Voltage C' },
  };
}
