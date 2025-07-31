#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Base directory for flow cards
const FLOW_DIR = path.join(__dirname, '../.homeycompose/flow');

// Common argument patterns
const CONDITION_DROPDOWN = {
  type: "dropdown",
  name: "condition",
  title: {
    en: "Condition",
    nl: "Conditie"
  },
  values: [
    {
      id: "above",
      title: {
        en: "above",
        nl: "boven"
      }
    },
    {
      id: "below",
      title: {
        en: "below",
        nl: "onder"
      }
    }
  ]
};

const STATE_DROPDOWN = {
  type: "dropdown",
  name: "state",
  title: {
    en: "State",
    nl: "Status"
  },
  values: [
    {
      id: "on",
      title: {
        en: "on",
        nl: "aan"
      }
    },
    {
      id: "off",
      title: {
        en: "off",
        nl: "uit"
      }
    }
  ]
};

// Template definitions
const TEMPLATES = {
  // Temperature Alert Template
  temperature_alert: {
    type: 'trigger',
    pattern: {
      id: '{{sensor_id}}_temperature_alert',
      title: {
        en: '{{sensor_name_en}} temperature alert',
        nl: '{{sensor_name_nl}} temperatuur alarm'
      },
      titleFormatted: {
        en: '{{sensor_name_en}} temperature [[condition]] [[temperature]]°C',
        nl: '{{sensor_name_nl}} temperatuur [[condition]] [[temperature]]°C'
      },
      hint: {
        en: 'Triggers when {{sensor_description_en}} temperature goes above or below a specified level',
        nl: 'Wordt geactiveerd wanneer {{sensor_description_nl}} temperatuur boven of onder een bepaald nivo gaat'
      },
      args: [
        CONDITION_DROPDOWN,
        {
          type: "range",
          name: "temperature",
          title: {
            en: "Temperature (°C)",
            nl: "Temperatuur (°C)"
          },
          min: "{{min_temp}}",
          max: "{{max_temp}}",
          step: 1,
          units: "°C",
          placeholder: {
            en: "Temperature threshold in °C",
            nl: "Temperatuur drempel in °C"
          }
        }
      ],
      tokens: [
        {
          type: "number",
          name: "current_temperature",
          title: {
            en: "Current {{sensor_name_en}} temperature",
            nl: "Huidige {{sensor_name_nl}} temperatuur"
          },
          example: "{{temp_example}}"
        },
        {
          type: "number",
          name: "threshold_temperature",
          title: {
            en: "Threshold temperature",
            nl: "Drempel temperatuur"
          },
          example: "{{threshold_example}}"
        }
      ]
    },
    instances: [
      {
        sensor_id: 'coiler',
        sensor_name_en: 'Coiler',
        sensor_name_nl: 'Coiler',
        sensor_description_en: 'electricity coiler',
        sensor_description_nl: 'elektriciteit coiler',
        min_temp: -20,
        max_temp: 80,
        temp_example: 45.5,
        threshold_example: 50
      },
      {
        sensor_id: 'high_pressure',
        sensor_name_en: 'High pressure',
        sensor_name_nl: 'Hogedruk',
        sensor_description_en: 'high pressure saturation',
        sensor_description_nl: 'hogedruk verzadiging',
        min_temp: -20,
        max_temp: 100,
        temp_example: 65.5,
        threshold_example: 70
      },
      {
        sensor_id: 'low_pressure',
        sensor_name_en: 'Low pressure',
        sensor_name_nl: 'Lagedruk',
        sensor_description_en: 'low pressure saturation',
        sensor_description_nl: 'lagedruk verzadiging',
        min_temp: -30,
        max_temp: 50,
        temp_example: 15.5,
        threshold_example: 20
      },
      {
        sensor_id: 'incoiler',
        sensor_name_en: 'Incoiler',
        sensor_name_nl: 'Incoiler',
        sensor_description_en: 'incoiler',
        sensor_description_nl: 'incoiler',
        min_temp: -20,
        max_temp: 80,
        temp_example: 35.5,
        threshold_example: 40
      },
      {
        sensor_id: 'tank',
        sensor_name_en: 'Tank',
        sensor_name_nl: 'Tank',
        sensor_description_en: 'water tank',
        sensor_description_nl: 'watertank',
        min_temp: 0,
        max_temp: 90,
        temp_example: 55.5,
        threshold_example: 60
      },
      {
        sensor_id: 'suction',
        sensor_name_en: 'Suction',
        sensor_name_nl: 'Zuiging',
        sensor_description_en: 'suction',
        sensor_description_nl: 'zuiging',
        min_temp: -30,
        max_temp: 50,
        temp_example: 5.5,
        threshold_example: 10
      },
      {
        sensor_id: 'discharge',
        sensor_name_en: 'Discharge',
        sensor_name_nl: 'Ontlading',
        sensor_description_en: 'discharge',
        sensor_description_nl: 'ontlading',
        min_temp: 0,
        max_temp: 120,
        temp_example: 75.5,
        threshold_example: 80
      },
      {
        sensor_id: 'economizer_inlet',
        sensor_name_en: 'Economizer inlet',
        sensor_name_nl: 'Economizer inlaat',
        sensor_description_en: 'economizer inlet',
        sensor_description_nl: 'economizer inlaat',
        min_temp: -30,
        max_temp: 80,
        temp_example: 25.5,
        threshold_example: 30
      },
      {
        sensor_id: 'economizer_outlet',
        sensor_name_en: 'Economizer outlet',
        sensor_name_nl: 'Economizer uitlaat',
        sensor_description_en: 'economizer outlet',
        sensor_description_nl: 'economizer uitlaat',
        min_temp: -30,
        max_temp: 80,
        temp_example: 35.5,
        threshold_example: 40
      }
    ]
  },

  // Voltage Alert Template
  voltage_alert: {
    type: 'trigger',
    pattern: {
      id: 'phase_{{phase_id}}_voltage_alert',
      title: {
        en: 'Phase {{phase_name}} voltage alert',
        nl: 'Fase {{phase_name}} spanning alarm'
      },
      titleFormatted: {
        en: 'Phase {{phase_name}} voltage [[condition]] [[voltage]] volts',
        nl: 'Fase {{phase_name}} spanning [[condition]] [[voltage]] volt'
      },
      hint: {
        en: 'Triggers when Phase {{phase_name}} voltage goes above or below a specified level',
        nl: 'Wordt geactiveerd wanneer Fase {{phase_name}} spanning boven of onder een bepaald nivo gaat'
      },
      args: [
        CONDITION_DROPDOWN,
        {
          type: "range",
          name: "voltage",
          title: {
            en: "Voltage (V)",
            nl: "Spanning (V)"
          },
          min: 180,
          max: 260,
          step: 5,
          units: "V",
          placeholder: {
            en: "Voltage threshold in volts",
            nl: "Spanning drempel in volt"
          }
        }
      ],
      tokens: [
        {
          type: "number",
          name: "current_voltage_{{phase_id}}",
          title: {
            en: "Phase {{phase_name}} voltage",
            nl: "Fase {{phase_name}} spanning"
          },
          example: 230
        },
        {
          type: "number",
          name: "threshold_voltage",
          title: {
            en: "Threshold voltage",
            nl: "Drempel spanning"
          },
          example: 220
        }
      ]
    },
    instances: [
      { phase_id: 'a', phase_name: 'A' },
      { phase_id: 'b', phase_name: 'B' },
      { phase_id: 'c', phase_name: 'C' }
    ]
  },

  // Current Alert Template
  current_alert: {
    type: 'trigger',
    pattern: {
      id: 'phase_{{phase_id}}_current_alert',
      title: {
        en: 'Phase {{phase_name}} current alert',
        nl: 'Fase {{phase_name}} stroom alarm'
      },
      titleFormatted: {
        en: 'Phase {{phase_name}} current [[condition]] [[current]] amperes',
        nl: 'Fase {{phase_name}} stroom [[condition]] [[current]] ampère'
      },
      hint: {
        en: 'Triggers when Phase {{phase_name}} current goes above or below a specified level',
        nl: 'Wordt geactiveerd wanneer Fase {{phase_name}} stroom boven of onder een bepaald nivo gaat'
      },
      args: [
        CONDITION_DROPDOWN,
        {
          type: "range",
          name: "current",
          title: {
            en: "Current (A)",
            nl: "Stroom (A)"
          },
          min: 0,
          max: 50,
          step: 1,
          units: "A",
          placeholder: {
            en: "Current threshold in amperes",
            nl: "Stroom drempel in ampère"
          }
        }
      ],
      tokens: [
        {
          type: "number",
          name: "current_current_{{phase_id}}",
          title: {
            en: "Phase {{phase_name}} current",
            nl: "Fase {{phase_name}} stroom"
          },
          example: 15
        },
        {
          type: "number",
          name: "threshold_current",
          title: {
            en: "Threshold current",
            nl: "Drempel stroom"
          },
          example: 20
        }
      ]
    },
    instances: [
      { phase_id: 'b', phase_name: 'B' },
      { phase_id: 'c', phase_name: 'C' }
    ]
  },

  // Pressure Alert Template
  pulse_steps_alert: {
    type: 'trigger',
    pattern: {
      id: '{{sensor_id}}_pulse_steps_alert',
      title: {
        en: '{{sensor_name}} pressure alert',
        nl: '{{sensor_name}} druk alarm'
      },
      titleFormatted: {
        en: '{{sensor_name}} pressure [[condition]] [[pressure]]',
        nl: '{{sensor_name}} druk [[condition]] [[pressure]]'
      },
      hint: {
        en: 'Triggers when {{sensor_description_en}} pressure goes above or below a specified level',
        nl: 'Wordt geactiveerd wanneer {{sensor_description_nl}} druk boven of onder een bepaald nivo gaat'
      },
      args: [
        CONDITION_DROPDOWN,
        {
          type: "range",
          name: "pressure",
          title: {
            en: "Pressure",
            nl: "Druk"
          },
          min: -500,
          max: 500,
          step: 10,
          units: "Pulse-steps",
          placeholder: {
            en: "Pressure threshold",
            nl: "Druk drempel"
          }
        }
      ],
      tokens: [
        {
          type: "number",
          name: "current_pressure",
          title: {
            en: "Current {{sensor_name}} pressure",
            nl: "Huidige {{sensor_name}} druk"
          },
          example: "{{pressure_example}}"
        },
        {
          type: "number",
          name: "threshold_pressure",
          title: {
            en: "Threshold pressure",
            nl: "Drempel druk"
          },
          example: "{{threshold_example}}"
        }
      ]
    },
    instances: [
      {
        sensor_id: 'eev',
        sensor_name: 'EEV',
        sensor_description_en: 'Electronic Expansion Valve (EEV)',
        sensor_description_nl: 'elektronische expansieklep (EEV)',
        pressure_example: 450,
        threshold_example: 400
      },
      {
        sensor_id: 'evi',
        sensor_name: 'EVI',
        sensor_description_en: 'Enhanced Vapor Injection (EVI)',
        sensor_description_nl: 'Enhanced Vapor Injection (EVI)',
        pressure_example: 250,
        threshold_example: 200
      }
    ]
  },

  // State Change Template
  state_change: {
    type: 'trigger',
    pattern: {
      id: '{{state_id}}_state_changed',
      title: {
        en: '{{state_name_en}} state changed',
        nl: '{{state_name_nl}} status gewijzigd'
      },
      titleFormatted: {
        en: '{{state_name_en}} turned [[state]]',
        nl: '{{state_name_nl}} [[state]]'
      },
      hint: {
        en: 'Triggers when {{state_description_en}} changes state',
        nl: 'Wordt geactiveerd wanneer {{state_description_nl}} van status wijzigt'
      },
      args: [
        {
          type: "dropdown",
          name: "state",
          title: {
            en: "State",
            nl: "Status"
          },
          values: "{{state_values}}"
        }
      ],
      tokens: [
        {
          type: "string",
          name: "current_state",
          title: {
            en: "Current {{state_name_en}} state",
            nl: "Huidige {{state_name_nl}} status"
          },
          example: "{{state_example}}"
        }
      ]
    },
    instances: [
      {
        state_id: 'defrost',
        state_name_en: 'Defrost',
        state_name_nl: 'Ontdooien',
        state_description_en: 'defrost system',
        state_description_nl: 'ontdooi systeem',
        state_values: [
          { id: "active", title: { en: "active", nl: "actief" } },
          { id: "inactive", title: { en: "inactive", nl: "inactief" } }
        ],
        state_example: "active"
      },
      {
        state_id: 'compressor',
        state_name_en: 'Compressor',
        state_name_nl: 'Compressor',
        state_description_en: 'compressor',
        state_description_nl: 'compressor',
        state_values: [
          { id: "running", title: { en: "running", nl: "draaiend" } },
          { id: "stopped", title: { en: "stopped", nl: "gestopt" } }
        ],
        state_example: "running"
      },
      {
        state_id: 'backwater',
        state_name_en: 'Backwater',
        state_name_nl: 'Terugstroming',
        state_description_en: 'backwater system',
        state_description_nl: 'terugstroming systeem',
        state_values: [
          { id: "flowing", title: { en: "flowing", nl: "stromend" } },
          { id: "blocked", title: { en: "blocked", nl: "geblokkeerd" } }
        ],
        state_example: "flowing"
      }
    ]
  },

  // Simple triggers (unique cards)
  simple_triggers: {
    type: 'trigger',
    pattern: {
      id: '{{trigger_id}}',
      title: {
        en: '{{title_en}}',
        nl: '{{title_nl}}'
      },
      titleFormatted: {
        en: '{{title_formatted_en}}',
        nl: '{{title_formatted_nl}}'
      },
      hint: {
        en: '{{hint_en}}',
        nl: '{{hint_nl}}'
      },
      args: "{{args}}",
      tokens: "{{tokens}}"
    },
    instances: [
      {
        trigger_id: 'fault_detected',
        title_en: 'Fault detected',
        title_nl: 'Storing gedetecteerd',
        title_formatted_en: 'Fault code [[fault_code]] detected',
        title_formatted_nl: 'Storing code [[fault_code]] gedetecteerd',
        hint_en: 'Triggers when a system fault is detected',
        hint_nl: 'Wordt geactiveerd wanneer een systeem storing wordt gedetecteerd',
        args: [
          {
            type: "range",
            name: "fault_code",
            title: { en: "Fault code", nl: "Storing code" },
            min: 1,
            max: 100,
            step: 1,
            units: "",
            placeholder: { en: "Fault code to monitor", nl: "Storing code om te monitoren" }
          }
        ],
        tokens: [
          {
            type: "number",
            name: "fault_code",
            title: { en: "Fault code", nl: "Storing code" },
            example: 15
          },
          {
            type: "string",
            name: "fault_description",
            title: { en: "Fault description", nl: "Storing beschrijving" },
            example: "Compressor overheating"
          }
        ]
      },
      {
        trigger_id: 'power_threshold_exceeded',
        title_en: 'Power threshold exceeded',
        title_nl: 'Vermogen drempel overschreden',
        title_formatted_en: 'Power consumption exceeded [[threshold]] W',
        title_formatted_nl: 'Stroomverbruik overschreed [[threshold]] W',
        hint_en: 'Triggers when power consumption exceeds specified threshold',
        hint_nl: 'Wordt geactiveerd wanneer stroomverbruik een drempel overschrijdt',
        args: [
          {
            type: "range",
            name: "threshold",
            title: { en: "Power threshold (W)", nl: "Vermogen drempel (W)" },
            min: 100,
            max: 10000,
            step: 100,
            units: "W",
            placeholder: { en: "Power threshold in watts", nl: "Vermogen drempel in watt" }
          }
        ],
        tokens: [
          {
            type: "number",
            name: "current_power",
            title: { en: "Current power consumption", nl: "Huidig stroomverbruik" },
            example: 3500
          },
          {
            type: "number",
            name: "threshold_power",
            title: { en: "Threshold power", nl: "Drempel vermogen" },
            example: 3000
          }
        ]
      }
    ]
  },

  // Action templates
  setting_actions: {
    type: 'action',
    pattern: {
      id: 'set_{{setting_id}}',
      title: {
        en: 'Set {{setting_name_en}}',
        nl: '{{setting_name_nl}} instellen'
      },
      titleFormatted: {
        en: 'Set {{setting_name_en}} to [[{{arg_name}}]]',
        nl: '{{setting_name_nl}} instellen op [[{{arg_name}}]]'
      },
      hint: {
        en: 'Set the {{setting_description_en}}',
        nl: 'Stel de {{setting_description_nl}} in'
      },
      args: [
        "{{argument}}"
      ]
    },
    instances: [
      {
        setting_id: 'target_temperature',
        setting_name_en: 'target temperature',
        setting_name_nl: 'doel temperatuur',
        setting_description_en: 'target temperature for the heat pump',
        setting_description_nl: 'doel temperatuur voor de warmtepomp',
        arg_name: 'temperature',
        argument: {
          type: "range",
          name: "temperature",
          title: { en: "Temperature (°C)", nl: "Temperatuur (°C)" },
          min: 5,
          max: 60,
          step: 0.5,
          units: "°C",
          placeholder: { en: "Target temperature in °C", nl: "Doel temperatuur in °C" }
        }
      },
      {
        setting_id: 'hotwater_temperature',
        setting_name_en: 'hot water temperature',
        setting_name_nl: 'warm water temperatuur',
        setting_description_en: 'hot water temperature setting',
        setting_description_nl: 'warm water temperatuur instelling',
        arg_name: 'temperature',
        argument: {
          type: "range",
          name: "temperature",
          title: { en: "Hot water temperature (°C)", nl: "Warm water temperatuur (°C)" },
          min: 30,
          max: 75,
          step: 1,
          units: "°C",
          placeholder: { en: "Hot water temperature in °C", nl: "Warm water temperatuur in °C" }
        }
      }
    ]
  },

  // Remaining action cards  
  enum_actions: {
    type: 'action',
    pattern: {
      id: 'set_{{setting_id}}',
      title: {
        en: 'Set {{setting_name_en}}',
        nl: '{{setting_name_nl}} instellen'
      },
      titleFormatted: {
        en: 'Set {{setting_name_en}} to [[{{arg_name}}]]',
        nl: '{{setting_name_nl}} instellen op [[{{arg_name}}]]'
      },
      hint: {
        en: 'Set the {{setting_description_en}}',
        nl: 'Stel de {{setting_description_nl}} in'
      },
      args: [
        "{{argument}}"
      ]
    },
    instances: [
      {
        setting_id: 'heating_mode',
        setting_name_en: 'heating mode',
        setting_name_nl: 'verwarmingsmodus',
        setting_description_en: 'heating operation mode',
        setting_description_nl: 'verwarming bedrijfsmodus',
        arg_name: 'mode',
        argument: {
          type: "dropdown",
          name: "mode",
          title: { en: "Heating mode", nl: "Verwarmingsmodus" },
          values: [
            { id: "AUTO", title: { en: "Auto", nl: "Automatisch" } },
            { id: "HEAT", title: { en: "Heat", nl: "Verwarmen" } },
            { id: "COOL", title: { en: "Cool", nl: "Koelen" } }
          ]
        }
      },
      {
        setting_id: 'work_mode',
        setting_name_en: 'work mode',
        setting_name_nl: 'werkmodus',
        setting_description_en: 'system work mode',
        setting_description_nl: 'systeem werkmodus',
        arg_name: 'mode',
        argument: {
          type: "dropdown",
          name: "mode",
          title: { en: "Work mode", nl: "Werkmodus" },
          values: [
            { id: "AUTO", title: { en: "Auto", nl: "Automatisch" } },
            { id: "MANUAL", title: { en: "Manual", nl: "Handmatig" } }
          ]
        }
      },
      {
        setting_id: 'capacity',
        setting_name_en: 'hot water curve setting',
        setting_name_nl: 'warmwater curve instelling',
        setting_description_en: 'hot water curve setting for optimal efficiency',
        setting_description_nl: 'warmwater curve instelling voor optimale efficiëntie',
        arg_name: 'capacity',
        argument: {
          type: "dropdown",
          name: "capacity",
          title: { en: "Hot water curve setting", nl: "Instelling warmwater curve" },
          values: [
            { id: "OFF", title: { en: "OFF", nl: "UIT" } },
            { id: "H1", title: { en: "H1", nl: "H1" } },
            { id: "H2", title: { en: "H2", nl: "H2" } },
            { id: "H3", title: { en: "H3", nl: "H3" } },
            { id: "H4", title: { en: "H4", nl: "H4" } }
          ]
        }
      },
      {
        setting_id: 'volume',
        setting_name_en: 'electricity consumption checking',
        setting_name_nl: 'stroomverbruik controleren',
        setting_description_en: 'electricity consumption checking level',
        setting_description_nl: 'stroomverbruik controle niveau',
        arg_name: 'volume',
        argument: {
          type: "range",
          name: "volume",
          title: { en: "Electricity consumption checking", nl: "Stroomverbruik controleren" },
          min: 0,
          max: 2,
          step: 1,
          units: "",
          placeholder: { en: "Setting level (0-2)", nl: "Instelling niveau (0-2)" }
        }
      },
      {
        setting_id: 'device_onoff',
        setting_name_en: 'device power',
        setting_name_nl: 'apparaat vermogen',
        setting_description_en: 'device power state',
        setting_description_nl: 'apparaat vermogen status',
        arg_name: 'state',
        argument: {
          type: "dropdown",
          name: "state",
          title: { en: "Power state", nl: "Vermogen status" },
          values: [
            { id: "on", title: { en: "On", nl: "Aan" } },
            { id: "off", title: { en: "Off", nl: "Uit" } }
          ]
        }
      },
      {
        setting_id: 'water_mode',
        setting_name_en: 'water control mode',
        setting_name_nl: 'water controle modus',
        setting_description_en: 'water control mode setting',
        setting_description_nl: 'water controle modus instelling',
        arg_name: 'mode',
        argument: {
          type: "dropdown",
          name: "mode",
          title: { en: "Water control mode", nl: "Water controle modus" },
          values: [
            { id: "AUTO", title: { en: "Auto", nl: "Automatisch" } },
            { id: "MANUAL", title: { en: "Manual", nl: "Handmatig" } }
          ]
        }
      },
      {
        setting_id: 'heating_curve',
        setting_name_en: 'heating curve',
        setting_name_nl: 'verwarmingscurve',
        setting_description_en: 'heating curve setting',
        setting_description_nl: 'verwarmingscurve instelling',
        arg_name: 'curve',
        argument: {
          type: "dropdown",
          name: "curve",
          title: { en: "Heating curve", nl: "Verwarmingscurve" },
          values: [
            { id: "LOW", title: { en: "Low", nl: "Laag" } },
            { id: "MEDIUM", title: { en: "Medium", nl: "Gemiddeld" } },
            { id: "HIGH", title: { en: "High", nl: "Hoog" } }
          ]
        }
      }
    ]
  },

  // Energy and consumption triggers
  energy_triggers: {
    type: 'trigger',
    pattern: {
      id: '{{trigger_id}}',
      title: {
        en: '{{title_en}}',
        nl: '{{title_nl}}'
      },
      titleFormatted: {
        en: '{{title_formatted_en}}',
        nl: '{{title_formatted_nl}}'
      },
      hint: {
        en: '{{hint_en}}',
        nl: '{{hint_nl}}'
      },
      args: "{{args}}",
      tokens: "{{tokens}}"
    },
    instances: [
      {
        trigger_id: 'daily_consumption_threshold',
        title_en: 'Daily consumption threshold reached',
        title_nl: 'Dagverbruik drempel bereikt',
        title_formatted_en: 'Daily consumption reached [[threshold]] kWh',
        title_formatted_nl: 'Dagverbruik bereikte [[threshold]] kWh',
        hint_en: 'Triggers when daily electricity consumption reaches specified threshold',
        hint_nl: 'Wordt geactiveerd wanneer het dagelijkse stroomverbruik een drempel bereikt',
        args: [
          {
            type: "range",
            name: "threshold",
            title: { en: "Daily threshold (kWh)", nl: "Dagelijkse drempel (kWh)" },
            min: 1,
            max: 100,
            step: 1,
            units: "kWh",
            placeholder: { en: "Daily consumption threshold", nl: "Dagverbruik drempel" }
          }
        ],
        tokens: [
          {
            type: "number",
            name: "daily_consumption",
            title: { en: "Daily consumption", nl: "Dagverbruik" },
            example: 25
          },
          {
            type: "number",
            name: "threshold_value",
            title: { en: "Threshold value", nl: "Drempel waarde" },
            example: 30
          }
        ]
      },
      {
        trigger_id: 'total_consumption_milestone',
        title_en: 'Total consumption milestone reached',
        title_nl: 'Totaalverbruik mijlpaal bereikt',
        title_formatted_en: 'Total consumption reached [[milestone]] kWh',
        title_formatted_nl: 'Totaalverbruik bereikte [[milestone]] kWh',
        hint_en: 'Triggers when total electricity consumption reaches specified milestones',
        hint_nl: 'Wordt geactiveerd wanneer het totale stroomverbruik bepaalde mijlpalen bereikt',
        args: [
          {
            type: "range",
            name: "milestone",
            title: { en: "Consumption milestone (kWh)", nl: "Verbruik mijlpaal (kWh)" },
            min: 100,
            max: 50000,
            step: 100,
            units: "kWh",
            placeholder: { en: "Total consumption milestone in kWh", nl: "Totaalverbruik mijlpaal in kWh" }
          }
        ],
        tokens: [
          {
            type: "number",
            name: "total_consumption",
            title: { en: "Total consumption", nl: "Totaalverbruik" },
            example: 15000
          },
          {
            type: "number",
            name: "milestone_value",
            title: { en: "Milestone value", nl: "Mijlpaal waarde" },
            example: 15000
          }
        ]
      }
    ]
  },

  // Remaining condition cards
  remaining_conditions: {
    type: 'condition',
    pattern: {
      id: '{{condition_id}}',
      title: {
        en: '{{title_en}}',
        nl: '{{title_nl}}'
      },
      titleFormatted: {
        en: '{{title_formatted_en}}',
        nl: '{{title_formatted_nl}}'
      },
      hint: {
        en: '{{hint_en}}',
        nl: '{{hint_nl}}'
      },
      args: "{{args}}"
    },
    instances: [
      {
        condition_id: 'temperature_differential',
        title_en: 'Temperature differential check',
        title_nl: 'Temperatuur verschil controle',
        title_formatted_en: 'Temperature differential is !{{above|below}} [[differential]]°C',
        title_formatted_nl: 'Temperatuur verschil is !{{boven|onder}} [[differential]]°C',
        hint_en: 'Check if the temperature difference between inlet and outlet is above or below a threshold',
        hint_nl: 'Controleer of het temperatuurverschil tussen inlaat en uitlaat boven of onder een drempel is',
        args: [
          {
            type: "range",
            name: "differential",
            title: { en: "Temperature differential (°C)", nl: "Temperatuur verschil (°C)" },
            min: 1,
            max: 50,
            step: 1,
            units: "°C",
            placeholder: { en: "Temperature differential threshold", nl: "Temperatuur verschil drempel" }
          }
        ]
      },
      {
        condition_id: 'electrical_balance_check',
        title_en: 'Electrical balance check',
        title_nl: 'Elektrische balans controle',
        title_formatted_en: '3-phase electrical balance is !{{within|outside}} [[tolerance]]% tolerance',
        title_formatted_nl: '3-fase elektrische balans is !{{binnen|buiten}} [[tolerance]]% tolerantie',
        hint_en: 'Check if the 3-phase electrical currents are balanced within specified tolerance',
        hint_nl: 'Controleer of de 3-fase elektrische stromen gebalanceerd zijn binnen de tolerantie',
        args: [
          {
            type: "range",
            name: "tolerance",
            title: { en: "Balance tolerance (%)", nl: "Balans tolerantie (%)" },
            min: 1,
            max: 20,
            step: 1,
            units: "%",
            placeholder: { en: "Electrical balance tolerance percentage", nl: "Elektrische balans tolerantie percentage" }
          }
        ]
      },
      {
        condition_id: 'water_flow_rate_check',
        title_en: 'Water flow rate check',
        title_nl: 'Water doorstroming controle',
        title_formatted_en: 'Water flow rate is !{{above|below}} [[flow_rate]] L/min',
        title_formatted_nl: 'Water doorstroming is !{{boven|onder}} [[flow_rate]] L/min',
        hint_en: 'Check if water flow rate is above or below specified threshold',
        hint_nl: 'Controleer of water doorstroming boven of onder een drempel is',
        args: [
          {
            type: "range",
            name: "flow_rate",
            title: { en: "Flow rate (L/min)", nl: "Doorstroming (L/min)" },
            min: 1,
            max: 100,
            step: 1,
            units: "L/min",
            placeholder: { en: "Water flow rate threshold", nl: "Water doorstroming drempel" }
          }
        ]
      },
      {
        condition_id: 'system_pulse_steps_differential',
        title_en: 'System pulse-steps differential check',
        title_nl: 'Systeem puls-stappen verschil controle',
        title_formatted_en: 'System pulse-steps differential is !{{above|below}} [[differential]]',
        title_formatted_nl: 'Systeem puls-stappen verschil is !{{boven|onder}} [[differential]]',
        hint_en: 'Check if the pulse-steps difference between EEV and EVI is above or below a threshold',
        hint_nl: 'Controleer of het puls-stappen verschil tussen EEV en EVI boven of onder een drempel is',
        args: [
          {
            type: "range",
            name: "differential",
            title: { en: "Pressure differential", nl: "Druk verschil" },
            min: 0,
            max: 1000,
            step: 10,
            units: "Pulse-steps",
            placeholder: { en: "Pressure differential threshold", nl: "Druk verschil drempel" }
          }
        ]
      }
    ]
  }
};

// Template substitution function
function substituteTemplate(template, variables) {
  // Deep clone the template to avoid modifying the original
  let result = JSON.parse(JSON.stringify(template));
  
  // Recursive function to replace placeholders
  function replaceInObject(obj) {
    if (typeof obj === 'string') {
      // Replace placeholders in strings
      let str = obj;
      for (const [key, value] of Object.entries(variables)) {
        const placeholder = `{{${key}}}`;
        if (str.includes(placeholder)) {
          if (typeof value === 'object') {
            // If the entire string is a placeholder for an object, replace it
            if (str === placeholder) {
              return value;
            }
          } else {
            // Check if the string is only a placeholder and the value is numeric
            if (str === placeholder && typeof value === 'number') {
              return value; // Return as number, not string
            }
            str = str.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), String(value));
          }
        }
      }
      return str;
    } else if (Array.isArray(obj)) {
      return obj.map(replaceInObject);
    } else if (typeof obj === 'object' && obj !== null) {
      const newObj = {};
      for (const [key, value] of Object.entries(obj)) {
        newObj[key] = replaceInObject(value);
      }
      return newObj;
    }
    return obj;
  }
  
  return replaceInObject(result);
}

// Generate flow cards
function generateFlowCards() {
  console.log('🚀 Starting flow card generation...');
  
  // Ensure directories exist
  const dirs = {
    trigger: path.join(FLOW_DIR, 'triggers'),
    action: path.join(FLOW_DIR, 'actions'),
    condition: path.join(FLOW_DIR, 'conditions')
  };
  
  for (const dir of Object.values(dirs)) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  let generatedCount = 0;
  const templateStats = {};
  
  for (const [templateName, template] of Object.entries(TEMPLATES)) {
    console.log(`📝 Processing template: ${templateName}`);
    templateStats[templateName] = 0;
    
    for (const instance of template.instances) {
      const flowCard = substituteTemplate(template.pattern, instance);
      const filename = `${flowCard.id}.json`;
      const targetDir = dirs[template.type] || dirs.trigger;
      const filepath = path.join(targetDir, filename);
      
      fs.writeFileSync(filepath, JSON.stringify(flowCard, null, 2));
      console.log(`  ✅ Generated: ${filename} (${template.type})`);
      generatedCount++;
      templateStats[templateName]++;
    }
  }
  
  console.log(`\n🎉 Generation complete!`);
  console.log(`📊 Generated ${generatedCount} flow cards from ${Object.keys(TEMPLATES).length} templates:`);
  for (const [template, count] of Object.entries(templateStats)) {
    console.log(`   - ${template}: ${count} cards`);
  }
}

// Run the generator
if (require.main === module) {
  generateFlowCards();
}

module.exports = { generateFlowCards, TEMPLATES };